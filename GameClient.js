// P2P Tadpoles Game using PeerJS
// First person to connect becomes the host
// If host leaves, next person becomes host

const HOST_PEER_ID = 'tadpoles-host'; // Fixed ID for the host
let peer = null;
let hostConnection = null;
let isHost = false;
let isBecomingHost = false; // Prevent multiple simultaneous attempts to become host
let peerConnections = new Map(); // Map of peerId -> data connection
let myPeerId = null;
let hostPeerId = null;

var globalState = null;
var playerId = -1;
var onLoad = true;

var sounds = {
    flyEaten: new Audio('assets/flyEaten.wav'),
    enemyBounce: new Audio('assets/enemyBounce.wav'),
    playerEaten: new Audio('assets/playerEaten.wav'),
    playerCollidedWithEnemy: new Audio('assets/playerCollidedWithEnemy.wav'),
    flySpawned: new Audio('assets/flySpawned.wav')
}

// Game state (only used by host)
var playerObject = {
    id: -1,
    xloc: (600 - 10),
    yloc: 100,
    flysEaten: 0,
    isKing: false,
    speed: 5,
    direction: "down",
    radius: 9,
    color: 'rgb(245, 51, 219)',
    name: ''
};

var gs = {
    type: "update",
    players: [],
    enemy: {
        xloc: 600,
        yloc: 480,
        direction: "up",
        radius: 32,
        color: 'rgb(229, 57, 53)',
        speed: 1,
        direction: getRandomDiagonalDirection(),
        level: 1
    },
    fly: {
        xloc: -2500,
        yloc: -2500,
        isAlive: false,
        radius: 10,
        color: 'rgb(0, 0, 0)',
        lastDeathTime: 0,
        spawnTime: 2 // Seconds between fly deaths
    },
    playTime: 0
};

var flyEatenSpeedDecrement = 0.15;
var flyEatenRadiusIncrement = 1.6;
var enemySpeedIncrement = .25;

var defaultGameState = JSON.parse(JSON.stringify(gs));

var canvas = {
    width: 1300,
    height: 700
};

// Initialize PeerJS
function initializePeer() {
    // Generate a random peer ID for this client
    myPeerId = 'tadpole-' + Math.random().toString(36).substr(2, 9);
    
    peer = new Peer(myPeerId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true
    });

    peer.on('open', function(id) {
        console.log('My peer ID is: ' + id);
        // Start rendering loop immediately (will work for both host and client)
        requestAnimationFrame(gameLoop);
        attemptToConnectAsHost();
    });

    peer.on('error', function(err) {
        // Suppress expected errors when trying to connect to non-existent host
        const isHostConnectionError = (
            err.peer === HOST_PEER_ID || 
            (err.message && err.message.includes(HOST_PEER_ID)) ||
            (err.toString && err.toString().includes(HOST_PEER_ID))
        );
        
        if (isHostConnectionError && (err.type === 'peer-unavailable' || err.type === 'network' || err.message?.includes('Could not connect to peer'))) {
            // This is expected when no host exists - we'll become the host
            // Don't log as error, the timeout handler will take care of becoming host
            return;
        }
        
        // Log other unexpected errors
        console.error('Peer error:', err);
        
        if (err.type === 'network' && !isHostConnectionError) {
            // Retry connection for network errors (not related to host connection)
            setTimeout(function() {
                if (!isHost && !isBecomingHost) {
                    attemptToConnectAsHost();
                }
            }, 1000);
        }
    });

    // Handle incoming connections (when someone connects to us as host)
    peer.on('connection', function(conn) {
        console.log('Incoming connection from:', conn.peer);
        setupPeerConnection(conn);
    });
}

