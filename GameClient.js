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

    //Check user has arrived, the game is in the lobby and the player has not been assigned a player id
    if(gs.state == 'lobby' && playerId == -1){
        console.log("User Arrived in Lobby");
        reservePlayerSpot(gs);
    }

    if(gs.state == "playing"){
        //Update player positions
        drawGameState(gs);
    }

    //Regardless of state, update the lobby user list
    updateLobby(gs);

}

function reservePlayerSpot(gs){
    var nextEmptyPlayer = (gs.players.findIndex(player => !player.isPlayer) + 1);

    // Use jQuery to un-disable the respective input and button in the HTML
    if (nextEmptyPlayer !== -1) {
        var inputId = '#player' + nextEmptyPlayer + "Name";
        var buttonId = '#player' + nextEmptyPlayer + "Btn";
        //We need to reserve the player spot so nobody else can take it while the user thinks of a name
        socket.send(JSON.stringify({
            type:"reservePlayerSpot",
            id:nextEmptyPlayer
        }));
        console.log("Reserving Player Spot: " + nextEmptyPlayer);
        playerId = nextEmptyPlayer;
        $(inputId).prop('disabled', false);
        $(buttonId).prop('disabled', false);
    }
}

//Looks at the player list, and updates the lobby inputs according to each players state
function updateLobby(gs){
    for (var i = 0; i < gs.players.length; i++) {
        var player = gs.players[i];
        //If player not the current player, update their input
        if(i != (playerId - 1)){

            var playerNum = i + 1;
            var playerInputId = '#player' + playerNum + 'Name';
            var playerBtnId = '#player' + playerNum + 'Btn';
            
            if(player.isReady == false){
                if(player.isPlayer == true)
                    $(playerInputId).val("Player getting ready...");
                else{
                    $(playerInputId).val("");
                    $(playerInputId).attr('placeholder',"Player " + playerNum);
                }
                $(playerBtnId).removeClass('btn-success').addClass('btn-outline-primary');
                $(playerInputId).removeClass('is-valid');
                continue;
            }

            $(playerInputId).val(player.name);
            $(playerBtnId).removeClass('btn-outline-primary').addClass('btn-success').attr('disabled', true);
            $(playerInputId).addClass('is-valid').attr('disabled', true);
        }
    }
    //If the user is ready and the host, enable the start game button for them only
    if(numReadyPlayers(gs) > 0 && playerId == 1){
        $('#startGameButton').prop('disabled', false);
    }
}

//Count the number of players ready to play
function numReadyPlayers(gs){
    var count = 0;
    for (var i = 0; i < gs.players.length; i++) 
        if (gs.players[i].isReady == true) 
            count++;
    return count;
}

function drawGameState(gs) { 
    // Get a reference to the canvas context
    var ctx = document.getElementById('canvas').getContext('2d');

    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    //fill the entire canvas with a black rectangle
    ctx.fillStyle = "#dfddff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the players
    drawPlayers(gs,ctx);
}

function drawPlayers(gs,ctx){
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

//write the on doc ready

$(document).ready(function() {
    $('#startGameButton').click(function() {
        console.log("Starting Game");
        socket.send(JSON.stringify({
            type:"startGame"
        }));
    });

    for (let i = 1; i <= 5; i++) {
        $('#player' + i + 'Btn').click(function() {
            $('#player' + i + 'Btn').removeClass('btn-outline-primary').addClass('btn-success').attr('disabled', true);
            $('#player' + i + 'Name').addClass('is-valid').attr('disabled', true);
            console.log('Player ' + i + ' Is Ready To Play as ' + $('#player' + i + 'Name').val() + '!');
            socket.send(JSON.stringify({
                type:"playerLogin",
                name: $('#player' + i + 'Name').val(),
                id:playerId
            }));
        });
    }

});

