import { UserModel } from '../models/UserModel';
import { KeywordMatchModel } from '../models/KeywordMatchModel';
import { MessageContext, KeywordMatch } from '../types';
import logger from '../utils/logger';

export class KeywordSearchService {
  private userModel: UserModel;
  private keywordMatchModel: KeywordMatchModel;

  constructor() {
    this.userModel = new UserModel();
    this.keywordMatchModel = new KeywordMatchModel();
  }

  async searchKeywordsInMessage(messageContext: MessageContext): Promise<KeywordMatch[]> {
    try {
      const activeUsers = await this.userModel.getAllActiveUsers();
      const matches: KeywordMatch[] = [];

      for (const user of activeUsers) {
        if (!user.keywords || user.keywords.length === 0) {
          continue;
        }

        const userMatches = await this.findUserKeywordMatches(user, messageContext);
        matches.push(...userMatches);
      }

      return matches;
    } catch (error) {
      logger.error('Error searching keywords in message:', error);
      return [];
    }
  }

  private async findUserKeywordMatches(user: any, messageContext: MessageContext): Promise<KeywordMatch[]> {
    const matches: KeywordMatch[] = [];
    const messageText = messageContext.text.toLowerCase();

    for (const keyword of user.keywords) {
      if (this.isKeywordMatch(messageText, keyword)) {
        const match: KeywordMatch = {
          userId: user.id,
          keyword,
          message: messageContext.text,
          chatId: messageContext.chatId,
          messageId: messageContext.messageId,
          timestamp: messageContext.timestamp,
          chatTitle: messageContext.chatTitle,
          senderName: messageContext.senderName,
        };

        // Save the match to database
        try {
          await this.keywordMatchModel.createMatch(match);
          matches.push(match);
          logger.info(`Keyword match found: "${keyword}" for user ${user.id}`);
        } catch (error) {
          logger.error(`Failed to save keyword match for user ${user.id}:`, error);
        }
      }
    }

    return matches;
  }

  private isKeywordMatch(messageText: string, keyword: string): boolean {
    const normalizedKeyword = keyword.toLowerCase().trim();
    
    // Exact match
    if (messageText.includes(normalizedKeyword)) {
      return true;
    }

    // Word boundary match (more precise)
    const wordBoundaryRegex = new RegExp(`\\b${this.escapeRegex(normalizedKeyword)}\\b`, 'i');
    if (wordBoundaryRegex.test(messageText)) {
      return true;
    }

    // Partial match for compound keywords
    const keywordWords = normalizedKeyword.split(/\s+/);
    if (keywordWords.length > 1) {
      const allWordsPresent = keywordWords.every(word => 
        messageText.includes(word) || new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i').test(messageText)
      );
      if (allWordsPresent) {
        return true;
      }
    }

    return false;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async getUserKeywordStats(userId: number, days: number = 7): Promise<{
    totalMatches: number;
    keywordCounts: Record<string, number>;
    recentMatches: KeywordMatch[];
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const matches = await this.keywordMatchModel.getMatchesByUser(userId, 1000);
      const recentMatches = matches.filter(match => match.timestamp >= cutoffDate);

      const keywordCounts: Record<string, number> = {};
      recentMatches.forEach(match => {
        keywordCounts[match.keyword] = (keywordCounts[match.keyword] || 0) + 1;
      });

      return {
        totalMatches: recentMatches.length,
        keywordCounts,
        recentMatches: recentMatches.slice(0, 10), // Last 10 matches
      };
    } catch (error) {
      logger.error(`Error getting keyword stats for user ${userId}:`, error);
      return {
        totalMatches: 0,
        keywordCounts: {},
        recentMatches: [],
      };
    }
  }

  async getGlobalKeywordStats(days: number = 7): Promise<{
    totalMatches: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    activeUsers: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const matches = await this.keywordMatchModel.getRecentMatches(10000);
      const recentMatches = matches.filter(match => match.timestamp >= cutoffDate);

      const keywordCounts: Record<string, number> = {};
      const userIds = new Set<number>();

      recentMatches.forEach(match => {
        keywordCounts[match.keyword] = (keywordCounts[match.keyword] || 0) + 1;
        userIds.add(match.userId);
      });

      const topKeywords = Object.entries(keywordCounts)
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalMatches: recentMatches.length,
        topKeywords,
        activeUsers: userIds.size,
      };
    } catch (error) {
      logger.error('Error getting global keyword stats:', error);
      return {
        totalMatches: 0,
        topKeywords: [],
        activeUsers: 0,
      };
    }
  }

  async cleanupOldMatches(olderThanDays: number = 30): Promise<number> {
    try {
      return await this.keywordMatchModel.deleteOldMatches(olderThanDays);
    } catch (error) {
      logger.error('Error cleaning up old matches:', error);
      return 0;
    }
  }
}
