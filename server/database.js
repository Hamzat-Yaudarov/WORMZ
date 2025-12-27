import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

export async function initializeDatabase() {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.warn('⚠️  DATABASE_URL не установлен, используется in-memory БД');
      return;
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Проверить соединение
    const client = await pool.connect();
    console.log('✅ Подключено к PostgreSQL (Neon)');
    client.release();

    // Создать таблицы если их нет
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        username TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        total_games INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        player_score INTEGER,
        opponent_score INTEGER,
        result TEXT,
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Таблицы инициализированы');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error.message);
    // Не критично - игра будет работать без БД
  }
}

export async function getUserStats(telegramId) {
  try {
    if (!pool) return null;

    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const userId = userResult.rows[0].id;
    const statsResult = await pool.query(
      'SELECT * FROM game_stats WHERE user_id = $1',
      [userId]
    );

    return statsResult.rows[0] || null;
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    return null;
  }
}

export async function saveGameResult(telegramId, playerScore, opponentScore) {
  try {
    if (!pool) {
      console.log('БД недоступна, результат не сохранён');
      return null;
    }

    // Получить или создать пользователя
    let userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    let userId;

    if (userResult.rows.length === 0) {
      // Создать пользователя
      const createResult = await pool.query(
        'INSERT INTO users (telegram_id) VALUES ($1) RETURNING id',
        [telegramId]
      );
      userId = createResult.rows[0].id;

      // Создать статистику
      await pool.query(
        'INSERT INTO game_stats (user_id) VALUES ($1)',
        [userId]
      );
    } else {
      userId = userResult.rows[0].id;
    }

    const result = playerScore > opponentScore ? 'win' : 'loss';

    // Сохранить результат игры
    await pool.query(
      'INSERT INTO game_history (user_id, player_score, opponent_score, result) VALUES ($1, $2, $3, $4)',
      [userId, playerScore, opponentScore, result]
    );

    // Обновить статистику
    const statsResult = await pool.query(
      'SELECT * FROM game_stats WHERE user_id = $1',
      [userId]
    );

    const stats = statsResult.rows[0];
    const newWins = stats.wins + (result === 'win' ? 1 : 0);
    const newLosses = stats.losses + (result === 'loss' ? 1 : 0);
    const newTotal = stats.total_games + 1;
    const newPoints = stats.total_points + playerScore;

    await pool.query(
      'UPDATE game_stats SET wins = $1, losses = $2, total_games = $3, total_points = $4 WHERE user_id = $5',
      [newWins, newLosses, newTotal, newPoints, userId]
    );

    return { result, wins: newWins, losses: newLosses, totalGames: newTotal };
  } catch (error) {
    console.error('Ошибка сохранения результата:', error);
    return null;
  }
}

export function getDatabase() {
  return pool;
}
