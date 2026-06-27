import 'server-only';
import { createClientAsync } from 'soap';

/**
 * Best Delivery (best-delivery.net) SOAP integration — backend only.
 *
 * Uses the WSDL-driven `soap` client (same behaviour as Best Delivery's official
 * "tester with proxy"): it reads the WSDL and builds correct envelopes
 * automatically (namespace, parameter order, rpc/document style, encoding).
 *
 * Docs: https://doc.best-delivery.net/   WSDL: serviceShipments.php?wsdl
 */

// ── Config ──────────────────────────────────────────────────────────────────
const WSDL_URL = process.env.BEST_DELIVERY_WSDL_URL ?? 'https://api.best-delivery.net/serviceShipments.php?wsdl';
const LOGIN = process.env.BEST_DELIVERY_LOGIN ?? '';
const PASSWORD = process.env.BEST_DELIVERY_PASSWORD ?? '';
const TIMEOUT_MS = Number(process.env.BEST_DELIVERY_TIMEOUT_MS) || 20000;

export function isConfigured(): boolean {
  return Boolean(LOGIN && PASSWORD && WSDL_URL);
}

type SoapClient = Awaited<ReturnType<typeof createClientAsync>>;

let clientPromise: Promise<SoapClient> | null = null;

/** Lazily create and cache the SOAP client built from the live WSDL. */
async function getClient(): Promise<SoapClient> {
  if (!isConfigured()) throw new Error('Best Delivery non configuré (BEST_DELIVERY_LOGIN/PASSWORD/WSDL_URL).');
  if (!clientPromise) {
    clientPromise = createClientAsync(WSDL_URL, { wsdl_options: { timeout: TIMEOUT_MS } as Record<string, unknown> })
      .catch((e) => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS, label = 'Best Delivery'): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}: délai dépassé (${ms}ms)`)), ms)),
  ]);
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

export class OperationNotAvailableError extends Error {
  constructor(op: string) {
    super(`L'opération « ${op} » est documentée mais non exposée par le WSDL actuel. Contactez Best Delivery ou utilisez leur endpoint proxy.`);
    this.name = 'OperationNotAvailableError';
  }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────
export type CreatePickupInput = {
  nom: string; gouvernerat: string; ville: string; adresse: string;
  tel: string; tel2?: string; designation: string; prix: number; msg?: string; echange: 0 | 1;
};
export type CreatePickupResult = {
  hasErrors: boolean; errorsTxt: string | null;
  codeBarre: string | null; url: string | null; raw: unknown;
};
export type TrackStatusResult = {
  hasErrors: boolean; errorsTxt: string | null;
  trackingNumber: string | null; statusCode: string | null; statusMessage: string | null; statusLabel: string | null; raw: unknown;
};
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

// ── Response helpers — tolerant of SOAP output nesting (e.g. { return: {...} }) ──
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
  // 1) prefer an array whose property name matches
  const s1: unknown[] = [obj];
  while (s1.length) {
    const cur = s1.pop();
    if (cur && typeof cur === 'object') {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (targets.includes(k.toLowerCase())) {
          if (Array.isArray(v)) return v as Record<string, unknown>[];
          if (v && typeof v === 'object') return [v as Record<string, unknown>]; // single element not arrayified
        }
        if (v && typeof v === 'object') s1.push(v);
      }
    }
  }
  // 2) fallback: any array of objects
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
function hasErrorsOf(res: unknown): { hasErrors: boolean; errorsTxt: string | null } {
  const he = deepFind(res, 'HasErrors');
  return { hasErrors: he === '1' || he?.toLowerCase?.() === 'true', errorsTxt: deepFind(res, 'ErrorsTxt') };
}
function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  return { ...args, pwd: '***', password: args.password ? '***' : undefined };
}

// ── SOAP invocation ───────────────────────────────────────────────────────────
/** Find the promisified client method for an operation (case-insensitive). */
function resolveMethod(client: SoapClient, op: string): ((args: unknown) => Promise<unknown[]>) | null {
  const c = client as unknown as Record<string, unknown>;
  const wanted = `${op}async`.toLowerCase();
  for (const key of Object.keys(c)) {
    if (key.toLowerCase() === wanted && typeof c[key] === 'function') {
      return (c[key] as (args: unknown) => Promise<unknown[]>).bind(client);
    }
  }
  return null;
}

async function callSoap(op: string, args: Record<string, unknown>): Promise<unknown> {
  const client = await getClient();
  const method = resolveMethod(client, op);
  if (!method) throw new OperationNotAvailableError(op);

  console.info(`[best-delivery] → ${op}`, redactArgs(args));
  const [result] = await withTimeout(method(args), TIMEOUT_MS, op);
  console.info(`[best-delivery] ← ${op}`, JSON.stringify(result)?.slice(0, 4000));
  return result;
}

/** Whether an operation exists on the live WSDL. */
export async function operationExists(op: string): Promise<boolean> {
  try {
    const client = await getClient();
    return resolveMethod(client, op) !== null;
  } catch {
    return false;
  }
}

// ── Diagnostics (admin debug; never returns the password) ──────────────────────
export async function describe(): Promise<{ wsdlUrl: string; targetNamespace: string | null; operations: string[] }> {
  const client = await getClient();
  const desc = client.describe() as Record<string, unknown>;
  const ops = new Set<string>();
  for (const service of Object.values(desc)) {
    for (const port of Object.values(service as Record<string, unknown>)) {
      for (const opName of Object.keys(port as Record<string, unknown>)) ops.add(opName);
    }
  }
  const tns = (client as unknown as { wsdl?: { definitions?: { $targetNamespace?: string } } })?.wsdl?.definitions?.$targetNamespace ?? null;
  return { wsdlUrl: WSDL_URL, targetNamespace: tns, operations: [...ops] };
}

