import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg101_sec001.html", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

assert.match(bridge, /function buildPage101Map/);
assert.match(bridge, /section\.querySelectorAll\("\.pg101-question"\)/);
assert.match(bridge, /mapping\.length === 178/);
assert.match(page, /How many hectares did each villager get\?/);
assert.doesNotMatch(page, /How many hectors did each villager get\?/);

const words = timecodes.pg101_p001.timecodes[1].word_timestamps;
assert.equal(words.length, 178, "page 101 must map every narrated token");
assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 15, "page 101 must use measured, non-uniform timing");
for (let index = 1; index < words.length; index += 1) {
  assert.ok(words[index].start >= words[index - 1].end, "page 101 timestamps must not overlap");
}

const questionStarts = [0, 15, 35, 56, 79, 98, 122, 141, 160];
assert.deepEqual(questionStarts.map((index) => words[index].text), ["2", "3", "4", "5", "6", "7", "8", "9", "10"]);
assert.ok(words[0].start >= 0.63, "question 2 must wait for the initial silence");
assert.ok(words[15].start >= 7.70, "question 3 must wait for question 2 to finish");
assert.ok(words[160].start >= 63.75, "question 10 must wait for question 9 to finish");
assert.ok(words.at(-1).end <= 70.27, "highlighting must stop with the natural narration");
