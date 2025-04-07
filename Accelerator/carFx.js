export class SoundManager {
  constructor() {
    this.audioAllowed = false;
    // Initialize audio context on first interaction
    this.initAudioContext = this.initAudioContext.bind(this);
    document.addEventListener('click', this.initAudioContext, { once: true });
    document.addEventListener('touchstart', this.initAudioContext, { once: true });
  }
  initAudioContext() {
    try {
      // Create audio context after user interaction
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // iOS requires the context to be resumed after creation
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.audioAllowed = true;
          this.initSounds();
        });
      } else {
        this.audioAllowed = true;
        this.initSounds();
      }
    } catch (e) {
      console.error("Audio initialization failed:", e);
    }
  }
  async loadBufferSound(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  }
  initSounds() {
    // Initialize sounds after context is created
    this.actionSounds = {
      start: this.loadSound('engine-start'),
      shift: this.loadSound('gear-shift')
    };
    this.loadBufferSound('./engineIdle.m4a').then(buffer => {
      this.engineSources = {
        idle: { buffer }
      };
    });
    this.currentEngine = null;
  }
  loadSound(id) {
    const element = document.getElementById(id);
    // iOS requires this for audio elements
    element.preload = 'auto';
    element.load();
    
    const source = this.ctx.createMediaElementSource(element);
    source.connect(this.ctx.destination);
    return { element, source };
  }

  // updateEngineSound(speed, gear) {
  //   if (speed === 0 || gear === 'N' || gear === 'P') {
  //     this.playIdleSound();
  //     return;
  //   }
  //   const targetSound = this.actionSounds.idle;
  //   const rpm = this.calculateRPM(speed, gear);

  //   // Only apply playback rate to non-idle sounds
  //   if (targetSound !== this.engineSources.idle) {
  //     const playbackRate = this.calculatePlaybackRate(rpm);
  //     targetSound.element.playbackRate = playbackRate;
  //   }

  //   this.crossfadeToSound(targetSound);
  // }

  playSoundElement(element) {
    element.currentTime = 0;
    element.play()
      .then(() => {
        // Audio is playing
      })
      .catch(e => {
        console.warn("Audio play failed:", e);
        // On iOS, we might need to trigger this from a user gesture
      });
  }

  playStartSound() {
    if (!this.audioAllowed) return;
    
    // Ensure context is running (iOS requirement)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.playSoundElement(this.actionSounds.start.element);
      });
    } else {
      this.playSoundElement(this.actionSounds.start.element);
    }
  }

  playShiftSound() {
    if (!this.audioAllowed) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.actionSounds.shift.element.currentTime = 0;
    this.actionSounds.shift.element.play()
      .catch(e => console.warn("Audio play failed:", e));
  }

  stopIdleSound() {
    if (this.currentEngine?.source?.stop) {
      try {
        this.currentEngine.source.stop();
        this.currentEngine = null;
      } catch (e) {
        console.warn("Failed to stop idle sound:", e);
      }
    }
  }

  playIdleSound() {
    if (!this.audioAllowed || !this.engineSources.idle?.buffer) return;
  
    const source = this.ctx.createBufferSource();
    source.buffer = this.engineSources.idle.buffer;
    source.loop = true;
    source.connect(this.ctx.destination);
    source.start(0);
  
    // Store reference to stop later if needed
    this.currentEngine?.source?.stop?.();
    this.currentEngine = { source };
  }

  calculatePlaybackRate(rpm) {
    const minRate = 0.1; 
    const maxRate = 5;
    const baseRate = rpm / 2500; 
    
    return Math.max(minRate, Math.min(maxRate, baseRate));
  }
  crossfadeToSound(targetSound) {
    // Stop previous engine sound if it's a buffer-based source
    if (this.currentEngine?.source?.stop) {
      this.currentEngine.source.stop();
    }

    // If this is a buffer-based idle sound
    if (targetSound.buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = targetSound.buffer;
      source.loop = true;
      source.connect(this.ctx.destination);
      source.start(0);
      targetSound.source = source;
      this.currentEngine = targetSound;
      return;
    }

    if (this.currentEngine && this.currentEngine !== targetSound) {
      this.currentEngine.element.volume = 0;
    }
    
    targetSound.element.volume = 0.7;
    if (targetSound.element.paused) {
      targetSound.element.currentTime = 0;
      targetSound.element.play().catch(e => console.warn("Audio play failed:", e));
    }
    
    this.currentEngine = targetSound;
  }

  calculateRPM(speed, gear) {
    // Handle neutral/park cases
    if (gear === 'N' || gear === 'P') return 0;
    
    const gearRatios = [0, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500];
    const baseRPM = gearRatios[gear] || 0;
    // Scale RPM between idle (800) and redline (based on gear)
    return 800 + (baseRPM - 800) * (speed / 400);
  }
}