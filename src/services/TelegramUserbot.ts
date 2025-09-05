import { TelegramClient } from 'telegram';
import { UserModel } from '../models/UserModel';
import { KeywordMatchModel } from '../models/KeywordMatchModel';
import { TelegramBotService } from './TelegramBot';
import { TelegramAuthService } from './TelegramAuthService';
import { MessageContext } from '../types';
import logger from '../utils/logger';

export class TelegramUserbotService {
  private client: TelegramClient | null = null;
  private userModel: UserModel;
  private keywordMatchModel: KeywordMatchModel;
  private botService: TelegramBotService;
  private authService: TelegramAuthService;
  private isRunning: boolean = false;
  private activeUsers: Map<string, any> = new Map();

  constructor(botService: TelegramBotService) {
    this.userModel = new UserModel();
    this.keywordMatchModel = new KeywordMatchModel();
    this.botService = botService;
    this.authService = new TelegramAuthService();
  }

  private setupEventHandlers(client: TelegramClient): void {
    // Listen for new messages
    client.addEventHandler(async (event: any) => {
      try {
        if (event.className === 'UpdateNewMessage') {
          await this.handleNewMessage(event);
        }
      } catch (error) {
        logger.error('Error handling userbot event:', error);
      }
    });

    // Listen for message edits
    client.addEventHandler(async (event: any) => {
      try {
        if (event.className === 'UpdateEditMessage') {
          await this.handleEditMessage(event);
        }
      } catch (error) {
        logger.error('Error handling message edit event:', error);
      }
    });
  }

  private async handleNewMessage(event: any): Promise<void> {
    try {
      const message = event.message;
      if (!message || !message.message || typeof message.message !== 'string') {
        return;
      }

      const messageText = message.message;
      const chatId = message.chatId?.toString();
      const messageId = message.id;
      const senderId = message.senderId?.toString();

      if (!chatId || !messageId || !senderId) {
        return;
      }

      // Get chat information
      const chat = await this.getChatInfo(chatId);
      const senderName = await this.getSenderName(senderId);

      const messageContext: MessageContext = {
        chatId: parseInt(chatId),
        messageId: parseInt(messageId),
        text: messageText,
        senderId: parseInt(senderId),
        senderName,
        chatTitle: chat?.title,
        timestamp: new Date(),
        messageLength: messageText.length,
      };

      // Check for keyword matches with character limit filtering
      await this.checkKeywordMatches(messageContext);
    } catch (error) {
      logger.error('Error processing new message:', error);
    }
  }

  private async handleEditMessage(event: any): Promise<void> {
    try {
      const message = event.message;
      if (!message || !message.message || typeof message.message !== 'string') {
        return;
      }

      const messageText = message.message;
      const chatId = message.chatId?.toString();
      const messageId = message.id;
      const senderId = message.senderId?.toString();

      if (!chatId || !messageId || !senderId) {
        return;
      }

      // Get chat information
      const chat = await this.getChatInfo(chatId);
      const senderName = await this.getSenderName(senderId);

      const messageContext: MessageContext = {
        chatId: parseInt(chatId),
        messageId: parseInt(messageId),
        text: messageText,
        senderId: parseInt(senderId),
        senderName,
        chatTitle: chat?.title,
        timestamp: new Date(),
        messageLength: messageText.length,
      };

      // Check for keyword matches with character limit filtering
      await this.checkKeywordMatches(messageContext);
    } catch (error) {
      logger.error('Error processing edited message:', error);
    }
  }

  private async getChatInfo(chatId: string): Promise<{ title?: string } | null> {
    if (!this.client) return null;
    
    try {
      const chat = await this.client.getEntity(chatId);
      return {
        title: (chat as any).title || (chat as any).firstName || 'Unknown Chat',
      };
    } catch (error) {
      logger.error('Error getting chat info:', error);
      return null;
    }
  }

  private async getSenderName(senderId: string): Promise<string | undefined> {
    if (!this.client) return undefined;
    
    try {
      const user = await this.client.getEntity(senderId);
      return (user as any).firstName || (user as any).username || 'Unknown User';
    } catch (error) {
      logger.error('Error getting sender name:', error);
      return undefined;
    }
  }

