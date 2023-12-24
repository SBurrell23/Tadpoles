const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

var gs = {
    state: 'lobby', // lobby, playing, gameover
    players:[
        { xloc: (200-20), yloc: 100,  direction:"down", radius: 15, color: 'rgb(149, 191, 255)', name: '', isPlayer:false, isReady:false, isAlive:false},
        { xloc: (1000-20),yloc: 100,  direction:"down", radius: 15, color: 'rgb(255, 0, 255)', name: '', isPlayer:false, isReady:false, isAlive:false},
        { xloc: (400-20), yloc: 100,  direction:"down", radius: 15, color: 'green', name: '', isPlayer:false, isReady:false, isAlive:false},
        { xloc: (800-20), yloc: 100,  direction:"down", radius: 15, color: 'orange', name: '', isPlayer:false, isReady:false, isAlive:false} ,
        { xloc: (600-20), yloc: 100,  direction:"down", radius: 15, color: 'purple', name: '', isPlayer:false, isReady:false, isAlive:false}
    ],
    enemy:{
        xloc: 600, 
        yloc: 480,  
        direction:"up", 
        radius: 35, color: 'rgb(255, 0, 0)', 
        name: 'X  X',
        speed:4,
        direction: getRandomDiagonalDirection()
    },
    colors: ['blue', 'red', 'green', 'orange', 'purple'],
    winMessage:"",
    playerSpeed:6,
    playTime:0
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
        gs.players[i].xloc = defaultGameState.players[i].xloc;
        gs.players[i].yloc = defaultGameState.players[i].yloc;
    }
    gs.playTime = 0;
    gs.enemy = JSON.parse(JSON.stringify(defaultGameState.enemy)); 
    gs.enemy.direction = getRandomDiagonalDirection();
    gs.playerSpeed = JSON.parse(JSON.stringify(defaultGameState.playerSpeed));
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
    var playerSpeed = gs.playerSpeed;
    var playerRadius = 20;
    for(var i = 0; i < gs.players.length; i++){
        var currPlayer = gs.players[i];
        if(currPlayer.isAlive == false) // If a played has died, do not bother moving them.
            continue;
        if(currPlayer.direction == "right"){
            if(currPlayer.xloc < canvas.width - playerRadius)
                currPlayer.xloc += playerSpeed;
            else
                playerDied(currPlayer);
        }
        if(currPlayer.direction == "left"){
            if(currPlayer.xloc > playerRadius)
                currPlayer.xloc -= playerSpeed;
            else
                playerDied(currPlayer);
        }
        if(currPlayer.direction == "up"){
            if(currPlayer.yloc > playerRadius)
                currPlayer.yloc -= playerSpeed;
            else
                playerDied(currPlayer);
        }
        if(currPlayer.direction == "down"){
            if(currPlayer.yloc < canvas.height - playerRadius)
                currPlayer.yloc += playerSpeed;
            else
                playerDied(currPlayer);
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
            var dx = player1.xloc - player2.xloc;
            var dy = player1.yloc - player2.yloc;
            var distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < player1.radius + player2.radius) {
                console.log("Collision Detected: " + player1.name + " and " + player2.name + " have collided!");
                playerDied(player1);
                playerDied(player2);
            }
        }
        //Also check if the player has collied with the enemy
        checkIfPlayerCollidedWithEnemy(gs.players[i]);
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

function playerDied(player){
    player.isAlive = false;
    player.xloc = -1000;
    player.yloc = -1000;
}

function checkForGameOver(){
    var alivePlayers = gs.players.filter(player => player.isAlive);
    // if (alivePlayers.length === 1) {
    //     gs.state = 'gameover';
    //     gs.winMessage = alivePlayers[0].name + " Wins!";
    // }
    if (alivePlayers.length === 0) {
        gs.state = 'gameover';
        gs.winMessage = "Nobody Wins!";
        console.log("Game Over!");
    }
}

function updatePlayTime(){
    gs.playTime += 1;
    if(gs.playTime % 100 == 0){ // 500 probably good here
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
        updatePlayTime();
    }

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(gs));
        }
    });
}, 10);