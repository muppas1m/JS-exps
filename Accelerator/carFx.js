(function() { // IOS fix for audio context issue
	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	if (window.AudioContext) {
		window.audioContext = new window.AudioContext();
	}
	var fixAudioContext = function (e) {
		if (window.audioContext) {
			// Create empty buffer
			var buffer = window.audioContext.createBuffer(1, 1, 22050);
			var source = window.audioContext.createBufferSource();
			source.buffer = buffer;
			// Connect to output (speakers)
			source.connect(window.audioContext.destination);
			// Play sound
			if (source.start) {
				source.start(0);
			} else if (source.play) {
				source.play(0);
			} else if (source.noteOn) {
				source.noteOn(0);
			}
		}
		// Remove events
		document.removeEventListener('touchstart', fixAudioContext);
		document.removeEventListener('touchend', fixAudioContext);
	};
	// iOS 6-8
	document.addEventListener('touchstart', fixAudioContext);
	// iOS 9
	document.addEventListener('touchend', fixAudioContext);
})();
export class SoundManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.engineSources = {
        // engine states
      idle: this.loadSound('engine-idle'),
      low: this.loadSound('engine-low'),
      high: this.loadSound('engine-high'),
    };
    this.actionSounds = {
      //action based,
      start: this.loadSound('engine-start'),
      shift: this.loadSound('gear-shift')
    }
    this.currentEngine = null;
  }

  loadSound(id) {
    const element = document.getElementById(id);
    const source = this.ctx.createMediaElementSource(element);
    source.connect(this.ctx.destination);
    return { element, source };
  }

  updateEngineSound(speed, gear) {
    if (speed === 0 || gear === 'N' || gear === 'P') {
      this.playIdleSound();
      return;
    }
    // const targetSound = this.actionSounds.idle;
    // const rpm = this.calculateRPM(speed, gear);

    // // Only apply playback rate to non-idle sounds
    // if (targetSound !== this.engineSources.idle) {
    //   const playbackRate = this.calculatePlaybackRate(rpm);
    //   targetSound.element.playbackRate = playbackRate;
    // }

    // this.crossfadeToSound(targetSound);
  }

  playStartSound(){
    this.actionSounds.start.element.currentTime = 0;
    this.actionSounds.start.element.play();
  }

  playShiftSound() {
    this.actionSounds.shift.element.currentTime = 0;
    this.actionSounds.shift.element.play();
  }

  playIdleSound(){
    const idle = this.engineSources.idle;
    idle.element.playbackRate = 1.0; // Always normal speed
    this.crossfadeToSound(idle);
  }

  calculatePlaybackRate(rpm) {
    const minRate = 0.1; 
    const maxRate = 5;
    const baseRate = rpm / 2500; 
    
    return Math.max(minRate, Math.min(maxRate, baseRate));
  }
  crossfadeToSound(targetSound) {
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