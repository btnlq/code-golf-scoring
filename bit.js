class BitWriter {
    constructor() {
        this.arr = [];
        this.bits = 0;
        this.bitsCount = 0;
    }

    write(n, len) {
        this.bits |= n << this.bitsCount;
        this.bitsCount += len;
        while (this.bitsCount >= 16) {
            if ((this.bits & 0x7800) == 0x5800) {
                this.arr.push(this.bits & 0x7FFF);
                this.bits >>= 15;
                this.bitsCount -= 15;
            } else {
                this.arr.push(this.bits & 0xFFFF);
                this.bits >>= 16;
                this.bitsCount -= 16;
            }
        }
    }

    // n >= 0
    writeUnary(n) {
        this.write(0, n);
        this.write(1, 1);
    }

    // n >= 0
    writeGamma(n) {
        const r = 31 - Math.clz32(++n);
        this.writeUnary(r);
        this.write(n - (1 << r), r);
    }

    toString() {
        this.write(0, 15);

        const parts = [];
        const len = this.arr.length;
        for (let i = 0; i < len; i += 2048) {
            parts.push(String.fromCharCode.apply(null, this.arr.slice(i, i + 2048)));
        }
        return parts.join("");
    }
}

class BitReader {
    constructor(s) {
        this.s = s;
        this.pos = 0;
        this.bits = 0;
        this.bitsCount = 0;
    }

    read(n) {
        while (n > this.bitsCount) {
            let value = this.s.charCodeAt(this.pos++);
            if ((value & 0x7800) == 0x5800) {
                this.bits |= (value & 0x7fff) << this.bitsCount;
                this.bitsCount += 15;
            } else {
                this.bits |= value << this.bitsCount;
                this.bitsCount += 16;
            }
        }
        const bits = this.bits & (1 << n) - 1;
        this.bitsCount -= n;
        this.bits >>= n;
        return bits;
    }

    readUnary() {
        let r = 0;
        while (this.read(1) == 0) ++r;
        return r;
    }

    readGamma() {
        const r = this.readUnary();
        return ((1 << r) | this.read(r)) - 1;
    }
}

class Writer {
    constructor() {
        this.writer = new BitWriter();
    }

    write(x, len) {
        this.writer.write(x, len);
    }

    // x >= 0
    writeShort(x) {
        this.writer.writeGamma(x);
    }

    // x >= 0
    writeLong(x, k) {
        this.writer.writeGamma(x >> k);
        this.writer.write(x & (1 << k) - 1, k);
    }

    writeString(s) {
        const len = s.length - 1;
        this.writer.writeUnary(len >> 3);
        this.writer.write(len & 7, 3);
        for (let i = 0; i <= len; i++) {
            const c = s.charCodeAt(i);
            const b =
                97 <= c && c <= 122 ? c - 97 : // 'a'..'z' -> 0..25
                65 <= c && c <= 90 ? c - 39 : // 'A'..'Z' -> 26..51
                48 <= c && c <= 57 ? c + 4 : // '0'..'9' -> 52..61
                c == 45 ? 62 : 63; // '-' -> 62
            this.writer.write(b, 6);
            if (b == 63)
                this.writer.write(c, 16);
        }
    }

    toString() {
        return this.writer.toString();
    }
}

class Reader {
    constructor(s) {
        this.reader = new BitReader(s);
    }

    read(n) {
        return this.reader.read(n);
    }

    readShort() {
        return this.reader.readGamma();
    }

    readLong(k) {
        return (this.reader.readGamma() << k) | this.read(k);
    }

    readString() {
        const len = ((this.reader.readUnary() << 3) | this.read(3)) + 1;
        const arr = [];
        for (let i = 0; i < len; i++) {
            const b = this.reader.read(6);
            const c =
                b < 26 ? b + 97 :
                b < 52 ? b + 39 :
                b < 62 ? b - 4 :
                b == 62 ? 45 : this.reader.read(16);
            arr.push(c);
        }
        return String.fromCharCode(...arr);
    }
}

class EnumWriter {
    constructor() {
        this.map = new Map();
        this.bitLength = 0;
    }

    write(writer, s) {
        const size = this.map.size;
        let x = this.map.get(s);
        if (x == undefined) x = size;

        const extra = (x | (1 << this.bitLength)) <= size;
        writer.write(x, this.bitLength + extra);

        if (x == size) {
            this.map.set(s, size);
            if (size + 1 >= (2 << this.bitLength)) {
                this.bitLength++;
            }
            writer.writeString(s);
        }
    }
}

class EnumReader {
    constructor() {
        this.arr = [];
        this.bitLength = 0;
    }

    read(reader) {
        const size = this.arr.length;
        let x = reader.read(this.bitLength);

        if (x + (1 << this.bitLength) <= size)
            x |= reader.read(1) << this.bitLength;

        if (x == size) {
            this.arr.push(reader.readString());
            if (size + 1 >= (2 << this.bitLength)) {
                this.bitLength++;
            }
        }
        return x;
    }
}
