import 'server-only';
import crypto from 'node:crypto';
import connect from '@/lib/mongodb';
import AdminUserModel from '@/lib/models/AdminUser';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'admin';
  createdAt: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

function hash(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function makeHash(password: string): { salt: string; passwordHash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, passwordHash: hash(password, salt) };
}
function timingSafeEq(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function toUser(doc: Record<string, unknown>): AdminUser {
  return {
    id: String(doc._id),
    name: (doc.name as string) ?? '',
    email: (doc.email as string) ?? '',
    avatarUrl: (doc.avatarUrl as string | null) ?? null,
    role: 'admin',
    createdAt: doc.createdAt ? new Date(doc.createdAt as string).toISOString() : null,
  };
}

export async function countAdmins(): Promise<number> {
  await connect();
  return AdminUserModel.countDocuments();
}

export async function listAdmins(): Promise<AdminUser[]> {
  await connect();
  const docs = await AdminUserModel.find().sort({ createdAt: 1 }).lean();
  return docs.map(toUser);
}

export async function getAdminById(id: string): Promise<AdminUser | null> {
  await connect();
  try {
    const doc = await AdminUserModel.findById(id).lean();
    return doc ? toUser(doc) : null;
  } catch {
    return null;
  }
}

export async function getAdminByEmail(email: string): Promise<AdminUser | null> {
  await connect();
  const doc = await AdminUserModel.findOne({ email: email.toLowerCase().trim() }).lean();
  return doc ? toUser(doc) : null;
}

/** Verify email + password against a stored admin user. Returns the user or null. */
export async function verifyAdminCredentials(email: string, password: string): Promise<AdminUser | null> {
  await connect();
  const doc = await AdminUserModel.findOne({ email: email.toLowerCase().trim() }).lean();
  if (!doc) return null;
  const computed = hash(password, doc.salt as string);
  return timingSafeEq(computed, doc.passwordHash as string) ? toUser(doc) : null;
}

export async function createAdmin(input: { name: string; email: string; password: string; avatarUrl?: string | null }): Promise<AdminUser> {
  await connect();
  const email = input.email.toLowerCase().trim();
  if (!isEmail(email)) throw new Error('Adresse email invalide.');
  if (!input.password || input.password.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
  if (!input.name.trim()) throw new Error('Le nom est obligatoire.');
  const existing = await AdminUserModel.findOne({ email }).lean();
  if (existing) throw new Error('Un administrateur avec cet email existe déjà.');
  const { salt, passwordHash } = makeHash(input.password);
  const doc = await AdminUserModel.create({
    name: input.name.trim(), email, salt, passwordHash, avatarUrl: input.avatarUrl ?? null, role: 'admin',
  });
  return toUser(doc.toObject());
}

export async function updateAdminProfile(id: string, patch: { name?: string; email?: string; avatarUrl?: string | null }): Promise<AdminUser> {
  await connect();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('Le nom est obligatoire.');
    update.name = patch.name.trim();
  }
  if (patch.email !== undefined) {
    const email = patch.email.toLowerCase().trim();
    if (!isEmail(email)) throw new Error('Adresse email invalide.');
    const other = await AdminUserModel.findOne({ email, _id: { $ne: id } }).lean();
    if (other) throw new Error('Cet email est déjà utilisé.');
    update.email = email;
  }
  if (patch.avatarUrl !== undefined) update.avatarUrl = patch.avatarUrl;
  const doc = await AdminUserModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) throw new Error('Administrateur introuvable.');
  return toUser(doc);
}

export async function changeAdminPassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
  await connect();
  if (!newPassword || newPassword.length < 6) throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères.');
  const doc = await AdminUserModel.findById(id);
  if (!doc) throw new Error('Administrateur introuvable.');
  const computed = hash(currentPassword, doc.salt as string);
  if (!timingSafeEq(computed, doc.passwordHash as string)) throw new Error('Mot de passe actuel incorrect.');
  const { salt, passwordHash } = makeHash(newPassword);
  doc.salt = salt;
  doc.passwordHash = passwordHash;
  await doc.save();
}

export async function deleteAdmin(id: string): Promise<void> {
  await connect();
  const total = await AdminUserModel.countDocuments();
  if (total <= 1) throw new Error('Impossible de supprimer le dernier administrateur.');
  await AdminUserModel.findByIdAndDelete(id);
}

/**
 * Bridge the legacy single-admin (env ADMIN_PASSWORD / data/admin.json) into a real
 * AdminUser the first time it is needed, so profile editing has a record to work with.
 */
export async function ensureBootstrapAdmin(password: string): Promise<AdminUser> {
  await connect();
  const total = await AdminUserModel.countDocuments();
  if (total > 0) {
    const first = await AdminUserModel.findOne().sort({ createdAt: 1 }).lean();
    return toUser(first as Record<string, unknown>);
  }
  const email = (process.env.ADMIN_EMAIL ?? 'admin@shiraly.tn').toLowerCase().trim();
  const { salt, passwordHash } = makeHash(password || 'change-me');
  const doc = await AdminUserModel.create({
    name: 'Administrateur', email, salt, passwordHash, role: 'admin',
  });
  return toUser(doc.toObject());
}
