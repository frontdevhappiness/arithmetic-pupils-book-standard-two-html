import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../pg029_sec001.html", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../assets/read-aloud-highlight-bridge.js", import.meta.url), "utf8");
const expected = {
  pg029_p009: ["hundreds", "tens", "ones"],
  pg029_p010: ["hundreds", "tens", "ones"],
  pg029_p011: ["hundreds", "tens", "ones"],
  pg029_p012: ["tens", "ones"],
  pg029_p013: ["hundreds", "tens", "ones"],
  pg029_p014: ["hundreds", "tens", "ones"]
};

test("page 29 maps every spoken Exercise 4 token within its own diagram", () => {
  assert.match(bridge, /function buildPage29ExerciseDiagramMap/);
  assert.match(bridge, /source\.closest\("\.diagram-question"\)/);
  for (const [id, places] of Object.entries(expected)) {
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
