import assert from "node:assert/strict";
import fs from "node:fs";

const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);
const words = timecodes.pg091_p001.timecodes[1].word_timestamps;

assert.equal(words.length, 210, "page 91 must time every narrated token");
assert.deepEqual(words.slice(0, 7).map(({ text }) => text), [
  "Exercise", "8", "Answer", "the", "following", "questions", "1",
]);
assert.equal(words[0].start, 0);
assert.ok(words[1].end <= 1.01, "Exercise 8 must finish before its measured pause");
assert.ok(words[2].start >= 1.38, "Answer must wait for the narration to resume");
assert.ok(words.at(-1).end <= 74.56, "the final highlight must finish with the speech");

for (let index = 0; index < words.length; index += 1) {
  assert.ok(words[index].end > words[index].start, `word ${index} must have positive duration`);
  if (index) assert.ok(words[index].start >= words[index - 1].end, `word ${index} must not overlap`);
}

const gaps = words.slice(1).map((word, index) => word.start - words[index].end);
assert.ok(gaps.filter((gap) => gap >= .25).length >= 30, "timestamps must preserve the recording's natural pauses");
assert.ok(new Set(words.map((word) => (word.end - word.start).toFixed(3))).size > 20, "word durations must not be uniformly generated");
