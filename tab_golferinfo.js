let _golfer;

function golferChanged() {
    const text = $("golfer").value.toLowerCase().trim();

    const matchedGolfers = findGolfers(text, 8);

    const golfers = $("golfers");
    golfers.innerHTML = "";
    for (const matchedGolfer of matchedGolfers) {
        const option = document.createElement("option");
        option.value = model.golfers[matchedGolfer];
        golfers.appendChild(option);
    }

    _golfer = matchedGolfers && text ? matchedGolfers[0] : undefined;
    updateWall();
    updateGolferLanguages();
}

function findGolfers(prefix, limit) {
    if (prefix.length == 0)
        return [];

    const lowercaseGolfers = model._lowercaseGolfers || (
        model._lowercaseGolfers = model.golfers.map((golfer, id) => [golfer.toLowerCase(), id]).sort()
    );

    let a = -1;
    let b = lowercaseGolfers.length;

    while (a + 1 < b) {
        const c = a + b >> 1;
        if (lowercaseGolfers[c][0] < prefix)
            a = c;
        else
            b = c;
    }

    const matchedGolfers = [];

    for (; b < lowercaseGolfers.length && lowercaseGolfers[b][0].startsWith(prefix); b++) {
        matchedGolfers.push(lowercaseGolfers[b][1]);
        if (matchedGolfers.length == limit)
            break;
    }

    return matchedGolfers;
}

function updateWall() {
    const selectedH = Number($("wallHoleSelect").value);
    const allHoles = selectedH == -1;
    display($("wallHoleColumn"), allHoles);

    const selectedL = Number($("wallLangSelect").value);
    const allLangs = selectedL == -1;
    display($("wallLangColumn"), allLangs);

    const table = $("golferWall");
    display(table, _golfer);
    const body = table.tBodies[0];

    if (!_golfer) {
        body.innerHTML = "";
        $("golferLogin").textContent = "";
        $("solutionsCount").textContent = "";
        return;
    }

    const solutions = [];
    for (const h of allHoles ? model.holes.keys() : [selectedH])
        for (const l of allLangs ? model.langs.keys() : [selectedL])
            for (const sol of model.solutions[h][l])
                if (sol[0] == _golfer)
                    solutions.push([h, l, sol[1], sol[2], model.bestSolutions[h][l][1] / sol[1]]);

    $("golferLogin").textContent = "Golfer: " + model.golfers[_golfer];
    $("solutionsCount").textContent = "Solutions count: " + prettyNumber(solutions.length);

    const compareFn =
        $("radioNew").checked ? (a, b) => b[3] - a[3] :
        $("radioOld").checked ? (a, b) => a[3] - b[3] :
        $("radioBest").checked ? (a, b) => b[4] - a[4] :
        (a, b) => a[4] - b[4];
    solutions.sort(compareFn);
    if (solutions.length > 100)
        solutions.length = 100;

    body.innerHTML = "";
    for (const [h, l, bytes, submitted, score] of solutions) {
        const row = body.insertRow();

        const [fullText, prettyText] = prettyDate(submitted);
        row.insertCell().innerHTML = `<span title="${fullText}">${prettyText}</span>`;

        if (allHoles)
            row.insertCell().innerText = model.prettyHoles[h];
        else
            row.insertCell().style.display = "none";
        if (allLangs)
            row.insertCell().innerText = model.prettyLangs[l];
        else
            row.insertCell().style.display = "none";
        row.insertCell().innerText = prettyNumber(bytes);

        row.insertCell().innerText = (1000 * score).toFixed();
    }
}

function updateGolferLanguages() {
    const body = $("golferLanguages").tBodies[0];
    body.innerHTML = "";

    if (!_golfer)
        return;

    const scores = model.golferLanguages(_golfer);

    let place = 0, realPlace = 0, prevScore = -1;
    for (const [participant, bytes, submitted, score, count] of scores) {
        place++; if (score != prevScore) realPlace = place, prevScore = score;

        const row = body.insertRow();

        row.insertCell().innerText = realPlace;
        row.insertCell().innerText = participant;
        row.insertCell().innerText = prettyNumber(Math.round(score));
        row.insertCell().innerText = prettyNumber(bytes);
        row.insertCell().innerText = count;

        const [fullText, prettyText] = prettyDate(submitted);
        row.insertCell().innerHTML = `<span title="${fullText}">${prettyText}</span>`;
    }
}
