import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg002_sec001.html", root), "utf8");
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

test("page 2 uses responsive semantic HTML instead of a fixed image overlay", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /<address class="address">/);
    assert.match(html, /class="contact-details"/);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg002_page|data-fl-reference-width|adt-page-overlay-text|--adt-page-fit-scale/);
});

test("page 2 preserves every narration-backed text ID exactly once", () => {
    const ids = Array.from({ length: 16 }, (_, index) =>
        `pg002_p${String(index + 1).padStart(3, "0")}`,
    ).concat("pg002_p021");

    for (const id of ids) {
        assert.equal((html.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1, id);
        assert.equal(typeof audios[id], "string", `${id} audio mapping`);
    }

    assert.ok(html.indexOf('data-id="pg002_p016"') < html.indexOf('data-id="pg002_p021"'));
});

test("page 2 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg002_sec001.html"], html);
});
