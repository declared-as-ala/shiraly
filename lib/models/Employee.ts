import { Schema, model, models } from 'mongoose';
import crypto from 'node:crypto';

const EmployeeSchema = new Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
  passwordHash: { type: String, required: true },
  salt: { type: String, required: true },
}, { timestamps: true });

EmployeeSchema.methods.verifyPassword = function (password: string): boolean {
  const hash = crypto.scryptSync(password, this.salt, 64).toString('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(this.passwordHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

EmployeeSchema.set('toJSON', {
  transform(_doc: unknown, ret: Record<string, unknown>) {
    delete ret.passwordHash;
    delete ret.salt;
    return ret;
  },
});

const EmployeeModel = models.Employee || model('Employee', EmployeeSchema);

export default EmployeeModel;
export { EmployeeSchema };
