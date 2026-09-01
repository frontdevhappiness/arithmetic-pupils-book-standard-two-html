import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

assert.match(bridge, /function buildPage102Map/);
assert.match(bridge, /exerciseMap\.length === 113/);
assert.match(bridge, /ictMap\.push\(equation\[0\], equation\[1\], equation\[1\], equation\[2\], equation\[3\]\)/);
assert.match(bridge, /ictMap\.length === 41/);

for (const [id, length] of [["pg102_p001", 113], ["pg102_p017", 41]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, length, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 10, `${id} must use measured, non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const exercise = timecodes.pg102_p001.timecodes[1].word_timestamps;
assert.deepEqual([33, 50, 64, 81, 97].map((index) => exercise[index].text), ["1", "2", "3", "4", "5"]);
assert.ok(exercise[33].start >= 13.35, "question 1 must wait for the story to finish");
assert.ok(exercise[97].start >= 37.70, "question 5 must wait for question 4 to finish");

const ict = timecodes.pg102_p017.timecodes[1].word_timestamps;
assert.deepEqual(ict.slice(13, 18).map(({ text }) => text), ["7", "divided", "by", "1", "equals"]);
assert.ok(ict[5].start >= 3.26, "the ICT introduction must wait for the heading pause");
assert.ok(ict[19].start >= 11.14, "the method must wait for Solution to finish");
assert.ok(ict.at(-1).end <= 21.42, "ICT highlighting must stop with the natural narration");
