import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../pg030_sec001.html", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../assets/read-aloud-highlight-bridge.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../assets/semantic-pages-027-031.css", import.meta.url), "utf8");
const offlineSource = fs.readFileSync(new URL("../assets/offline-data.js", import.meta.url), "utf8");
const offlineStart = offlineSource.indexOf("  var INLINE = ") + "  var INLINE = ".length;
const offlineEnd = offlineSource.indexOf(";\n  var BASE_DIR", offlineStart);
const offline = JSON.parse(offlineSource.slice(offlineStart, offlineEnd));
const diagramPlaces = {
  pg030_p001: ["hundreds", "tens", "ones"],
  pg030_p002: ["tens", "ones"],
  pg030_p003: ["ones"],
  pg030_p004: ["tens", "ones"],
  pg030_p005: ["hundreds", "tens", "ones"],
  pg030_p006: ["hundreds", "tens", "ones"],
  pg030_p007: ["hundreds", "tens", "ones"],
  pg030_p008: ["hundreds", "tens", "ones"]
};
const numberIds = ["pg030_p012", "pg030_p014", "pg030_p016", "pg030_p018", "pg030_p020", "pg030_p022", "pg030_p024", "pg030_p026", "pg030_p028", "pg030_p030"];

test("page 30 maps every spoken diagram token within its own question", () => {
  assert.match(bridge, /function buildPage30ExerciseMap/);
  assert.match(bridge, /source\.closest\("\.diagram-question"\)/);
  for (const [id, places] of Object.entries(diagramPlaces)) {
    const sourcePosition = page.indexOf(`data-id="${id}"`);
    const questionStart = page.lastIndexOf('<section class="diagram-question">', sourcePosition);
    const questionEnd = page.indexOf("</section>", sourcePosition);
    const question = page.slice(questionStart, questionEnd);
    assert.match(question, /class="question-number"/, `${id} has no local question number`);
    for (const place of places) {
      assert.match(question, new RegExp(`data-place-digit="${place}"`), `${id} lacks its ${place} digit target`);
      assert.match(question, new RegExp(`place-line ${place}`), `${id} lacks its ${place} label target`);
    }
  }
});

test("page 30 maps Exercise 5 narration to the matching visible row", () => {
  assert.match(bridge, /source\.closest\("\.number-list p"\)/);
  for (const id of numberIds) {
    const sourcePosition = page.indexOf(`data-id="${id}"`);
    const rowStart = page.lastIndexOf("<p>", sourcePosition);
    const rowEnd = page.indexOf("</p>", sourcePosition);
    const row = page.slice(rowStart, rowEnd);
    assert.match(row, /class="visual-question-number"/, `${id} has no local question-number target`);
    assert.match(row, /class="visual-given-number"/, `${id} has no local number target`);
  }
});

test("page 30 highlight changes are available offline", () => {
  assert.equal(offline["./pg030_sec001.html"], page);
  assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
  assert.equal(offline["./assets/semantic-pages-027-031.css"], css);
});

test("highlightable diagrams suppress the old generated digits", () => {
  assert.match(css, /\.place-diagram\.highlightable-digits::before\s*\{\s*content:\s*none\s*!important;/);
});
