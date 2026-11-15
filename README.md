<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>One-Latam RPG - Prototipo Beta</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', Courier, monospace; }
        body { background-color: #0d1117; color: #c9d1d9; padding: 15px; display: flex; justify-content: center; }
        .game-card { background: #161b22; border: 2px solid #30363d; border-radius: 10px; width: 100%; max-width: 500px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        h1 { color: #f0883e; text-align: center; font-size: 1.6rem; margin-bottom: 5px; }
        .subtitle { text-align: center; color: #8b949e; font-size: 0.85rem; margin-bottom: 15px; }
        .stats-box { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; margin-bottom: 15px; }
        .stat-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.95rem; }
        .stat-val { font-weight: bold; color: #58a6ff; }
        .hp-bar { background: #21262d; border-radius: 4px; height: 12px; width: 100%; overflow: hidden; margin-top: 4px; }
        .hp-fill { background: #da3633; height: 100%; width: 100%; transition: width 0.3s; }
        .actions-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 15px; }
        button { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; padding: 10px 5px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.85rem; }
        button:hover { background: #30363d; border-color: #8b949e; }
        button:active { transform: scale(0.98); }
        .btn-primary { background: #238636; color: white; border-color: #2ea043; }
        .btn-primary:hover { background: #2ea043; }
        .log-box { background: #010409; border: 1px solid #30363d; border-radius: 6px; height: 180px; padding: 10px; overflow-y: auto; font-size: 0.85rem; }
        .log-entry { margin-bottom: 8px; line-height: 1.3; border-bottom: 1px dashed #21262d; padding-bottom: 4px; }
        .log-gain { color: #3fb950; }
        .log-danger { color: #f85149; }
        .log-info { color: #58a6ff; }
    </style>
</head>
<body>

<div class="game-card">
    <h1>ONE-LATAM RPG</h1>
    <p class="subtitle">Beta 1.0 — Modo de Prueba Directa</p>

    <!-- Ficha del Jugador -->
    <div class="stats-box">
        <div class="stat-row">
            <span>👤 Jugador: <strong id="name-val" style="color:#f0883e;">Capitán Beta</strong></span>
            <span>🪙 Oro: <span id="gold-val" class="stat-val">50</span></span>
        </div>
        <div class="stat-row">
            <span>⭐ Nivel: <span id="lvl-val" class="stat-val">1</span></span>
            <span>✨ Exp: <span id="exp-val" class="stat-val">0/100</span></span>
        </div>
        <div class="stat-row" style="margin-top: 8px;">
            <span>❤️ Salud: <span id="hp-val">100/100</span></span>
            <span>⚔️ Fuerza: <span id="str-val" class="stat-val">10</span></span>
        </div>
        <div class="hp-bar">
            <div id="hp-fill" class="hp-fill"></div>
        </div>
    </div>

    <!-- Botones de Acción -->
    <div class="actions-grid">
        <button onclick="explore()" class="btn-primary">🗺️ Explorar</button>
        <button onclick="rest()">🏕️ Descansar</button>
        <button onclick="train()">⚔️ Entrenar</button>
    </div>

    <!-- Bitácora de Eventos -->
    <div id="log-box" class="log-box">
        <div class="log-entry log-info">🎮 ¡Bienvenido a la Beta! Presiona "Explorar" para comenzar tu viaje.</div>
    </div>
</div>

<script>
    // Estado del Jugador
    let player = {
        name: "Capitán Beta",
        hp: 100,
        maxHp: 100,
        str: 10,
        gold: 50,
        lvl: 1,
        exp: 0,
        nextLvlExp: 100
    };

    function updateUI() {
        document.getElementById('hp-val').innerText = `${player.hp}/${player.maxHp}`;
        document.getElementById('hp-fill').style.width = `${(player.hp / player.maxHp) * 100}%`;
        document.getElementById('gold-val').innerText = player.gold;
        document.getElementById('lvl-val').innerText = player.lvl;
        document.getElementById('exp-val').innerText = `${player.exp}/${player.nextLvlExp}`;
        document.getElementById('str-val').innerText = player.str;
    }

    function addLog(msg, type = '') {
        const logBox = document.getElementById('log-box');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = msg;
        logBox.appendChild(entry);
        logBox.scrollTop = logBox.scrollHeight;
    }

    function explore() {
        if (player.hp <= 0) {
            addLog("☠️ Estás sin energía/derrotado. Necesitas descansar primero.", "log-danger");
            return;
        }

        const chance = Math.random();
        if (chance < 0.4) {
            // Evento: Tesoro
            const gainedGold = Math.floor(Math.random() * 20) + 10;
            const gainedExp = 25;
            player.gold += gainedGold;
            addExp(gainedExp);
            addLog(`🏴‍☠️ ¡Encontraste un cofre en la costa! Ganaste <strong>+${gainedGold} oro</strong> y +${gainedExp} EXP.`, "log-gain");
        } else if (chance < 0.8) {
            // Evento: Combate
            const damage = Math.floor(Math.random() * 15) + 5;
            player.hp = Math.max(0, player.hp - damage);
            const gainedExp = 35;
            const gainedGold = 15;
            player.gold += gainedGold;
            addExp(gainedExp);
            addLog(`⚔️ Te enfrentaste a un rival local. Recibiste <strong>-${damage} HP</strong>, pero ganaste +${gainedGold} oro y +${gainedExp} EXP.`, "log-danger");
        } else {
            // Evento: Suceso tranquilo
            addLog("🌊 Navegaste sin contratiempos observando el horizonte. Todo está tranquilo.", "log-info");
        }
        updateUI();
    }

    function rest() {
        if (player.hp >= player.maxHp) {
            addLog("🏕️ Ya tienes la salud al máximo.", "log-info");
            return;
        }
        player.hp = Math.min(player.maxHp, player.hp + 40);
        addLog("🏕️ Descansaste en el campamento. Recuperaste <strong>+40 HP</strong>.", "log-gain");
        updateUI();
    }

    function train() {
        if (player.gold < 30) {
            addLog("🪙 Necesitas al menos 30 de oro para entrenar.", "log-danger");
            return;
        }
        player.gold -= 30;
        player.str += 2;
        addLog("🏋️ Entrenaste duro. Pagaste 30 de oro y aumentaste tu Fuerza a <strong>" + player.str + "</strong>.", "log-gain");
        updateUI();
    }

    function addExp(amount) {
        player.exp += amount;
        if (player.exp >= player.nextLvlExp) {
            player.lvl += 1;
            player.exp -= player.nextLvlExp;
            player.nextLvlExp = Math.floor(player.nextLvlExp * 1.5);
            player.maxHp += 20;
            player.hp = player.maxHp;
            player.str += 3;
            addLog(`🌟 ¡SUBISTE DE NIVEL! Ahora eres Nivel <strong>${player.lvl}</strong>. Tu salud y fuerza aumentaron.`, "log-gain");
        }
    }
</script>
</body>
</html>
