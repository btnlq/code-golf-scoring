class Huffman {
    constructor(codes) {
        this.codes = codes;
    }

    static fromCounts(counts) {
        const nodes = counts.map((count, x) => [x, count]);
        while (nodes.length >= 2) {
            nodes.sort((a, b) => b[1] - a[1]);
            const [x1, count1] = nodes.pop();
            const [x2, count2] = nodes.pop();
            nodes.push([[x1, x2], count1 + count2]);
        }
        const codes = counts.map(_ => 0);
        function rec(node, bits, length) {
            if (Array.isArray(node)) {
                rec(node[0], bits, length + 1);
                rec(node[1], bits + (1 << length), length + 1);
            } else {
                codes[node] = [bits, length];
            }
        }
        rec(nodes[0][0], 0, 0);
        return new Huffman(codes);
    }

    write(writer, id) {
        const code = this.codes[id];
        writer.write(code[0], code[1]);
    }

    getReader() {
        return new HuffmanReader(this.codes);
    }
}

class HuffmanReader {
    constructor(codes) {
        this.lengths = codes.map(code => code[1]);
        this.maxLen = max(this.lengths);
        this.table = Array(1 << this.maxLen).fill(0);
        codes.forEach(([bits, length], id) => {
            for (; bits < this.table.length; bits += 1 << length)
                this.table[bits] = id;
        });
    }

    read(reader) {
        const code = reader.read(this.maxLen);
        const id = this.table[code];
        const codeLen = this.lengths[id];
        reader.unread(code >> codeLen, this.maxLen - codeLen);
        return id;
    }
}

class DynamicHuffmanWriter {
    constructor(counts) {
        this.totalCounts = counts;
        this.counts = [1];
        this._rebuild();
    }

    static fromList(list) {
        const weights = [];
        const firstPos = [];
        let pos = 0;
        for (const id of list) {
            if (id == weights.length) {
                weights.push(0);
                firstPos.push(pos);
            }
            weights[id]++;
            pos++;
        }
        const maxId = weights.indexOf(max(weights));
        for (let i = 0; i < weights.length; i++) {
            weights[i] /= pos - firstPos[i];
        }
        const coef = 255 / weights[maxId];
        for (let i = 0; i < weights.length; i++) {
            weights[i] = Math.max(1, Math.min(255, Math.round(weights[i] * coef)));
        }
        return new DynamicHuffmanWriter(weights);
    }

    write(writer, id) {
        this.writer.write(writer, id);

        if (id == this.counts.length - 1) {
            const count = this.totalCounts[id];
            writer.write(count, 8);
            this.counts[id] = count;
            this.counts.push(1);
            this._rebuild();
        }
    }

    _rebuild() {
        this.writer = Huffman.fromCounts(this.counts);
    }
}

class DynamicHuffmanReader {
    constructor() {
        this.counts = [1];
        this._rebuild();
    }

    read(reader) {
        const id = this.reader.read(reader);

        if (id == this.counts.length - 1) {
            this.counts[id] = reader.read(8);
            this.counts.push(1);
            this._rebuild();
        }

        return id;
    }

    _rebuild() {
        this.reader = Huffman.fromCounts(this.counts).getReader();
    }
}

class StringHuffmanWriter {
    constructor(writer, ...iterables) {
        const counts = [0];
        for (const iterable of iterables) {
            for (const s of iterable) {
                for (let i = 0; i < s.length; i++) {
                    const c = s.charCodeAt(i);
                    counts[c] = (counts[c] || 0) + 1;
                }
                counts[0]++;
            }
        }
        const lengths = Huffman.fromCounts(Object.values(counts)).codes.map(code => code[1]).sort((a, b) => a - b);
        const entries = [...Object.entries(counts)].sort((a, b) => b[1] - a[1]);

        let currentLength = 1;

        let bits = 0;
        this.codes = [];
        for (let i = 0; i < entries.length; i++) {
            const charCode = +entries[i][0];
            const length = lengths[i];
            this.codes[charCode] = [bits, length];

            writer.writeUnary(length - currentLength);
            currentLength = length;
            writer.writeLong(charCode, 7);

            let pos = 1 << length - 1;
            while (bits & pos) { bits -= pos; pos >>= 1; }
            bits += pos;
        }
    }

    write(writer, s) {
        for (let i = 0; i < s.length; i++) {
            const code = this.codes[s.charCodeAt(i)];
            writer.write(code[0], code[1]);
        }
        const code = this.codes[0];
        writer.write(code[0], code[1]);
    }
}

class StringHuffmanReader {
    constructor(reader) {
        let length = 1;
        let sum = 0;
        let bits = 0;
        const codes = [];
        this.names = [];
        while (sum < (1 << length)) {
            const shift = reader.readUnary();
            sum = (sum << shift) + 1;
            length += shift;
            this.names.push(reader.readLong(7));
            codes.push([bits, length]);

            let pos = 1 << length - 1;
            while (pos && bits & pos) { bits -= pos; pos >>= 1; }
            if (!pos) break;
            bits += pos;
        }

        this.reader = new HuffmanReader(codes);
    }

    read(reader) {
        const arr = [];
        let id;
        while (id = this.reader.read(reader)) {
            arr.push(this.names[id]);
        }
        return String.fromCharCode(...arr);
    }
}
