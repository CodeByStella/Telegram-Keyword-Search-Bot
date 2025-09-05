export interface User {
  id: number;
  phoneNumber: string;
  isAuthenticated: boolean;
  sessionString?: string;
  keywords: string[];
  notificationChatId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KeywordMatch {
  userId: number;
  keyword: string;
  message: string;
  chatId: number;
  messageId: number;
  timestamp: Date;
  chatTitle?: string;
  senderName?: string;
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
  userId: number;
  phoneNumber: string;
  sessionString: string;
  isActive: boolean;
  createdAt: Date;
}

export interface NotificationSettings {
  userId: number;
  enabled: boolean;
  chatId?: number;
  keywords: string[];
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
}