function attemptToConnectAsHost() {
    // Wait a moment to see if host becomes available
    setTimeout(function() {
        if (isHost || isBecomingHost) return; // Already host or becoming host
        
        // Try to connect to the host
        // Note: If host doesn't exist, PeerJS will log an error, but this is expected
        // The timeout handler below will detect this and make us the host instead
        console.log('Attempting to connect to host...');
        const conn = peer.connect(HOST_PEER_ID, {
            reliable: true
        });

        // Set a timeout - if connection doesn't open within 2 seconds, become host
        const connectionTimeout = setTimeout(function() {
            if (!conn.open && !isHost && !isBecomingHost) {
                console.log('Connection timeout - host not available, becoming host...');
                conn.close();
                becomeHost();
            }
        }, 2000);

        conn.on('open', function() {
            clearTimeout(connectionTimeout);
            console.log('Connected to host');
            isHost = false;
            hostPeerId = HOST_PEER_ID;
            hostConnection = conn;
            setupPeerConnection(conn);
            // Start rendering loop for client
            requestAnimationFrame(gameLoop);
        });

        conn.on('error', function(err) {
            clearTimeout(connectionTimeout);
            // Connection error means host is not available - become host immediately
            if (!isHost && !isBecomingHost) {
                console.log('Host connection failed, becoming host...');
                becomeHost();
            }
        });

        conn.on('close', function() {
            clearTimeout(connectionTimeout);
            if (!isHost) {
                console.log('Host disconnected');
                handleHostDisconnect();
            }
        });
    }, 500);
}

function becomeHost() {
    if (isBecomingHost || isHost) {
        return; // Already becoming host or already host
    }
    
    console.log('Becoming the host');
    isBecomingHost = true;
    
    // Close old peer connection
    if (peer) {
        peer.destroy();
    }
    
    // Create new peer with the fixed host ID
    peer = new Peer(HOST_PEER_ID, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true
    });

    peer.on('open', function(id) {
        console.log('Host peer opened with ID:', id);
        isHost = true;
        isBecomingHost = false;
        hostPeerId = HOST_PEER_ID;
        myPeerId = HOST_PEER_ID;
        
        // Close connection to old host if it exists
        if (hostConnection) {
            hostConnection.close();
            hostConnection = null;
        }

        // Start game loop
        requestAnimationFrame(gameLoop);
    });

    peer.on('error', function(err) {
        console.error('Host peer error:', err);
        isBecomingHost = false;
        // If ID is taken, wait and retry (someone else became host)
        if (err.type === 'unavailable-id' || err.type === 'id-taken') {
            setTimeout(function() {
                attemptToConnectAsHost();
            }, 1000);
        }
    });

    // Handle incoming connections (when someone connects to us as host)
    peer.on('connection', function(conn) {
        console.log('Incoming connection from:', conn.peer);
        setupPeerConnection(conn);
    });
}

function handleHostDisconnect() {
    if (isHost) return; // We are the host, nothing to do
    
    console.log('Host disconnected, attempting to become new host...');
    hostConnection = null;
    
    // Wait a bit then try to become host
    setTimeout(function() {
        if (!isHost) {
            becomeHost();
        }
    }, 500);
}

function setupPeerConnection(conn) {
    conn.on('data', function(data) {
        handlePeerMessage(data, conn.peer);
    });

    conn.on('close', function() {
        console.log('Peer disconnected:', conn.peer);
        if (isHost) {
            peerConnections.delete(conn.peer);
            // Remove player from game state
            for (let i = gs.players.length - 1; i >= 0; i--) {
                const playerConn = Array.from(peerConnections.entries()).find(([pid, c]) => {
                    // Find player by checking stored player IDs
                    return c.playerId === gs.players[i].id;
                });
                if (!playerConn || playerConn[0] === conn.peer) {
                    // This player's connection is gone
                    const player = gs.players[i];
                    console.log('Removing player:', player.id);
                    gs.players.splice(i, 1);
                }
            }
        } else if (conn.peer === hostPeerId) {
            // Host disconnected
            handleHostDisconnect();
        }
    });

    conn.on('error', function(err) {
        console.error('Connection error:', err);
    });

    if (isHost) {
        peerConnections.set(conn.peer, conn);
        // Send current game state to new peer
        conn.send(JSON.stringify(gs));
    }
}

function handlePeerMessage(message, peerId) {
    try {
        var msg = JSON.parse(message);
    } catch (e) {
        var msg = message; // Already parsed
    }

    if (isHost) {
        // Host processes game messages
        handleHostMessage(msg, peerId);
    } else {
        // Client receives game state updates
        handleClientMessage(msg);
    }
}

