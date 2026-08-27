import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg023_sec001.html", import.meta.url), "utf8");
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
  "pg023_p001", "pg023_p002", "pg023_im002", "pg023_p005",
  "pg023_p003", "pg023_im003", "pg023_p006", "pg023_p004",
  "pg023_im001", "pg023_p007", "pg023_p008", "pg023_p009",
  "pg023_p010", "pg023_im004", "pg023_p013", "pg023_p011",
  "pg023_im005", "pg023_p014", "pg023_p012", "pg023_im018",
  "pg023_p015", "pg023_p016"
];

test("page 23 uses responsive semantic HTML", () => {
  assert.match(html, /width=device-width/);
  assert.match(html, /class="book-page"/);
  assert.doesNotMatch(html, /pg023_page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
});

test("page 23 preserves approved narration order", () => {
  let position = -1;
  for (const id of narrationOrder) {
    const next = html.indexOf(`data-id="${id}"`);
    assert.ok(next > position, `${id} is missing or out of order`);
    position = next;
    assert.equal(typeof audios[id], "string", `${id} has no audio mapping`);
  }
});

test("question 2 retains interpreted descriptions", () => {
  for (const id of ["pg023_im002", "pg023_im003", "pg023_im001"]) {
    assert.match(texts[id], /representing/);
    assert.ok(html.includes(`alt="${texts[id]}" data-id="${id}"`));
  }
});

test("question 3 descriptions remain neutral", () => {
  for (const id of ["pg023_im004", "pg023_im005", "pg023_im018"]) {
    assert.doesNotMatch(texts[id], /representing/i);
    assert.ok(html.includes(`alt="${texts[id]}" data-id="${id}"`));
  }
});

test("each ones column shows three pencils without duplicate narration", () => {
  assert.equal((html.match(/src="images\/pg023_im001\.png"/g) || []).length, 6);
  assert.equal((html.match(/data-id="pg023_im001"/g) || []).length, 1);
  assert.equal((html.match(/data-id="pg023_im018"/g) || []).length, 1);
});

test("both questions preserve four learner answer lines", () => {
  for (const id of ["pg023_p005", "pg023_p006", "pg023_p007", "pg023_p008", "pg023_p013", "pg023_p014", "pg023_p015", "pg023_p016"]) {
    assert.match(html, new RegExp(`class="answer-line" data-id="${id}"`));
  }
});

test("page 23 excludes printer metadata", () => {
  for (const id of ["pg023_p017", "pg023_p018"]) assert.doesNotMatch(html, new RegExp(`data-id="${id}"`));
});

test("page 23 preserves original font and colours", () => {
  assert.match(html, /Sassoon Primary Std/);
  assert.match(html, /--exercise-blue: #219ade/);
  assert.match(html, /--exercise-border: #90ccee/);
  assert.match(html, /--ink: #231f20/);
});

test("page 23 offline copy matches source HTML", () => {
  assert.equal(offlineHtml("./pg023_sec001.html"), html);
});
