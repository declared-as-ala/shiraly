/**
 * Navex API client. Tokens are embedded in the endpoint path by Navex and must
 * only ever be read on the server.
 */
import 'server-only';

const API_BASE = (process.env.NAVEX_API_BASE ?? 'https://app.navex.tn').replace(/\/+$/, '');
const ADD_TOKEN = process.env.NAVEX_TOKEN_ADD ?? '';
const GET_TOKEN = process.env.NAVEX_TOKEN_GET ?? '';
const MULTIPLE_TOKEN = process.env.NAVEX_TOKEN_GET_MULTIPLE ?? GET_TOKEN;
const DELETE_TOKEN = process.env.NAVEX_TOKEN_DELETE ?? '';
const PENDING_TOKEN = process.env.NAVEX_TOKEN_PENDING ?? GET_TOKEN;
const TIMEOUT_MS = Number(process.env.NAVEX_TIMEOUT_MS) || 20_000;

export const navexConfigured = Boolean(ADD_TOKEN && GET_TOKEN && DELETE_TOKEN);

export type NavexShipmentInput = {
  reference?: string;
  receiverName: string;
  receiverPhone: string;
  receiverPhone2?: string;
  receiverGov: string;
  receiverCity?: string;
  receiverAddress: string;
  codAmount: number;
  itemsCount: number;
  productLabel: string;
  note?: string;
  exchange?: boolean;
};

export type NavexResult = {
  ok: boolean;
  barcode?: string;
  labelUrl?: string;
  raw: unknown;
  error?: string;
};

type NavexLineLike = {
  name: string;
  quantity?: number;
  qty?: number;
  attributes?: { key: string; value: string }[];
  variation?: Record<string, string>;
};

const GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
  'Kairouan', 'Kasserine', 'Kébili', 'La Manouba', 'Le Kef', 'Mahdia',
  'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
  'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
];

function plain(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function normalizeNavexGovernorate(input: string): string | null {
  const normalized = plain(input);
  if (!normalized) return null;
  const aliases: Record<string, string> = { kef: 'Le Kef', manouba: 'La Manouba', mannouba: 'La Manouba' };
  if (aliases[normalized]) return aliases[normalized];
  return GOVERNORATES.find((governorate) => plain(governorate) === normalized) ?? null;
}

function variationValues(item: NavexLineLike): string[] {
  const values = new Set<string>();
  for (const value of Object.values(item.variation ?? {})) {
    if (value && value !== '—') values.add(value.trim().toLowerCase());
  }
  for (const attribute of item.attributes ?? []) {
    if (/^offre$/i.test(attribute.key)) continue;
    if (/^item\s*\d+/i.test(attribute.key)) {
      for (const part of attribute.value.split(/[·;,]/)) {
        const value = (part.includes(':') ? part.slice(part.indexOf(':') + 1) : part).trim().toLowerCase();
        if (value && value !== '—') values.add(value);
      }
    } else if (attribute.value && attribute.value !== '—') {
      values.add(attribute.value.trim().toLowerCase());
    }
  }
  return [...values];
}

export function buildNavexDesignation(items: NavexLineLike[]): { designation: string; nbArticle: number } {
  let nbArticle = 0;
  const parts = items.map((item) => {
    const quantity = Math.max(1, Number(item.quantity ?? item.qty ?? 1));
    nbArticle += quantity;
    const options = variationValues(item);
    return `${item.name.trim()}${options.length ? ` (${options.join(', ')})` : ''} x ${quantity}`;
  });
  return { designation: parts.join(' | ').slice(0, 200), nbArticle: Math.max(1, nbArticle) };
}

function endpoint(token: string): string {
  return `${API_BASE}/api/${encodeURIComponent(token)}/v1/post.php`;
}

function errorMessage(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return typeof raw === 'string' ? raw : undefined;
  const value = raw as Record<string, unknown>;
  return typeof value.status_message === 'string'
    ? value.status_message
    : typeof value.message === 'string' ? value.message : undefined;
}

function succeeded(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const status = (raw as Record<string, unknown>).status;
  return status === 1 || status === '1' || status === true;
}

function barcodeFrom(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  for (const key of ['code_barre', 'code_a_barre', 'code', 'barcode', 'tracking_number', 'status_message']) {
    const candidate = value[key];
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const match = String(candidate).match(/\b\d{8,}\b/);
      if (match) return match[0];
    }
  }
  return undefined;
}

function labelFrom(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  for (const key of ['lien', 'url', 'label_url']) {
    if (typeof value[key] === 'string' && /^https:\/\//i.test(value[key])) return value[key] as string;
  }
  return undefined;
}

async function post(token: string, body: Record<string, string | number>): Promise<{ status: number; raw: unknown }> {
  if (!token) throw new Error('Token Navex manquant');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value)])),
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    let raw: unknown = text;
    try { raw = JSON.parse(text); } catch { /* keep the provider text */ }
    return { status: response.status, raw };
  } finally {
    clearTimeout(timeout);
  }
}

