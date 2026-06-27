import 'server-only';

/**
 * Best Delivery integration — backend only.
 *
 * The Best Delivery SOAP server dispatches by un-namespaced procedure elements
 * whose names differ from the documented method names (e.g. CreatePickup → the
 * SOAP element <pickup>). Their official integration uses a JSON proxy that maps
 * each documented method to the correct SOAP request and returns clean JSON:
 *
 *   POST { method, params: {...login,pwd...}, soap_url }
 *   → { success, data, request_xml, response_xml }
 *
 * We call that proxy directly — it handles every method's mapping for us.
 *
 * Docs: https://doc.best-delivery.net/
 */

// ── Config ──────────────────────────────────────────────────────────────────
const WSDL_URL = process.env.BEST_DELIVERY_WSDL_URL ?? 'https://api.best-delivery.net/serviceShipments.php?wsdl';
const PROXY_URL = process.env.BEST_DELIVERY_PROXY_URL ?? 'https://doc.best-delivery.net/soap-proxy.php';
const LOGIN = process.env.BEST_DELIVERY_LOGIN ?? '';
const PASSWORD = process.env.BEST_DELIVERY_PASSWORD ?? '';
const TIMEOUT_MS = Number(process.env.BEST_DELIVERY_TIMEOUT_MS) || 20000;

export function isConfigured(): boolean {
  return Boolean(LOGIN && PASSWORD && PROXY_URL && WSDL_URL);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

// ── Tunisia governorates (validation) ────────────────────────────────────────
export const TUNISIA_GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
  'Kairouan', 'Kasserine', 'Kébili', 'La Manouba', 'Le Kef', 'Mahdia',
  'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
  'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
] as const;

const GOV_NORMALIZED = new Map(TUNISIA_GOVERNORATES.map((g) => [normalizeGov(g), g]));
function normalizeGov(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
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

// ── DTOs ─────────────────────────────────────────────────────────────────────
export type CreatePickupInput = {
  nom: string; gouvernerat: string; ville: string; adresse: string;
  tel: string; tel2?: string; designation: string; prix: number; msg?: string; echange: 0 | 1;
};
export type CreatePickupResult = { hasErrors: boolean; errorsTxt: string | null; codeBarre: string | null; url: string | null; raw: unknown };
export type TrackStatusResult = { hasErrors: boolean; errorsTxt: string | null; trackingNumber: string | null; statusCode: string | null; statusMessage: string | null; statusLabel: string | null; raw: unknown };
export type TrackEvent = { date: string | null; statusCode: string | null; statusMessage: string | null; statusLabel: string | null };
export type TrackHistoryResult = { hasErrors: boolean; errorsTxt: string | null; events: TrackEvent[]; raw: unknown };
export type Paginated<T> = { hasErrors: boolean; errorsTxt: string | null; totalPages: number; currentPage: number; items: T[]; raw: unknown };
export type ValidationError = { field: string; message: string };

// ── Validation ────────────────────────────────────────────────────────────────
export function validatePickup(input: Partial<CreatePickupInput>): { ok: boolean; errors: ValidationError[]; gouvernerat?: string } {
  const errors: ValidationError[] = [];
  if (!input.nom?.trim()) errors.push({ field: 'nom', message: 'Le nom est obligatoire.' });
  if (!input.ville?.trim()) errors.push({ field: 'ville', message: 'La ville est obligatoire.' });
  if (!input.adresse?.trim()) errors.push({ field: 'adresse', message: "L'adresse est obligatoire." });
  if (!input.designation?.trim()) errors.push({ field: 'designation', message: 'La désignation est obligatoire.' });

  const tel = String(input.tel ?? '').replace(/[\s.\-]/g, '');
  if (!/^(?:\+?216|00216)?\d{8}$/.test(tel)) errors.push({ field: 'tel', message: 'Numéro de téléphone invalide (8 chiffres attendus).' });
  if (input.tel2) {
    const tel2 = String(input.tel2).replace(/[\s.\-]/g, '');
    if (!/^(?:\+?216|00216)?\d{8}$/.test(tel2)) errors.push({ field: 'tel2', message: 'Deuxième numéro invalide.' });
  }

  const canonicalGov = GOV_NORMALIZED.get(normalizeGov(String(input.gouvernerat ?? '')));
  if (!canonicalGov) errors.push({ field: 'gouvernerat', message: 'Gouvernorat invalide. Doit être un gouvernorat tunisien.' });

  if (input.prix === undefined || input.prix === null || Number.isNaN(Number(input.prix))) errors.push({ field: 'prix', message: 'Le prix doit être numérique.' });
  if (input.echange !== 0 && input.echange !== 1) errors.push({ field: 'echange', message: 'Échange doit valoir 0 ou 1.' });

  return { ok: errors.length === 0, errors, gouvernerat: canonicalGov };
}

// ── Response helpers (operate on the proxy's JSON `data`) ───────────────────────
function deepFind(obj: unknown, key: string): string | null {
  const target = key.toLowerCase();
  const stack: unknown[] = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (cur && typeof cur === 'object') {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (k.toLowerCase() === target && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) return String(v);
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }
  return null;
}
function deepFindArray(obj: unknown, keys: string[]): Record<string, unknown>[] {
  const targets = keys.map((k) => k.toLowerCase());
  const s1: unknown[] = [obj];
  while (s1.length) {
    const cur = s1.pop();
    if (cur && typeof cur === 'object') {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (targets.includes(k.toLowerCase())) {
          if (Array.isArray(v)) return v as Record<string, unknown>[];
          if (v && typeof v === 'object') return [v as Record<string, unknown>];
        }
        if (v && typeof v === 'object') s1.push(v);
      }
    }
  }
  const s2: unknown[] = [obj];
  while (s2.length) {
    const cur = s2.pop();
    if (cur && typeof cur === 'object') {
      for (const v of Object.values(cur as Record<string, unknown>)) {
        if (Array.isArray(v) && v.some((x) => x && typeof x === 'object')) return v as Record<string, unknown>[];
        if (v && typeof v === 'object') s2.push(v);
      }
    }
  }
  return [];
}
function flatten(obj: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) out[k] = null;
    else if (typeof v !== 'object') out[k] = String(v);
  }
  return out;
}
function hasErrorsOf(data: unknown): { hasErrors: boolean; errorsTxt: string | null } {
  const he = deepFind(data, 'HasErrors');
  return { hasErrors: he === '1' || he?.toLowerCase?.() === 'true', errorsTxt: deepFind(data, 'ErrorsTxt') };
}

