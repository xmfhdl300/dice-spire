/**
 * 다이스 & 스파이어 - Canvas 파티클 시스템
 * 배경 앰비언트 마법 입자 & 전투 스킬 발동 시 타격/방어/마법 파티클 폭발
 */

class ParticleEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.ambientParticles = [];
    this.resize();

    window.addEventListener('resize', () => this.resize());
    this.initAmbient();
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initAmbient() {
    this.ambientParticles = [];
    const count = 35;
    for (let i = 0; i < count; i++) {
      this.ambientParticles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 0.8,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: -Math.random() * 0.5 - 0.2,
        opacity: Math.random() * 0.6 + 0.2,
        hue: Math.random() > 0.6 ? 210 : 45 // 시안 or 골드
      });
    }
  }

  // 타격 파티클 폭발
  spawnHitSparks(x, y, color = '#f87171', count = 25) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: color,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02,
        gravity: 0.15
      });
    }
  }

  // 방패 방어 파티클 (원형 확산)
  spawnShieldBurst(x, y) {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 2,
        color: '#38bdf8',
        alpha: 1,
        decay: 0.025,
        gravity: 0.02
      });
    }
  }

  // 화염 / 마법 파티클
  spawnMagicBurst(x, y) {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 1;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: Math.random() * 6 + 3,
        color: Math.random() > 0.4 ? '#f97316' : '#a855f7',
        alpha: 1,
        decay: 0.03,
        gravity: -0.05 // 위로 상승
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. 앰비언트 파티클
    this.ctx.save();
    for (const p of this.ambientParticles) {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.y < 0) p.y = this.canvas.height;
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;

      this.ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.opacity})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();

    // 2. 이펙트 파티클
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    requestAnimationFrame(() => this.animate());
  }
}

let particleEngine = null;
window.addEventListener('DOMContentLoaded', () => {
  particleEngine = new ParticleEngine('particleCanvas');
});
