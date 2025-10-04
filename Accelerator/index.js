import * as THREE from './audio_sim/three_js/build/three.module.js'; // For engine sound effects
import {SoundGeneratorAudioListener, EngineSoundGenerator} from './audio_sim/engine_sound_generator/sound_generator_worklet.js';
import { SoundManager } from "./carFx.js";
import { GearShifter } from "./gearShifter.js";
import { createManagedInterval } from "./utils.js";
import { Gauge } from "./Guage.js";
import { gearStickMoveDelay } from './constants.js';

const soundManager = new SoundManager();
const shifter = new GearShifter(document.querySelector('.container'));

const MAX_SPEED = 400;
const SPEED_UNITS = 'km/h';
const MAX_RPM = 10000;
const RPM_REDLINE = 9000;
const OIL_TEMP_MAX = 300;
const TEMP_UNITS = '°C';
const ENGINE_IDLE_RPM = 1000;
const NEUTRAL_REV_LIMIT = 9000;

var rpmParam, soundCarEngine;
let engineReadyPromise = false;

async function initEngineAudioIfNeeded() {
    if (engineReadyPromise) return engineReadyPromise;

    engineReadyPromise = new Promise((resolve, reject) => {
        const resumeCtx = () => {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => loadEngineSound(audioCtx, resolve, reject));
            } else {
                loadEngineSound(audioCtx, resolve, reject);
            }
        };

        // Wait for user interaction
        document.addEventListener('click', resumeCtx, { once: true });
        document.addEventListener('touchstart', resumeCtx, { once: true });
    });

    return engineReadyPromise;
}

function loadEngineSound(audioCtx, resolve, reject) {
    const listener = new SoundGeneratorAudioListener(audioCtx);

    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = function () {
        try {
            soundCarEngine = new EngineSoundGenerator({
                listener: listener,
                parameters: {
                    cylinders: 4,
                    ignitionTime: 0.012,
                    intakeWaveguideLength: 100,
                    exhaustWaveguideLength: 100,
                    extractorWaveguideLength: 100,
                    straightPipeWaveguideLength: 128,
                    outletWaveguideLength: 5,
                    intakeOpenReflectionFactor: 0.01,
                    intakeClosedReflectionFactor: 0.95,
                    exhaustOpenReflectionFactor: 0.01,
                    exhaustClosedReflectionFactor: 0.95,
                    straightPipeReflectionFactor: 0.01,
                    outletReflectionFactor: 0.01,
                    action: 0.1,
                    mufflerElementsLength: [10, 15, 20, 25],
                }
            });

            soundCarEngine.gainIntake.gain.value = 0.1;
            soundCarEngine.gain.gain.value = 0.5;
            soundCarEngine.gainOutlet.gain.value = 0.05;
            soundCarEngine.gainEngineBlockVibrations.gain.value = 1;

            rpmParam = soundCarEngine.worklet.parameters.get('rpm');
            rpmParam.value = ENGINE_IDLE_RPM;

            resolve();
        } catch (err) {
            reject(err);
        }
    };
    EngineSoundGenerator.load(loadingManager, listener, "./audio_sim/engine_sound_generator/");
}

function startEngineAudio(){
    soundCarEngine.play();
}

function stopEngineAudio(){
    soundCarEngine.stop();
}

// input elements
const gasPedal = document.getElementById('gas-pedal'); // GAS pedal
const brakePedal = document.getElementById('brake-pedal'); // BRAKE pedal
const ignitionButton = document.getElementById('engine-button'); // ENGINE Start/Stop button
const transmissionSwitch = document.querySelector('.switch-container input'); // Transmission Mode switch

// output elements
const gearIndicator = document.getElementById('gearIndicator');
const switchLabel = document.querySelector('.switch-container .switch-label');

// Guage containers
const main_guage = document.querySelector('.clock.speedometer'); // speedometer
const rpm_guage = document.querySelector('.clock.rpm_guage'); // tacometer
const oil_temp_guage = document.querySelector('.clock.oil-temp-guage'); // oil temperature