function handleHostMessage(msg, peerId) {
    if (msg.type == "playerJoined") {
        console.log("Player " + msg.id + " joining as: " + msg.name);
        let newPlayer = JSON.parse(JSON.stringify(playerObject));
        spawnPlayer(newPlayer, msg);
        // Store player ID in connection
        const conn = peerConnections.get(peerId);
        if (conn) {
            conn.playerId = msg.id;
        }
    }

    if (msg.type == "movePlayer") {
        for (let i = 0; i < gs.players.length; i++) {
            if (gs.players[i].id === msg.id) {
                gs.players[i].direction = msg.direction;
                break;
            }
        }
    }
}

function handleClientMessage(msg) {
    if (msg.type && msg.type == "soundEffect") {
        handleSounds(msg);
        return;
    }

    if (onLoad) {
        getColors();
    }

    checkForPlayerDeath(msg);
    disableJoinIfNoColorChosen();
    globalState = msg;
}

function sendToHost(data) {
    if (isHost) {
        // If we're the host, process locally
        handleHostMessage(data, myPeerId);
    } else if (hostConnection && hostConnection.open) {
        hostConnection.send(JSON.stringify(data));
    }
}

function broadcastToAllClients(data) {
    if (!isHost) return;
    
    const message = JSON.stringify(data);
    peerConnections.forEach((conn, peerId) => {
        if (conn.open) {
            conn.send(message);
        }
    });
}

function sendAllClientsSound(sound) {
    if (!isHost) return;
    broadcastToAllClients({
        type: "soundEffect",
        sound: sound
    });
}

// Initialize on page load
initializePeer();

function handleServerMessage(message) {
    // Legacy function name, now handled by handleClientMessage
    handleClientMessage(message);
}

function gameLoop() {
    if (!isHost) {
        // Client: just render
        var gs = globalState;
        if (gs && gs.type == "update") {
            drawGameState(gs);
        }
        requestAnimationFrame(gameLoop);
        return;
    }

    // Host: update game state
    if (!gs) {
        requestAnimationFrame(gameLoop);
        return; // Wait for game state to be initialized
    }
    
    checkForEmptyGameToReset();
    checkForCollisions();
    updatePlayerLocations();
    updateEnemyLocation();
    adjustEnemySpeed();
    spawnFly();
    updatePlayTime();

    // Broadcast to all clients
    broadcastToAllClients(gs);

    // Also render locally
    drawGameState(gs);

    requestAnimationFrame(gameLoop);
}

function startGameUpdateLoop() {
    // This is handled by requestAnimationFrame now
}

function getRandomDiagonalDirection() {
    var directions = ["up-right", "up-left", "down-right", "down-left"];
    return directions[Math.floor(Math.random() * directions.length)];
}

function spawnPlayer(player, message) {
    var xloc, yloc;
    var enemy = gs.enemy;
    var fly = gs.fly;

    do {
        xloc = Math.floor(Math.random() * (canvas.width - 2 * player.radius)) + player.radius;
        yloc = Math.floor(Math.random() * (canvas.height - 2 * player.radius)) + player.radius;
    } while (
        Math.abs(xloc - enemy.xloc) < 500 &&
        Math.abs(yloc - enemy.yloc) < 500 &&
        Math.abs(xloc - fly.xloc) < 250 &&
        Math.abs(yloc - fly.yloc) < 250 &&
        gs.players.some(p => Math.abs(xloc - p.xloc) < 250 && Math.abs(yloc - p.yloc) < 250)
    );

    player.xloc = xloc;
    player.yloc = yloc;
    player.color = message.color;
    player.name = message.name;
    player.id = message.id;
    gs.players.push(player);
}

function resetGameState() {
    gs.enemy.speed = JSON.parse(JSON.stringify(defaultGameState.enemy.speed));
    gs.playTime = 0;
    gs.fly.lastDeathTime = 0;
    gs.fly.isAlive = false;
}

function checkForEmptyGameToReset() {
    if (gs.players.length === 0)
        resetGameState();
}

