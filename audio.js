/**
 * 다이스 & 스파이어 - 프로시저럴 사운드 엔진 (Web Audio API)
 * 외부 음원 파일 없이 순수 오디오 신디사이저로 타격감, 주사위 소리, 팡파레 구현
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initAudioContext();
  }

  initAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // 1. 주사위 굴리는 소리 (짤깍짤깍 연타)
  playDiceRoll() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const now = this.ctx.currentTime;
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      const time = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280 + Math.random() * 240, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + 0.04);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.05);
    }
  }

  // 2. 주사위 슬롯 장착 소리 (찰칵 + 은은한 공명)
  playDiceSlot() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // 3. 검격 / 타격 소리 (묵직한 사출음 + 타격)
  playSlash() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const now = this.ctx.currentTime;

    // 노이즈 버퍼로 휘두르는 소리
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.16);

    // 베이스 임팩트
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  // 4. 방패 막기 소리 (금속성 깡!)
  playShieldBlock() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const now = this.ctx.currentTime;
    const freqs = [520, 1040, 1680];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    });
  }

  // 5. 마법 / 화염 작열음
  playMagicFire() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  // 6. 승리 팡파레
  playVictory() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C(옥타브)
    const now = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const time = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.45);
    });
  }

  // 7. 패배 소리 (단조 하강음)
  playDefeat() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const notes = [330, 311, 293, 277];
    const now = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const time = now + i * 0.22;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.35);
    });
  }

  // 8. 주사위면 각인 / 인챈트 파워업 소리
  playEnchant() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const notes = [440, 554.37, 659.25, 880, 1108.73]; // A, C#, E, A, C#
    const now = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const time = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.32);
    });
  }
}

// 글로벌 사운드 인스턴스
const soundEngine = new SoundEngine();
