import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg013_sec001.html", root), "utf8");
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

test("page 13 uses responsive semantic number tables", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.equal((html.match(/<table class="number-table/g) || []).length, 2);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg013_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 13 preserves approved narration IDs, exact text, audio, and order", () => {
    const ids = [
        "pg013_p001", "pg013_p002", "pg013_p003", "pg013_p004",
        "pg013_p106", "pg013_p107", "pg013_p005",
        "pg013_p006", "pg013_p007", "pg013_p008", "pg013_p009", "pg013_p010", "pg013_p011",
        "pg013_p012", "pg013_p013",
        ...Array.from({ length: 90 }, (_, index) => `pg013_p${String(index + 14).padStart(3, "0")}`),
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

test("page 13 tables contain every printed row", () => {
    const bodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].map((match) => match[1]);
    assert.equal(bodies.length, 2);
    assert.equal((bodies[0].match(/<tr>/g) || []).length, 11);
    assert.equal((bodies[1].match(/<tr>/g) || []).length, 9);
    assert.match(bodies[0], /data-id="pg013_p001">886 887 888 889 890 891 892 893 894 895 896<\/td>/);
    assert.match(bodies[0], /data-id="pg013_p011">996 997 998 999<\/td>/);
    assert.match(bodies[1], /data-id="pg013_p014">100<\/td>/);
    assert.match(bodies[1], /data-id="pg013_p103">990<\/td>/);
});

test("page 13 retains separate natural audio at 930 and 931", () => {
    assert.match(html, /data-id="pg013_p106">930<\/td><td data-id="pg013_p107">931<\/td><td class="number-run nine-columns" colspan="9" data-id="pg013_p005">932 933 934 935 936 937 938 939 940<\/td>/);
    assert.equal(audios.pg013_p106, "pg013_p106.mp3");
    assert.equal(audios.pg013_p107, "pg013_p107_adt_gpt4omini.mp3");
});

test("page 13 describes both tables without restoring duplicate table images", () => {
    assert.match(html, /<span class="sr-only" data-id="pg013_im001">Table description\./);
    assert.equal(audios.pg013_im001, "pg013_im001_table_description.mp3");
    assert.match(html, /<span class="sr-only" data-id="pg013_im002">Table description\./);
    assert.equal(audios.pg013_im002, "pg013_im002_table_description.mp3");
    assert.doesNotMatch(html, /data-id="pg013_p10[45]"/);
});

test("page 13 uses measured original colours and preserves highlight font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /--table-blue: #2a3c9a/);
    assert.match(html, /--page-marker-blue: #00aeef/);
    assert.match(html, /\.numbers-page \[data-id\] span/);
});

test("page 13 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg013_sec001.html"], html);
});