// audio sources
const carStartAudio = document.getElementById('engine-start'); // engine start audio

const speedoMeterGuage = new Gauge(main_guage, {
    maxValue: MAX_SPEED,
    units: SPEED_UNITS,
    digitalDisplay: true,
    onRender: (speed) => {
        if(!ignition) return;
        speedoMeterGuage.digitalDisplay.textContent = Math.floor(speed);
        renderGearChangeBySpeed(speed);
    }
})

const rpmGuage = new Gauge(rpm_guage, {
    maxValue: MAX_RPM / 1000,
    redlineStart: RPM_REDLINE / 1000,
    onRender: function(rpm) {
        rpm_guage.classList.toggle('in-redline', rpm >= (RPM_REDLINE / 1000))
    }
})

const oilTempGauge  = new Gauge(oil_temp_guage, {
    maxValue: OIL_TEMP_MAX,
    units: TEMP_UNITS,
    digitalDisplay: true,
    onRender: function(val) {
        oilTempGauge.digitalDisplay.textContent = parseFloat(val).toFixed(0)
    }
})

// state variables
let accelerateInterval, descelerateInterval, shiftDelayId, shiftAnimationId;
let speed = 0, prevGear = 0, currentGear = 'P', isThrottlePressed = false, prevSpeed = null;
let ignition = false, isEngineBusy = false;
let keyDown = false, keyUp = false, isManualMode = false;
const gearSequence = ['R', 'P', 'N', 1, 2, 3, 4, 5, 6, 7, 8], gearDisplayCap = 3;
const rpmParams = {
    gearRatios: {
      'P': 0, 'R': 0.6, 'N': 0,
      1: 4.25, 2: 2.6, 3: 1.80, 
      4: 1.41, 5: 1.18, 6: 0.99,
      7: 0.92, 8: 0.75
    },
    currentRPM: 0
};

function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
    }
  };
}

let throttledGearChange = throttle(displayGearChange, gearStickMoveDelay);

// gear profiles 
// gear profile = (() => accelerateHelper(interval, gearTopSpeed, next_gear_callback || null));
// 0 -> 80 in 1.8s, so each tick cost 22.5ms
const gear1 = () => accelerateHelper(22.5, 80, isManualMode ? null : () => shiftDelay(gear2));
// 80 -> 140, shiftDelay(0.15s) + 1.05s = 1.2s
const gear2 = () => accelerateHelper(17.5, 140, isManualMode ? null : () => shiftDelay(gear3)); 
// 140 -> 200, 0.12s + 1.68s = 1.8s
const gear3 = () => accelerateHelper(28, 200, isManualMode ? null : () => shiftDelay(gear4));
// 200 -> 250, 0.08 + 2.12s = 2.2s
const gear4 = () => accelerateHelper(42.4, 250, isManualMode ? null : () => shiftDelay(gear5));
// 250 -> 300, 0.08 + 3.62s = 3.7s
const gear5 = () => accelerateHelper(72.4, 300, isManualMode ? null : () => shiftDelay(gear6));
// 300 -> 350, 0.06 + 6.14s = 6.2s
const gear6 = () => accelerateHelper(122.8, 350, isManualMode ? null : () => shiftDelay(gear7));
// 350 -> 380, 0.03 + 9.17s = 9.2s
const gear7 = () => accelerateHelper(305.66, 380, isManualMode ? null : () => shiftDelay(gear8));
// 380 -> 400, 0.02 + 5.88s = 5.9s
const gear8 = () => accelerateHelper(294, 400);

