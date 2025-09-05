import { validateConfig } from './config';
import { databaseService } from './services/database';
import { TelegramBotService } from './services/TelegramBot';
import { TelegramUserbotService } from './services/TelegramUserbot';
import { KeywordSearchService } from './services/KeywordSearchService';
import logger from './utils/logger';

class Application {
  private botService: TelegramBotService;
  private userbotService: TelegramUserbotService;
  private keywordSearchService: KeywordSearchService;
  private isShuttingDown: boolean = false;

  constructor() {
    this.botService = new TelegramBotService();
    this.userbotService = new TelegramUserbotService(this.botService);
    this.keywordSearchService = new KeywordSearchService();
  }

  async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();
      logger.info('Configuration validated successfully');

      // Connect to database
      await databaseService.connect();
      logger.info('Database connected successfully');

      // Start Telegram bot
      await this.botService.start();
      logger.info('Telegram bot started successfully');

      // Start userbot (this will be started when users authenticate)
      logger.info('Userbot ready to start when users authenticate');

      // Setup cleanup interval
      this.setupCleanupInterval();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Application started successfully');
    } catch (error) {
      logger.error('Failed to start application:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down application...');

    try {
      // Stop userbot
      if (this.userbotService.isUserbotRunning()) {
        await this.userbotService.stop();
        logger.info('Userbot stopped');
      }

      // Stop bot
      await this.botService.stop();
      logger.info('Bot stopped');

      // Disconnect from database
      await databaseService.disconnect();
      logger.info('Database disconnected');

      logger.info('Application stopped successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }

  private setupCleanupInterval(): void {
    // Clean up old keyword matches every 24 hours
    setInterval(async () => {
      try {
        const deletedCount = await this.keywordSearchService.cleanupOldMatches(30);
        if (deletedCount > 0) {
          logger.info(`Cleaned up ${deletedCount} old keyword matches`);
        }
      } catch (error) {
        logger.error('Error during cleanup:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.stop().then(() => process.exit(1));
    });
  }
}

// Start the application
const app = new Application();

app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default app;
