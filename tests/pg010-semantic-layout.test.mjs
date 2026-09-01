import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg010_sec001.html", root), "utf8");
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

test("page 10 uses responsive semantic number tables", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.equal((html.match(/<table class="number-table"/g) || []).length, 2);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg010_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 10 preserves approved narration IDs, exact text, audio, and order", () => {
    const ids = [
        "pg010_p001", "pg010_p002", "pg010_p003",
        ...Array.from({ length: 100 }, (_, index) => `pg010_p${String(index + 4).padStart(3, "0")}`),
        "pg010_p104", "pg010_p105",
        ...Array.from({ length: 100 }, (_, index) => `pg010_p${String(index + 107).padStart(3, "0")}`),
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

test("page 10 tables contain every number once in printed row order", () => {
    const bodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].map((match) => match[1]);
    assert.equal(bodies.length, 2);
    assert.equal((bodies[0].match(/<tr>/g) || []).length, 10);
    assert.equal((bodies[1].match(/<tr>/g) || []).length, 10);
    assert.match(bodies[0], /data-id="pg010_p004">201<\/td>/);
    assert.match(bodies[0], /data-id="pg010_p103">300<\/td>/);
    assert.match(bodies[1], /data-id="pg010_p107">301<\/td>/);
    assert.match(bodies[1], /data-id="pg010_p206">400<\/td>/);
});

test("page 10 describes both tables without restoring duplicate table images", () => {
    assert.match(html, /<span class="sr-only" data-id="pg010_im001">Table description\./);
    assert.equal(audios.pg010_im001, "pg010_im001_table_description.mp3");
    assert.match(html, /<span class="sr-only" data-id="pg010_im002">Table description\./);
    assert.equal(audios.pg010_im002, "pg010_im002_table_description.mp3");
});

test("page 10 preserves the corrected audio mapping for 360", () => {
    assert.equal(texts.pg010_p166, "360");
    assert.equal(audios.pg010_p166, "pg010_p166.mp3");
    assert.match(html, /data-id="pg010_p166">360<\/td>/);
});

test("page 10 uses measured original colours and preserves highlight font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /--table-blue: #2a3c9a/);
    assert.match(html, /--page-marker-blue: #00aeef/);
    assert.match(html, /\.numbers-page \[data-id\] span/);
});

test("page 10 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg010_sec001.html"], html);
});
