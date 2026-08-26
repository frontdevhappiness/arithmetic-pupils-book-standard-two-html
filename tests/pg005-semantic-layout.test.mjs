import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg005_sec001.html", root), "utf8");
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

test("page 5 uses responsive semantic acknowledgements markup", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /class="signature-block"/);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg005_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 5 preserves approved narration IDs, exact text, and order", () => {
    const ids = ["pg005_p001", "pg005_p002", "pg005_im001", "pg005_p004", "pg005_p005", "pg005_p006"];
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

test("page 5 shows and describes the original signature without duplicating it", () => {
    assert.equal((html.match(/src="images\/pg005_im001\.png"/g) || []).length, 1);
    assert.match(html, /alt="Blue handwritten signature above Dr Aneth A\. Komba’s printed name\."/);
    assert.doesNotMatch(html, /aria-hidden="true"[^>]*data-id="pg005_im001"/);
});

test("page 5 highlight wrappers retain the Sassoon Primary font", () => {
    assert.match(html, /\.acknowledgements-page \[data-id\] span/);
});

test("page 5 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg005_sec001.html"], html);
});
