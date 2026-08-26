import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg015_sec001.html", root), "utf8");
const texts = JSON.parse(fs.readFileSync(new URL("content/i18n/en-GB/texts.json", root), "utf8"));
const audios = JSON.parse(fs.readFileSync(new URL("content/i18n/en-GB/audios.json", root), "utf8"));

function offlineFiles() {
    const source = fs.readFileSync(new URL("assets/offline-data.js", root), "utf8");
    const prefix = "  var INLINE = ";
    const suffix = ";\n  var BASE_DIR";
    const start = source.indexOf(prefix) + prefix.length;
    const end = source.indexOf(suffix, start);
    return JSON.parse(source.slice(start, end));
}

test("page 15 uses responsive semantic continuation layout", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /class="continuation-card"/);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg015_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 15 preserves approved narration text, audio, and order", () => {
    let previous = -1;
    for (let number = 1; number <= 13; number += 1) {
        const id = `pg015_p${String(number).padStart(3, "0")}`;
        assert.equal((html.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1, id);
        assert.equal(typeof audios[id], "string", `${id} audio mapping`);
        assert.ok(html.includes(texts[id]), `${id} exact fallback text`);
        const position = html.indexOf(`data-id="${id}"`);
        assert.ok(position > previous, `${id} reading order`);
        previous = position;
    }
});

test("page 15 contains every printed question and answer line", () => {
    assert.equal((html.match(/class="exercise-item mirrored-entry"/g) || []).length, 13);
    assert.equal((html.match(/class="visual-question"/g) || []).length, 13);
    assert.equal((html.match(/class="visual-answer-line"/g) || []).length, 13);
    assert.match(html, />8\.<\/span><span>Four hundred and ninety</);
    assert.match(html, />20\.<\/span><span>Eight hundred and thirteen</);
});

test("page 15 keeps corrected clean narration clips", () => {
    assert.equal(audios.pg015_p002, "pg015_p002_adt_clean.mp3");
    assert.equal(audios.pg015_p003, "pg015_p003_adt_clean.mp3");
    assert.equal(audios.pg015_p005, "pg015_p005_adt_clean.mp3");
    assert.equal(audios.pg015_p006, "pg015_p006_adt_clean.mp3");
});

test("page 15 omits duplicate page imagery and printer metadata", () => {
    assert.doesNotMatch(html, /data-id="pg015_im\d+"/);
    assert.doesNotMatch(html, /data-id="pg015_p01[45]"/);
});

test("page 15 uses original colours and preserves font while highlighting", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /--page-marker-blue: #00aeef/);
    assert.match(html, /\.writing-page \.mirrored-entry span/);
    assert.match(html, /pg015-word-active/);
});

test("page 15 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg015_sec001.html"], html);
});
