const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

var gs = {
    state: 'playing',
    type: "update",
    players:[],
    playerObject:{
        id:-1,
        xloc: (600 - 10), 
        yloc: 100, 
        flysEaten:0, 
        isKing:false, 
        speed: 5, 
        direction: "down", 
        radius: 9, 
        color: 'rgb(245, 51, 219)', 
        name: ''
    },
    enemy:{
        xloc: 600, 
        yloc: 480,  
        direction:"up", 
        radius: 32, 
        color: 'rgb(229, 57, 53)', 
        name: 'X  X',
        speed:1,
        direction: getRandomDiagonalDirection(),
        level:1
    },
    fly:{
        xloc: -2500, 
        yloc: -2500,
        isAlive: false,
        radius: 10, 
        color: 'rgb(0, 0, 0)', 
        name: 'FLY',
        lastDeathTime:0,
        spawnTime:2 //Seconds between fly deaths
    },
    colors: [
        {hex: "#512DA8", name: "Purple"},
        {hex: "#FB8C00", name: "Orange"},
        {hex: "#EC407A", name: "Pink"},
        {hex: "#FFCA28", name: "Yellow"},
        {hex: "#388E3C", name: "Green"},
        {hex: "#1E88E5", name: "Blue"},
        {hex: "#5D4037", name: "Brown"}
    ],
    winMessage:"",
    playTime:0,
    flyEatenSpeedDecrement: 0.15, // how much ther player speed slows each fly
    flyEatenRadiusIncrement: 1.6, // how much they grow
    enemySpeedIncrement: .25 // how much faster the enemy gets for total flies eaten
};

var defaultGameState = JSON.parse(JSON.stringify(gs));

//This needs to match what is in the client
var canvas = {
    width: 1300,
    height: 700
};

const users = new Map();

wss.on('connection', (ws) => {

    // Send the current game state to the client
    ws.on('message', (message) => {
        message = JSON.parse(message);

        if (message.type == "playerJoined") {
            console.log("Player " + message.id + " joining as: " + message.name);
            let newPlayer = JSON.parse(JSON.stringify(gs.playerObject));
            spawnPlayer(newPlayer,message);
            users.set(ws, newPlayer.id);
        }

        if (message.type == "movePlayer") {
            for (let i = 0; i < gs.players.length; i++) {
                if (gs.players[i].id === message.id) {
                    gs.players[i].direction = message.direction;
                    break;
                }
            }
        }
        
    });

    //A user has disconnected
    ws.on('close', function() {
        var id = users.get(ws);
        users.delete(ws);
        if(id != undefined){
            console.log(id + " has disconnected");
            for (let i = 0; i < gs.players.length; i++) {
                if (gs.players[i].id === id) {
                    gs.players.splice(i, 1);
                    break;
                }
            }
        }
    });

});

function spawnPlayer(player, message) {
    var xloc, yloc;
    var enemy = gs.enemy;
    var fly = gs.fly;

    do {
        xloc = Math.floor(Math.random() * (canvas.width - 2 * player.radius)) + player.radius;
        yloc = Math.floor(Math.random() * (canvas.height - 2 * player.radius)) + player.radius;
    } while (
        Math.abs(xloc - enemy.x) < 500 &&
        Math.abs(yloc - enemy.y) < 500 &&
        Math.abs(xloc - fly.x) < 250 &&
        Math.abs(yloc - fly.y) < 250 &&
        gs.players.some(p => Math.abs(xloc - p.xloc) < 250 && Math.abs(yloc - p.yloc) < 250)
    );

    player.xloc = xloc;
    player.yloc = yloc;

    player.color = message.color;
    player.name = message.name;
    player.id = message.id;
    gs.players.push(player);
}

//While there are no players in the game,
//Keep the enemy speed at its default value and the play clock at 0
function resetGameState(){
    gs.enemy.speed = JSON.parse(JSON.stringify(defaultGameState.enemy.speed));
    gs.playTime = 0;
    gs.fly.lastDeathTime = 0;
    gs.fly.isAlive = false;
}

function checkForEmptyGameToReset(){
    if (gs.players.length === 0)
        resetGameState();
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

function updatePlayerLocations(){
    for(var i = 0; i < gs.players.length; i++){
        var currPlayer = gs.players[i];
        var playerSpeed = currPlayer.speed;
        var playerRadius = currPlayer.radius;

        //This is how far a players body may be out of frame before they are teleported
        //Increase to allow them more time out of frame (5 is about half the player)
        var teleportAdjustment = 2.5;

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
            if(player1.isKing || player2.isKing){
                var dx = player1.xloc - player2.xloc;
                var dy = player1.yloc - player2.yloc;
                var distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < player1.radius + player2.radius) {
                    console.log("King collision detected: " + player1.name + " and " + player2.name + " have collided!");
                    if(player1.isKing){
                        playerAtePlayer(player1);
                        playerDied(player2);
                        return;
                    }
                    else if(player2.isKing){
                        playerAtePlayer(player2);
                        playerDied(player1);
                        return;
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
    if(player != undefined){
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
            gs.fly.lastDeathTime =  gs.playTime;
            playerAteFly(player);
        }
    }
}

function playerAteFly(player){
    sendAllClientsSound("flyEaten");
    player.flysEaten += 1;
    player.radius += gs.flyEatenRadiusIncrement;

    //Player speed cant go below 1
    if((player.speed - gs.flyEatenSpeedDecrement) < 1)
        player.speed = 1;
    else
        player.speed -= gs.flyEatenSpeedDecrement;

    evaluateKingTadpole(player);
}

//Players count as 3 flys eaten
function playerAtePlayer(player){
    sendAllClientsSound("playerEaten");
    player.flysEaten += 3;
    player.radius += (gs.flyEatenRadiusIncrement * 3);
    //Player speed cant go below 1
    if((player.speed - (gs.flyEatenSpeedDecrement*3)) < 1)
        player.speed = 1;
    else
        player.speed -= (gs.flyEatenSpeedDecrement*3);

    evaluateKingTadpole(player);
}

function evaluateKingTadpole(player){
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

function playerDied(player){
    const index = gs.players.indexOf(player);
    if (index !== -1) {
        gs.players.splice(index, 1);
    }
}

//Spawns the fly periodically after its last death where no players are nearby
function spawnFly(){
    if((gs.players.length === 0))
        return;

    var secondToSpawnFlyAfterLastDeath = gs.fly.spawnTime; // Seconds to spawn the fly after its last death.
    var flySpawnMargin = 35; // Cannot spawn this close to edge.
    var playerRadius = 400; // Cannot spawn this close to a player.

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

function updatePlayTime(){
    gs.playTime += 1;
}

function adjustEnemySpeed(){
    let maxFlysEaten = 0;
    for (const player of gs.players) {
        if (player.flysEaten > maxFlysEaten) {
            maxFlysEaten = player.flysEaten;
        }
    }
    gs.enemy.level = maxFlysEaten + 1;
    gs.enemy.speed = (maxFlysEaten * gs.enemySpeedIncrement) + 1;

    gs.enemy.radius = 32 + (maxFlysEaten * 1.05);
}

function sendAllClientsSound(sound){
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: "soundEffect",
                sound: sound
            }));
        }
    });
}

//Send the current game state to all clients every 100ms
setInterval(function() {
    checkForEmptyGameToReset();

    checkForCollisions();
    updatePlayerLocations();
    updateEnemyLocation();
    adjustEnemySpeed();
    spawnFly();

    updatePlayTime();

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(gs));
        }
    });
}, 10);