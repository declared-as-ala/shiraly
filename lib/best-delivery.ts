import 'server-only';

/**
 * Best Delivery (best-delivery.net) SOAP integration — backend only.
 *
 * Dependency-free: builds SOAP 1.1 envelopes and POSTs them with fetch, then
 * parses responses with a tolerant (namespace-agnostic) XML reader. This avoids
 * the heavy `soap` package and works in Next.js server routes.
 *
 * Docs: https://doc.best-delivery.net/   WSDL: serviceShipments.php?wsdl
 *
 * NOTE: The SOAP target namespace + a couple of element names below are based on
 * the documented field names. If the live WSDL uses different namespaces, adjust
 * NAMESPACE / the wrapper element names — the response parser is already tolerant
 * of namespace prefixes, so only the request side may need tuning.
 */

// ── Config ──────────────────────────────────────────────────────────────────
const WSDL_URL = process.env.BEST_DELIVERY_WSDL_URL ?? 'https://api.best-delivery.net/serviceShipments.php?wsdl';
const LOGIN = process.env.BEST_DELIVERY_LOGIN ?? '';
const PASSWORD = process.env.BEST_DELIVERY_PASSWORD ?? '';
// Target namespace for the service — override via env if the WSDL differs.
const NAMESPACE = process.env.BEST_DELIVERY_NAMESPACE ?? 'urn:serviceShipments';

/** SOAP endpoint = WSDL URL without the ?wsdl query. */
function endpoint(): string {
  return WSDL_URL.replace(/\?wsdl.*$/i, '');
}

export function isConfigured(): boolean {
  return Boolean(LOGIN && PASSWORD && WSDL_URL);
}

const TIMEOUT_MS = Number(process.env.BEST_DELIVERY_TIMEOUT_MS) || 20000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

// ── WSDL introspection (the equivalent of $client->__getFunctions()) ───────────
// We read the REAL targetNamespace + operation names + soapAction from the live
// WSDL and build envelopes from those. A wrong namespace is what makes PHP
// SoapServer reply "Procedure 'X' not present" for every operation.
type WsdlOp = { name: string; soapAction: string | null };
let wsdlCache: { at: number; targetNamespace: string | null; ops: WsdlOp[] } | null = null;
const OPS_TTL_MS = 5 * 60 * 1000;

async function loadWsdl(force = false): Promise<NonNullable<typeof wsdlCache>> {
  if (!force && wsdlCache && Date.now() - wsdlCache.at < OPS_TTL_MS) return wsdlCache;
  const res = await fetchWithTimeout(WSDL_URL, { method: 'GET' });
  if (!res.ok) throw new Error(`Impossible de charger le WSDL (HTTP ${res.status}).`);
  const xml = await res.text();

  const tns = xml.match(/<(?:[\w.-]+:)?definitions\b[^>]*\btargetNamespace="([^"]+)"/i);
  const targetNamespace = tns ? tns[1] : null;

  const ops = new Map<string, WsdlOp>();
  // Block-form <operation name="X"> … <soap:operation soapAction="Y"/> … </operation>
  const blockRe = /<(?:[\w.-]+:)?operation\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?operation>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml)) !== null) {
    const name = m[1].match(/\bname="([^"]+)"/i)?.[1];
    if (!name) continue;
    const action = m[2].match(/soapAction="([^"]*)"/i)?.[1] ?? null;
    const prev = ops.get(name.toLowerCase());
    ops.set(name.toLowerCase(), { name, soapAction: action ?? prev?.soapAction ?? null });
  }
  // Self-closing <operation name="X"/> (portType in some WSDLs)
  const selfRe = /<(?:[\w.-]+:)?operation\b([^>]*)\/>/gi;
  while ((m = selfRe.exec(xml)) !== null) {
    const name = m[1].match(/\bname="([^"]+)"/i)?.[1];
    if (name && !ops.has(name.toLowerCase())) ops.set(name.toLowerCase(), { name, soapAction: null });
  }

  wsdlCache = { at: Date.now(), targetNamespace, ops: [...ops.values()] };
  return wsdlCache;
}

