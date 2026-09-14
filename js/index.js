"use strict";

let species = [];
let questionOrder = [];
let questionLabels = {};
let questionDescriptions = {};
let traitValueOrder = {};
const savedRegion = localStorage.getItem("empid-region");
let activeRegion = ["all", "west", "east"].includes(savedRegion) ? savedRegion : "all";
const traitWeights = { "p6-emargination": 3 };

const speciesGrid = document.querySelector("#species-grid");
const quizForm = document.querySelector("#quiz-form");
const quizResults = document.querySelector("#quiz-results");
const answerCount = document.querySelector("#answer-count");
const speciesFilter = document.querySelector("#species-filter");
const traitFilter = document.querySelector("#trait-filter");
const glossaryEntries = document.querySelector("#glossary-entries");
const p6Diagram = document.querySelector(".p6-diagram-image");
const dataSource = document.querySelector("#data-source");
const darkModeToggle = document.querySelector("#dark-mode-toggle");
const regionButtons = document.querySelectorAll("[data-region]");
const regionsBySpecies = {
    "Tufted Flycatcher": ["west"],
    "Olive-sided Flycatcher": ["west", "east"],
    "Greater Pewee": ["west"],
    "Western Wood-Pewee": ["west"],
    "Eastern Wood-Pewee": ["east"],
    "Cuban Pewee": [],
    "Acadian Flycatcher": ["east"],
    "Alder Flycatcher": ["east"],
    "Willow Flycatcher": ["west", "east"],
    "Yellow-bellied Flycatcher": ["east"],
    "Western Flycatcher": ["west"],
    "Hammond's Flycatcher": ["west"],
    "Dusky Flycatcher": ["west"],
    "Pine Flycatcher": ["west"],
    "Gray Flycatcher": ["west"],
    "Least Flycatcher": ["east"],
    "Buff-breasted Flycatcher": ["west"]
};
const eyeRingImages = {
    "indistinct": "images/eye_rings/indistinct.png",
    "messy, distinct": "images/eye_rings/messy.png",
    "bold, crisp": "images/eye_rings/bold_crisp.png",
    "tear-shaped": "images/eye_rings/teardrop.png"
};

function categoryKey(label) {
    return label.trim().toLowerCase().replace(/\s+/g, "-");
}

function parseTraits(data) {
    questionOrder = data.categories.map(category => categoryKey(category.name));
    questionLabels = Object.fromEntries(data.categories.map(category => [categoryKey(category.name), category.name]));
    questionDescriptions = Object.fromEntries(data.categories.map(category => [categoryKey(category.name), category.description]));
    traitValueOrder = Object.fromEntries(data.categories.map(category => [categoryKey(category.name), category.values]));
    return data.species.map(bird => ({
        name: bird.name,
        code: bird.code,
        regions: regionsBySpecies[bird.name] || [],
        traits: Object.fromEntries(Object.entries(bird.traits).map(([label, values]) => [categoryKey(label), traitValues(values)]))
    }));
}

function renderGlossary() {
    glossaryEntries.innerHTML = questionOrder.map(category => `<div><strong>${questionLabels[category]}:</strong> ${questionDescriptions[category]}</div>`).join("");
}

function toggleP6Diagram() {
    const isPressed = p6Diagram.getAttribute("aria-pressed") === "true";
    p6Diagram.setAttribute("aria-pressed", String(!isPressed));
    p6Diagram.setAttribute("aria-label", `${isPressed ? "Show" : "Hide"} P6 emargination overlay`);
}

