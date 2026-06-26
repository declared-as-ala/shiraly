import { Schema, model, models } from 'mongoose';

const AdminUserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  salt: { type: String, required: true },
  avatarUrl: { type: String, default: null },
  role: { type: String, enum: ['admin'], default: 'admin' },
}, { timestamps: true });

const AdminUserModel = models.AdminUser || model('AdminUser', AdminUserSchema);

export default AdminUserModel;
export { AdminUserSchema };
