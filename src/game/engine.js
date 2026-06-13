/**
 * Color Dash Runner - Game Logic
 * Programmatic visual assets and sound synthesis.
 */

// Global Constants
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const GROUND_Y = 600;
const GRAVITY = 0.8;
const JUMP_FORCE = -17.5;
const DOUBLE_JUMP_FORCE = -14;
const BASE_SPEED = 7.5;
const MAX_SPEED = 18;
const SPEED_LEVEL_INTERVAL = 200; // Increase speed every 200 points
const SPEED_INCREASE_AMOUNT = 1.0;
const DUCK_HEIGHT_SCALE = 0.55;

// Spawning thresholds
const MIN_OBSTACLE_GAP = 380;
const FLYING_OBSTACLE_SCORE = 250;
const DOUBLE_JUMP_SCORE = 300;
const SPAWN_INTERVAL_MIN = 1200;
const SPAWN_INTERVAL_MAX = 2000;

// Power-up durations
const POWERUP_DURATION = 8000; // 8 seconds
const POWERUP_SPAWN_CHANCE = 0.1;
const COIN_SPAWN_CHANCE = 0.35;

// Motivational Quotes
const MOTIVATIONAL_MESSAGES = [
  "Awesome Jump!",
  "Great Speed!",
  "Unstoppable!",
  "Looking Good!",
  "Keep Going!",
  "Double Jump Unlocked!",
  "You're a Natural!",
  "Dash On!",
  "New Record Imminent!"
];

// Custom Character Colors
const CHAR_THEMES = {
  monster: {
    primary: '#a78bfa',   // Lavender/Purple
    secondary: '#ec4899', // Pink
    accent: '#22c55e',    // Green (Eye)
  },
  fox: {
    primary: '#f97316',   // Orange
    secondary: '#facc15', // Gold
    accent: '#ffffff',    // White fur
  },
  robot: {
    primary: '#94a3b8',   // Steel Gray
    secondary: '#06b6d4', // Cyan screen
    accent: '#3b82f6',    // Blue joints
  }
};

// ==========================================
// POLYFILLS & SAFETY UTILITIES
// ==========================================

// Polyfill for CanvasRenderingContext2D.prototype.roundRect
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    if (!radii) radii = 0;
    if (typeof radii === 'number') {
      radii = [radii, radii, radii, radii];
    } else if (Array.isArray(radii)) {
      if (radii.length === 1) radii = [radii[0], radii[0], radii[0], radii[0]];
      else if (radii.length === 2) radii = [radii[0], radii[1], radii[0], radii[1]];
      else if (radii.length === 3) radii = [radii[0], radii[1], radii[2], radii[1]];
    } else {
      radii = [0, 0, 0, 0];
    }
    const r1 = radii[0] || 0;
    const r2 = radii[1] || 0;
    const r3 = radii[2] || 0;
    const r4 = radii[3] || 0;
    this.beginPath();
    this.moveTo(x + r1, y);
    this.lineTo(x + w - r2, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r2);
    this.lineTo(x + w, y + h - r3);
    this.quadraticCurveTo(x + w, y + h, x + w - r3, y + h);
    this.lineTo(x + r4, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r4);
    this.lineTo(x, y + r1);
    this.quadraticCurveTo(x, y, x + r1, y);
    this.closePath();
    return this;
  };
}

// Safe Local Storage Helper (prevents SecurityError if run on local file protocols)
const safeStorage = {
  getItem(key, fallback = '') {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (e) {
      console.warn("Storage access blocked:", e);
      return fallback;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage access blocked:", e);
    }
  }
};

// ==========================================
// 1. SOUND MANAGER (WEB AUDIO API SYNTH)
// ==========================================
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.isMuted = false;
    this.musicInterval = null;
    this.musicStep = 0;
    this.isPlayingMusic = false;
    
    // Check local storage safely
    const storedMute = safeStorage.getItem('color_dash_muted', 'false');
    this.isMuted = storedMute === 'true';
  }

  init() {
    if (this.ctx) return;
    
    // Create Audio Context with try/catch
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        
        // Create Nodes
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.6, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(0.06, this.ctx.currentTime); // Low BGM volume
        this.musicGain.connect(this.masterGain);
      }
    } catch (e) {
      console.warn("Web Audio API failed to initialize:", e);
      this.ctx = null;
    }

    this.updateMuteUI();
  }

  resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.init();
    this.resumeContext();
    this.isMuted = !this.isMuted;
    safeStorage.setItem('color_dash_muted', this.isMuted ? 'true' : 'false');
    
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.6;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    
    this.updateMuteUI();
    this.playClick();
  }

  updateMuteUI() {
    const muteIcons = ['#start-mute-btn', '#pause-mute-btn', '#float-mute-btn'];
    muteIcons.forEach(selector => {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.textContent = this.isMuted ? '🔇' : '🔊';
      }
    });
  }

  // --- FX SYNTHESIS ---
  playClick() {
    if (!this.ctx) return;
    this.resumeContext();
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    
    gainNode.gain.setValueAtTime(0.15, t);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playJump(double = false) {
    if (!this.ctx) return;
    this.resumeContext();
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'triangle';
    
    const startFreq = double ? 260 : 180;
    const endFreq = double ? 750 : 580;
    const duration = double ? 0.18 : 0.15;
    
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    
    gainNode.gain.setValueAtTime(0.2, t);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  playCoin() {
    if (!this.ctx) return;
    this.resumeContext();
    const t = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    osc1.frequency.setValueAtTime(987.77, t); // B5 note
    osc1.frequency.setValueAtTime(1318.51, t + 0.08); // E6 note
    
    osc2.frequency.setValueAtTime(1975.53, t); // B6 note (sparkle overtone)
    osc2.frequency.setValueAtTime(2637.02, t + 0.08);
    
    gainNode.gain.setValueAtTime(0.12, t);
    gainNode.gain.setValueAtTime(0.08, t + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.005, t + 0.35);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.4);
    osc2.stop(t + 0.4);
  }

  playPowerUp() {
    if (!this.ctx) return;
    this.resumeContext();
    const t = this.ctx.currentTime;
    
    const notes = [329.63, 440.00, 523.25, 659.25, 880.00, 1046.50]; // Em/Am rising scale
    const noteDuration = 0.07;
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + (idx * noteDuration));
      
      gainNode.gain.setValueAtTime(0.15, t + (idx * noteDuration));
      gainNode.gain.exponentialRampToValueAtTime(0.01, t + (idx * noteDuration) + 0.12);
      
      osc.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      osc.start(t + (idx * noteDuration));
      osc.stop(t + (idx * noteDuration) + 0.15);
    });
  }

  playHit() {
    if (!this.ctx) return;
    this.resumeContext();
    const t = this.ctx.currentTime;
    
    // Synthesize heavy bass rumble
    const osc = this.ctx.createOscillator();
    const noiseFilter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(35, t + 0.55);
    
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(300, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(50, t + 0.55);
    
    gainNode.gain.setValueAtTime(0.4, t);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    
    osc.connect(noiseFilter);
    noiseFilter.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.65);
  }

  // --- RETRO SYNTH BGM GENERATOR ---
  startMusic() {
    this.init();
    this.resumeContext();
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    this.musicStep = 0;
    
    const tempo = 125; // BPM
    const stepDuration = 60 / tempo / 2; // Eighth notes
    
    // Bass notes arpeggio (Am -> F -> C -> G)
    const bassline = [
      110.00, 110.00, 110.00, 110.00, // A2
      87.31,  87.31,  87.31,  87.31,  // F2
      130.81, 130.81, 130.81, 130.81, // C3
      98.00,  98.00,  98.00,  98.00   // G2
    ];

    // High counter-melody
    const melody = [
      440.00, 0, 493.88, 523.25, 0, 587.33, 523.25, 0, // A4 -> B4 -> C5 -> D5 -> C5
      349.23, 0, 392.00, 440.00, 0, 392.00, 349.23, 0, // F4 -> G4 -> A4 -> G4 -> F4
      523.25, 0, 587.33, 659.25, 0, 698.46, 659.25, 0, // C5 -> D5 -> E5 -> F5 -> E5
      392.00, 0, 440.00, 493.88, 0, 392.00, 440.00, 0  // G4 -> A4 -> B4 -> G4 -> A4
    ];
    
    const scheduleNextBeats = () => {
      if (!this.ctx) return;
      const lookahead = 0.15;
      let nextStepTime = this.ctx.currentTime;
      
      this.musicInterval = setInterval(() => {
        if (!this.ctx) return;
        const currentTime = this.ctx.currentTime;
        while (nextStepTime < currentTime + lookahead) {
          if (!this.isPlayingMusic) break;
          
          this.playBgmStep(nextStepTime, bassline, melody, stepDuration);
          nextStepTime += stepDuration;
          this.musicStep = (this.musicStep + 1) % 32;
        }
      }, 50);
    };
    
    scheduleNextBeats();
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  playBgmStep(time, bassline, melody, stepDuration) {
    if (!this.ctx || this.isMuted) return;
    
    // Play bass note
    const bassIdx = this.musicStep % 16;
    const bassFreq = bassline[bassIdx];
    
    const bassOsc = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    const bassGain = this.ctx.createGain();
    
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, time);
    
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(200, time);
    
    bassGain.gain.setValueAtTime(0.08, time);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration - 0.02);
    
    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.musicGain);
    
    bassOsc.start(time);
    bassOsc.stop(time + stepDuration);

    // Play melody note (if present)
    const melodyFreq = melody[this.musicStep];
    if (melodyFreq > 0) {
      const melOsc = this.ctx.createOscillator();
      const melGain = this.ctx.createGain();
      
      melOsc.type = 'triangle';
      melOsc.frequency.setValueAtTime(melodyFreq, time);
      
      melGain.gain.setValueAtTime(0.03, time);
      melGain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 2 - 0.05);
      
      melOsc.connect(melGain);
      melGain.connect(this.musicGain);
      
      melOsc.start(time);
      melOsc.stop(time + stepDuration * 1.8);
    }
  }
}

