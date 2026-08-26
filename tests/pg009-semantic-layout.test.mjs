import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg009_sec001.html", root), "utf8");
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

test("page 9 uses a responsive semantic illustration and number table", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /class="game-figure"/);
    assert.match(html, /<table class="number-table"/);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg009_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 9 preserves approved narration IDs, exact text, audio, and order", () => {
    const ids = [
        "pg009_im001",
        ...Array.from({ length: 10 }, (_, index) => `pg009_p${String(index + 46).padStart(3, "0")}`),
        "pg009_p001", "pg009_p002", "pg009_p003", "pg009_p004",
        ...Array.from({ length: 40 }, (_, index) => `pg009_p${String(index + 6).padStart(3, "0")}`),
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

test("page 9 describes the game once and does not duplicate the Question box", () => {
    assert.equal((html.match(/data-id="pg009_im001"/g) || []).length, 1);
    assert.equal((html.match(/data-id="pg009_p001"/g) || []).length, 1);
    assert.equal((html.match(/data-id="pg009_p002"/g) || []).length, 1);
    assert.doesNotMatch(html, /data-id="pg009_im002"/);
});

test("page 9 table represents all five printed rows", () => {
    const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    assert.equal((tbody.match(/<tr>/g) || []).length, 5);
    assert.match(tbody, /data-id="pg009_p006">151<\/td>/);
    assert.match(tbody, /data-id="pg009_p045">200<\/td>/);
    assert.match(tbody, /colspan="2" data-id="pg009_p007"/);
});

test("page 9 uses measured original book colours and preserves highlight font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /--table-blue: #2a3c9a/);
    assert.match(html, /\.numbers-page \[data-id\] span/);
});

test("page 9 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg009_sec001.html"], html);
});
