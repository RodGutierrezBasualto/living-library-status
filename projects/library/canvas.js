const canvas = document.getElementById('library-canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Placeholder: Visual "void" background
function drawBackground() {
  const grad = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height)/1.5
  );
  grad.addColorStop(0, '#191933');
  grad.addColorStop(1, '#0a0a12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function animate() {
  drawBackground();
  // Node drawing will come next.
  requestAnimationFrame(animate);
}

animate();