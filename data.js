const _dbVersion = 2;

function packModel(json) {
    const holes = new EnumWriter();
    const langs = new EnumWriter();

    const sols = json.filter(sol => sol.scoring === "bytes");

    for (const sol of sols) {
        sol.submitted = Date.parse(sol.submitted) / 60000 | 0; // minutes since the Unix epoch
    }
    sols.sort((a, b) => a.submitted - b.submitted);

    const writer = new Writer();
    writer.writeShort(_dbVersion);
    writer.writeLong(sols.length, 7);

    const golfersCache = [];
    let prevTime = 0;
    const infos = new Map();

    for (const sol of sols) {
        // info
        const g = sol.login;
        let info = infos.get(g);
        let newGolfer = info == undefined;
        if (newGolfer) {
            infos.set(g, info = [-1, -1]);
        }

        // golfer
        const id = newGolfer || golfersCache.indexOf(g);
        writer.write(id != 0, 1);
        if (id != 0) {
            writer.writeLong(newGolfer ? 0 : id, 3);
            if (newGolfer)
                writer.writeString(g);
            else
                golfersCache.splice(id, 1);
            golfersCache.splice(0, 0, g);
        }

        // lang
        const newLang = info[0] != sol.lang;
        if (!newGolfer)
            writer.write(newLang, 1);
        if (newLang) {
            langs.write(writer, info[0] = sol.lang);
        }

        // hole
        const newHole = info[1] != sol.hole;
        if (!newGolfer && newLang)
            writer.write(newHole, 1);
        if (newHole) {
            holes.write(writer, info[1] = sol.hole);
        }

        // size
        writer.writeLong(sol.bytes - 1, 7);

        // timeDiff
        const curTime = sol.submitted;
        writer.writeLong(curTime - prevTime, 3);
        prevTime = curTime;
    }

    return writer.toString();
}

function unpackModel(s) {
    const reader = new Reader(s);

    const dbVersion = reader.readShort();
    if (dbVersion != _dbVersion) {
        console.log("Found version " + dbVersion + ", expected version " + _dbVersion);
        return null;
    }

    const holesReader = new EnumReader();
    const langsReader = new EnumReader();

    const golfers = [];
    const golfersCache = [];
    let submitted = 0;
    const infos = [];

    const solutions = [];

    for (let solsCount = reader.readLong(7); solsCount > 0; solsCount--) {
        // golfer
        const otherGolfer = reader.read(1);
        let golferId;
        if (!otherGolfer) {
            golferId = golfersCache[0];
        } else {
            const id = reader.readLong(3);
            if (id == 0) {
                golferId = golfers.length;
                golfers.push(reader.readString());
                infos.push([-1, -1]);
            } else {
                golferId = golfersCache.splice(id, 1)[0];
            }
            golfersCache.splice(0, 0, golferId);
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
        const size = reader.readLong(7) + 1;

        // timeDiff
        submitted += reader.readLong(3);

        if (solutions.length == hole)
            solutions.push((solutions[0] || []).map(_ => []));
        if (solutions[0].length == lang)
            solutions.forEach(solutions_h => solutions_h.push([]));
        solutions[hole][lang].push([golferId, size, submitted]);
    }

    return new Model(solutions, holesReader.arr, langsReader.arr, golfers, submitted);
}
