import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

assert.match(bridge, /function buildPage99Map/);
assert.match(bridge, /Number\.parseInt\(left\.querySelector\("\.pg099-qno"\)/);
assert.match(bridge, /expectedLength = id === "pg099_p005" \? 85 : 83/);

for (const [id, length] of [["pg099_p001", 23], ["pg099_p005", 85], ["pg099_p027", 83]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, length, `${id} must map every narrated token`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

for (const id of ["pg099_p005", "pg099_p027"]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.filter(({ text }) => text === "÷").length, 15, `${id} must highlight every division sign`);
  assert.equal(words.filter(({ text }) => text === "=").length, 15, `${id} must highlight every equals sign`);
}

assert.deepEqual(
  timecodes.pg099_p005.timecodes[1].word_timestamps.slice(10, 25).map(({ text }) => text),
  ["1", "4", "÷", "2", "=", "2", "10", "÷", "2", "=", "3", "24", "÷", "2", "="],
  "Exercise 2 must proceed numerically instead of following the visual column order",
);

const exercise3 = timecodes.pg099_p027.timecodes[1].word_timestamps;
assert.ok(new Set(exercise3.map(({ start, end }) => (end - start).toFixed(3))).size > 10, "Exercise 3 must use measured, non-uniform timing");
assert.ok(exercise3[8].start >= 3.92, "question 1 must begin after the measured introduction");
assert.ok(exercise3[13].start >= 6.28, "question 2 must begin after question 1 finishes");
assert.ok(exercise3[78].start >= 47.93, "question 15 must wait for its measured narration interval");
assert.ok(exercise3.at(-1).end <= 51.18, "Exercise 3 highlighting must stop with its natural narration");
