const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

var gs = {
    state: 'lobby', // lobby, playing, gameover
    players:[
        { xloc: 100, yloc: 100,  direction:"right", radius: 20, color: '#95bfff', name: '', isPlayer:false, isReady:false, isAlive:false},
        { xloc: 700, yloc: 200,  direction:"right", radius: 20, color: 'red', name: '', isPlayer:false, isReady:false, isAlive:false},
        { xloc: 400, yloc: 300,  direction:"right", radius: 20, color: 'green', name: '', isPlayer:false, isReady:false, isAlive:false},
        { xloc: 1000, yloc: 400, direction:"right", radius: 20, color: 'orange', name: '', isPlayer:false, isReady:false, isAlive:false} ,
        { xloc: 300, yloc: 400,  direction:"right", radius: 20, color: 'purple', name: '', isPlayer:false, isReady:false, isAlive:false}
    ],
    colors: ['blue', 'red', 'green', 'orange', 'purple'],
    winMessage:"",
    playerSpeed:3,
    playTime:0
};

var defaultGameState = JSON.parse(JSON.stringify(gs));

//This needs to match what is in the client
var canvas = {
    width: 1200,
    height: 500
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
            console.log("Player logged in: " + message.name);
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
        gs.players[i].direction = "right";
        gs.players[i].xloc = defaultGameState.players[i].xloc;
        gs.players[i].yloc = defaultGameState.players[i].yloc;
    }
    gs.playerSpeed = JSON.parse(JSON.stringify(defaultGameState.playerSpeed));
}

function resetGameState(){
    gs = JSON.parse(JSON.stringify(defaultGameState));
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
    }
}

function playerDied(player){
    //player.isAlive = false;
    //player.xloc = -1000;
    //player.yloc = -1000;
}

function checkForGameOver(){
    var alivePlayers = gs.players.filter(player => player.isAlive);
    if (alivePlayers.length === 0) { // Check to 1 for prod
        gs.state = 'gameover';
        gs.winMessage = alivePlayers[0].name + " Wins!";
    }
    if (alivePlayers.length === 0) {
        gs.state = 'gameover';
        gs.winMessage = "Nobody Wins!";
    }
}

function updatePlayTime(){
    gs.playTime += 1;
    if(gs.playTime % 300 == 0){
        gs.playerSpeed += 1;
        console.log("Player Speed Increased to: " + gs.playerSpeed);
    }
}

//Send the current game state to all clients every 100ms
setInterval(function() {
    if(gs.state == "playing"){
        checkForCollisions();
        checkForGameOver();
        updatePlayerLocations();
        updatePlayTime();
    }

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(gs));
        }
    });
}, 10);