function displayValue(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function traitValues(value) {
    return Array.isArray(value) ? value : [value];
}

function traitImage(category, value) {
    const image = category === "eye-ring" ? eyeRingImages[value] : null;
    return image ? `<img class="trait-image" src="${image}" alt="${displayValue(value)} eye-ring">` : "";
}

function isInActiveRegion(bird) {
    return activeRegion === "all" || bird.regions.includes(activeRegion);
}

// Lets js/ptip.js filter its reference species by the same east/west/all toggle.
window.empidRegionFilter = {
    getActiveRegion: () => activeRegion,
    isSpeciesInActiveRegion: name => activeRegion === "all" || (regionsBySpecies[name] || []).includes(activeRegion),
    setActiveRegion: region => setActiveRegion(region)
};

function renderReference(nameFilter = "", selectedTrait = "") {
    const query = nameFilter.trim().toLowerCase();
    const [category, value] = selectedTrait.split("::");
    const visible = species.filter(bird => {
        const matchesName = !query || bird.name.toLowerCase().includes(query);
        const matchesTrait = !selectedTrait || traitValues(bird.traits[category]).includes(value);
        return isInActiveRegion(bird) && matchesName && matchesTrait;
    });
    const filterDescription = [nameFilter, value].filter(Boolean).join(" / ");
    speciesGrid.innerHTML = visible.length ? visible.map(bird => `<article class="species-card"><div class="species-card-top"><span class="species-code">${bird.code}</span><h3>${bird.name}</h3></div><dl>${questionOrder.map(category => `<div><dt>${questionLabels[category]}</dt><dd>${traitValues(bird.traits[category] || []).map(value => `${traitImage(category, value)}<span>${displayValue(value)}</span>`).join("<br>") || "—"}</dd></div>`).join("")}</dl></article>`).join("") : `<p class="empty-state">No species match ${filterDescription || "these filters"}.</p>`;
}

function renderTraitFilter() {
    traitFilter.querySelectorAll("optgroup").forEach(group => group.remove());
    questionOrder.forEach(category => {
        const group = document.createElement("optgroup");
        group.label = questionLabels[category];
        traitValueOrder[category].forEach(value => {
            const option = document.createElement("option");
            option.value = `${category}::${value}`;
            option.textContent = displayValue(value);
            group.append(option);
        });
        traitFilter.append(group);
    });
}

function renderQuiz() {
    const categories = questionOrder.map(category => {
        const values = traitValueOrder[category];
        return `<fieldset class="quiz-question"><legend>${questionLabels[category]}</legend><div class="option-list">${values.map(value => `<label class="option"><input type="checkbox" data-category="${category}" value="${value}"><span>${traitImage(category, value)}${displayValue(value)}</span></label>`).join("")}</div></fieldset>`;
    });
    quizForm.innerHTML = categories.join("");
    restoreQuizState();
    quizForm.addEventListener("change", handleQuizChange);
}

function getHashState() {
    const [viewPart, query = ""] = window.location.hash.slice(1).split("?");
    const view = ["reference", "glossary", "quiz"].includes(viewPart) ? viewPart : "reference";
    const answers = new Set();

    new URLSearchParams(query).forEach((value, category) => {
        answers.add(`${category}::${value}`);
    });

    return { view, answers };
}

function restoreQuizState() {
    const savedAnswers = getHashState().answers;

    quizForm.querySelectorAll("input").forEach(input => {
        input.checked = savedAnswers.has(`${input.dataset.category}::${input.value}`);
    });
}

function updateHashFromQuiz(view) {
    const params = new URLSearchParams();
    quizForm.querySelectorAll("input:checked").forEach(input => {
        params.append(input.dataset.category, input.value);
    });

    const query = params.toString();
    const nextHash = `#${view}${query ? `?${query}` : ""}`;
    if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    }
}

function handleQuizChange() {
    updateHashFromQuiz(getHashState().view);
    updateResults();
}

