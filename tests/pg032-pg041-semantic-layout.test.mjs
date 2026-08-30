import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const css = fs.readFileSync(new URL("assets/semantic-pages-032-041.css", root), "utf8");
const baseCss = fs.readFileSync(new URL("assets/semantic-pages-027-031.css", root), "utf8");
const offlineSource = fs.readFileSync(new URL("assets/offline-data.js", root), "utf8");
const prefix = "  var INLINE = ";
const suffix = ";\n  var BASE_DIR";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(suffix, start);
const offline = JSON.parse(offlineSource.slice(start, end));

function page(number) {
  const file = `pg${String(number).padStart(3, "0")}_sec001.html`;
  return { file, html: fs.readFileSync(new URL(file, root), "utf8") };
}

test("pages 32 to 41 use the shared responsive Sassoon layout", () => {
  for (let number = 32; number <= 41; number += 1) {
    const { html } = page(number);
    assert.match(html, /width=device-width/);
    assert.match(html, /semantic-pages-032-041\.css/);
    assert.match(html, /class="book-page/);
    assert.doesNotMatch(html, /page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
  }
  assert.match(css, /@import url\("\.\/semantic-pages-027-031\.css"\)/);
  assert.match(baseCss, /font-family: "Sassoon Primary Std"/);
});

test("each rebuilt page keeps unique localization IDs", () => {
  for (let number = 32; number <= 41; number += 1) {
    const { file, html } = page(number);
    const ids = [...html.matchAll(/data-id="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(ids.length > 0, `${file} has no localization IDs`);
    assert.equal(new Set(ids).size, ids.length, `${file} contains duplicate localization IDs`);
    assert.match(html, /base\.bundle\.local\.js/);
    assert.match(html, /offline-preloader\.js/);
  }
});

test("page-specific visual structures remain present", () => {
  assert.equal((page(32).html.match(/class="equation-row"/g) || []).length, 10);
  assert.equal((page(33).html.match(/class="equation-row"/g) || []).length, 10);
  assert.match(page(34).html, /class="activity-block"/);
  assert.match(page(35).html, /class="[^"]*maze-image[^"]*"/);
  assert.equal((page(36).html.match(/class="book-table"/g) || []).length, 3);
  assert.match(page(37).html, /class="semantic-chapter-banner"/);
  assert.match(page(37).html, /class="place-model example-place-model"/);
  assert.doesNotMatch(page(37).html, /class="chapter-banner"/);
  assert.match(page(38).html, /class="steps-card"/);
  for (const number of [39, 40, 41]) {
    assert.match(page(number).html, /class="place-model-grid"/);
  }
});

test("pages 34 and 35 highlight generated question numbers during read-aloud", () => {
  for (const number of [34, 35]) {
    const section = `pg${String(number).padStart(3, "0")}_sec001`;
    assert.match(css, new RegExp(`\\[data-section-id="${section}"\\] \\.question-list p:has\\(\\[data-word-index="0"\\]\\.bg-yellow-300\\)::before`));
    assert.match(css, new RegExp(`\\[data-section-id="${section}"\\] \\.question-list p\\.tts-active-block::before`));
  }
});

test("page 38 highlights generated step numbers during read-aloud", () => {
  assert.match(css, /\[data-section-id="pg038_sec001"\] \.steps-list p:has\(\[data-word-index="0"\]\.bg-yellow-300\)::before/);
  assert.match(css, /\[data-section-id="pg038_sec001"\] \.steps-list p\.tts-active-block::before/);
  for (const id of ["pg038_p004", "pg038_p006", "pg038_p008", "pg038_p014", "pg038_p016", "pg038_p018"]) {
    assert.match(page(38).html, new RegExp(`data-id="${id}">[123]\\.`));
  }
});

test("page 39 highlights generated question numbers and keeps each model narration local", () => {
  const html = page(39).html;
  assert.match(css, /\[data-id="pg039_p002"\]:has\(\[data-word-index="0"\]\.bg-yellow-300\)::before/);
  assert.match(css, /\[data-id="pg039_p020"\]:has\(\[data-word-index="0"\]\.bg-yellow-300\)::before/);
  assert.ok(html.indexOf('data-id="pg039_p003"') < html.indexOf('data-id="pg039_p039"'));
  assert.ok(html.indexOf('data-id="pg039_p039"') < html.indexOf('data-id="pg039_p020"'));
  assert.ok(html.indexOf('data-id="pg039_p020"') < html.indexOf('data-id="pg039_p040"'));
  assert.equal((html.match(/data-id="pg039_p039"/g) || []).length, 1);
  assert.equal((html.match(/data-id="pg039_p040"/g) || []).length, 1);
});

test("offline copies match pages 32 to 41", () => {
  for (let number = 32; number <= 41; number += 1) {
    const { file, html } = page(number);
    assert.equal(offline[`./${file}`], html);
  }
});
