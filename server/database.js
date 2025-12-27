import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db = null;

export async function initializeDatabase() {
  try {
    db = await open({
      filename: './data/game.db',
      driver: sqlite3.Database
    });

    // Создать таблицы если их нет
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        telegram_id INTEGER UNIQUE,
        username TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_stats (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        total_games INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS game_history (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        player_score INTEGER,
        opponent_score INTEGER,
        result TEXT,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
    process.exit(1);
  }
}

export async function getUserStats(telegramId) {
  try {
    const user = await db.get('SELECT id FROM users WHERE telegram_id = ?', telegramId);
    
    if (!user) {
      return null;
    }

    const stats = await db.get('SELECT * FROM game_stats WHERE user_id = ?', user.id);
    return stats;
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    return null;
  }
}

export async function saveGameResult(telegramId, playerScore, opponentScore) {
  try {
    const user = await db.get('SELECT id FROM users WHERE telegram_id = ?', telegramId);
    
    if (!user) {
      // Создать пользователя
      await db.run('INSERT INTO users (telegram_id) VALUES (?)', telegramId);
      const newUser = await db.get('SELECT id FROM users WHERE telegram_id = ?', telegramId);
      
      await db.run(
        'INSERT INTO game_stats (user_id) VALUES (?)',
        newUser.id
      );
      
      await saveGameResult(telegramId, playerScore, opponentScore);
      return;
    }

    const result = playerScore > opponentScore ? 'win' : 'loss';
    
    // Сохранить результат игры
    await db.run(
      'INSERT INTO game_history (user_id, player_score, opponent_score, result) VALUES (?, ?, ?, ?)',
      user.id,
      playerScore,
      opponentScore,
      result
    );

    // Обновить статистику
    const stats = await db.get('SELECT * FROM game_stats WHERE user_id = ?', user.id);
    const newWins = stats.wins + (result === 'win' ? 1 : 0);
    const newLosses = stats.losses + (result === 'loss' ? 1 : 0);
    const newTotal = stats.total_games + 1;
    const newPoints = stats.total_points + playerScore;

    await db.run(
      'UPDATE game_stats SET wins = ?, losses = ?, total_games = ?, total_points = ? WHERE user_id = ?',
      newWins,
      newLosses,
      newTotal,
      newPoints,
      user.id
    );

    return { result, wins: newWins, losses: newLosses, totalGames: newTotal };
  } catch (error) {
    console.error('Ошибка сохранения результата:', error);
    return null;
  }
}

export function getDatabase() {
  return db;
}
