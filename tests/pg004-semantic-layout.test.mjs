import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg004_sec001.html", root), "utf8");
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

test("page 4 uses responsive semantic acknowledgements markup", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /class="contributors"/);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg004_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 4 preserves approved narration IDs, exact text, and order", () => {
    let previous = -1;
    for (let index = 1; index <= 26; index += 1) {
        const id = `pg004_p${String(index).padStart(3, "0")}`;
        assert.equal((html.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1, id);
        assert.equal(typeof audios[id], "string", `${id} audio mapping`);
        assert.ok(html.includes(texts[id].replaceAll("&", "&amp;")) || html.includes(texts[id]), `${id} exact fallback text`);
        const position = html.indexOf(`data-id="${id}"`);
        assert.ok(position > previous, `${id} reading order`);
        previous = position;
    }
});

test("page 4 keeps visible narration elements available for timed word highlighting", () => {
    for (let index = 1; index <= 26; index += 1) {
        const id = `pg004_p${String(index).padStart(3, "0")}`;
        const location = html.indexOf(`data-id="${id}"`);
        const nearby = html.slice(Math.max(0, location - 100), location + 100);
        assert.doesNotMatch(nearby, /narration-source|visually-hidden|aria-hidden="true"/, id);
    }
});

test("page 4 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg004_sec001.html"], html);
});