  private async checkKeywordMatches(messageContext: MessageContext): Promise<void> {
    try {
      const activeUsers = await this.userModel.getAllActiveUsers();
      
      for (const user of activeUsers) {
        if (!user.keywords || user.keywords.length === 0) {
          continue;
        }

        // Check character limit - only process messages within the user's character limit
        if (messageContext.messageLength > user.characterLimit) {
          continue;
        }

        const matchedKeywords = user.keywords.filter(keyword =>
          messageContext.text.toLowerCase().includes(keyword.toLowerCase())
        );

        if (matchedKeywords.length > 0) {
          for (const keyword of matchedKeywords) {
            // Save keyword match
            await this.keywordMatchModel.createMatch({
              userId: user._id!.toString(),
              keyword,
              message: messageContext.text,
              chatId: messageContext.chatId,
              messageId: messageContext.messageId,
              chatTitle: messageContext.chatTitle,
              senderName: messageContext.senderName,
              messageLength: messageContext.messageLength,
            });

            // Send notification to all configured groups
            await this.sendKeywordNotification(user, keyword, messageContext);
          }
        }
      }
    } catch (error) {
      logger.error('Error checking keyword matches:', error);
    }
  }

  private async sendKeywordNotification(user: any, keyword: string, messageContext: MessageContext): Promise<void> {
    try {
      const notificationMessage = `
🔔 Keyword Match Found!

Keyword: "${keyword}"
Chat: ${messageContext.chatTitle || 'Unknown Chat'}
From: ${messageContext.senderName || 'Unknown User'}
Message: ${messageContext.text.length > 200 ? messageContext.text.substring(0, 200) + '...' : messageContext.text}
Length: ${messageContext.messageLength} chars (limit: ${user.characterLimit})

Time: ${messageContext.timestamp.toLocaleString()}
      `;

      // Send notification to all configured notification groups
      if (user.notificationGroups && user.notificationGroups.length > 0) {
        for (const groupId of user.notificationGroups) {
          try {
            await this.botService.sendNotification(groupId, notificationMessage);
            logger.info(`Keyword notification sent to group ${groupId} for user ${user.telegramId} keyword "${keyword}"`);
          } catch (error) {
            logger.error(`Failed to send notification to group ${groupId}:`, error);
          }
        }
      } else {
        // Fallback to user's direct chat if no groups configured
        await this.botService.sendNotification(user.telegramId, notificationMessage);
        logger.info(`Keyword notification sent to user ${user.telegramId} for keyword "${keyword}"`);
      }
    } catch (error) {
      logger.error('Error sending keyword notification:', error);
    }
  }

  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        logger.warn('Userbot is already running');
        return;
      }

      // Get all authenticated users and start their userbots
      const activeUsers = await this.userModel.getAllActiveUsers();
      
      for (const user of activeUsers) {
        if (user.sessionString) {
          try {
            const client = await this.authService.createAuthenticatedClient(user.telegramId);
            if (client) {
              this.setupEventHandlers(client);
              this.activeUsers.set(user._id!.toString(), client);
              logger.info(`Started userbot for user ${user.telegramId}`);
            }
          } catch (error) {
            logger.error(`Failed to start userbot for user ${user.telegramId}:`, error);
          }
        }
      }

      this.isRunning = true;
      logger.info('Telegram userbot service started successfully');
    } catch (error) {
      logger.error('Failed to start Telegram userbot service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        return;
      }

      // Disconnect all active userbots
      for (const [userId, client] of this.activeUsers) {
        try {
          await client.disconnect();
          logger.info(`Stopped userbot for user ${userId}`);
        } catch (error) {
          logger.error(`Error stopping userbot for user ${userId}:`, error);
        }
      }

      this.activeUsers.clear();
      this.isRunning = false;
      logger.info('Telegram userbot service stopped');
    } catch (error) {
      logger.error('Error stopping Telegram userbot service:', error);
      throw error;
    }
  }

  async startUserbotForUser(telegramId: number): Promise<boolean> {
    try {
      const user = await this.userModel.getUserByTelegramId(telegramId);
      if (!user || !user.sessionString) {
        return false;
      }

      const client = await this.authService.createAuthenticatedClient(telegramId);
      if (client) {
        this.setupEventHandlers(client);
        this.activeUsers.set(user._id!.toString(), client);
        logger.info(`Started userbot for user ${telegramId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to start userbot for user ${telegramId}:`, error);
      return false;
    }
  }


  isUserbotRunning(): boolean {
    return this.isRunning;
  }
}
