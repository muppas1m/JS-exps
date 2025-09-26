document.body.innerHTML = null;
document.body.style.backgroundColor = '#fff';

const calcBody = document.createElement('div');
keys = ['CA','⌫',7,8,9,'÷',4,5,6,'x',1,2,3,'-', 0,'.','+','='];
const operators = ['+', '-', 'x', '÷', '.'];
const replacementRegex = /[x÷]/g;
const replacementMap = { 'x': '*', '÷': '/' };
const replaceCallback = (match) => replacementMap[match];

const screen = document.createElement('div');
screen.style.overflow = 'auto';
screen.style.padding = '5px';
screen.style.boxSizing = 'border-box'
screen.style.textAlign = 'right'
screen.style.border = '1px solid grey'
screen.style.gridColumn = '1 / span 4'
screen.style.fontSize = '2rem';
const empty = document.createElement('span');
empty.innerHTML = '0';
// empty.style.visibility = 'hidden';
screen.appendChild(empty)

document.body.appendChild(calcBody)
calcBody.style.display = 'grid';
calcBody.style.gridTemplateColumns = 'auto auto auto auto';
calcBody.style.width = '300px';
calcBody.style.height = '500px';
calcBody.style.color = '#000';

calcBody.appendChild(screen);
let total = 2, temp = 1;
for(let i of keys){
    const key = document.createElement('button');
    key.style.border = '1px solid grey';
    key.style.fontSize = '1.2rem'
    key.innerHTML = i;
    key.addEventListener('click', handleKeyPress)
    if(i=='CA' || i == '⌫'){
        key.style.gridColumn = `${temp} / span ${total}`;
        temp += total;
    }
    calcBody.appendChild(key);
}

function handleKeyPress(e){
    const key = (e.target.innerText)
    if(['CA','=','⌫'].includes(key)){
        if(key == '='){
            screen.innerText = eval(screen.innerText.replaceAll(replacementRegex, replaceCallback));
        } else if(key=='⌫'){
            screen.innerText = screen.innerText.substring(0, screen.innerText.length - 1);
            if(!screen.innerText) screen.appendChild(empty);
        } else {
            screen.innerText = '';
            screen.appendChild(empty);
        }
    } else{
        if(operators.includes(key) & !screen.innerText) return;
        if(operators.includes(key) && screen.innerText && operators.includes(screen.innerText[screen.innerText.length - 1])){
            screen.innerText = screen.innerText.substring(0, screen.innerText.length - 1) + key;
            return;
        }
        screen.innerText = screen.innerText.replace(/^0+/, '') + key;
    }
}