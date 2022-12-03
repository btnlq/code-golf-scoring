const _dbVersion = 3;

function indexField(data, field) {
    let count = 0;
    const valueToId = new Map();
    for (const item of data) {
        const value = item[field];
        let id = valueToId.get(value);
        if (id == undefined) {
            id = count++;
            valueToId.set(value, id);
        }
        item[field] = id;
    }
    return [...valueToId.keys()];
}

function packModel(json) {
    const sols = json.filter(sol => sol.scoring === "bytes");

    for (const sol of sols) {
        sol.submitted = Date.parse(sol.submitted) / 60000 | 0; // minutes since the Unix epoch
    }
    sols.sort((a, b) => a.submitted - b.submitted);

    const langsNames = indexField(sols, "lang");
    const holesNames = indexField(sols, "hole");
    const golfersNames = indexField(sols, "login");

    const langsCount = langsNames.length;
    const bests = Array(langsCount * holesNames.length).fill(Infinity);
    for (const sol of sols) {
        const key = sol.hole * langsCount + sol.lang;
        if (bests[key] > sol.bytes)
            bests[key] = sol.bytes;
    }

    const writer = new Writer();
    writer.writeLong(_dbVersion, 0);

    const golfersCache = [];
    let prevTime = 0;
    const infos = [];

    const langsWriter = DynamicHuffmanWriter.fromList(project(sols, "lang"));
    const holesWriter = DynamicHuffmanWriter.fromList(project(sols, "hole"));
    const golfersWriter = new StringHuffmanWriter(writer, golfersNames);

    writer.writeLong(sols.length, 16);
    for (const sol of sols) {
        // info
        const g = sol.login;
        let info = infos[g];
        let newGolfer = info == undefined;
        if (newGolfer) {
            infos.push(info = [-1, -1]);
        }

        // golfer
        const id = newGolfer || golfersCache.length - 1 - golfersCache.lastIndexOf(g);
        writer.write(id != 0, 1);
        if (id != 0) {
            writer.writeLong(newGolfer ? 0 : id, 3);
            if (newGolfer)
                golfersWriter.write(writer, golfersNames[g]);
            else
                golfersCache.splice(golfersCache.length - 1 - id, 1);
            golfersCache.push(g);
        }

        // lang
        const newLang = info[0] != sol.lang;
        if (!newGolfer)
            writer.write(newLang, 1);
        if (newLang) {
            langsWriter.write(writer, info[0] = sol.lang);
        }

        // hole
        const newHole = info[1] != sol.hole;
        if (!newGolfer && newLang)
            writer.write(newHole, 1);
        if (newHole) {
            holesWriter.write(writer, info[1] = sol.hole);
        }

        // size
        writer.writeLong(sol.bytes - bests[sol.hole * langsCount + sol.lang], 5);

        // timeDiff
        const curTime = sol.submitted;
        writer.writeLong(curTime - prevTime, 3);
        prevTime = curTime;
    }

    for (const best of bests) {
        if (best != Infinity)
            writer.writeLong(best - 1, 7);
    }

    const stringWriter = new StringHuffmanWriter(writer, langsNames, holesNames);

    for (const lang of langsNames) {
        stringWriter.write(writer, lang);
    }

    for (const hole of holesNames) {
        stringWriter.write(writer, hole);
    }

    return writer.toString();
}

function unpackModel(s) {
    const reader = new Reader(s);

    const dbVersion = reader.readLong(0);
    if (dbVersion != _dbVersion) {
        console.log("Found version " + dbVersion + ", expected version " + _dbVersion);
        return null;
    }

    const holesReader = new DynamicHuffmanReader();
    const langsReader = new DynamicHuffmanReader();
    const golfersReader = new StringHuffmanReader(reader);

    const golfers = [];
    const golfersCache = [];
    let submitted = 0;
    const infos = [];

    const solutions = [];

    for (let solsCount = reader.readLong(16); solsCount > 0; solsCount--) {
        // golfer
        const otherGolfer = reader.read(1);
        let golferId;
        if (!otherGolfer) {
            golferId = golfersCache[golfersCache.length - 1];
        } else {
            const id = reader.readLong(3);
            if (id == 0) {
                golferId = golfers.length;
                golfers.push(golfersReader.read(reader));
                infos.push([-1, -1]);
            } else {
                golferId = golfersCache.splice(golfersCache.length - 1 - id, 1)[0];
            }
            golfersCache.push(golferId);
        }

        // info
        const info = infos[golferId];
        const newGolfer = info[0] == -1;

        // lang
        const newLang = newGolfer || reader.read(1);
        const lang = newLang ? info[0] = langsReader.read(reader) : info[0];

        // hole
        const newHole = newGolfer || !newLang || reader.read(1);
        const hole = newHole ? info[1] = holesReader.read(reader) : info[1];

        // size
        const size = reader.readLong(5);

        // timeDiff
        submitted += reader.readLong(3);

        if (solutions.length == hole)
            solutions.push((solutions[0] || []).map(_ => []));
        if (solutions[0].length == lang)
            solutions.forEach(solutions_h => solutions_h.push([]));
        solutions[hole][lang].push([golferId, size, submitted]);
    }

    for (const solutions_h of solutions) {
        for (const solutions_hl of solutions_h) {
            if (solutions_hl.length == 0)
                continue;
            const best = reader.readLong(7) + 1;
            for (const solution of solutions_hl) {
                solution[1] += best;
            }
        }
    }

    const stringReader = new StringHuffmanReader(reader);
    const langs = solutions[0].map(_ => stringReader.read(reader));
    const holes = solutions.map(_ => stringReader.read(reader));

    return new Model(solutions, holes, langs, golfers, submitted);
}
