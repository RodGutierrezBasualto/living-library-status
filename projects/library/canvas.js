const canvas = document.getElementById('library-canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Visual "void" background
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

// Node Data Source
let nodes = [];
fetch('../../nash-log/data/library.json')
  .then(r => r.json())
  .then(data => {
    nodes = data.map((item, i) => createNode(item, i));
  });

function createNode(item, i) {
  // Random initial position/velocity, group by type
  const angle = Math.random() * Math.PI * 2;
  const radius = canvas.width * 0.25 + Math.random() * canvas.width * 0.2;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  return {
    ...item,
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    r: 30 + Math.random()*10,  // radius
    selected: false,
    popIn: 0  // animation state (0=invisible, 1=full visible)
  };
}

// Physics Parameters
const ATTRACT_STRENGTH = 0.020;
const REPEL_STRENGTH = 1600;
const DAMPING = 0.95;
const CLUSTER_PULL = {
  'artifact': {x:0.35, y:0.35},
  'wisdom': {x:0.65, y:0.35},
  'signal': {x:0.65, y:0.65},
  'knowledge': {x:0.35, y:0.65}
};

function applyPhysics() {
  const w = canvas.width, h = canvas.height;
  for (let i = 0; i < nodes.length; i++) {
    let n1 = nodes[i];
    // Cluster Attraction (by type)
    const cluster = CLUSTER_PULL[n1.type] || {x:0.5, y:0.5};
    const tx = w*cluster.x, ty = h*cluster.y;
    n1.vx += (tx - n1.x) * ATTRACT_STRENGTH / 80;
    n1.vy += (ty - n1.y) * ATTRACT_STRENGTH / 80;
    // Node Repulsion
    for (let j = i+1; j < nodes.length; j++) {
      let n2 = nodes[j];
      let dx = n2.x - n1.x, dy = n2.y - n1.y;
      let dist = Math.sqrt(dx*dx + dy*dy) || 1;
      let minDist = n1.r + n2.r + 10;
      if (dist < minDist) {
        // Repel if too close
        let force = (minDist-dist)/minDist * REPEL_STRENGTH/(dist*dist);
        let fx = force * dx/dist, fy = force * dy/dist;
        n1.vx -= fx; n1.vy -= fy;
        n2.vx += fx; n2.vy += fy;
      }
    }
    // Wall Bounce
    if (n1.x-n1.r < 0 || n1.x+n1.r > w) n1.vx *= -0.6;
    if (n1.y-n1.r < 0 || n1.y+n1.r > h) n1.vy *= -0.6;
    // Damping
    n1.vx *= DAMPING;
    n1.vy *= DAMPING;
    // Move
    n1.x += n1.vx;
    n1.y += n1.vy;
    // Pop-in Animation
    if (n1.popIn < 1) n1.popIn += 0.03;
    if (n1.popIn > 1) n1.popIn = 1;
  }
}

function drawNodes() {
  for (let node of nodes) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, node.popIn*1.2);
    // Node Glow
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI*2);
    ctx.shadowColor = node.selected ? '#ff11ff' : (node.type==='artifact'? '#00f9ff':'#f133ff');
    ctx.shadowBlur = node.selected ? 55 : 20;
    ctx.fillStyle = node.selected ? '#241533' : '#0e1022';
    ctx.fill();
    ctx.strokeStyle = node.type==='artifact'? '#00f9ff':'#f133ff';
    ctx.lineWidth = node.selected ? 6 : 2.5;
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
    // Label
    if(node.popIn>0.6){
      ctx.save();
      ctx.font = node.selected ? 'bold 21px Segoe UI' : '18px Segoe UI';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';ctx.shadowBlur = 14;
      ctx.fillStyle = node.selected? '#ff11ff':'#f1ffff';
      ctx.fillText(node.title, node.x, node.y-node.r-12);
      ctx.restore();
    }
  }
}

function animate() {
  drawBackground();
  applyPhysics();
  drawNodes();
  requestAnimationFrame(animate);
}

animate();

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  let found = false;
  for (let node of nodes) {
    let dx = e.clientX - rect.left - node.x;
    let dy = e.clientY - rect.top - node.y;
    if (Math.sqrt(dx * dx + dy * dy) < node.r) {
      node.selected = true;
      found = true;
    } else {
      node.selected = false;
    }
  }
});