/** Returns the operation names + namespace exposed by the live WSDL (cached 5 min). */
export async function describe(force = false): Promise<{ wsdlUrl: string; targetNamespace: string | null; operations: string[] }> {
  const w = await loadWsdl(force);
  return { wsdlUrl: WSDL_URL, targetNamespace: w.targetNamespace, operations: w.ops.map((o) => o.name) };
}

/** Safe diagnostics for the admin debug panel — never exposes the password. */
export async function getDiagnostics(): Promise<{
  wsdlUrl: string; login: string | null; configured: boolean; ok: boolean;
  targetNamespace: string | null; operations: string[];
  hasGetOrder: boolean; hasGetRecette: boolean; error?: string;
}> {
  const base = { wsdlUrl: WSDL_URL, login: LOGIN || null, configured: isConfigured() };
  try {
    const { operations, targetNamespace } = await describe(true);
    const has = (n: string) => operations.some((o) => o.toLowerCase() === n.toLowerCase());
    return { ...base, ok: true, targetNamespace, operations, hasGetOrder: has('GetOrder'), hasGetRecette: has('GetRecette') };
  } catch (e) {
    return { ...base, ok: false, targetNamespace: null, operations: [], hasGetOrder: false, hasGetRecette: false, error: e instanceof Error ? e.message : 'Erreur WSDL' };
  }
}

/** Case-insensitive check that an operation exists in the WSDL. */
export async function operationExists(name: string): Promise<boolean> {
  try {
    const { operations } = await describe();
    return operations.some((o) => o.toLowerCase() === name.toLowerCase());
  } catch {
    return false; // if the WSDL can't be read, treat as unavailable
  }
}

// ── Status code mapping (per Best Delivery docs) ───────────────────────────────
export const BEST_DELIVERY_STATUS: Record<string, string> = {
  '0': 'En attente', '1': 'En cours', '2': 'Livrée', '3': 'Échange livré au client',
  '4': 'Échange', '5': 'Retour Expéditeur', '6': 'Supprimée', '7': 'Retour Client Agence',
  '8': 'Au dépôt', '9': 'Inter Dépôt', '10': 'Chez client finale', '11': 'Retour Dépôt',
  '15': 'Non reçu', '20': 'Retour Exp sac', '30': 'Retour reçu', '31': 'Retour définitif',
  '32': 'Reçu payé', '40': 'Delete Depot', '41': 'Delete En cours',
  '45': 'Retour Échange livré au client', '46': 'Retour Échange Refusée par client',
};

export function statusLabel(code: string | null | undefined): string | null {
  if (code === null || code === undefined || code === '') return null;
  return BEST_DELIVERY_STATUS[String(code).trim()] ?? null;
}

/** Thrown when an operation is documented but not present on the live WSDL. */
export class OperationNotAvailableError extends Error {
  constructor(op: string) {
    super(`L'opération « ${op} » est documentée mais non exposée par le WSDL actuel. Contactez Best Delivery ou utilisez leur endpoint proxy.`);
    this.name = 'OperationNotAvailableError';
  }
}

// ── Tunisia governorates (validation) ────────────────────────────────────────
export const TUNISIA_GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
  'Kairouan', 'Kasserine', 'Kébili', 'La Manouba', 'Le Kef', 'Mahdia',
  'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
  'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
] as const;

