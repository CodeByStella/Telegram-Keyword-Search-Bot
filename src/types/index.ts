export interface User {
  _id?: string;
  telegramId: number;
  phoneNumber: string;
  isAuthenticated: boolean;
  sessionString?: string;
  keywords: string[];
  characterLimit: number; // New: character limit for keyword monitoring
  notificationGroups: number[]; // New: multiple groups for notifications
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KeywordMatch {
  _id?: string;
  userId: string;
  keyword: string;
  message: string;
  chatId: number;
  messageId: number;
  timestamp: Date;
  chatTitle?: string;
  senderName?: string;
  messageLength: number; // New: track message length
}

export interface BotConfig {
  botToken: string;
  apiId: number;
  apiHash: string;
  mongodbUri: string;
  sessionName: string;
  logLevel: string;
  nodeEnv: string;
}

export interface AuthSession {
  _id?: string;
  userId: string;
  phoneNumber: string;
  sessionString: string;
  isActive: boolean;
  createdAt: Date;
}

export interface NotificationSettings {
  _id?: string;
  userId: string;
  enabled: boolean;
  notificationGroups: number[];
  keywords: string[];
  characterLimit: number;
  muteUntil?: Date;
}

export interface MessageContext {
  chatId: number;
  messageId: number;
  text: string;
  senderId: number;
  senderName?: string;
  chatTitle?: string;
  timestamp: Date;
  messageLength: number; // New: track message length
}

export interface KeywordMonitoringSettings {
  userId: string;
  keywords: string[];
  characterLimit: number;
  notificationGroups: number[];
  isEnabled: boolean;
}
