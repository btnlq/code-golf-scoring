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

    const selectedL = Number($("wallLangSelect").value);
    const allLangs = selectedL == -1;

    const table = new Table($("golferWall"));

    if (!_golfer) {
        table.render();
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
    
    // data = [h, l, bytes, submitted, score]
    table.add("Submitted", Table.date(data => data[3]));
    if (allHoles)
        table.add("Hole", Table.text(data => model.prettyHoles[data[0]]), true);
    if (allLangs)
        table.add("Language", Table.text(data => model.prettyLangs[data[1]]), true);
    table.add("Bytes", Table.text(data => prettyNumber(data[2])));
    table.add("Points", Table.text(data => (1000 * data[4]).toFixed()));

    table.render(solutions);
}

function updateGolferLanguages() {
    const table = new Table($("golferLanguages"));

    if (!_golfer) {
        table.render();
        return;
    }

    const scores = model.golferLanguages(_golfer);

    // data = [participant, bytes, submitted, score, count]
    table.add("#", Table.place(data => data[3]));
    table.add("Language", Table.text(data => data[0]), true);
    table.add("Points", Table.text(data => prettyNumber(Math.round(data[3]))));
    table.add("Bytes", Table.text(data => prettyNumber(data[1])));
    table.add("Sols", Table.text(data => data[4]));
    table.add("Submitted", Table.date(data => data[2]));

    table.render(scores);
}
