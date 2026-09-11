"use strict";

/* Categorical field marks stay separate from measurements so numeric data can grow safely. */
const species = [
    { name: "Yellow-bellied", code: "YBFL", traits: { "lower mandible": "all pale", "bill size": "medium", "tail length": "medium", "primary extension": "long", "tail width": "narrow", "crown shape": "round", "forehead angle": "medium", "underpart/upperpart contrast": "weak", "wingbar contrast": "strong", "wing panel contrast": "strong" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Western", code: "WEFL", traits: { "lower mandible": "all pale", "bill size": "medium", "tail length": "medium", "primary extension": "long", "tail width": "narrow", "crown shape": "peaked", "forehead angle": "medium", "underpart/upperpart contrast": "weak", "wingbar contrast": "medium", "wing panel contrast": "medium" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Dusky", code: "DUSK", traits: { "lower mandible": "all dark", "bill size": "small", "tail length": ["medium", "long"], "primary extension": "medium", "tail width": "narrow", "crown shape": "peaked", "forehead angle": "medium", "underpart/upperpart contrast": "weak", "wingbar contrast": "medium", "wing panel contrast": "weak" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Hammond's", code: "HAFL", traits: { "eye-ring": "none", "lower mandible": "all dark", "bill size": "small", "tail length": "medium", "primary extension": "short", "tail width": "narrow", "crown shape": "round", "forehead angle": "steep", "underpart/upperpart contrast": "weak", "wingbar contrast": "medium", "wing panel contrast": "weak" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Least", code: "LEFL", traits: { "eye-ring": "thin, distinct", "lower mandible": "partial", "bill size": "small", "tail length": "short", "primary extension": "short", "tail width": "narrow", "crown shape": "round", "forehead angle": "medium", "underpart/upperpart contrast": "strong", "wingbar contrast": "strong" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Alder", code: "ALFL", traits: { "eye-ring": "thin, distinct", "lower mandible": "partial", "bill size": "medium", "tail length": "medium", "primary extension": "medium", "tail width": "fat", "crown shape": "round", "forehead angle": "medium", "underpart/upperpart contrast": "strong", "wingbar contrast": "medium" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Acadian", code: "ACFL", traits: { "eye-ring": "bold, crisp", "lower mandible": "all pale", "bill size": "long", "tail length": "medium", "primary extension": "long", "tail width": "medium", "crown shape": "round", "forehead angle": "medium", "underpart/upperpart contrast": "strong", "wingbar contrast": "medium", "wing panel contrast": "medium" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Willow", code: "WIFL", traits: { "eye-ring": "messy", "lower mandible": "all pale", "bill size": "long", "tail length": "medium", "primary extension": "long", "tail width": "narrow", "crown shape": "peaked", "forehead angle": "shallow", "underpart/upperpart contrast": "medium", "wingbar contrast": "medium", "wing panel contrast": "medium" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Gray", code: "GRFL", traits: { "eye-ring": "none", "lower mandible": "all dark", "bill size": "small", "tail length": "medium", "primary extension": "short", "tail width": "narrow", "crown shape": "flat", "forehead angle": "medium", "underpart/upperpart contrast": "weak", "wingbar contrast": "weak", "wing panel contrast": "weak" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Western Wood-Pewee", code: "WWPE", traits: { "eye-ring": "thin, distinct", "lower mandible": "partial", "bill size": "medium", "tail length": "medium", "primary extension": "medium", "crown shape": "peaked", "forehead angle": "shallow", "underpart/upperpart contrast": "medium", "wingbar contrast": "weak", "wing panel contrast": "weak" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } },
    { name: "Eastern Wood-Pewee", code: "EAWP", traits: { "eye-ring": "messy", "lower mandible": "partial", "bill size": "medium", "tail length": "medium", "primary extension": "long", "crown shape": "peaked", "forehead angle": "shallow", "underpart/upperpart contrast": "weak", "wingbar contrast": "weak", "wing panel contrast": "weak" }, measurements: { primaryTipSpacing: { p8_p7: null, p7_p6: null, p6_p5: null, p5_p4: null, p4_p3: null } } }
];

const questionOrder = ["eye-ring", "lower mandible", "bill size", "tail length", "primary extension", "tail width", "crown shape", "forehead angle", "underpart/upperpart contrast", "wingbar contrast", "wing panel contrast"];
const questionLabels = { "eye-ring": "Eye-ring", "lower mandible": "Lower mandible", "bill size": "Bill size", "tail length": "Tail length", "primary extension": "Primary extension", "tail width": "Tail width", "crown shape": "Crown shape", "forehead angle": "Forehead angle", "underpart/upperpart contrast": "Underpart / upperpart contrast", "wingbar contrast": "Wingbar contrast", "wing panel contrast": "Wing panel contrast" };
const traitValueOrder = {
    "eye-ring": ["none", "thin, distinct", "messy", "bold, crisp", "tear-shaped"],
    "lower mandible": ["all dark", "partial", "all pale"],
    "bill size": ["small", "medium", "long"],
    "tail length": ["short", "medium", "long"],
    "primary extension": ["short", "medium", "long"],
    "tail width": ["fat", "medium", "narrow"],
    "crown shape": ["round", "peaked", "flat", "crested"],
    "forehead angle": ["shallow", "medium", "steep"],
    "underpart/upperpart contrast": ["strong", "medium", "weak"],
    "wingbar contrast": ["strong", "medium", "weak"],
    "wing panel contrast": ["strong", "medium", "weak"]
};

const speciesGrid = document.querySelector("#species-grid");
const quizForm = document.querySelector("#quiz-form");
const quizResults = document.querySelector("#quiz-results");
const answerCount = document.querySelector("#answer-count");
const speciesFilter = document.querySelector("#species-filter");
const traitFilter = document.querySelector("#trait-filter");

function displayValue(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function traitValues(value) {
    return Array.isArray(value) ? value : [value];
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
    speciesGrid.innerHTML = visible.length ? visible.map(bird => `<article class="species-card"><div class="species-card-top"><span class="species-code">${bird.code}</span><h3>${bird.name}</h3></div><dl>${Object.entries(bird.traits).map(([label, traitValue]) => `<div><dt>${label.replace(" 2", "")}</dt><dd>${traitValues(traitValue).map(displayValue).join(", ")}</dd></div>`).join("")}</dl></article>`).join("") : `<p class="empty-state">No species match ${filterDescription || "these filters"}.</p>`;
}

function renderTraitFilter() {
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
        const values = [...new Set(species.flatMap(bird => traitValues(bird.traits[category]).filter(Boolean)))];
        return `<fieldset class="quiz-question"><legend>${questionLabels[category]}</legend><div class="option-list">${values.map(value => `<label class="option"><input type="checkbox" data-category="${category}" value="${value}"><span>${displayValue(value)}</span></label>`).join("")}</div></fieldset>`;
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
        const matches = categories.reduce((total, category) => total + (answers[category].some(answer => traitValues(bird.traits[category]).includes(answer)) ? 1 : 0), 0);
        return { bird, matches, score: categories.length ? Math.round((matches / categories.length) * 100) : 0 };
    }).sort((a, b) => b.matches - a.matches || a.bird.name.localeCompare(b.bird.name));
    quizResults.innerHTML = ranked.map((result, index) => `<article class="result-row ${index === 0 && selected.length ? "top-result" : ""}"><span class="rank">${String(index + 1).padStart(2, "0")}</span><strong>${result.bird.name}</strong><span class="result-bar"><i style="width:${result.score}%"></i></span><span class="result-score">${selected.length ? `${result.score}%` : "—"}</span></article>`).join("");
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

document.querySelector("#species-count").textContent = `${species.length} species records / categorical + numeric-ready data`;
renderTraitFilter();
renderReference();
renderQuiz();
function applyHashState() {
    const { view } = getHashState();
    restoreQuizState();
    setActiveView(view, false);
    updateResults();
}

window.addEventListener("hashchange", applyHashState);
applyHashState();
updateResults();
