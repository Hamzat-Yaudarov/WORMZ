const gameStates = new Map();

export function initializeGameState(userId) {
  const gameState = {
    userId,
    board: createInitialBoard(),
    playerScore: 0,
    opponentScore: 0,
    moves: [],
    status: 'active'
  };
  
  gameStates.set(userId, gameState);
  return gameState;
}

export function getGameState(userId) {
  if (!gameStates.has(userId)) {
    return initializeGameState(userId);
  }
  return gameStates.get(userId);
}

export function saveGameState(userId, action) {
  const gameState = getGameState(userId);
  
  // Обновить состояние на основе действия
  if (action && action.x !== undefined && action.y !== undefined) {
    const cell = gameState.board[action.y][action.x];
    if (cell && cell.owner !== 'player') {
      cell.owner = 'player';
      gameState.playerScore++;
    }
  }
  
  gameStates.set(userId, gameState);
  return gameState;
}

function createInitialBoard() {
  const size = 5;
  const board = [];
  
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      let owner = null;
      
      // Начальные позиции
      if (y === 0 && x === 0) owner = 'player';
      if (y === size - 1 && x === size - 1) owner = 'opponent';
      
      row.push({
        x,
        y,
        owner,
        strength: Math.floor(Math.random() * 3) + 1
      });
    }
    board.push(row);
  }
  
  return board;
}

export function getBotMove(gameState) {
  // Простая AI для противника
  const board = gameState.board;
  const availableMoves = [];
  
  board.forEach(row => {
    row.forEach(cell => {
      if (cell.owner !== 'opponent') {
        availableMoves.push(cell);
      }
    });
  });
  
  if (availableMoves.length === 0) return null;
  
  // Выбрать случайный ход
  const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
  move.owner = 'opponent';
  gameState.opponentScore++;
  
  return move;
}
