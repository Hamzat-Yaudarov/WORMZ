import express from 'express';
import { Telegraf } from 'telegraf';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://cherviton-production.up.railway.app';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  await ctx.reply(
    '🎮 Добро пожаловать в Idle RPG! 🎮\n\n' +
    'Сражайтесь с другими игроками, улучшайте своего персонажа, вступайте в альянсы и становьтесь сильнее!\n\n' +
    'Нажмите кнопку ниже, чтобы начать игру!',
    {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🚀 Открыть игру',
            web_app: { url: WEBAPP_URL }
          }
        ]]
      }
    }
  );
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const gameState = {
  players: new Map(),
  alliances: new Map(),
  battles: new Map()
};

class Player {
  constructor(id, username, telegramId) {
    this.id = id;
    this.username = username || `Player_${id.slice(0, 6)}`;
    this.telegramId = telegramId;
    this.level = 1;
    this.exp = 0;
    this.gold = 100;
    this.attack = 10;
    this.defense = 5;
    this.health = 100;
    this.maxHealth = 100;
    this.weapon = null;
    this.skills = [];
    this.upgrades = [];
    this.allianceId = null;
    this.lastActive = Date.now();
    this.position = { x: Math.random() * 800, y: Math.random() * 600 };
    this.target = null;
    this.inBattle = false;
  }

  addExp(amount) {
    this.exp += amount;
    const expNeeded = this.level * 100;
    if (this.exp >= expNeeded) {
      this.exp -= expNeeded;
      this.level++;
      this.maxHealth += 20;
      this.health = this.maxHealth;
      this.attack += 5;
      this.defense += 2;
      return true;
    }
    return false;
  }

  takeDamage(damage) {
    const actualDamage = Math.max(1, damage - this.defense);
    this.health = Math.max(0, this.health - actualDamage);
    return actualDamage;
  }

  isAlive() {
    return this.health > 0;
  }
}

wss.on('connection', (ws, req) => {
  let playerId = null;
  let player = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'join':
          playerId = data.playerId;
          const existingPlayer = gameState.players.get(playerId);
          if (existingPlayer) {
            player = existingPlayer;
            player.lastActive = Date.now();
          } else {
            player = new Player(
              playerId,
              data.username,
              data.telegramId
            );
            gameState.players.set(playerId, player);
          }
          
          ws.send(JSON.stringify({
            type: 'joined',
            player: {
              id: player.id,
              username: player.username,
              level: player.level,
              exp: player.exp,
              gold: player.gold,
              attack: player.attack,
              defense: player.defense,
              health: player.health,
              maxHealth: player.maxHealth,
              weapon: player.weapon,
              skills: player.skills,
              upgrades: player.upgrades,
              allianceId: player.allianceId,
              position: player.position
            },
            players: Array.from(gameState.players.values()).map(p => ({
              id: p.id,
              username: p.username,
              level: p.level,
              position: p.position,
              allianceId: p.allianceId,
              inBattle: p.inBattle
            }))
          }));
          broadcast({
            type: 'playerJoined',
            player: {
              id: player.id,
              username: player.username,
              level: player.level,
              position: player.position
            }
          }, ws);
          break;

        case 'move':
          if (player) {
            player.position = data.position;
            player.lastActive = Date.now();
            broadcast({
              type: 'playerMoved',
              playerId: player.id,
              position: player.position
            }, ws);
          }
          break;

        case 'attack':
          if (player && !player.inBattle) {
            const target = gameState.players.get(data.targetId);
            if (target && target.isAlive() && !target.inBattle) {
              player.inBattle = true;
              target.inBattle = true;
              
              const battleId = `${player.id}_${target.id}_${Date.now()}`;
              const battle = {
                id: battleId,
                attacker: player,
                defender: target,
                startTime: Date.now()
              };
              gameState.battles.set(battleId, battle);
              
              startBattle(battle);
            }
          }
          break;

        case 'buyWeapon':
          if (player && player.gold >= data.cost) {
            player.gold -= data.cost;
            player.weapon = data.weapon;
            player.attack += data.attackBonus || 0;
            ws.send(JSON.stringify({
              type: 'weaponBought',
              weapon: player.weapon,
              gold: player.gold,
              attack: player.attack
            }));
          }
          break;

        case 'buyUpgrade':
          if (player && player.gold >= data.cost) {
            player.gold -= data.cost;
            player.upgrades.push(data.upgrade);
            if (data.upgrade.type === 'attack') {
              player.attack += data.upgrade.value;
            } else if (data.upgrade.type === 'defense') {
              player.defense += data.upgrade.value;
            } else if (data.upgrade.type === 'health') {
              player.maxHealth += data.upgrade.value;
              player.health += data.upgrade.value;
            }
            ws.send(JSON.stringify({
              type: 'upgradeBought',
              upgrades: player.upgrades,
              gold: player.gold,
              attack: player.attack,
              defense: player.defense,
              maxHealth: player.maxHealth,
              health: player.health
            }));
          }
          break;

        case 'learnSkill':
          if (player && player.gold >= data.cost && !player.skills.find(s => s.id === data.skill.id)) {
            player.gold -= data.cost;
            player.skills.push(data.skill);
            ws.send(JSON.stringify({
              type: 'skillLearned',
              skills: player.skills,
              gold: player.gold
            }));
          }
          break;

        case 'joinAlliance':
          if (player) {
            let alliance = gameState.alliances.get(data.allianceId);
            if (!alliance) {
              alliance = {
                id: data.allianceId,
                name: data.allianceName,
                members: []
              };
              gameState.alliances.set(data.allianceId, alliance);
            }
            if (player.allianceId !== alliance.id) {
              if (player.allianceId) {
                const oldAlliance = gameState.alliances.get(player.allianceId);
                if (oldAlliance) {
                  oldAlliance.members = oldAlliance.members.filter(id => id !== player.id);
                }
              }
              player.allianceId = alliance.id;
              if (!alliance.members.includes(player.id)) {
                alliance.members.push(player.id);
              }
            }
            ws.send(JSON.stringify({
              type: 'allianceJoined',
              alliance: {
                id: alliance.id,
                name: alliance.name,
                members: alliance.members.map(id => {
                  const p = gameState.players.get(id);
                  return p ? { id: p.id, username: p.username, level: p.level } : null;
                }).filter(Boolean)
              }
            }));
            broadcast({
              type: 'allianceUpdated',
              alliance: {
                id: alliance.id,
                name: alliance.name,
                memberCount: alliance.members.length
              }
            }, ws);
          }
          break;

        case 'ping':
          if (player) {
            player.lastActive = Date.now();
            ws.send(JSON.stringify({ type: 'pong' }));
          }
          break;
      }
    } catch (error) {
      // Silent error handling - no logging
    }
  });

  ws.on('close', () => {
    if (player) {
      player.inBattle = false;
      broadcast({
        type: 'playerLeft',
        playerId: player.id
      }, ws);
    }
  });

  ws.on('error', () => {
    // Silent error handling
  });
});

