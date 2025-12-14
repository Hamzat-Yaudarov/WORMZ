import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://cherviton-production.up.railway.app';

// Инициализация бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Хранилище игровых серверов
const gameServers = new Map(); // Map<stake, GameServer[]>
const activePlayers = new Map(); // Map<playerId, GameServer>

// Класс игрового сервера
class GameServer {
  constructor(stake, maxPlayers = 20) {
    this.stake = stake;
    this.maxPlayers = maxPlayers;
    this.players = new Map(); // Map<playerId, Player>
    this.food = [];
    this.deadSnakes = [];
    this.id = Date.now() + Math.random();
    this.gameStarted = false;
    this.minPlayers = 8;
    
    // Генерация еды
    this.generateFood(500);
  }

  generateFood(count) {
    for (let i = 0; i < count; i++) {
      this.food.push({
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
        size: 5 + Math.random() * 3
      });
    }
  }
  
  // Поддержание количества еды
  maintainFood() {
    const targetFood = 500;
    while (this.food.length < targetFood) {
      this.food.push({
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
        size: 5 + Math.random() * 3
      });
    }
  }

  addPlayer(playerId, playerData) {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }

    const player = {
      id: playerId,
      name: playerData.name,
      stake: playerData.stake,
      usdt: playerData.stake,
      snake: {
        x: (Math.random() - 0.5) * 1000,
        y: (Math.random() - 0.5) * 1000,
        angle: Math.random() * Math.PI * 2,
        speed: 2,
        body: [],
        size: 20
      },
      color: playerData.color || this.getRandomColor(),
      lastUpdate: Date.now()
    };

    // Инициализация тела змейки
    for (let i = 0; i < 10; i++) {
      player.snake.body.push({
        x: player.snake.x - Math.cos(player.snake.angle) * i * 5,
        y: player.snake.y - Math.sin(player.snake.angle) * i * 5
      });
    }

