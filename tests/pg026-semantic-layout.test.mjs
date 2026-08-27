import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg026_sec001.html", import.meta.url), "utf8");
const texts = JSON.parse(fs.readFileSync(new URL("../content/i18n/en-GB/texts.json", import.meta.url), "utf8"));
const audios = JSON.parse(fs.readFileSync(new URL("../content/i18n/en-GB/audios.json", import.meta.url), "utf8"));
const offlineSource = fs.readFileSync(new URL("../assets/offline-data.js", import.meta.url), "utf8");

function offlineHtml(path) {
  const prefix = "  var INLINE = ";
  const suffix = ";\n  var BASE_DIR";
  const start = offlineSource.indexOf(prefix) + prefix.length;
  const end = offlineSource.indexOf(suffix, start);
  return JSON.parse(offlineSource.slice(start, end))[path];
}

test("page 26 uses responsive semantic HTML", () => {
  assert.match(html, /width=device-width/);
  assert.match(html, /class="chapter-banner"/);
  assert.match(html, /class="examples"/);
  assert.match(html, /class="question-grid"/);
  assert.doesNotMatch(html, /pg026_page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
});

test("page 26 preserves the printed reading order", () => {
  const ids = [
    "pg026_p021", "pg026_p022", "pg026_p019", "pg026_p001", "pg026_p002",
    "pg026_p005", "pg026_p006", "pg026_im001",
    "pg026_p008", "pg026_p009", "pg026_p011",
    "pg026_p013", "pg026_p014",
    "pg026_p015", "pg026_im002", "pg026_p016", "pg026_im003",
    "pg026_p017", "pg026_im004", "pg026_p018", "pg026_im005"
  ];
  let position = -1;
  for (const id of ids) {
    const next = html.indexOf(`data-id="${id}"`);
    assert.ok(next > position, `${id} is missing or out of order`);
    position = next;
    assert.equal(typeof audios[id], "string", `${id} has no audio mapping`);
  }
});

test("exercise questions narrate only their printed numbers", () => {
  const expected = {
    pg026_im002: "224",
    pg026_im003: "185",
    pg026_im004: "402",
    pg026_im005: "306"
  };
  for (const [id, value] of Object.entries(expected)) {
    assert.equal(texts[id], value);
    assert.ok(html.includes(`alt="${value}" data-id="${id}"`));
  }
  assert.doesNotMatch(html, /coloured guide lines|colored guide lines|represents [0-9]+ hundreds/i);
});

test("page 26 retains the approved example description and equation", () => {
  assert.ok(html.includes(`alt="${texts.pg026_im001}" data-id="pg026_im001"`));
  assert.match(html, /class="narration-only" data-id="pg026_p011">349 = 3 hundreds 4 tens 9 ones/);
  assert.match(html, /class="place-equation" aria-hidden="true">349 = <u>3<\/u> hundreds <u>4<\/u> tens <u>9<\/u> ones/);
});

test("page 26 excludes printer metadata", () => {
  for (const id of ["pg026_p023", "pg026_p024"]) assert.doesNotMatch(html, new RegExp(`data-id="${id}"`));
});

test("page 26 preserves the Sassoon font and original colours", () => {
  assert.match(html, /Sassoon Primary Std/);
  assert.match(html, /\.place-equation \{[^}]*font-family: "Sassoon Primary Std"/);
  assert.doesNotMatch(html, /\.example:first-child \.example-label/);
  assert.match(html, /--chapter-blue: #00a9e8/);
  assert.match(html, /--exercise-blue: #219ade/);
  assert.match(html, /--exercise-border: #90ccee/);
  assert.match(html, /--table-blue: #31459c/);
  assert.match(html, /--ink: #231f20/);
});

test("page 26 offline copy matches source HTML", () => {
  assert.equal(offlineHtml("./pg026_sec001.html"), html);
});
