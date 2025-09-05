import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

export const config: BotConfig = {
  botToken: process.env.BOT_TOKEN || '',
  apiId: parseInt(process.env.API_ID || '0'),
  apiHash: process.env.API_HASH || '',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-keyword-bot',
  sessionName: process.env.SESSION_NAME || 'telegram_userbot_session',
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required configuration
export function validateConfig(): void {
  const required = ['botToken', 'apiId', 'apiHash'];
  const missing = required.filter(key => !config[key as keyof BotConfig]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
