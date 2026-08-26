import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg016_sec001.html", root), "utf8");
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

test("page 16 uses a responsive semantic chapter layout", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /class="chapter-banner"/);
    assert.equal((html.match(/class="content-card"/g) || []).length, 2);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg016_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 16 preserves chapter and body narration order", () => {
    const ids = ["pg016_p058", "pg016_p059", "pg016_p056", "pg016_p001", "pg016_p003", "pg016_p005", "pg016_p006", "pg016_p007", "pg016_p008", "pg016_p009", "pg016_p010"];
    let previous = -1;
    for (const id of ids) {
        assert.equal((html.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1, id);
        assert.equal(typeof audios[id], "string", `${id} audio mapping`);
        assert.ok(html.includes(texts[id]), `${id} exact fallback text`);
        const position = html.indexOf(`data-id="${id}"`);
        assert.ok(position > previous, `${id} reading order`);
        previous = position;
    }
});

test("page 16 contains all four ordering questions without supplying answers", () => {
    assert.equal((html.match(/class="ordering-question"/g) || []).length, 4);
    assert.equal((html.match(/class="given-number"/g) || []).length, 20);
    assert.equal((html.match(/class="answer-slot"/g) || []).length, 20);
    for (let number = 12; number <= 55; number += 1) {
        if (number === 11) continue;
        const id = `pg016_p${String(number).padStart(3, "0")}`;
        assert.equal((html.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1, id);
        assert.ok(html.includes(texts[id]), `${id} exact printed text`);
    }
});

test("page 16 retains the corrected question four clip", () => {
    assert.equal(audios.pg016_p045, "pg014_p019_adt_clean.mp3");
});

test("page 16 omits duplicate image narration and printer metadata", () => {
    assert.doesNotMatch(html, /data-id="pg016_im\d+"/);
    assert.doesNotMatch(html, /data-id="pg016_p06[01]"/);
});

test("page 16 uses original colours and preserves highlight font", () => {
    assert.match(html, /--chapter-title-blue: #00aeef/);
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /\.chapter-page \[data-id\] span/);
});

test("page 16 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg016_sec001.html"], html);
});
