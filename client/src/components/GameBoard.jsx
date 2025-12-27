import { useState, useEffect } from 'react'
import GameGrid from './GameGrid'
import GameStats from './GameStats'
import '../styles/GameBoard.css'

function GameBoard({ userId, onBackClick }) {
  const [gameState, setGameState] = useState(null)
  const [gameActive, setGameActive] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Инициализировать игрул
    const initialBoard = createInitialBoard()
    setGameState({
      userId,
      board: initialBoard,
      playerScore: 1,
      opponentScore: 1,
      moves: [],
      status: 'active'
    })
    setLoading(false)
  }, [userId])

  function createInitialBoard() {
    const size = 5
    const board = []
    
    for (let y = 0; y < size; y++) {
      const row = []
      for (let x = 0; x < size; x++) {
        let owner = null
        
        if (y === 0 && x === 0) owner = 'player'
        if (y === size - 1 && x === size - 1) owner = 'opponent'
        
        row.push({
          x,
          y,
          owner,
          strength: Math.floor(Math.random() * 3) + 1
        })
      }
      board.push(row)
    }
    
    return board
  }

  function handleCellClick(x, y) {
    if (!gameActive || !gameState) return

    const cell = gameState.board[y][x]
    
    // Нельзя захватить свои клетки
    if (cell.owner === 'player') return

    // Упрощённая механика: всегда захватываем
    const newBoard = gameState.board.map(row => [...row])
    newBoard[y][x].owner = 'player'

    const newState = {
      ...gameState,
      board: newBoard,
      playerScore: gameState.playerScore + (cell.owner === null ? 1 : 1),
      moves: [...gameState.moves, { x, y }]
    }

    // AI противника делает ход
    const botMove = getBotMove(newBoard)
    if (botMove) {
      newBoard[botMove.y][botMove.x].owner = 'opponent'
      newState.opponentScore += 1
    }

    // Проверить конец игры
    const gameContinues = checkGameContinues(newBoard)
    if (!gameContinues) {
      setGameActive(false)
      newState.status = 'finished'
    }

    setGameState(newState)
  }

  function getBotMove(board) {
    const availableMoves = []
    
    board.forEach(row => {
      row.forEach(cell => {
        if (cell.owner !== 'opponent') {
          availableMoves.push(cell)
        }
      })
    })
    
    if (availableMoves.length === 0) return null
    
    return availableMoves[Math.floor(Math.random() * availableMoves.length)]
  }

  function checkGameContinues(board) {
    const available = board.flat().some(cell => cell.owner !== 'player' && cell.owner !== 'opponent')
    return available
  }

  function handleNewGame() {
    const initialBoard = createInitialBoard()
    setGameState({
      userId,
      board: initialBoard,
      playerScore: 1,
      opponentScore: 1,
      moves: [],
      status: 'active'
    })
    setGameActive(true)
  }

  if (loading) {
    return <div className="game-board loading">Загрузка игры...</div>
  }

  const playerWins = gameState.playerScore > gameState.opponentScore
  const gameEnded = gameState.status === 'finished'

  return (
    <div className="game-board">
      <div className="game-header">
        <button className="btn-back" onClick={onBackClick}>
          ← Меню
        </button>
        <h1>⚔️ Influence</h1>
        <div className="spacer"></div>
      </div>

      <GameStats 
        playerScore={gameState.playerScore}
        opponentScore={gameState.opponentScore}
      />

      <GameGrid 
        board={gameState.board}
        onCellClick={handleCellClick}
        gameActive={gameActive}
      />

      {gameEnded && (
        <div className="game-over">
          <h2>
            {playerWins ? '🎉 Ты выиграл!' : '😔 Ты проиграл'}
          </h2>
          <p className="final-score">
            Твой счёт: {gameState.playerScore} | Противник: {gameState.opponentScore}
          </p>
          <button className="btn btn-primary" onClick={handleNewGame}>
            🔄 Новая игра
          </button>
        </div>
      )}
    </div>
  )
}

export default GameBoard