export const sounds = new SoundManager();

// ==========================================
// 2. INPUT MANAGER
// ==========================================
class InputManager {
  constructor() {
    this.keys = {};
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.onJumpCallback = null;
    this.onDuckStartCallback = null;
    this.onDuckEndCallback = null;
    this.onPauseCallback = null;
    this.onMuteCallback = null;
    this.onRestartCallback = null;

    this.initListeners();
  }

  initListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      const key = e.code;
      this.keys[key] = true;
      
      // Prevent screen scroll with space and arrows
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(key)) {
        e.preventDefault();
      }

      if ((key === 'Space' || key === 'ArrowUp') && this.onJumpCallback) {
        this.onJumpCallback();
      }
      if (key === 'ArrowDown' && this.onDuckStartCallback) {
        this.onDuckStartCallback();
      }
      if (key === 'KeyP' && this.onPauseCallback) {
        this.onPauseCallback();
      }
      if (key === 'KeyM' && this.onMuteCallback) {
        this.onMuteCallback();
      }
      if (key === 'Enter' && this.onRestartCallback) {
        this.onRestartCallback();
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.code;
      this.keys[key] = false;
      if (key === 'ArrowDown' && this.onDuckEndCallback) {
        this.onDuckEndCallback();
      }
    });

    // Touch Screen gestures
    window.addEventListener('touchstart', (e) => {
      // Don't trigger if tapping on virtual buttons or menu panels
      if (e.target.closest('button') || e.target.closest('#hud') || e.target.closest('.overlay-screen')) return;
      
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      
      // Default tap triggers jump
      if (this.onJumpCallback) {
        this.onJumpCallback();
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!this.touchStartX || !this.touchStartY) return;
      
      const deltaY = e.touches[0].clientY - this.touchStartY;
      
      if (deltaY < -40) { // Swiped UP
        if (this.onJumpCallback) this.onJumpCallback();
        this.touchStartY = 0; // reset
      } else if (deltaY > 40) { // Swiped DOWN
        if (this.onDuckStartCallback) this.onDuckStartCallback();
        this.touchStartY = 0; // reset
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      this.touchStartX = 0;
      this.touchStartY = 0;
      if (this.onDuckEndCallback) {
        this.onDuckEndCallback();
      }
    });

    // Mobile UI Buttons
    const ctrlJump = document.getElementById('ctrl-jump');
    const ctrlDuck = document.getElementById('ctrl-duck');

    if (ctrlJump) {
      // Mouse/Touch events for jump button
      ctrlJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onJumpCallback) this.onJumpCallback();
      });
      ctrlJump.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (this.onJumpCallback) this.onJumpCallback();
      });
    }

    if (ctrlDuck) {
      ctrlDuck.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onDuckStartCallback) this.onDuckStartCallback();
      });
      ctrlDuck.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (this.onDuckEndCallback) this.onDuckEndCallback();
      });
      ctrlDuck.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (this.onDuckStartCallback) this.onDuckStartCallback();
      });
      ctrlDuck.addEventListener('mouseup', (e) => {
        e.preventDefault();
        if (this.onDuckEndCallback) this.onDuckEndCallback();
      });
      ctrlDuck.addEventListener('mouseleave', (e) => {
        if (this.onDuckEndCallback) this.onDuckEndCallback();
      });
    }
  }
}

// ==========================================
// 3. PARALLAX BACKGROUND
// ==========================================
class Background {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Parallax layers config (multiplier relative to gameSpeed)
    this.layers = {
      clouds: { items: [], speedMult: 0.08 },
      mountains: { offset: 0, speedMult: 0.15 },
      city: { offset: 0, speedMult: 0.35 },
      ground: { offset: 0, speedMult: 1.0 }
    };
    
    this.skyGradientStart = '#1e1b4b'; // Deep violet
    this.skyGradientEnd = '#020617';   // Deep black/indigo
    
    this.stars = [];
    this.generateStars();
    this.generateClouds();
  }

  generateStars() {
    this.stars = [];
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * 250,
        size: Math.random() * 2 + 0.5,
        twinkleSpeed: 0.02 + Math.random() * 0.05,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
  }

  generateClouds() {
    this.layers.clouds.items = [];
    for (let i = 0; i < 6; i++) {
      this.layers.clouds.items.push({
        x: Math.random() * CANVAS_WIDTH + (i * 250),
        y: 50 + Math.random() * 120,
        width: 100 + Math.random() * 100,
        height: 35 + Math.random() * 25,
        speed: 0.15 + Math.random() * 0.25
      });
    }
  }

  update(gameSpeed, score) {
    // Dynamic Sky color shift based on score
    const cycle = Math.sin(score / 500) * 0.5 + 0.5; // 0 to 1 cycle
    // Blend from Deep Violet/Black into Neon Purple/Deep Blue
    const r1 = Math.floor(30 + cycle * 45);
    const g1 = Math.floor(27 + cycle * 10);
    const b1 = Math.floor(75 + cycle * 35);
    
    this.skyGradientStart = `rgb(${r1}, ${g1}, ${b1})`;
    this.skyGradientEnd = '#020617';
    
    // Update Cloud coordinates
    this.layers.clouds.items.forEach(cloud => {
      cloud.x -= cloud.speed + (gameSpeed * this.layers.clouds.speedMult);
      if (cloud.x + cloud.width < 0) {
        cloud.x = CANVAS_WIDTH + 50 + Math.random() * 100;
        cloud.y = 50 + Math.random() * 120;
      }
    });

    // Update layer offsets
    this.layers.mountains.offset = (this.layers.mountains.offset - gameSpeed * this.layers.mountains.speedMult) % CANVAS_WIDTH;
    this.layers.city.offset = (this.layers.city.offset - gameSpeed * this.layers.city.speedMult) % CANVAS_WIDTH;
    this.layers.ground.offset = (this.layers.ground.offset - gameSpeed * this.layers.ground.speedMult) % CANVAS_WIDTH;

    // Twinkle stars
    this.stars.forEach(star => {
      star.twinklePhase += star.twinkleSpeed;
    });
  }

  draw(score) {
    // 1. Sky Gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, this.skyGradientStart);
    skyGrad.addColorStop(1, this.skyGradientEnd);
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Stars
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.stars.forEach(star => {
      const alpha = 0.3 + Math.sin(star.twinklePhase) * 0.5;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // 3. Clouds (Drawn with multiple overlapping circles for fluffy look)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.layers.clouds.items.forEach(cloud => {
      this.ctx.beginPath();
      const radius = cloud.height / 2;
      this.ctx.arc(cloud.x + radius, cloud.y + radius, radius, Math.PI * 0.5, Math.PI * 1.5);
      this.ctx.arc(cloud.x + radius + cloud.width * 0.3, cloud.y + radius - radius * 0.4, radius * 1.3, Math.PI, Math.PI * 2);
      this.ctx.arc(cloud.x + radius + cloud.width * 0.6, cloud.y + radius - radius * 0.2, radius * 1.1, Math.PI * 1.2, Math.PI * 2);
      this.ctx.arc(cloud.x + cloud.width - radius, cloud.y + radius, radius, Math.PI * 1.5, Math.PI * 0.5);
      this.ctx.closePath();
      this.ctx.fill();
    });

    // 4. Distant Mountains Layer (Bezier shapes, deep lavender gradient)
    this.drawMountains();

    // 5. City Silhouette Layer (Parallax skyscrapers with glowing windows)
    this.drawCitySkyline();

    // 6. Ground
    this.drawGround();
  }

  drawMountains() {
    this.ctx.save();
    const mountainGrad = this.ctx.createLinearGradient(0, 200, 0, GROUND_Y);
    mountainGrad.addColorStop(0, 'rgba(124, 58, 237, 0.18)'); // Purple 600
    mountainGrad.addColorStop(1, 'rgba(15, 23, 42, 0.8)');
    this.ctx.fillStyle = mountainGrad;

    const drawCurve = (offset) => {
      this.ctx.beginPath();
      this.ctx.moveTo(offset, GROUND_Y);
      this.ctx.bezierCurveTo(
        offset + CANVAS_WIDTH * 0.25, 280,
        offset + CANVAS_WIDTH * 0.5, 220,
        offset + CANVAS_WIDTH * 0.75, 330
      );
      this.ctx.bezierCurveTo(
        offset + CANVAS_WIDTH, 240,
        offset + CANVAS_WIDTH * 1.25, 280,
        offset + CANVAS_WIDTH * 1.5, GROUND_Y
      );
      this.ctx.lineTo(offset + CANVAS_WIDTH * 2, GROUND_Y);
      this.ctx.lineTo(offset, GROUND_Y);
      this.ctx.fill();
    };

    drawCurve(this.layers.mountains.offset);
    drawCurve(this.layers.mountains.offset + CANVAS_WIDTH);
    this.ctx.restore();
  }

  drawCitySkyline() {
    this.ctx.save();
    const cityGrad = this.ctx.createLinearGradient(0, 300, 0, GROUND_Y);
    cityGrad.addColorStop(0, 'rgba(30, 41, 59, 0.45)'); // Slate 800
    cityGrad.addColorStop(1, 'rgba(10, 15, 30, 0.95)');
    this.ctx.fillStyle = cityGrad;

    // Define building heights
    const buildingWidths = [70, 90, 60, 110, 80, 100, 75, 85];
    const buildingHeights = [220, 310, 190, 270, 240, 340, 200, 280];
    
    const drawSkyline = (offset) => {
      let currentX = offset;
      for (let i = 0; i < buildingWidths.length * 2; i++) {
        const idx = i % buildingWidths.length;
        const w = buildingWidths[idx];
        const h = buildingHeights[idx];
        const y = GROUND_Y - h;

        this.ctx.fillRect(currentX, y, w, h);
        
        // Draw little glowing windows
        this.ctx.fillStyle = 'rgba(253, 224, 71, 0.12)'; // Soft yellow glow
        const windowCols = Math.floor(w / 20);
        const windowRows = Math.floor(h / 30);
        
        for (let col = 0; col < windowCols; col++) {
          for (let row = 0; row < windowRows; row++) {
            // Randomly skip windows to make it look active
            if ((col + row + idx) % 5 !== 0) {
              this.ctx.fillRect(
                currentX + 8 + col * 18,
                y + 12 + row * 24,
                6,
                10
              );
            }
          }
        }
        this.ctx.fillStyle = cityGrad; // reset color
        currentX += w + 8; // Small gap between structures
      }
    };

    drawSkyline(this.layers.city.offset);
    drawSkyline(this.layers.city.offset + CANVAS_WIDTH * 1.2);
    this.ctx.restore();
  }

  drawGround() {
    this.ctx.save();
    
    // Top border of ground - glowing neon cyan line
    this.ctx.shadowColor = '#06b6d4';
    this.ctx.shadowBlur = 10;
    this.ctx.strokeStyle = '#22d3ee';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(0, GROUND_Y);
    this.ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    this.ctx.stroke();
    
    // Reset shadow
    this.ctx.shadowBlur = 0;

    // Ground fill - solid dark pattern
    const groundGrad = this.ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
    groundGrad.addColorStop(0, '#0c152b');
    groundGrad.addColorStop(1, '#020617');
    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // Decorative ground speed lines
    this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)'; // Purple line grid
    this.ctx.lineWidth = 2;
    const lineSpacing = 160;
    const offset = this.layers.ground.offset % lineSpacing;

    // Perspective lines extending from center of ground
    for (let x = offset - lineSpacing; x < CANVAS_WIDTH + lineSpacing; x += lineSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, GROUND_Y);
      this.ctx.lineTo(x - 200, CANVAS_HEIGHT);
      this.ctx.stroke();
    }

    // Horizontal speed lines
    this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
    for (let y = GROUND_Y + 15; y < CANVAS_HEIGHT; y += 30) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(CANVAS_WIDTH, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}

