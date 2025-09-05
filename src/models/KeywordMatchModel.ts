import { databaseService } from '../services/database';
import { KeywordMatch } from '../types';
import logger from '../utils/logger';

export class KeywordMatchModel {
  async createMatch(matchData: Omit<KeywordMatch, 'timestamp'>): Promise<KeywordMatch> {
    if (!databaseService.keywordMatches) {
      throw new Error('Database not connected');
    }

    const match: KeywordMatch = {
      ...matchData,
      timestamp: new Date(),
    };

    try {
      await databaseService.keywordMatches.insertOne(match);
      logger.info(`Keyword match created for user ${match.userId}: "${match.keyword}"`);
      return match;
    } catch (error) {
      logger.error('Failed to create keyword match:', error);
      throw error;
    }
  }

  async getMatchesByUser(userId: number, limit: number = 50): Promise<KeywordMatch[]> {
    if (!databaseService.keywordMatches) {
      throw new Error('Database not connected');
    }

    try {
      return await databaseService.keywordMatches
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Failed to get matches by user:', error);
      throw error;
    }
  }

  async getRecentMatches(limit: number = 100): Promise<KeywordMatch[]> {
    if (!databaseService.keywordMatches) {
      throw new Error('Database not connected');
    }

    try {
      return await databaseService.keywordMatches
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Failed to get recent matches:', error);
      throw error;
    }
  }

  async getMatchesByKeyword(keyword: string, limit: number = 50): Promise<KeywordMatch[]> {
    if (!databaseService.keywordMatches) {
      throw new Error('Database not connected');
    }

    try {
      return await databaseService.keywordMatches
        .find({ keyword })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Failed to get matches by keyword:', error);
      throw error;
    }
  }

  async deleteOldMatches(olderThanDays: number = 30): Promise<number> {
    if (!databaseService.keywordMatches) {
      throw new Error('Database not connected');
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await databaseService.keywordMatches.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      logger.info(`Deleted ${result.deletedCount} old keyword matches`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to delete old matches:', error);
      throw error;
    }
  }
}
