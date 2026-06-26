import { Schema, model, models } from 'mongoose';

const SlideSchema = new Schema({
  imageUrl: { type: String, required: true },
  title: String,
  subtitle: String,
  buttonText: String,
  buttonLink: String,
  order: { type: Number, default: 0 },
}, { _id: false });

const SiteSettingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed },
}, { timestamps: true });

const SiteSettingModel = models.SiteSetting || model('SiteSetting', SiteSettingSchema);

export default SiteSettingModel;
export { SlideSchema };
