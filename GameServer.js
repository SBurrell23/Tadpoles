const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

var gs = {
    state: 'lobby', // lobby, playing, gameover
    players:[
        { xloc: (200 - 10), yloc: 100, flysEaten:0, isKing:false, speed: 6, direction: "down", radius: 10, color: 'rgb(10, 87, 209)',  name: '', isPlayer: false, isReady: false, isAlive: false },
        { xloc: (1000 - 10),yloc: 100, flysEaten:0, isKing:false, speed: 6, direction: "down", radius: 10, color: 'rgb(62, 212, 57)',  name: '', isPlayer: false, isReady: false, isAlive: false },
        { xloc: (400 - 10), yloc: 100, flysEaten:0, isKing:false, speed: 6, direction: "down", radius: 10, color: 'rgb(224, 170, 34)', name: '', isPlayer: false, isReady: false, isAlive: false },
        { xloc: (800 - 10), yloc: 100, flysEaten:0, isKing:false, speed: 6, direction: "down", radius: 10, color: 'rgb(175, 87, 247)', name: '', isPlayer: false, isReady: false, isAlive: false },
        { xloc: (600 - 10), yloc: 100, flysEaten:0, isKing:false, speed: 6, direction: "down", radius: 10, color: 'rgb(245, 51, 219)', name: '', isPlayer: false, isReady: false, isAlive: false }
    ],
    enemy:{
        xloc: 600, 
        yloc: 480,  
        direction:"up", 
        radius: 35, color: 'rgb(255, 48, 48)', 
        name: 'X  X',
        speed:1,
        direction: getRandomDiagonalDirection()
    },
    fly:{
        xloc: -1500, 
        yloc: -1500,
        isAlive: false,
        radius: 10, 
        color: 'rgb(0, 0, 0)', 
        name: 'FLY',
        lastDeathTime:0
    },
    colors: ['blue', 'red', 'green', 'orange', 'purple'],
    winMessage:"",
    playTime:0,
    levelUpTimeInSeconds: 10,
    flyEatenSpeedDecrement: 0.8
};

var defaultGameState = JSON.parse(JSON.stringify(gs));

//This needs to match what is in the client
var canvas = {
    width: 1200,
    height: 700
};

const users = new Map();

wss.on('connection', (ws) => {

    // Send the current game state to the client
    ws.on('message', (message) => {
        message = JSON.parse(message);

        if(message.type == "reservePlayerSpot"){
            console.log("Reserving Player Spot: " + message.id);
            gs.players[message.id - 1].isPlayer = true;
            users.set(ws, message.id);
        }

        if(message.type == "playerLogin"){
            console.log("Player "+ message.id +" ready as: " + message.name);
            gs.players[message.id - 1].name = message.name;
            gs.players[message.id - 1].isReady = true;
        }

        if(message.type == "startGame"){
            for(var i = 0; i < gs.players.length; i++){
                if(gs.players[i].isPlayer && gs.players[i].isReady)
                    gs.players[i].isAlive = true;
            }
            gs.state = "playing";
        }
        
        if(message.type == "movePlayer"){
            gs.players[message.id - 1].direction = message.direction;
        }

        if(message.type == "resetGame"){
            handleGameOver();
        }

    });

    //A user has disconnected
    ws.on('close', function() {
        console.log('Connection closed');
        console.log('User id ' + users.get(ws) + ' disconnected');
        gs.players[users.get(ws) - 1].isPlayer = false;
        gs.players[users.get(ws) - 1].isReady = false; 
        gs.players[users.get(ws) - 1].name = "Disconnected";
        users.delete(ws);
        if(users.size === 0) {
            console.log('All clients disconnected... resetting game state');
            resetGameState();
        }
    });

});

function handleGameOver(){
    for(var i = 0; i < gs.players.length; i++){
        gs.players[i].isReady = false;
        gs.players[i].direction = "down";
        gs.players[i].isKing = false;
        gs.players[i].flysEaten = 0;
        gs.players[i].xloc = defaultGameState.players[i].xloc;
        gs.players[i].yloc = defaultGameState.players[i].yloc;
        gs.players[i].speed = defaultGameState.players[i].speed;
        gs.players[i].radius = defaultGameState.players[i].radius;
    }
    gs.playTime = 0;
    gs.enemy = JSON.parse(JSON.stringify(defaultGameState.enemy)); 
    gs.enemy.direction = getRandomDiagonalDirection();
    gs.fly = JSON.parse(JSON.stringify(defaultGameState.fly));
}

