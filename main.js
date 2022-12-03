function $(el) { return document.getElementById(el); }

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
    window.onclick = function(event) {
        if (event.target.classList.contains("modal")) {
            event.target.style.display = "";
        }
    }

    load_rankings();

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
        ". Golfers: " + prettyNumber(model.golfers.length) +
        ". Solutions: " + prettyNumber(sum(model.solutions.map(solutions_h => sum(solutions_h.map(solutions_hl => solutions_hl.length))))) +
        "\nLast submitted solution: " + prettyDate(model.lastSubmitted)[0];

    init_rankings();
}

function openModal(modal) {
    modal.style.display = "block";
}

function _showTab(activeTab, ...tabs) {
    for (const tab of tabs) {
        const isActive = tab == activeTab;
        $(tab + "Button").classList.toggle("active", isActive);
        $(tab + "Tab").style.display = isActive ? "" : "none";
    }
}

function showTab(tab) {
    _showTab(tab, "rankings", "heatMap", "golferInfo");
    if (tab == "heatMap")
        initHeatMap();
}

function showGolferTab(tab) {
    _showTab(tab, "solutions", "languages");
}

function prettyNumber(n) { return n.toLocaleString("en-US"); }

const dtf = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function prettyDate(submitted) {
    const diff = model.lastSubmitted - submitted;

    const parts = {};
    for (const { type, value } of dtf.formatToParts(submitted * 60000)) {
        parts[type] = value;
    }
    const datePart = `${parts.day} ${parts.month} ${parts.year}`;

    const fullText = `${datePart} ${parts.hour}:${parts.minute}`;
    const prettyText =
        diff < 2 ? "a min ago" :
        diff < 60 ? diff + " mins ago" :
        diff < 120 ? "an hour ago" :
        diff < 1440 ? (diff / 60 | 0) + " hours ago" :
        diff < 2880 ? "a day ago" :
        diff < 40320 ? (diff / 1440 | 0) + " days ago" :
        datePart;

    return [fullText, prettyText];
}