function validateShipment(input: NavexShipmentInput): { error?: string; governorate?: string } {
  const governorate = normalizeNavexGovernorate(input.receiverGov);
  const missing = [
    ['nom', input.receiverName], ['téléphone', input.receiverPhone],
    ['gouvernorat', governorate], ['adresse', input.receiverAddress],
    ['désignation', input.productLabel],
  ].filter(([, value]) => !String(value ?? '').trim()).map(([field]) => field);
  if (missing.length) return { error: `Champs Navex invalides ou manquants : ${missing.join(', ')}` };
  if (!Number.isFinite(input.codAmount) || input.codAmount < 0) return { error: 'Montant Navex invalide' };
  return { governorate: governorate! };
}

export const navex = {
  async createShipment(input: NavexShipmentInput): Promise<NavexResult> {
    if (!ADD_TOKEN) return { ok: false, raw: null, error: 'NAVEX_TOKEN_ADD manquant' };
    const validation = validateShipment(input);
    if (validation.error) return { ok: false, raw: null, error: validation.error };
    try {
      const { status, raw } = await post(ADD_TOKEN, {
        prix: Math.round(input.codAmount),
        nom: input.receiverName.trim(),
        gouvernerat: validation.governorate!,
        ville: input.receiverCity?.trim() || validation.governorate!,
        adresse: input.receiverAddress.trim(),
        tel: input.receiverPhone.trim(),
        tel2: input.receiverPhone2?.trim() ?? '',
        designation: input.productLabel.trim(),
        nb_article: Math.max(1, Math.round(input.itemsCount)),
        msg: input.note?.trim() || input.reference || '',
        echange: input.exchange ? '1' : '0',
        article: '', nb_echange: '0', ouvrir: 'Oui',
        sender_name: '', sender_location: '', sender_gouvernorat: '',
      });
      const barcode = barcodeFrom(raw);
      const ok = status >= 200 && status < 300 && succeeded(raw) && Boolean(barcode);
      return { ok, barcode, labelUrl: labelFrom(raw), raw, error: ok ? undefined : errorMessage(raw) ?? `HTTP ${status}` };
    } catch (error) {
      return { ok: false, raw: null, error: error instanceof Error ? error.message : 'Erreur réseau Navex' };
    }
  },

  async getState(barcode: string): Promise<NavexResult> {
    try {
      const { status, raw } = await post(GET_TOKEN, { code: barcode, include_date: '1', include_prix: '1', include_echange: '1' });
      const ok = status >= 200 && status < 300 && succeeded(raw);
      return { ok, barcode, raw, error: ok ? undefined : errorMessage(raw) ?? `HTTP ${status}` };
    } catch (error) {
      return { ok: false, barcode, raw: null, error: error instanceof Error ? error.message : 'Erreur réseau Navex' };
    }
  },

  async getMultipleStates(codes: string[]): Promise<NavexResult> {
    const clean = [...new Set(codes.map(String).map((code) => code.trim()).filter(Boolean))];
    if (!clean.length) return { ok: false, raw: null, error: 'Au moins un code est requis' };
    try {
      const { status, raw } = await post(MULTIPLE_TOKEN, { codes: clean.join(', ') });
      const ok = status >= 200 && status < 300 && succeeded(raw);
      return { ok, raw, error: ok ? undefined : errorMessage(raw) ?? `HTTP ${status}` };
    } catch (error) {
      return { ok: false, raw: null, error: error instanceof Error ? error.message : 'Erreur réseau Navex' };
    }
  },

  async getPending(): Promise<NavexResult> {
    try {
      const { status, raw } = await post(PENDING_TOKEN, { getattente: '1' });
      const ok = status >= 200 && status < 300 && succeeded(raw);
      return { ok, raw, error: ok ? undefined : errorMessage(raw) ?? `HTTP ${status}` };
    } catch (error) {
      return { ok: false, raw: null, error: error instanceof Error ? error.message : 'Erreur réseau Navex' };
    }
  },

  async deleteShipment(barcode: string): Promise<NavexResult> {
    try {
      const { status, raw } = await post(DELETE_TOKEN, { delete_code: barcode });
      const ok = status >= 200 && status < 300 && succeeded(raw);
      return { ok, barcode, raw, error: ok ? undefined : errorMessage(raw) ?? `HTTP ${status}` };
    } catch (error) {
      return { ok: false, barcode, raw: null, error: error instanceof Error ? error.message : 'Erreur réseau Navex' };
    }
  },
};