// ==========================================
// 4. PARTICLE SYSTEM
// ==========================================
class Particle {
  constructor(x, y, color, type = 'dust') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.alpha = 1.0;
    
    // Random velocity configurations based on type
    if (type === 'dust') {
      this.vx = -Math.random() * 2 - 1.5;
      this.vy = -Math.random() * 1.5;
      this.size = Math.random() * 6 + 4;
      this.decay = 0.035;
    } else if (type === 'sparkle') {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = Math.random() * 4 + 2;
      this.decay = 0.02;
    } else if (type === 'explosion') {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 3;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = Math.random() * 8 + 3;
      this.decay = 0.018;
    } else if (type === 'confetti') {
      this.vx = (Math.random() - 0.5) * 8;
      this.vy = -Math.random() * 8 - 4;
      this.size = Math.random() * 10 + 6;
      this.decay = 0.012;
      this.rot = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.2;
    } else {
      this.vx = -1;
      this.vy = 0;
      this.size = 5;
      this.decay = 0.05;
    }
  }

  update(gameSpeed) {
    if (this.type === 'dust') {
      // Dust floats backward
      this.x += this.vx;
      this.y += this.vy;
    } else if (this.type === 'confetti') {
      // Confetti falls down
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.25; // gravity pull
      this.rot += this.rotSpeed;
    } else {
      // Explode out
      this.x += this.vx;
      this.y += this.vy;
    }
    
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    
    if (this.type === 'confetti') {
      ctx.fillStyle = this.color;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size/2);
    } else if (this.type === 'sparkle') {
      // Draw small four-point star sparkle
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - this.size);
      ctx.quadraticCurveTo(this.x, this.y, this.x + this.size, this.y);
      ctx.quadraticCurveTo(this.x, this.y, this.x, this.y + this.size);
      ctx.quadraticCurveTo(this.x, this.y, this.x - this.size, this.y);
      ctx.quadraticCurveTo(this.x, this.y, this.x, this.y - this.size);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

class ParticleManager {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, color, type, count = 1) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color, type));
    }
  }

  spawnConfetti() {
    const colors = ['#f43f5e', '#ec4899', '#d946ef', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'];
    // Left edge rocket confetti
    for (let i = 0; i < 40; i++) {
      this.spawn(
        50 + Math.random() * 100, 
        CANVAS_HEIGHT - 50, 
        colors[Math.floor(Math.random() * colors.length)], 
        'confetti', 
        1
      );
    }
    // Right edge rocket confetti
    for (let i = 0; i < 40; i++) {
      this.spawn(
        CANVAS_WIDTH - 150 + Math.random() * 100, 
        CANVAS_HEIGHT - 50, 
        colors[Math.floor(Math.random() * colors.length)], 
        'confetti', 
        1
      );
    }
  }

  update(gameSpeed) {
    this.particles.forEach(p => p.update(gameSpeed));
    this.particles = this.particles.filter(p => p.alpha > 0);
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
  }

  clear() {
    this.particles = [];
  }
}

