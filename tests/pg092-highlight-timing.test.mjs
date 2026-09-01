import assert from "node:assert/strict";
import fs from "node:fs";

const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

for (const [id, length] of [["pg092_p001", 24], ["pg092_p004", 106]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, length, `${id} must time every narrated token`);
  for (let index = 0; index < words.length; index += 1) {
    assert.ok(words[index].end > words[index].start, `${id} word ${index} must have positive duration`);
    if (index) assert.ok(words[index].start >= words[index - 1].end, `${id} word ${index} must not overlap`);
  }
  assert.ok(new Set(words.map((word) => (word.end - word.start).toFixed(3))).size > 10, `${id} durations must not be uniformly generated`);
}

const question = timecodes.pg092_p001.timecodes[1].word_timestamps;
assert.ok(question[0].start >= .32, "question 10 must wait for the leading pause");
assert.ok(question[0].end <= .76, "question 10 must finish before the measured pause");
assert.ok(question[1].start >= 1.29, "John must wait for the narration to resume");

const example = timecodes.pg092_p004.timecodes[1].word_timestamps;
const exampleGaps = example.slice(1).map((word, index) => word.start - example[index].end);
assert.ok(exampleGaps.filter((gap) => gap >= .18).length >= 20, "the ICT narration must preserve its measured pauses");
assert.ok(example.at(-1).end <= 47.44, "the final highlight must finish with the speech");
