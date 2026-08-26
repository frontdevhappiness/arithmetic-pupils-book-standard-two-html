import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg017_sec001.html", import.meta.url), "utf8");
const audios = JSON.parse(fs.readFileSync(new URL("../content/i18n/en-GB/audios.json", import.meta.url), "utf8"));
const offlineSource = fs.readFileSync(new URL("../assets/offline-data.js", import.meta.url), "utf8");

function offlineHtml(path) {
    const prefix = "  var INLINE = ";
    const suffix = ";\n  var BASE_DIR";
    const start = offlineSource.indexOf(prefix) + prefix.length;
    const end = offlineSource.indexOf(suffix, start);
    return JSON.parse(offlineSource.slice(start, end))[path];
}

test("page 17 uses responsive semantic HTML", () => {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /class="exercise-page"/);
    assert.doesNotMatch(html, /pg017_page_hq_pdf_clean/);
    assert.doesNotMatch(html, /data-fl-reference-width/);
});

test("page 17 preserves every approved visible text ID", () => {
    for (let number = 0; number <= 50; number += 1) {
        if ([18, 26].includes(number)) continue;
        const id = `pg017_p${String(number).padStart(3, "0")}`;
        assert.match(html, new RegExp(`data-id="${id}"`), `${id} is missing`);
    }
});

test("Exercise 3 retains corrected male comma and blank narration", () => {
    for (let number = 19; number <= 23; number += 1) {
        const id = `pg017_p${String(number).padStart(3, "0")}`;
        assert.match(audios[id], /male_commas_free_tts\.mp3$/);
        assert.match(html, new RegExp(`data-id="${id}"[^>]*>[^<]*,`));
        assert.match(html, new RegExp(`data-id="${id}"[^>]*>[^<]*_____`));
    }
});

test("Exercise 4 reads the left column before the right column", () => {
    const ids = [...html.matchAll(/data-id="(pg017_p(?:027|032|037|042|047|029|030|034|035|039|040|044|045|049))"/g)].map(match => match[1]);
    assert.deepEqual(ids, ["pg017_p027", "pg017_p032", "pg017_p037", "pg017_p042", "pg017_p047", "pg017_p029", "pg017_p030", "pg017_p034", "pg017_p035", "pg017_p039", "pg017_p040", "pg017_p044", "pg017_p045", "pg017_p049"]);
});

test("page 17 does not narrate duplicate images or printer metadata", () => {
    assert.doesNotMatch(html, /data-id="pg017_im/);
    assert.doesNotMatch(html, /data-id="pg017_p05[12]"/);
});

test("page 17 preserves original colours and highlighted font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /\.exercise-page \[data-id\] span \{ font-family: inherit !important;/);
    assert.match(html, /\.sequence-list li::before, \.prompt\[data-question\]::before/);
    assert.match(html, /\.after-row \{ display: flex;/);
    assert.match(html, /\.answer-line \{ flex: 0 0 clamp\(4\.5rem, 12vw, 7rem\); height: 0;/);
});

test("page 17 offline copy matches the source HTML", () => {
    assert.equal(offlineHtml("./pg017_sec001.html"), html);
});
