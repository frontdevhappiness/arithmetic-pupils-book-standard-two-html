import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

assert.match(bridge, /function buildPage98Map/);
assert.match(bridge, /bottleIndex < 6/);
assert.match(bridge, /mapping\.length === 11/);
assert.match(bridge, /mapping\.length === 64/);
assert.match(bridge, /mapping\.length === 12/);

for (const [id, length] of [["pg098_p001", 11], ["pg098_p003", 64], ["pg098_p016", 12]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, length, `${id} must time every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 5, `${id} must use measured, non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

assert.deepEqual(
  timecodes.pg098_p001.timecodes[1].word_timestamps.slice(-4).map(({ text }) => text),
  ["16", "÷", "4", "="],
  "question 5 must highlight both spoken operators",
);
assert.ok(timecodes.pg098_p003.timecodes[1].word_timestamps[24].start >= 10.21, "Example 1 must wait for its measured pause");
assert.ok(timecodes.pg098_p016.timecodes[1].word_timestamps[2].start >= 1.43, "Example 2 equation must wait for its measured pause");
