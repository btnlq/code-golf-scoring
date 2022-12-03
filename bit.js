class Writer {
    constructor() {
        this.arr = [];
        this.bits = 0;
        this.bitsCount = 0;
    }

    write(n, len) {
        while (this.bitsCount + len >= 16) {
            const toWrite = 16 - this.bitsCount;
            const value = this.bits | (((1 << toWrite) - 1 & n) << this.bitsCount);
            n >>= toWrite;
            len -= toWrite;

            if ((value & 0x7800) == 0x5800) {
                this.arr.push(value & 0x7FFF);
                this.bits = value >> 15;
                this.bitsCount = 1;
            } else {
                this.arr.push(value);
                this.bits = 0;
                this.bitsCount = 0;
            }
        }
        this.bits |= n << this.bitsCount;
        this.bitsCount += len;
    }

    // n >= 0
    writeUnary(n) {
        this.write(0, n);
        this.write(1, 1);
    }

    // x >= 0
    writeLong(x, len) {
        const n = (x >> len) + 1;
        const r = 31 - Math.clz32(n);
        this.writeUnary(r);
        this.write(n - (1 << r), r);
        this.write(x & (1 << len) - 1, len);
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

class Reader {
    constructor(s) {
        this.s = s;
        this.pos = 0;
        this.bits = 0;
        this.bitsCount = 0;
    }

    read(len) {
        let value = 0;
        let valueLen = 0;

        while (valueLen + this.bitsCount < len) {
            value |= this.bits << valueLen;
            valueLen += this.bitsCount;

            const code = this.s.charCodeAt(this.pos++);
            if ((code & 0x7800) == 0x5800) {
                this.bits = code & 0x7fff;
                this.bitsCount = 15;
            } else {
                this.bits = code;
                this.bitsCount = 16;
            }
        }

        len -= valueLen;
        value |= (this.bits & (1 << len) - 1) << valueLen;
        this.bitsCount -= len;
        this.bits >>= len;

        return value;
    }

    // dangerous for len > 16
    unread(n, len) {
        this.bits = (this.bits << len) + n;
        this.bitsCount += len;
    }

    readUnary() {
        let r = 0;
        while (this.read(1) == 0) ++r;
        return r;
    }

    readLong(len) {
        const r = this.readUnary();
        const gamma = ((1 << r) | this.read(r)) - 1;
        return (gamma << len) | this.read(len);
    }
}