function calculateRPM() {
    // When engine is off
    if (!ignition) {
      rpmParams.currentRPM = 0;
      return 0;
    }
  
    // Manual mode revving in Neutral
    if (isManualMode && ['P', 'N'].includes(currentGear)) {
        // Linear RPM increase up to the Limit
        rpmParams.currentRPM = Math.max(ENGINE_IDLE_RPM, Math.min( rpmParams.currentRPM + (isThrottlePressed ? 200 : -150), NEUTRAL_REV_LIMIT));  // Fast ramp-up // Max rev in neutral (prevents engine damage simulation)
        return rpmParams.currentRPM;
    }

    // When in Park/Neutral
    if (['P', 'N'].includes(currentGear)) {
      rpmParams.currentRPM = ENGINE_IDLE_RPM
      return rpmParams.currentRPM;
    }
  
    // Base RPM calculation
    let baseRPM = speed * 20 * rpmParams.gearRatios[currentGear];
    
    // Apply realistic modifiers
    if (isThrottlePressed) {
      // Accelerating - RPM rises faster
      baseRPM *= 1.3;
      // Simulate gear-specific characteristics
      if (currentGear === 1) baseRPM *= 1.1; // Lower gears more sensitive
    } else {
      // Decelerating - RPM drops slower (engine braking)
      baseRPM *= 0.9;
    }
  
    // Clamp values between idle and redline
    rpmParams.currentRPM = Math.max(ENGINE_IDLE_RPM, Math.min(baseRPM, isManualMode ? rpmGuage.config.maxValue * 1000 : RPM_REDLINE));
  
    // console.log(rpmParams.currentRPM);
    return rpmParams.currentRPM;
  }

const isGearChange = () => prevGear !== currentGear;

const inRange = (min, max, val) => (val>=min && val<=max);

// Helper function that gets current gear based on speed
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

// Handler function to shift gears in manual mode
function handleManualGearShift(e){
    if(!isManualMode) return; // should work only on manual
    displayGearChange(isNaN(e.gear) ? e.gear : Number(e.gear));
    if(isThrottlePressed) sequentialAccelerate();
}

shifter.on('gearChange', handleManualGearShift); // Event Listener

// Helper function to handle digital display of gear change sequence
function displayGearChange(gear){
    if(gear) currentGear = gear;

    // Pkay shift sound, when slowing, or for the first gear, or for manual mode
    if (!isThrottlePressed || (isThrottlePressed && currentGear === 1) || (isThrottlePressed && isManualMode)) soundManager.playShiftSound();
    
    const gearIndex = gearSequence.findIndex(gear => (['R,P,N'].includes(currentGear) || gear===currentGear));
    for (let node of gearIndicator.children) {
        if (node.classList.value === 'leftGears') {
            node.textContent = gearSequence.slice(Math.max(0, gearIndex - gearDisplayCap), gearIndex).join('');
        } else if (node.classList.value === 'currentGear') {
            if (shiftAnimationId) clearTimeout(shiftAnimationId); // clear prev gear animation


            gearIndicator.classList.add('shift');
            if(!isManualMode) shifter.moveToGear(currentGear.toString()); // gear shift when automatic mode;
            shiftAnimationId = setTimeout(() => gearIndicator.classList.remove('shift'), 200); // animate current gear
            node.textContent = gearSequence[gearIndex];
        } else {
            node.textContent = gearSequence.slice(gearIndex + 1, gearIndex + gearDisplayCap + 1).join('');
        }
    }
    prevGear = gear;
}

// This function uses speed to determine the current gear
const renderGearChangeBySpeed = (speed) => {
    if(isManualMode) return;
    currentGear = getCurrentGearBySpeed(speed);
    if(isGearChange() && (speed <= prevSpeed || speed<=80)) { 
        // Only initialize gearChange when slowing down or for first gear 
        // For other gears, shiftDelay will handle
        displayGearChange(currentGear);
    }
    prevSpeed = speed;
}

// helper function to update needle position, digital speed and gears
const renderAll = () => {
    speedoMeterGuage.render(speed)
    if(isEngineBusy) return;

    const rpm = calculateRPM();
    rpmParam.value = rpm;
    rpm_guage.classList.toggle('neutral-rev', 
        isManualMode && currentGear === 'N' && isThrottlePressed);
    rpmGuage.render(rpm / 1000);
} 