export async function getDiagnostics(): Promise<{
  wsdlUrl: string; login: string | null; configured: boolean; ok: boolean;
  targetNamespace: string | null; operations: string[]; hasGetOrder: boolean; hasGetRecette: boolean; error?: string;
}> {
  const base = { wsdlUrl: WSDL_URL, login: LOGIN || null, configured: isConfigured() };
  try {
    const { operations, targetNamespace } = await describe();
    const has = (n: string) => operations.some((o) => o.toLowerCase() === n.toLowerCase());
    return { ...base, ok: true, targetNamespace, operations, hasGetOrder: has('GetOrder'), hasGetRecette: has('GetRecette') };
  } catch (e) {
    return { ...base, ok: false, targetNamespace: null, operations: [], hasGetOrder: false, hasGetRecette: false, error: e instanceof Error ? e.message : 'Erreur WSDL' };
  }
}

// ── Operations ──────────────────────────────────────────────────────────────────

/** CreatePickup — create a delivery parcel. Returns CodeBarre (tracking) + Url (label). */
export async function createPickup(input: CreatePickupInput): Promise<CreatePickupResult> {
  const { ok, errors, gouvernerat } = validatePickup(input);
  if (!ok) {
    return { hasErrors: true, errorsTxt: errors.map((e) => e.message).join(' '), codeBarre: null, url: null, raw: { validation: errors } };
  }

  const res = await callSoap('CreatePickup', {
    login: LOGIN, pwd: PASSWORD,
    nom: input.nom, gouvernerat, ville: input.ville, adresse: input.adresse,
    tel: input.tel, tel2: input.tel2 ?? '', designation: input.designation,
    prix: Number(input.prix), msg: input.msg ?? '', echange: input.echange,
  });

  const { hasErrors, errorsTxt } = hasErrorsOf(res);
  return {
    hasErrors, errorsTxt,
    codeBarre: deepFind(res, 'CodeBarre'),
    url: deepFind(res, 'Url'),
    raw: res,
  };
}

/** TrackShipmentStatus — current status code + message for a tracking number. */
export async function trackShipmentStatus(trackingNumber: string): Promise<TrackStatusResult> {
  const res = await callSoap('TrackShipmentStatus', { login: LOGIN, pwd: PASSWORD, tracking_number: trackingNumber });
  const { hasErrors, errorsTxt } = hasErrorsOf(res);
  const statusCode = deepFind(res, 'status');
  return {
    hasErrors, errorsTxt,
    trackingNumber: deepFind(res, 'tracking_number') ?? trackingNumber,
    statusCode,
    statusMessage: deepFind(res, 'message'),
    statusLabel: statusLabel(statusCode),
    raw: res,
  };
}

/** TrackShipment — full status history for a tracking number. */
export async function trackShipment(trackingNumber: string): Promise<TrackHistoryResult> {
  const res = await callSoap('TrackShipment', { login: LOGIN, pwd: PASSWORD, tracking_number: trackingNumber });
  const { hasErrors, errorsTxt } = hasErrorsOf(res);
  const rows = deepFindArray(res, ['status', 'history', 'item']);
  const events: TrackEvent[] = rows.map((r) => {
    const code = (deepFind(r, 'status') ?? deepFind(r, 'code') ?? deepFind(r, 'etat'));
    return {
      date: deepFind(r, 'date') ?? deepFind(r, 'datetime'),
      statusCode: code,
      statusMessage: deepFind(r, 'message') ?? deepFind(r, 'libelle'),
      statusLabel: statusLabel(code),
    };
  }).filter((e) => e.date || e.statusCode || e.statusMessage);
  return { hasErrors, errorsTxt, events, raw: res };
}

/** GetOrder — paginated list of Best Delivery orders (guarded: documented but often not exposed). */
export async function getOrder(page = 1, ofset = 20): Promise<Paginated<Record<string, string | null>>> {
  if (!(await operationExists('GetOrder'))) {
    return { hasErrors: true, errorsTxt: new OperationNotAvailableError('GetOrder').message, totalPages: 1, currentPage: page, items: [], raw: { unavailable: true } };
  }
  const res = await callSoap('GetOrder', { login: LOGIN, pwd: PASSWORD, page, ofset });
  const { hasErrors, errorsTxt } = hasErrorsOf(res);
  return {
    hasErrors, errorsTxt,
    totalPages: Number(deepFind(res, 'total_pages')) || 1,
    currentPage: Number(deepFind(res, 'current_page')) || page,
    items: deepFindArray(res, ['message', 'orders', 'item']).map(flatten),
    raw: res,
  };
}

/** GetRecette — paginated list of Best Delivery recettes (guarded: documented but often not exposed). */
export async function getRecette(page = 1, ofset = 20): Promise<Paginated<Record<string, string | null>>> {
  if (!(await operationExists('GetRecette'))) {
    return { hasErrors: true, errorsTxt: new OperationNotAvailableError('GetRecette').message, totalPages: 1, currentPage: page, items: [], raw: { unavailable: true } };
  }
  const res = await callSoap('GetRecette', { login: LOGIN, pwd: PASSWORD, page, ofset });
  const { hasErrors, errorsTxt } = hasErrorsOf(res);
  return {
    hasErrors, errorsTxt,
    totalPages: Number(deepFind(res, 'total_pages')) || 1,
    currentPage: Number(deepFind(res, 'current_page')) || page,
    items: deepFindArray(res, ['message', 'recettes', 'item']).map(flatten),
    raw: res,
  };
}
