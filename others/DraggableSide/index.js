let dragging = 0,
  body = document.body,
  target = document.getElementById('dragbar');

function clearJSEvents() {
  dragging = 0;
  body.removeEventListener("mousemove", resize);
  body.classList.remove('resizing');
}

function resize(e) {
  if (e.pageX > 400 || e.pageX < 200) {
    return;
  }
  body.style.setProperty("--left-width", e.pageX + 'px');
}

target.onmousedown = function(e) {
  e.preventDefault();
  dragging = 1;
  body.addEventListener('mousemove', resize);
  body.classList.add('resizing');
};

document.onmouseup = function() {
  dragging ? clearJSEvents() : '';
};