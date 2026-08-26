import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg014_sec001.html", root), "utf8");
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

test("page 14 uses responsive semantic exercise layout", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.equal((html.match(/<section class="exercise-card"/g) || []).length, 2);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg014_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 14 preserves approved narrated IDs, exact text, audio, and order", () => {
    const ids = [
        "pg014_p001", "pg014_p002", "pg014_p003",
        "pg014_p004", "pg014_p005", "pg014_p009", "pg014_p010",
        "pg014_p014", "pg014_p015", "pg014_p019", "pg014_p020",
        "pg014_p024", "pg014_p025", "pg014_p029", "pg014_p030",
        "pg014_p034", "pg014_p035", "pg014_p039", "pg014_p040",
        "pg014_p044", "pg014_p045", "pg014_p049", "pg014_p053",
        "pg014_p057", "pg014_p061",
        "pg014_p006", "pg014_p007", "pg014_p011", "pg014_p012",
        "pg014_p016", "pg014_p017", "pg014_p021", "pg014_p022",
        "pg014_p026", "pg014_p027", "pg014_p031", "pg014_p032",
        "pg014_p036", "pg014_p037", "pg014_p041", "pg014_p042",
        "pg014_p046", "pg014_p047", "pg014_p050", "pg014_p051",
        "pg014_p054", "pg014_p055", "pg014_p058", "pg014_p059",
        "pg014_p063", "pg014_p064", "pg014_p065", "pg014_p066",
        "pg014_p067", "pg014_p068", "pg014_p069", "pg014_p070", "pg014_p071",
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

test("page 14 contains all printed exercise items", () => {
    assert.equal((html.match(/class="question-number left-number"/g) || []).length, 9);
    assert.equal((html.match(/class="left-combined mirrored-entry"/g) || []).length, 4);
    assert.equal((html.match(/class="right-value"/g) || []).length, 12);
    assert.equal((html.match(/<li><span class="narration-source" data-id="pg014_p0(?:6[5-9]|7[01])"/g) || []).length, 7);
    assert.match(html, /data-id="pg014_p005">101</);
    assert.match(html, /data-id="pg014_p059">188</);
});

test("page 14 retains corrected clean narration clips", () => {
    assert.equal(audios.pg014_p011, "pg014_p011_adt_clean.mp3");
    assert.equal(audios.pg014_p019, "pg014_p019_adt_clean.mp3");
    assert.equal(audios.pg014_p070, "pg014_p070_adt_clean.mp3");
});

test("page 14 avoids duplicate page description and printer metadata", () => {
    assert.doesNotMatch(html, /data-id="pg014_im001"/);
    assert.doesNotMatch(html, /data-id="pg014_p07[23]"/);
});

test("page 14 uses measured original colours and preserves highlight font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /--page-marker-blue: #00aeef/);
    assert.match(html, /\.writing-page \[data-id\] span/);
    assert.match(html, /\.writing-page \.mirrored-entry span/);
    assert.equal((html.match(/class="visual-question"/g) || []).length, 23);
    assert.match(html, /pg014-word-active/);
});

test("page 14 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg014_sec001.html"], html);
});
