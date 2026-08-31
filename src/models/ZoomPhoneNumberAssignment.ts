import mongoose, { Schema } from 'mongoose';

export interface IZoomPhoneNumberAssignment {
  normalizedNumber: string;
  displayNumber?: string;
  zoomNumberId?: string;
  zoomPhoneUserId?: string;
  zoomPhoneUserEmail?: string;
  zoomPhoneUserName?: string;
  crmUser: mongoose.Types.ObjectId;
  crmUserEmail: string;
  crmUserName: string;
  assignedAt: Date;
  releasedAt?: Date;
  source: 'zoom_inventory' | 'crm_backfill' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}

const zoomPhoneNumberAssignmentSchema = new Schema<IZoomPhoneNumberAssignment>(
  {
    normalizedNumber: {
      type: String,
      required: true,
      trim: true
    },
    displayNumber: {
      type: String,
      trim: true
    },
    zoomNumberId: {
      type: String,
      trim: true
    },
    zoomPhoneUserId: {
      type: String,
      trim: true
    },
    zoomPhoneUserEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    zoomPhoneUserName: {
      type: String,
      trim: true
    },
    crmUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    crmUserEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    crmUserName: {
      type: String,
      required: true,
      trim: true
    },
    assignedAt: {
      type: Date,
      required: true
    },
    releasedAt: {
      type: Date
    },
    source: {
      type: String,
      enum: ['zoom_inventory', 'crm_backfill', 'manual'],
      default: 'zoom_inventory',
      required: true
    }
  },
  {
    timestamps: true
  }
);

zoomPhoneNumberAssignmentSchema.index({ normalizedNumber: 1, assignedAt: 1, releasedAt: 1 });
zoomPhoneNumberAssignmentSchema.index({ crmUser: 1, assignedAt: 1 });
zoomPhoneNumberAssignmentSchema.index(
  { normalizedNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { releasedAt: { $exists: false } }
  }
);

const ZoomPhoneNumberAssignment = mongoose.model<IZoomPhoneNumberAssignment>(
  'ZoomPhoneNumberAssignment',
  zoomPhoneNumberAssignmentSchema
);

export default ZoomPhoneNumberAssignment;
