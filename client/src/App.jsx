import { useState, useEffect } from 'react'
import MainMenu from './components/MainMenu'
import GameBoard from './components/GameBoard'
import RulesScreen from './components/RulesScreen'
import './styles/App.css'

function App() {
  const [currentScreen, setCurrentScreen] = useState('menu')
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    // Инициализировать Telegram Web App
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      webApp.ready()

      const user = webApp.initDataUnsafe?.user
      if (user) {
        setUserId(user.id)
      }
    }

    // Определить экран по URL
    const pathname = window.location.pathname
    if (pathname === '/game') {
      setCurrentScreen('game')
    } else if (pathname === '/rules') {
      setCurrentScreen('rules')
    } else {
      setCurrentScreen('menu')
    }
  }, [])

  const handlePlayClick = () => {
    setCurrentScreen('game')
    window.history.pushState({}, '', '/game')
  }

  const handleRulesClick = () => {
    setCurrentScreen('rules')
    window.history.pushState({}, '', '/rules')
  }

  const handleBackClick = () => {
    setCurrentScreen('menu')
    window.history.pushState({}, '', '/')
  }

  return (
    <div className="app-container">
      {currentScreen === 'menu' && (
        <MainMenu 
          onPlayClick={handlePlayClick}
          onRulesClick={handleRulesClick}
        />
      )}
      {currentScreen === 'game' && (
        <GameBoard 
          userId={userId}
          onBackClick={handleBackClick}
        />
      )}
      {currentScreen === 'rules' && (
        <RulesScreen 
          onBackClick={handleBackClick}
        />
      )}
    </div>
  )
}

export default App
