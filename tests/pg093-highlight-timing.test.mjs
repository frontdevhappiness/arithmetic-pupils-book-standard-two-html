import assert from "node:assert/strict";
import fs from "node:fs";

const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");

assert.match(
  bridge,
  /content\.matches\('\[data-section-id="pg093_sec001"\]'\)[\s\S]*?\? content[\s\S]*?: content\.querySelector/,
  "page 93 must map visible words when #content is itself the page article",
);

for (const [id, length] of [["pg093_p001", 74], ["pg093_p009", 37]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, length, `${id} must time every narrated token`);
  for (let index = 0; index < words.length; index += 1) {
    assert.ok(words[index].end > words[index].start, `${id} word ${index} must have positive duration`);
    if (index) assert.ok(words[index].start >= words[index - 1].end, `${id} word ${index} must not overlap`);
  }
  assert.ok(new Set(words.map((word) => (word.end - word.start).toFixed(3))).size > 8, `${id} durations must not be uniformly generated`);
}

const introduction = timecodes.pg093_p001.timecodes[1].word_timestamps;
assert.ok(introduction[2].start >= 1.28, "Division must wait for the measured chapter-title pause");
assert.ok(introduction[3].start >= 2.43, "the topic heading must wait for the measured pause");
assert.ok(introduction[6].start >= 4.62, "the introduction must wait for narration to resume");
assert.ok(introduction.at(-1).end <= 28.35, "the final introductory highlight must finish with the speech");

const example = timecodes.pg093_p009.timecodes[1].word_timestamps;
assert.ok(example[1].start >= 1.20, "the example instruction must wait for narration to resume");
assert.ok(example[14].start >= 6.28, "Steps must wait for the measured pause");
assert.ok(example[15].start >= 7.46, "step 1 must wait for the measured pause");
assert.ok(example[16].start >= 8.02, "the step instruction must wait for narration to resume");
assert.ok(example[27].start >= 11.55, "the image description must wait for narration to resume");
