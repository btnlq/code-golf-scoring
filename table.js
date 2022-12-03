class Table {
    constructor(table) {
        this.table = table;
        this.columns = [];
    }

    add(header, renderer, alignLeft) {
        this.columns.push([header, renderer, alignLeft]);
    }    

    static place(source) {
        let place = 0, realPlace = 0, prevValue = -1;
        return (cell, data) => {
            place++;
            const value = source(data);
            if (value != prevValue)
                realPlace = place, prevValue = value;
            cell.innerText = realPlace;
        };
    }

    static text(source) {
        return (cell, data) => cell.innerText = source(data);
    }

    static date(source) {
        return (cell, data) => {
            const [fullText, prettyText] = prettyDate(source(data));
            cell.innerHTML = `<span title="${fullText}">${prettyText}</span>`;
        };
    }

    render(items) {
        const header = this.table.tHead;
        header.innerHTML = "";

        const body = this.table.tBodies[0];
        body.innerHTML = "";

        if (!items || items.length == 0)
            return;

        const headerRow = header.insertRow();
        for (const [header, _, alignLeft] of this.columns) {
            const cell = addTh(headerRow, header);
            if (alignLeft)
                cell.classList.add("left");
        }

        for (const item of items) {
            const row = body.insertRow();
            for (const [_, renderer, alignLeft] of this.columns) {
                const cell = row.insertCell();
                renderer(cell, item);
                if (alignLeft)
                    cell.classList.add("left");
            }            
        }
    }
}
