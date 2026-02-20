import mongoose, { Schema, Document } from 'mongoose';

export interface IVisaApplication extends Document {
  // Application tracking
  applicationId: string;
  status: 'pending' | 'under_review' | 'documents_requested' | 'approved' | 'rejected' | 'completed';
  applicationDate: string;
  source: 'booking' | 'direct'; // came from booking or standalone form

  // Personal info (from the new visa form)
  completeName: string;
  passportNumber?: string;
  civilStatus?: string;
  contactNumber?: string;
  emailAddress?: string;
  presentAddress?: string;
  travelHistory?: string;

  // Employment info
  companyName?: string;
  jobTitle?: string;
  companyLocation?: string;
  dateHiredOrStarted?: string;

  // Booking-linked fields
  bookingId?: string;
  tourTitle?: string;
  destinationCountries?: string;

  // Admin-managed
  notes?: string;
  assignedTo?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const VisaApplicationSchema = new Schema<IVisaApplication>(
  {
    applicationId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'documents_requested', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
    applicationDate: { type: String, required: true },
    source: { type: String, enum: ['booking', 'direct'], default: 'direct' },

    completeName: { type: String, required: true },
    passportNumber: { type: String },
    civilStatus: { type: String },
    contactNumber: { type: String },
    emailAddress: { type: String },
    presentAddress: { type: String },
    travelHistory: { type: String },

    companyName: { type: String },
    jobTitle: { type: String },
    companyLocation: { type: String },
    dateHiredOrStarted: { type: String },

    bookingId: { type: String },
    tourTitle: { type: String },
    destinationCountries: { type: String },

    notes: { type: String },
    assignedTo: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IVisaApplication>('VisaApplication', VisaApplicationSchema);
