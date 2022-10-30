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

function load() {
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

    fillSelect($("holeSelect"), model.holes);
    fillSelect($("langSelect"), model.langs);

    changed(true);
}

function fillSelect(select, names) {
    select.length = 1;
    for (const [i, name] of [...names.entries()].sort((a, b) => a[1] > b[1] ? 1 : -1)) {
        select.add(new Option(name, i));
    }
}

function updateSlider(sliderElement, valueElement) {
    let value = sliderElement.valueAsNumber;
    let text, scoring;

    value /= 16;
    if (value == 0) {
        text = "1.00 (average)";
        scoring = sum;
    } else if (value == 6) {
        text = "∞ (maximum)";
        scoring = max;
    } else {
        value = Math.pow(2, value);
        text = value.toFixed(2);
        scoring = pNorm(value);
    }
    $(valueElement).innerText = text;
    return scoring;
}

function changed(compute) {
    const holeScoring = updateSlider($("holeSlider"), "holeValue");
    const langScoring = updateSlider($("langSlider"), "langValue");

    if (compute) {
        console.log("changed");

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
                const cell = row.insertCell();
                if (missing && missing.length > 0) {
                    cell.innerText = missing.join(", ");
                    cell.innerHTML = '<div class="tooltip">' + count + '<span class="tooltiptext">' + cell.innerHTML + '</span></div>';
                } else {
                    cell.innerText = count;
                }
            }
        }
    }
}