function updateResults() {
    const selected = [...quizForm.querySelectorAll("input:checked")];
    const answers = selected.reduce((result, input) => {
        (result[input.dataset.category] ||= []).push(input.value);
        return result;
    }, {});
    answerCount.textContent = `${selected.length} clue${selected.length === 1 ? "" : "s"} selected`;
    const ranked = species.filter(isInActiveRegion).map(bird => {
        const categories = Object.keys(answers);
        const totalWeight = categories.reduce((total, category) => total + (traitWeights[category] || 1), 0);
        const matches = categories.reduce((total, category) => total + (answers[category].some(answer => traitValues(bird.traits[category]).includes(answer)) ? (traitWeights[category] || 1) : 0), 0);
        return { bird, matches, score: totalWeight ? Math.round((matches / totalWeight) * 100) : 0 };
    }).sort((a, b) => b.matches - a.matches || a.bird.name.localeCompare(b.bird.name));
    const highestMatches = ranked[0]?.matches ?? 0;
    quizResults.innerHTML = ranked.map((result, index) => {
        const rank = ranked.findIndex(item => item.matches === result.matches) + 1;
        const isTopTie = selected.length > 0 && result.matches === highestMatches;
        return `<article class="result-row ${isTopTie ? "top-result" : ""}"><span class="rank">${String(rank).padStart(2, "0")}</span><strong>${result.bird.name}</strong><span class="result-bar"><i style="width:${result.score}%"></i></span><span class="result-score">${selected.length ? `${result.score}%` : "—"}</span></article>`;
    }).join("");
}

function setActiveView(view, updateHash = true) {
    document.querySelectorAll("[data-view]").forEach(item => { const isActive = item.dataset.view === view; item.classList.toggle("active", isActive); item.setAttribute("aria-selected", isActive ? "true" : "false"); });
    document.querySelectorAll("[data-panel]").forEach(panel => panel.classList.toggle("hidden", panel.dataset.panel !== view));
    if (updateHash) {
        updateHashFromQuiz(view);
    }
}

function setActiveRegion(region) {
    activeRegion = region;
    localStorage.setItem("empid-region", region);
    regionButtons.forEach(button => {
        const isActive = button.dataset.region === region;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
    renderReference(speciesFilter.value, traitFilter.value);
    updateResults();
    window.ptipTool?.refreshRatioProfiles?.();
    window.ptipTool?.onRegionChange?.(region);
}

function setDarkMode(enabled) {
    document.body.classList.toggle("dark-mode", enabled);
    darkModeToggle.setAttribute("aria-pressed", String(enabled));
    darkModeToggle.textContent = enabled ? "Light mode" : "Dark mode";
    localStorage.setItem("empid-dark-mode", String(enabled));
}

document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setActiveView(button.dataset.view)));
p6Diagram.addEventListener("click", toggleP6Diagram);
regionButtons.forEach(button => button.addEventListener("click", () => setActiveRegion(button.dataset.region)));
darkModeToggle.addEventListener("click", () => setDarkMode(!document.body.classList.contains("dark-mode")));
setActiveRegion(activeRegion);
speciesFilter.addEventListener("input", event => renderReference(event.target.value, traitFilter.value));
traitFilter.addEventListener("change", event => renderReference(speciesFilter.value, event.target.value));
document.querySelector("#reset-quiz").addEventListener("click", () => {
    quizForm.querySelectorAll("input").forEach(input => { input.checked = false; });
    updateHashFromQuiz(getHashState().view);
    updateResults();
});

function applyHashState() {
    const { view } = getHashState();
    restoreQuizState();
    setActiveView(view, false);
    updateResults();
}

window.addEventListener("hashchange", applyHashState);

async function loadTraits() {
    try {
        const response = await fetch("empid_traits.json");
        if (!response.ok) {
            throw new Error(`Could not load empid_traits.json (${response.status})`);
        }
        const data = await response.json();
        species = parseTraits(data);
        renderGlossary();
        renderTraitFilter();
        renderReference();
        renderQuiz();
        document.querySelector("#species-count").textContent = `${species.length} species records / JSON reference data`;
        dataSource.textContent = `Data: ${data.source}`;
        applyHashState();
    } catch (error) {
        speciesGrid.innerHTML = `<p class="empty-state">The JSON reference data could not be loaded.</p>`;
        console.error(error);
    }
}

loadTraits();

setDarkMode(localStorage.getItem("empid-dark-mode") === "true");
