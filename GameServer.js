const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

var defaultGameState = JSON.parse(JSON.stringify(gs));

var gs = {
    state: 'lobby', // lobby, playing, end
    players:[
        { xloc: 100, yloc: 100,  direction:"right", radius: 20, color: 'blue', name: 'Blu', isPlayer:false, isReady:false},
        { xloc: 700, yloc: 200,  direction:"right", radius: 20, color: 'red', name: 'Rad', isPlayer:false, isReady:false},
        { xloc: 400, yloc: 300,  direction:"right", radius: 20, color: 'green', name: 'Gren', isPlayer:false, isReady:false},
        { xloc: 1000, yloc: 400, direction:"right", radius: 20, color: 'orange', name: 'Orng', isPlayer:false, isReady:false} ,
        { xloc: 300, yloc: 400,  direction:"right", radius: 20, color: 'purple', name: 'Prpl', isPlayer:false, isReady:false}
    ]
};

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
            gs.state = "playing";
        }
        
        if(message.type == "movePlayer"){
            gs.players[message.id - 1].direction = message.direction;
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

function resetGameState(){
    gs = JSON.parse(JSON.stringify(defaultGameState));
}

function updatePlayerLocations(){
    var playerSpeed = 5;
    var playerRadius = 20;
    for(var i = 0; i < gs.players.length; i++){
        var currPlayer = gs.players[i];
        if(currPlayer.direction == "right" && currPlayer.xloc < canvas.width - playerRadius){
            currPlayer.xloc += playerSpeed;
        }
        if(currPlayer.direction == "left" && currPlayer.xloc > playerRadius){
            currPlayer.xloc -= playerSpeed;
        }
        if(currPlayer.direction == "up"  && currPlayer.yloc > playerRadius){
            currPlayer.yloc -= playerSpeed;
        }
        if(currPlayer.direction == "down" && currPlayer.yloc <  canvas.height - playerRadius){
            currPlayer.yloc += playerSpeed;
        }
    }
}

//Send the current game state to all clients every 100ms
setInterval(function() {
    if(gs.state == "playing")
        updatePlayerLocations();

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(gs));
        }
    });
}, 10);