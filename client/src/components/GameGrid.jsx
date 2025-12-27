import '../styles/GameGrid.css'

function GameGrid({ board, onCellClick, gameActive }) {
  return (
    <div className="game-grid-container">
      <div className="game-grid">
        {board.map((row, y) => (
          <div key={y} className="grid-row">
            {row.map((cell, x) => (
              <div
                key={`${x}-${y}`}
                className={`grid-cell cell-owner-${cell.owner || 'neutral'}`}
                onClick={() => gameActive && onCellClick(x, y)}
                title={`Сила: ${cell.strength}`}
              >
                <span className="cell-strength">{cell.strength}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default GameGrid
