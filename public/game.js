const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let ws = null;
let player = null;
let players = new Map();
let currentShopTab = 'weapons';
let gameLoop = null;

const weapons = [
    { id: 'sword', name: 'Меч', cost: 50, attackBonus: 10, desc: 'Базовое оружие' },
    { id: 'axe', name: 'Топор', cost: 100, attackBonus: 20, desc: 'Сильное оружие' },
    { id: 'mace', name: 'Булава', cost: 200, attackBonus: 35, desc: 'Очень сильное оружие' },
    { id: 'sword2', name: 'Магический меч', cost: 500, attackBonus: 60, desc: 'Легендарное оружие' }
];

const upgrades = [
    { id: 'attack1', name: 'Усиление атаки I', cost: 100, type: 'attack', value: 15, desc: '+15 к атаке' },
    { id: 'attack2', name: 'Усиление атаки II', cost: 250, type: 'attack', value: 30, desc: '+30 к атаке' },
    { id: 'defense1', name: 'Усиление защиты I', cost: 100, type: 'defense', value: 10, desc: '+10 к защите' },
    { id: 'defense2', name: 'Усиление защиты II', cost: 250, type: 'defense', value: 20, desc: '+20 к защите' },
    { id: 'health1', name: 'Усиление здоровья I', cost: 150, type: 'health', value: 50, desc: '+50 к здоровью' },
    { id: 'health2', name: 'Усиление здоровья II', cost: 300, type: 'health', value: 100, desc: '+100 к здоровью' }
];

const skills = [
    { id: 'crit', name: 'Критический удар', cost: 200, desc: 'Шанс нанести двойной урон' },
    { id: 'heal', name: 'Лечение', cost: 300, desc: 'Восстанавливает здоровье' },
    { id: 'shield', name: 'Щит', cost: 400, desc: 'Увеличивает защиту на время' }
];

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        const initData = tg.initDataUnsafe;
        const userId = initData?.user?.id || `user_${Date.now()}`;
        const username = initData?.user?.username || initData?.user?.first_name || 'Player';
        
        ws.send(JSON.stringify({
            type: 'join',
            playerId: userId.toString(),
            username: username,
            telegramId: userId.toString()
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onerror = () => {
        setTimeout(connect, 3000);
    };

    ws.onclose = () => {
        setTimeout(connect, 3000);
    };
}

function handleMessage(data) {
    switch (data.type) {
        case 'joined':
            player = data.player;
            updateUI();
            updateShop();
            break;

        case 'playerJoined':
            if (data.player.id !== player.id) {
                players.set(data.player.id, data.player);
            }
            updatePlayersList();
            break;

        case 'playerMoved':
            const movedPlayer = players.get(data.playerId);
            if (movedPlayer) {
                movedPlayer.position = data.position;
            }
            break;

        case 'playerLeft':
            players.delete(data.playerId);
            updatePlayersList();
            break;

        case 'battleUpdate':
            showBattleNotification('⚔️ БИТВА!');
            if (data.attacker.id === player.id) {
                player.health = data.attacker.health;
                player.maxHealth = data.attacker.maxHealth;
            } else if (data.defender.id === player.id) {
                player.health = data.defender.health;
                player.maxHealth = data.defender.maxHealth;
            }
            updateUI();
            break;

        case 'battleEnded':
            if (data.winner === player.id) {
                showBattleNotification('🎉 ПОБЕДА!');
                player.gold += data.goldReward;
                player.exp += data.expReward;
                if (data.leveledUp) {
                    showBattleNotification('⬆️ УРОВЕНЬ ПОВЫШЕН!');
                }
            } else if (data.loser === player.id) {
                showBattleNotification('💀 ПОРАЖЕНИЕ');
            }
            player.health = player.maxHealth;
            updateUI();
            break;

        case 'weaponBought':
            player.weapon = data.weapon;
            player.gold = data.gold;
            player.attack = data.attack;
            updateUI();
            updateShop();
            break;

        case 'upgradeBought':
            player.upgrades = data.upgrades;
            player.gold = data.gold;
            player.attack = data.attack;
            player.defense = data.defense;
            player.maxHealth = data.maxHealth;
            player.health = data.health;
            updateUI();
            updateShop();
            break;

        case 'skillLearned':
            player.skills = data.skills;
            player.gold = data.gold;
            updateUI();
            updateShop();
            break;

        case 'allianceJoined':
            player.allianceId = data.alliance.id;
            updateAlliancePanel(data.alliance);
            break;

        case 'allianceUpdated':
            if (player && player.allianceId === data.alliance.id) {
                updateAlliancePanel(data.alliance);
            }
            break;

        case 'pong':
            break;
    }
}

function updateUI() {
    if (!player) return;

    document.getElementById('playerName').textContent = player.username;
    document.getElementById('playerLevel').textContent = player.level;
    document.getElementById('playerHealth').textContent = `${player.health}/${player.maxHealth}`;
    document.getElementById('playerGold').textContent = player.gold;
    document.getElementById('playerAttack').textContent = player.attack;
    document.getElementById('playerDefense').textContent = player.defense;
    document.getElementById('playerExp').textContent = player.exp;

    const healthPercent = (player.health / player.maxHealth) * 100;
    document.getElementById('healthBar').style.width = `${healthPercent}%`;

    const expNeeded = player.level * 100;
    const expPercent = (player.exp / expNeeded) * 100;
    document.getElementById('expBar').style.width = `${expPercent}%`;
}

function updateShop() {
    const content = document.getElementById('shopContent');
    content.innerHTML = '';

    if (currentShopTab === 'weapons') {
        weapons.forEach(weapon => {
            const owned = player.weapon === weapon.id;
            const canAfford = player.gold >= weapon.cost;
            const item = document.createElement('div');
            item.className = `shop-item ${owned || !canAfford ? 'disabled' : ''}`;
            item.innerHTML = `
                <div class="item-name">${weapon.name} ${owned ? '✓' : ''}</div>
                <div class="item-desc">${weapon.desc}</div>
                <div class="item-cost">💰 ${weapon.cost} (+${weapon.attackBonus} атака)</div>
            `;
            if (!owned && canAfford) {
                item.onclick = () => buyWeapon(weapon);
            }
            content.appendChild(item);
        });
    } else if (currentShopTab === 'upgrades') {
        upgrades.forEach(upgrade => {
            const owned = player.upgrades.find(u => u.id === upgrade.id);
            const canAfford = player.gold >= upgrade.cost;
            const item = document.createElement('div');
            item.className = `shop-item ${owned || !canAfford ? 'disabled' : ''}`;
            item.innerHTML = `
                <div class="item-name">${upgrade.name} ${owned ? '✓' : ''}</div>
                <div class="item-desc">${upgrade.desc}</div>
                <div class="item-cost">💰 ${upgrade.cost}</div>
            `;
            if (!owned && canAfford) {
                item.onclick = () => buyUpgrade(upgrade);
            }
            content.appendChild(item);
        });
    } else if (currentShopTab === 'skills') {
        skills.forEach(skill => {
            const owned = player.skills.find(s => s.id === skill.id);
            const canAfford = player.gold >= skill.cost;
            const item = document.createElement('div');
            item.className = `shop-item ${owned || !canAfford ? 'disabled' : ''}`;
            item.innerHTML = `
                <div class="item-name">${skill.name} ${owned ? '✓' : ''}</div>
                <div class="item-desc">${skill.desc}</div>
                <div class="item-cost">💰 ${skill.cost}</div>
            `;
            if (!owned && canAfford) {
                item.onclick = () => learnSkill(skill);
            }
            content.appendChild(item);
        });
    }
}

function buyWeapon(weapon) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'buyWeapon',
            weapon: weapon.id,
            cost: weapon.cost,
            attackBonus: weapon.attackBonus
        }));
    }
}