function updateEnemyLocation() {
    var enemySpeed = gs.enemy.speed;
    var enemyRadius = gs.enemy.radius;

    if (gs.enemy.direction === "up-right") {
        gs.enemy.xloc += enemySpeed;
        gs.enemy.yloc -= enemySpeed;
    } else if (gs.enemy.direction === "up-left") {
        gs.enemy.xloc -= enemySpeed;
        gs.enemy.yloc -= enemySpeed;
    } else if (gs.enemy.direction === "down-right") {
        gs.enemy.xloc += enemySpeed;
        gs.enemy.yloc += enemySpeed;
    } else if (gs.enemy.direction === "down-left") {
        gs.enemy.xloc -= enemySpeed;
        gs.enemy.yloc += enemySpeed;
    }

    if (gs.enemy.xloc < enemyRadius || gs.enemy.xloc > canvas.width - enemyRadius || gs.enemy.yloc < enemyRadius || gs.enemy.yloc > canvas.height - enemyRadius) {
        if (gs.enemy.xloc < enemyRadius) {
            gs.enemy.xloc = enemyRadius;
            if (gs.enemy.direction === "up-left") {
                gs.enemy.direction = "up-right";
                sendAllClientsSound("enemyBounce");
            } else if (gs.enemy.direction === "down-left") {
                gs.enemy.direction = "down-right";
                sendAllClientsSound("enemyBounce");
            }
        } else if (gs.enemy.xloc > canvas.width - enemyRadius) {
            gs.enemy.xloc = canvas.width - enemyRadius;
            if (gs.enemy.direction === "up-right") {
                gs.enemy.direction = "up-left";
                sendAllClientsSound("enemyBounce");
            } else if (gs.enemy.direction === "down-right") {
                gs.enemy.direction = "down-left";
                sendAllClientsSound("enemyBounce");
            }
        }
        if (gs.enemy.yloc < enemyRadius) {
            gs.enemy.yloc = enemyRadius;
            if (gs.enemy.direction === "up-left") {
                gs.enemy.direction = "down-left";
                sendAllClientsSound("enemyBounce");
            } else if (gs.enemy.direction === "up-right") {
                gs.enemy.direction = "down-right";
                sendAllClientsSound("enemyBounce");
            }
        } else if (gs.enemy.yloc > canvas.height - enemyRadius) {
            gs.enemy.yloc = canvas.height - enemyRadius;
            if (gs.enemy.direction === "down-left") {
                gs.enemy.direction = "up-left";
                sendAllClientsSound("enemyBounce");
            } else if (gs.enemy.direction === "down-right") {
                gs.enemy.direction = "up-right";
                sendAllClientsSound("enemyBounce");
            }
        }
    }
}

function updatePlayerLocations() {
    for (var i = 0; i < gs.players.length; i++) {
        var currPlayer = gs.players[i];
        var playerSpeed = currPlayer.speed;
        var playerRadius = currPlayer.radius;

        var teleportAdjustment = 2.5;

        if (currPlayer.direction == "right") {
            if (currPlayer.xloc < canvas.width - playerRadius / teleportAdjustment)
                currPlayer.xloc += playerSpeed;
            else
                currPlayer.xloc = playerRadius / teleportAdjustment;
        }
        if (currPlayer.direction == "left") {
            if (currPlayer.xloc > playerRadius / teleportAdjustment)
                currPlayer.xloc -= playerSpeed;
            else
                currPlayer.xloc = canvas.width - playerRadius / teleportAdjustment;
        }
        if (currPlayer.direction == "up") {
            if (currPlayer.yloc > playerRadius / teleportAdjustment)
                currPlayer.yloc -= playerSpeed;
            else
                currPlayer.yloc = canvas.height - playerRadius / teleportAdjustment;
        }
        if (currPlayer.direction == "down") {
            if (currPlayer.yloc < canvas.height - playerRadius / teleportAdjustment)
                currPlayer.yloc += playerSpeed;
            else
                currPlayer.yloc = playerRadius / teleportAdjustment;
        }
    }
}

function checkForCollisions() {
    for (var i = 0; i < gs.players.length; i++) {
        for (var j = i + 1; j < gs.players.length; j++) {
            var player1 = gs.players[i];
            var player2 = gs.players[j];
            if (player1.isKing || player2.isKing) {
                var dx = player1.xloc - player2.xloc;
                var dy = player1.yloc - player2.yloc;
                var distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < player1.radius + player2.radius) {
                    console.log("King collision detected: " + player1.name + " and " + player2.name + " have collided!");
                    if (player1.isKing) {
                        playerAtePlayer(player1);
                        playerDied(player2);
                        return;
                    }
                    else if (player2.isKing) {
                        playerAtePlayer(player2);
                        playerDied(player1);
                        return;
                    }
                }
            }
        }
        checkIfPlayerCollidedWithEnemy(gs.players[i]);
        checkIfPlayerCollidedWithFly(gs.players[i]);
    }
}

