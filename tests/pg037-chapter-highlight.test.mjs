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

console.log("Page 37 chapter narration maps to Chapter, Five, and Addition in visible order.");
