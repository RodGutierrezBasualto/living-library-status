async function init() {
    // Load data
    const response = await fetch('library.json');
    const baseData = await response.json();
    
    let nodes = [...baseData.nodes];
    let links = baseData.edges.map(d => ({...d})); // Shallow copy for D3 mutation
    
    // Calculate degree (connections count) for sizing
    const degree = {};
    baseData.edges.forEach(l => {
        degree[l.source] = (degree[l.source] || 0) + 1;
        degree[l.target] = (degree[l.target] || 0) + 1;
    });
    nodes.forEach(n => {
        n.degree = degree[n.id] || 0;
    });

    const width = document.getElementById('graph-container').clientWidth;
    const height = document.getElementById('graph-container').clientHeight;

    const svg = d3.select("#graph-container").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => {
            g.attr("transform", event.transform);
            // Semantic zoom: Fade labels when zoomed out to reduce clutter
            const k = event.transform.k;
            g.selectAll("text").style("opacity", k < 0.6 ? 0 : 1);
        }))
        .on("dblclick.zoom", null); // Disable double click zoom

    // Define Glow Filter
    const defs = svg.append("defs");
    const filter = defs.append("filter")
        .attr("id", "glow");
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "2.5")
        .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");

    // Simulation Setup
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide(d => 20 + (d.degree * 2)));

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
            .attr("stroke-width", 1.5)
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
            .on("click", (event, d) => {
                event.stopPropagation();
                showInfo(d);
            })
            .on("mouseover", (event, d) => highlight(d, true))
            .on("mouseout", (event, d) => highlight(d, false));

        // Node Circle
        nodeEnter.append("circle")
            .attr("r", 0) // Animate in
            .attr("fill", "#2a2a35")
            .attr("stroke", d => getTypeColor(d.type))
            .attr("stroke-width", d => (d.id === "1" ? 4 : 2)) // Thicker stroke for Nash Eq
            .style("filter", d => (d.id === "1" || d.type === "entity") ? "url(#glow)" : null) // Glow for core nodes
            .transition().duration(500)
            .attr("r", d => 15 + Math.sqrt(d.degree || 0) * 3); // Sizing based on connections

        // Pulse Animation for Core Node (ID 1)
        // We use D3 transition loop for smooth SVG attribute animation
        if (d => d.id === "1") {
             // Logic handled in separate pulse function to avoid complexity here
        }

        // Labels
        nodeEnter.append("text")
            .text(d => d.label)
            .attr("x", d => 20 + Math.sqrt(d.degree || 0) * 3)
            .attr("y", 5)
            .attr("fill", "#e0e0e0")
            .style("font-size", "12px")
            .style("font-weight", d => d.degree > 3 ? "bold" : "normal")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style("text-shadow", "0 0 4px #000") // Legibility
            .transition().duration(500).style("opacity", 1);

        node = nodeEnter.merge(node);
        
        // Start Pulse Loop
        pulseCoreNode();

        // Restart Simulation
        simulation.nodes(nodes);
        simulation.force("link").links(links);
        simulation.alpha(1).restart();
    }
    
    function pulseCoreNode() {
        // Find the circle inside the node with ID 1
        const coreNode = node.filter(d => d.id === "1").select("circle");
        
        function repeat() {
            coreNode
                .transition()
                .duration(2000)
                .attr("stroke-width", 6)
                .attr("stroke-opacity", 0.5)
                .transition()
                .duration(2000)
                .attr("stroke-width", 4)
                .attr("stroke-opacity", 1)
                .on("end", repeat);
        }
        repeat();
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
            field: "#aa00ff", // Purple
            process: "#ff8800" // Orange
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
        document.getElementById('panel-type').style.borderColor = getTypeColor(d.type);

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
                li.style.cursor = 'pointer';
                li.style.textDecoration = 'underline';
                li.onclick = () => {
                    // Navigate to node
                    const nodeData = nodes.find(node => node.id === n.id);
                    if (nodeData) {
                        showInfo(nodeData);
                        highlight(nodeData, true);
                        // Center Logic (Basic)
                        svg.transition().duration(750).call(
                            d3.zoom().transform,
                            d3.zoomIdentity.translate(width/2 - nodeData.x, height/2 - nodeData.y).scale(1)
                        );
                    }
                };
                list.appendChild(li);
            });
        }

        panel.classList.remove('hidden');
    }

    closeBtn.onclick = () => panel.classList.add('hidden');
    
    // Close panel on background click
    svg.on("click", () => panel.classList.add('hidden'));

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
        if (nodes.length === 0) return;

        const sourceNode = nodes[Math.floor(Math.random() * nodes.length)];
        const newId = Date.now().toString();

        // Generate context-aware metadata
        const types = ['concept', 'entity', 'project', 'tool', 'field'];
        const newType = types[Math.floor(Math.random() * types.length)];
        
        const prefixes = ["Advanced", "Core", "Meta", "Sub", "Future", "Applied", "Neo", "Hyper"];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const label = `${prefix} ${sourceNode.label.split(" ").pop()}`;

        const newNode = {
            id: newId,
            label: label,
            type: newType,
            description: `Auto-evolved node derived from ${sourceNode.label}. Represents a ${newType} extension of the core graph.`,
            x: sourceNode.x + (Math.random() - 0.5) * 50,
            y: sourceNode.y + (Math.random() - 0.5) * 50,
            degree: 1 // Start with 1
        };

        // Increment degree of source
        sourceNode.degree = (sourceNode.degree || 0) + 1;

        nodes.push(newNode);
        links.push({ source: newId, target: sourceNode.id });

        // 30% chance to add a second connection
        if (Math.random() > 0.7 && nodes.length > 2) {
            let otherNode = nodes[Math.floor(Math.random() * nodes.length)];
            while (otherNode.id === newNode.id || otherNode.id === sourceNode.id) {
                otherNode = nodes[Math.floor(Math.random() * nodes.length)];
            }
            links.push({ source: newId, target: otherNode.id });
            newNode.degree++;
            otherNode.degree = (otherNode.degree || 0) + 1;
        }

        restart();
        filterUpdate(); 
    });

    // Start
    restart();
}

init();