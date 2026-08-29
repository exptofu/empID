"use strict";


// ============================================================
// DOM
// ============================================================

const canvas =
    document.getElementById("canvas");

const ctx =
    canvas.getContext("2d");

const fileInput =
    document.getElementById("fileInput");

const saveSessionBtn =
    document.getElementById("saveSessionBtn");

const loadSessionBtn =
    document.getElementById("loadSessionBtn");

const openImageBtn =
    document.getElementById("openImageBtn");

const panBtn =
    document.getElementById("panBtn");

const axisBtn =
    document.getElementById("axisBtn");

const pointBtn =
    document.getElementById("pointBtn");

const measureBtn =
    document.getElementById("measureBtn");

const zoomLabel =
    document.getElementById("zoomLabel");

const measurementsDiv =
    document.getElementById("measurements");

const sidebar =
    document.getElementById("sidebar");

const measurementsToggle =
    document.getElementById("measurementsToggle");

const status =
    document.getElementById("status");

const instructions =
    document.getElementById("instructions");

const instructionBody =
    document.getElementById("instructionBody");

const instructionsToggle =
    document.getElementById("instructionsToggle");

const instructionMessages = {
    launch:
        "Load an image to begin. All processing is local and never leaves your device",
    imageLoaded:
        "Select the Primary Axis button to align measurements",
    axis:
        "Click and drag to create an axis to measure by. These points can be dragged after",
    featherTipsReady:
        "Select Feather Tips to place markers for each visible primary feather from outside (P8) to in (P3)",
    featherTipsActive:
        "Place markers for each visible primary feather from outside (P8) to in (P3)",
    complete:
        "TBD: All measurements complete. You can still adjust the axis and feather tips if needed"
};


// ============================================================
// Image
// ============================================================

let image =
    new Image();

let imageLoaded =
    false;

let imageWidth =
    0;

let imageHeight =
    0;
// ============================================================
// View
// ============================================================

let zoom =
    1;

let offsetX =
    0;

let offsetY =
    0;


// ============================================================
// Mode
// ============================================================

let mode =
    "pan";


// ============================================================
// Primary axis
// ============================================================

let axis =
    null;


/*
    IMPORTANT:

    Secondary Tip is now an independent image point.

    It is NOT constrained to the axis.

    Its projected location is calculated when needed.
*/

let secondaryTip =
    null;


// ============================================================
// Feather tips
// ============================================================

let featherTips =
    [];

let pendingFeather =
    null;


// ============================================================
// Generic measurements
// ============================================================

let measurements =
    [];

let currentMeasurement =
    null;


// ============================================================
// Drag state
// ============================================================

let dragging =
    false;

let dragObject =
    null;

// Active touch/pointer state used for two-finger canvas gestures.
const activePointers = new Map();
let isPinching = false;
let pinchStartDistance = 0;
let pinchStartZoom = 1;
let pinchStartMidpoint = null;
let pinchImagePoint = null;

let panStart =
    null;

let panOrigin =
    null;

const SESSION_LIST_KEY =
    "empid-saved-sessions";

const LEGACY_SESSION_KEY =
    "empid-current-session";

const sessionStore =
    window.localforage
        ? localforage.createInstance({
            name: "empID",
            storeName: "sessions"
        })
        : null;

const fallbackSessionStore = {
    async getItem(key) {
        try {
            const raw =
                localStorage.getItem(key);

            return raw
                ? JSON.parse(raw)
                : null;
        } catch (error) {
            console.error("Fallback session read failed:", error);
            return null;
        }
    },

    async setItem(key, value) {
        try {
            localStorage.setItem(
                key,
                JSON.stringify(value)
            );
            return value;
        } catch (error) {
            console.error("Fallback session write failed:", error);
            throw error;
        }
    }
};

function getSessionStore() {
    return sessionStore || fallbackSessionStore;
}

function defaultSessionName() {
    const timestamp =
        new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

    return `Session ${timestamp}`;
}

function getCurrentSessionSnapshot() {
    return {
        version: 1,
        savedAt: new Date().toISOString(),
        mode,
        zoom,
        offsetX,
        offsetY,
        image: imageLoaded && image && image.src
            ? {
                dataUrl: image.src.startsWith("data:")
                    ? image.src
                    : canvasToDataUrl(),
                width: imageWidth,
                height: imageHeight
            }
            : null,
        axis: axis ? { ...axis } : null,
        secondaryTip: secondaryTip ? { ...secondaryTip } : null,
        featherTips: featherTips.map(feather => ({ ...feather })),
        measurements: measurements.map(measurement => ({ ...measurement })),
        currentMeasurement: currentMeasurement ? { ...currentMeasurement } : null,
        pendingFeather: pendingFeather ? { ...pendingFeather } : null
    };
}

function canvasToDataUrl() {
    const capture =
        document.createElement("canvas");

    capture.width = imageWidth || image.naturalWidth || 0;
    capture.height = imageHeight || image.naturalHeight || 0;

    if (!capture.width || !capture.height)
        return "";

    const captureCtx =
        capture.getContext("2d");

    captureCtx.drawImage(
        image,
        0,
        0,
        capture.width,
        capture.height
    );

    return capture.toDataURL("image/png");
}

async function getAllSessions() {
    const store =
        getSessionStore();

    let sessions =
        await store.getItem(SESSION_LIST_KEY);

    if (!Array.isArray(sessions)) {
        const legacy =
            await store.getItem(LEGACY_SESSION_KEY);

        if (legacy) {
            sessions = [{
                id: legacy.id || `legacy-${Date.now()}`,
                name: legacy.name || defaultSessionName(),
                ...legacy
            }];

            await store.setItem(
                SESSION_LIST_KEY,
                sessions
            );
        }
    }

    if (!Array.isArray(sessions))
        return [];

    return sessions
        .filter(Boolean)
        .sort(
            (a, b) =>
                new Date(b.savedAt || 0) -
                new Date(a.savedAt || 0)
        );
}

function openSaveSessionModal() {
    const modal =
        document.getElementById("saveSessionModal");

    const input =
        document.getElementById("saveSessionNameInput");

    if (!modal || !input)
        return;

    const suggestedName =
        defaultSessionName();

    input.value = suggestedName;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
        input.focus();
        input.select();
        input.setSelectionRange(0, input.value.length);
    });
}

function closeSaveSessionModal() {
    const modal =
        document.getElementById("saveSessionModal");

    if (!modal)
        return;

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
}

async function saveSession() {
    if (!imageLoaded || !image) {
        status.textContent =
            "Load an image before saving a session.";
        return;
    }

    openSaveSessionModal();
}

