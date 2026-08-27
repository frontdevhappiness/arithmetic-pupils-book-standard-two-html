import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg022_sec001.html", import.meta.url), "utf8");
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

const order = [
  "pg022_p001", "pg022_p002", "pg022_p003", "pg022_p004", "pg022_p005",
  "pg022_im006", "pg022_im001", "pg022_im002", "pg022_p006", "pg022_p007",
  "pg022_p008", "pg022_p009", "pg022_p010", "pg022_p011", "pg022_p013",
  "pg022_p014", "pg022_im003", "pg022_p017", "pg022_p015", "pg022_im004",
  "pg022_p018", "pg022_p016", "pg022_im005", "pg022_p019", "pg022_p020"
];

test("page 22 uses responsive semantic HTML", () => {
  assert.match(html, /width=device-width/);
  assert.match(html, /class="book-page"/);
  assert.doesNotMatch(html, /pg022_page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
});

test("page 22 preserves approved narration IDs and order", () => {
  let position = -1;
  for (const id of order) {
    const next = html.indexOf(`data-id="${id}"`);
    assert.ok(next > position, `${id} is missing or out of order`);
    position = next;
  }
});

test("meaningful images retain approved descriptions and audio", () => {
  for (const id of ["pg022_im001", "pg022_im002", "pg022_im003", "pg022_im004", "pg022_im005", "pg022_im006"]) {
    assert.equal(typeof texts[id], "string");
    assert.equal(typeof audios[id], "string");
    assert.match(html, new RegExp(`alt="${texts[id].replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}" data-id="${id}"`));
  }
});

test("worked example shows three hundreds without duplicate narration", () => {
  assert.equal((html.match(/src="images\/pg022_im006\.jpg"/g) || []).length, 3);
  assert.equal((html.match(/data-id="pg022_im006"/g) || []).length, 1);
});

test("exercise keeps all four blank answer lines and their audio", () => {
  for (const id of ["pg022_p017", "pg022_p018", "pg022_p019", "pg022_p020"]) {
    assert.match(html, new RegExp(`class="answer-line" data-id="${id}"`));
    assert.equal(typeof audios[id], "string");
  }
  assert.doesNotMatch(html, /Three hundred and forty-five/);
});

test("page 22 excludes page summaries and printer metadata", () => {
  for (const id of ["pg022_im009", "pg022_im010", "pg022_p021", "pg022_p022"]) assert.doesNotMatch(html, new RegExp(`data-id="${id}"`));
});

test("page 22 preserves original font and colours", () => {
  assert.match(html, /Sassoon Primary Std/);
  assert.match(html, /--example-blue: #219ade/);
  assert.match(html, /--exercise-border: #90ccee/);
  assert.match(html, /--ink: #231f20/);
});

test("page 22 offline copy matches source HTML", () => {
  assert.equal(offlineHtml("./pg022_sec001.html"), html);
});
