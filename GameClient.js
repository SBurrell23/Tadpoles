const socket = new WebSocket('ws://localhost:8080'); //stayaway.onrender.com
socket.addEventListener('open', function () {
    socket.addEventListener('message', function (event) {
        handleServerMessage(event.data);
    });
    requestAnimationFrame(gameLoop);
});

var globalState = null;
var playerId = -1;
var onLoad = true;

function handleServerMessage(message) {
    var gs = JSON.parse(message);
    globalState = gs;
    //console.log(gs);
    if(onLoad)
        getColors(gs);
    
    disableChosenColors(gs);
    checkForPlayerDeath(gs);
}

function gameLoop(gs) {
    var gs = globalState;
    if (gs) {
        drawGameState(gs);
    }
    requestAnimationFrame(gameLoop); // schedule next game loop
}

function getColors(gs){
    var playerColorSelect = $('#playerColor');

    gs.colors.forEach(function(color) {
        var option = $("<option style='color:"+color.hex+"'></option>").val(color.hex).text(color.name);
        playerColorSelect.append(option);
    });
    onLoad = false;
}

function disableChosenColors(gs){
    var playerColorSelect = $('#playerColor');
    
    gs.players.forEach(function(player) {
        var colorHex = player.color.hex;
        playerColorSelect.find('option[value="' + colorHex + '"]').prop('disabled', true);
    });
}

function checkForPlayerDeath(gs){
    if (!gs.players.some(player => player.id === playerId)) {
        previousPositions = [];
        $('#playerColor').prop('disabled', false);
        $('#joinGameButton').prop('disabled', false);
    }else{
        $('#playerColor').attr('disabled', true);
        $('#joinGameButton').attr('disabled', true);
    }
}

function drawGameState(gs) {
    // Get a reference to the canvas context
    var ctx = document.getElementById('canvas').getContext('2d');

    drawPond(gs, ctx);
    
    drawFly(gs, ctx);
    drawPlayers(gs, ctx);
    drawEnemy(gs, ctx);

    drawBorder(gs,ctx);
    
}

function drawPond(gs, ctx) {
    const squareSize = 10;
    const numRows = Math.ceil(ctx.canvas.height / squareSize);
    const numCols = Math.ceil(ctx.canvas.width / squareSize);

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const x = col * squareSize;
            const y = row * squareSize;

            if ((row + col) % 2 === 0) {
                ctx.fillStyle = '#A7FFFE';
            } else {
                ctx.fillStyle = '#B4FFFD';
            }

            ctx.fillRect(x, y, squareSize, squareSize);
        }
    }
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
    // Draw the fly
    var fly = gs.fly;
    if(fly.isAlive){
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
    ctx.font = 'bold 16px Indie Flower';
    ctx.textAlign = 'center';
    ctx.fillText(enemy.name, enemy.xloc, enemy.yloc - 8);
    ctx.font = 'bold 24px Arial';
    ctx.fillText((gs.enemy.speed), enemy.xloc, enemy.yloc + 20);

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

        // Draw the player's trail
        if (!previousPositions[i]) {
            previousPositions[i] = [];
        }
        for (var j = 0; j < previousPositions[i].length; j++) {
            var pos = previousPositions[i][j];
            var alpha = .5 * (j / previousPositions[i].length); // Adjust alpha as needed
            var playerRGB = hexToRgb(player.color);
            var color = playerRGB.replace(')', ', ' + alpha + ')').replace('rgb', 'rgba');
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
        
        if(player.isKing){
           drawCrown(ctx, player);
        }
        
        //Write the number of flys eaten on the player
        if(player.flysEaten > 0){
            ctx.fillStyle = 'white';
            ctx.font = 'bold ' + (player.radius) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.flysEaten , player.xloc, player.yloc + (player.radius / 3));
        }

        // Store the player's current position
        previousPositions[i].push({ x: player.xloc, y: player.yloc });

        // If there are more than 25 positions stored, remove the oldest one
        if (previousPositions[i].length > 25) {
            previousPositions[i].shift();
        }
    }
}

function drawCrown(ctx,player) {
    // Calculate the crown size based on the player's radius
    var crownSize = player.radius * 0.5;
    // Draw the crown points
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.moveTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc - (crownSize * 0.67), player.yloc - player.radius - (crownSize * 2.2));
    ctx.lineTo(player.xloc - (crownSize * 0.33), player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc, player.yloc - player.radius - (crownSize * 2.5));
    ctx.lineTo(player.xloc + (crownSize * 0.33), player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc + (crownSize * 0.67), player.yloc - player.radius - (crownSize * 2.2));
    ctx.lineTo(player.xloc + crownSize, player.yloc - player.radius - (crownSize * 1.2));

    ctx.moveTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * 1.2)); // Adjust the y-coordinate to make the top higher
    ctx.lineTo(player.xloc + crownSize, player.yloc - player.radius - (crownSize * 1.2));
    ctx.lineTo(player.xloc + crownSize, player.yloc - player.radius - (crownSize * .7));
    ctx.lineTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * .7));
    ctx.lineTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * 1.2));

    // Set the top of the rectangle to the same y-value as the bottom of the previous points
    ctx.lineTo(player.xloc - crownSize, player.yloc - player.radius - (crownSize * 0.8));

    ctx.closePath();
    ctx.fill();
}

function movePlayer(direction){
    socket.send(JSON.stringify({
        type:"movePlayer",
        id:playerId,
        direction:direction
    }));
}

function hexToRgb(hex) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
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

    $('#joinGameButton').click(function() {
        var playerColorName = $('#playerColor option:selected').text();
        var playerColorHex = $('#playerColor').val();

        const randId = Date.now();
        playerId = randId;

        $('#playerColor').attr('disabled', true);
        $('#joinGameButton').attr('disabled', true);

        console.log('Player is joining the game as player ' + playerId + " ("+ playerColorName + ')!'); 

        socket.send(JSON.stringify({
            type:"playerJoined",
            color: playerColorHex,
            name: playerColorName,
            id: playerId
        }));

    });

    $('#playerColor').change(function() {
        var playerColorHex = $(this).val();
        $(this).css('color', playerColorHex);
        $(this).css('border-width', '3px');
        $(this).css('border-color', playerColorHex);
    });
});

