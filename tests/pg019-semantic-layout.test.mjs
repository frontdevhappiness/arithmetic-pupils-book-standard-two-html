import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg019_sec001.html", import.meta.url), "utf8");
const audios = JSON.parse(fs.readFileSync(new URL("../content/i18n/en-GB/audios.json", import.meta.url), "utf8"));
const offlineSource = fs.readFileSync(new URL("../assets/offline-data.js", import.meta.url), "utf8");

function offlineHtml(path) {
    const prefix = "  var INLINE = ";
    const suffix = ";\n  var BASE_DIR";
    const start = offlineSource.indexOf(prefix) + prefix.length;
    const end = offlineSource.indexOf(suffix, start);
    return JSON.parse(offlineSource.slice(start, end))[path];
}

test("page 19 uses responsive semantic HTML", () => {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /class="lesson-page"/);
    assert.doesNotMatch(html, /pg019_page_hq_pdf_clean/);
    assert.doesNotMatch(html, /data-fl-reference-width/);
});

test("page 19 preserves every approved visible text ID", () => {
    const missing = new Set([18]);
    for (let number = 0; number <= 37; number += 1) {
        if (missing.has(number)) continue;
        const id = `pg019_p${String(number).padStart(3, "0")}`;
        assert.match(html, new RegExp(`data-id="${id}"`), `${id} is missing`);
    }
});

test("page 19 retains the approved male narration mappings", () => {
    for (const number of [5, 7, 9, 11, 13, 15, 20, 22, 24, 26, 28, 30, 32, 34, 36, 37]) {
        const id = `pg019_p${String(number).padStart(3, "0")}`;
        assert.match(audios[id], /male_commas_free_tts\.mp3$/, `${id} must retain its approved male clip`);
    }
});

test("page 19 keeps blanks and commas in every sequence", () => {
    for (const number of [5, 7, 9, 11, 13, 15, 20, 22, 24, 26, 28, 30, 32, 34, 36, 37]) {
        const id = `pg019_p${String(number).padStart(3, "0")}`;
        const start = html.indexOf(`data-id="${id}"`);
        const end = html.indexOf("</span>", start);
        const fragment = html.slice(start, number === 37 ? html.indexOf("</span></div>", start) : end);
        assert.match(fragment, /_____/);
        assert.match(fragment, /,/);
    }
});

test("page 19 reads each visual column from top to bottom", () => {
    for (const ids of [[4, 8, 12, 6, 10, 14], [19, 23, 27, 31, 35, 21, 25, 29, 33, 37]]) {
        const positions = ids.map((number) => html.indexOf(`data-id="pg019_p${String(number).padStart(3, "0")}"`));
        assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    }
});

test("page 19 excludes duplicate image narration and printer metadata", () => {
    assert.doesNotMatch(html, /data-id="pg019_im/);
    assert.doesNotMatch(html, /data-id="pg019_p0(?:38|39)"/);
});

test("page 19 preserves original colours and highlighted font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /\.lesson-page \[data-id\] span \{ font-family: inherit !important;/);
});

test("page 19 offline copy matches the source HTML", () => {
    assert.equal(offlineHtml("./pg019_sec001.html"), html);
});
