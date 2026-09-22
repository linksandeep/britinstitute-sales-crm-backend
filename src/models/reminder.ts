import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },

  title: { type: String, required: true },   // "Follow-up call"
  note: { type: String },

  remindAt: { type: Date, required: true },

  kind: {
    type: String,
    enum: ['manual', 'status_follow_up', 'status_call_back'],
    default: 'manual'
  },
  scheduledTimeZone: {
    type: String,
    enum: ['Europe/London', 'Asia/Kolkata']
  },
  scheduledLocalDate: { type: String },
  scheduledLocalTime: { type: String },

  status: {
    type: String,
    enum: ['pending', 'triggered'],
    default: 'pending'
  },

  action: {
    type: String,
    enum: ['none', 'done', 'snooze', 'dismissed'],
    default: 'none'
  }

}, {
  timestamps: true  // ⏱ adds createdAt & updatedAt automatically
});

export default mongoose.model('Reminder', reminderSchema);
