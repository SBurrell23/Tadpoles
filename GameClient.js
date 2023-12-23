const socket = new WebSocket('ws://localhost:8080');
socket.addEventListener('open', function () {
    socket.addEventListener('message', function (event) {
        handleServerMessage(event.data);
    });
});

var globalState = null;
var playerId = -1;

function handleServerMessage(message) {
    var gs = JSON.parse(message);
    globalState = gs;
    //console.log(gs);

    //Check if in lobby and login the user with name
    if(gs.state == 'lobby' && playerId == -1){
        console.log("Prompting For User");
        var user = prompt("Enter your name:");
        for (var i = 0; i < gs.players.length; i++) {
            if (gs.players[i].isPlayer == false) {
                socket.send(JSON.stringify({
                    type:"playerLogin",
                    name:user,
                    id:i
                }));
                playerId = i;
                break;
            }
        }
    }

    //Check if a user is logged in (more checks needed in future) and start the game
    if(playerId != -1 && gs.state == 'lobby' && gs.players[playerId].isPlayer && numLoggedInPlayers(gs) == 2){
        console.log("Starting Game");
        socket.send(JSON.stringify({
            type:"startGame"
        }));
    }

    if(gs.state == "playing"){
        //Update player positions
        drawPlayers(gs);
    }

}

//Count the number of players logged in
function numLoggedInPlayers(gs){
    var count = 0;
    for (var i = 0; i < gs.players.length; i++) {
        if (gs.players[i].isPlayer == true) {
            count++;
        }
    }
    return count;
}

function drawPlayers(gs) { 
    // Get a reference to the canvas context
    var ctx = document.getElementById('canvas').getContext('2d');

    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all players
    for (var i = 0; i < gs.players.length; i++) {
        var player = gs.players[i];
        if(player.isPlayer == false){
            continue;
        }
        ctx.beginPath();
        ctx.arc(player.xloc, player.yloc, player.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.closePath();

        // Write player name on top of the player
        ctx.fillStyle = 'black';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, player.xloc, player.yloc - player.radius - 5);
    }
}

function movePlayer(direction){
    socket.send(JSON.stringify({
        type:"movePlayer",
        id:playerId,
        direction:direction
    }));
}

function handlePlayerMovement(e){
    switch(e.which) {
        case 37: // left arrow key
            movePlayer("left");break;
        case 38: // up arrow key
            movePlayer("up");break;
        case 39: // right arrow key
            movePlayer("right");break;
        case 40: // down arrow key
            movePlayer("down"); break;
        default: return;
    }
    e.preventDefault();
}

$(document).keydown(function(e) {
    handlePlayerMovement(e);
});
