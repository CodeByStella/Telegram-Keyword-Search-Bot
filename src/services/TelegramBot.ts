import { Telegraf } from 'telegraf';
import { config } from '../config';
import { UserModel } from '../models/UserModel';
import { KeywordMatchModel } from '../models/KeywordMatchModel';
import logger from '../utils/logger';

export class TelegramBotService {
  private bot: Telegraf;
  private userModel: UserModel;
  private keywordMatchModel: KeywordMatchModel;
  private pendingAuth: Map<number, { phoneNumber: string; step: 'phone' | 'code' }> = new Map();

  constructor() {
    this.bot = new Telegraf(config.botToken);
    this.userModel = new UserModel();
    this.keywordMatchModel = new KeywordMatchModel();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Start command
    this.bot.start((ctx) => {
      const welcomeMessage = `
🤖 Welcome to Telegram Keyword Search Bot!

This bot helps you monitor Telegram groups for specific keywords and get notifications when they're mentioned.

Commands:
/start - Show this help message
/login - Login with your phone number
/logout - Logout from the bot
/addkeyword <keyword> - Add a keyword to monitor
/removekeyword <keyword> - Remove a keyword
/listkeywords - List your monitored keywords
/setnotification <chat_id> - Set notification chat
/status - Check your status
/help - Show this help message

To get started, use /login to authenticate with your phone number.
      `;
      ctx.reply(welcomeMessage);
    });

    // Help command
    this.bot.help((ctx) => {
      ctx.reply('Use /start to see all available commands.');
    });

    // Login command
    this.bot.command('login', (ctx) => {
      ctx.reply('Please send your phone number in international format (e.g., +1234567890):');
      this.pendingAuth.set(ctx.from.id, { phoneNumber: '', step: 'phone' });
    });

    // Logout command
    this.bot.command('logout', async (ctx) => {
      try {
        await this.userModel.updateUser(ctx.from.id, { isAuthenticated: false });
        ctx.reply('You have been logged out successfully.');
      } catch (error) {
        logger.error('Logout error:', error);
        ctx.reply('An error occurred during logout. Please try again.');
      }
    });

    // Add keyword command
    this.bot.command('addkeyword', async (ctx) => {
      const keyword = ctx.message.text.split(' ').slice(1).join(' ').trim();
      if (!keyword) {
        ctx.reply('Please provide a keyword to add. Usage: /addkeyword <keyword>');
        return;
      }

      try {
        const user = await this.userModel.getUserById(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const success = await this.userModel.addKeyword(ctx.from.id, keyword);
        if (success) {
          ctx.reply(`Keyword "${keyword}" added successfully!`);
        } else {
          ctx.reply(`Keyword "${keyword}" is already in your list.`);
        }
      } catch (error) {
        logger.error('Add keyword error:', error);
        ctx.reply('An error occurred while adding the keyword. Please try again.');
      }
    });

    // Remove keyword command
    this.bot.command('removekeyword', async (ctx) => {
      const keyword = ctx.message.text.split(' ').slice(1).join(' ').trim();
      if (!keyword) {
        ctx.reply('Please provide a keyword to remove. Usage: /removekeyword <keyword>');
        return;
      }

      try {
        const user = await this.userModel.getUserById(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const success = await this.userModel.removeKeyword(ctx.from.id, keyword);
        if (success) {
          ctx.reply(`Keyword "${keyword}" removed successfully!`);
        } else {
          ctx.reply(`Keyword "${keyword}" was not found in your list.`);
        }
      } catch (error) {
        logger.error('Remove keyword error:', error);
        ctx.reply('An error occurred while removing the keyword. Please try again.');
      }
    });

    // List keywords command
    this.bot.command('listkeywords', async (ctx) => {
      try {
        const user = await this.userModel.getUserById(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        if (user.keywords.length === 0) {
          ctx.reply('You have no keywords to monitor. Use /addkeyword to add some.');
          return;
        }

        const keywordsList = user.keywords.map((keyword, index) => `${index + 1}. ${keyword}`).join('\n');
        ctx.reply(`Your monitored keywords:\n\n${keywordsList}`);
      } catch (error) {
        logger.error('List keywords error:', error);
        ctx.reply('An error occurred while fetching your keywords. Please try again.');
      }
    });

    // Set notification chat command
    this.bot.command('setnotification', async (ctx) => {
      const chatId = ctx.message.text.split(' ').slice(1)[0];
      if (!chatId || isNaN(Number(chatId))) {
        ctx.reply('Please provide a valid chat ID. Usage: /setnotification <chat_id>');
        return;
      }

      try {
        const user = await this.userModel.getUserById(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const success = await this.userModel.setNotificationChat(ctx.from.id, Number(chatId));
        if (success) {
          ctx.reply(`Notification chat set to: ${chatId}`);
        } else {
          ctx.reply('Failed to set notification chat. Please try again.');
        }
      } catch (error) {
        logger.error('Set notification error:', error);
        ctx.reply('An error occurred while setting notification chat. Please try again.');
      }
    });

    // Status command
    this.bot.command('status', async (ctx) => {
      try {
        const user = await this.userModel.getUserById(ctx.from.id);
        if (!user) {
          ctx.reply('You are not registered. Use /login to get started.');
          return;
        }

        const status = user.isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated';
        const keywordsCount = user.keywords.length;
        const notificationChat = user.notificationChatId ? `Chat ID: ${user.notificationChatId}` : 'Not set';

        const statusMessage = `
📊 Your Status:
${status}
📝 Monitored keywords: ${keywordsCount}
🔔 Notification chat: ${notificationChat}

Use /login to authenticate or /addkeyword to add keywords to monitor.
        `;

        ctx.reply(statusMessage);
      } catch (error) {
        logger.error('Status error:', error);
        ctx.reply('An error occurred while checking your status. Please try again.');
      }
    });

    // Handle text messages for authentication
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const text = ctx.message.text;

      if (this.pendingAuth.has(userId)) {
        const authData = this.pendingAuth.get(userId)!;
        
        if (authData.step === 'phone') {
          // Validate phone number format
          const phoneRegex = /^\+[1-9]\d{1,14}$/;
          if (!phoneRegex.test(text)) {
            ctx.reply('Please send a valid phone number in international format (e.g., +1234567890):');
            return;
          }

          authData.phoneNumber = text;
          authData.step = 'code';
          this.pendingAuth.set(userId, authData);
          
          ctx.reply('Phone number received. Please send the verification code you received:');
        } else if (authData.step === 'code') {
          // In a real implementation, you would verify the code with Telegram
          // For now, we'll simulate successful authentication
          try {
            // Check if user exists
            let user = await this.userModel.getUserByPhoneNumber(authData.phoneNumber);
            
            if (!user) {
              // Create new user
              user = await this.userModel.createUser({
                id: userId,
                phoneNumber: authData.phoneNumber,
                isAuthenticated: true,
                keywords: [],
              });
            } else {
              // Update existing user
              await this.userModel.updateUser(userId, { isAuthenticated: true });
            }

            // Save auth session
            await this.userModel.saveAuthSession({
              userId: userId,
              phoneNumber: authData.phoneNumber,
              sessionString: '', // This would be the actual session string
              isActive: true,
            });

            this.pendingAuth.delete(userId);
            ctx.reply('✅ Authentication successful! You can now add keywords to monitor using /addkeyword');
          } catch (error) {
            logger.error('Authentication error:', error);
            ctx.reply('An error occurred during authentication. Please try again with /login');
            this.pendingAuth.delete(userId);
          }
        }
      }
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error('Bot error:', err);
      ctx.reply('An error occurred. Please try again.');
    });
  }

  async start(): Promise<void> {
    try {
      await this.bot.launch();
      logger.info('Telegram bot started successfully');
    } catch (error) {
      logger.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.bot.stop('SIGINT');
      logger.info('Telegram bot stopped');
    } catch (error) {
      logger.error('Error stopping Telegram bot:', error);
      throw error;
    }
  }

  async sendNotification(userId: number, message: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(userId, message);
    } catch (error) {
      logger.error(`Failed to send notification to user ${userId}:`, error);
    }
  }
}
