import mongoose, { Schema, Document } from 'mongoose';
import { KeywordMatch } from '../types';

export interface IKeywordMatch extends Omit<KeywordMatch, '_id'>, Document {}

const KeywordMatchSchema = new Schema<IKeywordMatch>({
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  keyword: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  chatId: {
    type: Number,
    required: true,
    index: true
  },
  messageId: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  chatTitle: {
    type: String,
    trim: true
  },
  senderName: {
    type: String,
    trim: true
  },
  messageLength: {
    type: Number,
    required: true,
    index: true
  }
}, {
  timestamps: false,
  collection: 'keyword_matches'
});

// Indexes
KeywordMatchSchema.index({ userId: 1, timestamp: -1 });
KeywordMatchSchema.index({ chatId: 1, messageId: 1 });
KeywordMatchSchema.index({ keyword: 1, timestamp: -1 });
KeywordMatchSchema.index({ messageLength: 1 });
KeywordMatchSchema.index({ timestamp: -1 });

export const KeywordMatchModel = mongoose.model<IKeywordMatch>('KeywordMatch', KeywordMatchSchema);
