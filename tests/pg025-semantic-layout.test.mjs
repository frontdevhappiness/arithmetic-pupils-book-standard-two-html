import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pg025_sec001.html", import.meta.url), "utf8");
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
  "pg025_p001", "pg025_p002",
  "pg025_p004", "pg025_p016", "pg025_im001", "pg025_p005",
  "pg025_p006", "pg025_p017", "pg025_im002", "pg025_p007",
  "pg025_p008", "pg025_p018", "pg025_im003", "pg025_p009",
  "pg025_p010", "pg025_p020", "pg025_im004", "pg025_p011",
  "pg025_p012", "pg025_p019", "pg025_im005", "pg025_p013",
  "pg025_p014", "pg025_p021", "pg025_im006", "pg025_p015"
];

test("page 25 uses responsive semantic HTML", () => {
  assert.match(html, /width=device-width/);
  assert.match(html, /class="book-page"/);
  assert.match(html, /class="question-grid"/);
  assert.doesNotMatch(html, /pg025_page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
});

test("page 25 preserves approved narration order", () => {
  let position = -1;
  for (const id of narrationOrder) {
    const next = html.indexOf(`data-id="${id}"`);
    assert.ok(next > position, `${id} is missing or out of order`);
    position = next;
    assert.equal(typeof audios[id], "string", `${id} has no audio mapping`);
  }
});

test("all six approved image descriptions remain unchanged", () => {
  for (let number = 1; number <= 6; number += 1) {
    const id = `pg025_im${String(number).padStart(3, "0")}`;
    assert.ok(html.includes(`alt="${texts[id]}" data-id="${id}"`));
    assert.equal((html.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1);
  }
});

test("the six learner answer lines remain empty", () => {
  for (const id of ["pg025_p005", "pg025_p007", "pg025_p009", "pg025_p011", "pg025_p013", "pg025_p015"]) {
    assert.match(html, new RegExp(`class="answer-narration narration-only" data-id="${id}">answer blank space<`));
    assert.match(html, new RegExp(`class="answer-line" data-answer-for="${id}" aria-hidden="true">_+<`));
    assert.equal(texts[id], "answer blank space");
    assert.equal(audios[id], "pg025_answer_blank_space_elimu_neural.mp3");
  }
});

test("all printed place-value headings remain available", () => {
  for (const id of ["pg025_p016", "pg025_p017", "pg025_p018", "pg025_p019", "pg025_p020", "pg025_p021"]) {
    assert.match(html, new RegExp(`class="place-headings" data-id="${id}"`));
  }
  assert.equal((html.match(/class="visual-place-headings"/g) || []).length, 6);
});

test("page 25 excludes printer metadata", () => {
  for (const id of ["pg025_p022", "pg025_p023"]) assert.doesNotMatch(html, new RegExp(`data-id="${id}"`));
});

test("page 25 preserves the original font and colours", () => {
  assert.match(html, /Sassoon Primary Std/);
  assert.match(html, /--exercise-blue: #219ade/);
  assert.match(html, /--exercise-border: #90ccee/);
  assert.match(html, /--ink: #231f20/);
});

test("page 25 offline copy matches source HTML", () => {
  assert.equal(offlineHtml("./pg025_sec001.html"), html);
});
