function addTh(row, text) {
    const cell = row.insertCell();
    cell.textContent = text;
    cell.outerHTML = "<th>" + cell.innerHTML + "</th>";
}

function initHeatMap() {
    if (model == null) {
        return;
    }

    const table = $("heatMap");
    if (table.rows.length == 0) {
        const heatMap = model.heatMap();

        const body = table.tBodies[0];

        const header = body.insertRow();
        addTh(header, "");
        for (const lang of heatMap.langs) {
            addTh(header, lang);
        }
        for (const [h, hole] of heatMap.holes.entries()) {
            const row = body.insertRow();
            addTh(row, hole);
            for (const count of heatMap.map[h]) {
                const cell = row.insertCell();
                cell.innerHTML = count < 100 ? count : `<small>${count}</small>`;
                const hue = (1 - Math.atan(count / 16) / Math.PI * 2) * 270;
                cell.style.backgroundColor = `hsl(${hue}, 100%, 70%)`;
            }
        }
    }
}
