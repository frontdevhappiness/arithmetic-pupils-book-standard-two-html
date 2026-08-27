import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg024_sec001.html", import.meta.url), "utf8");
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

const narrationOrder = [
  "pg024_p001", "pg024_p002",
  "pg024_p004", "pg024_p005", "pg024_p006", "pg024_p007", "pg024_im001",
  "pg024_p011", "pg024_p012", "pg024_p013", "pg024_p014", "pg024_im002",
  "pg024_p018", "pg024_p019", "pg024_p020", "pg024_p021", "pg024_im003"
];

test("page 24 uses responsive semantic HTML", () => {
  assert.match(html, /width=device-width/);
  assert.match(html, /class="book-page"/);
  assert.doesNotMatch(html, /pg024_page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
});

test("page 24 preserves approved narration order", () => {
  let position = -1;
  for (const id of narrationOrder) {
    const next = html.indexOf(`data-id="${id}"`);
    assert.ok(next > position, `${id} is missing or out of order`);
    position = next;
    assert.equal(typeof audios[id], "string", `${id} has no audio mapping`);
  }
});

test("the three approved row descriptions remain unchanged", () => {
  for (const id of ["pg024_im001", "pg024_im002", "pg024_im003"]) {
    assert.ok(html.includes(`alt="${texts[id]}" data-id="${id}"`));
    assert.equal((html.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1);
  }
});

test("cup quantities match the printed page", () => {
  assert.equal((html.match(/src="images\/pg024_im001\.png"/g) || []).length, 9);
  assert.equal((html.match(/src="images\/pg024_im002\.png"/g) || []).length, 8);
  assert.equal((html.match(/src="images\/pg024_im003\.png"/g) || []).length, 9);
  assert.match(html, /class="cups empty-cups"/);
});

test("all nine learner blanks remain empty", () => {
  for (const id of ["pg024_p008", "pg024_p009", "pg024_p010", "pg024_p015", "pg024_p016", "pg024_p017", "pg024_p022", "pg024_p023", "pg024_p024"]) {
    assert.match(html, new RegExp(`class="answer-line" data-id="${id}"`));
  }
});

test("page 24 excludes printer metadata", () => {
  for (const id of ["pg024_p025", "pg024_p026"]) assert.doesNotMatch(html, new RegExp(`data-id="${id}"`));
});

test("page 24 preserves original font and colours", () => {
  assert.match(html, /Sassoon Primary Std/);
  assert.match(html, /--exercise-blue: #219ade/);
  assert.match(html, /--exercise-border: #90ccee/);
  assert.match(html, /--ink: #231f20/);
});

test("page 24 offline copy matches source HTML", () => {
  assert.equal(offlineHtml("./pg024_sec001.html"), html);
});
