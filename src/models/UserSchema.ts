import mongoose, { Schema, Document } from 'mongoose';
import { User } from '../types';

export interface IUser extends Omit<User, '_id'>, Document {}

const UserSchema = new Schema<IUser>({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  sessionString: {
    type: String,
    default: ''
  },
  keywords: [{
    type: String,
    trim: true
  }],
  characterLimit: {
    type: Number,
    default: 100,
    min: 1,
    max: 1000
  },
  notificationGroups: [{
    type: Number
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes
UserSchema.index({ telegramId: 1 });
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ isAuthenticated: 1 });
UserSchema.index({ isActive: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);
