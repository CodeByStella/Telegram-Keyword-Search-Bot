import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { config } from '../config';
import { UserModel } from '../models/UserModel';
import logger from '../utils/logger';

export class TelegramAuthService {
  private userModel: UserModel;
  private pendingAuth: Map<number, {
    phoneNumber: string;
    step: 'phone' | 'code' | 'password';
    client?: TelegramClient;
  }> = new Map();

  constructor() {
    this.userModel = new UserModel();
  }

  async startAuthentication(telegramId: number, phoneNumber: string): Promise<boolean> {
    try {
      // Create a new client for this authentication session
      const client = new TelegramClient(
        new StringSession(''),
        config.apiId,
        config.apiHash,
        { connectionRetries: 5 }
      );

      // Store the authentication session
      this.pendingAuth.set(telegramId, {
        phoneNumber,
        step: 'phone',
        client
      });

      logger.info(`Started authentication for user ${telegramId} with phone ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`Failed to start authentication for user ${telegramId}:`, error);
      return false;
    }
  }

  async processPhoneCode(telegramId: number, code: string): Promise<{
    success: boolean;
    sessionString?: string;
    userId?: number;
    error?: string;
  }> {
    try {
      const authData = this.pendingAuth.get(telegramId);
      if (!authData || !authData.client) {
        return { success: false, error: 'No authentication session found' };
      }

      const client = authData.client;

      // Start the client with the phone number and code
      await client.start({
        phoneNumber: async () => authData.phoneNumber,
        phoneCode: async () => code,
        password: async () => {
          // If 2FA is enabled, we'll need to handle this
          authData.step = 'password';
          throw new Error('2FA_PASSWORD_REQUIRED');
        },
        onError: (err) => {
          logger.error(`Authentication error for user ${telegramId}:`, err);
          throw err;
        },
      });

      // Get user info
      const me = await client.getMe();
      const sessionString = client.session.save() as unknown as string;

      // Save the session to database
      await this.userModel.saveAuthSession({
        userId: telegramId.toString(),
        phoneNumber: authData.phoneNumber,
        sessionString,
        isActive: true,
      });

      // Update user authentication status
      await this.userModel.updateUser(telegramId, {
        isAuthenticated: true,
        sessionString,
      });

      // Clean up pending auth
      this.pendingAuth.delete(telegramId);

      logger.info(`User ${telegramId} authenticated successfully`);
      return {
        success: true,
        sessionString,
        userId: me.id.toJSNumber()
      };

    } catch (error: any) {
      logger.error(`Phone code authentication failed for user ${telegramId}:`, error);
      
      if (error.message === '2FA_PASSWORD_REQUIRED') {
        return { success: false, error: '2FA_PASSWORD_REQUIRED' };
      }
      
      return { success: false, error: error.message || 'Authentication failed' };
    }
  }

  async processPassword(telegramId: number, password: string): Promise<{
    success: boolean;
    sessionString?: string;
    userId?: number;
    error?: string;
  }> {
    try {
      const authData = this.pendingAuth.get(telegramId);
      if (!authData || !authData.client) {
        return { success: false, error: 'No authentication session found' };
      }

      const client = authData.client;

      // Continue authentication with password
      await client.start({
        phoneNumber: async () => authData.phoneNumber,
        phoneCode: async () => {
          throw new Error('Code already processed');
        },
        password: async () => password,
        onError: (err) => {
          logger.error(`Password authentication error for user ${telegramId}:`, err);
          throw err;
        },
      });

      // Get user info
      const me = await client.getMe();
      const sessionString = client.session.save() as unknown as string;

      // Save the session to database
      await this.userModel.saveAuthSession({
        userId: telegramId.toString(),
        phoneNumber: authData.phoneNumber,
        sessionString,
        isActive: true,
      });

      // Update user authentication status
      await this.userModel.updateUser(telegramId, {
        isAuthenticated: true,
        sessionString,
      });

      // Clean up pending auth
      this.pendingAuth.delete(telegramId);

      logger.info(`User ${telegramId} authenticated successfully with 2FA`);
      return {
        success: true,
        sessionString,
        userId: me.id.toJSNumber()
      };

    } catch (error: any) {
      logger.error(`Password authentication failed for user ${telegramId}:`, error);
      return { success: false, error: error.message || 'Password authentication failed' };
    }
  }

  async createAuthenticatedClient(telegramId: number): Promise<TelegramClient | null> {
    try {
      const authSession = await this.userModel.getAuthSession(telegramId.toString());
      if (!authSession || !authSession.sessionString) {
        return null;
      }

      const client = new TelegramClient(
        new StringSession(authSession.sessionString),
        config.apiId,
        config.apiHash,
        { connectionRetries: 5 }
      );

      await client.connect();
      return client;
    } catch (error) {
      logger.error(`Failed to create authenticated client for user ${telegramId}:`, error);
      return null;
    }
  }

  isAuthenticating(telegramId: number): boolean {
    return this.pendingAuth.has(telegramId);
  }

  getAuthStep(telegramId: number): 'phone' | 'code' | 'password' | null {
    const authData = this.pendingAuth.get(telegramId);
    return authData?.step || null;
  }

  cancelAuthentication(telegramId: number): void {
    const authData = this.pendingAuth.get(telegramId);
    if (authData?.client) {
      authData.client.disconnect().catch(() => {});
    }
    this.pendingAuth.delete(telegramId);
    logger.info(`Authentication cancelled for user ${telegramId}`);
  }
}
