/**
 * Admin credential + site settings store.
 * Uses MongoDB when available, falls back to file-based storage.
 */
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import connect from './mongodb';
import SiteSettingModel from './models/SiteSetting';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'admin.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'site-settings.json');

const SETTINGS_KEY = 'site_settings';
const PASSWORD_KEY = 'admin_password';

export type SiteSettings = {
  photoUrl: string | null;
  phones: string[];
  whatsapp: string;
  instagram: string;
  tiktok: string;
  facebook: string;
};

async function getMongoValue(key: string): Promise<Record<string, unknown> | null> {
  try {
    await connect();
    const doc = await SiteSettingModel.findOne({ key }).lean();
    return doc?.value ? (doc.value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function setMongoValue(key: string, value: unknown): Promise<void> {
  try {
    await connect();
    await SiteSettingModel.updateOne({ key }, { $set: { key, value } }, { upsert: true });
  } catch {
    // fallback to file
  }
}

export async function getSiteSettings(): Promise<Partial<SiteSettings>> {
  const mongo = await getMongoValue(SETTINGS_KEY);
  if (mongo) return mongo as Partial<SiteSettings>;
  try {
    const buf = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(buf) as Partial<SiteSettings>;
  } catch {
    return {};
  }
}

export async function setSiteSettings(patch: Partial<SiteSettings>): Promise<void> {
  await setMongoValue(SETTINGS_KEY, patch);
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const current = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    await fs.writeFile(SETTINGS_FILE, JSON.stringify({ ...current, ...patch }, null, 2), 'utf8');
  } catch {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(patch, null, 2), 'utf8');
  }
}

type Stored = { passwordHash: string; salt: string; updatedAt: string };

async function readPassword(): Promise<Stored | null> {
  try {
    const mongo = await getMongoValue(PASSWORD_KEY);
    if (mongo && (mongo as Stored).passwordHash) return mongo as Stored;
  } catch {}
  try {
    const buf = await fs.readFile(FILE, 'utf8');
    const json = JSON.parse(buf) as Stored;
    if (json?.passwordHash && json?.salt) return json;
    return null;
  } catch {
    return null;
  }
}

async function writePassword(s: Stored): Promise<void> {
  await setMongoValue(PASSWORD_KEY, s);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
}

function hash(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export async function verifyPassword(input: string): Promise<boolean> {
  if (!input) return false;
  const envPw = process.env.ADMIN_PASSWORD;
  if (envPw && timingSafeEq(input, envPw)) return true;

  const stored = await readPassword();
  if (!stored) return false;
  const computed = hash(input, stored.salt);
  return timingSafeEq(computed, stored.passwordHash);
}

export async function setPassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  await writePassword({
    passwordHash: hash(newPassword, salt),
    salt,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearStoredPassword(): Promise<void> {
  try { await fs.unlink(FILE); } catch {}
  try { await SiteSettingModel.deleteOne({ key: PASSWORD_KEY }); } catch {}
}

export async function hasCustomPassword(): Promise<boolean> {
  return (await readPassword()) !== null;
}

export async function getPasswordMeta(): Promise<{ updatedAt: string | null; hasCustom: boolean }> {
  const s = await readPassword();
  return { updatedAt: s?.updatedAt ?? null, hasCustom: !!s };
}

function timingSafeEq(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}
