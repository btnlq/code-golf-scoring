let _holeRow, _langRow;

function load_rankings() {
    _holeRow = new NumberPickerRow($("holeCoefficientRow"), changed);
    _langRow = new NumberPickerRow($("langCoefficientRow"), changed);
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

function changed() {
    const holeScoring = _holeRow.getScoring();
    const langScoring = _langRow.getScoring();

    const isGolfers = $("radioGolfers").checked;
    const h = Number($("holeSelect").value);
    const l = Number($("langSelect").value);

    $("langSelect").style.display = isGolfers ? "" : "none";
    $("holeCoefficientRow").style.visibility = h == -1 ? "" : "collapse";
    $("langCoefficientRow").style.visibility = isGolfers && l == -1 ? "" : "collapse";

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

    const table = new Table($("scoring"));

    // data = [participant, bytes, submitted, score, count / best golfer, missing holes]
    table.add("#", Table.place(data => data[3]));
    table.add(isGolfers ? "Golfer" : "Language", Table.text(data => data[0]), true);
    table.add("Points", Table.text(data => data[3].toFixed(2)));
    table.add("Bytes", Table.text(data => prettyNumber(data[1])));
    if (isGolfers ? l == -1 || h == -1 : h == -1) {
        table.add(isGolfers ? "Sols" : "Holes", (cell, data) => {
            const countText = prettyNumber(data[4]);
            const missing = data[5];
            if (missing && missing.length > 0) {
                cell.innerText = missing.join(", ");
                cell.innerHTML = '<div class="tooltip">' + countText + '<span class="tooltiptext">' + cell.innerHTML + '</span></div>';
            } else {
                cell.innerText = countText;
            }
        });
    }
    table.add("Submitted", Table.date(data => data[2]));
    if (!isGolfers && h != -1) {
        table.add("Golfer", Table.text(data => data[4]), true);
    }

    table.render(scores);
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
