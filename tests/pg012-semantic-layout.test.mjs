import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("pg012_sec001.html", root), "utf8");
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

test("page 12 uses responsive semantic number tables", () => {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /<article id="content"/);
    assert.equal((html.match(/<table class="number-table"/g) || []).length, 2);
    assert.match(html, /SassoonPrimaryStd-Regular\.otf/);
    assert.doesNotMatch(html, /pg012_page|data-fl-reference-width|adt-page-overlay-text|auto-fit\.js/);
});

test("page 12 preserves approved narration IDs, exact text, audio, and order", () => {
    const ids = [
        "pg012_p001", "pg012_p002",
        "pg012_p004", "pg012_p005", "pg012_p006", "pg012_p007", "pg012_p008",
        "pg012_p009", "pg012_p029", "pg012_p030",
        "pg012_p010", "pg012_p011", "pg012_p012", "pg012_p013", "pg012_p014",
        "pg012_p015", "pg012_p016", "pg012_p017", "pg012_p018",
        "pg012_p019", "pg012_p020",
        "pg012_p022", "pg012_p023", "pg012_p024", "pg012_p025", "pg012_p026",
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

test("page 12 tables contain every printed row", () => {
    const bodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].map((match) => match[1]);
    assert.equal(bodies.length, 2);
    assert.equal((bodies[0].match(/<tr>/g) || []).length, 15);
    assert.equal((bodies[1].match(/<tr>/g) || []).length, 5);
    assert.match(bodies[0], /data-id="pg012_p004">666 667 668 669 670 671 672 673 674 675 676<\/td>/);
    assert.match(bodies[0], /data-id="pg012_p018">820 821 822 823 824 825 826 827 828 829 830<\/td>/);
    assert.match(bodies[1], /data-id="pg012_p022">831 832 833 834 835 836 837 838 839 840 841<\/td>/);
    assert.match(bodies[1], /data-id="pg012_p026">875 876 877 878 879 880 881 882 883 884 885<\/td>/);
});

test("page 12 retains separate natural audio at 730 and 731", () => {
    assert.match(html, /data-id="pg012_p009">721 722 723 724 725 726 727 728 729<\/td><td data-id="pg012_p029">730<\/td><td data-id="pg012_p030">731<\/td>/);
    assert.equal(audios.pg012_p029, "pg012_p029.mp3");
    assert.equal(audios.pg012_p030, "pg012_p030_adt_gpt4omini.mp3");
});

test("page 12 avoids duplicate image narration", () => {
    assert.doesNotMatch(html, /data-id="pg012_im002"/);
});

test("page 12 uses measured original colours and preserves highlight font", () => {
    assert.match(html, /--exercise-blue: #219ade/);
    assert.match(html, /--exercise-border: #90ccee/);
    assert.match(html, /--table-blue: #2a3c9a/);
    assert.match(html, /--page-marker-blue: #00aeef/);
    assert.match(html, /\.numbers-page \[data-id\] span/);
});

test("page 12 offline copy matches the source HTML", () => {
    assert.equal(offlineFiles()["./pg012_sec001.html"], html);
});