function startBattle(battle) {
  const { attacker, defender } = battle;
  
  const battleInterval = setInterval(() => {
    if (!attacker.isAlive() || !defender.isAlive()) {
      clearInterval(battleInterval);
      endBattle(battle);
      return;
    }

    const attackerDamage = attacker.attack + Math.floor(Math.random() * 10);
    const defenderDamage = defender.attack + Math.floor(Math.random() * 10);

    defender.takeDamage(attackerDamage);
    attacker.takeDamage(defenderDamage);

    broadcast({
      type: 'battleUpdate',
      battleId: battle.id,
      attacker: {
        id: attacker.id,
        health: attacker.health,
        maxHealth: attacker.maxHealth
      },
      defender: {
        id: defender.id,
        health: defender.health,
        maxHealth: defender.maxHealth
      }
    });
  }, 1000);
}

function endBattle(battle) {
  const { attacker, defender } = battle;
  
  attacker.inBattle = false;
  defender.inBattle = false;

  if (attacker.isAlive() && !defender.isAlive()) {
    const goldReward = Math.floor(defender.level * 10);
    const expReward = Math.floor(defender.level * 5);
    attacker.gold += goldReward;
    const leveledUp = attacker.addExp(expReward);
    
    defender.health = defender.maxHealth;
    defender.position = { x: Math.random() * 800, y: Math.random() * 600 };

    broadcast({
      type: 'battleEnded',
      battleId: battle.id,
      winner: attacker.id,
      loser: defender.id,
      goldReward,
      expReward,
      leveledUp
    });
  } else if (defender.isAlive() && !attacker.isAlive()) {
    const goldReward = Math.floor(attacker.level * 10);
    const expReward = Math.floor(attacker.level * 5);
    defender.gold += goldReward;
    const leveledUp = defender.addExp(expReward);
    
    attacker.health = attacker.maxHealth;
    attacker.position = { x: Math.random() * 800, y: Math.random() * 600 };

    broadcast({
      type: 'battleEnded',
      battleId: battle.id,
      winner: defender.id,
      loser: attacker.id,
      goldReward,
      expReward,
      leveledUp
    });
  } else {
    attacker.health = Math.min(attacker.health + 10, attacker.maxHealth);
    defender.health = Math.min(defender.health + 10, defender.maxHealth);
    broadcast({
      type: 'battleEnded',
      battleId: battle.id,
      draw: true
    });
  }

  gameState.battles.delete(battle.id);
}

function broadcast(data, excludeWs = null) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === 1) {
      try {
        client.send(message);
      } catch (error) {
        // Silent error handling
      }
    }
  });
}

setInterval(() => {
  const now = Date.now();
  const timeout = 60000;
  
  gameState.players.forEach((player, id) => {
    if (now - player.lastActive > timeout) {
      player.inBattle = false;
      gameState.players.delete(id);
      broadcast({
        type: 'playerLeft',
        playerId: id
      });
    }
  });
}, 30000);

server.listen(PORT, () => {
  // Server started - no logging
});
