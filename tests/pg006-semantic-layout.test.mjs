import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg006_sec001.html", root), "utf8");
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

test("page 6 uses responsive semantic introduction markup", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.match(html, /class="focus-areas"/);
    assert.match(html, /class="resource-row"/);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg006_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 6 preserves approved narration IDs, exact text, and order", () => {
    const ids = [
        "pg006_p000", "pg006_p001", "pg006_p002", "pg006_p003", "pg006_p004",
        "pg006_p005", "pg006_p009", "pg006_p010", "pg006_p011", "pg006_p012",
        "pg006_p013", "pg006_im001", "pg006_p014",
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

test("page 6 presents the QR resource once with its approved description", () => {
    assert.equal((html.match(/src="images\/pg006_im001\.png"/g) || []).length, 1);
    assert.match(html, /alt="QR code linking to the TIE e-Library videos resource\."/);
    assert.doesNotMatch(html, /aria-hidden="true"[^>]*data-id="pg006_im001"/);
});

test("page 6 highlight wrappers retain the Sassoon Primary font", () => {
    assert.match(html, /\.introduction-page \[data-id\] span/);
});

test("page 6 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg006_sec001.html"], html);
});
