import { KeywordMatchModel as KeywordMatchSchema, IKeywordMatch } from './KeywordMatchSchema';
import { KeywordMatch } from '../types';
import logger from '../utils/logger';

export class KeywordMatchModel {
  async createMatch(matchData: Omit<KeywordMatch, '_id' | 'timestamp'>): Promise<IKeywordMatch> {
    try {
      const match = new KeywordMatchSchema({
        ...matchData,
        timestamp: new Date(),
      });

      await match.save();
      logger.info(`Keyword match created for user ${match.userId}: "${match.keyword}"`);
      return match;
    } catch (error) {
      logger.error('Failed to create keyword match:', error);
      throw error;
    }
  }

  async getMatchesByUser(userId: string, limit: number = 50): Promise<IKeywordMatch[]> {
    try {
      return await KeywordMatchSchema
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get matches by user:', error);
      throw error;
    }
  }

  async getRecentMatches(limit: number = 100): Promise<IKeywordMatch[]> {
    try {
      return await KeywordMatchSchema
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get recent matches:', error);
      throw error;
    }
  }

  async getMatchesByKeyword(keyword: string, limit: number = 50): Promise<IKeywordMatch[]> {
    try {
      return await KeywordMatchSchema
        .find({ keyword })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get matches by keyword:', error);
      throw error;
    }
  }

  async getMatchesByCharacterLimit(maxLength: number, limit: number = 100): Promise<IKeywordMatch[]> {
    try {
      return await KeywordMatchSchema
        .find({ messageLength: { $lte: maxLength } })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get matches by character limit:', error);
      throw error;
    }
  }

  async getMatchesByUserAndCharacterLimit(userId: string, maxLength: number, limit: number = 50): Promise<IKeywordMatch[]> {
    try {
      return await KeywordMatchSchema
        .find({ 
          userId,
          messageLength: { $lte: maxLength }
        })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get matches by user and character limit:', error);
      throw error;
    }
  }

  async deleteOldMatches(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await KeywordMatchSchema.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      logger.info(`Deleted ${result.deletedCount} old keyword matches`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to delete old matches:', error);
      throw error;
    }
  }

  async getMatchStats(userId?: string, days: number = 7): Promise<{
    totalMatches: number;
    averageMessageLength: number;
    topKeywords: Array<{ keyword: string; count: number }>;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const query: any = { timestamp: { $gte: cutoffDate } };
      if (userId) {
        query.userId = userId;
      }

      const matches = await KeywordMatchSchema.find(query);
      
      const totalMatches = matches.length;
      const averageMessageLength = matches.length > 0 
        ? matches.reduce((sum, match) => sum + match.messageLength, 0) / matches.length 
        : 0;

      const keywordCounts: Record<string, number> = {};
      matches.forEach(match => {
        keywordCounts[match.keyword] = (keywordCounts[match.keyword] || 0) + 1;
      });

      const topKeywords = Object.entries(keywordCounts)
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalMatches,
        averageMessageLength: Math.round(averageMessageLength),
        topKeywords
      };
    } catch (error) {
      logger.error('Failed to get match stats:', error);
      return {
        totalMatches: 0,
        averageMessageLength: 0,
        topKeywords: []
      };
    }
  }
}
