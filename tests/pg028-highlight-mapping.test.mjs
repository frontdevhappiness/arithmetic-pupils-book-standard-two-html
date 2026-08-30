import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../pg028_sec001.html", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../assets/read-aloud-highlight-bridge.js", import.meta.url), "utf8");
const rowIds = [
  "pg028_p004", "pg028_p010", "pg028_p016", "pg028_p022", "pg028_p028",
  "pg028_p034", "pg028_p040", "pg028_p046", "pg028_p052", "pg028_p058"
];

test("page 28 complete-row narration is mapped only within its own visible row", () => {
  assert.match(bridge, /function buildPage28ExerciseRowMap/);
  assert.match(bridge, /source\.closest\("\.exercise3-row"\)/);
  assert.match(bridge, /collectRootTokens\(row, content\)/);
  for (const id of rowIds) {
    const sourcePosition = page.indexOf(`data-id="${id}"`);
    assert.ok(sourcePosition >= 0, `${id} is missing`);
    const rowStart = page.lastIndexOf('<div class="exercise3-row">', sourcePosition);
    const rowEnd = page.indexOf("</div>", sourcePosition);
    const row = page.slice(rowStart, rowEnd);
    assert.match(row, /class="visual-question-number"/, `${id} has no local question-number target`);
    assert.match(row, /class="count"/, `${id} has no local value targets`);
  }
});
