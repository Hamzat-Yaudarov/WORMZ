import '../styles/MainMenu.css'

function MainMenu({ onPlayClick, onRulesClick }) {
  return (
    <div className="main-menu">
      <div className="menu-content">
        <div className="menu-header">
          <h1 className="game-title">⚔️ Influence</h1>
          <p className="game-subtitle">Влияние</p>
        </div>

        <div className="menu-description">
          <p>
            Стратегическая игра, где твоя цель — 
            захватить как можно больше точек территории противника!
          </p>
        </div>

        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onPlayClick}>
            🎮 Начать игру
          </button>
          <button className="btn btn-secondary" onClick={onRulesClick}>
            📖 Правила игры
          </button>
        </div>

        <div className="menu-footer">
          <p className="version">v1.0.0</p>
        </div>
      </div>
    </div>
  )
}

export default MainMenu
