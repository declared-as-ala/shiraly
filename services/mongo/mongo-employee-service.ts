import type { Employee } from '@/lib/employee-storage';
import type { EmployeeService, EmployeeInput, EmployeeUpdate } from '../employee-service';
import connect from '@/lib/mongodb';
import EmployeeModel from '@/lib/models/Employee';
import crypto from 'node:crypto';

export class MongoEmployeeService implements EmployeeService {
  async list(): Promise<Employee[]> {
    await connect();
    const docs = await EmployeeModel.find().sort({ name: 1 }).lean();
    return docs.map((d) => ({
      id: String(d._id),
      email: d.email,
      name: d.name,
      active: d.active,
      createdAt: d.createdAt?.toISOString?.() ?? String(d.createdAt),
      updatedAt: d.updatedAt?.toISOString?.() ?? String(d.updatedAt),
    }));
  }

  async get(id: string): Promise<Employee | null> {
    await connect();
    const doc = await EmployeeModel.findById(id).lean();
    if (!doc) return null;
    return {
      id: String(doc._id),
      email: doc.email,
      name: doc.name,
      active: doc.active,
      createdAt: doc.createdAt?.toISOString?.() ?? String(doc.createdAt),
      updatedAt: doc.updatedAt?.toISOString?.() ?? String(doc.updatedAt),
    };
  }

  async getByEmail(email: string): Promise<Employee | null> {
    await connect();
    const norm = email.trim().toLowerCase();
    const doc = await EmployeeModel.findOne({ email: norm }).lean();
    if (!doc) return null;
    return {
      id: String(doc._id),
      email: doc.email,
      name: doc.name,
      active: doc.active,
      createdAt: doc.createdAt?.toISOString?.() ?? String(doc.createdAt),
      updatedAt: doc.updatedAt?.toISOString?.() ?? String(doc.updatedAt),
    };
  }

  async verifyCredentials(email: string, password: string): Promise<Employee | null> {
    await connect();
    const norm = email.trim().toLowerCase();
    const doc = await EmployeeModel.findOne({ email: norm, active: true }).lean();
    if (!doc) return null;
    const hash = crypto.scryptSync(password, doc.salt, 64).toString('hex');
    const a = Buffer.from(hash);
    const b = Buffer.from(doc.passwordHash);
    if (a.length !== b.length) return null;
    const match = crypto.timingSafeEqual(a, b);
    if (!match) return null;
    return {
      id: String(doc._id),
      email: doc.email,
      name: doc.name,
      active: doc.active,
      createdAt: doc.createdAt?.toISOString?.() ?? String(doc.createdAt),
      updatedAt: doc.updatedAt?.toISOString?.() ?? String(doc.updatedAt),
    };
  }

  async create(input: EmployeeInput): Promise<Employee> {
    await connect();
    const email = input.email.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email invalide');
    if (!input.password || input.password.length < 6) throw new Error('Mot de passe trop court (min 6 caractères)');
    if (!input.name?.trim()) throw new Error('Nom requis');

    const existing = await EmployeeModel.findOne({ email });
    if (existing) throw new Error('Email déjà utilisé');

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(input.password, salt, 64).toString('hex');

    const doc = await EmployeeModel.create({
      email,
      name: input.name.trim(),
      active: input.active ?? true,
      passwordHash,
      salt,
    });

    return {
      id: String(doc._id),
      email: doc.email,
      name: doc.name,
      active: doc.active,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async update(id: string, patch: EmployeeUpdate): Promise<Employee> {
    await connect();
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new Error('Nom requis');
      update.name = patch.name.trim();
    }
    if (patch.email !== undefined) {
      const next = patch.email.trim().toLowerCase();
      if (!next || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) throw new Error('Email invalide');
      const existing = await EmployeeModel.findOne({ email: next, _id: { $ne: id } });
      if (existing) throw new Error('Email déjà utilisé');
      update.email = next;
    }
    if (patch.active !== undefined) update.active = patch.active;
    if (patch.password) {
      if (patch.password.length < 6) throw new Error('Mot de passe trop court (min 6 caractères)');
      update.salt = crypto.randomBytes(16).toString('hex');
      update.passwordHash = crypto.scryptSync(patch.password, update.salt as string, 64).toString('hex');
    }
    const doc = await EmployeeModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) throw new Error('Employé introuvable');
    return {
      id: String(doc._id),
      email: doc.email,
      name: doc.name,
      active: doc.active,
      createdAt: doc.createdAt?.toISOString?.() ?? String(doc.createdAt),
      updatedAt: doc.updatedAt?.toISOString?.() ?? String(doc.updatedAt),
    };
  }

  async remove(id: string): Promise<void> {
    await connect();
    await EmployeeModel.findByIdAndUpdate(id, { $set: { active: false } });
  }
}
