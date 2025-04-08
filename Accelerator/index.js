import { SoundManager } from "./carFx.js";
import { GearShifter } from "./gearShifter.js";
const shifter = new GearShifter(document.querySelector('.container'));

const gasPedal = document.getElementById('gas-pedal');
const brakePedal = document.getElementById('brake-pedal');
const digitalSpeed = document.getElementById('digitalSpeed');
const gearIndicator = document.getElementById('gearIndicator');
const speedIndicator = document.querySelector('#sc');
const ignitionButton = document.getElementById('engine-button');
const main_guage = document.querySelector('.clock');
const carStartAudio = document.getElementById('engine-start');
const transmissionSwitch = document.querySelector('.switch-container input');
const switchLabel = document.querySelector('.switch-container .switch-label');

const soundManager = new SoundManager();
const gearSequence = ['R', 'P', 'N', 1, 2, 3, 4, 5, 6, 7, 8], gearDisplayCap = 3;

// state variables
let accelerateInterval, descelerateInterval, shiftDelayId, shiftAnimationId;
let speed = 0, prevGear = 0, currentGear = 'P', isThrottlePressed = false;
let ignition = false, isEngineBusy = false;
let keyDown = false, keyUp = false, isManualMode = false;

const isGearChange = () => prevGear!==currentGear;

const inRange = (min, max, val) => (val>=min && val<=max);

const getCurrentGearBySpeed = (speed) => {
    if(speed<=0) {
        if(ignition) return 'N';
        return 'P';
    }
    switch(true){
        case inRange(0, 80, speed): return 1;
        case inRange(81, 140, speed): return 2;
        case inRange(141, 200, speed): return 3;
        case inRange(201, 250, speed): return 4
        case inRange(251, 300, speed): return 5;
        case inRange(301, 350, speed): return 6;
        case inRange(351, 380, speed): return 7;
        case inRange(381, 400, speed): return 8;
        default : return 'N';
    }
}

function handleManualGearShift(e){
    if(!isManualMode) return; // should work only on manual
    displayGearChange(isNaN(e.gear) ? e.gear : Number(e.gear));
    if(isThrottlePressed) sequentialAccelerate();
}

shifter.on('gearChange', handleManualGearShift);

function displayGearChange(gear){
    if(gear) currentGear = gear;
    const gearIndex = gearSequence.findIndex(gear => (['R,P,N'].includes(currentGear) || gear===currentGear));
    for (let node of gearIndicator.children) {
        if (node.classList.value === 'leftGears') {
            node.textContent = gearSequence.slice(Math.max(0, gearIndex - gearDisplayCap), gearIndex).join('');
        } else if (node.classList.value === 'currentGear') {
            if (shiftAnimationId) clearTimeout(shiftAnimationId); // clear prev gear animation

             // when slowing, or for the first gear, or for manual mode
            if (!isThrottlePressed || (isThrottlePressed && currentGear === 1) || (isThrottlePressed && isManualMode)) soundManager.playShiftSound();

            gearIndicator.classList.add('shift');
            if(!isManualMode) shifter.moveToGear(currentGear.toString()); // gear shift when automatic mode;
            shiftAnimationId = setTimeout(() => gearIndicator.classList.remove('shift'), 200); // animate current gear
            node.textContent = gearSequence[gearIndex];
        } else {
            node.textContent = gearSequence.slice(gearIndex + 1, gearIndex + gearDisplayCap + 1).join('');
        }
    }
}

const renderGearChangeBySpeed = (speed) => {
    if(isManualMode) return;
    currentGear = getCurrentGearBySpeed(speed);
    if(isGearChange()) displayGearChange();
    prevGear = currentGear;
}

// helper function to display needle movement, digital speed and gears
const renderSpeed = (speed) => {
    // const easedSpeed = !ignition ? (speed < 300 ? speed : speed * 0.8) : speed; // Slow down needle above 300km/h
    speedIndicator.style.transform = `rotateZ(${speed*0.675}deg)`; // 0-400 in a 270deg scale = 0.675
    if(ignition){
        renderGearChangeBySpeed(speed);
        digitalSpeed.textContent = Math.floor(speed);
    }
}

const clearExistingIntervals = () => {
    clearTimeout(shiftDelayId);
    clearInterval(accelerateInterval);
    clearInterval(descelerateInterval);
}

function descelerateHelper(e, step = 1, rate = 50, callback) {
    isThrottlePressed = false;
    clearExistingIntervals();
    descelerateInterval = setInterval(() => {
        if(speed<=0) {
            speed = 0;
            clearInterval(descelerateInterval);
            return callback && callback();
        }    
        speed -= step;
        renderSpeed(speed);
    }, rate);
}

function descelerate(e = null, options = {}, callback = null) {
    const { rate = 15, step = 1 } = options;
    clearExistingIntervals();
    return descelerateHelper(e, step, rate, callback);
}

