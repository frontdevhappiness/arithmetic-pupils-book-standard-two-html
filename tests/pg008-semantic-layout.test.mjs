import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg008_sec001.html", root), "utf8");
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

test("page 8 uses a responsive semantic number-table layout", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /class="exercise-card/);
    assert.match(html, /<table class="number-table"/);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg008_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 8 preserves approved narration IDs, exact text, audio, and order", () => {
    const ids = [
        "pg008_p001", "pg008_p002", "pg008_p003", "pg008_p004", "pg008_p005", "pg008_p006",
        ...Array.from({ length: 40 }, (_, index) => `pg008_p${String(index + 8).padStart(3, "0")}`),
        "pg008_p048", "pg008_p049", "pg008_p050",
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

test("page 8 table represents all five printed rows without duplicate image narration", () => {
    const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    assert.equal((tbody.match(/<tr>/g) || []).length, 5);
    assert.match(tbody, /data-id="pg008_p008">101<\/td>/);
    assert.match(tbody, /data-id="pg008_p047">149 150<\/td>/);
    assert.match(tbody, /colspan="2" data-id="pg008_p012"/);
    assert.doesNotMatch(html, /data-id="pg008_im001"|data-id="pg008_im003"/);
});

test("page 8 highlight wrappers retain the Sassoon Primary font", () => {
    assert.match(html, /\.numbers-page \[data-id\] span/);
});

test("page 8 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg008_sec001.html"], html);
});
