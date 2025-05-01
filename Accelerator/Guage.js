import { createManagedInterval } from "./utils.js";

export class Gauge {
  constructor(containerElement, config) {
    this.container = containerElement;

    if(!this.container.querySelector('.pinHolder')) {
      const pin = document.createElement('div');
      pin.className = 'pinHolder';
      this.container.appendChild(pin);
    }
    const digitalDisplay = this.container.querySelector('#digitalSpeed') || (config.digitalDisplay && this.createDigitalDisplay())
    this.digitalDisplay = digitalDisplay;
    if(digitalDisplay && config.units) digitalDisplay.style.setProperty('--guage-units', `'${String(config.units)}'`)

    this.config = {
      maxValue: 400,
      needleSmoothing: true,
      valueFormat: val => Math.floor(val), // Default formatter
      ...config
    };
    this.config.rotationMultiplier = 270 / this.config.maxValue; // 0 to max Value on a 270 degree wide scale
    this.needle = this.container.querySelector('.sc') || 
                  this.createNeedleElement();
    this.renderScale();
    this.currentValue = 0;
    this.needleInterval = null;
  }

  renderScale(){
    const scaleCover = this.container.querySelector('.guage-cover') || 
                        this.createScaleCover();
    scaleCover.innerHTML = '';
    for(let i = 0; i<=10; i++){
      const isRedline = this.config.redlineStart && i >= this.config.redlineStart;
        scaleCover.innerHTML += `
            <span style="--i:${i}">
                <span class="${isRedline ? 'redline-marker' : ''}">
                    ${i * (this.config.maxValue / 10)}
                </span>
            </span>
            <span style="--j:${i}" class="point ${isRedline ? 'redline-point' : ''}">
                <span></span>
            </span>
            ${i < 10 ? `<span style="--j:${i}.5" class="point ${isRedline ? 'redline-point' : ''}"><span></span></span>` : ''}`;
    }
    scaleCover.appendChild(this.needle);
  }

  createDigitalDisplay(){
    let element = document.createElement('p');
    element.id = "digitalSpeed";
    element.innerHTML = 0;
    this.container.appendChild(element);
    return element;
  }

  createScaleCover() {
    const cover = document.createElement('div');
    cover.className = 'guage-cover';
    this.container.appendChild(cover);
    return cover;
  }

  createNeedleElement() {
    const needle = document.createElement('div');
    needle.className = 'sc';
    needle.id = 'sc';
    needle.innerHTML = '<div class="pointer"></div>';
    const needleHolder = document.createElement('div');
    needleHolder.className = 'sec';
    needleHolder.appendChild(needle);
    
    const scaleCover = this.container.querySelector('.guage-cover') || 
                        this.createScaleCover();
    scaleCover.appendChild(needleHolder);

    return needle;
  }

  render(value) {
    if(this.currentValue===value) return;
    const targetRotation = value * this.config.rotationMultiplier;
    let currentRotation = parseFloat(this.needle.style.transform.replace('rotateZ(', '')) || 0;
    this.currentValue = value;
    if(this.needleInterval) this.needleInterval.clear();

    // needle transition
    if(this.config.needleSmoothing){
      this.needleInterval = createManagedInterval(() => {
        const step = (targetRotation - currentRotation) * 0.1;
        currentRotation += step;
        this.needle.style.transform = `rotateZ(${currentRotation}deg)`;
        
        if (Math.abs(targetRotation - currentRotation) < 0.5) {
          this.needleInterval.clear();
        }
      }, 16, { immediate: true });
    } else{
      this.needle.style.transform = `rotateZ(${targetRotation}deg)`;
    }
    
    if (this.config.onRender) {
      this.config.onRender(value);
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}