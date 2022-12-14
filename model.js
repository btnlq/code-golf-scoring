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
            // [[golferId, size, submitted, score, cnt]...] -> [golferId, sum(size...), max(submitted...), fn(score...), sum(cnt...)]
            newFn = lst => lst.length == 1 ? lst[0] : [lst[0][0], sum(project(lst, 1)), max(project(lst, 2)), fn(project(lst, 3)), sum(project(lst, 4))];
        } else {
            // [[golferId, size, submitted, score]...] -> [golferId, sum(size...), max(submitted...), fn(score...), length(...)]
            newFn = lst => lst.length == 1 ? lst[0].concat(1) : [lst[0][0], sum(project(lst, 1)), max(project(lst, 2)), fn(project(lst, 3)), lst.length];
        }
        for (const list of this.values()) {
            yield newFn(list);
        }
    }
}

// significance of S_a (the shortest solution among all languages in this hole)
const ScoringTypes = {
    Individual: () => 0,
    Common: () => 1,
    Bayesian: count => 1/(Math.sqrt(count) + 3),
};

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

        this.solutions = solutions; // holes -> langs -> [golferId, size, submitted, score]
        this.holes = holes;
        this.langs = langs;
        this.golfers = golfers;
        this.lastSubmitted = lastSubmitted;

        this.prettyHoles = holes.map(prettifyName);
        this.prettyLangs = langs.map(prettifyName);

        this.bestSolutions = solutions.map(solutions_h => solutions_h.map(solutions_hl => minBy(solutions_hl, 1) || [null, 0, 0, 0]));
        this.updateSolutionsScores(ScoringTypes.Bayesian);
    }

    updateSolutionsScores(scoringType) {
        for (const [h, solutions_h] of this.solutions.entries()) {
            const bestSolutions_h = this.bestSolutions[h];
            const best_h = min(bestSolutions_h.map(solution => solution[1] || Infinity));

            for (const [l, solutions_hl] of solutions_h.entries()) {
                const best_hl = bestSolutions_h[l][1];
                const coef = scoringType(solutions_hl.length);
                const sb = (1 - coef) * best_hl + coef * best_h;
                for (const solution of solutions_hl) {
                    solution[3] = sb / solution[1];
                }
            }
        }
    }

    _gLangHoleScores(h, l) {
        return [this.solutions[h][l], this.bestSolutions[h][l][3]];
    }

    _gHoleScores(h, langScoring) {
        const scores = new Multimap();
        for (const solutions_hl of this.solutions[h]) {
            scores.addAll(solutions_hl);
        }
        return [scores.combine(langScoring), langScoring(project(this.bestSolutions[h], 3))];
    }

    _gLangScores(holeScoring, l) {
        const scores = new Multimap();
        for (const solutions_h of this.solutions) {
            scores.addAll(solutions_h[l]);
        }
        return [scores.combine(holeScoring), holeScoring(project(project(this.bestSolutions, l), 3))];
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
            .map((solution, h) => [h, ...solution.slice(1), this.golfers[solution[0]]]);
        return [scores, 1];
    }

    _lTotalScores(holeScoring) {
        const scores = [];
        for (const l of this.langs.keys()) {
            const bestSolutions_l = [...project(this.bestSolutions, l)];
            const missingHoles = [...this.holes.keys()].filter(h => bestSolutions_l[h][0] == undefined).map(h => this.prettyHoles[h]).sort();
            const size_l = sum(project(bestSolutions_l, 1));
            const submitted_l = max(project(bestSolutions_l, 2));
            const score_l = holeScoring(project(bestSolutions_l, 3));
            scores.push([l, size_l, submitted_l, score_l, this.holes.length - missingHoles.length, missingHoles]);
        };
        return [scores, holeScoring(this.holes.map(() => 1))];
    }

    langsRanking(h) {
        const scoresFn = h.toFixed ? this._lHoleScores : this._lTotalScores;
        const scores = scoresFn.call(this, h);
        return this._pretty(scores, this.prettyLangs);
    }

    _pretty([scores, perfectScore], names, count) {
        const board = nbest(scores, count, (a, b) => b[3] - a[3]);
        const inv = 1000 / perfectScore;
        return board.map(([participantId, size, submitted, score, ...rest]) => [names[participantId], size, submitted, score * inv, ...rest]);
    }

    heatMap() {
        const sortedHs = argsort(this.solutions.map(solutions_h => -sum(project(solutions_h, "length"))));
        const sortedLs = argsort(this.langs.map((_, l) => -sum(project(project(this.solutions, l), "length"))));
        const map = sortedHs.map(h => sortedLs.map(l => this.solutions[h][l].length));
        const holes = sortedHs.map(h => this.prettyHoles[h]);
        const langs = sortedLs.map(l => this.prettyLangs[l]);
        return { map, holes, langs };
    }

    golferLanguages(golferId) {
        const scores = [];
        for (const l of model.langs.keys()) {
            let score = 0, size = 0, count = 0, submitted = 0;
            for (const h of model.holes.keys())
                for (const sol of model.solutions[h][l])
                    if (sol[0] == golferId) {
                        size += sol[1];
                        count++;
                        submitted = Math.max(sol[2], submitted);
                        score += model.bestSolutions[h][l][1] / sol[1];
                    }
            if (count) {
                scores.push([l, size, submitted, score, count]);
            }
        }
        return this._pretty([scores, 1], this.prettyLangs);
    }
}