const GOV_NORMALIZED = new Map(
  TUNISIA_GOVERNORATES.map((g) => [normalizeGov(g), g]),
);
function normalizeGov(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── DTOs ─────────────────────────────────────────────────────────────────────
export type CreatePickupInput = {
  nom: string;
  gouvernerat: string;
  ville: string;
  adresse: string;
  tel: string;
  tel2?: string;
  designation: string;
  prix: number;
  msg?: string;
  echange: 0 | 1;
};

export type CreatePickupResult = {
  hasErrors: boolean;
  errorsTxt: string | null;
  codeBarre: string | null; // tracking number
  url: string | null;       // printable label URL
  raw: Record<string, unknown>;
};

export type TrackStatusResult = {
  hasErrors: boolean;
  errorsTxt: string | null;
  trackingNumber: string | null;
  statusCode: string | null;
  statusMessage: string | null;
  statusLabel: string | null;  // mapped from the documented status table
  raw: Record<string, unknown>;
};

export type TrackEvent = {
  date: string | null;
  statusCode: string | null;
  statusMessage: string | null;
  statusLabel: string | null;
};

export type TrackHistoryResult = {
  hasErrors: boolean;
  errorsTxt: string | null;
  events: TrackEvent[];
  raw: Record<string, unknown>;
};

export type Paginated<T> = {
  hasErrors: boolean;
  errorsTxt: string | null;
  totalPages: number;
  currentPage: number;
  items: T[];
  raw: Record<string, unknown>;
};

export type ValidationError = { field: string; message: string };

// ── Validation ────────────────────────────────────────────────────────────────
export function validatePickup(input: Partial<CreatePickupInput>): { ok: boolean; errors: ValidationError[]; gouvernerat?: string } {
  const errors: ValidationError[] = [];

  if (!input.nom?.trim()) errors.push({ field: 'nom', message: 'Le nom est obligatoire.' });
  if (!input.ville?.trim()) errors.push({ field: 'ville', message: 'La ville est obligatoire.' });
  if (!input.adresse?.trim()) errors.push({ field: 'adresse', message: "L'adresse est obligatoire." });
  if (!input.designation?.trim()) errors.push({ field: 'designation', message: 'La désignation est obligatoire.' });

  // Phone: Tunisian 8-digit number, optionally prefixed with +216 / 216 / 00216
  const tel = String(input.tel ?? '').replace(/[\s.\-]/g, '');
  if (!/^(?:\+?216|00216)?\d{8}$/.test(tel)) {
    errors.push({ field: 'tel', message: 'Numéro de téléphone invalide (8 chiffres attendus).' });
  }
  if (input.tel2) {
    const tel2 = String(input.tel2).replace(/[\s.\-]/g, '');
    if (!/^(?:\+?216|00216)?\d{8}$/.test(tel2)) {
      errors.push({ field: 'tel2', message: 'Deuxième numéro invalide.' });
    }
  }

  // Governorate must be a recognised Tunisian governorate
  const govKey = normalizeGov(String(input.gouvernerat ?? ''));
  const canonicalGov = GOV_NORMALIZED.get(govKey);
  if (!canonicalGov) {
    errors.push({ field: 'gouvernerat', message: 'Gouvernorat invalide. Doit être un gouvernorat tunisien.' });
  }

  // Price numeric
  if (input.prix === undefined || input.prix === null || Number.isNaN(Number(input.prix))) {
    errors.push({ field: 'prix', message: 'Le prix doit être numérique.' });
  }

  // echange 0 or 1
  if (input.echange !== 0 && input.echange !== 1) {
    errors.push({ field: 'echange', message: "Échange doit valoir 0 ou 1." });
  }

  return { ok: errors.length === 0, errors, gouvernerat: canonicalGov };
}

// ── XML helpers ────────────────────────────────────────────────────────────────
function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
/** First inner value of <tag> (any namespace prefix). */
function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w.-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, 'i'));
  return m ? decodeXml(m[1].trim()) : null;
}
/** All inner blocks for a repeated <tag>. */
function pickAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
function pickNumber(xml: string, tag: string, fallback = 0): number {
  const v = pick(xml, tag);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function hasErrorsOf(xml: string): { hasErrors: boolean; errorsTxt: string | null } {
  const he = pick(xml, 'HasErrors');
  return { hasErrors: he === '1' || he?.toLowerCase() === 'true', errorsTxt: pick(xml, 'ErrorsTxt') };
}

// ── SOAP core ──────────────────────────────────────────────────────────────────
function buildEnvelope(operation: string, fields: Record<string, unknown>, namespace: string): string {
  // Keep '' and 0 — the service's WSDL messages expect every declared element
  // to be present (the official tester sends them all). Only skip undefined/null.
  const body = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${namespace}">` +
    `<soapenv:Body><tns:${operation}>${body}</tns:${operation}></soapenv:Body></soapenv:Envelope>`;
}

/** Redact credentials before logging. */
function redact(xml: string): string {
  return xml.replace(/(<(?:pwd|password)>)[\s\S]*?(<\/(?:pwd|password)>)/gi, '$1***$2');
}

async function callSoap(operation: string, fields: Record<string, unknown>): Promise<string> {
  if (!isConfigured()) throw new Error('Best Delivery non configuré (BEST_DELIVERY_LOGIN/PASSWORD/WSDL_URL).');

  // Self-configure from the live WSDL: real operation name, namespace + soapAction.
  // This is what fixes "Procedure 'X' not present" (caused by a namespace mismatch).
  let opName = operation;
  let namespace = NAMESPACE;
  let soapAction: string | null = null;
  try {
    const w = await loadWsdl();
    if (w.targetNamespace) namespace = w.targetNamespace;
    const op = w.ops.find((o) => o.name.toLowerCase() === operation.toLowerCase());
    if (!op) throw new OperationNotAvailableError(operation);
    opName = op.name;
    soapAction = op.soapAction;
  } catch (e) {
    if (e instanceof OperationNotAvailableError) throw e;
    console.warn('[best-delivery] WSDL introspection failed, using fallback namespace:', e instanceof Error ? e.message : e);
  }

  const envelope = buildEnvelope(opName, fields, namespace);
  const url = endpoint();
  console.info(`[best-delivery] → ${opName} (ns=${namespace})`, redact(envelope));

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: soapAction ?? `${namespace}/${opName}`,
    },
    body: envelope,
  });

  const text = await res.text();
  console.info(`[best-delivery] ← ${opName} (${res.status})`, text.slice(0, 4000));

  if (!res.ok) {
    const fault = pick(text, 'faultstring') ?? `HTTP ${res.status}`;
    throw new Error(`Best Delivery SOAP error: ${fault}`);
  }
  const fault = pick(text, 'faultstring');
  if (fault) throw new Error(`Best Delivery SOAP fault: ${fault}`);
  return text;
}

