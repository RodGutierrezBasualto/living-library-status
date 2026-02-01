async function init() {
    const response = await fetch('library.json');
    const data = await response.json();
    
    const width = document.getElementById('graph-container').clientWidth;
    const height = document.getElementById('graph-container').clientHeight;

    const svg = d3.select("#graph-container").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .call(d3.zoom().on("zoom", (event) => {
            g.attr("transform", event.transform);
        }));

    const g = svg.append("g");

    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.edges).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2));

    // Edges
    const link = g.append("g")
        .selectAll("line")
        .data(data.edges)
        .enter().append("line")
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    // Nodes
    const node = g.append("g")
        .selectAll("g")
        .data(data.nodes)
        .enter().append("g")
        .attr("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", (event, d) => showInfo(d));

    // Node Circles
    node.append("circle")
        .attr("r", 20)
        .attr("fill", "#2a2a35")
        .attr("stroke", "#00ff9d")
        .attr("stroke-width", 2);

    // Node Labels
    node.append("text")
        .text(d => d.label)
        .attr("x", 25)
        .attr("y", 5)
        .attr("fill", "#e0e0e0")
        .style("font-size", "12px")
        .style("pointer-events", "none");

    // Update stats
    document.getElementById('node-count').innerText = data.nodes.length;
    document.getElementById('edge-count').innerText = data.edges.length;

    // Simulation tick
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Info Panel Logic
    const panel = document.getElementById('info-panel');
    const closeBtn = document.getElementById('close-panel');

    function showInfo(d) {
        document.getElementById('panel-title').innerText = d.label;
        document.getElementById('panel-type').innerText = d.type;
        document.getElementById('panel-desc').innerText = d.description || "No description available.";
        document.getElementById('panel-id').innerText = d.id;
        panel.classList.remove('hidden');
    }

    closeBtn.onclick = () => {
        panel.classList.add('hidden');
    };

    // Search Logic
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        node.style('opacity', d => {
            const match = d.label.toLowerCase().includes(term);
            return match ? 1 : 0.1;
        });
        link.style('opacity', d => {
            // Check if both source and target match, or just hide non-relevant edges?
            // Simple approach: dim edges if connected nodes are dimmed
            const sourceMatch = d.source.label.toLowerCase().includes(term);
            const targetMatch = d.target.label.toLowerCase().includes(term);
            return (term === '' || (sourceMatch || targetMatch)) ? 1 : 0.1;
        });
    });
}

init();
