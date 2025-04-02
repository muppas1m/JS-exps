const gasPedal = document.getElementById('gad-pedal');
const brakePedal = document.getElementById('brake-pedal');
const digitalSpeed = document.getElementById('digitalSpeed');
const gearIndicator = document.getElementById('gearIndicator');
const controls = document.getElementsByClassName('controls')[0];
const speedIndicator = document.querySelector('#sc');
const carStartAudio = document.getElementById('car-start');
const carAccelerateAudio = document.getElementById('car-accelerate');
let accelerateInterval, descelerateInterval, shiftDelayId, shiftDelayAnimationId;
let speed = 0, prevGear = 0, currentGear = 0, isThrottlePressed = false;
let ignition = false;
const gearSequence = ['R', 'P', 'N', 1, 2, 3, 4, 5, 6, 7, 8], gearDisplayCap = 3;

const isGearChange = () => prevGear!==currentGear;

const inRange = (min, max, val) => (val>=min && val<=max);

const getCurrentGear = (speed) => {
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

// helper function to display needle movement, digital speed and gears
const renderSpeed = (speed, options = { }) => {
    // const easedSpeed = !ignition ? (speed < 300 ? speed : speed * 0.8) : speed; // Slow down needle above 300km/h

    speedIndicator.style.transform = `rotateZ(${speed*0.675}deg)`; // 0-400 in a 270deg scale = 0.675
    if(ignition){
        currentGear = getCurrentGear(speed);
        const gearIndex = gearSequence.findIndex(gear => (['R,P,N'].includes(currentGear) || gear===currentGear));
        for(let node of gearIndicator.children){
            if(node.classList.value==='leftGears'){
                node.textContent = gearSequence.slice(Math.max(0, gearIndex - gearDisplayCap), gearIndex).join('');
            } else if(node.classList.value==='currentGear'){
                if(isGearChange()){
                    if(shiftDelayAnimationId) clearTimeout(shiftDelayAnimationId);
                    gearIndicator.classList.add('shift');
                    shiftDelayAnimationId = setTimeout(() => gearIndicator.classList.remove('shift'), 200);
                }
                node.textContent = gearSequence[gearIndex];
            } else{
                node.textContent = gearSequence.slice(gearIndex+1, gearIndex + gearDisplayCap+1).join('');
            }
        }
        prevGear = currentGear;
        digitalSpeed.textContent = Math.floor(speed);
    }
}

const stopAccelerationSound = () => {
    carAccelerateAudio.pause();
    carAccelerateAudio.currentTime = 2;
}

const initiateDesceleration = () => {
    clearTimeout(shiftDelayId);
    clearInterval(accelerateInterval);
    clearInterval(descelerateInterval);
}

const slowDown = () => {
    isThrottlePressed = false;
    stopAccelerationSound();
    initiateDesceleration();
    descelerateInterval = setInterval(() => {
        if(speed<=0) return clearInterval(descelerateInterval);
        speed -=1;
        renderSpeed(speed);
    }, 50);
}

const descelerate = (e = null, options = {}, callback = null) => {
    isThrottlePressed = false;
    const { rate = 15, step = 1 } = options;
    stopAccelerationSound();
    initiateDesceleration();
    descelerateInterval = setInterval(() => {
        if(speed<=0) {
            speed = 0
            clearInterval(descelerateInterval);
            return callback && callback()
        }        
        speed -= step;
        // speed -= speed > 200 ? 4 : (speed > 100 ? 2 : 1); // Aggressive braking at high speeds
        renderSpeed(speed);
    }, rate);
}

const accelerateHelper = (maxSpeed, interval, nextGearCB, options = {}) => {
    const { step = 1 } = options;
    clearInterval(accelerateInterval);
    // let strt = Date.now(), low = speed;
    accelerateInterval = setInterval(() => {
        if(!isThrottlePressed && ignition) return slowDown(); // to slowDown when throttle is released during gear change
        if (speed >= maxSpeed) {
            // console.log(low, ' to ', maxSpeed, ': ', Date.now() - strt, 'ms')
            return (nextGearCB && nextGearCB());
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

const accelerate = () => {
    isThrottlePressed = true;
    clearInterval(descelerateInterval);
    carStartAudio.pause();
    carStartAudio.currentTime = 0;
    carAccelerateAudio.play();
    switch(true){
        case inRange(0, 80, speed):{
            return gear1();
        }
        case inRange(81, 140, speed):{
            return gear2();
        }
        case inRange(141, 200, speed):{
            return gear3();
        }
        case inRange(201, 250, speed):{
            return gear4();
        }
        case inRange(251, 300, speed):{
            return gear5();
        }
        case inRange(301, 350, speed):{
            return gear6();
        }
        case inRange(351, 380, speed):{
            return gear7();
        }
        case inRange(381, 400, speed):{
            return gear8();
        }
        default : return;
    }
}

let keyDown = false, keyUp = false;
function setControls(){
    ignition = true;
    renderSpeed(speed);
    controls.style.display = 'flex';
    
    // Dom element interation
    gasPedal.addEventListener('mousedown', accelerate);
    gasPedal.addEventListener('touchstart', accelerate);

    gasPedal.addEventListener('mouseup', slowDown);
    gasPedal.addEventListener('touchend', slowDown);

    brakePedal.addEventListener('mousedown', descelerate);
    brakePedal.addEventListener('touchstart', descelerate);

    brakePedal.addEventListener('mouseup', slowDown);
    brakePedal.addEventListener('touchend', slowDown);

    // keyboard interaction
    window.addEventListener('keydown', (e) => {
        if(!["ArrowUp", "Space", "ArrowDown"].includes(e.code)) return;
        keyUp = false;
        if(!keyDown){
            keyDown = true;
            if(e.code==="ArrowUp"){
                gasPedal.classList.add('active');
                return accelerate();
            }
            else if(["ArrowDown", "Space"].includes(e.code)){
                brakePedal.classList.add('active');
                return descelerate();
            }
        }
    });
    window.addEventListener('keyup', (e) => {
        keyDown = false;
        if(!keyUp){
            keyUp = true;
            gasPedal.classList.remove('active');
            brakePedal.classList.remove('active');
            return slowDown();
        }
    });
}

window.addEventListener('DOMContentLoaded', () => { // For guage sweep & aesthetics
    controls.style.display = 'none'
    setTimeout(() => {
        const options = { step: 4, rate: 7 };
        accelerateHelper(400, 7, () => descelerate(null, options, setControls), options); 
    }, 800)
})