// Helper to clear any previous intervals of accelerate, descelerate or gear shifting operations
const clearExistingIntervals = () => {
    clearTimeout(shiftDelayId);
    if(accelerateInterval) accelerateInterval.clear();
    if(descelerateInterval) descelerateInterval.clear();
}

// Helper to handle desceleratation
function performDescelerate(e, step = 1, rate = 50, callback) {
    isThrottlePressed = false;
    clearExistingIntervals();
    descelerateInterval = createManagedInterval(() => {
        if(speed<=0) {
            speed = 0;
            clearExistingIntervals();
            return callback && callback();
        }    
        speed -= step;
        renderAll();
    }, rate)
}
// Helper to handle acceleration
function performAccelerate(maxSpeed, nextGearCB, options = {}){
    const { step = 1 } = options;
    if(!isThrottlePressed && ignition) return performDescelerate(); // to performDescelerate when throttle is released during gear change
    if (speed >= maxSpeed) {
        if(isManualMode && speed > maxSpeed) {
            if(accelerateInterval) clearExistingIntervals();
            accelerateInterval = createManagedInterval(() => {
                if(speed<=maxSpeed) return sequentialAccelerate();
                speed -=1;
                renderAll();
            }, 50)
        } else{
            if(!isManualMode && speed < MAX_SPEED) soundManager.playShiftSound(); // for accelerating
            return (nextGearCB && nextGearCB());
        }
    }
    speed += step;
    renderAll();
}
/* Helper to perform acceleration for an interval */
function accelerateHelper(interval, ...args){
    if(accelerateInterval) clearExistingIntervals();
    accelerateInterval = createManagedInterval(performAccelerate, interval, {}, ...args);
}
// Helper to perform gear shift after a given delay
function shiftDelay (nextGearCB, gearShiftDelay = gearStickMoveDelay) {
    throttledGearChange(getCurrentGearBySpeed(speed) + 1); // handle up shift gear change
    shiftDelayId = setTimeout(nextGearCB, gearShiftDelay);
}

// Helper to perform manual acceleration
function sequentialAccelerate(){
    isThrottlePressed = true;
    if(descelerateInterval) clearExistingIntervals();

    // Handle Revv in Neutral mode
    if(['P', 'N'].includes(currentGear) && isThrottlePressed){
        const revInterval = createManagedInterval(() => {
            if(!isThrottlePressed){
                revInterval.clear();
                const revFallInterval = createManagedInterval(() => {
                    if(rpmParams.currentRPM <= ENGINE_IDLE_RPM || isThrottlePressed) revFallInterval.clear();
                    renderAll();
                }, 20, { immediate: true })
            }
            renderAll();
        }, 18, { immediate: true });
    }

    switch(currentGear){
        case 1 : return gear1()
        case 2 : return gear2()
        case 3 : return gear3()
        case 4 : return gear4()
        case 5 : return gear5()
        case 6 : return gear6()
        case 7 : return gear7()
        case 8 : return gear8()
        default: return accelerateHelper(0, 0);
    }
}

// Handler that listens BRAKE button press
function descelerateInputListener(e = null, options = {}, callback = null) {
    const { rate = 15, step = 1 } = options;
    clearExistingIntervals();
    return performDescelerate(e, step, rate, callback);
}

// Handler that listens GAS button press
function accelerateInputListener() {
    if(isManualMode) return sequentialAccelerate();
    isThrottlePressed = true;
    if(descelerateInterval) clearExistingIntervals();
    switch(true){
        case inRange(0, 80, speed): return gear1();
        case inRange(81, 140, speed): return gear2();
        case inRange(141, 200, speed): return gear3();
        case inRange(201, 250, speed): return gear4();
        case inRange(251, 300, speed): return gear5();
        case inRange(301, 350, speed): return gear6();
        case inRange(351, 380, speed): return gear7();
        case inRange(381, 400, speed): return gear8();
        default: return;
    }
}

