import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg003_sec001.html", root), "utf8");
const texts = JSON.parse(
    fs.readFileSync(new URL("content/i18n/en-GB/texts.json", root), "utf8"),
);
const audios = JSON.parse(
    fs.readFileSync(new URL("content/i18n/en-GB/audios.json", root), "utf8"),
);

function offlineFiles() {
    const source = fs.readFileSync(new URL("assets/offline-data.js", root), "utf8");
    const prefix = "  var INLINE = ";
    const suffix = ";\n  var BASE_DIR";
    const start = source.indexOf(prefix) + prefix.length;
    const end = source.indexOf(suffix, start);
    return JSON.parse(source.slice(start, end));
}

test("page 3 uses responsive semantic contents markup", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /<nav aria-label="Book contents">/);
    assert.equal((html.match(/<section class="chapter">/g) || []).length, 11);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg003_page|data-fl-reference-width|adt-page-overlay-text|--adt-page-fit-scale|auto-fit\.js/);
});

test("page 3 keeps narration IDs and exact source text in reading order", () => {
    let previous = -1;
    for (let index = 1; index <= 25; index += 1) {
        const id = `pg003_p${String(index).padStart(3, "0")}`;
        assert.equal((html.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1, id);
        assert.equal(typeof audios[id], "string", `${id} audio mapping`);
        assert.ok(html.includes(texts[id]), `${id} exact fallback text`);
        const position = html.indexOf(`data-id="${id}"`);
        assert.ok(position > previous, `${id} reading order`);
        previous = position;
    }
});

test("page 3 mirrors timed word highlights onto every visible contents entry", () => {
    assert.match(html, /data-visual-label/);
    assert.match(html, /data-visual-page/);
    assert.match(html, /data-visual-word-index/);
    assert.match(html, /new MutationObserver\(syncVisibleHighlight\)/);
    assert.match(html, /\.pg003-word-active/);
    assert.match(html, /nextVisualWord === currentVisualWord/);
});

test("page 3 highlight wrappers retain the Sassoon Primary font", () => {
    assert.match(html, /\.contents-page \[data-id\] span/);
});

test("page 3 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg003_sec001.html"], html);
});