    this.players.set(playerId, player);
    return true;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      // При удалении игрока, его змейка становится едой
      this.deadSnakes.push({
        x: player.snake.x,
        y: player.snake.y,
        body: player.snake.body,
        usdt: player.usdt,
        color: player.color
      });
    }
    this.players.delete(playerId);
  }

  updatePlayer(playerId, angle) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.snake.angle = angle;
    player.lastUpdate = Date.now();
  }

  update() {
    // Обновление позиций змеек
    for (const [playerId, player] of this.players) {
      const snake = player.snake;
      
      // Плавное изменение угла (как в оригинальном Slither.io)
      const targetAngle = snake.angle;
      const currentAngle = snake.angle;
      let angleDiff = targetAngle - currentAngle;
      
      // Нормализация угла
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // Скорость зависит от размера
      const speed = Math.max(1.5, 3 - (snake.size - 20) / 100);
      
      // Движение головы
      snake.x += Math.cos(snake.angle) * speed;
      snake.y += Math.sin(snake.angle) * speed;

      // Обновление тела (плавное следование)
      const bodyLength = Math.max(10, Math.floor(snake.size / 2));
      snake.body.unshift({ x: snake.x, y: snake.y });
      
      // Плавное движение сегментов тела
      for (let i = 1; i < snake.body.length; i++) {
        const prev = snake.body[i - 1];
        const curr = snake.body[i];
        const dx = prev.x - curr.x;
        const dy = prev.y - curr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const targetDist = bodyLength / snake.body.length;
        
        if (dist > targetDist) {
          const angle = Math.atan2(dy, dx);
          curr.x = prev.x - Math.cos(angle) * targetDist;
          curr.y = prev.y - Math.sin(angle) * targetDist;
        }
      }
      
      // Ограничение длины тела
      while (snake.body.length > bodyLength) {
        snake.body.pop();
      }

      // Проверка столкновений с границами (отскок)
      const boundary = 1500;
      if (snake.x < -boundary) {
        snake.x = -boundary;
        snake.angle = Math.PI - snake.angle;
      }
      if (snake.x > boundary) {
        snake.x = boundary;
        snake.angle = Math.PI - snake.angle;
      }
      if (snake.y < -boundary) {
        snake.y = -boundary;
        snake.angle = -snake.angle;
      }
      if (snake.y > boundary) {
        snake.y = boundary;
        snake.angle = -snake.angle;
      }

      // Проверка столкновений с едой
      for (let i = this.food.length - 1; i >= 0; i--) {
        const food = this.food[i];
        const dx = snake.x - food.x;
        const dy = snake.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < snake.size / 2 + food.size) {
          snake.size += 0.3;
          player.usdt += 0.01; // Небольшой бонус за еду
          this.food.splice(i, 1);
          // Добавляем новую еду
          this.food.push({
            x: (Math.random() - 0.5) * 3000,
            y: (Math.random() - 0.5) * 3000,
            size: 5 + Math.random() * 3
          });
        }
      }

      // Проверка столкновений с другими змейками
      for (const [otherId, other] of this.players) {
        if (otherId === playerId) continue;

        // Столкновение головы с головой
        const dx = snake.x - other.snake.x;
        const dy = snake.y - other.snake.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = snake.size / 2 + other.snake.size / 2;
        
        if (dist < minDist) {
          // Большая змейка убивает маленькую
          if (snake.size > other.snake.size * 1.15) {
            this.killPlayer(otherId, playerId);
            break;
          } else if (other.snake.size > snake.size * 1.15) {
            this.killPlayer(playerId, otherId);
            return;
          }
        }

        // Столкновение головы с телом другого игрока
        for (let i = 1; i < other.snake.body.length; i++) {
          const segment = other.snake.body[i];
          const dx = snake.x - segment.x;
          const dy = snake.y - segment.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const segmentSize = other.snake.size * (1 - i / other.snake.body.length * 0.5);
          
          if (dist < snake.size / 2 + segmentSize / 2) {
            this.killPlayer(playerId, otherId);
            return;
          }
        }
      }

      // Проверка столкновений с мертвыми змейками
      for (let i = this.deadSnakes.length - 1; i >= 0; i--) {
        const dead = this.deadSnakes[i];
        for (let j = 0; j < dead.body.length; j++) {
          const segment = dead.body[j];
          const dx = snake.x - segment.x;
          const dy = snake.y - segment.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const segmentSize = 8 * (1 - j / dead.body.length * 0.5);
          
          if (dist < snake.size / 2 + segmentSize / 2) {
            this.killPlayer(playerId);
            return;
          }
        }
      }

      // Сбор USDT с мертвых змеек
      for (let i = this.deadSnakes.length - 1; i >= 0; i--) {
        const dead = this.deadSnakes[i];
        const dx = snake.x - dead.x;
        const dy = snake.y - dead.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < snake.size / 2 + 25 && dead.usdt > 0) {
          const collectionRate = 0.5; // Скорость сбора
          const collected = Math.min(dead.usdt, collectionRate);
          player.usdt += collected;
          dead.usdt -= collected;
          
          if (dead.usdt <= 0.01) {
            this.deadSnakes.splice(i, 1);
          }
        }
      }
    }

    // Удаление старых мертвых змеек (через 30 секунд)
    const now = Date.now();
    this.deadSnakes = this.deadSnakes.filter(dead => {
      if (dead.timestamp && now - dead.timestamp > 30000) {
        return false;
      }
      return dead.usdt > 0.01;
    });
  }

  killPlayer(playerId, killerId = null) {
    const player = this.players.get(playerId);
    if (!player) return;

    // Создаем мертвую змейку с USDT
    this.deadSnakes.push({
      x: player.snake.x,
      y: player.snake.y,
      body: [...player.snake.body],
      usdt: player.usdt,
      color: player.color,
      timestamp: Date.now()
    });

    // Если есть убийца, он получает небольшой бонус
    if (killerId) {
      const killer = this.players.get(killerId);
      if (killer) {
        killer.usdt += player.usdt * 0.1; // 10% бонус за убийство
      }
    }

    this.players.delete(playerId);
  }

  getRandomColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#E74C3C'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getState() {
    return {
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        usdt: p.usdt,
        snake: p.snake,
        color: p.color
      })),
      food: this.food,
      deadSnakes: this.deadSnakes
    };
  }
}

