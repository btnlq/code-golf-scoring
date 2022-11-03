function min(seq) {
    let s = Infinity;
    for (const x of seq)
        if (s > x)
            s = x;
    return s;
}

function max(seq, init) {
    let s = init === undefined ? 0 : init;
    for (const x of seq)
        if (s < x)
            s = x;
    return s;
}

function sum(seq) {
    let s = 0;
    for (const x of seq)
        s += x;
    return s;
}

function pNorm(p) {
    return function(seq) {
        let s = 0;
        for (const x of seq)
            s += Math.pow(x, p);
        return Math.pow(s, 1/p);
    }
}

function nbest(seq, n, compareFn) {
    seq = Array.from(seq).sort(compareFn);
    if (n !== undefined && seq.length > n)
        seq.length = n;
    return seq;
}

function *project(seq, i) {
    for (const x of seq)
        yield x[i];
}

function minBy(arr, i) {
    if (arr.length == 0)
        return null;
    let bestX = arr[0];
    for (const x of arr) {
        if (x[i] < bestX[i])
            bestX = x;
    }
    return bestX;
}

function argsort(arr) {
    return Array.from(arr.keys()).sort((a, b) => arr[a] - arr[b]);
}
