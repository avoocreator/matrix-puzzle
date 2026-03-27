const videoElement = document.getElementsByClassName('input_video')[0];
const uiCanvas = document.getElementById('ui_canvas');
const ctx = uiCanvas.getContext('2d');
const gameZone = document.getElementById('game-zone');
const captureZone = document.getElementById('capture-zone');
const board = document.getElementById('puzzle-board');

const WIDTH = 640;
const HEIGHT = 480;

uiCanvas.width = WIDTH;
uiCanvas.height = HEIGHT;
videoElement.width = WIDTH;
videoElement.height = HEIGHT;

let frameBox = { x: 100, y: 100, w: 200, h: 200 };
let tiles = [];
let solution = [0, 1, 2, 3, 4, 5, 6, 7, 8];
let capturedImgData = null;
let hintVisible = false;

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1, 
    minDetectionConfidence: 0.75,
    minTrackingConfidence: 0.75
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: WIDTH,
    height: HEIGHT
});
camera.start();

function onResults(results) {
    ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    
    if (!gameZone.classList.contains('hidden')) return;

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
                color: '#ffffff', 
                lineWidth: 2
            });
            drawLandmarks(ctx, landmarks, {
                color: '#00e5ff', 
                lineWidth: 1,
                radius: 3
            });
        }

        if (results.multiHandLandmarks.length === 2) {
            const h1 = results.multiHandLandmarks[0];
            const h2 = results.multiHandLandmarks[1];

            const points = [h1[4], h1[8], h2[4], h2[8]];
            const xs = points.map(p => p.x * uiCanvas.width);
            const ys = points.map(p => p.y * uiCanvas.height);

            let rawX = Math.min(...xs);
            let rawY = Math.min(...ys);
            let rawW = Math.max(...xs) - rawX;
            let rawH = Math.max(...ys) - rawY;
            let size = Math.max(rawW, rawH);
            
            frameBox.x = rawX + (rawW - size) / 2;
            frameBox.y = rawY + (rawH - size) / 2;
            frameBox.w = size;
            frameBox.h = size;

            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 3;
            ctx.strokeRect(frameBox.x, frameBox.y, frameBox.w, frameBox.h);
            drawCornerBrackets(ctx, frameBox);


            const pinchHand = results.multiHandLandmarks[0];
            const dist = Math.hypot(pinchHand[4].x - pinchHand[8].x, pinchHand[4].y - pinchHand[8].y);
            if (dist < 0.05) { 
                takePhoto();
            }
        }
    }
}

function drawCornerBrackets(ctx, box) {
    const len = 15; 
    ctx.lineWidth = 5;

    // Top Left
    ctx.beginPath(); ctx.moveTo(box.x, box.y + len); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + len, box.y); ctx.stroke();
    // Top Right
    ctx.beginPath(); ctx.moveTo(box.x + box.w - len, box.y); ctx.lineTo(box.x + box.w, box.y); ctx.lineTo(box.x + box.w, box.y + len); ctx.stroke();
    // Bottom Left
    ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h - len); ctx.lineTo(box.x, box.y + box.h); ctx.lineTo(box.x + len, box.y + box.h); ctx.stroke();
    // Bottom Right
    ctx.beginPath(); ctx.moveTo(box.x + box.w - len, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h - len); ctx.stroke();
}

function takePhoto() {
    const countdownEl = document.getElementById('countdown');
    countdownEl.innerText = "CAPTURING...";

    setTimeout(() => {
        countdownEl.innerText = "";

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 420; 
        tempCanvas.height = 420;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.translate(420, 0);
        tempCtx.scale(-1, 1);

        let rawVideoX = WIDTH - (frameBox.x + frameBox.w);

        tempCtx.drawImage(
            videoElement,
            rawVideoX, 
            frameBox.y,
            frameBox.w,
            frameBox.h,
            0, 0, 420, 420
        );

        capturedImgData = tempCanvas.toDataURL('image/jpeg', 0.9);
        startPuzzleGame();
    }, 500); 
}

function startPuzzleGame() {
    captureZone.classList.add('hidden');
    gameZone.classList.remove('hidden');

    hands.close();

    initPuzzle();
}

function initPuzzle() {
    tiles = [...solution];
   
    tiles.sort(() => Math.random() - 0.5);
    renderBoard();
}

function renderBoard() {
    board.innerHTML = '';
    tiles.forEach((tileIdx, i) => {
        const tile = document.createElement('div');
        tile.classList.add('tile');

        if (tileIdx === 8) {
            tile.classList.add('empty');
        } else {
            tile.style.backgroundImage = `url(${capturedImgData})`;
            const row = Math.floor(tileIdx / 3);
            const col = tileIdx % 3;
        
            tile.style.backgroundPosition = `-${col * 140}px -${row * 140}px`;

    
            tile.setAttribute('data-hint', tileIdx + 1);

            tile.onclick = () => moveTile(i);
        }
        board.appendChild(tile);
    });
}

function moveTile(index) {
    const emptyIndex = tiles.indexOf(8);

    const row = Math.floor(index / 3);
    const col = index % 3;
    const emptyRow = Math.floor(emptyIndex / 3);
    const emptyCol = emptyIndex % 3;

    const isAdjacent = Math.abs(row - emptyRow) + Math.abs(col - emptyCol) === 1;

    if (isAdjacent) {
        [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
        renderBoard(); 
        checkWin();
    }
}

function checkWin() {
    if (tiles.every((val, index) => val === solution[index])) {
        const winScreen = document.getElementById('win-screen');
        if (winScreen) winScreen.classList.remove('hidden');
    }
}

document.getElementById('reset-btn').onclick = () => location.reload();

document.getElementById('hint-btn').onclick = () => {
    const hintBtn = document.getElementById('hint-btn');
    const puzzleBoard = document.getElementById('puzzle-board');

    hintVisible = !hintVisible;

    if (hintVisible) {
        puzzleBoard.classList.add('show-hint'); 
        hintBtn.innerText = "SEMBUNYIKAN HINT";
        hintBtn.classList.add('active'); 
    } else {
        puzzleBoard.classList.remove('show-hint');
        hintBtn.innerText = "LIHAT HINT (NOMOR)";
        hintBtn.classList.remove('active');
    }
};

document.getElementById('auto-win-btn').onclick = () => {
    tiles = [...solution];
    renderBoard();
    checkWin();
};