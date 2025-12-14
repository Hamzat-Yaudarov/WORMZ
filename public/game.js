// Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Состояние приложения
const state = {
    playerId: tg.initDataUnsafe?.user?.id || Date.now().toString(),
    playerName: tg.initDataUnsafe?.user?.first_name || 'Игрок',
    balance: 100, // Дефолтный баланс
    selectedStake: null,
    selectedSkin: '#FF6B6B',
    ws: null,
    game: null,
    exitTimer: null,
    canExit: false
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initMenu();
    initStakeModal();
    initSkinsModal();
    initGame();
    
    // Обновление имени игрока из Telegram
    if (tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        state.playerName = user.first_name || user.username || 'Игрок';
        if (user.last_name) {
            state.playerName += ' ' + user.last_name;
        }
    }
    
    updateUI();
});

// Инициализация меню
function initMenu() {
    document.getElementById('playButton').addEventListener('click', () => {
        document.getElementById('stakeModal').classList.remove('hidden');
    });
    
    document.getElementById('skinsButton').addEventListener('click', () => {
        document.getElementById('skinsModal').classList.remove('hidden');
    });
}

// Инициализация модального окна ставок
function initStakeModal() {
    const buttons = document.querySelectorAll('.stake-button');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const stake = parseInt(btn.dataset.stake);
            if (state.balance >= stake) {
                state.selectedStake = stake;
                startGame();
            } else {
                alert('Недостаточно средств!');
            }
        });
    });
}

// Инициализация модального окна скинов
function initSkinsModal() {
    const skins = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#E74C3C',
        '#9B59B6', '#3498DB', '#1ABC9C', '#E67E22', '#F39C12'
    ];
    
    const grid = document.getElementById('skinsGrid');
    skins.forEach(color => {
        const item = document.createElement('div');
        item.className = 'skin-item';
        item.style.backgroundColor = color;
        if (color === state.selectedSkin) {
            item.classList.add('selected');
        }
        item.addEventListener('click', () => {
            document.querySelectorAll('.skin-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            state.selectedSkin = color;
        });
        grid.appendChild(item);
    });
    
    document.getElementById('closeSkinsButton').addEventListener('click', () => {
        document.getElementById('skinsModal').classList.add('hidden');
    });
}

// Инициализация игры
function initGame() {
    const canvas = document.getElementById('gameCanvas');
    state.game = new Game(canvas);
    
    document.getElementById('exitButton').addEventListener('click', () => {
        if (state.canExit) {
            endGame();
        }
    });
}

// Обновление UI
function updateUI() {
    document.getElementById('playerName').textContent = state.playerName;
    document.getElementById('balance').textContent = `USDT $${state.balance}`;
}

// Начало игры
function startGame() {
    if (state.balance < state.selectedStake) {
        tg.showAlert('Недостаточно средств!');
        document.getElementById('stakeModal').classList.add('hidden');
        return;
    }
    
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('stakeModal').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('active');
    
    // Подключение к WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    state.ws = new WebSocket(wsUrl);
    
    // Таймаут подключения
    const connectionTimeout = setTimeout(() => {
        if (state.ws && state.ws.readyState !== WebSocket.OPEN) {
            tg.showAlert('Ошибка подключения к серверу');
            endGame();
        }
    }, 10000);
    
    state.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        // Отправка данных для подключения
        state.ws.send(JSON.stringify({
            type: 'join',
            playerId: state.playerId,
            playerData: {
                name: state.playerName,
                stake: state.selectedStake,
                color: state.selectedSkin
            }
        }));
    };
    
    state.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'joined') {
            document.getElementById('gamePlayers').textContent = 
                `Игроков: ${data.playersCount}/${data.minPlayers}`;
            
            if (data.canStart) {
                state.game.start();
                startExitTimer();
            } else {
                // Периодически проверяем статус
                const checkInterval = setInterval(() => {
                    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                        state.ws.send(JSON.stringify({ type: 'ping' }));
                    } else {
                        clearInterval(checkInterval);
                    }
                }, 2000);
            }
        } else if (data.type === 'gameStarted') {
            if (!state.game.isRunning) {
                state.game.start();
                startExitTimer();
            }
        } else if (data.type === 'state') {
            state.game.updateState(data);
        } else if (data.type === 'error') {
            alert(data.message);
            endGame();
        } else if (data.type === 'pong') {
            // Поддержание соединения
        }
    };
    
    state.ws.onerror = (error) => {
        tg.showAlert('Ошибка подключения к серверу');
        endGame();
    };
    
    state.ws.onclose = () => {
        // Соединение закрыто
        if (state.game && state.game.isRunning) {
            endGame();
        }
    };
}

// Таймер выхода
function startExitTimer() {
    const exitButton = document.getElementById('exitButton');
    exitButton.disabled = true;
    state.canExit = false;
    
    let timeLeft = 300; // 5 минут
    
    const timer = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        exitButton.textContent = `Выйти (${minutes}:${seconds.toString().padStart(2, '0')})`;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            exitButton.disabled = false;
            exitButton.textContent = 'Выйти';
            state.canExit = true;
        }
    }, 1000);
    
    state.exitTimer = timer;
}

