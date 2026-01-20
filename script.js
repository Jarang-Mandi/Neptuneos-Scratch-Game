// VARIABEL DAN PERSIAPAN
const game = document.getElementById('game');
const msg = document.getElementById('message');
const lvl = document.getElementById('level');
const start = document.getElementById('startBtn');
const toggleBtn = document.getElementById('toggleMusic');
const themeBtn = document.getElementById('toggleTheme');
const sWin = document.getElementById('sound-win');
const sLose = document.getElementById('sound-lose');
const bgm = document.getElementById('sound-bgm');
const emojis = ["🍒","⭐","🍀","🔔","🥇","🍉","🍇","🍎","🎁","🎉"];

// Game State Management
let bombIdx = [];
let cellsRevealed = 0;
let gSize = 3;
let totalBombs = 1;
let totCells = 9;
let isMuted = false;
let gameActive = false;
let canRestart = true;

// Valid levels untuk validasi input
const validLevels = {
  easy: { size: 3, bombs: 1 },
  medium: { size: 4, bombs: 1 },
  hard: { size: 5, bombs: 2 }
};

// ERROR HANDLING - Validasi DOM elements
function validateDOMElements() {
  const elements = { game, msg, lvl, start, toggleBtn, themeBtn, sWin, sLose, bgm };
  for (const [key, el] of Object.entries(elements)) {
    if (!el) {
      console.error(`DOM element tidak ditemukan: ${key}`);
      return false;
    }
  }
  return true;
}

// GABUNG LOAD LISTENERS - Hindari duplicate event
window.addEventListener('load', () => {
  if (!validateDOMElements()) return;
  
  initializeUI();
  autoPlayMusic();
  // apply saved theme (default dark)
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
});

// Initialize UI - Popup rules
function initializeUI() {
  const popup = document.getElementById("popup-rules");
  const closeBtn = document.getElementById("popup-close");
  
  if (!popup || !closeBtn) {
    console.warn('Popup elements tidak ditemukan');
    return;
  }
  
  popup.style.display = "flex";
  
  closeBtn.addEventListener("click", () => {
    popup.style.display = "none";
    if (!isMuted) {
      autoPlayMusic();
    }
  });
}

// Auto play music dengan error handling
function autoPlayMusic() {
  if (!isMuted && bgm) {
    bgm.volume = 0.5;
    bgm.play().catch(err => {
      console.warn('Autoplay musik gagal:', err.message);
    });
  }
}

// Theme handling
function applyTheme(name) {
  if (name === 'light') {
    document.body.classList.add('light-mode');
    if (themeBtn) themeBtn.textContent = '☀️ Light';
  } else {
    document.body.classList.remove('light-mode');
    if (themeBtn) themeBtn.textContent = '🌑 Dark';
  }
  try { localStorage.setItem('theme', name); } catch (e) {}
}

if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light-mode');
    applyTheme(isLight ? 'dark' : 'light');
  });
}

// INIT GAME - Dengan input validation
function startGame() {
  // Prevent multiple starts
  if (!canRestart) return;
  canRestart = false;
  setTimeout(() => { canRestart = true; }, 500);
  // Ensure start button shows primary action while game is running
  start.textContent = 'Play Game';
  
  // Validasi level input
  const selectedLevel = lvl.value;
  if (!validLevels[selectedLevel]) {
    console.warn('Invalid level selected, reset ke easy');
    lvl.value = 'easy';
  }
  
  // Clear game state (avoid innerHTML for safety)
  while (game.firstChild) game.removeChild(game.firstChild);
  msg.textContent = '';
  // disable start to prevent re-entrancy
  start.disabled = true;
  // disable level selection during active game
  lvl.disabled = true;
  cellsRevealed = 0;
  gameActive = true; // LOCK game state
  
  // Set game parameters dari validLevels
  const levelConfig = validLevels[lvl.value];
  gSize = levelConfig.size;
  totalBombs = levelConfig.bombs;
  totCells = gSize * gSize;
  
  // Setup grid
  game.style.gridTemplateColumns = `repeat(${gSize}, auto)`;
  
  // Generate game
  setBombs();
  makeCells();
  
  // Audio control
  bgm.currentTime = 0;
  if (!isMuted) {
    bgm.play().catch(err => {
      console.warn('BGM play gagal:', err.message);
    });
    toggleBtn.textContent = "🔊 Music";
  } else {
    toggleBtn.textContent = "🔇 Mute Mode";
  }
}

// SET BOMBS - Gunakan Set untuk efisiensi
function setBombs() {
  const bombSet = new Set();
  while (bombSet.size < totalBombs) {
    bombSet.add(Math.floor(Math.random() * totCells));
  }
  bombIdx = Array.from(bombSet);
}

// MAKE CELLS
function makeCells() {
  for(let i = 0; i < totCells; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'cell-wrap';

    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.i = i;
    c.dataset.emoji = emojis[Math.floor(Math.random() * emojis.length)];
    c.textContent = c.dataset.emoji;
    wrap.appendChild(c);

    const canv = document.createElement('canvas');
    const size = window.innerWidth < 400 ? 39 : 60;
    canv.width = size;
    canv.height = size;
    canv.className = 'cover-canvas';
    canv.style.width = canv.style.height = size + "px";
    wrap.appendChild(canv);

    drawBlackCover(canv, size);
    setupScratchCanvas(canv, c, i);
    game.appendChild(wrap);
  }
}