function resetGameState(){
    gs = JSON.parse(JSON.stringify(defaultGameState));
}

function getRandomDiagonalDirection () {
    var directions = ["up-right", "up-left", "down-right", "down-left"];
    return directions[Math.floor(Math.random() * directions.length)];
}

function updateEnemyLocation(){
    var enemySpeed = gs.enemy.speed;
    var enemyRadius = gs.enemy.radius;
    
    // Move the enemy based on the current direction
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
    
    // Check if the enemy hits the canvas on any side
    if (gs.enemy.xloc < enemyRadius || gs.enemy.xloc > canvas.width - enemyRadius || gs.enemy.yloc < enemyRadius || gs.enemy.yloc > canvas.height - enemyRadius) {
        // Bounce back inward in the opposite direction
        if (gs.enemy.xloc < enemyRadius) {
            gs.enemy.xloc = enemyRadius;
            if (gs.enemy.direction === "up-left") {
                gs.enemy.direction = "up-right";
            } else if (gs.enemy.direction === "down-left") {
                gs.enemy.direction = "down-right";
            }
        } else if (gs.enemy.xloc > canvas.width - enemyRadius) {
            gs.enemy.xloc = canvas.width - enemyRadius;
            if (gs.enemy.direction === "up-right") {
                gs.enemy.direction = "up-left";
            } else if (gs.enemy.direction === "down-right") {
                gs.enemy.direction = "down-left";
            }
        }
        if (gs.enemy.yloc < enemyRadius) {
            gs.enemy.yloc = enemyRadius;
            if (gs.enemy.direction === "up-left") {
                gs.enemy.direction = "down-left";
            } else if (gs.enemy.direction === "up-right") {
                gs.enemy.direction = "down-right";
            }
        } else if (gs.enemy.yloc > canvas.height - enemyRadius) {
            gs.enemy.yloc = canvas.height - enemyRadius;
            if (gs.enemy.direction === "down-left") {
                gs.enemy.direction = "up-left";
            } else if (gs.enemy.direction === "down-right") {
                gs.enemy.direction = "up-right";
            }
        }
    }
}

function updatePlayerLocations(){
    for(var i = 0; i < gs.players.length; i++){
        var currPlayer = gs.players[i];
        var playerSpeed = currPlayer.speed;
        var playerRadius = currPlayer.radius;

        //This is how far a players body may be out of frame before they are teleported
        //Increase to allow them more time out of frame (5 is about half the player)
        var teleportAdjustment = 2.5;

        if(currPlayer.isAlive == false) // If a played has died, do not bother moving them.
            continue;
        if(currPlayer.direction == "right"){
            if(currPlayer.xloc < canvas.width - playerRadius / teleportAdjustment)
                currPlayer.xloc += playerSpeed;
            else
                currPlayer.xloc = playerRadius / teleportAdjustment; // Move to the opposite side of the map
        }
        if(currPlayer.direction == "left"){
            if(currPlayer.xloc > playerRadius / teleportAdjustment)
                currPlayer.xloc -= playerSpeed;
            else
                currPlayer.xloc = canvas.width - playerRadius / teleportAdjustment; // Move to the opposite side of the map
        }
        if(currPlayer.direction == "up"){
            if(currPlayer.yloc > playerRadius / teleportAdjustment)
                currPlayer.yloc -= playerSpeed;
            else
                currPlayer.yloc = canvas.height - playerRadius / teleportAdjustment; // Move to the opposite side of the map
        }
        if(currPlayer.direction == "down"){
            if(currPlayer.yloc < canvas.height - playerRadius / teleportAdjustment)
                currPlayer.yloc += playerSpeed;
            else
                currPlayer.yloc = playerRadius / teleportAdjustment; // Move to the opposite side of the map
        }
    }
}

