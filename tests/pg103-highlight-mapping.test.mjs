import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg103_sec001.html", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

assert.match(bridge, /function buildPage103Map/);
assert.match(bridge, /overviewIndex < 6/);
assert.match(bridge, /questionIndex < 4/);
assert.match(bridge, /answerIndex < 10/);
assert.match(bridge, /mapping\.length === 64/);
assert.match(page, /Do other questions to practise division of numbers\./);
assert.doesNotMatch(page, /Do other questions to practice division of numbers\./);

const words = timecodes.pg103_p001.timecodes[1].word_timestamps;
assert.equal(words.length, 64, "page 103 must map every narrated token");
assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 12, "page 103 must use measured, non-uniform timing");
for (let index = 1; index < words.length; index += 1) {
  assert.ok(words[index].start >= words[index - 1].end, "page 103 timestamps must not overlap");
}
assert.deepEqual([21, 29, 39, 48, 55].map((index) => words[index].text), ["1", "2", "3", "4", "5"]);
assert.ok(words[0].start >= 0.50, "the screenshot description must wait for initial silence");
assert.ok(words[20].start >= 10.23, "Steps must wait for the screenshot description to finish");
assert.ok(words[55].start >= 25.21, "step 5 must wait for step 4 to finish");
assert.ok(words.at(-1).end <= 28.59, "highlighting must stop with the natural narration");
