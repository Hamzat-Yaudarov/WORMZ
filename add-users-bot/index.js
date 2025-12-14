import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('Ошибка: BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Хранилище чатов для каждого пользователя
const userChats = new Map(); // Map<userId, chatId>

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
🤖 <b>Бот для добавления пользователей в чаты/каналы</b>

<b>Команды:</b>
/setchat - Установить чат/канал для добавления пользователей
/add @username - Добавить пользователя по юзернейму
/add @user1 @user2 @user3 - Добавить несколько пользователей
/list - Показать текущий установленный чат
/help - Показать справку

<b>Как использовать:</b>
1. Сначала используйте /setchat в нужном чате/канале
2. Затем используйте /add @username для добавления пользователей

<b>Важно:</b>
- Бот должен быть администратором чата/канала
- У бота должны быть права на добавление участников
- Для каналов бот должен быть администратором
  `;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
📖 <b>Справка по использованию бота</b>

<b>1. Установка чата/канала:</b>
Отправьте команду /setchat в том чате или канале, куда хотите добавлять пользователей.

<b>2. Добавление пользователей:</b>
/add @username - добавить одного пользователя
/add @user1 @user2 @user3 - добавить несколько пользователей

<b>3. Проверка текущего чата:</b>
/list - показать текущий установленный чат

<b>Требования:</b>
✅ Бот должен быть администратором
✅ У бота должны быть права на добавление участников
✅ Пользователи должны существовать в Telegram
✅ Пользователи не должны блокировать бота

<b>Примеры:</b>
/add @john_doe
/add @alice @bob @charlie
  `;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

// Команда /setchat - установить чат для добавления
bot.onText(/\/setchat/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Проверяем, что команда отправлена в группе или канале
  if (msg.chat.type === 'private') {
    bot.sendMessage(
      chatId,
      '❌ Эта команда должна быть использована в группе или канале, куда вы хотите добавлять пользователей.\n\nОтправьте /setchat в нужном чате/канале.'
    );
    return;
  }

  try {
    // Проверяем, является ли бот администратором
    const chatMember = await bot.getChatMember(chatId, bot.token.split(':')[0]);
    
    // Получаем информацию о чате
    const chat = await bot.getChat(chatId);
    const chatTitle = chat.title || chat.username || `Chat ${chatId}`;
    const chatType = chat.type === 'channel' ? 'канал' : 'группу';

    // Сохраняем чат для пользователя
    userChats.set(userId, {
      chatId: chatId,
      chatTitle: chatTitle,
      chatType: chatType
    });

    bot.sendMessage(
      chatId,
      `✅ Чат установлен!\n\n📝 <b>${chatTitle}</b> (${chatType})\n\nТеперь вы можете использовать команду /add @username для добавления пользователей.`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    if (error.response?.body?.error_code === 400) {
      bot.sendMessage(
        chatId,
        '❌ Ошибка: Бот должен быть администратором этого чата/канала с правами на добавление участников.'
      );
    } else {
      bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  }
});

// Команда /list - показать текущий чат
bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const userChat = userChats.get(userId);
  
  if (!userChat) {
    bot.sendMessage(
      chatId,
      '❌ Чат не установлен. Используйте /setchat в нужном чате/канале.'
    );
    return;
  }

  bot.sendMessage(
    chatId,
    `📋 <b>Текущий установленный чат:</b>\n\n📝 ${userChat.chatTitle}\n🔹 Тип: ${userChat.chatType}\n🆔 ID: ${userChat.chatId}`,
    { parse_mode: 'HTML' }
  );
});

// Команда /add - добавить пользователей
bot.onText(/\/add (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Получаем установленный чат
  const userChat = userChats.get(userId);
  
  if (!userChat) {
    bot.sendMessage(
      chatId,
      '❌ Сначала установите чат командой /setchat в нужном чате/канале.'
    );
    return;
  }

  const usernames = match[1]
    .split(' ')
    .map(u => u.trim())
    .filter(u => u.startsWith('@'))
    .map(u => u.replace('@', ''));

  if (usernames.length === 0) {
    bot.sendMessage(
      chatId,
      '❌ Неверный формат. Используйте: /add @username или /add @user1 @user2 @user3'
    );
    return;
  }

  const targetChatId = userChat.chatId;
  let successCount = 0;
  let failCount = 0;
  const results = [];

  // Отправляем сообщение о начале процесса
  const statusMsg = await bot.sendMessage(
    chatId,
    `⏳ Добавление ${usernames.length} пользователя(ей)...`
  );

  // Добавляем каждого пользователя
  for (const username of usernames) {
    try {
      // Получаем информацию о пользователе по username
      const user = await bot.getChat(`@${username}`);
      
      if (!user || !user.id) {
        results.push(`❌ @${username} - пользователь не найден`);
        failCount++;
        continue;
      }

      const userIdToAdd = user.id;

      // Добавляем пользователя в чат
      try {
        await bot.addChatMember(targetChatId, userIdToAdd);
        results.push(`✅ @${username} - добавлен`);
        successCount++;
      } catch (addError) {
        if (addError.response?.body?.error_code === 400) {
          if (addError.response.body.description.includes('already')) {
            results.push(`⚠️ @${username} - уже в чате`);
          } else if (addError.response.body.description.includes('restricted')) {
            results.push(`❌ @${username} - пользователь ограничил добавление`);
          } else {
            results.push(`❌ @${username} - ${addError.response.body.description}`);
          }
        } else {
          results.push(`❌ @${username} - ошибка добавления`);
        }
        failCount++;
      }

      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      if (error.response?.body?.error_code === 400) {
        results.push(`❌ @${username} - пользователь не найден или не существует`);
      } else {
        results.push(`❌ @${username} - ошибка: ${error.message}`);
      }
      failCount++;
    }
  }

  // Формируем итоговое сообщение
  const resultMessage = `
📊 <b>Результаты добавления:</b>

✅ Успешно: ${successCount}
❌ Ошибок: ${failCount}

<b>Детали:</b>
${results.join('\n')}
  `;

  // Обновляем сообщение о статусе
  bot.editMessageText(resultMessage, {
    chat_id: statusMsg.chat.id,
    message_id: statusMsg.message_id,
    parse_mode: 'HTML'
  });
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('error', (error) => {
  console.error('Bot error:', error);
});

console.log('🤖 Бот запущен и готов к работе!');
console.log('Используйте /start для начала работы.');
