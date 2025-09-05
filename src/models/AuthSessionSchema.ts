import mongoose, { Schema, Document } from 'mongoose';
import { AuthSession } from '../types';

export interface IAuthSession extends Omit<AuthSession, '_id'>, Document {}

const AuthSessionSchema = new Schema<IAuthSession>({
  userId: {
    type: String,
    required: true,
    unique: true,
    ref: 'User',
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  sessionString: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'auth_sessions'
});

// Indexes
AuthSessionSchema.index({ userId: 1 });
AuthSessionSchema.index({ phoneNumber: 1 });
AuthSessionSchema.index({ isActive: 1 });

export const AuthSessionModel = mongoose.model<IAuthSession>('AuthSession', AuthSessionSchema);