// ── Operations ──────────────────────────────────────────────────────────────────

/** CreatePickup — create a delivery parcel. Returns CodeBarre (tracking) + Url (label). */
export async function createPickup(input: CreatePickupInput): Promise<CreatePickupResult> {
  const { ok, errors, gouvernerat } = validatePickup(input);
  if (!ok) {
    return {
      hasErrors: true,
      errorsTxt: errors.map((e) => e.message).join(' '),
      codeBarre: null, url: null, raw: { validation: errors },
    };
  }

  // Full parameter set in the exact order the official tester sends — the WSDL
  // message declares all of these; the unused ones default to 0.
  const xml = await callSoap('CreatePickup', {
    nom: input.nom,
    gouvernerat: gouvernerat,
    ville: input.ville,
    adresse: input.adresse,
    tel: input.tel,
    tel2: input.tel2 ?? '',
    designation: input.designation,
    prix: Number(input.prix),
    msg: input.msg ?? '',
    echange: input.echange,
    login: LOGIN,
    pwd: PASSWORD,
    tracking_number: 0,
    agence: 0,
    agence_dst: 0,
    date_add: 0,
    date_pick: 0,
    date_stat: 0,
    nb_article: 0,
    unlink: 0,
    modif: 0,
    id_runsheet: 0,
    recu: 0,
    id_recette: 0,
    transmit: 0,
    etat: 0,
    id_frs: 0,
    frs: 0,
    paye: 0,
    code_barre: 0,
  });

  const { hasErrors, errorsTxt } = hasErrorsOf(xml);
  return {
    hasErrors,
    errorsTxt,
    codeBarre: pick(xml, 'CodeBarre') ?? pick(xml, 'codeBarre') ?? pick(xml, 'tracking'),
    url: pick(xml, 'Url') ?? pick(xml, 'url'),
    raw: { codeBarre: pick(xml, 'CodeBarre'), url: pick(xml, 'Url'), hasErrors, errorsTxt },
  };
}

/** TrackShipmentStatus — current status code + message for a tracking number. */
export async function trackShipmentStatus(trackingNumber: string): Promise<TrackStatusResult> {
  const xml = await callSoap('TrackShipmentStatus', { tracking_number: trackingNumber, login: LOGIN, pwd: PASSWORD });
  const { hasErrors, errorsTxt } = hasErrorsOf(xml);
  const statusCode = pick(xml, 'status') ?? pick(xml, 'status_code') ?? pick(xml, 'StatusCode') ?? pick(xml, 'code');
  return {
    hasErrors,
    errorsTxt,
    trackingNumber: pick(xml, 'tracking_number') ?? trackingNumber,
    statusCode,
    statusMessage: pick(xml, 'message') ?? pick(xml, 'status_message') ?? pick(xml, 'StatusMessage'),
    statusLabel: statusLabel(statusCode),
    raw: { hasErrors, errorsTxt },
  };
}

