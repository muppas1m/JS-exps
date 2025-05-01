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
  initSounds() {
    // Initialize sounds after context is created
    this.actionSounds = {
      start: this.loadSound('engine-start'),
      shift: this.loadSound('gear-shift')
    };
    this.actionSounds.shift.element.volume = 0.35;
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

  playShiftSound() {
    if (!this.audioAllowed) return;
    
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    this.actionSounds.shift.element.currentTime = 0;
    this.actionSounds.shift.element.play()
      .catch(e => console.warn("Audio play failed:", e));
  }

  setEffectsVolume(value){
    for(let audio of Object.values(this.actionSounds)){
      audio.element.volume *= value;
    }
  }
}