class Multimap extends Map {
    addAll(values) {
        for (const value of values) {
            const key = value[0];
            const list = this.get(key);
            if (list === undefined) {
                this.set(key, [value]);
            } else {
                list.push(value);
            }
        }
    }

    *combine(fn, withCounts) {
        let newFn;
        if (withCounts) {
            // [[golferId, size, score, cnt]...] -> [golferId, sum(size...), fn(score...), sum(cnt...)]
            newFn = lst => lst.length == 1 ? lst[0] : [lst[0][0], sum(project(lst, 1)), fn(project(lst, 2)), sum(project(lst, 3))];
        } else {
            // [[golferId, size, score]...] -> [golferId, sum(size...), fn(score...), length(...)]
            newFn = lst => lst.length == 1 ? lst[0].concat(1) : [lst[0][0], sum(project(lst, 1)), fn(project(lst, 2)), lst.length];
        }
        for (const list of this.values()) {
            yield newFn(list);
        }
    }
}

class Model {
    /**
     * @param {number[][][][]} solutions
     * @param {string[]} holes
     * @param {string[]} langs
     * @param {string[]} golfers
     * @param {string} lastSubmitted
     * */
    constructor(solutions, holes, langs, golfers, lastSubmitted) {
        const prettyNames = new Map(
            ["of", "to", "and", "v2", "ASCII", "CSS", "ISBN", "QR", "brainfuck", "sed", "BASIC", "COBOL", "PHP", "SQL", "GolfScript",
            "JavaScript", "PowerShell", "VimL", "Tongue-twisters", "Ten-pin Bowling", "Rock-paper-scissors-Spock-lizard"]
                .map(x => [x.toLowerCase().replace(" ", "-"), x])
                .concat(
                    [["long", "(Long)"], ["catalans", "Catalan’s"], ["pascals", "Pascal’s"], ["c-sharp", "C#"], ["f-sharp", "F#"], ["cpp", "C++"], ["fish", "><>"]]
                )
        );

        const prettifyName = name =>
            prettyNames.get(name) || name.split("-").map(
                word => prettyNames.get(word) || ('a' <= word && word < '{' ? word[0].toUpperCase() + word.slice(1) : word)
            ).join(" ");

        this.solutions = solutions; // holes -> langs -> [golferId, size, score]
        this.holes = holes.map(prettifyName);
        this.langs = langs.map(prettifyName);
        this.golfers = golfers;
        this.lastSubmitted = lastSubmitted;

        this.bestSolutions = solutions.map(solutions_h => {
            const bestSolutions_h = solutions_h.map(solutions_hl => minBy(solutions_hl, 1) || [null, 0, 2/3]);
            const best_h = min(bestSolutions_h.map(solution => solution[1] || Infinity));

            // computes "score" for all solutions
            for (const [l, solutions_hl] of solutions_h.entries()) {
                const best_hl = bestSolutions_h[l][1];
                const coef = 1/(Math.sqrt(solutions_hl.length) + 3);
                const sb = (1 - coef) * best_hl + coef * best_h;
                for (const solution of solutions_hl) {
                    solution.push(sb / solution[1]);
                }
            }

            return bestSolutions_h;
        });
    }

    _gLangHoleScores(h, l) {
        return [this.solutions[h][l], this.bestSolutions[h][l][2]];
    }

    _gHoleScores(h, langScoring) {
        const scores = new Multimap();
        for (const solutions_hl of this.solutions[h]) {
            scores.addAll(solutions_hl);
        }
        return [scores.combine(langScoring), langScoring(project(this.bestSolutions[h], 2))];
    }

    _gLangScores(holeScoring, l) {
        const scores = new Multimap();
        for (const solutions_h of this.solutions) {
            scores.addAll(solutions_h[l]);
        }
        return [scores.combine(holeScoring), holeScoring(project(project(this.bestSolutions, l), 2))];
    }

    _gTotalScores(holeScoring, langScoring) {
        const scores = new Multimap();
        const perfectScores = [];
        for (const h of this.holes.keys()) {
            const [scores_h, perfectScore_h] = this._gHoleScores(h, langScoring);
            scores.addAll(scores_h);
            perfectScores.push(perfectScore_h);
        }
        return [scores.combine(holeScoring, true), holeScoring(perfectScores)];
    }

    golfersRanking(h, l) {
        const scoresFn = h.toFixed ?
            l.toFixed ? this._gLangHoleScores : this._gHoleScores :
            l.toFixed ? this._gLangScores : this._gTotalScores;
        const scores = scoresFn.call(this, h, l);
        return this._pretty(scores, this.golfers, 20);
    }

    _lHoleScores(h) {
        const scores = this.bestSolutions[h]
            .filter(solution => solution[0])
            .map((solution, h) => [h, ...solution.slice(1)]);
        return [scores, 1];
    }

    _lTotalScores(holeScoring) {
        const scores = [];
        for (const l of this.langs.keys()) {
            const bestSolutions_l = [...project(this.bestSolutions, l)];
            const missingHoles = [...this.holes.keys()].filter(h => bestSolutions_l[h][0] == undefined).map(h => this.holes[h]);
            const bytes_l = sum(project(bestSolutions_l, 1));
            const score_l = holeScoring(project(bestSolutions_l, 2));
            scores.push([l, bytes_l, score_l, this.holes.length - missingHoles.length, missingHoles]);
        };
        return [scores, holeScoring(this.holes.map(() => 1))];
    }

    langsRanking(h) {
        const scoresFn = h.toFixed ? this._lHoleScores : this._lTotalScores;
        const scores = scoresFn.call(this, h);
        return this._pretty(scores, this.langs);
    }

    _pretty([scores, perfectScore], names, count) {
        const board = nbest(scores, count, (a, b) => b[2] - a[2]);
        const inv = 1000 / perfectScore;
        return board.map(([participantId, size, score, ...rest]) => [names[participantId], size, score * inv, ...rest]);
    }
}
