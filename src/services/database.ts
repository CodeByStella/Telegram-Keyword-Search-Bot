import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '../config';
import logger from '../utils/logger';
import { User, KeywordMatch, AuthSession, NotificationSettings } from '../types';

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  // Collections
  public users: Collection<User> | null = null;
  public keywordMatches: Collection<KeywordMatch> | null = null;
  public authSessions: Collection<AuthSession> | null = null;
  public notificationSettings: Collection<NotificationSettings> | null = null;

  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(config.mongodbUri);
      await this.client.connect();
      this.db = this.client.db();
      
      // Initialize collections
      this.users = this.db.collection<User>('users');
      this.keywordMatches = this.db.collection<KeywordMatch>('keywordMatches');
      this.authSessions = this.db.collection<AuthSession>('authSessions');
      this.notificationSettings = this.db.collection<NotificationSettings>('notificationSettings');

      // Create indexes
      await this.createIndexes();
      
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      logger.info('Disconnected from MongoDB');
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // User indexes
      await this.users?.createIndex({ id: 1 }, { unique: true });
      await this.users?.createIndex({ phoneNumber: 1 }, { unique: true });

      // Keyword matches indexes
      await this.keywordMatches?.createIndex({ userId: 1 });
      await this.keywordMatches?.createIndex({ timestamp: -1 });
      await this.keywordMatches?.createIndex({ chatId: 1, messageId: 1 });

      // Auth sessions indexes
      await this.authSessions?.createIndex({ userId: 1 }, { unique: true });
      await this.authSessions?.createIndex({ phoneNumber: 1 });

      // Notification settings indexes
      await this.notificationSettings?.createIndex({ userId: 1 }, { unique: true });

      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Failed to create database indexes:', error);
      throw error;
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!this.client) return false;
      await this.client.db().admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const databaseService = new DatabaseService();