function checkIfPlayerCollidedWithEnemy(player) {
    if (player != undefined) {
        var dx = player.xloc - gs.enemy.xloc;
        var dy = player.yloc - gs.enemy.yloc;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.radius + gs.enemy.radius) {
            console.log(player.name + " has collided with the enemy!");
            sendAllClientsSound("playerCollidedWithEnemy");
            playerDied(player);
        }
    }
}

function checkIfPlayerCollidedWithFly(player) {
    if (player != undefined && gs.fly.isAlive) {
        var dx = player.xloc - gs.fly.xloc;
        var dy = player.yloc - gs.fly.yloc;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.radius + gs.fly.radius) {
            console.log(player.name + " has eaten the fly!");
            gs.fly.isAlive = false;
            gs.fly.lastDeathTime = gs.playTime;
            playerAteFly(player);
        }
    }
}

function playerAteFly(player) {
    sendAllClientsSound("flyEaten");
    player.flysEaten += 1;
    player.radius += flyEatenRadiusIncrement;

    if ((player.speed - flyEatenSpeedDecrement) < 1)
        player.speed = 1;
    else
        player.speed -= flyEatenSpeedDecrement;

    evaluateKingTadpole(player);
}

function playerAtePlayer(player) {
    sendAllClientsSound("playerEaten");
    player.flysEaten += 3;
    player.radius += (flyEatenRadiusIncrement * 3);
    if ((player.speed - (flyEatenSpeedDecrement * 3)) < 1)
        player.speed = 1;
    else
        player.speed -= (flyEatenSpeedDecrement * 3);

    evaluateKingTadpole(player);
}

function evaluateKingTadpole(player) {
    if (player.flysEaten > 0) {
        var maxFliesEaten = Math.max(...gs.players.map(player => player.flysEaten));
        if (player.flysEaten >= maxFliesEaten) {
            player.isKing = true;
            gs.players.forEach(p => {
                if (p !== player) {
                    p.isKing = false;
                }
            });
        }
    }
}

function playerDied(player) {
    const index = gs.players.indexOf(player);
    if (index !== -1) {
        gs.players.splice(index, 1);
    }
}

function spawnFly() {
    if ((gs.players.length === 0))
        return;

    var secondToSpawnFlyAfterLastDeath = gs.fly.spawnTime;
    var flySpawnMargin = 35;
    var playerRadius = 400;

    if (!gs.fly.isAlive && gs.playTime - gs.fly.lastDeathTime >= (60 * secondToSpawnFlyAfterLastDeath)) {
        var validSpawn = false;
        var flyX, flyY;

        while (!validSpawn) {
            flyX = Math.random() * (canvas.width - 2 * flySpawnMargin) + flySpawnMargin;
            flyY = Math.random() * (canvas.height - 2 * flySpawnMargin) + flySpawnMargin;

            validSpawn = true;
            for (var i = 0; i < gs.players.length; i++) {
                var player = gs.players[i];
                var dx = player.xloc - flyX;
                var dy = player.yloc - flyY;
                var distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < playerRadius + player.radius) {
                    validSpawn = false;
                    break;
                }
            }
        }

        gs.fly.isAlive = true;
        sendAllClientsSound("flySpawned");
        gs.fly.xloc = flyX;
        gs.fly.yloc = flyY;
    }
}

function updatePlayTime() {
    gs.playTime += 1;
}

function adjustEnemySpeed() {
    let maxFlysEaten = 0;
    for (const player of gs.players) {
        if (player.flysEaten > maxFlysEaten) {
            maxFlysEaten = player.flysEaten;
        }
    }
    gs.enemy.level = maxFlysEaten + 1;
    gs.enemy.speed = (maxFlysEaten * enemySpeedIncrement) + 1;

    gs.enemy.radius = 32 + (maxFlysEaten * 1.05);
}

