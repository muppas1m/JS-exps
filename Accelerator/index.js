const gasPedal = document.getElementById('gad-pedal');
const brakePedal = document.getElementById('brake-pedal');
const digitalSpeed = document.getElementById('digitalSpeed');
const controls = document.getElementsByClassName('controls')[0];
const speedIndicator = document.querySelector('#sc');
const carStartAudio = document.getElementById('car-start');
const carAccelerateAudio = document.getElementById('car-accelerate');
let accelerateInterval;
let descelerateInterval;
let speed = 0;

const renderSpeed = (speed, options = { digitalSpeed : true }) => {
    speedIndicator.style.transform = `rotateZ(${speed*0.675}deg)`; // 0-400 in a 270deg scale = 0.765
    if(options.digitalSpeed){
        digitalSpeed.textContent = speed;
    }
}

const stopAccelerationSound = () => {
    carAccelerateAudio.pause();
    carAccelerateAudio.currentTime = 2;
}

const slowDown = () => {
    stopAccelerationSound();
    clearInterval(accelerateInterval);
    clearInterval(descelerateInterval);
    descelerateInterval = setInterval(() => {
        if(!speed) return clearInterval(descelerateInterval);
        speed -=1;
        renderSpeed(speed);
    }, 50);
}

const descelerate = (e = null, options = {}, callback = null) => {
    const { rate = 15, step = 1, digitalSpeed = true} = options;
    stopAccelerationSound();
    clearInterval(accelerateInterval);
    clearInterval(descelerateInterval);
    descelerateInterval = setInterval(() => {
        if(speed<=0) {
            speed = 0
            clearInterval(descelerateInterval);
            return callback && callback()
        }        
        speed -= step;
        renderSpeed(speed, {digitalSpeed});
    }, rate); //23
}

const accelerateHelper = (maxSpeed, interval, nextGear, options = {}) => {
    const { step = 1, digitalSpeed = true } = options;
    clearInterval(accelerateInterval);
    accelerateInterval = setInterval(() => {
        if(speed >= maxSpeed) return (nextGear && nextGear());
        speed += step;
        renderSpeed(speed, {digitalSpeed});
    }, interval)
}

const maxSpeedRange = () => accelerateHelper(400, 60);

const highSpeedRange = () => accelerateHelper(300, 40, maxSpeedRange);

const midSpeedRange = () => accelerateHelper(200, 35, highSpeedRange);

const lowSpeedRange = () => accelerateHelper(100, 28, midSpeedRange);

const inRange = (min, max, val) => (val>=min && val<=max);
const accelerate = () => {
    clearInterval(descelerateInterval);
    carStartAudio.pause();
    carStartAudio.currentTime = 0;
    carAccelerateAudio.play();
    switch(true){
        case inRange(0, 99, speed):{
            return lowSpeedRange();
        }
        case inRange(100, 199, speed):{
            return midSpeedRange();
        }
        case inRange(200, 299, speed):{
            return highSpeedRange();
        }
        case inRange(300, 399, speed):{
            return maxSpeedRange();
        }
        default : return;
    }
}

let keyDown = false, keyUp = false;
function setControls(){

    controls.style.display = 'flex'
    
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

window.addEventListener('DOMContentLoaded', () => {
    controls.style.display = 'none'
    setTimeout(() => {
        const options = {step: 4, rate: 7, digitalSpeed: false};
        accelerateHelper(400, 7, () => descelerate(null, options, setControls), options); 
    }, 800)
})