const accelerateHelper = (maxSpeed, interval, nextGearCB, options = {}) => {
    const { step = 1 } = options;
    clearInterval(accelerateInterval);
    accelerateInterval = setInterval(() => {
        if(!isThrottlePressed && ignition) return descelerateHelper(); // to descelerateHelper when throttle is released during gear change
        if (speed >= maxSpeed) {
            if(isManualMode && speed > maxSpeed) {
                clearInterval(accelerateInterval);
                accelerateInterval = setInterval(() => {
                    if(speed<=maxSpeed){
                        return sequentialAccelerate();
                    }
                    speed -=1;
                    renderSpeed(speed);
                }, 50)
            } else{
                if(!isManualMode && speed<400) soundManager.playShiftSound(); // for accelerating
                return (nextGearCB && nextGearCB());
            }
        }
        speed += step;
        renderSpeed(speed);
    }, interval)
}

const shiftDelay = (nextGearCB, gearShiftDelay = 200) => {
    shiftDelayId = setTimeout(nextGearCB, gearShiftDelay)
}

// gear profiles 
// gear profile = (() => accelerateHelper(gearTopSpeed, interval, next_gear_callback));
// 0 -> 80 in 1.8s, so each tick cost 22.5ms
const gear1 = () => accelerateHelper(80, 22.5, () => shiftDelay(gear2, 150));
// 80 -> 140, shiftDelay(0.15s) + 1.05s = 1.2s
const gear2 = () => accelerateHelper(140, 17.5, () => shiftDelay(gear3, 120)); 
// 140 -> 200, 0.12s + 1.68s = 1.8s
const gear3 = () => accelerateHelper(200, 28, () => shiftDelay(gear4, 80));
// 200 -> 250, 0.08 + 2.12s = 2.2s
const gear4 = () => accelerateHelper(250, 42.4, () => shiftDelay(gear5, 80));
// 250 -> 300, 0.08 + 3.62s = 3.7s
const gear5 = () => accelerateHelper(300, 72.4, () => shiftDelay(gear6, 60));
// 300 -> 350, 0.06 + 6.14s = 6.2s
const gear6 = () => accelerateHelper(350, 122.8, () => shiftDelay(gear7, 30));
// 350 -> 380, 0.03 + 9.17s = 9.2s
const gear7 = () => accelerateHelper(380, 305.66, () => shiftDelay(gear8, 20));
// 380 -> 400, 0.02 + 5.88s = 5.9s
const gear8 = () => accelerateHelper(400, 294);

function sequentialAccelerate(){
    isThrottlePressed = true;
    clearInterval(descelerateInterval);
    switch(currentGear){
        case 'N': return accelerateHelper(0, 0);
        case 'P': return accelerateHelper(0, 0);
        case 1 : return accelerateHelper(80, 22.5)
        case 2 : return accelerateHelper(140, 17.5)
        case 3 : return accelerateHelper(200, 28)
        case 4 : return accelerateHelper(250, 42.4)
        case 5 : return accelerateHelper(300, 72.4)
        case 6 : return accelerateHelper(350, 122.8)
        case 7 : return accelerateHelper(380, 305.66)
        case 8 : return accelerateHelper(400, 294)
        default: return;
    }
}

function accelerate() {
    if(isManualMode) return sequentialAccelerate();
    isThrottlePressed = true;
    clearInterval(descelerateInterval);
    switch(true){
        case inRange(0, 80, speed): return gear1();
        case inRange(81, 140, speed): return gear2();
        case inRange(141, 200, speed): return gear3();
        case inRange(201, 250, speed): return gear4();
        case inRange(251, 300, speed): return gear5();
        case inRange(301, 350, speed): return gear6();
        case inRange(351, 380, speed): return gear7();
        case inRange(381, 400, speed): return gear8();
        default : return;
    }
}

function keyDownListener(e){
    if(!["ArrowUp", "Space", "ArrowDown", "KeyW", "KeyS"].includes(e.code)) return;
    keyUp = false;
    if(!keyDown){
        keyDown = true;
        if(["ArrowUp", "KeyW"].includes(e.code)){
            gasPedal.classList.add('active');
            return accelerate();
        }
        else if(["ArrowDown", "Space", "KeyS"].includes(e.code)){
            brakePedal.classList.add('active');
            return descelerate();
        }
    }
}

function keyUpListener(e){
    keyDown = false;
    if(!keyUp){
        keyUp = true;
        gasPedal.classList.remove('active');
        brakePedal.classList.remove('active');
        return descelerateHelper();
    }
}

function setControls(){
    ignition = true;
    renderGearChangeBySpeed(speed);
    
    // Dom element interation
    gasPedal.addEventListener('mousedown', accelerate);
    gasPedal.addEventListener('touchstart', accelerate);

    gasPedal.addEventListener('mouseup', descelerateHelper);
    gasPedal.addEventListener('touchend', descelerateHelper);

    brakePedal.addEventListener('mousedown', descelerate);
    brakePedal.addEventListener('touchstart', descelerate);

    brakePedal.addEventListener('mouseup', descelerateHelper);
    brakePedal.addEventListener('touchend', descelerateHelper);

    // keyboard interaction
    window.addEventListener('keydown', keyDownListener);
    window.addEventListener('keyup', keyUpListener);
}

