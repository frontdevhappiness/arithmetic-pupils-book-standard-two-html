import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("pg037_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));

assert.match(
  page,
  /class="narration-only" data-id="pg037_im007">Chapter Five: Addition\.<\/span>/,
  "the chapter narration must be real hidden text so the reader can expose word timing",
);
assert.ok(
  page.indexOf('data-id="pg037_im007"') < page.indexOf('class="semantic-chapter-banner"'),
  "the chapter narration must precede the visible banner and lesson content in reading order",
);
assert.match(bridge, /function buildPage37ChapterBannerMap/);
for (const id of ["pg037_p023", "pg037_p024", "pg037_p022"]) {
  assert.match(bridge, new RegExp(`"${id}"`), `${id} must be a chapter-highlight target`);
}
assert.equal(audios.pg037_im007, "pg037_im007.mp3");
assert.deepEqual(
  timecodes.pg037_im007.timecodes[1].word_timestamps.map(({ text }) => text),
  ["Chapter", "5", "Addition"],
);

assert.match(
  page,
  /class="narration-only" data-id="pg037_im008">In the hundreds column, two green counters/,
);
assert.ok(page.indexOf('data-id="pg037_p008"') < page.indexOf('data-id="pg037_im008"'));
assert.ok(page.indexOf('data-id="pg037_im008"') < page.indexOf('class="place-model-grid"'));
assert.equal(audios.pg037_im008, "pg037_im008_alloy.mp3");
assert.ok(fs.statSync(`content/i18n/en-GB/audio/${audios.pg037_im008}`).size > 1000);
const words = timecodes.pg037_im008.timecodes[1].word_timestamps;
assert.equal(words.length, 60);
for (let i = 0; i < words.length; i++) {
  assert.ok(words[i].end >= words[i].start);
  if (i) assert.ok(words[i].start >= words[i - 1].end);
}

// Exercise the actual mapping with distinct targets for each counter group.
const { runInNewContext } = await import("node:vm");
const functionSource = bridge.slice(bridge.indexOf("  function buildPage37ExampleMap("), bridge.indexOf("  function buildPage39ModelMap("));
const mapExample = runInNewContext(`(${functionSource.trim()})`);
const columns = Array.from({ length: 3 }, (_, index) => ({
  header: { name: `header-${index}` },
  counters: [0, 1, 2].map(row => ({ name: `counters-${index}-${row}` })),
  words: [0, 1, 2].map(row => ({ name: `word-${index}-${row}` })),
  querySelector() { return this.header; },
  querySelectorAll(selector) { return selector === ".counter-row" ? this.counters : this.words; },
}));
const source = {
  getAttribute() { return "pg037_im008"; },
  closest() { return { querySelectorAll() { return columns; } }; },
};
const mapping = mapExample(null, source, words);
columns.forEach((column, index) => {
  const offset = index * 20;
  assert.equal(mapping[offset + 2], column.header);
  assert.equal(mapping[offset + 4], column.counters[0]);
  assert.equal(mapping[offset + 8], column.words[0]);
  assert.equal(mapping[offset + 10], column.counters[1]);
  assert.equal(mapping[offset + 13], column.words[1]);
  assert.equal(mapping[offset + 14], column.counters[2]);
  assert.equal(mapping[offset + 18], column.words[2]);
  assert.equal(mapping[offset + 19], column.header);
});
console.log("Page 37 chapter and counter descriptions highlight their visible targets in order.");

for (const [id, expected] of [
  ["pg037_p007", ["Example", "1"]],
  ["pg037_p008", ["223", "+", "345", "="]],
  ["pg037_p021", ["Therefore", "345", "+", "223", "=", "568"]],
]) {
  assert.equal(audios[id], `${id}_alloy.mp3`);
  assert.ok(fs.statSync(`content/i18n/en-GB/audio/${audios[id]}`).size > 1000);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(word => word.text), expected);
}
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const start = offlineSource.indexOf("  var INLINE = ") + "  var INLINE = ".length;
const offline = JSON.parse(offlineSource.slice(start, offlineSource.indexOf(";\n  var BASE_DIR", start)));
for (const id of ["pg037_p007", "pg037_p008", "pg037_im008", "pg037_p021"]) {
  assert.equal(offline["./content/i18n/en-GB/audios.json"][id], audios[id]);
  assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"][id], timecodes[id]);
}

assert.ok(page.indexOf('data-id="pg037_p007"') < page.indexOf('data-id="pg037_p008"'));
