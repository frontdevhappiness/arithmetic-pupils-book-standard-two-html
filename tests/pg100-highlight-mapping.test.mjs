import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg100_sec001.html", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

assert.match(bridge, /function buildPage100Map/);
assert.match(bridge, /mapping\.length === 65/);
assert.match(bridge, /mapping\.length === 34/);
assert.match(bridge, /mapping\.length === 23/);
assert.match(page, /Therefore, Dezi will take 4 days to read the whole<br>book\.<\/p>/);

for (const [id, length] of [["pg100_p001", 65], ["pg100_p013", 34], ["pg100_p020", 23]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, length, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 5, `${id} must use measured, non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

assert.deepEqual(
  timecodes.pg100_p013.timecodes[1].word_timestamps.slice(23, 28).map(({ text }) => text),
  ["36", "÷", "6", "=", "6"],
  "Example 2 must highlight the complete printed equation",
);
assert.ok(timecodes.pg100_p001.timecodes[1].word_timestamps[4].start >= 2.67, "the introduction must wait for the heading pause");
assert.ok(timecodes.pg100_p013.timecodes[1].word_timestamps[2].start >= 1.51, "Example 2 question must wait for its heading pause");
assert.ok(timecodes.pg100_p020.timecodes[1].word_timestamps[7].start >= 4.07, "Exercise 4 question must wait for its measured pause");
