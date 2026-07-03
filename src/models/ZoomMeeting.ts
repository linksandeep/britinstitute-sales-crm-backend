import mongoose, { Schema } from 'mongoose';

export interface IZoomMeeting extends mongoose.Document {
  topic: string;
  agenda?: string;
  startTime: Date;
  duration: number;
  timezone: string;
  lead?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  hostUser?: mongoose.Types.ObjectId;
  zoomMeetingId: string;
  zoomUuid?: string;
  joinUrl: string;
  startUrl?: string;
  password?: string;
  status: 'scheduled' | 'synced' | 'cancelled';
  rawZoomResponse?: Record<string, unknown>;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const zoomMeetingSchema = new Schema<IZoomMeeting>(
  {
    topic: {
      type: String,
      required: [true, 'Meeting topic is required'],
      trim: true,
      maxlength: [200, 'Meeting topic cannot exceed 200 characters']
    },
    agenda: {
      type: String,
      trim: true,
      maxlength: [2000, 'Meeting agenda cannot exceed 2000 characters']
    },
    startTime: {
      type: Date,
      required: [true, 'Meeting start time is required']
    },
    duration: {
      type: Number,
      required: true,
      min: [1, 'Meeting duration must be at least 1 minute'],
      max: [1440, 'Meeting duration cannot exceed 1440 minutes'],
      default: 30
    },
    timezone: {
      type: String,
      trim: true,
      default: 'Europe/London'
    },
    lead: {
      type: Schema.Types.ObjectId,
      ref: 'Lead'
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    hostUser: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    zoomMeetingId: {
      type: String,
      required: true,
      index: true
    },
    zoomUuid: {
      type: String,
      index: true
    },
    joinUrl: {
      type: String,
      required: true,
      trim: true
    },
    startUrl: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'synced', 'cancelled'],
      default: 'scheduled'
    },
    rawZoomResponse: {
      type: Schema.Types.Mixed
    },
    lastSyncedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

zoomMeetingSchema.index({ createdBy: 1, startTime: -1 });
zoomMeetingSchema.index({ hostUser: 1, startTime: -1 });
zoomMeetingSchema.index({ lead: 1, startTime: -1 });
zoomMeetingSchema.index({ status: 1, startTime: -1 });
zoomMeetingSchema.index({ topic: 'text', agenda: 'text', zoomMeetingId: 'text' });

const ZoomMeeting = mongoose.model<IZoomMeeting>('ZoomMeeting', zoomMeetingSchema);

export default ZoomMeeting;
