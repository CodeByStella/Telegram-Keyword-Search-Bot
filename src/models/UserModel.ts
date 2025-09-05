import { databaseService } from '../services/database';
import { User, AuthSession } from '../types';
import logger from '../utils/logger';

export class UserModel {
  async createUser(userData: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    if (!databaseService.users) {
      throw new Error('Database not connected');
    }

    const now = new Date();
    const user: User = {
      ...userData,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await databaseService.users.insertOne(user);
      logger.info(`User created: ${user.id}`);
      return user;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | null> {
    if (!databaseService.users) {
      throw new Error('Database not connected');
    }

    try {
      return await databaseService.users.findOne({ id });
    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
    if (!databaseService.users) {
      throw new Error('Database not connected');
    }

    try {
      return await databaseService.users.findOne({ phoneNumber });
    } catch (error) {
      logger.error('Failed to get user by phone number:', error);
      throw error;
    }
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User | null> {
    if (!databaseService.users) {
      throw new Error('Database not connected');
    }

    try {
      const result = await databaseService.users.findOneAndUpdate(
        { id },
        { ...updateData, updatedAt: new Date() },
        { returnDocument: 'after' }
      );
      return result;
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  async addKeyword(userId: number, keyword: string): Promise<boolean> {
    if (!databaseService.users) {
      throw new Error('Database not connected');
    }

    try {
      const result = await databaseService.users.updateOne(
        { id: userId },
        { 
          $addToSet: { keywords: keyword },
          $set: { updatedAt: new Date() }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to add keyword:', error);
      throw error;
    }
  }

  async removeKeyword(userId: number, keyword: string): Promise<boolean> {
    if (!databaseService.users) {
      throw new Error('Database not connected');
    }

    try {
      const result = await databaseService.users.updateOne(
        { id: userId },
        { 
          $pull: { keywords: keyword },
          $set: { updatedAt: new Date() }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to remove keyword:', error);
      throw error;
    }
  }

  async setNotificationChat(userId: number, chatId: number): Promise<boolean> {
    if (!databaseService.users) {
      throw new Error('Database not connected');
    }

    try {
      const result = await databaseService.users.updateOne(
        { id: userId },
        { 
          $set: { 
            notificationChatId: chatId,
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to set notification chat:', error);
      throw error;
    }
  }

  async saveAuthSession(sessionData: Omit<AuthSession, 'createdAt'>): Promise<void> {
    if (!databaseService.authSessions) {
      throw new Error('Database not connected');
    }

    try {
      await databaseService.authSessions.replaceOne(
        { userId: sessionData.userId },
        { ...sessionData, createdAt: new Date() },
        { upsert: true }
      );
      logger.info(`Auth session saved for user: ${sessionData.userId}`);
    } catch (error) {
      logger.error('Failed to save auth session:', error);
      throw error;
    }
  }

  async getAuthSession(userId: number): Promise<AuthSession | null> {
    if (!databaseService.authSessions) {
      throw new Error('Database not connected');
    }

    try {
      return await databaseService.authSessions.findOne({ userId });
    } catch (error) {
      logger.error('Failed to get auth session:', error);
      throw error;
    }
  }

  async getAllActiveUsers(): Promise<User[]> {
    if (!databaseService.users) {
      throw new Error('Database not connected');
    }

    try {
      return await databaseService.users.find({ isAuthenticated: true }).toArray();
    } catch (error) {
      logger.error('Failed to get active users:', error);
      throw error;
    }
  }
}
