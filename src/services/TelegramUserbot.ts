import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { config } from '../config';
import { UserModel } from '../models/UserModel';
import { KeywordMatchModel } from '../models/KeywordMatchModel';
import { TelegramBotService } from './TelegramBot';
import { MessageContext } from '../types';
import logger from '../utils/logger';

export class TelegramUserbotService {
  private client: TelegramClient;
  private userModel: UserModel;
  private keywordMatchModel: KeywordMatchModel;
  private botService: TelegramBotService;
  private isRunning: boolean = false;
  private activeUsers: Map<string, any> = new Map();

  constructor(botService: TelegramBotService) {
    this.client = new TelegramClient(
      new StringSession(''), // Will be set when user authenticates
      config.apiId,
      config.apiHash,
      {
        connectionRetries: 5,
      }
    );
    this.userModel = new UserModel();
    this.keywordMatchModel = new KeywordMatchModel();
    this.botService = botService;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for new messages
    this.client.addEventHandler(async (event: any) => {
      try {
        if (event.className === 'UpdateNewMessage') {
          await this.handleNewMessage(event);
        }
      } catch (error) {
        logger.error('Error handling userbot event:', error);
      }
    });

    // Listen for message edits
    this.client.addEventHandler(async (event: any) => {
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

      await this.client.start({
        phoneNumber: async () => {
          // This will be handled by the bot authentication flow
          throw new Error('Phone number should be provided through bot authentication');
        },
        phoneCode: async () => {
          // This will be handled by the bot authentication flow
          throw new Error('Phone code should be provided through bot authentication');
        },
        onError: (err: any) => {
          logger.error('Userbot error:', err);
        },
      });

      this.isRunning = true;
      logger.info('Telegram userbot started successfully');
    } catch (error) {
      logger.error('Failed to start Telegram userbot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        return;
      }

      await this.client.disconnect();
      this.isRunning = false;
      logger.info('Telegram userbot stopped');
    } catch (error) {
      logger.error('Error stopping Telegram userbot:', error);
      throw error;
    }
  }

  async authenticateUser(telegramId: number, phoneNumber: string, sessionString: string): Promise<boolean> {
    try {
      // Update the client with the user's session
      this.client = new TelegramClient(
        new StringSession(sessionString),
        config.apiId,
        config.apiHash,
        {
          connectionRetries: 5,
        }
      );

      // Test the connection
      await this.client.connect();
      const me = await this.client.getMe();
      
      if (me.id.toString() === telegramId.toString()) {
        logger.info(`User ${telegramId} authenticated successfully`);
        return true;
      } else {
        logger.error(`Session mismatch for user ${telegramId}`);
        return false;
      }
    } catch (error) {
      logger.error(`Authentication failed for user ${telegramId}:`, error);
      return false;
    }
  }

  isUserbotRunning(): boolean {
    return this.isRunning;
  }
}
