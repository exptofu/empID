"use strict";

let species = [];
let questionOrder = [];
let questionLabels = {};
let questionDescriptions = {};
let traitValueOrder = {};
const traitWeights = { "p6-emargination": 3 };

const speciesGrid = document.querySelector("#species-grid");
const quizForm = document.querySelector("#quiz-form");
const quizResults = document.querySelector("#quiz-results");
const answerCount = document.querySelector("#answer-count");
const speciesFilter = document.querySelector("#species-filter");
const traitFilter = document.querySelector("#trait-filter");
const glossaryEntries = document.querySelector("#glossary-entries");
const dataSource = document.querySelector("#data-source");
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
        traits: Object.fromEntries(Object.entries(bird.traits).map(([label, values]) => [categoryKey(label), traitValues(values)]))
    }));
}

function renderGlossary() {
    glossaryEntries.innerHTML = questionOrder.map(category => `<div><strong>${questionLabels[category]}:</strong> ${questionDescriptions[category]}</div>`).join("");
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

function renderReference(nameFilter = "", selectedTrait = "") {
    const query = nameFilter.trim().toLowerCase();
    const [category, value] = selectedTrait.split("::");
    const visible = species.filter(bird => {
        const matchesName = !query || bird.name.toLowerCase().includes(query);
        const matchesTrait = !selectedTrait || traitValues(bird.traits[category]).includes(value);
        return matchesName && matchesTrait;
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
    const view = ["reference", "quiz"].includes(viewPart) ? viewPart : "reference";
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
    const ranked = species.map(bird => {
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

document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setActiveView(button.dataset.view)));
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
