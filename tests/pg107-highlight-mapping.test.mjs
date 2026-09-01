import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg107_sec001.html", "utf8");
const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage107Map/);
assert.match(bridge, /items\.sort/);
assert.match(bridge, /exerciseMap\.length === 142/);
assert.match(bridge, /copyMap\.length === 65/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=71/);
assert.ok(page.includes(`data-id="pg107_p001">${texts.pg107_p001}</span>`), "page narration must match the detailed question text");
assert.ok(page.includes(`data-id="pg107_p013">${texts.pg107_p013}</span>`), "quarter narration must match the timed text");

for (const [id, count] of [["pg107_p001", 142], ["pg107_p013", 65]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 20, `${id} must use natural non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const exercise = timecodes.pg107_p001.timecodes[1].word_timestamps;
for (const [index, minimum] of [[21, 7.55], [30, 11.57], [46, 18.15], [61, 25.24], [76, 31.32], [90, 37.2], [101, 42], [113, 46.81], [130, 53.47]]) {
  assert.ok(exercise[index].start >= minimum, `question at token ${index} must wait for its measured pause`);
}
assert.ok(exercise.at(-1).end <= 56.995, "exercise highlighting must finish with the narration");

const quarter = timecodes.pg107_p013.timecodes[1].word_timestamps;
assert.ok(quarter[7].start >= 3.37, "the explanation must wait for the heading pause");
assert.ok(quarter[45].start >= 16.63, "numeral narration must wait for the paragraph pause");
assert.ok(quarter.at(-1).end <= 22.853, "quarter highlighting must finish with the narration");

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg107_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
