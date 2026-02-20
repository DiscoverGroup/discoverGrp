import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  key: string;
  // Add-on pricing
  visaAssistanceFee: number;
  visaAssistanceOriginalFee: number;
  visaDiscountEnabled: boolean;
  insuranceFee: number;
  insuranceOriginalFee: number;
  insuranceDiscountEnabled: boolean;
  // Passport assistance pricing
  passportAssistanceFee: number;
  passportAssistanceOriginalFee: number;
  passportDiscountEnabled: boolean;
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, default: 'global', unique: true },
    // Visa assistance pricing
    visaAssistanceFee: { type: Number, default: 10000 },
    visaAssistanceOriginalFee: { type: Number, default: 20000 },
    visaDiscountEnabled: { type: Boolean, default: true },
    // Travel insurance pricing
    insuranceFee: { type: Number, default: 3000 },
    insuranceOriginalFee: { type: Number, default: 6000 },
    insuranceDiscountEnabled: { type: Boolean, default: true },
    // Passport assistance pricing
    passportAssistanceFee: { type: Number, default: 5000 },
    passportAssistanceOriginalFee: { type: Number, default: 10000 },
    passportDiscountEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);