function checkForCollisions() {
    for (var i = 0; i < gs.players.length; i++) {
        //Go through and first check if a player has collided with another player
        for (var j = i + 1; j < gs.players.length; j++) {
            var player1 = gs.players[i];
            var player2 = gs.players[j];
            if(player1.isAlive == false || player2.isAlive == false)
                continue;
            if(player1.isKing || player2.isKing){
                var dx = player1.xloc - player2.xloc;
                var dy = player1.yloc - player2.yloc;
                var distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < player1.radius + player2.radius) {
                    console.log("King collision detected: " + player1.name + " and " + player2.name + " have collided!");
                    if(player1.isKing){
                        playerAtePlayer(player1);
                        playerDied(player2);
                    }
                    else if(player2.isKing){
                        playerAtePlayer(player2);
                        playerDied(player1);
                    }
                }
            }
        }
        //Also check if the player has collided with the enemy or fly
        checkIfPlayerCollidedWithEnemy(gs.players[i]);
        checkIfPlayerCollidedWithFly(gs.players[i]);
    }
}
function checkIfPlayerCollidedWithEnemy(player) {
    if (player.isAlive) {
        var dx = player.xloc - gs.enemy.xloc;
        var dy = player.yloc - gs.enemy.yloc;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.radius + gs.enemy.radius) {
            console.log(player.name + " has collided with the enemy!");
            playerDied(player);
        }
    }
}

function checkIfPlayerCollidedWithFly(player) {
    if (player.isAlive && gs.fly.isAlive) {
        var dx = player.xloc - gs.fly.xloc;
        var dy = player.yloc - gs.fly.yloc;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.radius + gs.fly.radius) {
            console.log(player.name + " has eaten the fly!");
            gs.fly.isAlive = false;
            gs.fly.lastDeathTime =  gs.playTime;
            playerAteFly(player);
        }
    }
}

function playerAteFly(player){
    player.flysEaten += 1;
    player.radius += 3;

    //Player speed cant go below 1
    if((player.speed - gs.flyEatenSpeedDecrement) < 1)
        player.speed = 1;
    else
        player.speed -= 0.5;

    if (player.flysEaten > 0) {
        var maxFliesEaten = Math.max(...gs.players.map(player => player.flysEaten));
        if (player.flysEaten >= maxFliesEaten) {
            player.isKing = true;
        }
    }
}

//Players count as 3 flys eaten
function playerAtePlayer(player){
    player.flysEaten += 3;
    player.radius += 9;
    //Player speed cant go below 1
    if((player.speed - (gs.flyEatenSpeedDecrement*3)) < 1)
        player.speed = 1;
    else
        player.speed -= (gs.flyEatenSpeedDecrement*3);
}

function playerDied(player){
    player.isAlive = false;
    player.xloc = -1000;
    player.yloc = -1000;
}

function checkForGameOver(){
    var alivePlayers = gs.players.filter(player => player.isAlive);
    // if (alivePlayers.length === 1) {
    //     gs.state = 'gameover';
    //     gs.winMessage = alivePlayers[0].name + " wins as the last player left alive!"
    // }
    if (alivePlayers.length === 0) {
        gs.state = 'gameover';
        gs.winMessage = "Nobody Wins!";
        console.log("Game Over!");
    }

    var flysToWin = 10;
    var playerWithEnoughFlies = gs.players.find(player => player.flysEaten >= flysToWin);
    if (playerWithEnoughFlies) {
        console.log(playerWithEnoughFlies.name + " has eaten 10 flys and wins!");
        gs.state = 'gameover';
        gs.winMessage = playerWithEnoughFlies.name + " wins with " + playerWithEnoughFlies.flysEaten + " flys eaten!";
    }
}

//Spawns the fly periodically after its last death where no players are nearby
function spawnFly(){
    var secondToSpawnFlyAfterLastDeath = 3; // Seconds to spawn the fly after its last death.
    var flySpawnMargin = 35; // Cannot spawn this close to edge.
    var playerRadius = 200; // Cannot spawn this close to a player.

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
        gs.fly.xloc = flyX;
        gs.fly.yloc = flyY;
    }
}

function updatePlayTime(){
    gs.playTime += 1;
    if(gs.playTime % (60 * gs.levelUpTimeInSeconds) == 0){ 
        gs.enemy.speed += 1;
        console.log("Enemy Speed Increased to: " + gs.enemy.speed);
    }
}

//Send the current game state to all clients every 100ms
setInterval(function() {
    if(gs.state == "playing"){
        checkForCollisions();
        checkForGameOver();
        updatePlayerLocations();
        updateEnemyLocation();
        spawnFly();
        updatePlayTime();
    }

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(gs));
        }
    });
}, 10);