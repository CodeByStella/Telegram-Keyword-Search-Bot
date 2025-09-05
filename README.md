# Telegram Keyword Search Bot

A powerful Telegram userbot + bot system that monitors Telegram groups for specific keywords and sends notifications when matches are found.

## Features

- 🔐 **User Authentication**: Login via phone number through the bot
- 🔍 **Keyword Monitoring**: Monitor multiple keywords across Telegram groups
- 🔔 **Real-time Notifications**: Get instant notifications when keywords are found
- 📊 **Statistics**: Track keyword matches and usage statistics
- 🗄️ **MongoDB Storage**: Persistent data storage for users and matches
- 🚀 **TypeScript**: Full TypeScript support with type safety
- 📝 **ESLint**: Code quality and consistency

## Prerequisites

- Node.js v22 or higher
- MongoDB database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Telegram API credentials (from [my.telegram.org](https://my.telegram.org))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd telegram-keyword-search-bot
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file:
```bash
cp env.example .env
```

4. Configure your environment variables in `.env`:
```env
# Telegram Bot Configuration
BOT_TOKEN=your_bot_token_here
API_ID=your_api_id_here
API_HASH=your_api_hash_here

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/telegram-keyword-bot

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info

# Session Configuration
SESSION_NAME=telegram_userbot_session
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Bot Commands

- `/start` - Show welcome message and help
- `/login` - Login with your phone number
- `/logout` - Logout from the bot
- `/addkeyword <keyword>` - Add a keyword to monitor
- `/removekeyword <keyword>` - Remove a keyword
- `/listkeywords` - List your monitored keywords
- `/setnotification <chat_id>` - Set notification chat
- `/status` - Check your status
- `/help` - Show help message

## How It Works

1. **User Registration**: Users send their phone number to the bot
2. **Authentication**: Bot handles phone verification and creates user session
3. **Keyword Setup**: Users add keywords they want to monitor
4. **Userbot Activation**: Userbot starts monitoring messages from all groups
5. **Keyword Detection**: When keywords are found, notifications are sent
6. **Data Storage**: All matches and user data are stored in MongoDB

## Project Structure

```
src/
├── config/          # Configuration files
├── models/          # Database models
├── services/        # Core services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Main application entry point
```

## Security Notes

- Keep your API credentials secure
- Use environment variables for sensitive data
- Regularly update dependencies
- Monitor logs for suspicious activity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details
