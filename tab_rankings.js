let holeRow, langRow;

function load_rankings() {
    holeRow = new NumberPickerRow($("holeCoefficientRow"), changed);
    langRow = new NumberPickerRow($("langCoefficientRow"), changed);
}

function init_rankings() {
    fillSelect($("holeSelect"), model.prettyHoles);
    fillSelect($("langSelect"), model.prettyLangs);
    fillSelect($("wallHoleSelect"), model.prettyHoles);
    fillSelect($("wallLangSelect"), model.prettyLangs);
    changed();
}

function fillSelect(select, names) {
    select.length = 1;
    for (const [i, name] of [...names.entries()].sort((a, b) => a[1] > b[1] ? 1 : -1)) {
        select.add(new Option(name, i));
    }
}

function changedScoringType(scoringType) {
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
        return value == 0 ? 1 : value == 96 ? Infinity : Math.round(Math.pow(2, value / 16) * 100) / 100;
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
        if (this._value == value)
            return;
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

function visible(el, value) { el.style.visibility = value ? "" : "collapse"; }

function changed() {
    const holeScoring = holeRow.getScoring();
    const langScoring = langRow.getScoring();

    const isGolfers = $("radioGolfers").checked;
    const h = Number($("holeSelect").value);
    const l = Number($("langSelect").value);

    display($("langSelect"), isGolfers);
    visible($("holeCoefficientRow"), h == -1);
    visible($("langCoefficientRow"), isGolfers && l == -1);

    const displayCount = isGolfers ? l == -1 || h == -1 : h == -1;
    const displayGolfer = !isGolfers && h != -1;

    $("participantColumn").textContent = isGolfers ? "Golfer" : "Language";
    $("solsColumn").textContent = isGolfers ? "Sols" : "Holes";
    display($("solsColumn"), displayCount);
    display($("langGolferColumn"), displayGolfer);

    if (model == undefined) {
        console.log("Model is not loaded");
        return;
    }

    const link = isGolfers ?
        `code.golf/rankings/holes/${h == -1 ? "all" : model.holes[h]}/${l == -1 ? "all" : model.langs[l]}/bytes` :
        h == -1 ? "code.golf/rankings/langs/all/bytes" : undefined;
    $("originalLink").innerHTML = link ? `Original ranking: <a href="https://${link}">${link}</a>` : "You can select \"Common\" to order langs by Bytes";

    const scores = isGolfers ?
        model.golfersRanking(h == -1 ? holeScoring : h, l == -1 ? langScoring : l) :
        model.langsRanking(h == -1 ? holeScoring : h);

    const body = $("scoring").tBodies[0];
    body.innerHTML = "";

    let place = 0, realPlace = 0, prevScore = -1;
    for (const [participant, bytes, submitted, score, count, missing] of scores) {
        place++; if (score != prevScore) realPlace = place, prevScore = score;

        const row = body.insertRow();

        row.insertCell().innerText = realPlace;
        row.insertCell().innerText = participant;
        row.insertCell().innerText = score.toFixed(2);
        row.insertCell().innerText = bytes.toLocaleString("en-US");
        if (displayCount) {
            const countText = count.toLocaleString("en-US");
            const cell = row.insertCell();
            if (missing && missing.length > 0) {
                cell.innerText = missing.join(", ");
                cell.innerHTML = '<div class="tooltip">' + countText + '<span class="tooltiptext">' + cell.innerHTML + '</span></div>';
            } else {
                cell.innerText = countText;
            }
        } else {
            row.insertCell().style.display = "none";
        }

        const [fullText, prettyText] = prettyDate(submitted);
        row.insertCell().innerHTML = `<span title="${fullText}">${prettyText}</span>`;

        if (displayGolfer) {
            row.insertCell().innerText = count;
        }
    }
}

let modalRow;

function openNumberPicker(row, value) {
    modalRow = row;
    $("modalHeader").textContent = row.header;
    const input = $("modalValue");
    input.value = value;
    valueChangedNumberPicker(input);
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
