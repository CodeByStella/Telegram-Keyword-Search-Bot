#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Telegram Keyword Search Bot...');
console.log('📝 Make sure you have configured your .env file with the required credentials');
console.log('');

// Check if .env file exists
const fs = require('fs');
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  console.log('📋 Please copy env.example to .env and configure your credentials:');
  console.log('   cp env.example .env');
  console.log('');
  console.log('🔧 Required environment variables:');
  console.log('   - BOT_TOKEN (from @BotFather)');
  console.log('   - API_ID (from my.telegram.org)');
  console.log('   - API_HASH (from my.telegram.org)');
  console.log('   - MONGODB_URI (MongoDB connection string)');
  process.exit(1);
}

// Start the application
const child = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('error', (error) => {
  console.error('❌ Failed to start application:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Application exited with code ${code}`);
    process.exit(code);
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  child.kill('SIGTERM');
});
