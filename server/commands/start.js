export async function handleStartCommand(ctx, miniAppUrl) {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'Игрок';

  await ctx.reply(
    `👋 Добро пожаловать, ${userName}!\n\n🎮 Я - бот для игры Influence (Влияние).\n\nЭто стратегическая игра, где ты должен захватить как можно больше точек противника!\n\n🕹️ Нажми на кнопку ниже, чтобы начать игру:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎯 Играть в Influence',
              web_app: { url: `${miniAppUrl}/game` }
            }
          ],
          [
            {
              text: '📖 Правила',
              web_app: { url: `${miniAppUrl}/rules` }
            }
          ]
        ]
      }
    }
  );

  console.log(`✅ Новый пользователь: ${userName} (${userId})`);
}
