const _dbVersion = 1;

function packModel(json) {
    const holes = new EnumWriter();
    const langs = new EnumWriter();
    const sols = new Map();

    for (const sol of json) {
        if (sol.scoring === "chars")
            continue;

        // {"hole":"divisors","lang":"python","scoring":"chars","login":"kevinmchung","chars":62,"bytes":62,"submitted":"2018-01-11T15:10:44.775439"}
        holes.put(sol.hole);
        langs.put(sol.lang);

        let sols_g = sols.get(sol.login);
        if (sols_g === undefined) {
            sols_g = new Map();
            sols.set(sol.login, sols_g);
        }
        let sols_gl = sols_g.get(sol.lang);
        if (sols_gl === undefined) {
            sols_gl = [];
            sols_g.set(sol.lang, sols_gl);
        }
        sols_gl.push(sol);
    }

    const lastSubmitted = max(project(json, "submitted"), "")

    const writer = new Writer();
    writer.writeShort(_dbVersion);
    writer.writeString(lastSubmitted);
    holes.writeMap(writer);
    langs.writeMap(writer);
    writer.writeLong(sols.size);
    for (const [golfer, sols_g] of sols) {
        writer.writeString(golfer);
        writer.writeShort(sols_g.size - 1);
        for (const [lang, sols_gl] of sols_g) {
            langs.write(writer, lang);
            writer.writeShort(sols_gl.length - 1);
            for (const sol of sols_gl) {
                holes.write(writer, sol.hole);
                writer.writeLong(sol.bytes - 1);
            }
        }
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

    const lastSubmitted = reader.readString();

    const holesReader = new EnumReader(reader);
    const langsReader = new EnumReader(reader);

    const holes = holesReader.arr;
    const langs = langsReader.arr;
    const golfers = [];

    const solutions = holes.map(() => langs.map(() => []));

    const golfersCount = reader.readLong();
    for (let golferId = 0; golferId < golfersCount; golferId++) {
        const golfer = reader.readString();
        golfers.push(golfer);
        for (let langsCount = reader.readShort() + 1; langsCount > 0; langsCount--) {
            const lang = langsReader.read(reader);
            for (let holesCount = reader.readShort() + 1; holesCount > 0; holesCount--) {
                const hole = holesReader.read(reader);
                const size = reader.readLong() + 1;
                solutions[hole][lang].push([golferId, size]);
            }
        }
    }

    return new Model(solutions, holes, langs, golfers, lastSubmitted);
}
