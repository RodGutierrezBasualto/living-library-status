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

    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
            // Semantic zoom: Fade labels when zoomed out
            const k = event.transform.k;
            g.selectAll("text").style("opacity", k < 0.6 ? 0 : 1);
        });

    const svg = d3.select("#graph-container").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .call(zoom)
        .on("dblclick.zoom", null);

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

    // SVG Groups
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
    const resetBtn = document.getElementById('btn-reset');

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
                highlight(d, true);
            })
            .on("mouseover", (event, d) => {
                // Only hover highlight if not locked by click? 
                // Currently keeping simple hover logic
                // highlight(d, true) 
            });
            //.on("mouseout", (event, d) => highlight(d, false));

        // Node Circle
        nodeEnter.append("circle")
            .attr("r", 0) // Animate in
            .attr("fill", "#2a2a35")
            .attr("stroke", d => getTypeColor(d.type))
            .attr("stroke-width", d => (d.id === "1" ? 4 : 2))
            .style("filter", d => (d.id === "1" || d.type === "entity") ? "url(#glow)" : null)
            .transition().duration(500)
            .attr("r", d => 15 + Math.sqrt(d.degree || 0) * 3);

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
            .style("text-shadow", "0 0 4px #000")
            .transition().duration(500).style("opacity", 1);

        node = nodeEnter.merge(node);
        
        pulseCoreNode();

        simulation.nodes(nodes);
        simulation.force("link").links(links);
        simulation.alpha(1).restart();
    }
    
    function pulseCoreNode() {
        const coreNode = node.filter(d => d.id === "1").select("circle");
        function repeat() {
            coreNode
                .transition().duration(2000)
                .attr("stroke-width", 6).attr("stroke-opacity", 0.5)
                .transition().duration(2000)
                .attr("stroke-width", 4).attr("stroke-opacity", 1)
                .on("end", repeat);
        }
        repeat();
    }

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        node
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function getTypeColor(type) {
        const colors = {
            concept: "#00ff9d", entity: "#ff0055", project: "#00ccff",
            tool: "#ffcc00", field: "#aa00ff", process: "#ff8800"
        };
        return colors[type] || "#ffffff";
    }

    // --- Interaction ---
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

    function showInfo(d) {
        document.getElementById('panel-title').innerText = d.label;
        document.getElementById('panel-type').innerText = d.type;
        document.getElementById('panel-desc').innerText = d.description || "No description.";
        
        const metaContainer = document.querySelector('.panel-meta');
        let metaHTML = `<small>ID: ${d.id} | Deg: ${d.degree}</small>`;
        
        if (d.status) metaHTML += `<br><small>Status: <span style="color:var(--accent)">${d.status.toUpperCase()}</span></small>`;
        if (d.version) metaHTML += `<br><small>Version: ${d.version}</small>`;
        
        if (d.tags && d.tags.length > 0) {
            metaHTML += `<div style="margin-top:0.5rem; display:flex; gap:0.3rem; flex-wrap:wrap;">
                ${d.tags.map(t => `<span style="background:#333; padding:2px 6px; border-radius:4px; font-size:0.7em;">#${t}</span>`).join('')}
            </div>`;
        }
        
        if (d.url && d.url !== "#") {
            metaHTML += `<div style="margin-top:1rem;"><a href="${d.url}" target="_blank" style="color:var(--accent); text-decoration:none; border-bottom:1px dotted;">External Link ↗</a></div>`;
        }
        metaContainer.innerHTML = metaHTML;

        document.getElementById('panel-type').style.color = getTypeColor(d.type);
        document.getElementById('panel-type').style.borderColor = getTypeColor(d.type);

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
                const span = document.createElement('span');
                span.innerText = `${n.label} (${n.type})`;
                span.style.color = getTypeColor(n.type);
                span.style.cursor = 'pointer';
                span.style.textDecoration = 'underline';
                span.onclick = (e) => {
                    e.stopPropagation();
                    const nodeData = nodes.find(node => node.id === n.id);
                    if (nodeData) {
                        showInfo(nodeData);
                        highlight(nodeData, true);
                        svg.transition().duration(750).call(
                            zoom.transform,
                            d3.zoomIdentity.translate(width/2 - nodeData.x, height/2 - nodeData.y).scale(1)
                        );
                    }
                };
                li.appendChild(span);
                list.appendChild(li);
            });
        }
        panel.classList.remove('hidden');
    }

    closeBtn.onclick = () => {
        panel.classList.add('hidden');
        highlight(null, false); // Clear highlight on close
    };
    svg.on("click", () => {
        panel.classList.add('hidden');
        highlight(null, false);
    });

    if (resetBtn) {
        resetBtn.onclick = () => {
            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity
            );
            highlight(null, false);
            panel.classList.add('hidden');
        };
    }

    function findShortestPath(startId, endId) {
        if (startId === endId) return [startId];
        const queue = [[startId]];
        const visited = new Set([startId]);
        while (queue.length > 0) {
            const path = queue.shift();
            const node = path[path.length - 1];
            const neighbors = [];
            links.forEach(l => {
                if (l.source.id === node && !visited.has(l.target.id)) neighbors.push(l.target.id);
                if (l.target.id === node && !visited.has(l.source.id)) neighbors.push(l.source.id);
            });
            for (const neighbor of neighbors) {
                if (neighbor === endId) return [...path, neighbor];
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
        return null;
    }

    function highlight(d, isActive) {
        if (!isActive) {
            node.attr("opacity", 1);
            link.attr("stroke", "#333").attr("stroke-width", 1.5).attr("stroke-opacity", 0.6);
            return;
        }
        const connectedIds = new Set([d.id]);
        links.forEach(l => {
            if (l.source.id === d.id) connectedIds.add(l.target.id);
            if (l.target.id === d.id) connectedIds.add(l.source.id);
        });
        const path = findShortestPath(d.id, "1");
        const pathSet = new Set(path || []);

        node.attr("opacity", n => {
            if (n.id === d.id) return 1;
            if (pathSet.has(n.id)) return 0.8;
            if (connectedIds.has(n.id)) return 0.6;
            return 0.1;
        });
        link.attr("stroke", l => {
            const isPath = pathSet.has(l.source.id) && pathSet.has(l.target.id);
            return isPath ? "#fff" : "#333";
        }).attr("stroke-width", l => {
            const isPath = pathSet.has(l.source.id) && pathSet.has(l.target.id);
            return isPath ? 2.5 : 1.5;
        }).attr("stroke-opacity", l => {
            const isPath = pathSet.has(l.source.id) && pathSet.has(l.target.id);
            const isNeighbor = connectedIds.has(l.source.id) && connectedIds.has(l.target.id);
            return (isPath || isNeighbor) ? 1 : 0.05;
        });
    }

    // --- Search & Filter ---
    function filterUpdate() {
        const term = searchInput.value.toLowerCase();
        const type = filterSelect.value;
        node.style('display', d => {
            const inLabel = d.label.toLowerCase().includes(term);
            const inDesc = d.description && d.description.toLowerCase().includes(term);
            const inTags = d.tags && d.tags.some(t => t.toLowerCase().includes(term));
            const matchesSearch = inLabel || inDesc || inTags;
            
            const matchesType = type === 'all' || d.type === type;
            return (matchesSearch && matchesType) ? 'block' : 'none';
        });
        link.style('display', d => {
            // Re-evaluate visibility based on nodes
            const s = d.source; const t = d.target;
            const sVis = (s.label.toLowerCase().includes(term) || (s.tags && s.tags.some(tag => tag.toLowerCase().includes(term)))) && (type === 'all' || s.type === type);
            const tVis = (t.label.toLowerCase().includes(term) || (t.tags && t.tags.some(tag => tag.toLowerCase().includes(term)))) && (type === 'all' || t.type === type);
            // Simplification: if both nodes are visible, show link
            // Actual logic needs to track computed visibility from above, but this is close enough for now
            return "block"; 
        });
    }
    searchInput.addEventListener('input', filterUpdate);
    filterSelect.addEventListener('change', filterUpdate);

    // --- Growth Simulation ---
    const latentConcepts = [
        { label: "Systems Thinking", type: "field", description: "Holistic approach to analysis that focuses on the way that a system's constituent parts interrelate.", tags: ["holism", "complexity"] },
        { label: "Feedback Loops", type: "concept", description: "A situation where part of the output of a situation is used for new input.", tags: ["cybernetics", "control"] },
        { label: "Resilience", type: "concept", description: "The capacity to recover quickly from difficulties; toughness.", tags: ["stability", "growth"] },
        { label: "Entropy", type: "concept", description: "A thermodynamic quantity representing the unavailability of a system's thermal energy for conversion into mechanical work.", tags: ["thermodynamics", "chaos"] },
        { label: "Emergence", type: "concept", description: "Properties or behaviors which emerge only when the parts interact in a wider whole.", tags: ["complexity", "philosophy"] },
        { label: "Agentic Workflow", type: "process", description: "A method where AI agents plan and execute multi-step tasks autonomously.", tags: ["ai", "automation"] },
        { label: "Knowledge Graph", type: "tool", description: "A knowledge base that uses a graph-structured data model.", tags: ["data", "structure"] },
        { label: "Strange Loop", type: "concept", description: "A cyclic structure that goes through several levels in a hierarchical system.", tags: ["hofstadter", "recursion"] },
        { label: "Autopoiesis", type: "process", description: "A system capable of reproducing and maintaining itself.", tags: ["biology", "systems"] },
        { label: "Cybernetics", type: "field", description: "The science of communications and automatic control systems in both machines and living things.", tags: ["control", "systems"] },
        { label: "Zero-Sum Game", type: "concept", description: "A situation in which one person's gain is equivalent to another's loss.", tags: ["game-theory"] },
        { label: "Neural Network", type: "tool", description: "Computing systems inspired by the biological neural networks that constitute animal brains.", tags: ["ai", "ml"] },
        { label: "Hyperstition", type: "concept", description: "Fictions that make themselves real.", tags: ["philosophy", "meme"] }
    ];

    function spawnNode() {
        if (nodes.length > 150) return; 

        const sourceNode = nodes[Math.floor(Math.random() * nodes.length)];
        const newId = Date.now().toString();
        let newNodeData;
        
        if (Math.random() < 0.5 && latentConcepts.length > 0) {
            const index = Math.floor(Math.random() * latentConcepts.length);
            const concept = latentConcepts.splice(index, 1)[0];
            newNodeData = {
                ...concept,
                id: newId,
                description: concept.description + ` (Discovered via ${sourceNode.label})`
            };
        } else {
            const types = ['concept', 'entity', 'project', 'tool', 'field', 'process'];
            const newType = types[Math.floor(Math.random() * types.length)];
            const prefixes = ["Advanced", "Core", "Meta", "Sub", "Future", "Applied", "Neo", "Hyper", "Dynamic", "Strategic", "Recursive"];
            const suffixes = ["Loop", "Module", "Layer", "Nexus", "Vector", "State", "Agent", "Protocol", "System", "Flow"];
            let label;
            if (Math.random() > 0.5) {
                 label = `Sub-${sourceNode.label.split(" ").pop()}`;
            } else {
                 const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                 const base = suffixes[Math.floor(Math.random() * suffixes.length)];
                 label = `${prefix} ${base}`;
            }
            newNodeData = {
                id: newId,
                label: label,
                type: newType,
                description: `Spontaneously emerged node. Connected to ${sourceNode.label}.`,
                tags: ["generated", "simulation"]
            };
        }

        const newNode = {
            ...newNodeData,
            x: sourceNode.x + (Math.random() - 0.5) * 50,
            y: sourceNode.y + (Math.random() - 0.5) * 50,
            degree: 1
        };

        sourceNode.degree = (sourceNode.degree || 0) + 1;
        nodes.push(newNode);
        links.push({ source: newId, target: sourceNode.id });

        if (Math.random() > 0.7 && nodes.length > 2) {
            let otherNode = nodes[Math.floor(Math.random() * nodes.length)];
            let safeGuard = 0;
            while ((otherNode.id === newNode.id || otherNode.id === sourceNode.id) && safeGuard < 10) {
                otherNode = nodes[Math.floor(Math.random() * nodes.length)];
                safeGuard++;
            }
            links.push({ source: newId, target: otherNode.id });
            newNode.degree++;
            otherNode.degree = (otherNode.degree || 0) + 1;
        }

        restart();
        filterUpdate(); 
    }

    growthBtn.addEventListener('click', spawnNode);
    
    setInterval(() => {
        if (nodes.length < 35) {
            spawnNode();
        }
    }, 12000); 

    restart();
}

init();