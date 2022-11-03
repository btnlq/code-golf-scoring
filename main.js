function $(el) { return document.getElementById(el); }
function display(el, value) { el.style.display = value ? "" : "none"; }
function visible(el, value) { el.style.visibility = value ? "" : "collapse"; }

function updateModelFromFile(input) {
    const file = input.files[0];
    if (!file) {
        return;
    }
    $("modelState").textContent = "Loading...";
    const reader = new FileReader();
    reader.onload = e => save(JSON.parse(e.target.result));
    reader.readAsText(file);
}

function updateModelFromSite() {
    $("modelState").textContent = "Loading...";
    fetch("https://code.golf/scores/all-holes/all-langs/all")
        .then(res => res.json())
        .then(save);
}

function save(data) {
    const packed = packModel(data);
    init(packed);
    localStorage.setItem("cgdb", packed);
    console.log("Saved in " + Math.round(packed.length / 512) + " KiB");
}

let holeRow, langRow;

function load() {
    window.onclick = function(event) {
        if (event.target.classList.contains("modal")) {
            event.target.style.display = "";
        }
    }

    holeRow = new NumberPickerRow($("holeCoefficientRow"), changed);
    langRow = new NumberPickerRow($("langCoefficientRow"), changed);

    const packed = localStorage.getItem("cgdb");
    if (packed != null) {
        init(packed);
    }
}

let model;

function init(packed) {
    model = unpackModel(packed);
    if (model == null) {
        return;
    }
    console.log("Loaded " + model.golfers.length + " golfers");
    $("modelState").textContent =
        "Langs: " + model.langs.length +
        ". Holes: " + model.holes.length +
        ". Golfers: " + model.golfers.length +
        ". Solutions: " + sum(model.solutions.map(solutions_h => sum(solutions_h.map(solutions_hl => solutions_hl.length)))) + // holes -> langs -> [golferId, size, score]
        "\nLast submitted solution: " + model.lastSubmitted.replace("T", " ").split(".")[0];

    fillSelect($("holeSelect"), model.prettyHoles);
    fillSelect($("langSelect"), model.prettyLangs);

    changed();
}

function fillSelect(select, names) {
    select.length = 1;
    for (const [i, name] of [...names.entries()].sort((a, b) => a[1] > b[1] ? 1 : -1)) {
        select.add(new Option(name, i));
    }
}

function changedModel(scoringType) {
    model.updateSolutionsScores(scoringType);
    changed();
}

class NumberPickerRow {
    constructor(row, onchange) {
        this.header = row.cells[0].textContent;
        this.slider = row.cells[1].firstElementChild;
        this.button = row.cells[2].firstElementChild;
        this.setValue(8);
        this.onchange = onchange;
        this.slider.oninput = () => this._setButtonValue(this._getSliderValue());
        this.slider.onchange = () => this.setValue(this._getSliderValue());
        this.button.onclick = () => openNumberPicker(this, this._value);
    }

    _getSliderValue() {
        const value = this.slider.valueAsNumber;
        return value == 0 ? 1 : value == 96 ? Infinity : Math.pow(2, value / 16);
    }

    _setSliderValue(value) {
        if (value < 1) value = 1;
        else if (value > 64) value = 64;
        this.slider.value = Math.log2(value) * 16;
    }

    _setButtonValue(value) {
        let text = value.toFixed(2);
        if (value == 1) text += " (average)";
        else if (value == Infinity) text = "∞ (maximum)";
        this.button.textContent = text;
    }

    setValue(value) {
        this._value = value;
        this._setButtonValue(value);
        this._setSliderValue(value);
        if (this.onchange)
            this.onchange(value);
    }

    getScoring() {
        return this._value == 1 ? sum : this._value == Infinity ? max : pNorm(this._value);
    }
}

