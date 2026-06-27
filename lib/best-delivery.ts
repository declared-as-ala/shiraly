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
  statusCode: string | null;
  statusMessage: string | null;
  raw: Record<string, unknown>;
};

export type TrackEvent = {
  date: string | null;
  statusCode: string | null;
  statusMessage: string | null;
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
function buildEnvelope(operation: string, fields: Record<string, unknown>): string {
  const body = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${NAMESPACE}">` +
    `<soapenv:Body><tns:${operation}>${body}</tns:${operation}></soapenv:Body></soapenv:Envelope>`;
}

/** Redact credentials before logging. */
function redact(xml: string): string {
  return xml.replace(/(<(?:pwd|password)>)[\s\S]*?(<\/(?:pwd|password)>)/gi, '$1***$2');
}

async function callSoap(operation: string, fields: Record<string, unknown>): Promise<string> {
  if (!isConfigured()) throw new Error('Best Delivery non configuré (BEST_DELIVERY_LOGIN/PASSWORD/WSDL_URL).');
  const envelope = buildEnvelope(operation, fields);
  const url = endpoint();
  console.info(`[best-delivery] → ${operation}`, redact(envelope));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `${NAMESPACE}/${operation}`,
    },
    body: envelope,
    // SOAP endpoints are not cacheable
    cache: 'no-store',
  });

  const text = await res.text();
  console.info(`[best-delivery] ← ${operation} (${res.status})`, text.slice(0, 4000));

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
  return {
    hasErrors,
    errorsTxt,
    statusCode: pick(xml, 'status_code') ?? pick(xml, 'StatusCode') ?? pick(xml, 'code'),
    statusMessage: pick(xml, 'status_message') ?? pick(xml, 'StatusMessage') ?? pick(xml, 'message'),
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
  const events: TrackEvent[] = blocks.map((b) => ({
    date: pick(b, 'date') ?? pick(b, 'Date') ?? pick(b, 'datetime'),
    statusCode: pick(b, 'status_code') ?? pick(b, 'code') ?? pick(b, 'StatusCode'),
    statusMessage: pick(b, 'status_message') ?? pick(b, 'message') ?? pick(b, 'StatusMessage') ?? pick(b, 'libelle'),
  })).filter((e) => e.date || e.statusCode || e.statusMessage);

  return { hasErrors, errorsTxt, events, raw: { count: events.length, hasErrors, errorsTxt } };
}

/** GetOrder — paginated list of Best Delivery orders. */
export async function getOrder(page = 1, ofset = 20): Promise<Paginated<Record<string, string | null>>> {
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

/** GetRecette — paginated list of Best Delivery recettes (payments). */
export async function getRecette(page = 1, ofset = 20): Promise<Paginated<Record<string, string | null>>> {
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
