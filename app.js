async function init() {
    // Load data
    const response = await fetch('library.json');
    const baseData = await response.json();
    
    let nodes = [...baseData.nodes];
    let links = baseData.edges.map(d => ({...d})); 
    
    const latentConcepts = baseData.growthPools?.latentConcepts || [];
    const nashProjects = baseData.growthPools?.projects || [];

    // Initial Degree Calculation
    function updateDegrees() {
        const degree = {};
        links.forEach(l => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            degree[s] = (degree[s] || 0) + 1;
            degree[t] = (degree[t] || 0) + 1;
        });
        nodes.forEach(n => {
            n.degree = degree[n.id] || 0;
        });
    }
    updateDegrees();

    const width = document.getElementById('graph-container').clientWidth;
    const height = document.getElementById('graph-container').clientHeight;

    // Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
            const k = event.transform.k;
            g.selectAll("text").style("opacity", k < 0.6 ? 0 : 1);
        });

    const svg = d3.select("#graph-container").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .call(zoom)
        .on("dblclick.zoom", null);

    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide(d => 25 + (d.degree * 2)).iterations(2));

    let linkGroup = g.append("g").attr("class", "links");
    let nodeGroup = g.append("g").attr("class", "nodes");
    let particleGroup = g.append("g").attr("class", "particles");

    let link = linkGroup.selectAll("line");
    let node = nodeGroup.selectAll("g");

    const nodeCountEl = document.getElementById('node-count');
    const edgeCountEl = document.getElementById('edge-count');
    const panel = document.getElementById('info-panel');
    const closeBtn = document.getElementById('close-panel');
    const searchInput = document.getElementById('search');
    const filterSelect = document.getElementById('filter-type');
    const focusToggle = document.getElementById('focus-mode');
    const growthBtn = document.getElementById('btn-growth');
    const resetBtn = document.getElementById('btn-reset');
    const logContainer = document.getElementById('system-log');

    function log(msg, type = "info") {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        if (type === "alert") entry.style.color = "#ff5555";
        if (type === "success") entry.style.color = "#00ff9d";
        
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
        entry.innerHTML = `<span style="opacity:0.5">[${time}]</span> ${msg}`;
        logContainer.prepend(entry);
        if (logContainer.children.length > 8) logContainer.lastElementChild.remove();
    }

    const iconMap = {
        concept: 'brain-circuit', entity: 'user', project: 'rocket',
        tool: 'terminal', field: 'book-open', process: 'refresh-cw'
    };

    function getTypeColor(type) {
        const colors = {
            concept: "#00ff9d", entity: "#ff0055", project: "#00ccff",
            tool: "#ffcc00", field: "#aa00ff", process: "#ff8800"
        };
        return colors[type] || "#ffffff";
    }

    function restart() {
        updateDegrees();
        nodeCountEl.innerText = nodes.length;
        edgeCountEl.innerText = links.length;
        
        if (nodes.length < 30) growthBtn.classList.add('growth-pulse');
        else growthBtn.classList.remove('growth-pulse');

        link = link.data(links, d => d.source.id + "-" + d.target.id);
        link.exit().remove();
        const linkEnter = link.enter().append("line")
            .attr("stroke", "#333")
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.6);
        link = linkEnter.merge(link);

        node = node.data(nodes, d => d.id);
        node.exit().transition().duration(500).attr("opacity", 0).remove();

        const nodeEnter = node.enter().append("g")
            .attr("cursor", "pointer")
            .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended))
            .on("click", (event, d) => {
                event.stopPropagation();
                showInfo(d);
                log(`Inspecting: ${d.label}`);
            });

        nodeEnter.append("circle")
            .attr("r", 0)
            .attr("fill", "#1a1a20")
            .attr("stroke", d => getTypeColor(d.type))
            .attr("stroke-width", d => (d.id === "1" ? 3 : 1.5))
            .style("filter", d => (d.id === "1" || d.type === "entity") ? "url(#glow)" : null)
            .transition().duration(500)
            .attr("r", d => 18 + Math.sqrt(d.degree || 0) * 4);

        nodeEnter.append("foreignObject")
            .attr("width", 24).attr("height", 24)
            .attr("x", -12).attr("y", -12)
            .style("pointer-events", "none")
            .html(d => {
                const iconName = iconMap[d.type] || 'circle';
                if (typeof lucide !== 'undefined' && lucide.icons[iconName]) {
                    return lucide.icons[iconName].toSvg({ 
                        color: getTypeColor(d.type), 
                        width: 24, height: 24, 'stroke-width': 1.5
                    });
                }
                return ''; 
            })
            .transition().duration(500).style("opacity", 1);

        nodeEnter.append("text")
            .text(d => d.label)
            .attr("x", d => 24 + Math.sqrt(d.degree || 0) * 3)
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
        filterUpdate(); // Re-apply filters on restart (new nodes)
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

    function sendParticle(sourceId, targetId) {
        const l = links.find(x => (x.source.id === sourceId && x.target.id === targetId) || (x.source.id === targetId && x.target.id === sourceId));
        if(!l) return;
        
        const src = nodes.find(n => n.id === sourceId);
        const tgt = nodes.find(n => n.id === targetId);
        if(!src || !tgt) return;

        const p = particleGroup.append("circle")
            .attr("r", 3)
            .attr("fill", "#fff")
            .attr("cx", src.x)
            .attr("cy", src.y);
            
        p.transition().duration(1000).ease(d3.easeLinear)
            .attr("cx", tgt.x)
            .attr("cy", tgt.y)
            .on("end", function() { d3.select(this).remove(); });
    }

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }

    function showInfo(d) {
        document.getElementById('panel-title').innerText = d.label;
        const typeBadge = document.getElementById('panel-type');
        typeBadge.innerText = d.type;
        typeBadge.style.color = getTypeColor(d.type);
        typeBadge.style.borderColor = getTypeColor(d.type);
        
        document.getElementById('panel-desc').innerText = d.description || "No description available.";
        
        const metaContainer = document.querySelector('.panel-meta');
        let metaHTML = `<small>ID: ${d.id} | Deg: ${d.degree}</small>`;
        
        if (d.status) metaHTML += `<br><small>Status: <span style="color:var(--accent)">${d.status.toUpperCase()}</span></small>`;
        if (d.version) metaHTML += `<br><small>Version: ${d.version}</small>`;
        if (d.birthTime) {
             const date = new Date(d.birthTime);
             metaHTML += `<br><small>Created: ${date.toLocaleTimeString()} (${date.toLocaleDateString()})</small>`;
        }
        
        if (d.tags && d.tags.length > 0) {
            metaHTML += `<div style="margin-top:0.5rem; display:flex; gap:0.3rem; flex-wrap:wrap;">
                ${d.tags.map(t => `<span class="tag-pill" data-tag="${t}" style="background:#333; padding:2px 6px; border-radius:4px; font-size:0.7em; cursor:pointer; transition:background 0.2s;">#${t}</span>`).join('')}
            </div>`;
        }

        // Path to Core Visualization
        function getShortestPath(startId, endId) {
            const queue = [[startId]];
            const visited = new Set([startId]);
            while (queue.length > 0) {
                const path = queue.shift();
                const node = path[path.length - 1];
                if (node === endId) return path;
                
                const neighbors = [];
                links.forEach(l => {
                    const s = typeof l.source === 'object' ? l.source.id : l.source;
                    const t = typeof l.target === 'object' ? l.target.id : l.target;
                    if (s === node) neighbors.push(t);
                    if (t === node) neighbors.push(s);
                });
                
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push([...path, neighbor]);
                    }
                }
            }
            return null;
        }

        let path = null;
        if (d.id !== "1") {
            path = getShortestPath(d.id, "1");
            if (path && path.length > 1) {
                 metaHTML += `<div style="margin-top:0.5rem; padding:4px; border-left:2px solid #555; background:rgba(255,255,255,0.05);">
                    <small style="color:#aaa; text-transform:uppercase; font-size:0.7rem;">Path to Core</small><br>
                    <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">`;
                 
                 path.forEach((id, i) => {
                     const n = nodes.find(x => x.id === id);
                     metaHTML += `<span class="path-node" style="font-size:0.8rem; color:${getTypeColor(n.type)}">${n.label}</span>`;
                     if (i < path.length - 1) metaHTML += `<span class="path-arrow">→</span>`;
                 });
                 metaHTML += `</div></div>`;
            }
        }
        
        if (d.url && d.url !== "#") {
            metaHTML += `<div style="margin-top:1rem;"><a href="${d.url}" target="_blank" style="color:var(--accent); text-decoration:none; border-bottom:1px dotted;">External Link ↗</a></div>`;
        }

        if (d.tags && d.tags.length > 0) {
            const connectedIds = new Set(links.filter(l => l.source.id === d.id || l.target.id === d.id)
                .map(l => l.source.id === d.id ? l.target.id : l.source.id));
            connectedIds.add(d.id); 
            
            const related = nodes.filter(n => 
                !connectedIds.has(n.id) && 
                n.tags && 
                n.tags.some(t => d.tags.includes(t))
            ).slice(0, 5); 

            if (related.length > 0) {
                metaHTML += `<div style="margin-top:1rem; border-top:1px solid #333; padding-top:0.5rem;">
                    <h3 style="font-size:0.8rem; color:#888; text-transform:uppercase;">Related (Latent)</h3>
                    <ul style="list-style:none; padding:0; margin:0;">
                        ${related.map(r => `<li style="padding:2px 0;"><span class="related-link" data-id="${r.id}" style="cursor:pointer; color:${getTypeColor(r.type)}; font-size:0.9rem;">${r.label}</span></li>`).join('')}
                    </ul>
                </div>`;
            }
        }
        
        metaContainer.innerHTML = metaHTML;

        metaContainer.querySelectorAll('.tag-pill').forEach(tag => {
            tag.onclick = (e) => {
                e.stopPropagation();
                searchInput.value = e.target.dataset.tag;
                filterUpdate();
            };
        });
        
        metaContainer.querySelectorAll('.related-link').forEach(link => {
            link.onclick = (e) => {
                e.stopPropagation();
                const targetNode = nodes.find(n => n.id === e.target.dataset.id);
                if (targetNode) {
                    showInfo(targetNode);
                    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(width/2 - targetNode.x, height/2 - targetNode.y).scale(1));
                }
            };
        });

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
                    sendParticle(d.id, n.id);
                    setTimeout(() => {
                        const nodeData = nodes.find(node => node.id === n.id);
                        if (nodeData) {
                            showInfo(nodeData);
                            svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(width/2 - nodeData.x, height/2 - nodeData.y).scale(1));
                        }
                    }, 500);
                };
                li.appendChild(span);
                list.appendChild(li);
            });
        }
        panel.classList.remove('hidden');
        highlight(d, true, path);
    }

    closeBtn.onclick = () => { panel.classList.add('hidden'); highlight(null, false); };
    if (resetBtn) resetBtn.onclick = () => { 
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
        highlight(null, false);
        panel.classList.add('hidden');
        searchInput.value = ''; // Clear search
        filterSelect.value = 'all'; // Reset filter
        focusToggle.checked = false; // Reset focus
        filterUpdate(); // Apply clear
    };

    function highlight(d, isActive, pathIds = null) {
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
        
        if (pathIds) pathIds.forEach(id => connectedIds.add(id));

        node.attr("opacity", n => {
            if (n.id === d.id || connectedIds.has(n.id)) return 1;
            return 0.1;
        });
        link.attr("stroke", l => {
            const isConnected = (l.source.id === d.id || l.target.id === d.id);
            // Highlight links in the path
            const isPathLink = pathIds && pathIds.includes(l.source.id) && pathIds.includes(l.target.id);
            if (isPathLink) return "#fff";
            return isConnected ? "#fff" : "#333";
        }).attr("stroke-width", l => {
             const isConnected = (l.source.id === d.id || l.target.id === d.id);
             const isPathLink = pathIds && pathIds.includes(l.source.id) && pathIds.includes(l.target.id);
             if (isPathLink) return 3;
             return isConnected ? 2 : 1;
        }).attr("stroke-opacity", l => {
             const isConnected = (l.source.id === d.id || l.target.id === d.id);
             const isPathLink = pathIds && pathIds.includes(l.source.id) && pathIds.includes(l.target.id);
             return (isConnected || isPathLink) ? 1 : 0.05;
        });
    }

    function filterUpdate() {
        const term = searchInput.value.toLowerCase();
        const type = filterSelect.value;
        const focusMode = focusToggle.checked;
        const visibleNodeIds = new Set();
        
        nodes.forEach(d => {
            const inLabel = d.label.toLowerCase().includes(term);
            const inTags = d.tags && d.tags.some(t => t.toLowerCase().includes(term));
            const matchesSearch = inLabel || inTags;
            const matchesType = type === 'all' || d.type === type;
            if (matchesSearch && matchesType) visibleNodeIds.add(d.id);
        });
        
        node.classed("node-dimmed", d => !visibleNodeIds.has(d.id));
        link.classed("link-dimmed", d => !(visibleNodeIds.has(d.source.id) && visibleNodeIds.has(d.target.id)));
        
        if (focusMode && term.length > 0) {
             node.attr("display", d => visibleNodeIds.has(d.id) ? "block" : "none");
             link.attr("display", d => (visibleNodeIds.has(d.source.id) && visibleNodeIds.has(d.target.id)) ? "block" : "none");
        } else {
             node.attr("display", "block");
             link.attr("display", "block");
        }
    }
    searchInput.addEventListener('input', filterUpdate);
    filterSelect.addEventListener('change', filterUpdate);
    focusToggle.addEventListener('change', filterUpdate);

    function spawnNode() {
        if (nodes.length > 150) {
            log("Graph capacity reached. Consolidating...", "alert");
            return; 
        }

        const hubs = nodes.filter(n => n.degree > 3);
        const sourceNode = (hubs.length > 0 && Math.random() > 0.4) 
            ? hubs[Math.floor(Math.random() * hubs.length)] 
            : nodes[Math.floor(Math.random() * nodes.length)];
            
        const newId = Date.now().toString();
        let newNodeData;
        const rand = Math.random();
        
        if (rand < 0.3 && nashProjects.length > 0) {
            const index = Math.floor(Math.random() * nashProjects.length);
            const proj = nashProjects.splice(index, 1)[0];
            newNodeData = { ...proj, id: newId, status: "discovered", birthTime: Date.now() };
            log(`Archive recovered: ${newNodeData.label}`, "success");
        } else if (rand < 0.6 && latentConcepts.length > 0) {
            const index = Math.floor(Math.random() * latentConcepts.length);
            const concept = latentConcepts.splice(index, 1)[0];
            newNodeData = { ...concept, id: newId, status: "emerging", birthTime: Date.now() };
            log(`Latent concept emerging: ${newNodeData.label}`);
        } else {
            const types = ['concept', 'process', 'tool'];
            const newType = types[Math.floor(Math.random() * types.length)];
            const prefixes = ["Meta", "Hyper", "Neo", "Core", "Sub", "Dynamic", "Open", "Smart"];
            const suffixes = ["Flow", "Loop", "Net", "Graph", "Space", "Logic", "Stack"];
            
            let label;
            if (sourceNode.label.split(" ").length > 1) {
                label = `Sub-${sourceNode.label.split(" ").pop()}`;
            } else {
                label = `${prefixes[Math.floor(Math.random()*prefixes.length)]} ${suffixes[Math.floor(Math.random()*suffixes.length)]}`;
            }

            newNodeData = {
                id: newId,
                label: label,
                type: newType,
                description: `Synthesized connection from ${sourceNode.label}.`,
                tags: ["generated", "simulation"],
                status: "generated",
                birthTime: Date.now()
            };
            log(`System synthesized: ${label}`);
        }

        const newNode = {
            ...newNodeData,
            x: sourceNode.x + (Math.random() - 0.5) * 60,
            y: sourceNode.y + (Math.random() - 0.5) * 60,
            degree: 1
        };

        nodes.push(newNode);
        links.push({ source: newId, target: sourceNode.id });

        const neighborLink = links.find(l => (l.source.id === sourceNode.id || l.target.id === sourceNode.id) && l.source.id !== newId && l.target.id !== newId);
        if (neighborLink && Math.random() > 0.5) {
             const neighborId = (neighborLink.source.id === sourceNode.id) ? neighborLink.target.id : neighborLink.source.id;
             links.push({ source: newId, target: neighborId });
             newNode.degree++;
        }

        restart();
        
        // Visualize data flow
        setTimeout(() => sendParticle(sourceNode.id, newId), 800);

        const newDom = nodeGroup.selectAll("g").filter(d => d.id === newId);
        newDom.select("circle")
            .attr("stroke", "#fff").attr("stroke-width", 10)
            .transition().duration(800)
            .attr("stroke", getTypeColor(newNodeData.type)).attr("stroke-width", 2);
    }

    growthBtn.addEventListener('click', spawnNode);
    
    // Auto-grow
    setInterval(() => {
        if (nodes.length < 40) spawnNode();
    }, 12000); // Slower growth

    // Ambient Feed Simulation
    setInterval(() => {
        if (Math.random() > 0.7) {
            const msgs = [
                "Scanning latent space...",
                "Optimizing force layout...",
                "Telemetry received from node 7...",
                "Updating semantic index...",
                "Heuristic analysis complete."
            ];
            log(msgs[Math.floor(Math.random() * msgs.length)]);
        }
    }, 8000);

    restart();
    log("Living Library v2.2.1 (Sprint 2 - Phase 2) Loaded.", "success");
}

init();