function handleSounds(gs) {
    if (gs.sound == "flyEaten") {
        playSound("flyEaten");
    }
    if (gs.sound == "flySpawned") {
        playSound("flySpawned");
    }
    if (gs.sound == "enemyBounce") {
        playSound("enemyBounce");
    }
    if (gs.sound == "playerEaten") {
        playSound("playerEaten");
        previousPositions = [];
    }
    if (gs.sound == "playerCollidedWithEnemy") {
        playSound("playerCollidedWithEnemy");
        previousPositions = [];
    }
}

function playSound(soundName) {
    if (!sounds[soundName].paused) {
        sounds[soundName].pause();
        sounds[soundName].currentTime = 0;
    }
    sounds[soundName].play();
}

function getColors(gs) {
    var playerColorSelect = $('#playerColor');
    
    // Don't add colors if they're already added (prevent duplicates)
    if (playerColorSelect.children().length > 1) {
        onLoad = false;
        return;
    }

    var colors = [
        { hex: "#512DA8", name: "Purple" },
        { hex: "#FB8C00", name: "Orange" },
        { hex: "#EC407A", name: "Pink" },
        { hex: "#FFCA28", name: "Yellow" },
        { hex: "#388E3C", name: "Green" },
        { hex: "#1E88E5", name: "Blue" },
        { hex: "#5D4037", name: "Brown" }
    ];

    colors.forEach(function (color) {
        var option = $("<option style='color:" + color.hex + "'></option>").val(color.hex).text(color.name);
        playerColorSelect.append(option);
    });
    onLoad = false;
}

function disableJoinIfNoColorChosen() {
    var playerColorVal = $('#playerColor').val();
    if (playerColorVal == null || playerColorVal == "") {
        $('#joinGameButton').prop('disabled', true);
    }
}

function checkForPlayerDeath(gs) {
    if (gs.players && !gs.players.some(player => player.id === playerId)) {
        $('#playerColor').prop('disabled', false);
        $('#joinGameButton').prop('disabled', false);
    } else {
        $('#playerColor').attr('disabled', true);
        $('#joinGameButton').attr('disabled', true);
    }
}

function drawGameState(gs) {
    if (!gs) return; // Guard against undefined game state
    
    var canvasElement = document.getElementById('canvas');
    if (!canvasElement) return; // Guard against canvas not being available
    
    var ctx = canvasElement.getContext('2d');

    drawPond(gs, ctx);
    drawFly(gs, ctx);
    drawPlayers(gs, ctx);
    drawEnemy(gs, ctx);
    drawBorder(gs, ctx);
}

