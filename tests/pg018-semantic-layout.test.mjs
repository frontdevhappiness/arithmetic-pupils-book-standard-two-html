import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg018_sec001.html", import.meta.url), "utf8");
const audios = JSON.parse(fs.readFileSync(new URL("../content/i18n/en-GB/audios.json", import.meta.url), "utf8"));
const offlineSource = fs.readFileSync(new URL("../assets/offline-data.js", import.meta.url), "utf8");

function offlineHtml(path) {
    const prefix = "  var INLINE = ";
    const suffix = ";\n  var BASE_DIR";
    const start = offlineSource.indexOf(prefix) + prefix.length;
    const end = offlineSource.indexOf(suffix, start);
    return JSON.parse(offlineSource.slice(start, end))[path];
}

test("page 18 uses responsive semantic HTML", () => {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /class="lesson-page"/);
    assert.doesNotMatch(html, /pg018_page_hq_pdf_clean/);
    assert.doesNotMatch(html, /data-fl-reference-width/);
});

test("page 18 preserves every approved visible text ID", () => {
    const missing = new Set([4, 13, 66]);
    for (let number = 0; number <= 78; number += 1) {
        if (missing.has(number)) continue;
        const id = `pg018_p${String(number).padStart(3, "0")}`;
        assert.match(html, new RegExp(`data-id="${id}"`), `${id} is missing`);
    }
});

test("page 18 retains the approved narration mappings", () => {
    for (const number of [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 24, 34, 44, 54, 64, 65, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78]) {
        const id = `pg018_p${String(number).padStart(3, "0")}`;
        assert.equal(typeof audios[id], "string", `${id} audio mapping is missing`);
    }
});

test("Exercise 5 keeps numbers and answer lines paired in order", () => {
    for (const start of [14, 24, 34, 44, 54]) {
        const first = `pg018_p${String(start).padStart(3, "0")}`;
        const answer = `pg018_p${String(start + 5).padStart(3, "0")}`;
        assert.ok(html.indexOf(first) < html.indexOf(answer), `${answer} must follow ${first}`);
    }
});

test("page 18 excludes duplicate image narration and printer metadata", () => {
    assert.doesNotMatch(html, /data-id="pg018_im/);
    assert.doesNotMatch(html, /data-id="pg018_p0(?:79|80)"/);
});

test("page 18 preserves original colours and highlighted font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /\.lesson-page \[data-id\] span \{ font-family: inherit !important;/);
    assert.match(html, /\.combined-question::before/);
});

test("page 18 offline copy matches the source HTML", () => {
    assert.equal(offlineHtml("./pg018_sec001.html"), html);
});
