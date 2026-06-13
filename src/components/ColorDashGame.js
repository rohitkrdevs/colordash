'use client';
import React, { useEffect, useRef } from 'react';
import { Game } from '../game/engine.js';

export default function ColorDashGame() {
  const gameRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !gameRef.current) {
      gameRef.current = new Game();
      requestAnimationFrame((t) => gameRef.current.run(t));
    }
  }, []);

  return (
    <div id="game-wrapper">
      <div id="game-container">
        {/* Game Canvas */}
        <canvas id="game-canvas" width="1280" height="720"></canvas>

        {/* Head-up Display (HUD) */}
        <div id="hud" className="hud-layer hidden">
          <div className="hud-left">
            <div className="hud-item" id="hud-score-container">
              <span className="hud-label">SCORE</span>
              <span className="hud-value" id="hud-score">00000</span>
            </div>
            <div className="hud-item" id="hud-speed-container">
              <span className="hud-label">SPEED</span>
              <span className="hud-value" id="hud-speed">x1.0</span>
            </div>
          </div>
          
          <div className="hud-center">
            <div className="hud-item" id="hud-coins-container">
              <span className="coin-icon">🟡</span>
              <span className="hud-value" id="hud-coins">0</span>
            </div>
          </div>

          <div className="hud-right">
            <div className="hud-item" id="hud-best-container">
              <span className="hud-label">BEST</span>
              <span className="hud-value" id="hud-best">00000</span>
            </div>
          </div>
          
          {/* Power-up timers */}
          <div id="active-powerups">
            <div id="powerup-shield" className="powerup-timer hidden">
              <span className="powerup-icon">🛡️</span>
              <div className="powerup-bar-container"><div className="powerup-bar" id="shield-bar"></div></div>
            </div>
            <div id="powerup-magnet" className="powerup-timer hidden">
              <span className="powerup-icon">🧲</span>
              <div className="powerup-bar-container"><div className="powerup-bar" id="magnet-bar"></div></div>
            </div>
          </div>
        </div>

        {/* Start Screen Overlay */}
        <div id="start-screen" className="overlay-screen">
          <h1 className="game-title">COLOR DASH<br/><span className="highlight">RUNNER</span></h1>
          <p className="game-subtitle">Jump, duck, collect coins, and survive!</p>
          
          <div className="best-score-badge">
            <span>🏆 BEST SCORE</span>
            <strong id="start-best-score">0</strong>
          </div>

          {/* Customizable character selector */}
          <div className="character-selector">
            <p>Choose Your Runner:</p>
            <div className="char-options">
              <button className="char-btn active" data-char="monster">👾 Monster</button>
              <button className="char-btn" data-char="fox">🦊 Fox</button>
              <button className="char-btn" data-char="robot">🤖 Robot</button>
            </div>
          </div>

          <div className="btn-group">
            <button id="start-btn" className="btn btn-primary">PLAY GAME</button>
          </div>

          <div className="instructions-panel">
            <div className="instruction-col">
              <strong>Desktop Controls</strong>
              <span>Space / ↑ : Jump (Double jump at 300 pts!)</span>
              <span>↓ : Duck</span>
              <span>P : Pause | M : Mute</span>
            </div>
            <div className="instruction-col">
              <strong>Mobile Controls</strong>
              <span>Left Side : Duck</span>
              <span>Right Side : Jump / Double Jump</span>
              <span>Top Controls : Pause / Sound</span>
            </div>
          </div>

          <div className="screen-footer">
            <button id="start-mute-btn" className="icon-btn" aria-label="Mute sound">🔊</button>
          </div>
        </div>

        {/* Countdown Overlay */}
        <div id="countdown-screen" className="overlay-screen hidden">
          <div id="countdown-number">3</div>
        </div>

        {/* Pause Screen Overlay */}
        <div id="pause-screen" className="overlay-screen hidden">
          <h2>GAME PAUSED</h2>
          <div className="btn-group-vertical">
            <button id="resume-btn" className="btn btn-primary">RESUME</button>
            <button id="pause-restart-btn" className="btn btn-secondary">RESTART</button>
            <button id="pause-home-btn" className="btn btn-secondary">MAIN MENU</button>
          </div>
          <div className="screen-footer">
            <button id="pause-mute-btn" className="icon-btn" aria-label="Mute sound">🔊</button>
          </div>
        </div>

        {/* Game Over Screen Overlay */}
        <div id="gameover-screen" className="overlay-screen hidden">
          <div className="gameover-container">
            <h2 className="gameover-title">GAME OVER</h2>
            <p id="motivational-message">So close! Try again!</p>
            
            <div className="new-best-alert hidden" id="new-best-badge">🎉 NEW RECORD! 🎉</div>

            <div className="stats-grid">
              <div className="stat-box">
                <span>SCORE</span>
                <strong id="gameover-score">0</strong>
              </div>
              <div className="stat-box">
                <span>COINS</span>
                <strong id="gameover-coins">0</strong>
              </div>
            </div>

            <div className="btn-group-vertical">
              <button id="restart-btn" className="btn btn-primary">PLAY AGAIN</button>
              <button id="home-btn" className="btn btn-secondary">MAIN MENU</button>
            </div>
          </div>
        </div>

        {/* Top action floating buttons during playing */}
        <div id="floating-actions" className="hidden">
          <button id="float-pause-btn" className="icon-btn" aria-label="Pause game">⏸️</button>
          <button id="float-mute-btn" className="icon-btn" aria-label="Toggle sound">🔊</button>
        </div>

        {/* Mobile Virtual Touch Controls */}
        <div id="virtual-controls" className="hidden">
          <button id="ctrl-duck" className="ctrl-btn" aria-label="Duck">
            <span className="ctrl-icon">▼</span>
            <span className="ctrl-label">DUCK</span>
          </button>
          <button id="ctrl-jump" className="ctrl-btn" aria-label="Jump">
            <span className="ctrl-icon">▲</span>
            <span className="ctrl-label">JUMP</span>
          </button>
        </div>
      </div>

      {/* Portrait warning overlay for mobile */}
      <div id="portrait-warning">
        <div className="rotation-icon">🔄</div>
        <h2>Rotate Your Device</h2>
        <p>Please rotate to landscape mode to play Color Dash Runner.</p>
      </div>
    </div>
  );
}