/** TrackShipment — full status history for a tracking number. */
export async function trackShipment(trackingNumber: string): Promise<TrackHistoryResult> {
  const xml = await callSoap('TrackShipment', { tracking_number: trackingNumber, login: LOGIN, pwd: PASSWORD });
  const { hasErrors, errorsTxt } = hasErrorsOf(xml);
  // History entries may be wrapped as <item>, <Shipment>, <history>, or <status>.
  const blocks =
    [...pickAll(xml, 'item'), ...pickAll(xml, 'history'), ...pickAll(xml, 'status'), ...pickAll(xml, 'Shipment')];
  const events: TrackEvent[] = blocks.map((b) => {
    const code = pick(b, 'status') ?? pick(b, 'status_code') ?? pick(b, 'code') ?? pick(b, 'StatusCode');
    return {
      date: pick(b, 'date') ?? pick(b, 'Date') ?? pick(b, 'datetime'),
      statusCode: code,
      statusMessage: pick(b, 'message') ?? pick(b, 'status_message') ?? pick(b, 'StatusMessage') ?? pick(b, 'libelle'),
      statusLabel: statusLabel(code),
    };
  }).filter((e) => e.date || e.statusCode || e.statusMessage);

  return { hasErrors, errorsTxt, events, raw: { count: events.length, hasErrors, errorsTxt } };
}

/** GetOrder — paginated list of Best Delivery orders (guarded: documented but often not exposed). */
export async function getOrder(page = 1, ofset = 20): Promise<Paginated<Record<string, string | null>>> {
  if (!(await operationExists('GetOrder'))) {
    return { hasErrors: true, errorsTxt: new OperationNotAvailableError('GetOrder').message, totalPages: 1, currentPage: page, items: [], raw: { unavailable: true } };
  }
  const xml = await callSoap('GetOrder', { page, ofset, login: LOGIN, pwd: PASSWORD });
  const { hasErrors, errorsTxt } = hasErrorsOf(xml);
  const blocks = [...pickAll(xml, 'item'), ...pickAll(xml, 'order'), ...pickAll(xml, 'message')];
  const items = blocks.map(parseFlatBlock).filter((o) => Object.keys(o).length > 0);
  return {
    hasErrors, errorsTxt,
    totalPages: pickNumber(xml, 'total_pages', 1),
    currentPage: pickNumber(xml, 'current_page', page),
    items,
    raw: { count: items.length },
  };
}

/** GetRecette — paginated list of Best Delivery recettes (guarded: documented but often not exposed). */
export async function getRecette(page = 1, ofset = 20): Promise<Paginated<Record<string, string | null>>> {
  if (!(await operationExists('GetRecette'))) {
    return { hasErrors: true, errorsTxt: new OperationNotAvailableError('GetRecette').message, totalPages: 1, currentPage: page, items: [], raw: { unavailable: true } };
  }
  const xml = await callSoap('GetRecette', { page, ofset, login: LOGIN, pwd: PASSWORD });
  const { hasErrors, errorsTxt } = hasErrorsOf(xml);
  const blocks = [...pickAll(xml, 'item'), ...pickAll(xml, 'recette'), ...pickAll(xml, 'message')];
  const items = blocks.map(parseFlatBlock).filter((o) => Object.keys(o).length > 0);
  return {
    hasErrors, errorsTxt,
    totalPages: pickNumber(xml, 'total_pages', 1),
    currentPage: pickNumber(xml, 'current_page', page),
    items,
    raw: { count: items.length },
  };
}

/** Turn a flat XML block into a key/value record (one level deep). */
function parseFlatBlock(block: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const re = /<(?:[\w.-]+:)?([\w.-]+)[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const key = m[1];
    const val = decodeXml(m[2].trim());
    if (!/[<>]/.test(val)) out[key] = val; // skip nested containers
  }
  return out;
}
