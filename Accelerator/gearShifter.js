export class GearShifter {
  constructor(containerElement, options = {}) {
    // Configuration options with default
    const computedStyles = window.getComputedStyle(document.documentElement);
    this.config = {
      gearBoxSize: computedStyles.getPropertyValue('--gear-box-size'),
      trackBeginEndGutter: computedStyles.getPropertyValue('--track-begin-end-gutter'),
      trackerSize: computedStyles.getPropertyValue('--tracker-size'),
      trackerColor: 'rgb(255, 25, 0)',
      trackWidth: computedStyles.getPropertyValue('--track-width'),
      gearSequence: ['R', 'P', 'N', '1', '2', '3', '4', '5', '6', '7', '8'],
      lines: ['RP', '12', '34', '56', '78'],
      hLine: 'CD',
      initialGear: 'P',
      animationDuration: 100,
      neutralPause: 10,
      ...options
    };

    // DOM elements
    this.container = containerElement;
    this.tracker = document.createElement('div');
    this.tracker.className = 'tracker';
    this.container.appendChild(this.tracker);

    // Shifter State
    this.points = {};
    this.centerPoints = [];
    this.currentLine = this.config.lines[0];
    this.currentGear = undefined;
    this.prevGear = undefined;
    this.isDragging = false;

    // Event emitters for i/o
    this.events = {
      gearChange: []
    };

    this.timeOut = undefined;
    this.prevWindowWidth = undefined;
    // this.handleWindowResize();

    // Initialize shifter
    this.initializeStyles();
    this.initializeLines();
    this.setupEventListeners();
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  emit(eventName, data) {
    if (this.events[eventName]) {
      this.events[eventName].forEach(callback => {
        callback(data);
      });
    }
  }
  
  initializeStyles() {
    // Set tracker initial position
    this.tracker.style.position = 'absolute';
    this.tracker.style.borderRadius = '50%';
    this.tracker.style.cursor = 'move';
    this.tracker.style.transform = 'translate(-50%, -50%)';
    this.tracker.style.zIndex = '10';
    this.tracker.style.transition = 'all 0.2s ease';
  }

  initializeLines() {
    const size = this.parseSizeValue(this.config.gearBoxSize);
    const start = this.parseSizeValue(this.config.trackBeginEndGutter);
    const step = (size - start * 2) / (this.config.lines.length - 1);

    // Create vertical gear lines
    this.config.lines.forEach((line, i) => {
      const x = start + step * i;
      this.createLineElement(line, x);
      this.points[line[0]] = { x, y: start, gear: line[0] };
      this.points[line[1]] = { x, y: size - start, gear: line[1] };
      this.centerPoints.push({ x, y: size / 2, line, gear: 'N' });
    });

    // Create horizontal neutral line
    this.points[this.config.hLine[0]] = { x: start, y: size / 2, gear: 'N' };
    this.points[this.config.hLine[1]] = { x: size - start, y: size / 2, gear: 'N' };

    // Set initial position
    this.moveToGear(this.config.initialGear);
  }

  createLineElement(line, x) {
    const lineElement = document.createElement('div');
    lineElement.className = 'line';
    lineElement.style.left = `${x}px`;
    lineElement.setAttribute('data-start', line[0]);
    lineElement.setAttribute('data-end', line[1]);
    this.container.appendChild(lineElement);
  }

  parseSizeValue(value) {
    return Number(value.slice(0, value.length - 2));
  }

  updateGear(gear){
    if(this.config.hLine.includes(gear)) gear = 'N';
    this.currentGear = gear;
    if(this.prevGear !== this.currentGear){
      this.emit('gearChange', {
        gear: this.currentGear
      });
    }
    this.prevGear = this.currentGear;
  }

  // Public methods
  shiftUp() {
    const currentIndex = this.config.gearSequence.indexOf(this.currentGear);
    if (currentIndex < this.config.gearSequence.length - 1) {
      const nextGear = this.config.gearSequence[currentIndex + 1];
      this.moveThroughNeutral(nextGear);
    }
  }

  shiftDown() {
    const currentIndex = this.config.gearSequence.indexOf(this.currentGear);
    if (currentIndex > 0) {
      const prevGear = this.config.gearSequence[currentIndex - 1];
      this.moveThroughNeutral(prevGear);
    }
  }

  setGearPosition(targetGear){
    if(this.currentGear!==undefined){
      this.moveThroughNeutral(targetGear);
    }
    const targetPoint = this.getGearPoint(targetGear);
    if (targetPoint) {
      this.tracker.style.left = `${targetPoint.x}px`;
      this.tracker.style.top = `${targetPoint.y}px`;
      this.updateGear(targetGear);
    }
  }

  moveToGear(targetGear) {
    if(targetGear && targetGear === this.currentGear) return;
    this.setGearPosition(targetGear);
  }

  // Internal methods
  moveThroughNeutral(targetGear) {
    if (targetGear === this.currentGear) return;
    
    const currentX = parseFloat(this.tracker.style.left);
    const currentY = parseFloat(this.tracker.style.top);
    
    // Find current and target neutral points
    const currentNeutral = this.findClosestCenter(currentX, currentY);
    const targetPoint = this.getGearPoint(targetGear);
    const targetNeutral = this.findClosestCenter(targetPoint.x, targetPoint.y);
    
    // Execute movement sequence
    this.animateMovement([
      { x: currentNeutral.x, y: currentNeutral.y },  // Current → N1
      { x: targetNeutral.x, y: targetNeutral.y },    // N1 → N2
      { x: targetPoint.x, y: targetPoint.y }         // N2 → Target
    ], () => this.updateGear(targetGear));
  }

  animateMovement(points, onComplete) {
    let currentIndex = 0;
    
    const animateNext = () => {
      if (currentIndex >= points.length) {
        if (onComplete) onComplete();
        return;
      }
      
      const target = points[currentIndex];
      this.animateToPoint(target.x, target.y, () => {
        currentIndex++;
        if (currentIndex < points.length - 1) {
          setTimeout(animateNext, this.config.neutralPause);
        } else {
          animateNext();
        }
      });
    };
    
    animateNext();
  }

  animateToPoint(x, y, callback) {
    const duration = this.config.animationDuration;
    const startX = parseFloat(this.tracker.style.left);
    const startY = parseFloat(this.tracker.style.top);
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      this.tracker.style.left = `${startX + (x - startX) * easeProgress}px`;
      this.tracker.style.top = `${startY + (y - startY) * easeProgress}px`;
      
      if (progress < 1) {
        requestAnimationFrame(step);
      } else if (callback) {
        callback();
      }
    };

    requestAnimationFrame(step);
  }

  // Utility methods
  getGearPoint(gear) {
    if (gear === 'N') {
      const currentX = parseFloat(this.tracker.style.left);
      return this.centerPoints.reduce((closest, center) => {
        const dist = Math.abs(center.x - currentX);
        return dist < closest.dist ? { ...center, dist } : closest;
      }, { dist: Infinity });
    }
    return Object.values(this.points).find(p => p.gear === gear);
  }

  findClosestCenter(x, y) {
    return this.centerPoints.reduce((closest, center) => {
      const dist = Math.hypot(x - center.x, y - center.y);
      return dist < closest.dist ? { center, dist } : closest;
    }, { dist: Infinity, center: null }).center;
  }

  debounced(){
    clearTimeout(this.timeOut);
    this.timeOut = setTimeout(this.handleWindowResize, 200);
  }

  handleWindowResize(){
    if(this.prevWindowWidth === window.innerWidth) return;
    this.prevWindowWidth = window.innerWidth;
    const computedStyles = window.getComputedStyle(document.documentElement);

    this.config = {
      ...this.config,
      gearBoxSize : computedStyles.getPropertyValue('--gear-box-size'),
      trackBeginEndGutter: computedStyles.getPropertyValue('--track-begin-end-gutter'),
      trackerSize: computedStyles.getPropertyValue('--tracker-size'),
      trackWidth: computedStyles.getPropertyValue('--track-width')
    }
    this.container.innerHTML = '<div class="line horizontal"></div>';
    this.initializeLines();
    this.setGearPosition(this.currentGear);
  }

  setupEventListeners() {
    // Mouse/touch event handlers
    this.tracker.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      e.preventDefault();
    });

    this.container.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      const containerRect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;
      
      this.handleDrag(mouseX, mouseY);
    });

    document.addEventListener('mouseup', () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.handleDragEnd();
    });

    // Touch support
    this.tracker.addEventListener('touchstart', (e) => {
      this.isDragging = true;
      e.preventDefault();
    });

    this.container.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      const touch = e.touches[0];
      const containerRect = this.container.getBoundingClientRect();
      const touchX = touch.clientX - containerRect.left;
      const touchY = touch.clientY - containerRect.top;
      
      this.handleDrag(touchX, touchY);
      e.preventDefault();
    });

    document.addEventListener('touchend', () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.handleDragEnd();
    });

    window.addEventListener('resize', () => {
      this.debounced();
    })
  }

  handleDrag(mouseX, mouseY) {
    // Check for center snapping (neutral)
    const closestCenter = this.findClosestCenter(mouseX, mouseY);
    if (closestCenter && this.isNearCenter(mouseX, mouseY, closestCenter)) {
      this.tracker.style.left = `${closestCenter.x}px`;
      this.tracker.style.top = `${closestCenter.y}px`;
      this.currentGear = 'N';
      return;
    }
    
    // Determine current line
    const trackerX = parseFloat(this.tracker.style.left);
    const trackerY = parseFloat(this.tracker.style.top);
    this.currentLine = this.determineCurrentLine(trackerX, trackerY, mouseX, mouseY);
    
    // Constrain to current line
    const lineStart = this.points[this.currentLine[0]];
    const lineEnd = this.points[this.currentLine[1]];
    const projected = this.projectPointOnLine(
      mouseX, mouseY, 
      lineStart.x, lineStart.y, 
      lineEnd.x, lineEnd.y
    );
    const constrained = this.constrainPointToSegment(
      projected.x, projected.y, 
      lineStart.x, lineStart.y, 
      lineEnd.x, lineEnd.y
    );
    
    this.tracker.style.left = `${constrained.x}px`;
    this.tracker.style.top = `${constrained.y}px`;
  }

  handleDragEnd() {
    const trackerX = parseFloat(this.tracker.style.left);
    const trackerY = parseFloat(this.tracker.style.top);
    
    // Skip if already at center point (neutral)
    const isAtNeutral = this.centerPoints.some(center => 
      center.x === trackerX && center.y === trackerY
    )
    if (isAtNeutral) {
      this.updateGear('N');
      return;
    }
    
    // Determine final snap position
    const snapPoint = this.determineSnapPoint(trackerX, trackerY, this.currentLine);
    this.tracker.style.left = `${snapPoint.x}px`;
    this.tracker.style.top = `${snapPoint.y}px`;

    const newGear = snapPoint?.node || 'N';
    this.updateGear(newGear);
  }

  // Geometric calculations
  projectPointOnLine(px, py, x1, y1, x2, y2) {
    const ax = px - x1;
    const ay = py - y1;
    const bx = x2 - x1;
    const by = y2 - y1;
    
    const scalar = (ax * bx + ay * by) / (bx * bx + by * by);
    return {
      x: x1 + scalar * bx,
      y: y1 + scalar * by
    };
  }

  constrainPointToSegment(px, py, x1, y1, x2, y2) {
    const lineVecX = x2 - x1;
    const lineVecY = y2 - y1;
    const pointVecX = px - x1;
    const pointVecY = py - y1;
    
    const lineLengthSq = lineVecX * lineVecX + lineVecY * lineVecY;
    let scalar = (pointVecX * lineVecX + pointVecY * lineVecY) / lineLengthSq;
    scalar = Math.max(0, Math.min(1, scalar));
    
    return {
      x: x1 + scalar * lineVecX,
      y: y1 + scalar * lineVecY
    };
  }

  isNearCenter(x, y, center) {
    const size = this.parseSizeValue(this.config.gearBoxSize);
    const start = this.parseSizeValue(this.config.trackBeginEndGutter);
    const step = (size - start * 2) / (this.config.lines.length - 1);
    const centerSnapLimit = (1/3) * (start + step);
    
    return Math.hypot(x - center.x, y - center.y) < centerSnapLimit;
  }

  determineCurrentLine(trackerX, trackerY, mouseX, mouseY) {
    const center = this.centerPoints.find(c => 
      c.x === trackerX && c.y === trackerY
    );
    
    if (center) {
      return Math.abs(mouseX - center.x) < Math.abs(mouseY - center.y) 
        ? center.line 
        : this.config.hLine;
    }
    return this.config.lines.includes(this.currentLine) ? this.currentLine : this.config.hLine;
  }

  determineSnapPoint(trackerX, trackerY, currentLine) {
    const size = this.parseSizeValue(this.config.gearBoxSize);
    const start = this.parseSizeValue(this.config.trackBeginEndGutter);
    
    if (currentLine === this.config.hLine) {
      const distToLeft = trackerX - start;
      const distToRight = (size - start) - trackerX;
      const distToCenter = Math.min(
        ...this.centerPoints.map(c => Math.abs(c.x - trackerX))
      );
      
      if (distToCenter < Math.min(distToLeft, distToRight)) {
        return this.centerPoints.reduce((closest, center) => 
          Math.abs(center.x - trackerX) < Math.abs(closest.x - trackerX) 
            ? center 
            : closest
        );
      }
      return distToLeft < distToRight ? 
        { ...this.points[this.config.hLine[0]], node: this.config.hLine[0] } : 
        { ...this.points[this.config.hLine[1]], node: this.config.hLine[1] };
    }

    const line = this.centerPoints.find(cp => cp.line === currentLine);
    const distToTop = trackerY - start;
    const distToBottom = (size - start) - trackerY;
    const distToCenter = Math.abs(trackerY - line.y);

    if (distToCenter < Math.min(distToTop, distToBottom)) {
      return line;
    }
    return distToTop < distToBottom ? 
      { ...this.points[currentLine[0]], node: currentLine[0] } : 
      { ...this.points[currentLine[1]], node: currentLine[1] };
  }

  getCurrentGear() {
    return this.currentGear;
  }

  getGearPosition(gear) {
    const point = this.getGearPoint(gear);
    return point ? { x: point.x, y: point.y } : null;
  }
}