// Получение или создание сервера для ставки
function getGameServer(stake) {
  if (!gameServers.has(stake)) {
    gameServers.set(stake, []);
  }

  const servers = gameServers.get(stake);
  
  // Ищем сервер с местом
  for (const server of servers) {
    if (server.players.size < server.maxPlayers && !server.gameStarted) {
      return server;
    }
  }

  // Создаем новый сервер
  const newServer = new GameServer(stake);
  servers.push(newServer);
  return newServer;
}

// WebSocket соединения
const connections = new Map(); // Map<ws, {playerId, server}>

wss.on('connection', (ws, req) => {
  // Подключение без логов

      ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'join') {
        const { playerId, playerData } = data;
        const stake = playerData.stake;
        
        const server = getGameServer(stake);
        if (server.addPlayer(playerId, playerData)) {
          connections.set(ws, { playerId, server });
          
          // Проверяем, можно ли начать игру
          if (server.players.size >= server.minPlayers && !server.gameStarted) {
            server.gameStarted = true;
            // Уведомляем всех игроков на сервере
            for (const [otherWs, otherConn] of connections) {
              if (otherConn.server === server && otherWs.readyState === 1) {
                otherWs.send(JSON.stringify({
                  type: 'gameStarted'
                }));
              }
            }
          }
          
          ws.send(JSON.stringify({
            type: 'joined',
            serverId: server.id,
            canStart: server.gameStarted,
            playersCount: server.players.size,
            minPlayers: server.minPlayers
          }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Server full' }));
        }
      } else if (data.type === 'update') {
        const conn = connections.get(ws);
        if (conn) {
          conn.server.updatePlayer(conn.playerId, data.angle);
        }
      } else if (data.type === 'leave') {
        const conn = connections.get(ws);
        if (conn) {
          conn.server.removePlayer(conn.playerId);
          connections.delete(ws);
        }
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      // Ошибка обработана, без логов
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
      }
    }
  });

  ws.on('close', () => {
    const conn = connections.get(ws);
    if (conn) {
      conn.server.removePlayer(conn.playerId);
      connections.delete(ws);
    }
  });
  
  ws.on('error', () => {
    // Ошибка обработана, без логов
    const conn = connections.get(ws);
    if (conn) {
      conn.server.removePlayer(conn.playerId);
      connections.delete(ws);
    }
  });
});

// Игровой цикл (60 FPS)
setInterval(() => {
  for (const servers of gameServers.values()) {
    for (const server of servers) {
      if (server.players.size > 0) {
        server.update();
        server.maintainFood();
        
        // Отправка состояния всем игрокам на сервере
        const state = server.getState();
        for (const [ws, conn] of connections) {
          if (conn.server === server) {
            try {
              if (ws.readyState === 1) { // WebSocket.OPEN
                ws.send(JSON.stringify({
                  type: 'state',
                  ...state
                }));
              }
            } catch (error) {
              // Соединение закрыто
            }
          }
        }
      }
    }
  }
}, 1000 / 60);

// API endpoints
app.get('/api/player/:userId', (req, res) => {
  const userId = req.params.userId;
  // Здесь можно получить данные игрока из БД
  // Пока возвращаем дефолтные значения
  res.json({
    userId,
    balance: 100, // Дефолтный баланс
    name: 'Player'
  });
});

// Telegram Bot команды
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🎮 Играть',
          web_app: { url: WEBAPP_URL }
        }
      ]]
    }
  };
  
  bot.sendMessage(chatId, '👋 Добро пожаловать в Slither.io MiniApp!\n\nНажмите кнопку ниже, чтобы начать игру.', options).catch(() => {
    // Ошибка отправки сообщения обработана
  });
});

// Обработка ошибок бота
bot.on('polling_error', () => {
  // Ошибка polling обработана
});

// Запуск сервера
server.listen(PORT, () => {
  // Сервер запущен
});
