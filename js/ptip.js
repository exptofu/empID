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
    const speciesGroups = {
        acadianYB: { button: document.querySelector("#ptipGroupAcadianYB"), species: ["Acadian Flycatcher", "Yellow-bellied Flycatcher"] },
        traill: { button: document.querySelector("#ptipGroupTraill"), species: ["Least Flycatcher", "Alder Flycatcher", "Willow Flycatcher"] }
    };
    let activeSpeciesGroup = "acadianYB";
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
    let confirmRotation = 0;
    let confirmFitScale = 1;
    let stageWidth = 0;
    let stageHeight = 0;
    let tipPlacementActive = false;
    let activeTip = null;
    // Base (100%-zoom) sizes for overlay chrome; all are divided by overlayScale() so they shrink as the photo is zoomed in.
    const VECTOR_LINE_WIDTH = 3;
    const VECTOR_CHORD_HIT_WIDTH = 24;
    const VECTOR_HANDLE_RADIUS = 7;
    const VECTOR_HANDLE_STROKE = 3;
    const VECTOR_HIT_RADIUS = 18;
    const TIP_DOT_RADIUS = 7;
    const TIP_DOT_STROKE = 2;
    const TIP_HIT_RADIUS = 22;
    const TIP_LINE_WIDTH = 2;
    const ARROW_MARKER_WIDTH = 12;
    const ARROW_MARKER_HEIGHT = 10;
    const LABEL_FONT_SIZE = 11;
    const LABEL_OFFSET_PERP = 30;
    const LABEL_OFFSET_ALONG = 26;
    const LABEL_PAD_X = 6;
    const LABEL_PAD_Y = 4;
    const LABEL_BORDER_WIDTH = 1.5;

    // The current photo zoom factor: setup uses viewScale, confirmed mode locks to confirmFitScale.
    function overlayScale() {
        return confirmed ? confirmFitScale : viewScale;
    }
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

    // The overlay lives inside #imageStage, so it always shares the same CSS transform as the photo.
    function renderVectorOverlay() {
        const vector = vectorLayer.querySelector(".vector");
        if (!vector) return;
        const start = { x: Number(vector.dataset.startX), y: Number(vector.dataset.startY) };
        const end = { x: Number(vector.dataset.endX), y: Number(vector.dataset.endY) };
        vector.querySelectorAll(".vector-line, .vector-chord-hit").forEach(line => {
            line.setAttribute("x1", start.x);
            line.setAttribute("y1", start.y);
            line.setAttribute("x2", end.x);
            line.setAttribute("y2", end.y);
        });
        const scale = overlayScale();
        vector.querySelectorAll(".vector-line").forEach(line => { line.style.strokeWidth = `${VECTOR_LINE_WIDTH / scale}px`; });
        vector.querySelectorAll(".vector-chord-hit").forEach(line => { line.style.strokeWidth = `${VECTOR_CHORD_HIT_WIDTH / scale}px`; });
        vector.querySelectorAll('circle[data-handle="start"]').forEach(handle => {
            handle.setAttribute("cx", start.x);
            handle.setAttribute("cy", start.y);
            handle.setAttribute("r", VECTOR_HIT_RADIUS / scale);
        });
        vector.querySelectorAll('circle[data-handle="end"]').forEach(handle => {
            handle.setAttribute("cx", end.x);
            handle.setAttribute("cy", end.y);
            handle.setAttribute("r", VECTOR_HIT_RADIUS / scale);
        });
        vector.querySelectorAll(".vector-anchor").forEach(handle => {
            handle.setAttribute("cx", start.x);
            handle.setAttribute("cy", start.y);
            handle.setAttribute("r", VECTOR_HANDLE_RADIUS / scale);
            handle.style.strokeWidth = `${VECTOR_HANDLE_STROKE / scale}px`;
        });
        const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
        const direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
        positionVectorLabel(vector, "start", start, direction);
        positionVectorLabel(vector, "end", end, direction);
    }

    // Moves a draggable label (which shares the same data-handle as its endpoint) to sit beside that endpoint, and sizes its background box to fit the text.
    function positionVectorLabel(vector, handle, point, direction) {
        const label = vector.querySelector(`.vector-label[data-handle="${handle}"]`);
        if (!label) return;
        const scale = overlayScale();
        const perpendicular = { x: direction.y, y: -direction.x };
        const along = handle === "start" ? -1 : 1;
        const offsetPerp = LABEL_OFFSET_PERP / scale;
        const offsetAlong = LABEL_OFFSET_ALONG / scale;
        const labelX = point.x + perpendicular.x * offsetPerp + direction.x * along * offsetAlong;
        const labelY = point.y + perpendicular.y * offsetPerp + direction.y * along * offsetAlong;
        label.setAttribute("transform", `translate(${labelX}, ${labelY})`);
        const text = label.querySelector(".vector-label-text");
        const box = label.querySelector(".vector-label-bg");
        text.style.fontSize = `${LABEL_FONT_SIZE / scale}px`;
        box.style.strokeWidth = `${LABEL_BORDER_WIDTH / scale}px`;
        const bbox = text.getBBox();
        const paddingX = LABEL_PAD_X / scale;
        const paddingY = LABEL_PAD_Y / scale;
        box.setAttribute("x", bbox.x - paddingX);
        box.setAttribute("y", bbox.y - paddingY);
        box.setAttribute("width", bbox.width + paddingX * 2);
        box.setAttribute("height", bbox.height + paddingY * 2);
    }

    // Builds a small draggable text box that mirrors its endpoint's data-handle, so grabbing the label drags the same point as the circle/arrow.
    function makeVectorLabel(handle, text) {
        const label = svgElement("g", { class: "vector-label", "data-handle": handle });
        label.append(svgElement("rect", { class: "vector-label-bg" }));
        const textElement = svgElement("text", { class: "vector-label-text" });
        textElement.textContent = text;
        label.append(textElement);
        return label;
    }

    function renderTips() {
        const vector = vectorLayer.querySelector(".vector");
        const start = vector ? { x: Number(vector.dataset.startX), y: Number(vector.dataset.startY) } : null;
        const end = vector ? { x: Number(vector.dataset.endX), y: Number(vector.dataset.endY) } : null;
        const length = start && end ? Math.hypot(end.x - start.x, end.y - start.y) || 1 : 1;
        const direction = start && end ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : null;
        const scale = overlayScale();
        vectorLayer.querySelectorAll(".tip-marker").forEach(marker => {
            const x = Number(marker.dataset.x);
            const y = Number(marker.dataset.y);
            let mirrorX = x;
            let mirrorY = y;
            if (direction) {
                // Reflect the tip across the vector's own line so the dotted mirror stays perpendicular even when the vector is rotated.
                const projection = (x - start.x) * direction.x + (y - start.y) * direction.y;
                const footX = start.x + direction.x * projection;
                const footY = start.y + direction.y * projection;
                mirrorX = 2 * footX - x;
                mirrorY = 2 * footY - y;
            }
            marker.querySelector(".tip-line").setAttribute("x1", x);
            marker.querySelector(".tip-line").setAttribute("y1", y);
            marker.querySelector(".tip-line").setAttribute("x2", mirrorX);
            marker.querySelector(".tip-line").setAttribute("y2", mirrorY);
            marker.querySelector(".tip-line").style.strokeWidth = `${TIP_LINE_WIDTH / scale}px`;
            marker.querySelector(".tip-dot").setAttribute("cx", x);
            marker.querySelector(".tip-dot").setAttribute("cy", y);
            marker.querySelector(".tip-dot").setAttribute("r", TIP_DOT_RADIUS / scale);
            marker.querySelector(".tip-dot").style.strokeWidth = `${TIP_DOT_STROKE / scale}px`;
            marker.querySelector(".tip-hit").setAttribute("cx", x);
            marker.querySelector(".tip-hit").setAttribute("cy", y);
            marker.querySelector(".tip-hit").setAttribute("r", TIP_HIT_RADIUS / scale);
        });
        renderRatioResults();
    }

    function measuredSignature(vector, markers, useP8) {
        const startX = Number(vector.dataset.startX);
        const startY = Number(vector.dataset.startY);
        const endX = Number(vector.dataset.endX);
        const endY = Number(vector.dataset.endY);
        const length = Math.hypot(endX - startX, endY - startY) || 1;
        const direction = { x: (endX - startX) / length, y: (endY - startY) / length };
        // Project each tip onto the vector's own direction so perpendicular distance from the vector never affects the ranking.
        const ordered = markers.map(marker => ({
            marker,
            axis: (Number(marker.dataset.x) - startX) * direction.x + (Number(marker.dataset.y) - startY) * direction.y
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

    // Whether each species' P6:7 ratio (P6-P5 / P7-P6) should read below or above 1.
    const RATIO_EXPECTATION = {
        "Acadian Flycatcher": "below",
        "Yellow-bellied Flycatcher": "above",
        "Alder Flycatcher": "below",
        "Willow Flycatcher": "above",
        "Least Flycatcher": "above"
    };

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
            const ratio = testCase.signature[1] / testCase.signature[0];
            return { ...profile, caseLabel: testCase.label, difference, ratio };
        })).sort((a, b) => a.difference - b.difference).slice(0, 6);
        const rankingLabel = rankingMode === "auto" ? "both possible furthest-primary assignments" : `${rankingMode.toUpperCase()} furthest assignment`;
        ratioSummary.textContent = ranked.length
            ? `${markers.length} tips placed. Ranking uses ${rankingLabel}.`
            : "No reference species match the current species-pair filter.";
        ratioResults.innerHTML = ranked.map((result, index) => {
            const color = differenceColor(result.difference);
            const expectation = RATIO_EXPECTATION[result.name];
            const ratioMatches = expectation === "below" ? result.ratio < 1 : expectation === "above" ? result.ratio > 1 : null;
            const ratioColor = ratioMatches === null ? "var(--muted)" : ratioMatches ? "hsl(140, 70%, 38%)" : "hsl(0, 70%, 45%)";
            return `<div class="ratio-row" style="--match-color:${color}"><strong>${String(index + 1).padStart(2, "0")}</strong><span>${result.name} / ${result.caseLabel}</span><span style="color:${color}">${result.difference.toFixed(3)} diff</span><span style="color:${ratioColor}">P6:7 ${result.ratio.toFixed(2)}</span></div>`;
        }).join("");
    }

    // Rebuilds the ranked profile list from the last-fetched data, restricted to the selected species pair/trio.
    function buildRatioProfiles() {
        const activeSpecies = speciesGroups[activeSpeciesGroup].species;
        ratioProfiles = (rawSpeciesData || []).filter(bird => activeSpecies.includes(bird.name)).flatMap(bird => {
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

    // Reads the live transform applied to #imageStage so pointer math self-corrects after a resize.
    function stageMatrix() {
        const transform = getComputedStyle(imageStage).transform;
        return new DOMMatrix(transform === "none" ? undefined : transform);
    }

    function setupBaseOffset(rect) {
        return {
            x: panX + (rect.width - stageWidth * viewScale) / 2,
            y: panY + (rect.height - stageHeight * viewScale) / 2
        };
    }

    // Recomputes the confirmed vector's fixed rotation/scale around the current viewport center, so a resize simply re-centers it instead of losing alignment.
    function applyConfirmedTransform() {
        const vector = vectorLayer.querySelector(".vector");
        if (!vector) return;
        const rect = workspace.getBoundingClientRect();
        const start = { x: Number(vector.dataset.startX), y: Number(vector.dataset.startY) };
        const end = { x: Number(vector.dataset.endX), y: Number(vector.dataset.endY) };
        const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const targetMidpoint = { x: rect.width / 2, y: rect.height / 2 };
        imageStage.style.transform = `translate(${targetMidpoint.x}px, ${targetMidpoint.y}px) rotate(${confirmRotation}rad) scale(${confirmFitScale}) translate(${-midpoint.x}px, ${-midpoint.y}px)`;
    }

    function renderView() {
        if (confirmed) {
            applyConfirmedTransform();
        } else {
            const rect = workspace.getBoundingClientRect();
            const base = setupBaseOffset(rect);
            imageStage.style.transform = `translate(${base.x}px, ${base.y}px) scale(${viewScale})`;
        }
        renderVectorOverlay();
        renderTips();
        const scale = overlayScale();
        vectorArrow.setAttribute("markerWidth", ARROW_MARKER_WIDTH / scale);
        vectorArrow.setAttribute("markerHeight", ARROW_MARKER_HEIGHT / scale);
        // refX/refY are in the marker's fixed viewBox space, not markerWidth/Height space, so they stay constant.
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
        imageStage.style.width = "";
        imageStage.style.height = "";
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
        // Fix the stage to the workspace size at upload time so later window resizes only re-center it, never reflow it.
        const rect = workspace.getBoundingClientRect();
        stageWidth = rect.width;
        stageHeight = rect.height;
        imageStage.style.width = `${stageWidth}px`;
        imageStage.style.height = `${stageHeight}px`;
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
        const point = stageMatrix().inverse().transformPoint(new DOMPoint(event.clientX - rect.left, event.clientY - rect.top));
        return { x: point.x, y: point.y };
    }

    function visibleImageBounds() {
        const rect = workspace.getBoundingClientRect();
        const inverse = stageMatrix().inverse();
        const topLeft = inverse.transformPoint(new DOMPoint(0, 0));
        const bottomRight = inverse.transformPoint(new DOMPoint(rect.width, rect.height));
        return {
            left: Math.min(topLeft.x, bottomRight.x),
            right: Math.max(topLeft.x, bottomRight.x),
            top: Math.min(topLeft.y, bottomRight.y),
            bottom: Math.max(topLeft.y, bottomRight.y)
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
        group.append(makeVectorLabel("start", "Top of Wing"));
        group.append(makeVectorLabel("end", "Primary Extension"));
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
        const hasVector = Boolean(vectorLayer.querySelector(".vector"));
        const tipCount = vectorLayer.querySelectorAll(".tip-marker").length;
        if (tipCount >= 6) tipPlacementActive = false;
        // Once all six primaries (P8-P3) are placed, surface that instead of prompting for another tip.
        toolStatus.textContent = confirmed && tipCount >= 6 ? "All primary tips placed (P8-P3)." : message;
        createVector.disabled = false;
        confirmVector.disabled = !hasVector || confirmed;
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
        const marker = svgElement("g", { class: "tip-marker" });
        marker.dataset.x = point.x;
        marker.dataset.y = point.y;
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
        helperText.textContent = "Click or press to place a feather tip, and drag to align the dotted line against a primary tip. Start from outside and work inwards.";
        renderTips();
    }

    function setRankingMode(mode) {
        rankingMode = mode;
        Object.entries(rankButtons).forEach(([name, button]) => button.setAttribute("aria-pressed", String(name === mode)));
        renderRatioResults();
    }

    function setSpeciesGroup(group) {
        activeSpeciesGroup = group;
        Object.entries(speciesGroups).forEach(([name, { button }]) => button.setAttribute("aria-pressed", String(name === group)));
        buildRatioProfiles();
    }

    function confirmCurrentVector() {
        const vector = vectorLayer.querySelector(".vector");
        if (!vector || confirmed) return;
        // The vector's stage-local coordinates already track the photo under any pan/zoom (they share imageStage's transform), so no baking is needed here.
        const start = { x: Number(vector.dataset.startX), y: Number(vector.dataset.startY) };
        const end = { x: Number(vector.dataset.endX), y: Number(vector.dataset.endY) };
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        let rotation = -Math.atan2(end.y - start.y, end.x - start.x);
        if (rotation > Math.PI / 2) rotation -= Math.PI;
        if (rotation < -Math.PI / 2) rotation += Math.PI;
        const targetLength = Math.max(40, workspace.clientWidth - 86);
        // Cap magnification so a short vector doesn't blow the photo up past readable resolution.
        const fitScale = Math.min(2.5, targetLength / Math.max(length, 1));
        confirmed = true;
        confirmRotation = rotation;
        confirmFitScale = fitScale;
        panX = 0;
        panY = 0;
        viewScale = 1;
        canvasState.classList.add("confirmed");
        placementActive = false;
        tipPlacementActive = true;
        setPanMode(false);
        applyConfirmedTransform();
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
        // The prior vector is restored as-is; let the user drag its endpoints or reset it, rather than forcing a fresh placement.
        placementActive = false;
        setPanMode(true);
        renderVectorOverlay();
        updateToolState("Vector setup restored. Adjust it or reset to start over.");
        helperText.textContent = "Drag either endpoint to adjust the vector, or reset it to place a new one.";
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
    Object.entries(speciesGroups).forEach(([group, { button }]) => button.addEventListener("click", () => setSpeciesGroup(group)));
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
    // Rescale pan proportionally so the point currently centered in the viewport stays centered after zooming.
    function setViewScale(newScale) {
        const clamped = Math.min(3, Math.max(.5, newScale));
        const ratio = clamped / viewScale;
        panX *= ratio;
        panY *= ratio;
        viewScale = clamped;
        renderView();
    }
    zoomOut.addEventListener("click", () => setViewScale(viewScale - .25));
    zoomIn.addEventListener("click", () => setViewScale(viewScale + .25));
    workspace.addEventListener("wheel", event => {
        if (event.target.closest(".workspace-toolbar, .ratio-panel")) return;
        event.preventDefault();
        if (confirmed) return;
        setViewScale(viewScale + (event.deltaY < 0 ? .1 : -.1));
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

    // Re-center the fixed-size stage whenever the workspace is resized, instead of letting the photo silently reflow.
    new ResizeObserver(() => {
        if (!canvasState.classList.contains("hidden")) renderView();
    }).observe(workspace);

    window.ptipTool = { open: openTool, close: closeTool, refreshRatioProfiles: buildRatioProfiles };

    loadRatioProfiles();
})();
