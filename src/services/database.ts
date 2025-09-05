import mongoose from 'mongoose';
import { config } from '../config';
import logger from '../utils/logger';

class DatabaseService {
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    try {
      await mongoose.connect(config.mongodbUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      this.isConnected = true;
      logger.info('Connected to MongoDB successfully with Mongoose');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  async isDbConnected(): Promise<boolean> {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  async getConnectionStatus(): Promise<string> {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[mongoose.connection.readyState as keyof typeof states] || 'unknown';
  }
}

export const databaseService = new DatabaseService();
