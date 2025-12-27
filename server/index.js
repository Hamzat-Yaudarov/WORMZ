import express from 'express';
import { Telegraf } from 'telegraf';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database.js';
import { handleStartCommand } from './commands/start.js';
import { getGameState, saveGameState } from './gameHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000';
const MINIAPP_URL = process.env.WEBAPP_URL || process.env.MINIAPP_URL || 'http://localhost:5173';

if (!TOKEN) {
  throw new Error('BOT_TOKEN не установлен в переменных окружения');
}

// Инициализация базы данных
await initializeDatabase();

// Создание бота
const bot = new Telegraf(TOKEN);

// Middleware
app.use(cors());
app.use(express.json());

// Telegram команды
bot.start((ctx) => handleStartCommand(ctx, MINIAPP_URL));

bot.command('game', (ctx) => {
  ctx.reply('🎮 Нажми на кнопку ниже, чтобы начать игру!', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎯 Играть в Influence',
            web_app: { url: `${MINIAPP_URL}/game` }
          }
        ]
      ]
    }
  });
});

// API эндпоинты для игры
app.get('/api/game/:userId', (req, res) => {
  const { userId } = req.params;
  const gameState = getGameState(userId);
  res.json(gameState);
});

app.post('/api/game/:userId/move', (req, res) => {
  const { userId } = req.params;
  const { action } = req.body;
  
  const updatedState = saveGameState(userId, action);
  res.json(updatedState);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Сервирование статических файлов React приложения
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// SPA routing - отправить index.html для всех не-API маршрутов
app.get('*', (req, res) => {
  // API маршруты уже обработаны выше
  // Для всех остальных маршрутов (включая /game, /rules) отправляем index.html
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🤖 Telegram бот активен`);
  console.log(`🎮 WebApp URL: ${MINIAPP_URL}`);
});

// Запуск бота (polling режим для разработки)
bot.launch();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
