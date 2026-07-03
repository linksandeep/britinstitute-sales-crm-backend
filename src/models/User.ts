import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { IUser } from '../types';

const optionalInternationalPhone = (value?: string) =>
  !value || /^[\+]?[\d\s\-\(\)\.]{7,25}$/.test(value);

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please enter a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  phone: {
    type: String,
    trim: true,
    required: false,
    validate: {
      validator: optionalInternationalPhone,
      message: 'Please enter a valid international phone number'
    }
  },
  canWorkFromHome: { 
    type: Boolean, 
    default: false // By default, everyone must be at the office
  }
  
}, {
  timestamps: true,
  toJSON: {
    transform: function(_doc, ret: any) {
      delete ret.password;
      return ret;
    }
  },
  toObject: {
    transform: function(_doc, ret: any) {
      delete ret.password;
      return ret;
    }
  }
});

// Index for faster queries
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Static method to find user by email and include password
userSchema.statics.findByEmailWithPassword = function(email: string) {
  return this.findOne({ email }).select('+password');
};

// Static method to get user stats
userSchema.statics.getUserStats = async function() {
  const [totalUsers, activeUsers, adminUsers] = await Promise.all([
    this.countDocuments({ email: { $ne: 'system@leadmanager.com' } }),
    this.countDocuments({ email: { $ne: 'system@leadmanager.com' }, isActive: true }),
    this.countDocuments({ email: { $ne: 'system@leadmanager.com' }, role: 'admin' })
  ]);

  return {
    totalUsers,
    activeUsers,
    adminUsers,
    userUsers: totalUsers - adminUsers
  };
};

// Virtual for user's full name display
userSchema.virtual('displayName').get(function() {
  return this.name;
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model<IUser>('User', userSchema);

export default User;