// Helpers to setup user input controls 
function keyDownListener(e){
    if(!["ArrowUp", "Space", "ArrowDown", "KeyW", "KeyS"].includes(e.code)) return;
    keyUp = false;
    if(!keyDown){
        keyDown = true;
        if(["ArrowUp", "KeyW"].includes(e.code)){
            gasPedal.classList.add('active');
            return accelerateInputListener();
        }
        else if(["ArrowDown", "Space", "KeyS"].includes(e.code)){
            brakePedal.classList.add('active');
            return descelerateInputListener();
        }
    }
}

function keyUpListener(e){
    keyDown = false;
    if(!keyUp){
        keyUp = true;
        gasPedal.classList.remove('active');
        brakePedal.classList.remove('active');
        return performDescelerate();
    }
}

function setControls(){
    ignition = true;
    renderGearChangeBySpeed(speed);
    
    // Dom element interation
    gasPedal.addEventListener('mousedown', accelerateInputListener);
    gasPedal.addEventListener('touchstart', accelerateInputListener);

    gasPedal.addEventListener('mouseup', performDescelerate);
    gasPedal.addEventListener('touchend', performDescelerate);

    brakePedal.addEventListener('mousedown', descelerateInputListener);
    brakePedal.addEventListener('touchstart', descelerateInputListener);

    brakePedal.addEventListener('mouseup', performDescelerate);
    brakePedal.addEventListener('touchend', performDescelerate);

    // keyboard interaction
    window.addEventListener('keydown', keyDownListener);
    window.addEventListener('keyup', keyUpListener);
}

function unsetControls(){
    ignition = false;
    renderGearChangeBySpeed(speed);

    gasPedal.removeEventListener('mousedown', accelerateInputListener);
    gasPedal.removeEventListener('touchstart', accelerateInputListener);

    gasPedal.removeEventListener('mouseup', performDescelerate);
    gasPedal.removeEventListener('touchend', performDescelerate);

    brakePedal.removeEventListener('mousedown', descelerateInputListener);
    brakePedal.removeEventListener('touchstart', descelerateInputListener);

    brakePedal.removeEventListener('mouseup', performDescelerate);
    brakePedal.removeEventListener('touchend', performDescelerate);
    window.removeEventListener('keydown', keyDownListener);
    window.removeEventListener('keyup', keyUpListener);
}

function toggleGuages(){
    main_guage.classList.toggle('ignition');
    rpm_guage.classList.toggle('ignition');
    oil_temp_guage.classList.toggle('ignition');
}

function engineOffSequence(){
    setTimeout(() => {
        oilTempGauge.render(0, true);
        rpmGuage.render(0); // Immediate drop to 0
        stopEngineAudio();
        toggleGuages();
        isEngineBusy = false;
    }, 500);
    transmissionSwitch.disabled = false;
    unsetControls();
}

function engineOnSequence(){
    toggleGuages(); // turn on gauges
    transmissionSwitch.disabled = true;
    
    // Perform engine Rev upon startup
    setTimeout(() => {
        let startupRPM = 0, dir = 1;
        const revInterval = createManagedInterval(() => {
            startupRPM += (dir===1 ? 200 : -50);
            rpmGuage.render(startupRPM / 1000);
            
            if (startupRPM >= 5000) { // Initial Rev till 5000 on Engine Startup 
                dir = -1;
            }
            if(dir === -1 && startupRPM <= ENGINE_IDLE_RPM) revInterval.clear();
        }, 10);
    }, 200)

    // start engine idle sound
    setTimeout(() => {
        startEngineAudio();
    }, 550);

    // Perform engine startup ceremony
    setTimeout(() => {
        const options = { step: 4, rate: 7 };
        oilTempGauge.render(100, true);
        accelerateHelper(7, MAX_SPEED, () => descelerateInputListener(null, options, () => {
            setControls();
            isEngineBusy = false;
        }), options);
    }, 800)
}