// ── Proxy invocation ───────────────────────────────────────────────────────────
type ProxyResponse = { success?: boolean; data?: unknown; error?: string; request_xml?: string; response_xml?: string };

async function callProxy(method: string, params: Record<string, unknown>): Promise<ProxyResponse> {
  if (!isConfigured()) throw new Error('Best Delivery non configuré (BEST_DELIVERY_LOGIN/PASSWORD).');
  const payload = { method, params: { ...params, login: LOGIN, pwd: PASSWORD }, soap_url: WSDL_URL };
  console.info(`[best-delivery] → ${method}`, { ...params, login: LOGIN, pwd: '***' });

  const res = await fetchWithTimeout(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => ({}))) as ProxyResponse;
  console.info(`[best-delivery] ← ${method} (${res.status})`, JSON.stringify(json.data ?? json.error)?.slice(0, 3000));

  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Best Delivery proxy error (HTTP ${res.status})`);
  }
  // The proxy can return HTTP 200 + success:true while `data` is actually a
  // SOAP-ERROR / fault string — treat that as a real failure.
  if (typeof json.data === 'string' && /soap-?error|fault|error/i.test(json.data)) {
    throw new Error(json.data);
  }
  return json;
}

// ── Operations ──────────────────────────────────────────────────────────────────

/** CreatePickup — create a delivery parcel. Returns CodeBarre (tracking) + Url (label). */
export async function createPickup(input: CreatePickupInput): Promise<CreatePickupResult> {
  const { ok, errors, gouvernerat } = validatePickup(input);
  if (!ok) {
    return { hasErrors: true, errorsTxt: errors.map((e) => e.message).join(' '), codeBarre: null, url: null, raw: { validation: errors } };
  }

  // The proxy's SOAP encoder requires every field of the `pickup` struct to be
  // present (matches the official tester's request). Unused fields default to 0.
  const { data } = await callProxy('CreatePickup', {
    code_barre: 0,
    frs: 0,
    id_frs: 0,
    agence: 0,
    date_add: 0,
    date_pick: 0,
    prix: Number(input.prix),
    nom: input.nom,
    gouvernerat,
    ville: input.ville,
    adresse: input.adresse,
    tel: input.tel,
    tel2: input.tel2 ?? '',
    designation: input.designation,
    nb_article: 0,
    msg: input.msg ?? '',
    etat: 0,
    paye: 0,
    date_stat: 0,
    agence_dest: 0,
    transmit: 0,
    recu: 0,
    id_recette: 0,
    unlink: 0,
    modif: 0,
    tracking_number: 0,
    id_runsheet: 0,
    echange: input.echange,
  });

  const { hasErrors, errorsTxt } = hasErrorsOf(data);
  return { hasErrors, errorsTxt, codeBarre: deepFind(data, 'CodeBarre'), url: deepFind(data, 'Url'), raw: data };
}

/** TrackShipmentStatus — current status code + message for a tracking number. */
export async function trackShipmentStatus(trackingNumber: string): Promise<TrackStatusResult> {
  const { data } = await callProxy('TrackShipmentStatus', { tracking_number: trackingNumber });
  const { hasErrors, errorsTxt } = hasErrorsOf(data);
  const statusCode = deepFind(data, 'status');
  return {
    hasErrors, errorsTxt,
    trackingNumber: deepFind(data, 'tracking_number') ?? trackingNumber,
    statusCode,
    statusMessage: deepFind(data, 'message'),
    statusLabel: statusLabel(statusCode),
    raw: data,
  };
}

/** TrackShipment — full status history for a tracking number. */
export async function trackShipment(trackingNumber: string): Promise<TrackHistoryResult> {
  const { data } = await callProxy('TrackShipment', { tracking_number: trackingNumber });
  const { hasErrors, errorsTxt } = hasErrorsOf(data);
  const rows = deepFindArray(data, ['status', 'history', 'item']);
  const events: TrackEvent[] = rows.map((r) => {
    const code = deepFind(r, 'status') ?? deepFind(r, 'code') ?? deepFind(r, 'etat');
    return {
      date: deepFind(r, 'date') ?? deepFind(r, 'datetime'),
      statusCode: code,
      statusMessage: deepFind(r, 'message') ?? deepFind(r, 'libelle'),
      statusLabel: statusLabel(code),
    };
  }).filter((e) => e.date || e.statusCode || e.statusMessage);
  return { hasErrors, errorsTxt, events, raw: data };
}

/** GetOrder — paginated list of Best Delivery orders. */
export async function getOrder(page = 1, ofset = 20): Promise<Paginated<Record<string, string | null>>> {
  try {
    const { data } = await callProxy('GetOrder', { page, ofset });
    const { hasErrors, errorsTxt } = hasErrorsOf(data);
    return {
      hasErrors, errorsTxt,
      totalPages: Number(deepFind(data, 'total_pages')) || 1,
      currentPage: Number(deepFind(data, 'current_page')) || page,
      items: deepFindArray(data, ['message', 'orders', 'item']).map(flatten),
      raw: data,
    };
  } catch (e) {
    return { hasErrors: true, errorsTxt: e instanceof Error ? e.message : 'Erreur', totalPages: 1, currentPage: page, items: [], raw: null };
  }
}

/** GetRecette — paginated list of Best Delivery recettes (payments). */
export async function getRecette(page = 1, ofset = 20): Promise<Paginated<Record<string, string | null>>> {
  try {
    const { data } = await callProxy('GetRecette', { page, ofset });
    const { hasErrors, errorsTxt } = hasErrorsOf(data);
    return {
      hasErrors, errorsTxt,
      totalPages: Number(deepFind(data, 'total_pages')) || 1,
      currentPage: Number(deepFind(data, 'current_page')) || page,
      items: deepFindArray(data, ['message', 'recettes', 'item']).map(flatten),
      raw: data,
    };
  } catch (e) {
    return { hasErrors: true, errorsTxt: e instanceof Error ? e.message : 'Erreur', totalPages: 1, currentPage: page, items: [], raw: null };
  }
}

// ── Diagnostics (admin debug; never returns the password) ──────────────────────
function redactXml(xml: string | null | undefined): string | null {
  if (!xml) return null;
  let out = xml.replace(/(<(?:\w+:)?(?:pwd|password)>)[\s\S]*?(<\/(?:\w+:)?(?:pwd|password)>)/gi, '$1***$2');
  if (PASSWORD) out = out.split(PASSWORD).join('***');
  return out;
}

export async function getDiagnostics(): Promise<{
  proxyUrl: string; wsdlUrl: string; login: string | null; configured: boolean; ok: boolean;
  sampleRequest?: string | null; sampleResponse?: string | null; error?: string;
}> {
  const base = { proxyUrl: PROXY_URL, wsdlUrl: WSDL_URL, login: LOGIN || null, configured: isConfigured() };
  try {
    // Harmless probe (invalid tracking) to capture the proxy's request/response XML.
    const probe = await callProxy('TrackShipmentStatus', { tracking_number: '0' });
    return { ...base, ok: true, sampleRequest: redactXml(probe.request_xml), sampleResponse: redactXml(probe.response_xml) };
  } catch (e) {
    return { ...base, ok: false, error: e instanceof Error ? e.message : 'Erreur' };
  }
}