// Завершение игры
function endGame() {
    if (state.exitTimer) {
        clearInterval(state.exitTimer);
        state.exitTimer = null;
    }
    
    if (state.ws) {
        // Получаем финальный баланс перед выходом
        const myPlayer = state.game?.players?.get(state.playerId);
        if (myPlayer) {
            // Расчет выигрыша (можно улучшить логику)
            const profit = myPlayer.usdt - state.selectedStake;
            if (profit > 0) {
                state.balance += profit;
                tg.showAlert(`Вы выиграли $${profit.toFixed(2)}!`);
            } else {
                state.balance -= state.selectedStake;
            }
        } else {
            // Игрок умер - теряет ставку
            state.balance -= state.selectedStake;
        }
        
        state.ws.send(JSON.stringify({ type: 'leave' }));
        state.ws.close();
        state.ws = null;
    }
    
    state.game.stop();
    state.selectedStake = null;
    document.getElementById('gameScreen').classList.remove('active');
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('exitButton').disabled = true;
    document.getElementById('exitButton').textContent = 'Выйти (5 мин)';
    
    // Обновление баланса
    updateUI();
}

// Класс игры
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.players = new Map();
        this.food = [];
        this.deadSnakes = [];
        this.myPlayerId = state.playerId;
        this.camera = { x: 0, y: 0 };
        this.angle = 0;
        this.targetAngle = 0;
        this.animationId = null;
        this.isRunning = false;
        this.scale = 1;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Управление
        this.setupControls();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setupControls() {
        // Управление через касания/мышь
        let isDown = false;
        let lastUpdate = 0;
        
        const updateAngle = (e) => {
            if (!isDown || !this.isRunning) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX || (e.touches && e.touches[0].clientX);
            const y = e.clientY || (e.touches && e.touches[0].clientY);
            
            if (!x || !y) return;
            
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            this.targetAngle = Math.atan2(y - centerY, x - centerX);
            
            // Отправка обновлений с ограничением частоты
            const now = Date.now();
            if (now - lastUpdate > 50) { // 20 раз в секунду
                if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                    state.ws.send(JSON.stringify({
                        type: 'update',
                        angle: this.targetAngle
                    }));
                }
                lastUpdate = now;
            }
        };
        
        this.canvas.addEventListener('mousedown', (e) => {
            isDown = true;
            updateAngle(e);
        });
        
        this.canvas.addEventListener('mousemove', updateAngle);
        
        this.canvas.addEventListener('mouseup', () => {
            isDown = false;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            isDown = false;
        });
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDown = true;
            updateAngle(e);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            updateAngle(e);
        });
        
        this.canvas.addEventListener('touchend', () => {
            isDown = false;
        });
    }
    
    start() {
        this.isRunning = true;
        if (!this.animationId) {
            this.animationId = requestAnimationFrame(() => this.loop());
        }
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    updateState(data) {
        this.players.clear();
        data.players.forEach(p => {
            this.players.set(p.id, p);
        });
        this.food = data.food;
        this.deadSnakes = data.deadSnakes;
        
        // Обновление камеры
        const myPlayer = this.players.get(this.myPlayerId);
        if (myPlayer) {
            // Плавное следование камеры
            const dx = myPlayer.snake.x - this.camera.x;
            const dy = myPlayer.snake.y - this.camera.y;
            this.camera.x += dx * 0.1;
            this.camera.y += dy * 0.1;
            
            // Масштабирование в зависимости от размера змейки
            const baseScale = 0.5;
            const sizeFactor = Math.max(0.3, 1 - (myPlayer.snake.size - 20) / 200);
            this.scale = baseScale * sizeFactor;
            
            // Обновление UI
            document.getElementById('gameUsdt').textContent = 
                `USDT: $${myPlayer.usdt.toFixed(2)}`;
            document.getElementById('gamePlayers').textContent = 
                `Игроков: ${this.players.size}`;
        } else {
            // Игрок умер
            if (this.isRunning) {
                this.isRunning = false;
                setTimeout(() => {
                    tg.showAlert('Вы погибли!');
                    endGame();
                }, 1000);
            }
        }
    }
    
    loop() {
        this.draw();
        this.animationId = requestAnimationFrame(() => this.loop());
    }
    
    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Очистка
        ctx.fillStyle = '#0f0f1e';
        ctx.fillRect(0, 0, width, height);
        
        // Сетка (оптимизированная)
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1;
        const gridSize = 50;
        const scale = this.scale;
        const scaledGridSize = gridSize / scale;
        const offsetX = ((this.camera.x * scale) % scaledGridSize) - (width / 2 % scaledGridSize);
        const offsetY = ((this.camera.y * scale) % scaledGridSize) - (height / 2 % scaledGridSize);
        
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-this.camera.x, -this.camera.y);
        
        const startX = Math.floor((this.camera.x - width / 2 / scale) / scaledGridSize) * scaledGridSize;
        const endX = Math.ceil((this.camera.x + width / 2 / scale) / scaledGridSize) * scaledGridSize;
        const startY = Math.floor((this.camera.y - height / 2 / scale) / scaledGridSize) * scaledGridSize;
        const endY = Math.ceil((this.camera.y + height / 2 / scale) / scaledGridSize) * scaledGridSize;
        
        for (let x = startX; x <= endX; x += scaledGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y += scaledGridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Трансформация для камеры
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.scale, this.scale);
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Рисование еды
        this.food.forEach(f => {
            const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size);
            gradient.addColorStop(0, '#4ECDC4');
            gradient.addColorStop(1, '#2E8B8B');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Блик на еде
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(f.x - f.size * 0.3, f.y - f.size * 0.3, f.size * 0.3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Рисование мертвых змеек
        this.deadSnakes.forEach(dead => {
            ctx.globalAlpha = 0.6;
            dead.body.forEach((segment, i) => {
                const progress = i / dead.body.length;
                const size = 8 * (1 - progress * 0.5);
                ctx.fillStyle = dead.color;
                ctx.beginPath();
                ctx.arc(segment.x, segment.y, size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            
            // USDT над мертвой змейкой с эффектом свечения
            if (dead.usdt > 0) {
                ctx.save();
                ctx.scale(1 / this.scale, 1 / this.scale);
                const textY = (dead.y - this.camera.y) * this.scale;
                const textX = (dead.x - this.camera.x) * this.scale;
                
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 10;
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`$${dead.usdt.toFixed(2)}`, textX, textY - 20);
                ctx.restore();
            }
        });
        
        // Рисование змеек
        this.players.forEach((player, playerId) => {
            const snake = player.snake;
            const isMe = playerId === this.myPlayerId;
            
            // Тело змейки с градиентом
            snake.body.forEach((segment, i) => {
                const progress = i / snake.body.length;
                const size = snake.size * (1 - progress * 0.4);
                
                // Градиент от головы к хвосту
                const gradient = ctx.createRadialGradient(
                    segment.x, segment.y, 0,
                    segment.x, segment.y, size
                );
                const r = parseInt(player.color.slice(1, 3), 16);
                const g = parseInt(player.color.slice(3, 5), 16);
                const b = parseInt(player.color.slice(5, 7), 16);
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.5 + progress * 0.5})`);
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(segment.x, segment.y, size, 0, Math.PI * 2);
                ctx.fill();
                
                // Обводка для своей змейки
                if (isMe) {
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            });
            
            // Голова с эффектом
            const headGradient = ctx.createRadialGradient(
                snake.x, snake.y, 0,
                snake.x, snake.y, snake.size
            );
            headGradient.addColorStop(0, player.color);
            headGradient.addColorStop(1, player.color + '80');
            ctx.fillStyle = headGradient;
            ctx.beginPath();
            ctx.arc(snake.x, snake.y, snake.size, 0, Math.PI * 2);
            ctx.fill();
            
            if (isMe) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            
            // Глаза на голове
            const eyeOffset = snake.size * 0.3;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(
                snake.x + Math.cos(snake.angle) * eyeOffset - Math.sin(snake.angle) * snake.size * 0.2,
                snake.y + Math.sin(snake.angle) * eyeOffset + Math.cos(snake.angle) * snake.size * 0.2,
                snake.size * 0.15, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.beginPath();
            ctx.arc(
                snake.x + Math.cos(snake.angle) * eyeOffset + Math.sin(snake.angle) * snake.size * 0.2,
                snake.y + Math.sin(snake.angle) * eyeOffset - Math.cos(snake.angle) * snake.size * 0.2,
                snake.size * 0.15, 0, Math.PI * 2
            );
            ctx.fill();
            
            // Имя и USDT над головой
            ctx.save();
            ctx.scale(1 / this.scale, 1 / this.scale);
            const textY = (snake.y - this.camera.y) * this.scale;
            const textX = (snake.x - this.camera.x) * this.scale;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            const nameMetrics = ctx.measureText(player.name);
            ctx.fillRect(
                textX - nameMetrics.width / 2 - 5,
                textY - snake.size * this.scale - 35,
                nameMetrics.width + 10,
                20
            );
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(player.name, textX, textY - snake.size * this.scale - 20);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.font = '14px Arial';
            const usdtText = `$${player.usdt.toFixed(2)}`;
            const usdtMetrics = ctx.measureText(usdtText);
            ctx.fillRect(
                textX - usdtMetrics.width / 2 - 5,
                textY - snake.size * this.scale - 15,
                usdtMetrics.width + 10,
                18
            );
            
            ctx.fillStyle = '#FFD700';
            ctx.fillText(usdtText, textX, textY - snake.size * this.scale - 2);
            ctx.restore();
        });
        
        ctx.restore();
    }
}