function startStopEngine(){
    if (isEngineBusy || speed > 0) return;
    isEngineBusy = true; // to hault actions on engine button

    if (ignition) { // when engine is already on, turn it off
        return engineOffSequence();
    } else {
        carStartAudio.play().then(engineOnSequence).catch(e => console.error('Engine start failed:', e));
    }
}

function changeTransmissionMode(){
    if(ignition) return; // can change mode, only when engine turned off
    if(transmissionSwitch.checked){
        isManualMode = true;
        let temp = shifter.getCurrentGear();
        if(temp!=currentGear) displayGearChange(isNaN(temp) ? temp : Number(temp));
        switchLabel.innerHTML = 'Manual';
        return;
    }
    switchLabel.innerHTML = 'Automatic';
    isManualMode = false;
}

function updateEngineSoundConfig(appVolume){
    const volumePercent = appVolume / 100;
    let gainNode = soundCarEngine.gainIntake;
    gainNode.gain.value *= volumePercent;

    // Engine Volume
    gainNode = soundCarEngine.gain;
    gainNode.gain.value *= volumePercent;

    // Outlet Volume
    gainNode = soundCarEngine.gainOutlet;
    gainNode.gain.value = volumePercent;

    setTimeout(() => {
        soundManager.setEffectsVolume(volumePercent);
    }, 100)
}

function onLoadRoutine() {
    let audioEnabled = false;
    
    if (!audioEnabled) {
      const overlay = document.querySelector('.overlay');
      const audioSwitch = document.querySelector('.switch-container.audio input');
      const audioVolume = document.querySelector('.volume-control input');
      const switchLabel = document.querySelector('.switch-container.audio .switch-label');
      const volumeLabel = document.querySelector('.volume-control label');

      const audioVal = JSON.parse(localStorage.getItem('audio')); // saved audio enable/disable
      const volume = JSON.parse(localStorage.getItem('volume')); // saved audio volume

      function toggleAppAudio(status){ // to on/off app audio
        let text = status ? 'Audio On' : 'Audio Off';

        if(!status) audioVolume.disabled = true;
        else audioVolume.disabled = false;

        switchLabel.innerHTML = text;
      }

      if(typeof(audioVal)==='boolean') {
        audioSwitch.checked = audioVal;
        toggleAppAudio(audioVal);
      }
      
      function updateAppVolume(volume){
        audioVolume.value = volume;
        volumeLabel.innerHTML = `App Volume: ${volume}%`
      }

      if(typeof(volume)==='number' && inRange(0, 100, volume)) {
        updateAppVolume(volume);
      }
      
      audioSwitch.addEventListener('change', (e) => toggleAppAudio(e.target.checked))

      audioVolume.addEventListener('input', (e) => updateAppVolume(e.target.value))

      document.getElementById('app-start-btn').addEventListener('click', async () => {
        await initEngineAudioIfNeeded(); // let load the engine audio deps

        updateEngineSoundConfig(audioSwitch.checked ? audioVolume.value : 0);
        // save settings
        localStorage.setItem('audio', audioSwitch.checked);
        localStorage.setItem('volume', audioVolume.value);
        
        ignitionButton.addEventListener('click', startStopEngine);
        
        window.addEventListener('keydown', (e) => {
            if(e.code==='KeyI') return startStopEngine();
            if(e.code==='KeyM') {
                if(ignition) return;
                transmissionSwitch.checked = Boolean(!transmissionSwitch.checked);
                changeTransmissionMode();
            }
        })
        
        // Preload audio elements on iOS
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            document.querySelectorAll('audio').forEach(audio => {
                audio.load();
            });
        }
        
        overlay.classList.add('hide');
      });
    }
}

document.addEventListener('DOMContentLoaded', onLoadRoutine);
transmissionSwitch.addEventListener('change', changeTransmissionMode)