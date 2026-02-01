async function init() {
    // Load data
    const response = await fetch('library.json');
    const baseData = await response.json();
    
    let nodes = [...baseData.nodes];
    let links = baseData.edges.map(d => ({...d})); // Shallow copy for D3 mutation
    
    const width = document.getElementById('graph-container').clientWidth;
    const height = document.getElementById('graph-container').clientHeight;

    const svg = d3.select("#graph-container").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .call(d3.zoom().on("zoom", (event) => {
            g.attr("transform", event.transform);
        }));

    const g = svg.append("g");

    // Simulation Setup
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide(30));

    // SVG Groups for ordering (links behind nodes)
    let linkGroup = g.append("g").attr("class", "links");
    let nodeGroup = g.append("g").attr("class", "nodes");
    
    let link = linkGroup.selectAll("line");
    let node = nodeGroup.selectAll("g");

    // UI Elements
    const nodeCountEl = document.getElementById('node-count');
    const edgeCountEl = document.getElementById('edge-count');
    const panel = document.getElementById('info-panel');
    const closeBtn = document.getElementById('close-panel');
    const searchInput = document.getElementById('search');
    const filterSelect = document.getElementById('filter-type');
    const growthBtn = document.getElementById('btn-growth');

    // --- Core Update Loop ---
    function restart() {
        // Update Stats
        nodeCountEl.innerText = nodes.length;
        edgeCountEl.innerText = links.length;

        // Apply Data - Links
        link = link.data(links, d => d.source.id + "-" + d.target.id);
        link.exit().remove();
        
        const linkEnter = link.enter().append("line")
            .attr("stroke", "#333")
            .attr("stroke-width", 2)
            .attr("stroke-opacity", 0.6);
            
        link = linkEnter.merge(link);

        // Apply Data - Nodes
        node = node.data(nodes, d => d.id);
        node.exit().transition().duration(500).attr("opacity", 0).remove();

        const nodeEnter = node.enter().append("g")
            .attr("cursor", "pointer")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("click", (event, d) => showInfo(d))
            .on("mouseover", (event, d) => highlight(d, true))
            .on("mouseout", (event, d) => highlight(d, false));

        nodeEnter.append("circle")
            .attr("r", 0) // Animate in
            .attr("fill", "#2a2a35")
            .attr("stroke", d => getTypeColor(d.type))
            .attr("stroke-width", 2)
            .transition().duration(500).attr("r", 20);

        nodeEnter.append("text")
            .text(d => d.label)
            .attr("x", 25)
            .attr("y", 5)
            .attr("fill", "#e0e0e0")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .transition().duration(500).style("opacity", 1);

        node = nodeEnter.merge(node);

        // Restart Simulation
        simulation.nodes(nodes);
        simulation.force("link").links(links);
        simulation.alpha(1).restart();
    }

    // --- Simulation Tick ---
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // --- Helper: Colors ---
    function getTypeColor(type) {
        const colors = {
            concept: "#00ff9d", // Green
            entity: "#ff0055", // Red/Pink
            project: "#00ccff", // Blue
            tool: "#ffcc00", // Yellow
            field: "#aa00ff"  // Purple
        };
        return colors[type] || "#ffffff";
    }

    // --- Interaction: Drag ---
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

    // --- Interaction: Info Panel ---
    function showInfo(d) {
        document.getElementById('panel-title').innerText = d.label;
        document.getElementById('panel-type').innerText = d.type;
        document.getElementById('panel-desc').innerText = d.description || "No description available.";
        document.getElementById('panel-id').innerText = d.id;
        document.getElementById('panel-type').style.color = getTypeColor(d.type);

        // Find neighbors
        const connectedNodes = [];
        links.forEach(l => {
            if (l.source.id === d.id) connectedNodes.push(l.target);
            if (l.target.id === d.id) connectedNodes.push(l.source);
        });
        
        const list = document.getElementById('connection-list');
        list.innerHTML = '';
        if (connectedNodes.length === 0) {
            list.innerHTML = '<li>No connections</li>';
        } else {
            connectedNodes.forEach(n => {
                const li = document.createElement('li');
                li.innerText = `${n.label} (${n.type})`;
                li.style.color = getTypeColor(n.type);
                list.appendChild(li);
            });
        }

        panel.classList.remove('hidden');
    }

    closeBtn.onclick = () => panel.classList.add('hidden');

    // --- Interaction: Highlight ---
    function highlight(d, isActive) {
        if (!isActive) {
            node.attr("opacity", 1);
            link.attr("stroke-opacity", 0.6);
            return;
        }

        const connectedIds = new Set([d.id]);
        links.forEach(l => {
            if (l.source.id === d.id) connectedIds.add(l.target.id);
            if (l.target.id === d.id) connectedIds.add(l.source.id);
        });

        node.attr("opacity", n => connectedIds.has(n.id) ? 1 : 0.1);
        link.attr("stroke-opacity", l => (connectedIds.has(l.source.id) && connectedIds.has(l.target.id)) ? 1 : 0.05);
    }

    // --- Feature: Search & Filter ---
    function filterUpdate() {
        const term = searchInput.value.toLowerCase();
        const type = filterSelect.value;

        // Apply visibility
        node.style('display', d => {
            const matchesSearch = d.label.toLowerCase().includes(term);
            const matchesType = type === 'all' || d.type === type;
            return (matchesSearch && matchesType) ? 'block' : 'none';
        });
        
        link.style('display', d => {
            const sourceVisible = (d.source.label.toLowerCase().includes(term)) && (type === 'all' || d.source.type === type);
            const targetVisible = (d.target.label.toLowerCase().includes(term)) && (type === 'all' || d.target.type === type);
            return (sourceVisible && targetVisible) ? 'block' : 'none';
        });
    }

    searchInput.addEventListener('input', filterUpdate);
    filterSelect.addEventListener('change', filterUpdate);

    // --- Feature: Simulate Growth ---
    growthBtn.addEventListener('click', () => {
        const newId = (nodes.length + 1).toString() + "-" + Math.floor(Math.random() * 1000); // Uniqueish ID
        const types = ['concept', 'entity', 'project', 'tool', 'field'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomLabel = `Auto-${randomType.charAt(0).toUpperCase() + randomType.slice(1)} ${Math.floor(Math.random()*100)}`;
        
        const newNode = {
            id: newId,
            label: randomLabel,
            type: randomType,
            description: "Auto-generated node from simulation.",
            x: width/2 + (Math.random() - 0.5) * 50, // Spawn near center
            y: height/2 + (Math.random() - 0.5) * 50
        };

        nodes.push(newNode);

        // Connect to 1 random existing node
        if (nodes.length > 1) {
            const targetNode = nodes[Math.floor(Math.random() * (nodes.length - 1))];
            links.push({ source: newId, target: targetNode.id });
        }

        restart();
        filterUpdate(); // Re-apply filters if active
    });

    // Start
    restart();
}

init();