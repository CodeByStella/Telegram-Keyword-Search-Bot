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

📋 Commands:
/start - Show this help message
/login - Login with your phone number
/logout - Logout from the bot

🔍 Keyword Management:
/addkeyword <keyword> - Add a keyword to monitor
/removekeyword <keyword> - Remove a keyword
/listkeywords - List your monitored keywords

⚙️ Settings:
/setlimit <number> - Set character limit for monitoring (1-1000)
/addgroup <group_id> - Add notification group
/removegroup <group_id> - Remove notification group
/listgroups - List notification groups
/setgroups <group_id1,group_id2,...> - Set multiple notification groups

📊 Status:
/status - Check your status
/stats - View keyword match statistics
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
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
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
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
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
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
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
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const success = await this.userModel.setNotificationGroups(ctx.from.id, [Number(chatId)]);
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

    // Set character limit command
    this.bot.command('setlimit', async (ctx) => {
      const limit = parseInt(ctx.message.text.split(' ')[1]);
      if (!limit || isNaN(limit) || limit < 1 || limit > 1000) {
        ctx.reply('Please provide a valid character limit between 1 and 1000. Usage: /setlimit <number>');
        return;
      }

      try {
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const success = await this.userModel.setCharacterLimit(ctx.from.id, limit);
        if (success) {
          ctx.reply(`Character limit set to ${limit} characters. Only messages with ${limit} characters or less will be monitored.`);
        } else {
          ctx.reply('Failed to set character limit. Please try again.');
        }
      } catch (error) {
        logger.error('Set limit error:', error);
        ctx.reply('An error occurred while setting character limit. Please try again.');
      }
    });

    // Add notification group command
    this.bot.command('addgroup', async (ctx) => {
      const groupId = parseInt(ctx.message.text.split(' ')[1]);
      if (!groupId || isNaN(groupId)) {
        ctx.reply('Please provide a valid group ID. Usage: /addgroup <group_id>');
        return;
      }

      try {
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const success = await this.userModel.addNotificationGroup(ctx.from.id, groupId);
        if (success) {
          ctx.reply(`Notification group ${groupId} added successfully!`);
        } else {
          ctx.reply(`Group ${groupId} is already in your notification list.`);
        }
      } catch (error) {
        logger.error('Add group error:', error);
        ctx.reply('An error occurred while adding notification group. Please try again.');
      }
    });

    // Remove notification group command
    this.bot.command('removegroup', async (ctx) => {
      const groupId = parseInt(ctx.message.text.split(' ')[1]);
      if (!groupId || isNaN(groupId)) {
        ctx.reply('Please provide a valid group ID. Usage: /removegroup <group_id>');
        return;
      }

      try {
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const success = await this.userModel.removeNotificationGroup(ctx.from.id, groupId);
        if (success) {
          ctx.reply(`Notification group ${groupId} removed successfully!`);
        } else {
          ctx.reply(`Group ${groupId} was not found in your notification list.`);
        }
      } catch (error) {
        logger.error('Remove group error:', error);
        ctx.reply('An error occurred while removing notification group. Please try again.');
      }
    });

    // List notification groups command
    this.bot.command('listgroups', async (ctx) => {
      try {
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        if (user.notificationGroups.length === 0) {
          ctx.reply('You have no notification groups configured. Use /addgroup to add some.');
          return;
        }

        const groupsList = user.notificationGroups.map((groupId, index) => `${index + 1}. ${groupId}`).join('\n');
        ctx.reply(`Your notification groups:\n\n${groupsList}`);
      } catch (error) {
        logger.error('List groups error:', error);
        ctx.reply('An error occurred while fetching your notification groups. Please try again.');
      }
    });

    // Set multiple notification groups command
    this.bot.command('setgroups', async (ctx) => {
      const groupsText = ctx.message.text.split(' ').slice(1).join(' ');
      if (!groupsText) {
        ctx.reply('Please provide group IDs separated by commas. Usage: /setgroups <group_id1,group_id2,...>');
        return;
      }

      try {
        const groupIds = groupsText.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (groupIds.length === 0) {
          ctx.reply('Please provide valid group IDs separated by commas.');
          return;
        }

        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const success = await this.userModel.setNotificationGroups(ctx.from.id, groupIds);
        if (success) {
          ctx.reply(`Notification groups set to: ${groupIds.join(', ')}`);
        } else {
          ctx.reply('Failed to set notification groups. Please try again.');
        }
      } catch (error) {
        logger.error('Set groups error:', error);
        ctx.reply('An error occurred while setting notification groups. Please try again.');
      }
    });

    // Stats command
    this.bot.command('stats', async (ctx) => {
      try {
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
        if (!user || !user.isAuthenticated) {
          ctx.reply('Please login first using /login');
          return;
        }

        const stats = await this.keywordMatchModel.getMatchStats(user._id!.toString(), 7);
        const settings = await this.userModel.getUserSettings(ctx.from.id);

        const statsMessage = `
📊 Your Statistics (Last 7 days):

🔍 Total Matches: ${stats.totalMatches}
📏 Average Message Length: ${stats.averageMessageLength} chars
⚙️ Character Limit: ${settings?.characterLimit || 100} chars
📝 Keywords: ${settings?.keywords.length || 0}
🔔 Notification Groups: ${settings?.notificationGroups.length || 0}

🏆 Top Keywords:
${stats.topKeywords.slice(0, 5).map((item, index) => `${index + 1}. ${item.keyword} (${item.count})`).join('\n') || 'No matches yet'}
        `;

        ctx.reply(statsMessage);
      } catch (error) {
        logger.error('Stats error:', error);
        ctx.reply('An error occurred while fetching statistics. Please try again.');
      }
    });

    // Status command
    this.bot.command('status', async (ctx) => {
      try {
        const user = await this.userModel.getUserByTelegramId(ctx.from.id);
        if (!user) {
          ctx.reply('You are not registered. Use /login to get started.');
          return;
        }

        const status = user.isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated';
        const keywordsCount = user.keywords.length;
        const groupsCount = user.notificationGroups.length;
        const characterLimit = user.characterLimit;

        const statusMessage = `
📊 Your Status:
${status}
📝 Monitored keywords: ${keywordsCount}
⚙️ Character limit: ${characterLimit} chars
🔔 Notification groups: ${groupsCount}

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
                telegramId: userId,
                phoneNumber: authData.phoneNumber,
                isAuthenticated: true,
                keywords: [],
                characterLimit: 100,
                notificationGroups: [],
                isActive: true,
              });
            } else {
              // Update existing user
              await this.userModel.updateUser(user.telegramId, { isAuthenticated: true });
            }

            // Save auth session
            await this.userModel.saveAuthSession({
              userId: user._id!.toString(),
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
