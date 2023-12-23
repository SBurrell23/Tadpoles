const socket = new WebSocket('ws://localhost:8080');
socket.addEventListener('open', function () {
    socket.addEventListener('message', function (event) {
        handleServerMessage(event.data);
    });
});

var globalState = null;
var playerId = -1;
var handleGameOverOnceFlag = true;

function handleServerMessage(message) {
    var gs = JSON.parse(message);
    globalState = gs;
    //console.log(gs);

    //User has arrived, if not playing assign them a spot, or else wait for the game to end
    if(playerId == -1 && gs.state != "playing"){
        console.log("User Arrived in Lobby");
        drawGameState(gs,false);
        drawWelcomeText();
        reservePlayerSpot(gs);
    }

    if(gs.state == "playing"){
        handleGameOverOnceFlag = true;
        drawGameState(gs,true);
    }
    
    if(gs.state == "gameover"){
        drawGameState(gs,true);
        drawGameOverText();
        handleGameOverOnce();
    }
    
    //Regardless of state, update the lobby user list
    updateLobby(gs);

}

function handleGameOverOnce(){
    if(handleGameOverOnceFlag){
        var playerInputId = '#player' + playerId + 'Name';
        var playerBtnId = '#player' + playerId + 'Btn';

        $(playerInputId).prop('disabled', false);
        $(playerInputId).removeClass('is-valid');

        $(playerBtnId).attr('placeholder',"Player " + playerId);
        $(playerBtnId).prop('disabled', false);
        $(playerBtnId).removeClass('btn-success').addClass('btn-outline-primary');
        
        socket.send(JSON.stringify({
            type:"resetGame"
        }));
    }

    handleGameOverOnceFlag = false;
}

function drawGameOverText(){
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;

    ctx.font = '50px Georgia';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Over', canvasWidth / 2, (canvasHeight / 2) - 50);
    ctx.fillText(globalState.winMessage, canvasWidth / 2, (canvasHeight / 2) + 40);
}

function drawWelcomeText(){
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;

    ctx.font = '50px white';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Stay Away!', canvasWidth / 2, canvasHeight / 2);
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
                if(player.isPlayer == true){
                    $(playerInputId).val("");
                    $(playerInputId).attr("placeholder","Player getting ready...");
                }
                else{
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
    //If a player 1 exists, they are the only one who cna start the game as long as someone is ready
    if(numReadyPlayers(gs) >= 2 && playerId == 1 && gs.players[0].isReady){
        $('#startGameButton').prop('disabled', false);
    }
    //If somehow you are not player 1 but the only connected player you may start the game solo
    else if(numReadyPlayers(gs) >=2 && gs.players[playerId - 1].isReady){
        $('#startGameButton').prop('disabled', false);
    }
    //If the game is running or over disable the start button for everone else
    else if(gs.state == "playing" || gs.state == "gameover"){
        $('#startGameButton').prop('disabled', true);
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

//Count the number of players ready to play
function isConnectedPlayer(gs){
    var count = 0;
    for (var i = 0; i < gs.players.length; i++) 
        if (gs.players[i].isPlayer == true) 
            count++;
    return count;
}

function drawGameState(gs, withPlayers) {
    // Get a reference to the canvas context
    var ctx = document.getElementById('canvas').getContext('2d');

    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fill the entire canvas with a background rectangle
    ctx.fillStyle = "#202020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the players
    if (withPlayers)
        drawPlayers(gs, ctx);

    drawSpikes(ctx, canvas.width, canvas.height, 4, "#ff0000");

}

function drawSpikes(ctx, canvasWidth, canvasHeight, spikeSize, spikeColor) {
    // Calculate the number of spikes needed
    var numSpikes = Math.ceil((canvasWidth + canvasHeight) / (2 * spikeSize));

    // Draw spikes along the top border
    for (var i = 0; i < numSpikes; i++) {
        var x = i * (2 * spikeSize);
        var y = 0;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + spikeSize, y + spikeSize);
        ctx.lineTo(x + 2 * spikeSize, y);
        ctx.closePath();

        ctx.fillStyle = spikeColor;
        ctx.fill();
    }

    // Draw spikes along the right border
    for (var i = 0; i < numSpikes; i++) {
        var x = canvasWidth;
        var y = i * (2 * spikeSize);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - spikeSize, y + spikeSize);
        ctx.lineTo(x, y + 2 * spikeSize);
        ctx.closePath();

        ctx.fillStyle = spikeColor;
        ctx.fill();
    }

    // Draw spikes along the bottom border
    for (var i = 0; i < numSpikes; i++) {
        var x = i * (2 * spikeSize);
        var y = canvasHeight;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + spikeSize, y - spikeSize);
        ctx.lineTo(x + 2 * spikeSize, y);
        ctx.closePath();

        ctx.fillStyle = spikeColor;
        ctx.fill();
    }

    // Draw spikes along the left border
    for (var i = 0; i < numSpikes; i++) {
        var x = 0;
        var y = i * (2 * spikeSize);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + spikeSize, y + spikeSize);
        ctx.lineTo(x, y + 2 * spikeSize);
        ctx.closePath();

        ctx.fillStyle = spikeColor;
        ctx.fill();
    }
}


function drawPlayers(gs,ctx){
    // Draw all players
    for (var i = 0; i < gs.players.length; i++) {
        var player = gs.players[i];
        if(player.isAlive == false){
            continue;
        }
        ctx.beginPath();
        ctx.arc(player.xloc, player.yloc, player.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.closePath();

        // Write player name on top of the player
        ctx.fillStyle = 'white';
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
$(document).keydown(function(e) {
    if (!keys[e.which] && globalState.state == "playing") {
        keys[e.which] = true;
        handlePlayerMovement(e);
    }
});
$(document).keyup(function(e) {
    keys[e.which] = false;
});


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