function unsetControls(){
    ignition = false;
    renderGearChangeBySpeed(speed);
    gasPedal.removeEventListener('mousedown', accelerate);
    gasPedal.removeEventListener('touchstart', accelerate);

    gasPedal.removeEventListener('mouseup', descelerateHelper);
    gasPedal.removeEventListener('touchend', descelerateHelper);

    brakePedal.removeEventListener('mousedown', descelerate);
    brakePedal.removeEventListener('touchstart', descelerate);

    brakePedal.removeEventListener('mouseup', descelerateHelper);
    brakePedal.removeEventListener('touchend', descelerateHelper);
    window.removeEventListener('keydown', keyDownListener);
    window.removeEventListener('keyup', keyUpListener);
}

function startStopEngine(){
    if (isEngineBusy || speed > 0) return;
    isEngineBusy = true;

    if (ignition) { // when engine is already on, turn it off;
        setTimeout(() => {
            soundManager.stopIdleSound();
            main_guage.classList.toggle('ignition');
            isEngineBusy = false;
        }, 500)
        transmissionSwitch.disabled = false;
        unsetControls();
    } else {
        carStartAudio.play().then(() => {
            main_guage.classList.toggle('ignition');
            transmissionSwitch.disabled = true;
            setTimeout(() => {
                soundManager.playIdleSound(); // Start with idle sound
            }, 750);
            setTimeout(() => {
                const options = { step: 4, rate: 7 };
                accelerateHelper(400, 7, () => descelerate(null, options, () => {
                    setControls();
                    isEngineBusy = false;
                }), options);
            }, 800)
        }).catch(e => console.error('Engine start failed:', e));
    }
}

transmissionSwitch.addEventListener('change', () => {
    if(transmissionSwitch.checked){
        isManualMode = true;
        let temp = shifter.getCurrentGear();
        if(temp!=currentGear){
            displayGearChange(isNaN(temp) ? temp : Number(temp));
        }
        switchLabel.innerHTML = 'Manual';
        return;
    }
    switchLabel.innerHTML = 'Automatic';
    isManualMode = false;
})

// In your index.js
document.addEventListener('DOMContentLoaded', () => {
    let audioEnabled = false;
    
    if (!audioEnabled) {
      const overlay = document.querySelector('.overlay');
      const audioSwitch = document.querySelector('.switch-container.audio input');
      const audioVolume = document.querySelector('.volume-control input');
      const switchLabel = document.querySelector('.switch-container.audio .switch-label');
      const volumeLabel = document.querySelector('.volume-control label');

      const audioVal = JSON.parse(localStorage.getItem('audio'));
      const volume = JSON.parse(localStorage.getItem('volume'));

      function audioToggleRoutine(status){
        let text = status ? 'Audio On' : 'Audio Off';
        if(!status){
            audioVolume.disabled = true
        } else{
            audioVolume.disabled = false
        }
        switchLabel.innerHTML = text;
      }
      if(typeof(audioVal)==='boolean') {
        audioSwitch.checked = audioVal;
        audioToggleRoutine(audioVal);
      }
      if(typeof(volume)==='number' && inRange(0, 100, volume)) {
        audioVolume.value = volume;
        volumeLabel.innerHTML = `App Volume: ${volume}%`
      }
      
      audioSwitch.addEventListener('change', (e) => audioToggleRoutine(e.target.checked))

      audioVolume.addEventListener('input', (e) => {
        let value = e.target.value;
        volumeLabel.innerHTML = `App Volume: ${value}%`
      })

      document.getElementById('enable-audio-btn').addEventListener('click', () => {
        localStorage.setItem('audio', audioSwitch.checked);
        localStorage.setItem('volume', audioVolume.value);
        
        ignitionButton.addEventListener('click', startStopEngine);
        window.addEventListener('keydown', (e) => {
            console.log(e.code);
            if(e.code==='KeyI'){
                startStopEngine()
            }
        })
        overlay.classList.add('hide');
        
        // Preload audio elements on iOS
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          document.querySelectorAll('audio').forEach(audio => {
            audio.load();
          });
        }

        // set the audio settings, delay is used to load audio files in SoundManager
        setTimeout(() => {
            const isMuted = !audioSwitch.checked;
            const volume = isMuted ? 0 : Math.min(1, Math.max(0, parseFloat(audioVolume.value) / 100));
            
            Object.values(soundManager.actionSounds).forEach(({ element }) => {
                element.muted = isMuted;
                element.volume = volume;
            });
            soundManager.setIdleVolume(isMuted ? 0 : volume*100);
        }, 200);
      });
    }
  });