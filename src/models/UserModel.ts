import { UserModel as UserSchema, IUser } from './UserSchema';
import { AuthSessionModel, IAuthSession } from './AuthSessionSchema';
import { User, AuthSession } from '../types';
import logger from '../utils/logger';

export class UserModel {
  async createUser(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
    try {
      const user = new UserSchema({
        ...userData,
        characterLimit: userData.characterLimit || 100,
        notificationGroups: userData.notificationGroups || [],
        isActive: true
      });
      
      await user.save();
      logger.info(`User created: ${user.telegramId}`);
      return user;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async getUserByTelegramId(telegramId: number): Promise<IUser | null> {
    try {
      return await UserSchema.findOne({ telegramId });
    } catch (error) {
      logger.error('Failed to get user by Telegram ID:', error);
      throw error;
    }
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<IUser | null> {
    try {
      return await UserSchema.findOne({ phoneNumber });
    } catch (error) {
      logger.error('Failed to get user by phone number:', error);
      throw error;
    }
  }

  async updateUser(telegramId: number, updateData: Partial<User>): Promise<IUser | null> {
    try {
      return await UserSchema.findOneAndUpdate(
        { telegramId },
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  async addKeyword(telegramId: number, keyword: string): Promise<boolean> {
    try {
      const result = await UserSchema.updateOne(
        { telegramId },
        { $addToSet: { keywords: keyword } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to add keyword:', error);
      throw error;
    }
  }

  async removeKeyword(telegramId: number, keyword: string): Promise<boolean> {
    try {
      const result = await UserSchema.updateOne(
        { telegramId },
        { $pull: { keywords: keyword } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to remove keyword:', error);
      throw error;
    }
  }

  async setCharacterLimit(telegramId: number, characterLimit: number): Promise<boolean> {
    try {
      const result = await UserSchema.updateOne(
        { telegramId },
        { characterLimit: Math.max(1, Math.min(1000, characterLimit)) }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to set character limit:', error);
      throw error;
    }
  }

  async addNotificationGroup(telegramId: number, groupId: number): Promise<boolean> {
    try {
      const result = await UserSchema.updateOne(
        { telegramId },
        { $addToSet: { notificationGroups: groupId } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to add notification group:', error);
      throw error;
    }
  }

  async removeNotificationGroup(telegramId: number, groupId: number): Promise<boolean> {
    try {
      const result = await UserSchema.updateOne(
        { telegramId },
        { $pull: { notificationGroups: groupId } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to remove notification group:', error);
      throw error;
    }
  }

  async setNotificationGroups(telegramId: number, groups: number[]): Promise<boolean> {
    try {
      const result = await UserSchema.updateOne(
        { telegramId },
        { notificationGroups: groups }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to set notification groups:', error);
      throw error;
    }
  }

  async saveAuthSession(sessionData: Omit<AuthSession, '_id' | 'createdAt'>): Promise<void> {
    try {
      await AuthSessionModel.findOneAndUpdate(
        { userId: sessionData.userId },
        sessionData,
        { upsert: true, new: true }
      );
      logger.info(`Auth session saved for user: ${sessionData.userId}`);
    } catch (error) {
      logger.error('Failed to save auth session:', error);
      throw error;
    }
  }

  async getAuthSession(userId: string): Promise<IAuthSession | null> {
    try {
      return await AuthSessionModel.findOne({ userId });
    } catch (error) {
      logger.error('Failed to get auth session:', error);
      throw error;
    }
  }

  async getAllActiveUsers(): Promise<IUser[]> {
    try {
      return await UserSchema.find({ 
        isAuthenticated: true, 
        isActive: true 
      });
    } catch (error) {
      logger.error('Failed to get active users:', error);
      throw error;
    }
  }

  async getUserKeywords(telegramId: number): Promise<string[]> {
    try {
      const user = await UserSchema.findOne({ telegramId });
      return user?.keywords || [];
    } catch (error) {
      logger.error('Failed to get user keywords:', error);
      throw error;
    }
  }

  async getUserSettings(telegramId: number): Promise<{
    keywords: string[];
    characterLimit: number;
    notificationGroups: number[];
  } | null> {
    try {
      const user = await UserSchema.findOne({ telegramId });
      if (!user) return null;
      
      return {
        keywords: user.keywords,
        characterLimit: user.characterLimit,
        notificationGroups: user.notificationGroups
      };
    } catch (error) {
      logger.error('Failed to get user settings:', error);
      throw error;
    }
  }
}
