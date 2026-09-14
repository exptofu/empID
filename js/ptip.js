"use strict";

(function () {
    const ptipTool = document.querySelector("#ptipTool");
    const openPtipButton = document.querySelector("#open-ptip");
    const workspace = document.querySelector("#ptipTool #workspace");
    const uploadState = document.querySelector("#uploadState");
    const canvasState = document.querySelector("#canvasState");
    const uploadCard = document.querySelector("#uploadCard");
    const imageInput = document.querySelector("#imageInput");
    const photo = document.querySelector("#photo");
    const vectorLayer = document.querySelector("#vectorLayer");
    const imageStage = document.querySelector("#imageStage");
    const createVector = document.querySelector("#createVector");
    const confirmVector = document.querySelector("#confirmVector");
    const resetVector = document.querySelector("#resetVector");
    const backToReference = document.querySelector("#backToReference");
    const reuploadImage = document.querySelector("#reuploadImage");
    const resetTips = document.querySelector("#resetTips");
    const backToVector = document.querySelector("#backToVector");
    const panImage = document.querySelector("#panImage");
    const zoomOut = document.querySelector("#zoomOut");
    const zoomIn = document.querySelector("#zoomIn");
    const zoomLabel = document.querySelector("#zoomLabel");
    const vectorArrow = document.querySelector("#vectorArrow");
    const toolStatus = document.querySelector("#toolStatus");
    const helperText = document.querySelector("#helperText");
    const ratioSummary = document.querySelector("#ratioSummary");
    const ratioResults = document.querySelector("#ratioResults");
    const rankButtons = {
        auto: document.querySelector("#rankAuto"),
        p8: document.querySelector("#rankP8"),
        p7: document.querySelector("#rankP7")
    };
    const regionButtons = {
        all: document.querySelector("#ptipRegionAll"),
        west: document.querySelector("#ptipRegionWest"),
        east: document.querySelector("#ptipRegionEast")
    };
    let imageUrl = null;
    let placementActive = false;
    let dragPointerId = null;
    let dragOrigin = null;
    let dragMoved = false;
    let suppressClick = false;
    let activeHandle = null;
    let activeDragOffset = { x: 0, y: 0 };
    let dragStartPoint = null;
    let dragStartVector = null;
    let creatingVector = false;
    let creationPointerOrigin = null;
    let creationDefaultEnd = null;
    let viewScale = 1;
    let panX = 0;
    let panY = 0;
    let panPointerId = null;
    let panOrigin = null;
    let panStart = null;
    const panPointers = new Map();
    let pinchStartDistance = null;
    let pinchStartScale = 1;
    let pinchStartMidpoint = null;
    let pinchStartPan = null;
    let confirmed = false;
    let tipPlacementActive = false;
    let activeTip = null;
    let rawSpeciesData = null;
    let ratioProfiles = [];
    let rankingMode = "auto";

    function openTool() {
        ptipTool.classList.add("open");
        document.body.classList.add("ptip-open");
    }

    function closeTool() {
        ptipTool.classList.remove("open");
        document.body.classList.remove("ptip-open");
    }

    function setPanMode(enabled) {
        panImage.classList.toggle("active", enabled);
        panImage.setAttribute("aria-pressed", String(enabled));
        imageStage.classList.toggle("is-panning", enabled);
    }

    function renderVectorOverlay() {
        const vector = vectorLayer.querySelector(".vector");
        if (!vector) return;
        const rect = workspace.getBoundingClientRect();
        const toScreen = (x, y) => confirmed ? { x, y } : ({
            x: (x - rect.width / 2) * viewScale + rect.width / 2 + panX,
            y: (y - rect.height / 2) * viewScale + rect.height / 2 + panY
        });
        const start = toScreen(Number(vector.dataset.startX), Number(vector.dataset.startY));
        const end = toScreen(Number(vector.dataset.endX), Number(vector.dataset.endY));
        vector.querySelectorAll(".vector-line, .vector-chord-hit").forEach(line => {
            line.setAttribute("x1", start.x);
            line.setAttribute("y1", start.y);
            line.setAttribute("x2", end.x);
            line.setAttribute("y2", end.y);
        });
        vector.querySelectorAll('[data-handle="start"]').forEach(handle => {
            handle.setAttribute("cx", start.x);
            handle.setAttribute("cy", start.y);
        });
        vector.querySelectorAll('[data-handle="end"]').forEach(handle => {
            handle.setAttribute("cx", end.x);
            handle.setAttribute("cy", end.y);
        });
        vector.querySelectorAll(".vector-anchor").forEach(handle => {
            handle.setAttribute("cx", start.x);
            handle.setAttribute("cy", start.y);
        });
    }

    function renderTips() {
        vectorLayer.querySelectorAll(".tip-marker").forEach(marker => {
            const x = Number(marker.dataset.x);
            const y = Number(marker.dataset.y);
            const vectorY = Number(marker.dataset.vectorY);
            marker.querySelector(".tip-line").setAttribute("x1", x);
            marker.querySelector(".tip-line").setAttribute("y1", y);
            marker.querySelector(".tip-line").setAttribute("x2", x);
            marker.querySelector(".tip-line").setAttribute("y2", 2 * vectorY - y);
            marker.querySelector(".tip-dot").setAttribute("cx", x);
            marker.querySelector(".tip-dot").setAttribute("cy", y);
            marker.querySelector(".tip-hit").setAttribute("cx", x);
            marker.querySelector(".tip-hit").setAttribute("cy", y);
        });
        renderRatioResults();
    }

    function measuredSignature(vector, markers, useP8) {
        const startX = Number(vector.dataset.startX);
        const endX = Number(vector.dataset.endX);
        const direction = endX >= startX ? 1 : -1;
        const ordered = markers.map(marker => ({
            marker,
            axis: (Number(marker.dataset.x) - startX) * direction
        })).sort((a, b) => b.axis - a.axis);
        const needed = useP8 ? 5 : 4;
        if (ordered.length < needed) return null;
        const distances = ordered.slice(0, needed).map(item => item.axis - ordered[0].axis);
        const span = distances[distances.length - 1];
        if (!span) return null;
        const normalized = distances.map(distance => distance / span);
        const intervals = useP8
            ? [normalized[2] - normalized[1], normalized[3] - normalized[2], normalized[4] - normalized[3]]
            : [normalized[1], normalized[2] - normalized[1], normalized[3] - normalized[2]];
        return intervals;
    }

    // Maps a signature difference to a green (close match) -> red (poor match) color.
    function differenceColor(difference) {
        const clamped = Math.min(Math.max(difference, 0), 0.4);
        const hue = 140 - (clamped / 0.4) * 140;
        return `hsl(${hue}, 70%, 38%)`;
    }

    function renderRatioResults() {
        if (!confirmed) return;
        const vector = vectorLayer.querySelector(".vector");
        const markers = [...vectorLayer.querySelectorAll(".tip-marker")];
        if (!vector || markers.length < 5 || !ratioProfiles.length) {
            ratioSummary.textContent = `${markers.length}/5 tips placed. Add ${Math.max(0, 5 - markers.length)} more to rank p7-p6, p6-p5, and p5-p4.`;
            ratioResults.innerHTML = "";
            return;
        }
        const cases = rankingMode === "p8"
            ? [{ label: "P8 furthest", signature: measuredSignature(vector, markers, true) }]
            : rankingMode === "p7"
                ? [{ label: "P7 furthest", signature: measuredSignature(vector, markers, false) }]
                : [
                    { label: "P8 furthest", signature: measuredSignature(vector, markers, true) },
                    { label: "P7 furthest", signature: measuredSignature(vector, markers, false) }
                ];
        if (cases.some(testCase => !testCase.signature)) {
            ratioSummary.textContent = `Not enough tips for ${rankingMode === "p8" ? "P8" : "P7"} ranking.`;
            ratioResults.innerHTML = "";
            return;
        }
        const ranked = ratioProfiles.flatMap(profile => cases.map(testCase => {
            const difference = testCase.signature.reduce((sum, value, index) => sum + Math.abs(value - profile.signature[index]), 0);
            return { ...profile, caseLabel: testCase.label, difference };
        })).sort((a, b) => a.difference - b.difference).slice(0, 6);
        const rankingLabel = rankingMode === "auto" ? "both possible furthest-primary assignments" : `${rankingMode.toUpperCase()} furthest assignment`;
        ratioSummary.textContent = ranked.length
            ? `${markers.length} tips placed. Ranking uses ${rankingLabel}.`
            : "No reference species match the current region filter.";
        ratioResults.innerHTML = ranked.map((result, index) => {
            const color = differenceColor(result.difference);
            return `<div class="ratio-row" style="--match-color:${color}"><strong>${String(index + 1).padStart(2, "0")}</strong><span>${result.name} / ${result.caseLabel}</span><span style="color:${color}">${result.difference.toFixed(3)} diff</span></div>`;
        }).join("");
    }

    // Rebuilds the ranked profile list from the last-fetched data, honoring the page's active region filter.
    function buildRatioProfiles() {
        const isInActiveRegion = window.empidRegionFilter?.isSpeciesInActiveRegion || (() => true);
        ratioProfiles = (rawSpeciesData || []).filter(bird => isInActiveRegion(bird.name)).flatMap(bird => {
            const values = bird["Length normalized to P8-P3"];
            if (!values || ["P7", "P6", "P5", "P4"].some(key => typeof values[key] !== "number")) return [];
            return [{
                name: bird.name,
                signature: [values.P7 - values.P6, values.P6 - values.P5, values.P5 - values.P4]
            }];
        }).map(profile => {
            const total = profile.signature.reduce((sum, value) => sum + value, 0);
            return { ...profile, signature: profile.signature.map(value => value / total) };
        });
        renderRatioResults();
    }

    async function loadRatioProfiles() {
        try {
            const response = await fetch("empid_traits.json");
            if (!response.ok) throw new Error(`Could not load ratio data (${response.status})`);
            const data = await response.json();
            rawSpeciesData = data.species;
            buildRatioProfiles();
        } catch (error) {
            ratioSummary.textContent = "Ratio reference data could not be loaded.";
            console.error(error);
        }
    }

    function renderView() {
        const rect = workspace.getBoundingClientRect();
        const baseX = panX + rect.width / 2 * (1 - viewScale);
        const baseY = panY + rect.height / 2 * (1 - viewScale);
        imageStage.style.transform = `translate(${baseX}px, ${baseY}px) scale(${viewScale})`;
        renderVectorOverlay();
        renderTips();
        vectorArrow.setAttribute("markerWidth", 12);
        vectorArrow.setAttribute("markerHeight", 10);
        vectorArrow.setAttribute("refX", 8);
        vectorArrow.setAttribute("refY", 5);
        zoomLabel.textContent = `${Math.round(viewScale * 100)}%`;
    }

    function resetView() {
        viewScale = 1;
        panX = 0;
        panY = 0;
        renderView();
    }

    function resetWorkspace() {
        vectorLayer.querySelector(".vector")?.remove();
        vectorLayer.querySelectorAll(".tip-marker").forEach(marker => marker.remove());
        confirmed = false;
        canvasState.classList.remove("confirmed");
        tipPlacementActive = false;
        placementActive = false;
        activeHandle = null;
        activeDragOffset = { x: 0, y: 0 };
        dragStartPoint = null;
        dragStartVector = null;
        panPointerId = null;
        dragPointerId = null;
        dragOrigin = null;
        dragMoved = false;
        panPointers.clear();
        pinchStartDistance = null;
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = null;
        photo.removeAttribute("src");
        canvasState.classList.add("hidden");
        uploadState.classList.remove("hidden");
        imageInput.value = "";
        ratioResults.innerHTML = "";
        ratioSummary.textContent = "Place at least five feather tips to compare p7-p6, p6-p5, and p5-p4.";
        setPanMode(false);
        resetView();
        updateToolState("Ready to place a vector.");
    }

    function setImage(file) {
        if (!file || !file.type.startsWith("image/")) return;
        vectorLayer.querySelector(".vector")?.remove();
        vectorLayer.querySelectorAll(".tip-marker").forEach(marker => marker.remove());
        confirmed = false;
        canvasState.classList.remove("confirmed");
        tipPlacementActive = false;
        placementActive = false;
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = URL.createObjectURL(file);
        photo.src = imageUrl;
        resetView();
        uploadState.classList.add("hidden");
        canvasState.classList.remove("hidden");
        beginPlacement();
    }

    function pointFromEvent(event) {
        const rect = workspace.getBoundingClientRect();
        if (confirmed) return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        return {
            x: (event.clientX - rect.left - rect.width / 2 - panX) / viewScale + rect.width / 2,
            y: (event.clientY - rect.top - rect.height / 2 - panY) / viewScale + rect.height / 2
        };
    }

    function visibleImageBounds() {
        const rect = workspace.getBoundingClientRect();
        return {
            left: (0 - rect.width / 2 - panX) / viewScale + rect.width / 2,
            right: (rect.width - rect.width / 2 - panX) / viewScale + rect.width / 2,
            top: (0 - rect.height / 2 - panY) / viewScale + rect.height / 2,
            bottom: (rect.height - rect.height / 2 - panY) / viewScale + rect.height / 2
        };
    }

    function fitVectorStart(point) {
        const bounds = visibleImageBounds();
        const maximumLength = 150;
        const edgePadding = 18 / viewScale;
        const minimumLength = 40 / viewScale;
        const rightLimit = Math.min(vectorLayer.clientWidth - edgePadding, bounds.right - edgePadding);
        const start = {
            x: Math.min(Math.max(point.x, bounds.left + edgePadding), rightLimit - minimumLength),
            y: Math.min(Math.max(point.y, bounds.top + edgePadding), bounds.bottom - edgePadding)
        };
        return { x: start.x, y: start.y, rightLimit, maximumLength, minimumLength };
    }

    function svgElement(name, attributes) {
        const element = document.createElementNS("http://www.w3.org/2000/svg", name);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    }

    function updateVector(vector, start, end) {
        vector.dataset.startX = start.x;
        vector.dataset.startY = start.y;
        vector.dataset.endX = end.x;
        vector.dataset.endY = end.y;
        if (!confirmed) {
            vector.dataset.setupStartX = start.x;
            vector.dataset.setupStartY = start.y;
            vector.dataset.setupEndX = end.x;
            vector.dataset.setupEndY = end.y;
        }
        renderVectorOverlay();
    }

    function addVector(point) {
        if (vectorLayer.querySelector(".vector")) return false;
        const fit = fitVectorStart(point);
        const start = { x: fit.x, y: fit.y };
        const end = { x: Math.min(start.x + fit.maximumLength, fit.rightLimit), y: start.y };
        const group = svgElement("g", { class: "vector" });
        group.dataset.startX = start.x;
        group.dataset.startY = start.y;
        group.dataset.endX = end.x;
        group.dataset.endY = end.y;
        group.dataset.setupStartX = start.x;
        group.dataset.setupStartY = start.y;
        group.dataset.setupEndX = end.x;
        group.dataset.setupEndY = end.y;
        group.append(svgElement("line", { class: "vector-chord-hit" }));
        group.append(svgElement("line", { class: "vector-line", "marker-end": "url(#vectorArrow)" }));
        group.append(svgElement("circle", { class: "vector-handle vector-anchor", cx: start.x, cy: start.y, r: 7 }));
        group.append(svgElement("circle", { class: "vector-hit", "data-handle": "start", cx: start.x, cy: start.y, r: 18 }));
        group.append(svgElement("circle", { class: "vector-hit", "data-handle": "end", cx: end.x, cy: end.y, r: 18 }));
        vectorLayer.append(group);
        renderView();
        return true;
    }

    function replaceVectorAt(point) {
        vectorLayer.querySelector(".vector")?.remove();
        addVector(point);
        placementActive = false;
        setPanMode(true);
        updateToolState("Vector placed. Drag either endpoint to adjust it.");
        helperText.textContent = "Drag either endpoint to adjust the wing-top anchor or primary tip.";
    }

    function updateToolState(message) {
        toolStatus.textContent = message;
        const hasVector = Boolean(vectorLayer.querySelector(".vector"));
        createVector.disabled = false;
        confirmVector.disabled = !hasVector || confirmed;
        const tipCount = vectorLayer.querySelectorAll(".tip-marker").length;
        if (tipCount >= 6) tipPlacementActive = false;
        createVector.classList.toggle("active", placementActive);
        createVector.setAttribute("aria-pressed", String(placementActive));
        // Create Vector and Pan share the same toolbar slot: only one exists at a time.
        createVector.classList.toggle("hidden", hasVector);
        panImage.classList.toggle("hidden", !hasVector);
        resetVector.classList.toggle("hidden", !hasVector);
    }

    function beginPlacement() {
        if (confirmed) return;
        vectorLayer.querySelector(".vector")?.remove();
        activeHandle = null;
        setPanMode(false);
        placementActive = true;
        updateToolState("Click or tap the top of the wing.");
        helperText.textContent = "Click or tap once to place the horizontal vector. Drag either endpoint afterward to adjust it.";
    }

    function addTipAt(point) {
        const vector = vectorLayer.querySelector(".vector");
        if (!confirmed || !vector) return false;
        if (vectorLayer.querySelectorAll(".tip-marker").length >= 6) return false;
        const duplicate = [...vectorLayer.querySelectorAll(".tip-marker")].some(marker => Math.hypot(Number(marker.dataset.x) - point.x, Number(marker.dataset.y) - point.y) < 28);
        if (duplicate) return false;
        const vectorY = Number(vector.dataset.vectorY);
        const marker = svgElement("g", { class: "tip-marker" });
        marker.dataset.x = point.x;
        marker.dataset.y = point.y;
        marker.dataset.vectorY = vectorY;
        marker.append(svgElement("line", { class: "tip-line" }));
        marker.append(svgElement("circle", { class: "tip-dot", r: 7 }));
        marker.append(svgElement("circle", { class: "tip-hit", "data-tip-handle": "true", r: 22 }));
        vectorLayer.append(marker);
        renderTips();
        return marker;
    }

    function clearTips() {
        vectorLayer.querySelectorAll(".tip-marker").forEach(marker => marker.remove());
        tipPlacementActive = false;
        activeTip = null;
        updateToolState("Tips reset. Add feather tips.");
        helperText.textContent = "Add feather tip, then click or drag it onto a primary. Dotted lines mirror across the vector.";
        renderTips();
    }

    function setRankingMode(mode) {
        rankingMode = mode;
        Object.entries(rankButtons).forEach(([name, button]) => button.setAttribute("aria-pressed", String(name === mode)));
        renderRatioResults();
    }

    // Reflects the page-wide region filter in this tool's own selector.
    function syncRegionButtons(region) {
        Object.entries(regionButtons).forEach(([name, button]) => button.setAttribute("aria-pressed", String(name === region)));
    }

    function confirmCurrentVector() {
        const vector = vectorLayer.querySelector(".vector");
        if (!vector || confirmed) return;
        const start = { x: Number(vector.querySelector(".vector-line").getAttribute("x1")), y: Number(vector.querySelector(".vector-line").getAttribute("y1")) };
        const end = { x: Number(vector.querySelector(".vector-line").getAttribute("x2")), y: Number(vector.querySelector(".vector-line").getAttribute("y2")) };
        const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        let rotation = -Math.atan2(end.y - start.y, end.x - start.x);
        if (rotation > Math.PI / 2) rotation -= Math.PI;
        if (rotation < -Math.PI / 2) rotation += Math.PI;
        const targetLength = Math.max(40, workspace.clientWidth - 86);
        // Cap magnification so a short vector doesn't blow the photo up past readable resolution.
        const fitScale = Math.min(2.5, targetLength / Math.max(length, 1));
        const targetMidpoint = { x: workspace.clientWidth / 2, y: workspace.clientHeight / 2 };
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const transformPoint = point => ({
            x: targetMidpoint.x + (point.x - midpoint.x) * cos * fitScale - (point.y - midpoint.y) * sin * fitScale,
            y: targetMidpoint.y + (point.x - midpoint.x) * sin * fitScale + (point.y - midpoint.y) * cos * fitScale
        });
        const finalStart = transformPoint(start);
        const finalEnd = transformPoint(end);
        const rect = workspace.getBoundingClientRect();
        const baseX = panX + rect.width / 2 * (1 - viewScale);
        const baseY = panY + rect.height / 2 * (1 - viewScale);
        imageStage.style.transform = `translate(${targetMidpoint.x}px, ${targetMidpoint.y}px) rotate(${rotation}rad) scale(${fitScale}) translate(${-midpoint.x}px, ${-midpoint.y}px) translate(${baseX}px, ${baseY}px) scale(${viewScale})`;
        confirmed = true;
        vector.dataset.startX = finalStart.x;
        vector.dataset.startY = finalStart.y;
        vector.dataset.endX = finalEnd.x;
        vector.dataset.endY = finalEnd.y;
        vector.dataset.vectorY = (finalStart.y + finalEnd.y) / 2;
        canvasState.classList.add("confirmed");
        placementActive = false;
        tipPlacementActive = true;
        setPanMode(false);
        renderVectorOverlay();
        updateToolState("Tip mode active. Click or tap to place a feather tip.");
        helperText.textContent = "Add feather tip, then click or drag it onto a primary. Dotted lines mirror across the vector.";
    }

    function returnToVectorSetup() {
        const vector = vectorLayer.querySelector(".vector");
        if (!vector) return;
        confirmed = false;
        canvasState.classList.remove("confirmed");
        vectorLayer.querySelectorAll(".tip-marker").forEach(marker => marker.remove());
        vector.dataset.startX = vector.dataset.setupStartX;
        vector.dataset.startY = vector.dataset.setupStartY;
        vector.dataset.endX = vector.dataset.setupEndX;
        vector.dataset.endY = vector.dataset.setupEndY;
        vector.dataset.vectorY = "";
        tipPlacementActive = false;
        activeTip = null;
        resetView();
        placementActive = true;
        setPanMode(false);
        renderVectorOverlay();
        updateToolState("Vector setup restored. Place a new vector.");
        helperText.textContent = "Place or drag a new vector, then confirm it when ready.";
    }

    function handleCanvasPointer(event) {
        if (event.target.closest(".workspace-toolbar")) return;
        event.preventDefault();
        const tipHandle = event.target.closest("[data-tip-handle]");
        if (confirmed && tipHandle) {
            activeHandle = "tip";
            activeTip = tipHandle.closest(".tip-marker");
            dragPointerId = event.pointerId;
            return;
        }
        const handle = event.target.closest("[data-handle]");
        if (handle) {
            activeHandle = handle.dataset.handle;
            dragPointerId = event.pointerId;
            activeDragOffset = event.pointerType === "touch" ? { x: 0, y: -52 } : { x: 0, y: 0 };
            return;
        }
        const line = event.target.closest(".vector-line, .vector-chord-hit");
        if (line) {
            const vector = line.closest(".vector");
            activeHandle = "chord";
            dragPointerId = event.pointerId;
            dragStartPoint = pointFromEvent(event);
            dragStartVector = {
                start: { x: Number(vector.dataset.startX), y: Number(vector.dataset.startY) },
                end: { x: Number(vector.dataset.endX), y: Number(vector.dataset.endY) }
            };
            return;
        }
        if (confirmed && tipPlacementActive) {
            const marker = addTipAt(pointFromEvent(event));
            if (marker) {
                activeHandle = "tip";
                activeTip = marker;
                dragPointerId = event.pointerId;
            }
            updateToolState("Tip placed. Click or drag to add another feather tip.");
            return;
        }
        if (!placementActive) return;
        const bounds = visibleImageBounds();
        const point = pointFromEvent(event);
        point.x = Math.min(Math.max(point.x, bounds.left), bounds.right);
        point.y = Math.min(Math.max(point.y, bounds.top), bounds.bottom);
        addVector(point);
        // Let the end point follow the pointer; a quick tap (see pointerup) reverts to the default length.
        const placedVector = vectorLayer.querySelector(".vector");
        creatingVector = true;
        creationPointerOrigin = { x: event.clientX, y: event.clientY };
        creationDefaultEnd = { x: Number(placedVector.dataset.endX), y: Number(placedVector.dataset.endY) };
        activeHandle = "end";
        dragPointerId = event.pointerId;
        activeDragOffset = { x: 0, y: 0 };
        updateToolState("Drag to set the vector length, or release for the default.");
        helperText.textContent = "Drag to the far wing tip, or release to place a default-length vector.";
    }

    openPtipButton.addEventListener("click", openTool);
    createVector.addEventListener("click", () => {
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        beginPlacement();
    });
    confirmVector.addEventListener("click", confirmCurrentVector);
    backToVector.addEventListener("click", returnToVectorSetup);
    backToReference.addEventListener("click", closeTool);
    resetTips.addEventListener("click", clearTips);
    resetVector.addEventListener("click", beginPlacement);
    Object.entries(rankButtons).forEach(([mode, button]) => button.addEventListener("click", () => setRankingMode(mode)));
    Object.entries(regionButtons).forEach(([region, button]) => button.addEventListener("click", () => window.empidRegionFilter?.setActiveRegion?.(region)));
    vectorLayer.addEventListener("pointerdown", handleCanvasPointer);
    workspace.addEventListener("dragover", event => event.preventDefault());
    workspace.addEventListener("drop", event => {
        event.preventDefault();
        if (canvasState.classList.contains("hidden")) return;
        if (confirmed && event.dataTransfer.getData("text/plain") === "add-tip") {
            addTipAt(pointFromEvent(event));
            tipPlacementActive = true;
            updateToolState("Tip placed. Click or drag to add another feather tip.");
            return;
        }
        replaceVectorAt(pointFromEvent(event));
    });
    createVector.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", "create-vector"));
    uploadCard.addEventListener("dragover", event => { event.preventDefault(); uploadCard.classList.add("is-dragging"); });
    uploadCard.addEventListener("dragleave", () => uploadCard.classList.remove("is-dragging"));
    uploadCard.addEventListener("drop", event => { event.preventDefault(); uploadCard.classList.remove("is-dragging"); setImage(event.dataTransfer.files[0]); });
    imageInput.addEventListener("change", event => setImage(event.target.files[0]));
    reuploadImage.addEventListener("click", () => { resetWorkspace(); imageInput.click(); });
    panImage.addEventListener("click", () => {
        setPanMode(true);
        updateToolState("Pan mode enabled.");
    });
    zoomOut.addEventListener("click", () => { viewScale = Math.max(.5, viewScale - .25); renderView(); });
    zoomIn.addEventListener("click", () => { viewScale = Math.min(3, viewScale + .25); renderView(); });
    workspace.addEventListener("wheel", event => {
        if (event.target.closest(".workspace-toolbar, .ratio-panel")) return;
        event.preventDefault();
        if (confirmed) return;
        viewScale = Math.min(3, Math.max(.5, viewScale + (event.deltaY < 0 ? .1 : -.1)));
        renderView();
    }, { passive: false });

    workspace.addEventListener("pointerdown", event => {
        if (!panImage.matches(".active") || event.target.closest(".workspace-toolbar, [data-handle], .vector-line, .vector-chord-hit")) return;
        panPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (panPointers.size === 1) {
            panPointerId = event.pointerId;
            panOrigin = { x: event.clientX, y: event.clientY };
            panStart = { x: panX, y: panY };
        } else if (panPointers.size === 2) {
            const points = [...panPointers.values()];
            pinchStartDistance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
            pinchStartScale = viewScale;
            pinchStartMidpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
            pinchStartPan = { x: panX, y: panY };
        }
        event.preventDefault();
    });

    createVector.addEventListener("pointerdown", event => {
        suppressClick = false;
        dragPointerId = event.pointerId;
        dragOrigin = { x: event.clientX, y: event.clientY };
        dragMoved = false;
        event.preventDefault();
    });
    window.addEventListener("pointermove", event => {
        if (event.pointerId === dragPointerId && dragOrigin) {
            dragMoved = dragMoved || Math.hypot(event.clientX - dragOrigin.x, event.clientY - dragOrigin.y) > 20;
        }
    });
    window.addEventListener("pointerup", event => {
        if (activeHandle) return;
        if (event.pointerId !== dragPointerId) return;
        const rect = workspace.getBoundingClientRect();
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        if (dragMoved && !canvasState.classList.contains("hidden") && point.x >= 0 && point.x <= rect.width && point.y >= 0 && point.y <= rect.height) {
            replaceVectorAt(pointFromEvent(event));
            suppressClick = true;
        }
        dragPointerId = null;
        dragOrigin = null;
        dragMoved = false;
    });
    window.addEventListener("pointermove", event => {
        if (!panPointers.has(event.pointerId)) return;
        panPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (panPointers.size === 2 && pinchStartDistance) {
            const points = [...panPointers.values()];
            const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
            const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
            viewScale = Math.min(3, Math.max(.5, pinchStartScale * distance / pinchStartDistance));
            panX = pinchStartPan.x + midpoint.x - pinchStartMidpoint.x;
            panY = pinchStartPan.y + midpoint.y - pinchStartMidpoint.y;
            renderView();
            return;
        }
        if (panPointers.size === 1 && event.pointerId === panPointerId && panOrigin) {
            panX = panStart.x + event.clientX - panOrigin.x;
            panY = panStart.y + event.clientY - panOrigin.y;
            renderView();
        }
    });
    window.addEventListener("pointerup", event => {
        if (!panPointers.has(event.pointerId)) return;
        panPointers.delete(event.pointerId);
        if (panPointers.size < 2) pinchStartDistance = null;
        if (panPointers.size === 1) {
            const [remainingId, remainingPoint] = panPointers.entries().next().value;
            panPointerId = remainingId;
            panOrigin = remainingPoint;
            panStart = { x: panX, y: panY };
        } else if (!panPointers.size) {
            panPointerId = null;
            panOrigin = null;
            panStart = null;
        }
    });
    window.addEventListener("pointermove", event => {
        if (!activeHandle || event.pointerId !== dragPointerId) return;
        if (activeHandle === "tip") {
            const point = pointFromEvent(event);
            activeTip.dataset.x = point.x;
            activeTip.dataset.y = point.y;
            renderTips();
            return;
        }
        const vector = vectorLayer.querySelector(".vector");
        if (!vector) return;
        const point = pointFromEvent(event);
        const bounds = visibleImageBounds();
        point.x += activeDragOffset.x / viewScale;
        point.y += activeDragOffset.y / viewScale;
        let start = { x: Number(vector.dataset.startX), y: Number(vector.dataset.startY) };
        let end = { x: Number(vector.dataset.endX), y: Number(vector.dataset.endY) };
        if (activeHandle === "chord") {
            let deltaX = point.x - dragStartPoint.x;
            let deltaY = point.y - dragStartPoint.y;
            deltaX = Math.min(Math.max(deltaX, bounds.left - dragStartVector.start.x), bounds.right - dragStartVector.end.x);
            deltaY = Math.min(Math.max(deltaY, bounds.top - dragStartVector.start.y), bounds.bottom - dragStartVector.end.y);
            start = { x: dragStartVector.start.x + deltaX, y: dragStartVector.start.y + deltaY };
            end = { x: dragStartVector.end.x + deltaX, y: dragStartVector.end.y + deltaY };
        } else {
            point.x = Math.min(Math.max(point.x, bounds.left), bounds.right);
            point.y = Math.min(Math.max(point.y, bounds.top), bounds.bottom);
            if (activeHandle === "start") Object.assign(start, point);
            if (activeHandle === "end") Object.assign(end, point);
        }
        updateVector(vector, start, end);
    });
    window.addEventListener("pointerup", event => {
        if (event.pointerId === dragPointerId && activeHandle) {
            if (creatingVector) {
                const distance = Math.hypot(event.clientX - creationPointerOrigin.x, event.clientY - creationPointerOrigin.y);
                const vector = vectorLayer.querySelector(".vector");
                if (vector && distance < 20) {
                    const start = { x: Number(vector.dataset.startX), y: Number(vector.dataset.startY) };
                    updateVector(vector, start, creationDefaultEnd);
                }
                creatingVector = false;
                creationPointerOrigin = null;
                creationDefaultEnd = null;
                placementActive = false;
                setPanMode(true);
                updateToolState("Vector placed. Drag either endpoint to adjust it.");
                helperText.textContent = "Drag either endpoint to adjust the wing-top anchor or primary tip.";
            }
            activeHandle = null;
            dragPointerId = null;
            activeDragOffset = { x: 0, y: 0 };
            dragStartPoint = null;
            dragStartVector = null;
        }
    });

    window.ptipTool = { open: openTool, close: closeTool, refreshRatioProfiles: buildRatioProfiles, onRegionChange: syncRegionButtons };

    syncRegionButtons(window.empidRegionFilter?.getActiveRegion?.() || "all");
    loadRatioProfiles();
})();