// DRAW BLACK COVER
function drawBlackCover(canv, size) {
  const ctx = canv.getContext("2d");
  if (!ctx) {
    console.error('Canvas context tidak tersedia');
    return;
  }
  
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, 2 * Math.PI);
  ctx.clip();
  ctx.fillStyle = "#222";
  ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

// SETUP SCRATCH CANVAS
function setupScratchCanvas(canv, cellDiv, idx) {
  let isDown = false;
  let last = null;
  const size = canv.width;

  // Arrow function untuk lebih clean
  const handleMouseDown = (e) => {
    if (!gameActive) return;
    isDown = true;
    scratch(e);
  };

  const handleTouchStart = (e) => {
    if (!gameActive) return;
    isDown = true;
    scratch(e);
    e.preventDefault();
  };

  const handleMouseUp = () => {
    isDown = false;
    last = null;
  };

  const handleMouseLeave = () => {
    isDown = false;
    last = null;
  };

  const handleMouseMove = (e) => {
    if (isDown && gameActive) scratch(e);
  };

  const handleTouchMove = (e) => {
    if (isDown && gameActive) {
      scratch(e);
      e.preventDefault();
    }
  };

  // Event listeners
  canv.addEventListener('mousedown', handleMouseDown);
  canv.addEventListener('touchstart', handleTouchStart, { passive: false });
  canv.addEventListener('mouseup', handleMouseUp);
  canv.addEventListener('mouseleave', handleMouseLeave);
  canv.addEventListener('mousemove', handleMouseMove);
  canv.addEventListener('touchmove', handleTouchMove, { passive: false });

  function scratch(e) {
    if (!gameActive) return;
    
    const rect = canv.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ctx = canv.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, size/7, 0, Math.PI*2);
    ctx.fill();
    
    if (last !== null) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineWidth = size/6.2;
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    
    ctx.restore();
    last = { x: x, y: y };
    
    if (estimateScratched(canv, size) > 0.25) {
      canv.style.opacity = 0;
      setTimeout(() => {
        canv.style.display = 'none';
      }, 400);
      revealCell(cellDiv, idx);
    }
  }
}

// ESTIMATE SCRATCHED
function estimateScratched(canv, size) {
  const ctx = canv.getContext('2d');
  if (!ctx) return 0;
  let imgData;
  try {
    imgData = ctx.getImageData(0, 0, size, size).data;
  } catch (err) {
    console.warn('estimateScratched: getImageData failed, treating as fully scratched', err);
    return 1; // if reading pixels fails (e.g., tainted canvas), consider it scratched
  }
  let total = 0;
  let empty = 0;
  const r2 = (size/2) * (size/2);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size/2;
      const dy = y - size/2;
      
      if (dx*dx + dy*dy < r2) {
        total++;
        const idx = (y * size + x) * 4;
        if (imgData[idx+3] < 80) {
          empty++;
        }
      }
    }
  }
  
  return total > 0 ? empty / total : 0;
}

// REVEAL CELL - Dengan game state check
function revealCell(cellDiv, idx) {
  if (!gameActive || cellDiv.classList.contains('revealed')) return;
  
  cellDiv.classList.add('revealed');
  
  if (bombIdx.includes(idx)) {
    cellDiv.classList.add('bomb');
    cellDiv.textContent = '💣';
    finish(false);
  } else {
    cellsRevealed++;
    if (cellsRevealed === totCells - totalBombs) {
      finish(true);
    }
  }
}

// FINISH GAME
function finish(win) {
  gameActive = false; // LOCK game immediately
  
  const wraps = game.querySelectorAll('.cell-wrap');
  wraps.forEach(wrap => {
    const c = wrap.querySelector('.cell');
    const canv = wrap.querySelector('canvas');
    
    if (c) {
      c.classList.add('revealed');
      const cellIdx = parseInt(c.dataset.i);
      
      if (Number.isInteger(cellIdx) && bombIdx.includes(cellIdx)) {
        c.classList.add('bomb');
        c.textContent = '💣';
      }
    }
    
    if (canv) {
      canv.style.display = 'none';
    }
  });
  
  msg.textContent = win ? '🎉 You Win!' : '💥 NOOB! You Lose!';
  start.textContent = 'Play Again';
  // re-enable start for replay
  start.disabled = false;
  // re-enable level selection after game finishes
  lvl.disabled = false;
  bgm.pause();
  
  if (!isMuted) {
    const soundToPlay = win ? sWin : sLose;
    if (soundToPlay) {
      soundToPlay.play().catch(err => {
        console.warn('Sound play gagal:', err.message);
      });
    }
  }
}

// EVENT LISTENERS
start.addEventListener('click', startGame);

toggleBtn.addEventListener('click', () => {
  if (bgm.paused) {
    bgm.play().catch(err => {
      console.warn('BGM play gagal:', err.message);
    });
    toggleBtn.textContent = "🔊 Music";
    isMuted = false;
  } else {
    bgm.pause();
    toggleBtn.textContent = "🔇 Mute Mode";
    isMuted = true;
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  // Placeholder untuk future resize handling
});