function drawPond(gs, ctx) {
    ctx.fillStyle = '#aacdff';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawBorder(gs, ctx) {
    var lineWidth = 3;
    ctx.fillStyle = '#00A619';
    ctx.fillRect(0, 0, ctx.canvas.width, lineWidth);
    ctx.fillRect(0, 0, lineWidth, ctx.canvas.height);
    ctx.fillRect(ctx.canvas.width - lineWidth, 0, lineWidth, ctx.canvas.height);
    ctx.fillRect(0, ctx.canvas.height - lineWidth, ctx.canvas.width, lineWidth);
}

function drawFly(gs, ctx) {
    if (!gs || !gs.fly) return; // Guard against undefined game state or fly
    var fly = gs.fly;
    if (fly.isAlive) {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(fly.xloc, fly.yloc - fly.radius);
        for (var i = 1; i <= 5; i++) {
            var angle = (i * 2 * Math.PI / 5) - (Math.PI / 2);
            var x = fly.xloc + Math.cos(angle) * fly.radius;
            var y = fly.yloc + Math.sin(angle) * fly.radius;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }
}

var previousEnemyPositions = [];
function drawEnemy(gs, ctx) {
    if (!gs || !gs.enemy) return; // Guard against undefined game state or enemy
    var enemy = gs.enemy;

    for (var j = 0; j < previousEnemyPositions.length; j++) {
        var pos = previousEnemyPositions[j];
        var alpha = 0.15 * (j / previousEnemyPositions.length);
        var color = enemy.color.replace(')', ', ' + alpha + ')').replace('rgb', 'rgba');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, enemy.radius, 0, Math.PI * 2, false);
        ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(enemy.xloc, enemy.yloc, enemy.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = enemy.color;
    ctx.fill();
    ctx.closePath();

    ctx.fillStyle = 'black';
    ctx.font = 'bold ' + (enemy.radius / 1.3) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.fillText((gs.enemy.level), enemy.xloc, enemy.yloc + (enemy.radius / 3.5));

    previousEnemyPositions.push({ x: enemy.xloc, y: enemy.yloc });

    if (previousEnemyPositions.length > 25) {
        previousEnemyPositions.shift();
    }
}

var previousPositions = [];
function drawPlayers(gs, ctx) {
    if (!gs || !gs.players) return; // Guard against undefined game state or players
    for (var i = 0; i < gs.players.length; i++) {
        var player = gs.players[i];

        if (!previousPositions[i]) {
            previousPositions[i] = [];
        }
        for (var j = 0; j < previousPositions[i].length; j++) {
            var pos = previousPositions[i][j];
            var alpha = .35 * (j / previousPositions[i].length);
            var playerRGB = hexToRgb(player.color);
            var color = playerRGB.replace(')', ', ' + alpha + ')').replace('rgb', 'rgba');
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, player.radius, 0, Math.PI * 2, false);
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(player.xloc, player.yloc, player.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.closePath();

        if (player.isKing) {
            drawCrown(ctx, player);
        }

        if (player.flysEaten > 0) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold ' + (player.radius / 1.05) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.flysEaten, player.xloc, player.yloc + (player.radius / 3));
        }

        previousPositions[i].push({ x: player.xloc, y: player.yloc });

        if (previousPositions[i].length > 35) {
            previousPositions[i].shift();
        }
    }
}

function drawCrown(ctx, player) {
    var crownSize = player.radius * 0.5;
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.moveTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc - (crownSize * 0.67), player.yloc - player.radius - (crownSize * 2.2));
    ctx.lineTo(player.xloc - (crownSize * 0.33), player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc, player.yloc - player.radius - (crownSize * 2.5));
    ctx.lineTo(player.xloc + (crownSize * 0.33), player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc + (crownSize * 0.67), player.yloc - player.radius - (crownSize * 2.2));
    ctx.lineTo(player.xloc + crownSize, player.yloc - player.radius - (crownSize * 1.2));

    ctx.moveTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc + crownSize, player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc + crownSize, player.yloc - player.radius - (crownSize * .7));
    ctx.lineTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * .7));
    ctx.lineTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * 1.2));

    ctx.lineTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * 0.8));

    ctx.closePath();
    ctx.fill();
}

function movePlayer(direction) {
    sendToHost({
        type: "movePlayer",
        id: playerId,
        direction: direction
    });
}

function hexToRgb(hex) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

function handlePlayerMovement(e) {
    switch (e.which) {
        case 37: // left arrow key
        case 65: // 'a' key
            movePlayer("left");
            break;
        case 38: // up arrow key
        case 87: // 'w' key
            movePlayer("up");
            break;
        case 39: // right arrow key
        case 68: // 'd' key
            movePlayer("right");
            break;
        case 40: // down arrow key
        case 83: // 's' key
            movePlayer("down");
            break;
        default:
            return;
    }
    e.preventDefault();
}

var keys = {};
$(document).keydown(function (e) {
    if (e.which == 32) { // Spacebar
        if (!$('#joinGameButton').is(':disabled') && $('#playerColor').val() != null && $('#playerColor').val() != "")
            $('#joinGameButton').click();
        e.preventDefault();
    }
    else if (!keys[e.which]) {
        keys[e.which] = true;
        handlePlayerMovement(e);
    }
});
$(document).keyup(function (e) {
    keys[e.which] = false;
});

$(document).ready(function () {
    // Initialize color dropdown for both host and client
    getColors();
    
    $('#joinGameButton').click(function () {
        var playerColorName = $('#playerColor option:selected').text();
        var playerColorHex = $('#playerColor').val();

        const randId = Date.now();
        playerId = randId;

        $('#playerColor').attr('disabled', true);
        $('#joinGameButton').attr('disabled', true);

        console.log('Player is joining the game as player ' + playerId + " (" + playerColorName + ')!');

        sendToHost({
            type: "playerJoined",
            color: playerColorHex,
            name: playerColorName,
            id: playerId
        });
    });

    $('#playerColor').change(function () {
        var playerColorHex = $(this).val();
        $(this).css('color', playerColorHex);
        $(this).css('border-width', '3px');
        $(this).css('border-color', playerColorHex);
    });
});
