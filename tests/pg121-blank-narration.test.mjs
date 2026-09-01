import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const page = fs.readFileSync("pg121_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const expectedText = "Exercise 1 continues. 1. The ball is blank the flask bottle. 2. The ball is blank the chair. 3. The chair is blank the ball. 4. The chair is blank the flask bottle.";
assert.equal(texts.pg121_p001, expectedText);
assert.equal((texts.pg121_p001.match(/\bblank\b/g) || []).length, 4);
assert.match(page, new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.equal((page.match(/class="pg121-blank" aria-label="blank"/g) || []).length, 4);

assert.equal(audios.pg121_p001, "pg121_p001_continuous_blank_tts.mp3");
const words = timecodes.pg121_p001.timecodes[1].word_timestamps;
assert.equal(words.filter(({ text }) => text.toLowerCase() === "blank").length, 4);
assert.deepEqual(
  words.filter(({ text }) => text.toLowerCase() === "blank").map(({ start, end }) => [start, end]),
  [[3.5875, 3.9], [6.9125, 7.2125], [9.925, 10.2125], [12.8375, 13.1375]],
);
for (let index = 1; index < words.length; index += 1) {
  assert.ok(words[index].start >= words[index - 1].end, `word ${index} must not overlap its predecessor`);
}
const duration = Number(execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
  `content/i18n/en-GB/audio/${audios.pg121_p001}`,
], { encoding: "utf8" }).trim());
assert.ok(Math.abs(duration - 15.192) < 0.01);
assert.ok(words.at(-1).end <= duration);

assert.match(page, /read-aloud-highlight-bridge\.js\?v=88/);
assert.match(bridge, /function buildPage121Map/);
assert.match(bridge, /row\.querySelector\("\.pg121-blank"\)/);
assert.match(bridge, /var mapping = \[null, null, null\]/);
assert.doesNotMatch(bridge, /var mapping = \[section, section, section\]/);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg121_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
