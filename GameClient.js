const socket = new WebSocket('ws://localhost:8080'); //stayaway.onrender.com
socket.addEventListener('open', function () {
    socket.addEventListener('message', function (event) {
        handleServerMessage(event.data);
    });
    requestAnimationFrame(gameLoop);
});

var globalState = null;
var playerId = -1;
var handleGameOverOnceFlag = true;

function handleServerMessage(message) {
    var gs = JSON.parse(message);
    globalState = gs;
    //console.log(gs);

    //Listen to incoming server messages and update the lobby accordingly
    updateLobby(gs);

    //The requestAnimationFrame handles calling the gameLoop, so no need to call it here
}

function gameLoop(gs) {
    var gs = globalState;
    if (gs) {
        drawGameState(gs);
        //User has arrived, if not playing assign them a spot, or else wait for the game to end
        if(playerId == -1 && gs.state != "playing"){
            console.log("User Arrived in Lobby");
            reservePlayerSpot(gs);
        }

        if(gs.state == "lobby"){
            drawWelcomeText();
        }

        if(gs.state == "playing"){
            if(!handleGameOverOnceFlag)
                console.log("Game Started!");
            handleGameOverOnceFlag = true;
        }
        
        if(gs.state == "gameover"){
            drawGameOverText();
            handleGameOverOnce();
        }
    }
    requestAnimationFrame(gameLoop); // schedule next game loop
}

function handleGameOverOnce(){
    if(handleGameOverOnceFlag){
        console.log("Game Over!");
        var playerInputId = '#player' + playerId + 'Name';
        var playerBtnId = '#player' + playerId + 'Btn';

        $(playerInputId).prop('disabled', false);
        $(playerInputId).removeClass('is-valid');
        
        $(playerBtnId).attr('placeholder',"Player " + playerId);
        $(playerBtnId).prop('disabled', false);
        $(playerBtnId).removeClass('btn-success').addClass('btn-outline-primary');
        $(playerBtnId).text("Ready");

        previousPositions = [];
        previousEnemyPositions = [];

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
    ctx.fillText('Game Over', canvasWidth / 2, (canvasHeight / 2) - 70);
    ctx.fillText(globalState.winMessage, canvasWidth / 2, (canvasHeight / 2) + 10);
}

function drawWelcomeText(){
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;

    ctx.font = '50px Georgia';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Stay Away!', canvasWidth / 2, (canvasHeight / 2) - 50);
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
        $(buttonId).text("Ready");
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

            if(player.isPlayer == false){
                $(playerInputId).val("");
                $(playerInputId).attr('placeholder',"Player " + playerNum);
                $(playerBtnId).text("Available");
                $(playerBtnId).removeClass('btn-success').addClass('btn-outline-primary');
                $(playerInputId).removeClass('is-valid');
                continue;
            }
            if(player.isPlayer == true && player.isReady == false){
                $(playerInputId).val("");
                $(playerInputId).attr("placeholder","Player not ready...");
                $(playerBtnId).text("In Lobby");
                $(playerBtnId).removeClass('btn-success').addClass('btn-outline-primary');
                $(playerInputId).removeClass('is-valid');
                continue;
            }
            if(player.isPlayer == true && player.isReady == true){
                $(playerInputId).val(player.name);
                $(playerInputId).addClass('is-valid').attr('disabled', true);
                $(playerBtnId).text("Ready");
                $(playerBtnId).removeClass('btn-outline-primary').addClass('btn-success').attr('disabled', true);
                continue;
            }
        }
    }
    //If a player 1 exists, they are the only one who can start the game as long as someone is ready
    if(numReadyPlayers(gs) >= 1 && playerId == 1){
        $('#startGameButton').prop('disabled', false);
    }else{
        $('#startGameButton').prop('disabled', true);
    }
    //If the game is running or over disable the start button for everone else
    if(gs.state == "playing"){
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

function drawGameState(gs) {
    // Get a reference to the canvas context
    var ctx = document.getElementById('canvas').getContext('2d');

    // Clear the entire canvas
    //ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fill the entire canvas with a background rectangle

    ctx.fillStyle = 'rgba(44, 41, 42, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the players
    drawPlayers(gs, ctx);
    drawEnemy(gs, ctx);

    if (gs.state != "lobby"){
        drawLevel(gs,ctx);
    }

    drawSpikes(ctx, canvas.width, canvas.height, 4, "#ff0000");
}


function drawLevel(gs,ctx){
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Level " + (gs.enemy.speed - 3), 45, 23);
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

var previousEnemyPositions = [];
function drawEnemy(gs, ctx) {
    // Draw enemy robot player
    var enemy = gs.enemy;

    // Draw the enemy's trail
    for (var j = 0; j < previousEnemyPositions.length; j++) {
        var pos = previousEnemyPositions[j];
        var alpha = 0.15 * (j / previousEnemyPositions.length); // Adjust alpha as needed
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

    // Write enemy name on top of the player
    ctx.fillStyle = 'black';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(enemy.name, enemy.xloc, enemy.yloc - 8);

    // Store the enemy's current position
    previousEnemyPositions.push({ x: enemy.xloc, y: enemy.yloc });

    // If there are more than 25 positions stored, remove the oldest one
    if (previousEnemyPositions.length > 25) {
        previousEnemyPositions.shift();
    }
}

var previousPositions = [];
function drawPlayers(gs, ctx) {
    // Draw all players
    for (var i = 0; i < gs.players.length; i++) {
        var player = gs.players[i];
        if (player.isReady == false) {
            continue;
        }

        // Draw the player's trail
        if (!previousPositions[i]) {
            previousPositions[i] = [];
        }
        for (var j = 0; j < previousPositions[i].length; j++) {
            var pos = previousPositions[i][j];
            var alpha = 0.25 * (j / previousPositions[i].length); // Adjust alpha as needed
            var color = player.color.replace(')', ', ' + alpha + ')').replace('rgb', 'rgba');
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, player.radius, 0, Math.PI * 2, false);
            ctx.fill();
        }

        // Draw the player
        ctx.beginPath();
        ctx.arc(player.xloc, player.yloc, player.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.closePath();

        // Write player name on top of the player
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, player.xloc, player.yloc - player.radius - 10);

        // Store the player's current position
        previousPositions[i].push({ x: player.xloc, y: player.yloc });

        // If there are more than 25 positions stored, remove the oldest one
        if (previousPositions[i].length > 20) {
            previousPositions[i].shift();
        }
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
            var playerChosenName = $('#player' + i + 'Name').val();
            if(playerChosenName == ""){
                playerChosenName = "Player " + i;
                $('#player' + i + 'Name').val(playerChosenName);
            }
            console.log('Player ' + i + ' Is Ready To Play as ' + playerChosenName + '!');
            socket.send(JSON.stringify({
                type:"playerLogin",
                name: playerChosenName,
                id:playerId
            }));
        });
    }

});

