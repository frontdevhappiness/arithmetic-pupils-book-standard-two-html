import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg007_sec001.html", root), "utf8");
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

test("page 7 uses a responsive semantic chapter layout", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /class="chapter-banner"/);
    assert.match(html, /class="song-stanza"/);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg007_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 7 preserves approved narration IDs, exact text, and order", () => {
    const ids = [
        "pg007_p023", "pg007_p024", "pg007_p021", "pg007_p001", "pg007_p002",
        "pg007_p005", "pg007_p006", "pg007_p007", "pg007_p008", "pg007_p011",
        "pg007_p012", "pg007_p013", "pg007_p016", "pg007_p017", "pg007_p018",
    ];
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

test("page 7 does not repeat the chapter announcement through the old artwork description", () => {
    assert.doesNotMatch(html, /data-id="pg007_im001"/);
    assert.equal((html.match(/data-id="pg007_p023"/g) || []).length, 1);
    assert.equal((html.match(/data-id="pg007_p024"/g) || []).length, 1);
    assert.equal((html.match(/data-id="pg007_p021"/g) || []).length, 1);
});

test("page 7 keeps standard mathematical wording for every displayed number", () => {
    assert.equal(texts.pg007_p008, "One hundred and one, one hundred and two, one hundred and three, one hundred and four, one hundred and five.");
    assert.equal(texts.pg007_p013, "One hundred and six, one hundred and seven, one hundred and eight, one hundred and nine, one hundred and ten.");
    assert.equal(texts.pg007_p018, "One hundred and eleven, one hundred and twelve, one hundred and thirteen, one hundred and fourteen, one hundred and fifteen.");
    assert.equal(audios.pg007_p001, "pg007_p001_adt_standard.mp3");
});

test("page 7 highlight wrappers retain the Sassoon Primary font", () => {
    assert.match(html, /\.chapter-page \[data-id\] span/);
});

test("page 7 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg007_sec001.html"], html);
});
