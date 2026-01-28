import React, { useState, useEffect, useRef } from 'react';

const ModernTetris = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [combo, setCombo] = useState(0);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 900;
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 35;
  const BOARD_X = 200;
  const BOARD_Y = 100;

  const gameRef = useRef({
    board: [],
    currentPiece: null,
    nextPiece: null,
    pieceX: 0,
    pieceY: 0,
    keys: {},
    dropCounter: 0,
    dropInterval: 1000,
    lastTime: 0,
    particles: [],
    lineFlash: [],
    animationId: null,
    comboCount: 0
  });

  const PIECES = {
    I: { shape: [[1,1,1,1]], color: '#00f5ff' },
    O: { shape: [[1,1],[1,1]], color: '#ffd700' },
    T: { shape: [[0,1,0],[1,1,1]], color: '#a855f7' },
    S: { shape: [[0,1,1],[1,1,0]], color: '#22c55e' },
    Z: { shape: [[1,1,0],[0,1,1]], color: '#ef4444' },
    J: { shape: [[1,0,0],[1,1,1]], color: '#3b82f6' },
    L: { shape: [[0,0,1],[1,1,1]], color: '#f97316' }
  };

  const createPiece = () => {
    const pieces = Object.keys(PIECES);
    const type = pieces[Math.floor(Math.random() * pieces.length)];
    return { type, ...PIECES[type] };
  };

  const initGame = () => {
    const game = gameRef.current;
    game.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    game.currentPiece = createPiece();
    game.nextPiece = createPiece();
    game.pieceX = Math.floor(COLS / 2) - 1;
    game.pieceY = 0;
    game.dropInterval = 1000;
    game.particles = [];
    game.lineFlash = [];
    game.comboCount = 0;
    setCombo(0);
  };

  const rotate = (piece) => {
    const rotated = piece[0].map((_, i) => piece.map(row => row[i]).reverse());
    return rotated;
  };

  const collides = (board, piece, offsetX, offsetY) => {
    for (let y = 0; y < piece.length; y++) {
      for (let x = 0; x < piece[y].length; x++) {
        if (piece[y][x] !== 0) {
          const newX = x + offsetX;
          const newY = y + offsetY;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          if (newY >= 0 && board[newY][newX] !== 0) return true;
        }
      }
    }
    return false;
  };

  const merge = (board, piece, offsetX, offsetY, color) => {
    piece.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const boardY = y + offsetY;
          const boardX = x + offsetX;
          if (boardY >= 0) {
            board[boardY][boardX] = color;
          }
        }
      });
    });
  };

  const createParticles = (x, y, color) => {
    const game = gameRef.current;
    for (let i = 0; i < 15; i++) {
      game.particles.push({
        x: BOARD_X + x * BLOCK_SIZE + BLOCK_SIZE / 2,
        y: BOARD_Y + y * BLOCK_SIZE + BLOCK_SIZE / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 60,
        maxLife: 60,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const clearLines = () => {
    const game = gameRef.current;
    let linesCleared = 0;
    const clearedRows = [];

    for (let y = ROWS - 1; y >= 0; y--) {
      if (game.board[y].every(cell => cell !== 0)) {
        clearedRows.push(y);
        game.lineFlash.push({ row: y, alpha: 1.0 });
        
        for (let x = 0; x < COLS; x++) {
          createParticles(x, y, game.board[y][x]);
        }
        
        linesCleared++;
      }
    }

    if (linesCleared > 0) {
      setTimeout(() => {
        clearedRows.forEach(row => {
          game.board.splice(row, 1);
          game.board.unshift(Array(COLS).fill(0));
        });
        game.lineFlash = [];
      }, 200);

      game.comboCount++;
      setCombo(game.comboCount);

      const basePoints = [0, 100, 300, 500, 800];
      const points = basePoints[linesCleared] * level * game.comboCount;
      setScore(s => s + points);
      setLines(l => {
        const newLines = l + linesCleared;
        const newLevel = Math.floor(newLines / 10) + 1;
        setLevel(newLevel);
        game.dropInterval = Math.max(100, 1000 - (newLevel - 1) * 80);
        return newLines;
      });
    } else {
      game.comboCount = 0;
      setCombo(0);
    }
  };

  const drop = () => {
    const game = gameRef.current;
    game.pieceY++;
    if (collides(game.board, game.currentPiece.shape, game.pieceX, game.pieceY)) {
      game.pieceY--;
      merge(game.board, game.currentPiece.shape, game.pieceX, game.pieceY, game.currentPiece.color);
      clearLines();
      
      game.currentPiece = game.nextPiece;
      game.nextPiece = createPiece();
      game.pieceX = Math.floor(COLS / 2) - 1;
      game.pieceY = 0;

      if (collides(game.board, game.currentPiece.shape, game.pieceX, game.pieceY)) {
        setGameState('gameover');
      }
    }
    game.dropCounter = 0;
  };

  const hardDrop = () => {
    const game = gameRef.current;
    while (!collides(game.board, game.currentPiece.shape, game.pieceX, game.pieceY + 1)) {
      game.pieceY++;
    }
    drop();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const game = gameRef.current;

    const handleKeyDown = (e) => {
      if (gameState !== 'playing') return;
      
      game.keys[e.key] = true;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        game.pieceX--;
        if (collides(game.board, game.currentPiece.shape, game.pieceX, game.pieceY)) {
          game.pieceX++;
        }
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        game.pieceX++;
        if (collides(game.board, game.currentPiece.shape, game.pieceX, game.pieceY)) {
          game.pieceX--;
        }
      }
      if (e.key === 'ArrowDown' || e.key === 's') {
        drop();
      }
      if (e.key === 'ArrowUp' || e.key === ' ') {
        const rotated = rotate(game.currentPiece.shape);
        if (!collides(game.board, rotated, game.pieceX, game.pieceY)) {
          game.currentPiece.shape = rotated;
        }
      }
      if (e.key === 'Escape') {
        setGameState('paused');
      }
      e.preventDefault();
    };

    const handleKeyUp = (e) => {
      game.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const drawBlock = (x, y, color, highlight = false) => {
      const px = BOARD_X + x * BLOCK_SIZE;
      const py = BOARD_Y + y * BLOCK_SIZE;
      const size = BLOCK_SIZE - 2;

      // Gradient background
      const gradient = ctx.createLinearGradient(px, py, px + size, py + size);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '99');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(px + 1, py + 1, size, size);

      // Glow effect
      if (highlight) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.fillRect(px + 1, py + 1, size, size);
        ctx.shadowBlur = 0;
      }

      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, size, size);

      // Highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3, py + 3, size - 4, size - 4);
    };

    const drawGhost = () => {
      let ghostY = game.pieceY;
      while (!collides(game.board, game.currentPiece.shape, game.pieceX, ghostY + 1)) {
        ghostY++;
      }

      game.currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const px = BOARD_X + (x + game.pieceX) * BLOCK_SIZE;
            const py = BOARD_Y + (y + ghostY) * BLOCK_SIZE;
            ctx.strokeStyle = game.currentPiece.color + '66';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
          }
        });
      });
    };

    const updateParticles = () => {
      for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life--;

        if (p.life <= 0) {
          game.particles.splice(i, 1);
        }
      }

      for (let i = game.lineFlash.length - 1; i >= 0; i--) {
        game.lineFlash[i].alpha -= 0.05;
        if (game.lineFlash[i].alpha <= 0) {
          game.lineFlash.splice(i, 1);
        }
      }
    };

    const drawParticles = () => {
      game.particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      game.lineFlash.forEach(flash => {
        ctx.fillStyle = `rgba(255, 255, 255, ${flash.alpha * 0.5})`;
        ctx.fillRect(BOARD_X, BOARD_Y + flash.row * BLOCK_SIZE, COLS * BLOCK_SIZE, BLOCK_SIZE);
      });
    };

    const draw = () => {
      // Background
      const bgGradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      bgGradient.addColorStop(0, '#0f172a');
      bgGradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Board background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(BOARD_X, BOARD_Y, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      
      // Board border with glow
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#06b6d4';
      ctx.strokeRect(BOARD_X, BOARD_Y, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      ctx.shadowBlur = 0;

      // Grid
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(BOARD_X, BOARD_Y + i * BLOCK_SIZE);
        ctx.lineTo(BOARD_X + COLS * BLOCK_SIZE, BOARD_Y + i * BLOCK_SIZE);
        ctx.stroke();
      }
      for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(BOARD_X + i * BLOCK_SIZE, BOARD_Y);
        ctx.lineTo(BOARD_X + i * BLOCK_SIZE, BOARD_Y + ROWS * BLOCK_SIZE);
        ctx.stroke();
      }

      // Draw board
      game.board.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            drawBlock(x, y, value);
          }
        });
      });

      // Draw ghost piece
      if (gameState === 'playing') {
        drawGhost();
      }

      // Draw current piece
      if (game.currentPiece) {
        game.currentPiece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value !== 0) {
              drawBlock(x + game.pieceX, y + game.pieceY, game.currentPiece.color, true);
            }
          });
        });
      }

      // Draw particles and effects
      drawParticles();

      // Next piece panel
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(570, 100, 180, 150);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.strokeRect(570, 100, 180, 150);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SIGUIENTE', 660, 130);

      if (game.nextPiece) {
        const offsetX = 640 - (game.nextPiece.shape[0].length * BLOCK_SIZE) / 2;
        const offsetY = 170;
        game.nextPiece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value !== 0) {
              const px = offsetX + x * BLOCK_SIZE;
              const py = offsetY + y * BLOCK_SIZE;
              const size = BLOCK_SIZE - 2;
              
              const gradient = ctx.createLinearGradient(px, py, px + size, py + size);
              gradient.addColorStop(0, game.nextPiece.color);
              gradient.addColorStop(1, game.nextPiece.color + '99');
              
              ctx.fillStyle = gradient;
              ctx.shadowBlur = 10;
              ctx.shadowColor = game.nextPiece.color;
              ctx.fillRect(px, py, size, size);
              ctx.shadowBlur = 0;
              
              ctx.strokeStyle = game.nextPiece.color;
              ctx.lineWidth = 2;
              ctx.strokeRect(px, py, size, size);
            }
          });
        });
      }

      // Stats panel
      const stats = [
        { label: 'PUNTOS', value: score, y: 300 },
        { label: 'LÍNEAS', value: lines, y: 400 },
        { label: 'NIVEL', value: level, y: 500 }
      ];

      stats.forEach(stat => {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(570, stat.y, 180, 80);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.strokeRect(570, stat.y, 180, 80);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(stat.label, 660, stat.y + 25);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px Arial';
        ctx.fillText(stat.value, 660, stat.y + 60);
      });

      // Combo indicator
      if (combo > 1) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fillRect(570, 610, 180, 60);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ef4444';
        ctx.strokeRect(570, 610, 180, 60);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`COMBO x${combo}`, 660, 645);
      }

      // Controls
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('← → Mover', 30, CANVAS_HEIGHT - 60);
      ctx.fillText('↑ / ESPACIO Rotar', 30, CANVAS_HEIGHT - 40);
      ctx.fillText('↓ Bajar', 30, CANVAS_HEIGHT - 20);
    };

    const update = (time = 0) => {
      if (gameState !== 'playing') {
        draw();
        return;
      }

      const deltaTime = time - game.lastTime;
      game.lastTime = time;
      game.dropCounter += deltaTime;

      if (game.dropCounter > game.dropInterval) {
        drop();
      }

      updateParticles();
      draw();
      game.animationId = requestAnimationFrame(update);
    };

    if (gameState === 'playing') {
      update();
    } else {
      draw();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (game.animationId) {
        cancelAnimationFrame(game.animationId);
      }
    };
  }, [gameState, score, lines, level, combo]);

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    initGame();
    setGameState('playing');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="mb-4">
        <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 text-center">
          TETRIS
        </h1>
        <p className="text-cyan-300 text-center text-lg">Modo Espectacular HD</p>
      </div>
      
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-4 border-cyan-500 rounded-lg shadow-2xl shadow-cyan-500/50"
      />

      {gameState === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
          <div className="text-center">
            <h2 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 mb-12 animate-pulse">
              TETRIS
            </h2>
            <button
              onClick={startGame}
              className="px-12 py-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-3xl font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/50"
            >
              INICIAR JUEGO
            </button>
            <div className="mt-12 text-slate-300 text-left max-w-md mx-auto space-y-2">
              <p className="text-xl text-cyan-400 font-bold mb-4">🎮 CONTROLES:</p>
              <p>⬅️ ➡️ Mover pieza</p>
              <p>⬆️ / ESPACIO Rotar</p>
              <p>⬇️ Bajar rápido</p>
              <p>ESC Pausar</p>
              <p className="mt-4 text-sm text-slate-400">
                💡 Completa líneas para puntuar. ¡Haz combos para multiplicar puntos!
              </p>
            </div>
          </div>
        </div>
      )}

      {gameState === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
          <div className="text-center">
            <h2 className="text-6xl font-bold text-cyan-400 mb-12">PAUSA</h2>
            <button
              onClick={() => setGameState('playing')}
              className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-2xl font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
            >
              CONTINUAR
            </button>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
          <div className="text-center">
            <h2 className="text-7xl font-bold text-red-500 mb-6">GAME OVER</h2>
            <div className="bg-slate-800 rounded-lg p-8 mb-8 border-2 border-red-500">
              <p className="text-3xl text-white mb-4">Puntuación Final</p>
              <p className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4">
                {score}
              </p>
              <div className="grid grid-cols-2 gap-4 text-left">
                <p className="text-slate-300">Líneas:</p>
                <p className="text-white font-bold">{lines}</p>
                <p className="text-slate-300">Nivel:</p>
                <p className="text-white font-bold">{level}</p>
              </div>
            </div>
            <button
              onClick={startGame}
              className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-2xl font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
            >
              JUGAR DE NUEVO
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernTetris;