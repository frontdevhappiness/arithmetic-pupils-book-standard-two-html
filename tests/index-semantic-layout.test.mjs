import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg001_sec001.html", root), "utf8");
const texts = JSON.parse(
    fs.readFileSync(new URL("content/i18n/en-GB/texts.json", root), "utf8"),
);
const audios = JSON.parse(
    fs.readFileSync(new URL("content/i18n/en-GB/audios.json", root), "utf8"),
);

function occurrences(value, needle) {
    return value.split(needle).length - 1;
}

function readOfflineInline() {
    const source = fs.readFileSync(new URL("assets/offline-data.js", root), "utf8");
    const prefix = "  var INLINE = ";
    const suffix = ";\n  var BASE_DIR";
    const start = source.indexOf(prefix) + prefix.length;
    const end = source.indexOf(suffix, start);

    assert.ok(start >= prefix.length, "offline INLINE payload should exist");
    assert.ok(end > start, "offline INLINE payload should have an end marker");
    return JSON.parse(source.slice(start, end));
}

test("page 1 uses responsive semantic HTML instead of a fixed page-image overlay", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content" aria-labelledby="book-title">/);
    assert.match(html, /<header class="cover-heading">/);
    assert.match(html, /<h1 id="book-title" data-id="pg001_p000">Arithmetic<\/h1>/);
    assert.match(html, /font-size: clamp\(/);
    assert.doesNotMatch(html, /data-fl-reference-width/);
    assert.doesNotMatch(html, /adt-page-overlay-text/);
    assert.doesNotMatch(html, /pg001_page_hq_pdf_clean\.png/);
    assert.doesNotMatch(html, /translate\(-50%, -50%\) scale\(/);
});

test("page 1 uses the supplied Sassoon Primary font locally", () => {
    assert.match(html, /font-family: "Sassoon Primary Std"/);
    assert.match(html, /assets\/fonts\/SassoonPrimaryStd-Regular\.otf/);
    assert.ok(
        fs.existsSync(new URL("assets/fonts/SassoonPrimaryStd-Regular.otf", root)),
        "the local Sassoon font asset should exist",
    );
});

test("page 1 highlight wrappers retain the Sassoon Primary font", () => {
    assert.match(html, /\.cover-content \[data-id\] span/);
});

test("page 1 uses the original PDF blue for the blue cover text", () => {
    assert.equal(occurrences(html, "color: #0099da;"), 2);
    assert.doesNotMatch(html, /#078fc9/i);
});

test("page 1 displays the upright certificate without a visual wrapper", () => {
    assert.match(html, /src="images\/pg001_certificate_portrait\.jpg"/);
    assert.doesNotMatch(html, /approval-image-frame/);
    assert.doesNotMatch(html, /rotate\(/);
    assert.doesNotMatch(html, /\.approval-figure img[^}]*border(?:-radius)?:/s);
    assert.ok(
        fs.existsSync(new URL("images/pg001_certificate_portrait.jpg", root)),
        "the upright certificate image should exist",
    );
});

test("page 1 preserves each approved read-aloud identifier exactly once", () => {
    const ids = ["pg001_p000", "pg001_p001", "pg001_p002", "pg001_im001", "pg001_p003"];

    for (const id of ids) {
        assert.equal(occurrences(html, `data-id="${id}"`), 1, `${id} should occur once`);
        assert.equal(typeof texts[id], "string", `${id} should remain in texts.json`);
        assert.equal(typeof audios[id], "string", `${id} should retain its audio mapping`);
    }

    assert.match(html, new RegExp(`alt="${texts.pg001_im001.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});

test("the offline page 1 copy matches the reviewed source", () => {
    const inline = readOfflineInline();
    assert.equal(inline["./pg001_sec001.html"], html);
});