function buyUpgrade(upgrade) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'buyUpgrade',
            upgrade: upgrade,
            cost: upgrade.cost
        }));
    }
}

function learnSkill(skill) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'learnSkill',
            skill: skill,
            cost: skill.cost
        }));
    }
}

function updatePlayersList() {
    const content = document.getElementById('playersListContent');
    content.innerHTML = '';
    
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item';
        item.innerHTML = `
            <span>${p.username} (Lv.${p.level})</span>
            <span>${p.inBattle ? '⚔️' : '🟢'}</span>
        `;
        content.appendChild(item);
    });
}

function updateAlliancePanel(alliance) {
    const content = document.getElementById('allianceMembers');
    content.innerHTML = `<div style="margin-bottom: 10px; font-weight: bold;">${alliance.name}</div>`;
    alliance.members.forEach(member => {
        const item = document.createElement('div');
        item.className = 'alliance-member';
        item.textContent = `${member.username} (Lv.${member.level})`;
        content.appendChild(item);
    });
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentShopTab = tab.dataset.tab;
        updateShop();
    });
});

document.getElementById('joinAllianceBtn').addEventListener('click', () => {
    const name = document.getElementById('allianceName').value.trim();
    if (name && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'joinAlliance',
            allianceId: name.toLowerCase().replace(/\s+/g, '_'),
            allianceName: name
        }));
    }
});

let battleNotificationTimeout = null;
function showBattleNotification(text) {
    const existing = document.querySelector('.battle-notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'battle-notification';
    notification.textContent = text;
    document.body.appendChild(notification);
    
    if (battleNotificationTimeout) {
        clearTimeout(battleNotificationTimeout);
    }
    battleNotificationTimeout = setTimeout(() => {
        notification.remove();
    }, 2000);
}

let lastMoveTime = 0;
canvas.addEventListener('click', (e) => {
    if (!player) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    player.position = { x, y };
    
    const now = Date.now();
    if (now - lastMoveTime > 100) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'move',
                position: player.position
            }));
        }
        lastMoveTime = now;
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!player) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    player.position = { x, y };
    
    const now = Date.now();
    if (now - lastMoveTime > 100) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'move',
                position: player.position
            }));
        }
        lastMoveTime = now;
    }
});

function drawPlayer(p, isCurrentPlayer) {
    const size = isCurrentPlayer ? 20 : 15;
    
    ctx.save();
    ctx.translate(p.position.x, p.position.y);
    
    if (isCurrentPlayer) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
    } else {
        ctx.fillStyle = p.inBattle ? '#ff0000' : '#4ecdc4';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
    
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.username, p.position.x, p.position.y - size - 5);
    
    if (p.allianceId) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Arial';
        ctx.fillText('🤝', p.position.x + size + 5, p.position.y - size);
    }
}

function gameDraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (player) {
        drawPlayer(player, true);
        
        players.forEach(p => {
            if (p.id !== player.id) {
                drawPlayer(p, false);
            }
        });
        
        players.forEach(p => {
            if (p.id !== player.id) {
                const dx = p.position.x - player.position.x;
                const dy = p.position.y - player.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 50 && !player.inBattle && !p.inBattle) {
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(player.position.x, player.position.y);
                    ctx.lineTo(p.position.x, p.position.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    if (dist < 30) {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'attack',
                                targetId: p.id
                            }));
                        }
                    }
                }
            }
        });
    }
    
    requestAnimationFrame(gameDraw);
}

setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && player) {
        ws.send(JSON.stringify({ type: 'ping' }));
    }
}, 30000);

connect();
gameDraw();
