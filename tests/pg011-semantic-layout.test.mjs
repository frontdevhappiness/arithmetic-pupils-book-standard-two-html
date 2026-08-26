import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg011_sec001.html", root), "utf8");
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

test("page 11 uses responsive semantic number tables", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.equal((html.match(/<table class="number-table/g) || []).length, 2);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg011_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 11 preserves approved narration IDs, exact text, audio, and order", () => {
    const secondTableIds = [
        ...Array.from({ length: 107 }, (_, index) => `pg011_p${String(index + 107).padStart(3, "0")}`),
        "pg011_p244",
        ...Array.from({ length: 17 }, (_, index) => `pg011_p${String(index + 214).padStart(3, "0")}`),
        "pg011_p245",
        ...Array.from({ length: 11 }, (_, index) => `pg011_p${String(index + 231).padStart(3, "0")}`),
    ];
    const ids = [
        "pg011_p001", "pg011_p002", "pg011_p003",
        ...Array.from({ length: 100 }, (_, index) => `pg011_p${String(index + 4).padStart(3, "0")}`),
        "pg011_p104", "pg011_p105",
        ...secondTableIds,
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

test("page 11 tables contain every printed row", () => {
    const bodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].map((match) => match[1]);
    assert.equal(bodies.length, 2);
    assert.equal((bodies[0].match(/<tr>/g) || []).length, 10);
    assert.equal((bodies[1].match(/<tr>/g) || []).length, 15);
    assert.match(bodies[0], /data-id="pg011_p004">401<\/td>/);
    assert.match(bodies[0], /data-id="pg011_p103">500<\/td>/);
    assert.match(bodies[1], /data-id="pg011_p107">501<\/td>/);
    assert.match(bodies[1], /data-id="pg011_p241">665<\/td>/);
});

test("page 11 retains natural separate audio at 630–631 and 650–651", () => {
    assert.match(html, /data-id="pg011_p213">630<\/td><td data-id="pg011_p244">631<\/td><td data-id="pg011_p214">632<\/td>/);
    assert.match(html, /data-id="pg011_p230">650<\/td><td data-id="pg011_p245">651<\/td><td colspan="2" data-id="pg011_p231">652 653<\/td>/);
    assert.equal(audios.pg011_p244, "pg011_p244.mp3");
    assert.equal(audios.pg011_p245, "pg011_p245.mp3");
});

test("page 11 avoids duplicate full-table image narration", () => {
    assert.doesNotMatch(html, /data-id="pg011_im001"/);
});

test("page 11 uses measured original colours and preserves highlight font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /--table-blue: #2a3c9a/);
    assert.match(html, /--page-marker-blue: #00aeef/);
    assert.match(html, /\.numbers-page \[data-id\] span/);
});

test("page 11 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg011_sec001.html"], html);
});