function changed() {
    console.log("changed");

    const holeScoring = holeRow.getScoring();
    const langScoring = langRow.getScoring();

    const isGolfers = $("radioGolfers").checked;
    const h = Number($("holeSelect").value);
    const l = Number($("langSelect").value);

    display($("langSelect"), isGolfers);
    visible($("holeCoefficientRow"), h == -1);
    visible($("langCoefficientRow"), isGolfers && l == -1);

    const complex = isGolfers ? l == -1 || h == -1 : h == -1;

    $("participantColumn").textContent = isGolfers ? "Golfers" : "Langs";
    $("solsColumn").textContent = isGolfers ? "Sols" : "Holes";
    display($("solsColumn"), complex);

    if (model == undefined) {
        console.log("Model is not loaded");
        return;
    }

    const link = isGolfers ?
        `code.golf/rankings/holes/${h == -1 ? "all" : model.holes[h]}/${l == -1 ? "all" : model.langs[l]}/bytes` :
        h == -1 ? "code.golf/rankings/langs/all/bytes" : undefined;
    $("originalLink").innerHTML = "Original ranking: " + (link ? `<a href="https://${link}">${link}</a>` : "missing");

    const scores = isGolfers ?
        model.golfersRanking(h == -1 ? holeScoring : h, l == -1 ? langScoring : l) :
        model.langsRanking(h == -1 ? holeScoring : h);

    const body = $("scoring").tBodies[0];
    body.innerHTML = "";

    let place = 0, realPlace = 0, prevScore = -1;
    for (const [participant, bytes, score, count, missing] of scores) {
        place++; if (score != prevScore) realPlace = place, prevScore = score;

        const row = body.insertRow();

        row.insertCell().innerText = realPlace;
        row.insertCell().innerText = participant;
        row.insertCell().innerText = score.toFixed(2);
        row.insertCell().innerText = bytes.toLocaleString("en-US");
        if (complex) {
            const countText = count.toLocaleString("en-US");
            const cell = row.insertCell();
            if (missing && missing.length > 0) {
                cell.innerText = missing.join(", ");
                cell.innerHTML = '<div class="tooltip">' + countText + '<span class="tooltiptext">' + cell.innerHTML + '</span></div>';
            } else {
                cell.innerText = countText;
            }
        }
    }
}

let modalRow;

function openNumberPicker(row, value) {
    modalRow = row;
    $("modalHeader").textContent = row.header;
    $("modalValue").value = value;
    openModal($("numberPicker"));
}

function valueChangedNumberPicker(input) {
    const message = input.validationMessage;
    $("modalMessage").textContent = message;
    $("modalOk").disabled = !!message;
}

function closeNumberPicker(save) {
    if (save) {
        const value = Number($("modalValue").value);
        modalRow.setValue(value);
    }
    $("numberPicker").style.display = "";
}

function openModal(modal) {
    modal.style.display = "block";
}

function addTh(row, text) {
    const cell = row.insertCell();
    cell.textContent = text;
    cell.outerHTML = "<th>" + cell.innerHTML + "</th>";
}

function showHeatMap() {
    if (model == null) {
        return;
    }

    const table = $("heatMap");
    if (table.rows.length == 0) {
        const heatMap = model.heatMap();

        const body = table.tBodies[0];

        const header = body.insertRow();
        addTh(header, "");
        for (const lang of heatMap.langs) {
            addTh(header, lang);
        }
        for (const [h, hole] of heatMap.holes.entries()) {
            const row = body.insertRow();
            addTh(row, hole);
            for (const count of heatMap.map[h]) {
                const cell = row.insertCell();
                cell.innerHTML = count < 100 ? count : `<small>${count}</small>`;
                const hue = (1 - Math.atan(count / 16) / Math.PI * 2) * 270;
                cell.style.backgroundColor = `hsl(${hue}, 100%, 70%)`;
            }
        }
    }

    const hidden = table.style.display == "none";
    table.style.display = hidden ? "" : "none";
    $("showHeatMap").textContent = (hidden ? "Hide" : "Show") + " solution count heatmap";
}
