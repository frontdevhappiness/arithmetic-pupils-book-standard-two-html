import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg119_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage119Map/);
assert.match(bridge, /expectedStepWords = \[6, 9, 10, 6, 9\]/);
assert.match(bridge, /repeat\(mapping, \[images\[0\], images\[1\]\], 11\)/);
assert.match(bridge, /repeat\(mapping, images\[0\], 5\)/);
assert.match(bridge, /repeat\(mapping, images\[1\], 9\)/);
assert.match(bridge, /solutionWords\.length !== 18/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=84/);
assert.equal((page.match(/class="step-number"/g) || []).length, 5, "all five step numbers must be visible highlight targets");
assert.equal((page.match(/class="step-text"/g) || []).length, 5, "all five step instructions must be individually mapped");

const words = timecodes.pg119_p001.timecodes[1].word_timestamps;
assert.equal(words.length, 98, "page 119 must time every narrated token");
assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size >= 25, "page 119 must retain non-uniform speech timings");
for (let index = 1; index < words.length; index += 1) {
  assert.ok(words[index].start >= words[index - 1].end, "page 119 timestamps must not overlap");
}
assert.deepEqual(words.slice(52, 61).map(({ text }) => text), ["Steps", "1", "Open", "the", "application", "for", "recognizing", "fractions", "2"]);

assert.equal(offline["./pg119_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