// ==========================================
// 5. PLAYER CHARACTER
// ==========================================
class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Core parameters
    this.baseWidth = 75;
    this.baseHeight = 85;
    this.x = 180;
    this.y = GROUND_Y - this.baseHeight;
    this.width = this.baseWidth;
    this.height = this.baseHeight;
    
    // Physics
    this.vy = 0;
    this.isOnGround = true;
    this.jumpCount = 0;
    this.maxJumps = 1; // Double jump unlocked at score 300
    
    // Status states
    this.state = 'running'; // 'running', 'jumping', 'ducking', 'hit'
    this.characterType = 'monster'; // 'monster', 'fox', 'robot'
    
    // Animations
    this.runCycle = 0;
    this.trailParticles = [];
    this.trailTimer = 0;
    
    // Active powerups
    this.hasShield = false;
    this.hasMagnet = false;
    this.shieldTime = 0;
    this.magnetTime = 0;
    this.pulsePhase = 0;
  }

  reset(characterType = 'monster') {
    this.characterType = characterType;
    this.width = this.baseWidth;
    this.height = this.baseHeight;
    this.x = 180;
    this.y = GROUND_Y - this.height;
    this.vy = 0;
    this.isOnGround = true;
    this.jumpCount = 0;
    this.maxJumps = 1;
    this.state = 'running';
    this.runCycle = 0;
    this.hasShield = false;
    this.hasMagnet = false;
    this.shieldTime = 0;
    this.magnetTime = 0;
  }

  update(input, score, gameSpeed, pm) {
    this.pulsePhase += 0.1;

    // Check high score to unlock double jump
    this.maxJumps = score >= DOUBLE_JUMP_SCORE ? 2 : 1;

    // Power-up count down
    if (this.hasShield) {
      this.shieldTime -= 1000 / 60; // Approximate frames (60fps)
      if (this.shieldTime <= 0) this.hasShield = false;
    }
    if (this.hasMagnet) {
      this.magnetTime -= 1000 / 60;
      if (this.magnetTime <= 0) this.hasMagnet = false;
    }

    // Apply physical controls
    if (this.state !== 'hit') {
      // Ducking checks
      if (input.keys['ArrowDown'] || input.keys['KeyS']) {
        this.startDucking();
      } else {
        this.stopDucking();
      }
    }

    // Handle Gravity physics
    if (!this.isOnGround) {
      this.vy += GRAVITY;
      this.y += this.vy;
      
      // Hit ground
      const groundLimit = GROUND_Y - this.height;
      if (this.y >= groundLimit) {
        this.y = groundLimit;
        this.vy = 0;
        this.isOnGround = true;
        this.jumpCount = 0;
        if (this.state !== 'hit' && this.state !== 'ducking') {
          this.state = 'running';
        }
      }
    }

    // Running animations and dust spawning
    if (this.state === 'running' && gameSpeed > 0) {
      this.runCycle += gameSpeed * 0.04;
      this.trailTimer++;
      if (this.trailTimer % 4 === 0) {
        // Spawn footstep dust
        const footX = this.x + 10;
        const footY = GROUND_Y - 2;
        const theme = CHAR_THEMES[this.characterType];
        pm.spawn(footX, footY, 'rgba(255, 255, 255, 0.45)', 'dust', 1);
      }
    }

    // Double-jump trail particle spawn
    if (this.state === 'jumping' && this.jumpCount === 2) {
      const theme = CHAR_THEMES[this.characterType];
      pm.spawn(this.x + this.width / 2, this.y + this.height - 10, theme.secondary, 'sparkle', 2);
    }
  }

  jump() {
    if (this.state === 'hit') return;
    
    // Duck cancel jump
    if (this.state === 'ducking') {
      this.stopDucking();
    }

    if (this.isOnGround) {
      this.vy = JUMP_FORCE;
      this.isOnGround = false;
      this.jumpCount = 1;
      this.state = 'jumping';
      sounds.playJump(false);
    } else if (this.jumpCount < this.maxJumps) {
      // Double jump
      this.vy = DOUBLE_JUMP_FORCE;
      this.jumpCount++;
      sounds.playJump(true);
    }
  }

  startDucking() {
    if (this.state === 'hit' || !this.isOnGround) return;
    if (this.state !== 'ducking') {
      this.state = 'ducking';
      this.height = this.baseHeight * DUCK_HEIGHT_SCALE;
      this.y = GROUND_Y - this.height;
    }
  }

  stopDucking() {
    if (this.state === 'ducking') {
      this.state = this.isOnGround ? 'running' : 'jumping';
      this.height = this.baseHeight;
      this.y = GROUND_Y - this.height;
    }
  }

  activateShield() {
    this.hasShield = true;
    this.shieldTime = POWERUP_DURATION;
    sounds.playPowerUp();
  }

  activateMagnet() {
    this.hasMagnet = true;
    this.magnetTime = POWERUP_DURATION;
    sounds.playPowerUp();
  }

  getHitBox() {
    // Return a slightly smaller bounding box for gameplay fairness
    const paddingX = this.width * 0.15;
    const paddingY = this.height * 0.1;
    return {
      x: this.x + paddingX,
      y: this.y + paddingY,
      width: this.width - paddingX * 2,
      height: this.height - paddingY * 2
    };
  }

  draw() {
    this.ctx.save();
    
    const theme = CHAR_THEMES[this.characterType];
    const isRunning = this.state === 'running';
    const isJumping = this.state === 'jumping';
    const isDucking = this.state === 'ducking';
    const isHit = this.state === 'hit';

    // Character trail glow effect at high speed
    if (isJumping && this.jumpCount === 2) {
      this.ctx.shadowColor = theme.secondary;
      this.ctx.shadowBlur = 15;
    }

    if (this.characterType === 'monster') {
      this.drawMonster(theme, isRunning, isJumping, isDucking, isHit);
    } else if (this.characterType === 'fox') {
      this.drawFox(theme, isRunning, isJumping, isDucking, isHit);
    } else if (this.characterType === 'robot') {
      this.drawRobot(theme, isRunning, isJumping, isDucking, isHit);
    }

    // Draw active Power-up visual filters
    this.drawPowerups();

    this.ctx.restore();
  }

  // --- CHARACTER DRAWINGS ---
  drawMonster(theme, isRunning, isJumping, isDucking, isHit) {
    const w = this.width;
    const h = this.height;
    const bounceY = isRunning ? Math.sin(this.runCycle) * 4 : 0;
    
    this.ctx.translate(this.x, this.y + bounceY);

    // Body Gradient
    const bodyGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    bodyGrad.addColorStop(0, theme.primary);
    bodyGrad.addColorStop(1, theme.secondary);
    this.ctx.fillStyle = bodyGrad;

    // Draw Rounded Monster Body
    this.ctx.beginPath();
    this.ctx.roundRect(0, 0, w, h - 10, [30, 30, 15, 15]);
    this.ctx.fill();

    // Horns
    this.ctx.fillStyle = '#facc15'; // Gold horns
    this.ctx.beginPath();
    // Left Horn
    this.ctx.moveTo(10, 0);
    this.ctx.quadraticCurveTo(0, -15, -10, -5);
    this.ctx.quadraticCurveTo(3, -5, 10, 5);
    // Right Horn
    this.ctx.moveTo(w - 10, 0);
    this.ctx.quadraticCurveTo(w, -15, w + 10, -5);
    this.ctx.quadraticCurveTo(w - 3, -5, w - 10, 5);
    this.ctx.fill();

    // Large Center Eye
    const eyeX = w / 2;
    const eyeY = h * 0.35;
    const eyeRadius = isDucking ? 13 : 18;
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Pupil
    this.ctx.fillStyle = isHit ? '#ef4444' : theme.accent;
    this.ctx.beginPath();
    if (isHit) {
      // X-eye when hit
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.beginPath();
      this.ctx.moveTo(eyeX - 6, eyeY - 6);
      this.ctx.lineTo(eyeX + 6, eyeY + 6);
      this.ctx.moveTo(eyeX + 6, eyeY - 6);
      this.ctx.lineTo(eyeX - 6, eyeY + 6);
      this.ctx.stroke();
    } else {
      this.ctx.arc(eyeX, eyeY, eyeRadius * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
      // Eye reflection
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(eyeX - 3, eyeY - 3, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Mouth / Teeth
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    if (isHit) {
      // Sad line
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.arc(w / 2, h * 0.65, 8, Math.PI, 0);
      this.ctx.stroke();
    } else {
      // Cute grin with double fangs
      this.ctx.roundRect(w/2 - 12, h * 0.6, 24, 8, [0, 0, 8, 8]);
      this.ctx.fill();
      // Fangs
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.beginPath();
      this.ctx.moveTo(w/2 - 8, h * 0.6);
      this.ctx.lineTo(w/2 - 5, h * 0.6 + 5);
      this.ctx.lineTo(w/2 - 2, h * 0.6);
      this.ctx.moveTo(w/2 + 2, h * 0.6);
      this.ctx.lineTo(w/2 + 5, h * 0.6 + 5);
      this.ctx.lineTo(w/2 + 8, h * 0.6);
      this.ctx.fill();
    }

    // Animated legs
    this.ctx.fillStyle = theme.secondary;
    const legOffset = isRunning ? Math.sin(this.runCycle) * 12 : 0;
    
    if (isJumping) {
      // Tuck legs
      this.ctx.fillRect(15, h - 10, 10, 6);
      this.ctx.fillRect(w - 25, h - 10, 10, 6);
    } else if (isDucking) {
      // Sprawled legs
      this.ctx.fillRect(5, h - 10, 15, 8);
      this.ctx.fillRect(w - 20, h - 10, 15, 8);
    } else {
      // Running legs cycle
      this.ctx.fillRect(15, h - 10 + Math.max(0, legOffset), 12, 10 - Math.max(0, legOffset));
      this.ctx.fillRect(w - 27, h - 10 + Math.max(0, -legOffset), 12, 10 - Math.max(0, -legOffset));
    }
  }

  drawFox(theme, isRunning, isJumping, isDucking, isHit) {
    const w = this.width;
    const h = this.height;
    const bounceY = isRunning ? Math.sin(this.runCycle) * 5 : 0;

    this.ctx.translate(this.x, this.y + bounceY);

    // Tail
    this.ctx.fillStyle = theme.primary;
    this.ctx.beginPath();
    const tailOffset = isRunning ? Math.sin(this.runCycle) * 8 : 0;
    this.ctx.arc(-10, h * 0.65 + tailOffset, 15, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#ffffff'; // Tail tip
    this.ctx.beginPath();
    this.ctx.arc(-18, h * 0.68 + tailOffset, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // Body
    this.ctx.fillStyle = theme.primary;
    this.ctx.beginPath();
    this.ctx.roundRect(0, 10, w - 10, h - 20, [20, 30, 15, 15]);
    this.ctx.fill();

    // Chest/Belly White Fur
    this.ctx.fillStyle = theme.accent;
    this.ctx.beginPath();
    this.ctx.roundRect(w * 0.3, h * 0.4, w * 0.5, h * 0.4, [10, 15, 10, 10]);
    this.ctx.fill();

    // Ears
    this.ctx.fillStyle = theme.primary;
    // Left ear
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.2, 12);
    this.ctx.lineTo(w * 0.1, -12);
    this.ctx.lineTo(w * 0.4, 12);
    this.ctx.fill();
    // Inner ear left
    this.ctx.fillStyle = '#f87171'; // pinkish
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.22, 10);
    this.ctx.lineTo(w * 0.15, -6);
    this.ctx.lineTo(w * 0.35, 10);
    this.ctx.fill();

    // Face / Snout
    this.ctx.fillStyle = theme.primary;
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.5, h * 0.25);
    this.ctx.lineTo(w + 10, h * 0.35); // sharp snout
    this.ctx.lineTo(w * 0.5, h * 0.5);
    this.ctx.fill();
    
    // Snout Tip nose
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(w + 8, h * 0.35, 3.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Eyes
    this.ctx.fillStyle = '#000000';
    const eyeY = h * 0.28;
    const eyeX = w * 0.65;
    
    if (isHit) {
      // Dizzy x-eyes
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.moveTo(eyeX - 4, eyeY - 4);
      this.ctx.lineTo(eyeX + 4, eyeY + 4);
      this.ctx.moveTo(eyeX + 4, eyeY - 4);
      this.ctx.lineTo(eyeX - 4, eyeY + 4);
      this.ctx.stroke();
    } else {
      this.ctx.beginPath();
      this.ctx.arc(eyeX, eyeY, 4.5, 0, Math.PI * 2);
      this.ctx.fill();
      // Eye shine
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(eyeX - 1.5, eyeY - 1.5, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Legs
    this.ctx.fillStyle = '#1e293b'; // dark fox socks
    const legOffset = isRunning ? Math.sin(this.runCycle) * 10 : 0;
    
    if (isJumping) {
      this.ctx.fillRect(w * 0.2, h - 10, 10, 6);
      this.ctx.fillRect(w * 0.6, h - 10, 10, 6);
    } else if (isDucking) {
      this.ctx.fillRect(w * 0.1, h - 10, 15, 6);
      this.ctx.fillRect(w * 0.5, h - 10, 15, 6);
    } else {
      this.ctx.fillRect(w * 0.22, h - 10 + Math.max(0, legOffset), 10, 10 - Math.max(0, legOffset));
      this.ctx.fillRect(w * 0.58, h - 10 + Math.max(0, -legOffset), 10, 10 - Math.max(0, -legOffset));
    }
  }

  drawRobot(theme, isRunning, isJumping, isDucking, isHit) {
    const w = this.width;
    const h = this.height;
    const bounceY = isRunning ? Math.sin(this.runCycle) * 3 : 0;

    this.ctx.translate(this.x, this.y + bounceY);

    // Antenna
    this.ctx.strokeStyle = theme.primary;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2, 15);
    this.ctx.lineTo(w / 2, -5);
    this.ctx.stroke();
    // Tip bulb
    this.ctx.fillStyle = theme.secondary;
    this.ctx.beginPath();
    this.ctx.arc(w / 2, -6, 5, 0, Math.PI * 2);
    this.ctx.fill();

    // Head
    this.ctx.fillStyle = theme.primary;
    this.ctx.beginPath();
    this.ctx.roundRect(w * 0.15, 5, w * 0.7, h * 0.4, [12, 12, 5, 5]);
    this.ctx.fill();

    // Cyan Face Screen
    this.ctx.fillStyle = '#0f172a'; // Black monitor screen
    this.ctx.beginPath();
    this.ctx.roundRect(w * 0.22, 12, w * 0.56, h * 0.25, [6, 6, 6, 6]);
    this.ctx.fill();

    // Glowing face expressions on screen
    this.ctx.fillStyle = isHit ? '#ef4444' : theme.secondary;
    const faceY = 22;
    if (isHit) {
      // Dead face: X X
      this.ctx.font = 'bold 16px Courier New';
      this.ctx.fillText('X X', w * 0.35, faceY + 8);
    } else if (isDucking) {
      // Concentrating: > <
      this.ctx.font = 'bold 16px Courier New';
      this.ctx.fillText('> <', w * 0.35, faceY + 8);
    } else {
      // Happy eyes: • • and a line smile
      this.ctx.beginPath();
      this.ctx.arc(w * 0.38, faceY, 3, 0, Math.PI * 2);
      this.ctx.arc(w * 0.62, faceY, 3, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.strokeStyle = theme.secondary;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(w / 2, faceY + 6, 6, 0, Math.PI);
      this.ctx.stroke();
    }

    // Neck joint
    this.ctx.fillStyle = theme.accent;
    this.ctx.fillRect(w * 0.42, h * 0.45, w * 0.16, 5);

    // Torso Body
    this.ctx.fillStyle = theme.primary;
    this.ctx.beginPath();
    this.ctx.roundRect(w * 0.1, h * 0.5, w * 0.8, h * 0.38, [8, 8, 15, 15]);
    this.ctx.fill();

    // Core energy battery circle
    this.ctx.fillStyle = `rgba(6, 182, 212, ${0.4 + Math.sin(this.pulsePhase) * 0.3})`;
    this.ctx.beginPath();
    this.ctx.arc(w / 2, h * 0.7, 10, 0, Math.PI * 2);
    this.ctx.fill();

    // Metallic wheel leg (One wheel or two jet nozzles)
    this.ctx.fillStyle = '#334155';
    if (isJumping) {
      // Fire jets
      const jetGrad = this.ctx.createLinearGradient(0, h * 0.88, 0, h + 15);
      jetGrad.addColorStop(0, '#f97316');
      jetGrad.addColorStop(1, 'rgba(236, 72, 153, 0)');
      this.ctx.fillStyle = jetGrad;
      this.ctx.fillRect(w * 0.25, h * 0.88, 12, 20);
      this.ctx.fillRect(w * 0.6, h * 0.88, 12, 20);
    } else {
      // Rolling wheels
      const rot = isRunning ? this.runCycle * 1.5 : 0;
      this.ctx.translate(w / 2, h * 0.9);
      this.ctx.rotate(rot);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 11, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(-11, 0);
      this.ctx.lineTo(11, 0);
      this.ctx.stroke();
    }
  }

  drawPowerups() {
    // 1. Shield Visual Ring
    if (this.hasShield) {
      this.ctx.save();
      const glowIntensity = Math.abs(Math.sin(this.pulsePhase * 2));
      
      this.ctx.strokeStyle = '#22d3ee';
      this.ctx.shadowColor = '#06b6d4';
      this.ctx.shadowBlur = 12 + glowIntensity * 10;
      this.ctx.lineWidth = 4;
      
      // Draw outer glowing bubble around player box coordinates
      this.ctx.beginPath();
      this.ctx.arc(
        this.width / 2, 
        this.height / 2, 
        Math.max(this.width, this.height) * 0.72, 
        0, 
        Math.PI * 2
      );
      this.ctx.stroke();

      // Semi-transparent filling
      this.ctx.fillStyle = `rgba(6, 182, 212, ${0.08 + glowIntensity * 0.05})`;
      this.ctx.fill();
      
      this.ctx.restore();
    }

    // 2. Magnet Wave rings
    if (this.hasMagnet) {
      this.ctx.save();
      const radius = Math.max(this.width, this.height) * 0.65;
      
      // Draw two pulse rings expanding outwards
      const magnetRing = (this.pulsePhase * 3) % 20;
      this.ctx.strokeStyle = `rgba(236, 72, 153, ${1 - magnetRing / 20})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(
        this.width / 2,
        this.height / 2,
        radius + magnetRing,
        0,
        Math.PI * 2
      );
      this.ctx.stroke();
      
      this.ctx.restore();
    }
  }
}

// ==========================================
// 6. OBSTACLE ENGINE
// ==========================================
class Obstacle {
  constructor(type, gameSpeed, customX) {
    this.type = type; // 'spike', 'rock', 'barrier', 'drone'
    this.x = customX !== undefined ? customX : CANVAS_WIDTH + 100;
    this.color = '#ef4444';

    this.rotation = 0;
    this.animationTimer = 0;

    // Set properties based on obstacle template
    switch(type) {
      case 'spike':
        this.width = 50;
        this.height = 45;
        this.y = GROUND_Y - this.height;
        this.color = '#ec4899'; // Hot pink spikes
        break;
      case 'rock':
        this.width = 65;
        this.height = 55;
        this.y = GROUND_Y - this.height;
        this.color = '#f59e0b'; // Amber rocks
        break;
      case 'barrier':
        this.width = 40;
        this.height = 100;
        this.y = GROUND_Y - this.height;
        this.color = '#ef4444'; // Red tall block
        break;
      case 'drone':
        this.width = 55;
        this.height = 45;
        // Flying heights: high (requires ducking), low (can jump over)
        this.y = GROUND_Y - 140 - Math.random() * 80;
        this.color = '#06b6d4'; // Cyan drone
        break;
    }
  }

  update(gameSpeed) {
    this.x -= gameSpeed;
    this.animationTimer += 0.1;
  }

  getHitBox() {
    // Shrink obstacle collision boxes slightly for comfortable gameplay
    const paddingX = this.width * 0.12;
    const paddingY = this.height * 0.12;
    return {
      x: this.x + paddingX,
      y: this.y + paddingY,
      width: this.width - paddingX * 2,
      height: this.height - paddingY * 2
    };
  }

  draw(ctx) {
    ctx.save();

    if (this.type === 'spike') {
      // Programmatic Spikes
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      // Draw triple spike cluster
      ctx.moveTo(this.x, GROUND_Y);
      ctx.lineTo(this.x + this.width * 0.25, GROUND_Y - this.height);
      ctx.lineTo(this.x + this.width * 0.5, GROUND_Y);
      ctx.lineTo(this.x + this.width * 0.75, GROUND_Y - this.height * 0.8);
      ctx.lineTo(this.x + this.width, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
    } else if (this.type === 'rock') {
      // Jagged glowing rock
      const grad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, '#78350f');
      ctx.fillStyle = grad;
      
      ctx.beginPath();
      ctx.moveTo(this.x, GROUND_Y);
      ctx.lineTo(this.x + this.width * 0.15, this.y + 12);
      ctx.lineTo(this.x + this.width * 0.5, this.y);
      ctx.lineTo(this.x + this.width * 0.85, this.y + 18);
      ctx.lineTo(this.x + this.width, GROUND_Y);
      ctx.closePath();
      ctx.fill();

      // Glowing cracks
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x + this.width * 0.5, this.y);
      ctx.lineTo(this.x + this.width * 0.5, GROUND_Y);
      ctx.moveTo(this.x + this.width * 0.25, this.y + 15);
      ctx.lineTo(this.x + this.width * 0.6, this.y + 30);
      ctx.stroke();

    } else if (this.type === 'barrier') {
      // Tall barrier gate with caution stripes
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Caution stripes
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 8;
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x, this.y, this.width, this.height);
      ctx.clip();
      
      for (let offset = -50; offset < this.height; offset += 24) {
        ctx.beginPath();
        ctx.moveTo(this.x - 5, this.y + offset);
        ctx.lineTo(this.x + this.width + 5, this.y + offset + 20);
        ctx.stroke();
      }
      ctx.restore();

      // Top flashing beacon light
      const isBeaconOn = Math.floor(this.animationTimer * 2) % 2 === 0;
      ctx.fillStyle = isBeaconOn ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      if (isBeaconOn) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.stroke();
      }

    } else if (this.type === 'drone') {
      // Flying drone robot
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      
      // Floating hover bobbing
      const bobY = Math.sin(this.animationTimer * 1.5) * 4;
      ctx.translate(0, bobY);

      // Drone main spherical body
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      // Bumping neon rims
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Central glowing eye
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Propellers left/right
      ctx.fillStyle = '#64748b';
      // Left arm
      ctx.fillRect(-28, -4, 12, 6);
      // Right arm
      ctx.fillRect(16, -4, 12, 6);

      // Spinning propeller blades
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      
      // Propeller spin calculation
      const bladeX = Math.sin(this.animationTimer * 8) * 12;
      
      ctx.beginPath();
      ctx.moveTo(-28, -4);
      ctx.lineTo(-28 + bladeX, -4);
      ctx.moveTo(22, -4);
      ctx.lineTo(22 + bladeX, -4);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class ObstacleManager {
  constructor() {
    this.obstacles = [];
    this.spawnTimer = 0;
    this.nextSpawnTime = 1500;
  }

  reset() {
    this.obstacles = [];
    this.spawnTimer = 0;
    this.nextSpawnTime = 1200;
  }

  update(gameSpeed, score, delta, coins = []) {
    this.spawnTimer += delta;

    // Time to spawn new obstacle
    if (this.spawnTimer >= this.nextSpawnTime) {
      this.spawnObstacle(score, gameSpeed, coins);
      this.spawnTimer = 0;
      
      // Randomize next spawn time interval (shrinking as game speeds up!)
      const speedFactor = Math.max(0.4, 1 - (gameSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
      const minInterval = SPAWN_INTERVAL_MIN * speedFactor;
      const maxInterval = SPAWN_INTERVAL_MAX * speedFactor;
      this.nextSpawnTime = minInterval + Math.random() * (maxInterval - minInterval);
    }

    // Update coordinates
    this.obstacles.forEach(o => o.update(gameSpeed));

    // Remove offscreen obstacles
    this.obstacles = this.obstacles.filter(o => o.x + o.width > -150);
  }

  spawnObstacle(score, gameSpeed, coins = []) {
    // Prevent spawning on top of existing obstacles
    if (this.obstacles.length > 0) {
      const lastObstacle = this.obstacles[this.obstacles.length - 1];
      if (CANVAS_WIDTH + 100 - lastObstacle.x < MIN_OBSTACLE_GAP) {
        return; // Too close, skip spawning this round
      }
    }

    // Check if there are active coins in the upcoming spawning area
    const nearbyCoins = coins.filter(c => c.x > CANVAS_WIDTH - 100 && c.x < CANVAS_WIDTH + 250);
    
    let type = null;
    let customX = CANVAS_WIDTH + 100;
    
    if (nearbyCoins.length > 0) {
      // Find average X and Y of nearby coins
      let sumX = 0, sumY = 0;
      nearbyCoins.forEach(c => {
        sumX += c.x;
        sumY += c.y;
      });
      const avgX = sumX / nearbyCoins.length;
      const avgY = sumY / nearbyCoins.length;
      customX = avgX;

      // Determine appropriate obstacle type based on coin height
      if (avgY < GROUND_Y - 100) {
        // High coins -> spawn ground obstacle under them (centered)
        const groundTypes = ['spike', 'rock'];
        if (score >= 120) groundTypes.push('barrier');
        type = groundTypes[Math.floor(Math.random() * groundTypes.length)];
      } else {
        // Low coins -> spawn high flying drone over them (centered)
        if (score >= FLYING_OBSTACLE_SCORE) {
          type = 'drone';
        } else {
          // If drones aren't unlocked yet, don't spawn anything to keep it safe
          return;
        }
      }
    } else {
      // No nearby coins, choose random obstacle type based on score
      const types = ['spike', 'rock'];
      if (score >= 120) {
        types.push('barrier');
      }
      if (score >= FLYING_OBSTACLE_SCORE) {
        types.push('drone');
      }
      type = types[Math.floor(Math.random() * types.length)];
    }

    this.obstacles.push(new Obstacle(type, gameSpeed, customX));
  }

  draw(ctx) {
    this.obstacles.forEach(o => o.draw(ctx));
  }
}

// ==========================================
// 7. COLLECTIBLE & POWERUPS ENGINE
// ==========================================
class Collectible {
  constructor(type, x, y) {
    this.type = type; // 'coin', 'shield', 'magnet'
    this.x = x;
    this.y = y;
    this.width = type === 'coin' ? 30 : 44;
    this.height = type === 'coin' ? 30 : 44;
    this.animPhase = Math.random() * Math.PI * 2;
    this.collected = false;
    this.magnetTarget = null; // Target player if pulled by magnet
  }

  update(gameSpeed, player) {
    // Handle Coin attraction physics under Magnet power-up
    if (this.type === 'coin' && player.hasMagnet) {
      // Find distance vector
      const dx = (player.x + player.width / 2) - this.x;
      const dy = (player.y + player.height / 2) - this.y;
      const dist = Math.hypot(dx, dy);
      
      // Pull range: 260 pixels
      if (dist < 260) {
        const pullForce = 14;
        this.x += (dx / dist) * pullForce;
        this.y += (dy / dist) * pullForce;
        // Skip default scrolling movement if magnet forces are strong
        return;
      }
    }

    // Standard horizontal scroll movement
    this.x -= gameSpeed;
    this.animPhase += 0.08;
  }

  getHitBox() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  draw(ctx) {
    ctx.save();

    if (this.type === 'coin') {
      // Gold Coin rendering with 3D rotation simulation
      const scaleX = Math.abs(Math.sin(this.animPhase));
      
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.scale(scaleX, 1.0);

      // Gold Gradient
      const goldGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, this.width / 2);
      goldGrad.addColorStop(0, '#fef08a'); // Amber 200
      goldGrad.addColorStop(0.7, '#eab308'); // Amber 500
      goldGrad.addColorStop(1, '#ca8a04'); // Amber 600
      
      ctx.fillStyle = goldGrad;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner details
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, this.width * 0.28, 0, Math.PI * 2);
      ctx.stroke();

    } else if (this.type === 'shield') {
      // Shield Powerup
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      
      // Pulsing effect
      const scale = 1.0 + Math.sin(this.animPhase) * 0.08;
      ctx.scale(scale, scale);

      // Glow backdrop
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;

      // Outer bubble
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw shield symbol
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, -10);
      ctx.lineTo(10, 2);
      ctx.quadraticCurveTo(0, 12, -10, 2);
      ctx.closePath();
      ctx.fill();

    } else if (this.type === 'magnet') {
      // Magnet Powerup
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      const scale = 1.0 + Math.sin(this.animPhase) * 0.08;
      ctx.scale(scale, scale);

      // Glow backdrop
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 10;

      // Outer bubble
      ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw Horseshoe Magnet
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 3, 10, Math.PI, 0, true);
      ctx.stroke();

      // White magnet poles tips
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(-13.5, 0, 7, 5);
      ctx.fillRect(6.5, 0, 7, 5);
    }

    ctx.restore();
  }
}

class CollectibleManager {
  constructor() {
    this.items = [];
    this.spawnTimer = 0;
    this.nextSpawnTime = 800;
  }

  reset() {
    this.items = [];
    this.spawnTimer = 0;
    this.nextSpawnTime = 800;
  }

  update(gameSpeed, player, delta, pm, obstacles = []) {
    this.spawnTimer += delta;

    // Check spawn intervals
    if (this.spawnTimer >= this.nextSpawnTime) {
      this.spawnItem(obstacles);
      this.spawnTimer = 0;
      this.nextSpawnTime = 600 + Math.random() * 900;
    }

    this.items.forEach(item => item.update(gameSpeed, player));
    
    // Clean up collected or off-screen items
    this.items = this.items.filter(item => !item.collected && item.x + item.width > -50);
  }

  spawnItem(obstacles = []) {
    // Generate height grid: 0 (ground/low coins), 1 (mid coins), 2 (high coins)
    const heightLevels = [
      GROUND_Y - 45, // low
      GROUND_Y - 120, // mid
      GROUND_Y - 210  // high
    ];
    
    const randomChance = Math.random();
    
    if (randomChance < POWERUP_SPAWN_CHANCE) {
      // Spawn Shield or Magnet
      const type = Math.random() < 0.5 ? 'shield' : 'magnet';
      const x = CANVAS_WIDTH + 100;
      const y = heightLevels[1]; // center
      
      // Safety: make sure not directly on top of an obstacle
      const overlappingObstacle = obstacles.find(o => Math.abs(o.x - x) < 80);
      if (overlappingObstacle) {
        // Shift item slightly or spawn it high
        this.items.push(new Collectible(type, x, heightLevels[2]));
      } else {
        this.items.push(new Collectible(type, x, y));
      }
    } else if (randomChance < POWERUP_SPAWN_CHANCE + COIN_SPAWN_CHANCE) {
      // Check if there is an obstacle near the spawning point
      const targetObstacle = obstacles.find(o => o.x > CANVAS_WIDTH - 100 && o.x < CANVAS_WIDTH + 250);
      
      if (targetObstacle) {
        if (targetObstacle.type === 'drone') {
          // Spawn flat row of 4 coins on the ground (duck under drone)
          const coinCount = 4;
          const startX = targetObstacle.x - 45;
          for (let i = 0; i < coinCount; i++) {
            this.items.push(new Collectible('coin', startX + (i * 45), GROUND_Y - 45));
          }
        } else {
          // Ground obstacle ('spike', 'rock', 'barrier') -> Spawn arc over it
          const coinCount = 5;
          const startX = targetObstacle.x + targetObstacle.width / 2 - 90; // center of arc is center of obstacle
          const peakHeight = targetObstacle.type === 'barrier' ? GROUND_Y - 230 : GROUND_Y - 190;
          
          for (let i = 0; i < coinCount; i++) {
            const cx = startX + (i * 45);
            // Arc formula: y starts low, peaks, goes back down
            const angle = (i / (coinCount - 1)) * Math.PI;
            const cy = GROUND_Y - 60 - Math.sin(angle) * (GROUND_Y - 60 - peakHeight);
            this.items.push(new Collectible('coin', cx, cy));
          }
        }
      } else {
        // Spawn normal coin wave
        const coinCount = Math.floor(Math.random() * 3) + 3;
        const startX = CANVAS_WIDTH + 100;
        const heightIndex = Math.floor(Math.random() * heightLevels.length);
        const isArc = Math.random() < 0.5;
        
        for (let i = 0; i < coinCount; i++) {
          const cx = startX + (i * 45);
          let cy = heightLevels[heightIndex];
          
          if (isArc) {
            cy -= Math.sin((i / (coinCount - 1)) * Math.PI) * 60;
          }
          
          this.items.push(new Collectible('coin', cx, cy));
        }
      }
    }
  }

  draw(ctx) {
    this.items.forEach(item => item.draw(ctx));
  }
}

// ==========================================
// 8. CENTRAL GAME ENGINE
// ==========================================
export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.state = 'START'; // 'START', 'COUNTDOWN', 'PLAYING', 'PAUSED', 'GAME_OVER'
    this.gameSpeed = BASE_SPEED;
    this.score = 0;
    this.coins = 0;
    this.highScore = parseInt(safeStorage.getItem('color_dash_best', '0')) || 0;
    this.characterSelected = 'monster';

    // Game loop parameters
    this.lastTime = 0;
    this.accumulatedTime = 0;
    this.timestep = 1000 / 60; // Fixed update ticks (60Hz)
    
    // Effects
    this.shakeIntensity = 0;
    this.flashAlpha = 0;
    this.motivationTimer = 0;
    this.motivationalMessage = "";

    // Submodules instantiation
    this.input = new InputManager();
    this.bg = new Background(this.canvas);
    this.pm = new ParticleManager();
    this.player = new Player(this.canvas);
    this.om = new ObstacleManager();
    this.cm = new CollectibleManager();

    this.initUI();
    this.setupControlCallbacks();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  initUI() {
    document.getElementById('start-best-score').textContent = this.highScore;

    // Character buttons click binding
    const charBtns = document.querySelectorAll('.char-btn');
    charBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        sounds.playClick();
        charBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.characterSelected = btn.dataset.char;
      });
    });

    // Main button triggers
    document.getElementById('start-btn').addEventListener('click', () => {
      this.triggerStart();
    });

    document.getElementById('resume-btn').addEventListener('click', () => {
      this.resumeGame();
    });

    const restartBtns = [
      document.getElementById('restart-btn'), 
      document.getElementById('pause-restart-btn')
    ];
    restartBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.triggerRestart();
        });
      }
    });

    const homeBtns = [
      document.getElementById('home-btn'), 
      document.getElementById('pause-home-btn')
    ];
    homeBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.gotoMainMenu();
        });
      }
    });

    // Mute Toggles
    const muteBtns = [
      document.getElementById('start-mute-btn'),
      document.getElementById('pause-mute-btn'),
      document.getElementById('float-mute-btn')
    ];
    muteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.toggleMute();
      });
    });

    // In-game Floating Pause Button
    document.getElementById('float-pause-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.pauseGame();
    });
  }

  setupControlCallbacks() {
    // Map control actions to Engine Actions
    this.input.onJumpCallback = () => {
      if (this.state === 'PLAYING') {
        this.player.jump();
      }
    };
    
    this.input.onDuckStartCallback = () => {
      if (this.state === 'PLAYING') {
        this.player.startDucking();
      }
    };

    this.input.onDuckEndCallback = () => {
      if (this.state === 'PLAYING') {
        this.player.stopDucking();
      }
    };

    this.input.onPauseCallback = () => {
      if (this.state === 'PLAYING') {
        this.pauseGame();
      } else if (this.state === 'PAUSED') {
        this.resumeGame();
      }
    };

    this.input.onMuteCallback = () => {
      sounds.toggleMute();
    };

    this.input.onRestartCallback = () => {
      if (this.state === 'GAME_OVER') {
        this.triggerRestart();
      }
    };
  }

  // Handle canvas scaling for high DPI displays and responsive styling
  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const wrapper = document.getElementById('game-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    
    // Scale canvas draw context internally
    this.ctx.scale(width * dpr / CANVAS_WIDTH, height * dpr / CANVAS_HEIGHT);
  }

  triggerStart() {
    sounds.init();
    sounds.playClick();
    
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('floating-actions').classList.remove('hidden');

    // Show virtual controls only on smaller touch devices
    if (window.innerWidth < 1024) {
      document.getElementById('virtual-controls').classList.remove('hidden');
    }

    this.startCountdown();
  }

  startCountdown() {
    this.state = 'COUNTDOWN';
    const countdownScreen = document.getElementById('countdown-screen');
    const countdownNum = document.getElementById('countdown-number');
    
    countdownScreen.classList.remove('hidden');
    
    let count = 3;
    countdownNum.textContent = count;
    sounds.playJump(false); // countdown tick tone
    
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNum.textContent = count;
        sounds.playJump(false);
      } else if (count === 0) {
        countdownNum.textContent = 'GO!';
        sounds.playJump(true); // countdown start tone
      } else {
        clearInterval(interval);
        countdownScreen.classList.add('hidden');
        this.state = 'PLAYING';
        this.player.reset(this.characterSelected);
        this.score = 0;
        this.coins = 0;
        this.gameSpeed = BASE_SPEED;
        this.om.reset();
        this.cm.reset();
        this.pm.clear();
        sounds.startMusic();
      }
    }, 900);
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    sounds.playClick();
    this.state = 'PAUSED';
    document.getElementById('pause-screen').classList.remove('hidden');
    document.getElementById('floating-actions').classList.add('hidden');
    sounds.stopMusic();
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    sounds.playClick();
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('floating-actions').classList.remove('hidden');
    this.state = 'PLAYING';
    sounds.startMusic();
  }

  triggerRestart() {
    sounds.playClick();
    sounds.stopMusic();
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('floating-actions').classList.remove('hidden');
    this.startCountdown();
  }

  gotoMainMenu() {
    sounds.playClick();
    sounds.stopMusic();
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('floating-actions').classList.add('hidden');
    document.getElementById('virtual-controls').classList.add('hidden');
    
    document.getElementById('start-best-score').textContent = this.highScore;
    document.getElementById('start-screen').classList.remove('hidden');
    this.state = 'START';
  }

  gameOver() {
    sounds.playHit();
    sounds.stopMusic();
    this.state = 'GAME_OVER';
    
    // Set screen effects
    this.shakeIntensity = 20;
    this.flashAlpha = 0.8;
    
    // Trigger explode particles
    const theme = CHAR_THEMES[this.player.characterType];
    this.pm.spawn(
      this.player.x + this.player.width / 2, 
      this.player.y + this.player.height / 2, 
      theme.secondary, 
      'explosion', 
      30
    );

    // Save score calculations
    let isNewRecord = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      safeStorage.setItem('color_dash_best', this.highScore);
      isNewRecord = true;
      this.pm.spawnConfetti();
    }

    // Set UI displays
    document.getElementById('gameover-score').textContent = this.score;
    document.getElementById('gameover-coins').textContent = this.coins;
    
    const recordBadge = document.getElementById('new-best-badge');
    if (isNewRecord) {
      recordBadge.classList.remove('hidden');
    } else {
      recordBadge.classList.add('hidden');
    }

    // Pick random gameover console quote
    const randomMessage = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
    document.getElementById('motivational-message').textContent = isNewRecord ? "Spectacular run! New Best!" : randomMessage;

    // Fade in game over UI panel
    document.getElementById('floating-actions').classList.add('hidden');
    document.getElementById('virtual-controls').classList.add('hidden');
    document.getElementById('gameover-screen').classList.remove('hidden');
  }

  // Draw in-game motivational floating text
  triggerMotivation(message) {
    this.motivationalMessage = message;
    this.motivationTimer = 100; // frames
  }

  // --- COLLISION PHYSICS CORE ---
  checkCollisions() {
    const pBox = this.player.getHitBox();

    // 1. Check Obstacles hits
    for (let i = 0; i < this.om.obstacles.length; i++) {
      const obstacle = this.om.obstacles[i];
      const oBox = obstacle.getHitBox();
      
      if (this.isAABBIntersecting(pBox, oBox)) {
        if (this.player.hasShield) {
          // Break Shield, save player
          this.player.hasShield = false;
          this.player.shieldTime = 0;
          this.om.obstacles.splice(i, 1); // delete obstacle
          this.shakeIntensity = 10;
          sounds.playHit();
          this.pm.spawn(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, '#06b6d4', 'explosion', 15);
          break;
        } else {
          // Game over
          this.player.state = 'hit';
          this.gameOver();
          break;
        }
      }
    }

    // 2. Check Collectibles hits
    for (let i = 0; i < this.cm.items.length; i++) {
      const item = this.cm.items[i];
      const cBox = item.getHitBox();
      
      if (this.isAABBIntersecting(pBox, cBox)) {
        item.collected = true;
        
        if (item.type === 'coin') {
          this.coins++;
          this.score += 10; // coin gives 10 points
          sounds.playCoin();
          this.pm.spawn(item.x + item.width / 2, item.y + item.height / 2, '#facc15', 'sparkle', 6);
        } else if (item.type === 'shield') {
          this.player.activateShield();
          this.triggerMotivation("Shield Activated!");
        } else if (item.type === 'magnet') {
          this.player.activateMagnet();
          this.triggerMotivation("Coin Magnet Activated!");
        }
      }
    }
  }

  isAABBIntersecting(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // --- RENDERING PIPELINE ---
  run(time) {
    // Calculate delta time
    const delta = time - this.lastTime;
    this.lastTime = time;
    
    // Accumulate time for fixed timestep loop
    this.accumulatedTime += Math.min(delta, 100); // Caps time step to prevent spiral of death

    while (this.accumulatedTime >= this.timestep) {
      this.update(this.timestep);
      this.accumulatedTime -= this.timestep;
    }

    this.draw();
    requestAnimationFrame((t) => this.run(t));
  }

  update(delta) {
    if (this.state === 'PLAYING') {
      // 1. Increment Score (Survival points)
      this.score += 0.15; // standard tick
      
      // Speed multiplier ramps up gradually every 200 points
      const currentLevel = Math.floor(this.score / SPEED_LEVEL_INTERVAL);
      this.gameSpeed = Math.min(MAX_SPEED, BASE_SPEED + currentLevel * SPEED_INCREASE_AMOUNT);

      // Trigger level-up banner or speech bubble
      if (Math.floor(this.score) > 0 && Math.floor(this.score) % SPEED_LEVEL_INTERVAL === 0) {
        if (this.motivationTimer <= 0) {
          this.triggerMotivation("SPEED UP!");
        }
      }

      // 2. Update Submodules
      this.bg.update(this.gameSpeed, this.score);
      this.player.update(this.input, this.score, this.gameSpeed, this.pm);
      this.om.update(this.gameSpeed, this.score, delta, this.cm.items);
      this.cm.update(this.gameSpeed, this.player, delta, this.pm, this.om.obstacles);
      this.checkCollisions();
      
      // Update HUD values
      document.getElementById('hud-score').textContent = String(Math.floor(this.score)).padStart(5, '0');
      document.getElementById('hud-speed').textContent = 'x' + (this.gameSpeed / BASE_SPEED).toFixed(1);
      document.getElementById('hud-coins').textContent = this.coins;
      document.getElementById('hud-best').textContent = String(Math.max(this.highScore, Math.floor(this.score))).padStart(5, '0');
      
      // Update HUD Powerup Bars
      this.updatePowerupHUD();
    }

    this.pm.update(this.gameSpeed);

    // Fade screens flash / shake effects
    if (this.shakeIntensity > 0) this.shakeIntensity *= 0.9;
    if (this.flashAlpha > 0) this.flashAlpha -= 0.04;
    if (this.motivationTimer > 0) this.motivationTimer--;
  }

  updatePowerupHUD() {
    const shBar = document.getElementById('shield-bar');
    const maBar = document.getElementById('magnet-bar');
    const shTimer = document.getElementById('powerup-shield');
    const maTimer = document.getElementById('powerup-magnet');

    if (this.player.hasShield) {
      shTimer.classList.remove('hidden');
      shBar.style.transform = `scaleX(${this.player.shieldTime / POWERUP_DURATION})`;
    } else {
      shTimer.classList.add('hidden');
    }

    if (this.player.hasMagnet) {
      maTimer.classList.remove('hidden');
      maBar.style.transform = `scaleX(${this.player.magnetTime / POWERUP_DURATION})`;
    } else {
      maTimer.classList.add('hidden');
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Apply camera shake if hit
    this.ctx.save();
    if (this.shakeIntensity > 0.5) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
    }

    // 1. Draw static Parallax backgrounds
    this.bg.draw(this.score);

    // 2. Draw Obstacles, Collectibles & Particles
    this.om.draw(this.ctx);
    this.cm.draw(this.ctx);
    this.pm.draw(this.ctx);

    // 3. Draw Player
    if (this.state !== 'GAME_OVER' && this.state !== 'START' && this.state !== 'COUNTDOWN') {
      this.player.draw();
    }

    // 4. Draw Motivational Speech Bubble/Floating Text
    if (this.motivationTimer > 0 && this.state === 'PLAYING') {
      this.ctx.save();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#8b5cf6';
      this.ctx.shadowBlur = 10;
      this.ctx.font = 'bold 26px Poppins';
      this.ctx.textAlign = 'center';
      
      // Floating animation upwards
      const fy = GROUND_Y - 220 - (100 - this.motivationTimer) * 0.8;
      const alpha = Math.min(1.0, this.motivationTimer / 25);
      this.ctx.globalAlpha = alpha;
      
      this.ctx.fillText(this.motivationalMessage, CANVAS_WIDTH / 2, fy);
      this.ctx.restore();
    }

    this.ctx.restore(); // restore from camera shake

    // 5. Draw Gameover flash screen effect
    if (this.flashAlpha > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }
}

