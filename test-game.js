/**
 * Test script to verify the game works correctly
 * Uses Puppeteer to simulate multiple browser instances
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple HTTP server to serve the game files
function createServer(port) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let filePath = '.' + req.url;
            if (filePath === './') filePath = './index.html';
            
            const extname = String(path.extname(filePath)).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.wav': 'audio/wav',
                '.woff': 'application/font-woff',
                '.ttf': 'application/font-ttf',
                '.eot': 'application/vnd.ms-fontobject',
                '.otf': 'application/font-otf',
                '.wasm': 'application/wasm'
            };

            const contentType = mimeTypes[extname] || 'application/octet-stream';

            fs.readFile(filePath, (error, content) => {
                if (error) {
                    if (error.code == 'ENOENT') {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
                    } else {
                        res.writeHead(500);
                        res.end(`Server Error: ${error.code}`, 'utf-8');
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        });

        server.listen(port, () => {
            console.log(`Server running at http://localhost:${port}/`);
            resolve(server);
        });
    });
}

async function testGame() {
    console.log('Starting game test...\n');
    
    const PORT = 3000;
    const server = await createServer(PORT);
    const baseUrl = `http://localhost:${PORT}`;
    
    let browser;
    let pages = [];
    
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: false, // Set to true for headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        console.log('Browser launched\n');
        
        // Test 1: First player becomes host
        console.log('Test 1: First player should become host');
        const page1 = await browser.newPage();
        pages.push(page1);
        
        await page1.goto(baseUrl, { waitUntil: 'networkidle2' });
        await page1.waitForTimeout(3000); // Wait for PeerJS to initialize
        
        const hostStatus = await page1.evaluate(() => {
            return window.isHost !== undefined ? window.isHost : 'undefined';
        });
        
        console.log(`  First player isHost status: ${hostStatus}`);
        
        if (hostStatus === true) {
            console.log('  ✓ PASS: First player became host\n');
        } else {
            console.log('  ✗ FAIL: First player did not become host\n');
        }
        
        // Test 2: Second player connects to host
        console.log('Test 2: Second player should connect to host');
        const page2 = await browser.newPage();
        pages.push(page2);
        
        await page2.goto(baseUrl, { waitUntil: 'networkidle2' });
        await page2.waitForTimeout(5000); // Wait for connection
        
        const clientStatus = await page2.evaluate(() => {
            return {
                isHost: window.isHost !== undefined ? window.isHost : 'undefined',
                hostConnection: window.hostConnection !== null && window.hostConnection !== undefined,
                globalState: window.globalState !== null && window.globalState !== undefined
            };
        });
        
        console.log(`  Second player isHost: ${clientStatus.isHost}`);
        console.log(`  Second player has hostConnection: ${clientStatus.hostConnection}`);
        console.log(`  Second player has globalState: ${clientStatus.globalState}`);
        
        if (clientStatus.isHost === false && clientStatus.hostConnection) {
            console.log('  ✓ PASS: Second player connected to host\n');
        } else {
            console.log('  ✗ FAIL: Second player did not connect properly\n');
        }
        
        // Test 3: Players can join the game
        console.log('Test 3: Players should be able to join the game');
        
        // Player 1 joins
        await page1.evaluate(() => {
            const colorSelect = document.getElementById('playerColor');
            if (colorSelect && colorSelect.options.length > 1) {
                colorSelect.selectedIndex = 1; // Select first color option
                colorSelect.dispatchEvent(new Event('change'));
                const joinButton = document.getElementById('joinGameButton');
                if (joinButton && !joinButton.disabled) {
                    joinButton.click();
                }
            }
        });
        
        await page1.waitForTimeout(2000);
        
        // Player 2 joins
        await page2.evaluate(() => {
            const colorSelect = document.getElementById('playerColor');
            if (colorSelect && colorSelect.options.length > 1) {
                colorSelect.selectedIndex = 2; // Select second color option
                colorSelect.dispatchEvent(new Event('change'));
                const joinButton = document.getElementById('joinGameButton');
                if (joinButton && !joinButton.disabled) {
                    joinButton.click();
                }
            }
        });
        
        await page2.waitForTimeout(2000);
        
        // Check if players joined
        const gameState1 = await page1.evaluate(() => {
            if (window.isHost && window.gs) {
                return {
                    playerCount: window.gs.players ? window.gs.players.length : 0,
                    players: window.gs.players || []
                };
            }
            return null;
        });
        
        const gameState2 = await page2.evaluate(() => {
            if (window.globalState) {
                return {
                    playerCount: window.globalState.players ? window.globalState.players.length : 0,
                    players: window.globalState.players || []
                };
            }
            return null;
        });
        
        console.log(`  Host sees ${gameState1 ? gameState1.playerCount : 0} players`);
        console.log(`  Client sees ${gameState2 ? gameState2.playerCount : 0} players`);
        
        if (gameState1 && gameState1.playerCount >= 1 && gameState2 && gameState2.playerCount >= 1) {
            console.log('  ✓ PASS: Players joined successfully\n');
        } else {
            console.log('  ✗ FAIL: Players did not join properly\n');
        }
        
        // Test 4: Canvas should render
        console.log('Test 4: Canvas should render game state');
        
        await page1.waitForTimeout(1000);
        
        const canvasRendered1 = await page1.evaluate(() => {
            const canvas = document.getElementById('canvas');
            if (!canvas) return false;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Check if canvas has been drawn on (not all pixels are the same)
            const firstPixel = imageData.data[0];
            let hasContent = false;
            for (let i = 0; i < imageData.data.length; i += 4) {
                if (imageData.data[i] !== firstPixel || 
                    imageData.data[i + 1] !== imageData.data[1] || 
                    imageData.data[i + 2] !== imageData.data[2]) {
                    hasContent = true;
                    break;
                }
            }
            return hasContent;
        });
        
        const canvasRendered2 = await page2.evaluate(() => {
            const canvas = document.getElementById('canvas');
            if (!canvas) return false;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const firstPixel = imageData.data[0];
            let hasContent = false;
            for (let i = 0; i < imageData.data.length; i += 4) {
                if (imageData.data[i] !== firstPixel || 
                    imageData.data[i + 1] !== imageData.data[1] || 
                    imageData.data[i + 2] !== imageData.data[2]) {
                    hasContent = true;
                    break;
                }
            }
            return hasContent;
        });
        
        console.log(`  Host canvas rendered: ${canvasRendered1}`);
        console.log(`  Client canvas rendered: ${canvasRendered2}`);
        
        if (canvasRendered1 && canvasRendered2) {
            console.log('  ✓ PASS: Canvas is rendering\n');
        } else {
            console.log('  ✗ FAIL: Canvas is not rendering properly\n');
        }
        
        // Test 5: Third player can connect
        console.log('Test 5: Third player should be able to connect');
        const page3 = await browser.newPage();
        pages.push(page3);
        
        await page3.goto(baseUrl, { waitUntil: 'networkidle2' });
        await page3.waitForTimeout(5000);
        
        const thirdPlayerStatus = await page3.evaluate(() => {
            return {
                isHost: window.isHost !== undefined ? window.isHost : 'undefined',
                hostConnection: window.hostConnection !== null && window.hostConnection !== undefined,
                globalState: window.globalState !== null && window.globalState !== undefined
            };
        });
        
        console.log(`  Third player isHost: ${thirdPlayerStatus.isHost}`);
        console.log(`  Third player has hostConnection: ${thirdPlayerStatus.hostConnection}`);
        console.log(`  Third player has globalState: ${thirdPlayerStatus.globalState}`);
        
        if (thirdPlayerStatus.isHost === false && thirdPlayerStatus.hostConnection && thirdPlayerStatus.globalState) {
            console.log('  ✓ PASS: Third player connected successfully\n');
        } else {
            console.log('  ✗ FAIL: Third player did not connect properly\n');
        }
        
        // Wait a bit to see the game running
        console.log('Waiting 5 seconds to observe game running...\n');
        await page1.waitForTimeout(5000);
        
        // Final state check
        const finalState1 = await page1.evaluate(() => {
            if (window.isHost && window.gs) {
                return {
                    playerCount: window.gs.players ? window.gs.players.length : 0,
                    enemyExists: window.gs.enemy !== undefined,
                    flyExists: window.gs.fly !== undefined
                };
            }
            return null;
        });
        
        const finalState2 = await page2.evaluate(() => {
            if (window.globalState) {
                return {
                    playerCount: window.globalState.players ? window.globalState.players.length : 0,
                    enemyExists: window.globalState.enemy !== undefined,
                    flyExists: window.globalState.fly !== undefined
                };
            }
            return null;
        });
        
        console.log('Final game state:');
        console.log(`  Host - Players: ${finalState1 ? finalState1.playerCount : 0}, Enemy: ${finalState1 ? finalState1.enemyExists : false}, Fly: ${finalState1 ? finalState1.flyExists : false}`);
        console.log(`  Client - Players: ${finalState2 ? finalState2.playerCount : 0}, Enemy: ${finalState2 ? finalState2.enemyExists : false}, Fly: ${finalState2 ? finalState2.flyExists : false}`);
        
        console.log('\n✓ All tests completed!');
        console.log('\nNote: Keep browser windows open to observe the game running.');
        console.log('Press Ctrl+C to close the test.\n');
        
        // Keep the browser open for observation
        await new Promise(() => {}); // Wait indefinitely
        
    } catch (error) {
        console.error('Test error:', error);
    } finally {
        // Cleanup
        if (browser) {
            // Don't close browser automatically - let user observe
            // await browser.close();
        }
        server.close();
    }
}

// Run the test
testGame().catch(console.error);