async function confirmSaveSession() {
    const input =
        document.getElementById("saveSessionNameInput");

    if (!input)
        return;

    const suggestedName =
        defaultSessionName();

    const name =
        (input.value || suggestedName).trim() || suggestedName;

    closeSaveSessionModal();

    const snapshot =
        getCurrentSessionSnapshot();

    const sessionEntry = {
        ...snapshot,
        id: `session-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name,
        savedAt: snapshot.savedAt || new Date().toISOString()
    };

    try {
        const sessions =
            await getAllSessions();

        sessions.unshift(sessionEntry);

        await getSessionStore().setItem(
            SESSION_LIST_KEY,
            sessions
        );

        status.textContent =
            `Saved session "${name}".`;
    } catch (error) {
        console.error("Failed to save session:", error);
        status.textContent =
            "Could not save the session.";
    }
}

function openSessionModal() {
    const modal =
        document.getElementById("sessionModal");

    if (!modal)
        return;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
}

function closeSessionModal() {
    const modal =
        document.getElementById("sessionModal");

    if (!modal)
        return;

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
}

async function renderSessionList() {
    const sessionList =
        document.getElementById("sessionList");

    if (!sessionList)
        return;

    const sessions =
        await getAllSessions();

    if (!sessions.length) {
        sessionList.innerHTML =
            '<div class="empty-sessions">No saved sessions yet.</div>';
        return;
    }

    sessionList.innerHTML =
        sessions.map(
            session => `
                <div class="session-item">
                    <div class="session-meta">
                        <span class="session-name">${session.name || "Unnamed session"}</span>
                        <span class="session-timestamp">${new Date(session.savedAt || Date.now()).toLocaleString()}</span>
                    </div>
                    <div class="session-actions">
                        <button class="session-load" type="button" data-action="load-session" data-id="${session.id}">Load</button>
                        <button class="session-delete" type="button" data-action="delete-session" data-id="${session.id}">Delete</button>
                    </div>
                </div>
            `
        ).join("");
}

async function loadSavedSession() {
    try {
        const sessions =
            await getAllSessions();

        if (!sessions.length) {
            status.textContent =
                "No saved sessions were found.";
            return;
        }

        await renderSessionList();
        openSessionModal();
    } catch (error) {
        console.error("Failed to load session list:", error);
        status.textContent =
            "Could not open the saved sessions list.";
    }
}

async function loadSessionById(id) {
    const sessions =
        await getAllSessions();

    const target =
        sessions.find(session => session.id === id);

    if (!target || !target.image || !target.image.dataUrl) {
        status.textContent =
            "The selected saved session could not be found.";
        return;
    }

    applySavedSession(target);
    closeSessionModal();
}

async function deleteSession(id) {
    const sessions =
        await getAllSessions();

    const remaining =
        sessions.filter(session => session.id !== id);

    await getSessionStore().setItem(
        SESSION_LIST_KEY,
        remaining
    );

    await renderSessionList();
    status.textContent =
        "Saved session deleted.";
}

function applySavedSession(snapshot) {
    const nextImage =
        new Image();

    nextImage.onload = () => {
        image = nextImage;
        imageLoaded = true;
        imageWidth = snapshot.image.width || nextImage.naturalWidth || imageWidth;
        imageHeight = snapshot.image.height || nextImage.naturalHeight || imageHeight;

        axis = snapshot.axis ? { ...snapshot.axis } : null;
        secondaryTip = snapshot.secondaryTip ? { ...snapshot.secondaryTip } : null;
        featherTips = Array.isArray(snapshot.featherTips)
            ? snapshot.featherTips.map(feather => ({ ...feather }))
            : [];
        measurements = Array.isArray(snapshot.measurements)
            ? snapshot.measurements.map(measurement => ({ ...measurement }))
            : [];
        currentMeasurement = snapshot.currentMeasurement
            ? { ...snapshot.currentMeasurement }
            : null;
        pendingFeather = snapshot.pendingFeather
            ? { ...snapshot.pendingFeather }
            : null;

        zoom = Number.isFinite(snapshot.zoom)
            ? clamp(snapshot.zoom, .05, 20)
            : 1;

        offsetX = Number.isFinite(snapshot.offsetX)
            ? snapshot.offsetX
            : 0;

        offsetY = Number.isFinite(snapshot.offsetY)
            ? snapshot.offsetY
            : 0;

        mode = snapshot.mode || "pan";

        updateMeasurements();
        updateZoomLabel();
        setMode(mode);
        draw();

        status.textContent =
            snapshot.savedAt
                ? `Loaded saved session "${snapshot.name || "Untitled"}" from ${new Date(snapshot.savedAt).toLocaleString()}.`
                : "Loaded saved session.";
    };

    nextImage.src = snapshot.image.dataUrl;
}

saveSessionBtn.addEventListener(
    "click",
    saveSession
);

loadSessionBtn.addEventListener(
    "click",
    loadSavedSession
);

document.addEventListener(
    "click",
    async event => {
        const target =
            event.target.closest("[data-action]");

        if (!target)
            return;

        const action =
            target.getAttribute("data-action");

        if (action === "close-save-session-modal") {
            closeSaveSessionModal();
            return;
        }

        if (action === "confirm-save-session") {
            await confirmSaveSession();
            return;
        }

        if (action === "close-session-modal") {
            closeSessionModal();
            return;
        }

        if (action === "load-session") {
            const sessionId =
                target.getAttribute("data-id");

            await loadSessionById(sessionId);
            return;
        }

        if (action === "delete-session") {
            const sessionId =
                target.getAttribute("data-id");

            if (sessionId) {
                const confirmed =
                    window.confirm(
                        "Delete this saved session?"
                    );

                if (confirmed) {
                    await deleteSession(sessionId);
                }
            }
        }
    }
);

// ============================================================
// Resize
// ============================================================

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();

    const dpr =
        window.devicePixelRatio || 1;

    canvas.width =
        Math.round(
            rect.width * dpr
        );

    canvas.height =
        Math.round(
            rect.height * dpr
        );

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    draw();
}

window.addEventListener(
    "resize",
    resizeCanvas
);

resizeCanvas();


// ============================================================
// Image loading
// ============================================================

fileInput.addEventListener(
    "change",
    event => {

        const file =
            event.target.files[0];

        if (!file)
            return;

        resetAnnotations();

        const url =
            URL.createObjectURL(file);

        image.onload =
            () => {

                imageLoaded =
                    true;

                imageWidth =
                    image.naturalWidth;

                imageHeight =
                    image.naturalHeight;

                fitImage();

                setMode("pan");
                setInstruction("imageLoaded");

                URL.revokeObjectURL(url);

                status.textContent =
                    `${imageWidth} × ${imageHeight}px`;
            };

        image.src =
            url;
    }
);


// ============================================================
// Coordinate conversion
// ============================================================

function screenToImage(
    x,
    y
) {

    return {

        x:
            (x - offsetX) /
            zoom,

        y:
            (y - offsetY) /
            zoom
    };
}


function imageToScreen(
    x,
    y
) {

    return {

        x:
            x * zoom +
            offsetX,

        y:
            y * zoom +
            offsetY
    };
}


// ============================================================
// Utility
// ============================================================

function clamp(
    value,
    min,
    max
) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );
}


function axisLength() {

    if (!axis)
        return 0;

    return Math.hypot(
        axis.x2 - axis.x1,
        axis.y2 - axis.y1
    );
}


// ============================================================
// Project arbitrary point onto axis
// ============================================================

function projectOntoAxis(
    point
) {

    if (!axis)
        return null;

    const vx =
        axis.x2 -
        axis.x1;

    const vy =
        axis.y2 -
        axis.y1;

    const len2 =
        vx * vx +
        vy * vy;

    if (len2 === 0)
        return null;

    const rawT =
        (
            (point.x - axis.x1) * vx +
            (point.y - axis.y1) * vy
        ) / len2;


    /*
        Keep projection on the actual
        primary axis.
    */

    const t =
        clamp(
            rawT,
            0,
            1
        );


    return {

        t,

        point: {

            x:
                axis.x1 +
                vx * t,

            y:
                axis.y1 +
                vy * t
        }
    };
}


// ============================================================
// Point on axis
// ============================================================

function pointOnAxis(
    t
) {

    return {

        x:
            axis.x1 +
            (
                axis.x2 -
                axis.x1
            ) * t,

        y:
            axis.y1 +
            (
                axis.y2 -
                axis.y1
            ) * t
    };
}


// ============================================================
// Perpendicular guide
// ============================================================

function perpendicularGuide(
    point
) {

    if (!axis)
        return null;

    const dx =
        axis.x2 -
        axis.x1;

    const dy =
        axis.y2 -
        axis.y1;

    const len =
        Math.hypot(
            dx,
            dy
        );

    if (len === 0)
        return null;


    const nx =
        -dy / len;

    const ny =
        dx / len;


    /*
        Total perpendicular guide length
        = 1/2 of primary axis length.

        Therefore each side:
        1/4 of axis length.
    */

    const halfGuide =
        len / 4;


    return {

        x1:
            point.x +
            nx * halfGuide,

        y1:
            point.y +
            ny * halfGuide,

        x2:
            point.x -
            nx * halfGuide,

        y2:
            point.y -
            ny * halfGuide
    };
}


// ============================================================
// Draw everything
// ============================================================

function draw() {

    const rect =
        canvas.getBoundingClientRect();

    ctx.clearRect(
        0,
        0,
        rect.width,
        rect.height
    );


    if (!imageLoaded)
        return;


    drawImage();

    /*
        Guides are intentionally drawn first.
    */

    drawAlignmentGuides();

    drawAxis();

    drawSecondaryTip();

    drawFeatherTips();

    drawMeasurements();

    drawCurrentMeasurement();
}


// ============================================================
// Image
// ============================================================

function drawImage() {

    ctx.save();

    ctx.translate(
        offsetX,
        offsetY
    );

    ctx.scale(
        zoom,
        zoom
    );

    ctx.drawImage(
        image,
        0,
        0
    );

    ctx.restore();
}


// ============================================================
// Alignment guides
// ============================================================

function drawAlignmentGuides() {

    if (!axis)
        return;


    /*
        Axis Start
    */

    drawPerpendicularGuide(
        {
            x: axis.x1,
            y: axis.y1
        },
        "#ff7777"
    );


    /*
        Axis End
    */

    drawPerpendicularGuide(
        {
            x: axis.x2,
            y: axis.y2
        },
        "#ff7777"
    );


    /*
        Secondary Tip.
    */

    if (secondaryTip) {

        drawPerpendicularGuide(
            secondaryTip,
            "#ffffff"
        );
    }
}


function drawPerpendicularGuide(
    point,
    color
) {

    const guide =
        perpendicularGuide(
            point
        );

    if (!guide)
        return;


    const a =
        imageToScreen(
            guide.x1,
            guide.y1
        );

    const b =
        imageToScreen(
            guide.x2,
            guide.y2
        );


    ctx.save();

    ctx.strokeStyle =
        color;

    ctx.globalAlpha =
        .65;

    ctx.lineWidth =
        1.5;

    ctx.setLineDash([
        5,
        5
    ]);

    ctx.beginPath();

    ctx.moveTo(
        a.x,
        a.y
    );

    ctx.lineTo(
        b.x,
        b.y
    );

    ctx.stroke();

    ctx.restore();
}


// ============================================================
// Primary axis
// ============================================================

function drawAxis() {

    if (!axis)
        return;


    const a =
        imageToScreen(
            axis.x1,
            axis.y1
        );

    const b =
        imageToScreen(
            axis.x2,
            axis.y2
        );


    ctx.save();

    ctx.strokeStyle =
        "#ff4d4d";

    ctx.lineWidth =
        2.5;

    ctx.setLineDash([]);

    ctx.beginPath();

    ctx.moveTo(
        a.x,
        a.y
    );

    ctx.lineTo(
        b.x,
        b.y
    );

    ctx.stroke();


    drawArrow(
        a,
        b,
        "#ff4d4d"
    );


    drawHandle(
        a.x,
        a.y,
        "#ff4d4d",
        7
    );


    drawHandle(
        b.x,
        b.y,
        "#ff4d4d",
        7
    );


    ctx.restore();
}


// ============================================================
// Secondary Tip
// ============================================================

function drawSecondaryTip() {

    if (!secondaryTip)
        return;


    const screen =
        imageToScreen(
            secondaryTip.x,
            secondaryTip.y
        );


    /*
        Actual Secondary Tip point.
    */

    ctx.save();

    ctx.fillStyle =
        "rgba(255,255,255,.2)";

    ctx.strokeStyle =
        "#ffffff";

    ctx.lineWidth =
        2;


    ctx.beginPath();

    ctx.arc(
        screen.x,
        screen.y,
        11,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.stroke();


    /*
        Crosshair.
    */

    ctx.beginPath();

    ctx.moveTo(
        screen.x - 14,
        screen.y
    );

    ctx.lineTo(
        screen.x + 14,
        screen.y
    );

    ctx.moveTo(
        screen.x,
        screen.y - 14
    );

    ctx.lineTo(
        screen.x,
        screen.y + 14
    );

    ctx.stroke();


    drawLabel(
        screen.x + 16,
        screen.y - 10,
        "Secondary Tip",
        "#ffffff"
    );


    /*
        Projected point on the primary axis.
    */

    if (axis) {

        const projection =
            projectOntoAxis(
                secondaryTip
            );


        if (projection) {

            const projected =
                imageToScreen(
                    projection.point.x,
                    projection.point.y
                );


            drawHandle(
                projected.x,
                projected.y,
                "#ffffff",
                4
            );
        }
    }


    ctx.restore();
}


// ============================================================
// Feather tips
// ============================================================

function drawFeatherTips() {

    const drawOne =
        feather => {

            const actual =
                imageToScreen(
                    feather.x,
                    feather.y
                );


            /*
                Project feather tip to axis.
            */

            if (axis) {

                const projection =
                    projectOntoAxis(
                        feather
                    );


                if (projection) {

                    const projected =
                        imageToScreen(
                            projection.point.x,
                            projection.point.y
                        );


                    ctx.save();

                    ctx.strokeStyle =
                        "#50beff";

                    ctx.globalAlpha =
                        .9;

                    ctx.lineWidth =
                        1.5;

                    ctx.setLineDash([
                        4,
                        5
                    ]);

                    ctx.beginPath();

                    ctx.moveTo(
                        actual.x,
                        actual.y
                    );

                    ctx.lineTo(
                        projected.x,
                        projected.y
                    );

                    ctx.stroke();

                    ctx.restore();


                    drawHandle(
                        projected.x,
                        projected.y,
                        "#50beff",
                        4
                    );
                }
            }


            /*
                Actual feather tip.
            */

            drawHandle(
                actual.x,
                actual.y,
                "#50beff",
                7
            );


            drawLabel(
                actual.x + 10,
                actual.y - 8,
                feather.label,
                "#50beff"
            );
        };

    featherTips.forEach(
        drawOne
    );

    if (pendingFeather) {
        drawOne(pendingFeather);
    }
}


// ============================================================
// Generic measurements
// ============================================================

function drawMeasurements() {

    measurements.forEach(
        (measurement, index) => {

            const a =
                imageToScreen(
                    measurement.x1,
                    measurement.y1
                );

            const b =
                imageToScreen(
                    measurement.x2,
                    measurement.y2
                );


            ctx.save();

            ctx.strokeStyle =
                "#ffe066";

            ctx.lineWidth =
                2;

            ctx.setLineDash([]);

            ctx.beginPath();

            ctx.moveTo(
                a.x,
                a.y
            );

            ctx.lineTo(
                b.x,
                b.y
            );

            ctx.stroke();


            drawHandle(
                a.x,
                a.y,
                "#ffe066"
            );

            drawHandle(
                b.x,
                b.y,
                "#ffe066"
            );


            const length =
                Math.hypot(
                    measurement.x2 -
                    measurement.x1,

                    measurement.y2 -
                    measurement.y1
                );


            const midX =
                (a.x + b.x) / 2;

            const midY =
                (a.y + b.y) / 2;

            const label =
                `M${index + 1}: ${length.toFixed(1)} px`;

            drawLabel(
                midX,
                midY - 8,
                label,
                "#ffe066"
            );


            ctx.restore();
        }
    );
}


function drawCurrentMeasurement() {

    if (!currentMeasurement)
        return;


    const a =
        imageToScreen(
            currentMeasurement.x1,
            currentMeasurement.y1
        );

    const b =
        imageToScreen(
            currentMeasurement.x2,
            currentMeasurement.y2
        );


    ctx.save();

    ctx.strokeStyle =
        "#ffe066";

    ctx.lineWidth =
        2;

    ctx.setLineDash([
        5,
        4
    ]);

    ctx.beginPath();

    ctx.moveTo(
        a.x,
        a.y
    );

    ctx.lineTo(
        b.x,
        b.y
    );

    ctx.stroke();

    ctx.restore();
}


// ============================================================
// Drawing helpers
// ============================================================

function drawHandle(
    x,
    y,
    color,
    radius = 5
) {

    ctx.save();

    ctx.fillStyle =
        color;

    ctx.strokeStyle =
        "#fff";

    ctx.lineWidth =
        1.5;

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.stroke();

    ctx.restore();
}


function drawArrow(
    a,
    b,
    color
) {

    const angle =
        Math.atan2(
            b.y - a.y,
            b.x - a.x
        );

    const size =
        10;


    ctx.save();

    ctx.fillStyle =
        color;

    ctx.beginPath();

    ctx.moveTo(
        b.x,
        b.y
    );

    ctx.lineTo(
        b.x -
        Math.cos(
            angle - Math.PI / 6
        ) * size,

        b.y -
        Math.sin(
            angle - Math.PI / 6
        ) * size
    );

    ctx.lineTo(
        b.x -
        Math.cos(
            angle + Math.PI / 6
        ) * size,

        b.y -
        Math.sin(
            angle + Math.PI / 6
        ) * size
    );

    ctx.closePath();

    ctx.fill();

    ctx.restore();
}


function drawLabel(
    x,
    y,
    text,
    color
) {

    ctx.save();

    ctx.font =
        "12px Arial";


    const width =
        ctx.measureText(
            text
        ).width + 8;


    ctx.fillStyle =
        "rgba(0,0,0,.78)";

    ctx.fillRect(
        x - 3,
        y - 12,
        width,
        17
    );


    ctx.fillStyle =
        color;

    ctx.fillText(
        text,
        x + 1,
        y
    );


    ctx.restore();
}


// ============================================================
// Mode switching
// ============================================================

function setMode(
    newMode
) {

    mode =
        newMode;


    [
        panBtn,
        axisBtn,
        pointBtn,
        measureBtn
    ].forEach(
        button => {

            button.classList.remove("current");
        }
    );


    if (mode === "pan")
        panBtn.classList.add("current");


    if (mode === "axis")
        axisBtn.classList.add("current");


    if (mode === "points")
        pointBtn.classList.add("current");


    if (mode === "measure")
        measureBtn.classList.add("current");

    updateWorkflowHighlight();


    if (mode === "points") {

        setInstruction("featherTipsActive");

        if (
            featherTips.length >= 6
        ) {

            status.textContent =
                "P8–P3 are already plotted.";

        } else {

            status.textContent =
                `Feather Tips: click to place P${nextAvailableFeatherNumber()}.`;
        }
    }


    if (mode === "axis") {

        setInstruction("axis");

        if (axis) {

                status.textContent =
                    "Drag axis handles. Use Reset to start over.";

        } else {

            status.textContent =
                "Click and drag to draw the Primary Projection axis.";
        }
    }


    if (mode === "pan") {

        if (!imageLoaded)
            setInstruction("launch");
        else if (axis && featherTips.length >= 6)
            setInstruction("complete");
        else if (axis)
            setInstruction("featherTipsReady");

        status.textContent =
            "Pan mode";
    }


    if (mode === "measure") {

        status.textContent =
            "Click and drag to create a measurement.";
    }
}


function setInstruction(
    message
) {
    instructionBody.textContent =
        instructionMessages[message];
}


// ============================================================
// Buttons
// ============================================================

panBtn.onclick =
    () => {

        setMode(
            "pan"
        );
    };


axisBtn.onclick =
    () => {

        setMode(
            "axis"
        );
    };


pointBtn.onclick =
    () => {

        setMode(
            "points"
        );
    };


measureBtn.onclick =
    () => {

        setMode(
            "measure"
        );
    };


// ============================================================
// Feather numbering
// ============================================================

function nextAvailableFeatherNumber() {

    /*
        US convention:
        Primary tips are selected from P8 inward/downward:
        P8, P7, P6, P5, P4, P3.
    */

    return 8 - featherTips.length;
}


function renumberFeathers() {

    featherTips.forEach(
        (feather, index) => {

            feather.label =
                `P${8 - index}`;
        }
    );
}


// ============================================================
// Hit testing
// ============================================================

function findFeatherAt(
    sx,
    sy
) {

    const radius =
        16;


    for (
        let i =
            featherTips.length - 1;

        i >= 0;

        i--
    ) {

        const screen =
            imageToScreen(
                featherTips[i].x,
                featherTips[i].y
            );


        if (
            Math.hypot(
                screen.x - sx,
                screen.y - sy
            ) <= radius
        ) {

            return i;
        }
    }


    return null;
}


function distanceToSegment(
    px,
    py,
    x1,
    y1,
    x2,
    y2
) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0)
        return Math.hypot(px - x1, py - y1);

    const t = clamp(
        ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy),
        0,
        1
    );

    const cx = x1 + dx * t;
    const cy = y1 + dy * t;

    return Math.hypot(px - cx, py - cy);
}


function findDraggableObject(
    sx,
    sy
) {

    /*
        Feather tips get highest priority.
    */

    const featherIndex =
        findFeatherAt(
            sx,
            sy
        );


    if (
        featherIndex !== null
    ) {

        return {

            type:
                "feather",

            index:
                featherIndex
        };
    }


    if (!axis)
        return null;


    const start =
        imageToScreen(
            axis.x1,
            axis.y1
        );

    const end =
        imageToScreen(
            axis.x2,
            axis.y2
        );

    /*
        Endpoint handles should always win.
    */

    if (
        Math.hypot(
            start.x - sx,
            start.y - sy
        ) <= 15
    ) {

        return {

            type:
                "axisStart"
        };
    }


    if (
        Math.hypot(
            end.x - sx,
            end.y - sy
        ) <= 15
    ) {

        return {

            type:
                "axisEnd"
        };
    }


    const axisDistance =
        distanceToSegment(
            sx,
            sy,
            start.x,
            start.y,
            end.x,
            end.y
        );

    if (
        axisDistance <= 14
    ) {

        return {

            type:
                "axisLine"
        };
    }


    for (
        let i =
            measurements.length - 1;

        i >= 0;

        i--
    ) {

        const measurement =
            measurements[i];

        const start =
            imageToScreen(
                measurement.x1,
                measurement.y1
            );

        const end =
            imageToScreen(
                measurement.x2,
                measurement.y2
            );

        if (
            Math.hypot(
                start.x - sx,
                start.y - sy
            ) <= 15
        ) {

            return {

                type:
                    "measurementStart",

                index:
                    i
            };
        }

        if (
            Math.hypot(
                end.x - sx,
                end.y - sy
            ) <= 15
        ) {

            return {

                type:
                    "measurementEnd",

                index:
                    i
            };
        }

        const measurementDistance =
            distanceToSegment(
                sx,
                sy,
                start.x,
                start.y,
                end.x,
                end.y
            );

        if (
            measurementDistance <= 14
        ) {

            return {

                type:
                    "measurementLine",

                index:
                    i
            };
        }
    }


    return null;
}


// ============================================================
// Touch / Pointer gesture helpers
// ============================================================

function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function beginPinch() {
    const pts = Array.from(activePointers.values());
    if (pts.length < 2) return;

    const a = pts[0];
    const b = pts[1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 2) return;

    pinchStartDistance = distance;
    pinchStartZoom = zoom;
    pinchStartMidpoint = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
    };
    pinchImagePoint = screenToImage(
        pinchStartMidpoint.x,
        pinchStartMidpoint.y
    );
    isPinching = true;
    dragging = false;
    dragObject = null;
    canvas.classList.remove("dragging");
}

function updatePinch() {
    if (!isPinching || activePointers.size < 2) return;

    const pts = Array.from(activePointers.values());
    const a = pts[0];
    const b = pts[1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 2 || pinchStartDistance < 2) return;

    const midpoint = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
    };

    const newZoom = clamp(
        pinchStartZoom * (distance / pinchStartDistance),
        0.1,
        8
    );

    zoom = newZoom;

    // Keep the image point under the fingers anchored while zooming,
    // and move the canvas with the midpoint for natural two-finger pan.
    const projected = imageToScreen(
        pinchImagePoint.x,
        pinchImagePoint.y
    );
    offsetX += midpoint.x - projected.x;
    offsetY += midpoint.y - projected.y;

    pinchStartMidpoint = midpoint;
    updateZoomLabel();
    draw();
}

// ============================================================
// Pointer Down
// ============================================================

canvas.addEventListener(
    "pointerdown",
    event => {

        if (!imageLoaded)
            return;

        const pos = pointerPosition(event);
        activePointers.set(event.pointerId, pos);

        // A second finger switches immediately to canvas pinch/pan.
        if (event.pointerType === "touch" && activePointers.size >= 2) {
            beginPinch();
            return;
        }

        canvas.setPointerCapture(event.pointerId);


        const rect =
            canvas.getBoundingClientRect();


        const sx =
            event.clientX -
            rect.left;

        const sy =
            event.clientY -
            rect.top;


        const point =
            screenToImage(
                sx,
                sy
            );


        /*
            Existing annotation handles always
            have priority over mode actions.
        */

        const hit =
            findDraggableObject(
                sx,
                sy
            );


        if (hit) {

            dragObject =
                hit;

            if (
                hit.type ===
                "axisLine"
            ) {

                dragObject.initialAxis = {
                    x1: axis.x1,
                    y1: axis.y1,
                    x2: axis.x2,
                    y2: axis.y2
                };

                dragObject.startPoint = {
                    x: point.x,
                    y: point.y
                };
            }

            if (
                hit.type ===
                "measurementLine"
            ) {

                dragObject.initialMeasurement = {
                    x1: measurements[hit.index].x1,
                    y1: measurements[hit.index].y1,
                    x2: measurements[hit.index].x2,
                    y2: measurements[hit.index].y2
                };

                dragObject.startPoint = {
                    x: point.x,
                    y: point.y
                };
            }

            dragging =
                true;

            return;
        }


        // ====================================================
        // FEATHER TIPS
        // ====================================================

        if (
            mode === "points"
        ) {

            if (
                featherTips.length >= 6
            ) {

                status.textContent =
                    "Maximum reached: P8–P3 only.";

                return;
            }


            const number =
                nextAvailableFeatherNumber();

            pendingFeather = {

                id:
                    (
                        crypto.randomUUID
                            ? crypto.randomUUID()
                            : String(
                                Date.now() +
                                Math.random()
                            )
                    ),

                label:
                    `P${number}`,

                x:
                    point.x,

                y:
                    point.y
            };

            dragObject = {
                type:
                    "pendingFeather"
            };

            dragging =
                true;

            draw();

            status.textContent =
                `Position P${number} and release to place it.`;

            return;
        }


        // ====================================================
        // AXIS CREATION
        // ====================================================

        if (
            mode === "axis"
        ) {

            axis = {

                x1:
                    point.x,

                y1:
                    point.y,

                x2:
                    point.x,

                y2:
                    point.y
            };


            dragging =
                true;

            draw();

            return;
        }


        // ====================================================
        // MEASURE
        // ====================================================

        if (
            mode === "measure"
        ) {

            currentMeasurement = {

                x1:
                    point.x,

                y1:
                    point.y,

                x2:
                    point.x,

                y2:
                    point.y
            };


            dragging =
                true;

            draw();

            return;
        }


        // ====================================================
        // PAN
        // ====================================================

        if (
            mode === "pan"
        ) {

            dragging =
                true;

            panStart = {

                x:
                    event.clientX,

                y:
                    event.clientY
            };

            panOrigin = {

                x:
                    offsetX,

                y:
                    offsetY
            };

            canvas.classList.add(
                "dragging"
            );
        }

    }
);


// ============================================================
// Mouse Move
// ============================================================

canvas.addEventListener(
    "pointermove",
    event => {

        if (activePointers.has(event.pointerId)) {
            activePointers.set(event.pointerId, pointerPosition(event));
        }

        if (isPinching) {
            updatePinch();
            return;
        }

        if (!dragging)
            return;


        const rect =
            canvas.getBoundingClientRect();


        const sx =
            event.clientX -
            rect.left;

        const sy =
            event.clientY -
            rect.top;


        const point =
            screenToImage(
                sx,
                sy
            );


        /*
            Existing object.
        */

        if (dragObject) {

            updateDraggedObject(
                point
            );

            updateMeasurements();

            draw();

            return;
        }


        /*
            New axis.
        */

        if (
            mode === "axis" &&
            axis &&
            !secondaryTip
        ) {

            /*
                Only allow creation drag if this is
                actually the initial axis creation.

                Once the axis exists, normal mouse moves
                should not change it.
            */

            axis.x2 =
                point.x;

            axis.y2 =
                point.y;

            draw();

            return;
        }


        /*
            Generic measurement.
        */

        if (
            dragObject &&
            dragObject.type ===
            "pendingFeather"
        ) {

            pendingFeather.x =
                point.x;

            pendingFeather.y =
                point.y;

            draw();

            return;
        }


        if (
            mode === "measure" &&
            currentMeasurement
        ) {

            currentMeasurement.x2 =
                point.x;

            currentMeasurement.y2 =
                point.y;

            draw();

            return;
        }


        /*
            Pan.
        */

        if (
            mode === "pan"
        ) {

            offsetX =
                panOrigin.x +
                (
                    event.clientX -
                    panStart.x
                );

            offsetY =
                panOrigin.y +
                (
                    event.clientY -
                    panStart.y
                );

            draw();
        }

    }
);


// ============================================================
// Mouse Up
// ============================================================

canvas.addEventListener(
    "pointerup",
    finishMouseAction
);

canvas.addEventListener(
    "pointercancel",
    finishMouseAction
);


function finishMouseAction(event) {

    if (event) {
        activePointers.delete(event.pointerId);
    }

    // End the gesture when fewer than two touches remain. Do not let
    // pointerup from a pinch accidentally create an annotation.
    if (isPinching) {
        if (activePointers.size < 2) {
            isPinching = false;
            pinchStartDistance = 0;
            pinchImagePoint = null;
        }
        if (event && canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        draw();
        return;
    }

    if (!dragging)
        return;

    if (event && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
    }


    dragging =
        false;


    canvas.classList.remove(
        "dragging"
    );


    if (
        mode === "axis" &&
        axis &&
        !dragObject &&
        axisLength() <= 2
    ) {

        axis =
            null;

        updateMeasurements();
        draw();

        status.textContent =
            "Click and drag to draw the Primary Projection axis.";

        return;
    }


    if (
        mode === "axis" &&
        axis &&
        !dragObject &&
        axisLength() > 2
    ) {

        setMode("pan");

        status.textContent =
            "Pan mode";

        draw();

        return;
    }


    /*
        Finish generic measurement.
    */

    if (
        dragObject &&
        dragObject.type ===
        "pendingFeather"
    ) {

        featherTips.push(
            pendingFeather
        );

        pendingFeather =
            null;

        updateMeasurements();

        status.textContent =
            `Added P${featherTips[featherTips.length - 1].label.slice(1)}. Drag the blue marker to adjust it.`;

        if (featherTips.length >= 6) {
            setMode("pan");
            status.textContent =
                "P3 placed. Pan mode.";
        }
    }


    if (
        mode === "measure" &&
        currentMeasurement
    ) {

        const length =
            Math.hypot(
                currentMeasurement.x2 -
                currentMeasurement.x1,

                currentMeasurement.y2 -
                currentMeasurement.y1
            );


        if (
            length > 2
        ) {

            measurements.push(
                currentMeasurement
            );

            currentMeasurement =
                null;

            updateMeasurements();

            setMode("pan");
        } else {

            currentMeasurement =
                null;

            updateMeasurements();
        }
    }


    dragObject =
        null;


    draw();
}


// ============================================================
// Drag existing object
// ============================================================

function updateDraggedObject(
    point
) {

    if (!dragObject)
        return;


    /*
        Pending feather placement.
    */

    if (
        dragObject.type ===
        "pendingFeather"
    ) {

        if (!pendingFeather)
            return;

        pendingFeather.x =
            point.x;

        pendingFeather.y =
            point.y;

        return;
    }


    /*
        Feather.
    */

    if (
        dragObject.type ===
        "feather"
    ) {

        const feather =
            featherTips[
                dragObject.index
            ];


        if (!feather)
            return;


        feather.x =
            point.x;

        feather.y =
            point.y;

        return;
    }


    /*
        Axis line.
    */

    if (
        dragObject.type ===
        "axisLine"
    ) {

        const dx =
            point.x -
            dragObject.startPoint.x;

        const dy =
            point.y -
            dragObject.startPoint.y;

        axis.x1 =
            dragObject.initialAxis.x1 +
            dx;

        axis.y1 =
            dragObject.initialAxis.y1 +
            dy;

        axis.x2 =
            dragObject.initialAxis.x2 +
            dx;

        axis.y2 =
            dragObject.initialAxis.y2 +
            dy;

        return;
    }


    /*
        Axis start.
    */

    if (
        dragObject.type ===
        "axisStart"
    ) {

        axis.x1 =
            point.x;

        axis.y1 =
            point.y;

        return;
    }


    /*
        Axis end.
    */

    if (
        dragObject.type ===
        "axisEnd"
    ) {

        axis.x2 =
            point.x;

        axis.y2 =
            point.y;

        return;
    }


    /*
        Generic measurement line.
    */

    if (
        dragObject.type ===
        "measurementLine"
    ) {

        const measurement =
            measurements[
                dragObject.index
            ];

        if (!measurement)
            return;

        const dx =
            point.x -
            dragObject.startPoint.x;

        const dy =
            point.y -
            dragObject.startPoint.y;

        measurement.x1 =
            dragObject.initialMeasurement.x1 +
            dx;

        measurement.y1 =
            dragObject.initialMeasurement.y1 +
            dy;

        measurement.x2 =
            dragObject.initialMeasurement.x2 +
            dx;

        measurement.y2 =
            dragObject.initialMeasurement.y2 +
            dy;

        return;
    }


    /*
        Generic measurement start.
    */

    if (
        dragObject.type ===
        "measurementStart"
    ) {

        const measurement =
            measurements[
                dragObject.index
            ];

        if (!measurement)
            return;

        measurement.x1 =
            point.x;

        measurement.y1 =
            point.y;

        return;
    }


    /*
        Generic measurement end.
    */

    if (
        dragObject.type ===
        "measurementEnd"
    ) {

        const measurement =
            measurements[
                dragObject.index
            ];

        if (!measurement)
            return;

        measurement.x2 =
            point.x;

        measurement.y2 =
            point.y;

        return;
    }
}


// ============================================================
// Zoom
// ============================================================

canvas.addEventListener(
    "wheel",
    event => {

        if (!imageLoaded)
            return;


        event.preventDefault();


        const rect =
            canvas.getBoundingClientRect();


        const mouseX =
            event.clientX -
            rect.left;

        const mouseY =
            event.clientY -
            rect.top;


        const before =
            screenToImage(
                mouseX,
                mouseY
            );


        const factor =
            event.deltaY < 0
                ? 1.15
                : 1 / 1.15;


        zoom =
            clamp(
                zoom * factor,
                .1,
                8
            );


        const after =
            imageToScreen(
                before.x,
                before.y
            );


        offsetX +=
            mouseX -
            after.x;

        offsetY +=
            mouseY -
            after.y;


        updateZoomLabel();

        draw();

    },
    {
        passive: false
    }
);


function setZoom(
    newZoom
) {

    const rect =
        canvas.getBoundingClientRect();


    const cx =
        rect.width / 2;

    const cy =
        rect.height / 2;


    const before =
        screenToImage(
            cx,
            cy
        );


    zoom =
        clamp(
            newZoom,
            .05,
            20
        );


    const after =
        imageToScreen(
            before.x,
            before.y
        );


    offsetX +=
        cx -
        after.x;

    offsetY +=
        cy -
        after.y;


    updateZoomLabel();

    draw();
}


document.getElementById(
    "zoomIn"
).onclick =
    () => {

        setZoom(
            zoom * 1.25
        );
    };


document.getElementById(
    "zoomOut"
).onclick =
    () => {

        setZoom(
            zoom / 1.25
        );
    };


function updateZoomLabel() {

    zoomLabel.textContent =
        `${Math.round(zoom * 100)}%`;
}


// ============================================================
// Fit
// ============================================================

function fitImage() {

    if (!imageLoaded)
        return;


    const rect =
        canvas.getBoundingClientRect();


    const scaleX =
        rect.width /
        imageWidth;

    const scaleY =
        rect.height /
        imageHeight;


    zoom =
        Math.min(
            scaleX,
            scaleY
        ) * .9;


    offsetX =
        (
            rect.width -
            imageWidth * zoom
        ) / 2;


    offsetY =
        (
            rect.height -
            imageHeight * zoom
        ) / 2;


    updateZoomLabel();

    draw();
}


document.getElementById(
    "fitBtn"
).onclick =
    fitImage;


// ============================================================
// Measurement calculations
// ============================================================

function updateMeasurements() {

    let html = "";


    // --------------------------------------------------------
    // Primary projection
    // --------------------------------------------------------

    if (axis) {

        const fullAxis =
            axisLength();


        html += `

            <div class="section">

                <div class="measurement">

                    <strong>
                        Primary Projection
                    </strong>

                    <br><br>

                    Full axis:
                    <strong>
                        ${fullAxis.toFixed(2)} px
                    </strong>

                </div>

        `;


        html += `
            </div>
        `;
    }


    // --------------------------------------------------------
    // Feather spacing
    // --------------------------------------------------------

    if (
        axis &&
        featherTips.length >= 2
    ) {

        const projectedFeathers =
            featherTips
                .map(
                    feather => {

                        const projection =
                            projectOntoAxis(
                                feather
                            );


                        return {

                            feather,

                            t:
                                projection
                                    ? projection.t
                                    : null
                        };
                    }
                )
                .filter(
                    item =>
                        item.t !== null
                )
                .sort(
                    (a, b) =>
                        a.t -
                        b.t
                );


        if (
            projectedFeathers.length >= 2
        ) {

            html += `

                <div class="section">

                    <strong>
                        Projected Feather Spacing
                    </strong>

                    <div class="small">

                        Spacing is measured along
                        the primary axis.

                        <br>

                        Perpendicular distance from
                        the feather tip is ignored.

                    </div>

            `;


            for (
                let i = 1;
                i < projectedFeathers.length;
                i++
            ) {

                const previous =
                    projectedFeathers[
                        i - 1
                    ];

                const current =
                    projectedFeathers[
                        i
                    ];


                const spacing =
                    Math.abs(
                        current.t -
                        previous.t
                    ) *
                    axisLength();


                html += `

                    <div class="measurement">

                        <strong>

                            ${previous.feather.label}
                            →
                            ${current.feather.label}

                        </strong>

                        <button
                            class="delete"
                            onclick="deleteFeather('${current.feather.id}')">

                            ×

                        </button>

                        <br>

                        Spacing:
                        <strong>
                            ${spacing.toFixed(2)} px
                        </strong>

                    </div>

                `;
            }

            // ----------------------------------------------------
            // P7-P6 / P6-P5 ratio
            // ----------------------------------------------------

            const p7 = projectedFeathers.find(
                item => item.feather.label === "P7"
            );

            const p6 = projectedFeathers.find(
                item => item.feather.label === "P6"
            );

            const p5 = projectedFeathers.find(
                item => item.feather.label === "P5"
            );

            if (p7 && p6 && p5) {

                const gapP7P6 =
                    Math.abs(p7.t - p6.t) * axisLength();

                const gapP6P5 =
                    Math.abs(p6.t - p5.t) * axisLength();

                const ratio =
                    gapP6P5 > 0
                        ?  gapP6P5 / gapP7P6
                        : null;

                if (ratio !== null) {
                    html += `

                        <div class="measurement">

                            P6–P5 / P7–P6 ratio:
                            <strong>
                                ${ratio.toFixed(4)}
                            </strong>

                        </div>

                    `;
                }
            }
            
            html += `
                </div>
            `;
        }
    }


    // --------------------------------------------------------
    // Generic measurements
    // --------------------------------------------------------

    if (
        measurements.length
    ) {

        html += `

            <div class="section">

                <strong>
                    Other Measurements
                </strong>

            </div>

        `;


        measurements.forEach(
            (
                measurement,
                index
            ) => {

                const length =
                    Math.hypot(
                        measurement.x2 -
                        measurement.x1,

                        measurement.y2 -
                        measurement.y1
                    );


                html += `

                    <div class="measurement">

                        Measurement ${index + 1}

                        <button
                            class="delete"
                            onclick="deleteMeasurement(${index})">

                            ×

                        </button>

                        <br>

                        ${length.toFixed(2)} px

                    </div>

                `;
            }
        );
    }


    if (!html) {

        html = `

            <div class="info">

                Open an image and Draw a Primary Projection
                axis to begin.

            </div>

        `;
    }


    measurementsDiv.innerHTML =
        html;
}


// ============================================================
// Delete feather
// ============================================================

window.deleteFeather =
    function(id) {

        featherTips =
            featherTips.filter(
                feather =>
                    feather.id !== id
            );


        /*
            Collapse the labels so they always
            remain sequential in US order, P8–P3.

            Example:

            P8 P7 P6 P5 P4
                 ↓ delete P6
            P8 P7 P6 P5

            The physical points remain in place.
        */

        renumberFeathers();


        updateMeasurements();

        draw();
    };


// ============================================================
// Delete generic measurement
// ============================================================

window.deleteMeasurement =
    function(index) {

        measurements.splice(
            index,
            1
        );


        updateMeasurements();

        draw();
    };


// ============================================================
// Reset
// ============================================================

function resetAnnotations() {
    axis =
        null;

    secondaryTip =
        null;

    featherTips =
        [];

    measurements =
        [];

    currentMeasurement =
        null;

    updateMeasurements();
    draw();
}

document.getElementById(
    "resetBtn"
).onclick =
    () => {

        resetAnnotations();


        fitImage();

        setMode("pan");
        setInstruction("imageLoaded");

    };


// ============================================================
// Keyboard shortcuts
// ============================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            dragging =
                false;

            dragObject =
                null;

            currentMeasurement =
                null;

            draw();
        }


        if (
            event.key === "1"
        )
            setMode("pan");


        if (
            event.key === "2"
        )
            setMode("axis");


        if (
            event.key === "3"
        )
            setMode("points");


        if (
            event.key === "4"
        )
            setMode("measure");

    }
);


function updateWorkflowHighlight() {
    [openImageBtn, axisBtn, pointBtn].forEach(
        button => button.classList.remove("suggested")
    );

    if (!imageLoaded) {
        openImageBtn.classList.add("suggested");
    } else if (!axis && mode !== "axis") {
        axisBtn.classList.add("suggested");
    } else if (axis && mode === "pan" && featherTips.length < 6) {
        pointBtn.classList.add("suggested");
    }
}


instructionsToggle.addEventListener(
    "click",
    () => {
        const isExpanded =
            instructionsToggle.getAttribute("aria-expanded") === "true";

        instructionsToggle.setAttribute(
            "aria-expanded",
            String(!isExpanded)
        );

        instructions.classList.toggle(
            "collapsed",
            isExpanded
        );

        instructionBody.classList.toggle(
            "hidden",
            isExpanded
        );

        instructionsToggle.textContent =
            isExpanded ? "Expand Help" : "Collapse";
    }
);

function syncMeasurementsPanelState() {
    const shouldCollapse =
        window.matchMedia("(max-width: 700px)").matches;

    sidebar.classList.toggle(
        "collapsed",
        shouldCollapse
    );

    measurementsToggle.setAttribute(
        "aria-expanded",
        String(!shouldCollapse)
    );

    measurementsToggle.textContent =
        shouldCollapse ? "Expand" : "Collapse";
}

measurementsToggle.addEventListener(
    "click",
    () => {
        const isExpanded =
            measurementsToggle.getAttribute("aria-expanded") === "true";

        measurementsToggle.setAttribute(
            "aria-expanded",
            String(!isExpanded)
        );

        sidebar.classList.toggle(
            "collapsed",
            isExpanded
        );

        measurementsToggle.textContent =
            isExpanded ? "Expand" : "Collapse";
    }
);

window.addEventListener(
    "resize",
    syncMeasurementsPanelState
);

syncMeasurementsPanelState();

updateWorkflowHighlight();
