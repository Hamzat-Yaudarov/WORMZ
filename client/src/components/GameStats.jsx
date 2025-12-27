import '../styles/GameStats.css'

function GameStats({ playerScore, opponentScore }) {
  return (
    <div className="game-stats">
      <div className="stat-player">
        <span className="stat-label">👤 Ты</span>
        <span className="stat-value">{playerScore}</span>
      </div>

      <div className="stat-vs">
        <span>vs</span>
      </div>

      <div className="stat-opponent">
        <span className="stat-label">🤖 Противник</span>
        <span className="stat-value">{opponentScore}</span>
      </div>
    </div>
  )
}

export default GameStats
