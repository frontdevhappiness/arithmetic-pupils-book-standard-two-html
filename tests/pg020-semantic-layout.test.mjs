import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg020_sec001.html", import.meta.url), "utf8");
const audios = JSON.parse(fs.readFileSync(new URL("../content/i18n/en-GB/audios.json", import.meta.url), "utf8"));
const texts = JSON.parse(fs.readFileSync(new URL("../content/i18n/en-GB/texts.json", import.meta.url), "utf8"));
const offlineSource = fs.readFileSync(new URL("../assets/offline-data.js", import.meta.url), "utf8");

function offlineHtml(path) {
    const prefix = "  var INLINE = ";
    const suffix = ";\n  var BASE_DIR";
    const start = offlineSource.indexOf(prefix) + prefix.length;
    const end = offlineSource.indexOf(suffix, start);
    return JSON.parse(offlineSource.slice(start, end))[path];
}

test("page 20 uses responsive semantic HTML", () => {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /class="chapter-page"/);
    assert.doesNotMatch(html, /pg020_page_hq_pdf_clean/);
    assert.doesNotMatch(html, /data-fl-reference-width/);
});

test("page 20 preserves all approved visible text IDs", () => {
    for (const number of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 21, 22, 23]) {
        const id = `pg020_p${String(number).padStart(3, "0")}`;
        assert.match(html, new RegExp(`data-id="${id}"`), `${id} is missing`);
    }
});

test("page 20 retains meaningful image descriptions and audio", () => {
    for (const number of [1, 2, 3, 4]) {
        const id = `pg020_im${String(number).padStart(3, "0")}`;
        assert.match(html, new RegExp(`data-id="${id}"`), `${id} is missing`);
        assert.match(html, new RegExp(`alt="${texts[id].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
        assert.equal(typeof audios[id], "string", `${id} audio mapping is missing`);
    }
});

test("page 20 keeps the approved narration order", () => {
    const ids = [17, 18, 16, 1, 2, 3, 4, 5, 6, 7];
    const positions = ids.map((number) => html.indexOf(`data-id="pg020_p${String(number).padStart(3, "0")}"`));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    assert.ok(html.indexOf('data-id="pg020_im001"') < html.indexOf('data-id="pg020_p008"'));
    assert.ok(html.indexOf('data-id="pg020_im004"') < html.indexOf('data-id="pg020_p014"'));
});

test("page 20 renders four tens and two ones without duplicate narration IDs", () => {
    assert.equal((html.match(/src="images\/pg020_im002\.jpg"/g) || []).length, 4);
    assert.equal((html.match(/data-id="pg020_im002"/g) || []).length, 1);
    assert.equal((html.match(/src="images\/pg020_im003\.jpg"/g) || []).length, 2);
    assert.equal((html.match(/data-id="pg020_im003"/g) || []).length, 1);
});

test("page 20 excludes duplicate page narration and printer metadata", () => {
    assert.doesNotMatch(html, /data-id="pg020_im(?:005|006)"/);
    assert.doesNotMatch(html, /data-id="pg020_p0(?:19|20)"/);
});

test("page 20 preserves original colours and highlighted font", () => {
    assert.match(html, /--chapter-title-blue: #00aeef/);
    assert.match(html, /--example-blue: #219ade/);
    assert.match(html, /--example-border: #90ccee/);
    assert.match(html, /\.chapter-page \[data-id\] span \{ font-family: inherit !important;/);
});

test("page 20 offline copy matches the source HTML", () => {
    assert.equal(offlineHtml("./pg020_sec001.html"), html);
});
