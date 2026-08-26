import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg021_sec001.html", import.meta.url), "utf8");
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

const ids = [
  "pg021_p001", "pg021_p002", "pg021_p004", "pg021_p005", "pg021_p006",
  "pg021_im002", "pg021_im003", "pg021_im001", "pg021_p007", "pg021_p008",
  "pg021_p009", "pg021_p010", "pg021_p011", "pg021_p012", "pg021_p013",
  "pg021_p014", "pg021_p015", "pg021_im004", "pg021_im005", "pg021_im006",
  "pg021_p016", "pg021_p017", "pg021_p018", "pg021_p019"
];

test("page 21 uses responsive semantic HTML", () => {
  assert.match(html, /width=device-width/);
  assert.match(html, /class="book-page"/);
  assert.doesNotMatch(html, /pg021_page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
});

test("page 21 preserves approved text and image IDs", () => {
  for (const id of ["pg021_p000", ...ids]) assert.match(html, new RegExp(`data-id="${id}"`), id);
});

test("meaningful image descriptions and audio remain connected", () => {
  for (const id of ["pg021_im001", "pg021_im002", "pg021_im003", "pg021_im004", "pg021_im005", "pg021_im006"]) {
    assert.equal(typeof texts[id], "string");
    assert.equal(typeof audios[id], "string");
    assert.match(html, new RegExp(`alt="${texts[id].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" data-id="${id}"`));
  }
});

test("page 21 keeps the approved narration order", () => {
  let position = -1;
  for (const id of ids) {
    const next = html.indexOf(`data-id="${id}"`);
    assert.ok(next > position, `${id} is out of order`);
    position = next;
  }
});

test("five visible ones do not duplicate narration IDs", () => {
  assert.equal((html.match(/src="images\/pg021_im001\.jpg"/g) || []).length, 5);
  assert.equal((html.match(/data-id="pg021_im001"/g) || []).length, 1);
});

test("page 21 excludes duplicate summaries and printer metadata", () => {
  for (const id of ["pg021_im007", "pg021_im008", "pg021_p020", "pg021_p021"]) assert.doesNotMatch(html, new RegExp(`data-id="${id}"`));
});

test("page 21 preserves the original font and colours", () => {
  assert.match(html, /Sassoon Primary Std/);
  assert.match(html, /--example-blue: #219ade/);
  assert.match(html, /--example-border: #90ccee/);
  assert.match(html, /--ink: #231f20/);
});

test("page 21 offline copy matches source HTML", () => {
  assert.equal(offlineHtml("./pg021_sec001.html"), html);
});
