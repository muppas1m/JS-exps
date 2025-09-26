const hr = document.querySelector('#hr');
const mn = document.querySelector('#mn');
const sc = document.querySelector('#sc');

setInterval(() => {
    let day = new Date();
    const [hours, minutes, seconds] = [day.getHours(), day.getMinutes(), day.getSeconds()];
    let hourPinAngle = hours * 30; // 360 deg/ 12 hours
    let minsPinAngle = minutes * 6; // 360 deg/ 60 mins
    let secondsPinAngle = seconds * 6; // 360 deg/ 60 seconds

    hr.style.transform = `rotateZ(${hourPinAngle + (minsPinAngle/12)}deg)`; // hoursAngle + minsAngle for 1 hour
    console.log(minsPinAngle/12);
    mn.style.transform = `rotateZ(${minsPinAngle}deg)`;
    sc.style.transform = `rotateZ(${secondsPinAngle}deg)`;
},1000)