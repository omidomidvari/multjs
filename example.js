// Example usage of Flow.js (node friendly, console render)
const Flow = require('./flow.js');

// reset singleton
Flow.default && Flow.default.reset && Flow.default.reset();

const a = Flow.createBody({ x: 100, y: 50, vx: 50, vy: 0, mass: 1, radius: 12, color: '#e74c3c' });
const b = Flow.createBody({ x: 200, y: 50, vx: -30, vy: 0, mass: 1, radius: 12, color: '#2ecc71' });

let steps = 0;
function tick(){
  Flow.step(1/60);
  Flow.render(); // console fallback
  steps++;
  if(steps < 120) setTimeout(tick, 16);
}
(console output)');
tick();

console.log('Starting simple simulation');