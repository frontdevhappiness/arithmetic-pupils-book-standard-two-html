import assert from "node:assert/strict";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const page = fs.readFileSync("pg139_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(audios.pg139_p001, "pg139_p001_adt_natural.mp3");
assert.equal(audios.pg139_p010, "pg139_p010_adt_natural.mp3");
for (const id of ["pg139_p001", "pg139_p010"]) {
  const narration = texts[id].match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(words.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
}

const continuation = timecodes.pg139_p001.timecodes[1].word_timestamps;
assert.deepEqual(continuation[3], { text: "3", start: 2.789, end: 3.149 });
assert.deepEqual(continuation[11], { text: "4", start: 6.671, end: 7.062 });
assert.deepEqual(continuation[23], { text: "5", start: 11.188, end: 11.669 });
assert.deepEqual(continuation[35], { text: "6", start: 15.941, end: 16.422 });
assert.deepEqual(continuation[47], { text: "7", start: 21.237, end: 21.689 });

const exercise = timecodes.pg139_p010.timecodes[1].word_timestamps;
assert.deepEqual(exercise[49], { text: "Questions", start: 21.546, end: 22.144 });
assert.deepEqual(exercise[50], { text: "1", start: 22.529, end: 22.853 });
assert.deepEqual(exercise[58], { text: "2", start: 25.809, end: 26.142 });
assert.deepEqual(exercise[69], { text: "3", start: 28.967, end: 29.256 });

assert.match(page, /read-aloud-highlight-bridge\.js\?v=99/);
assert.match(bridge, /function buildPage139Map/);
assert.match(bridge, /\.pg139-continuation li/);
assert.match(bridge, /\.pg139-question-title/);
assert.match(bridge, /shapeImages\[0\]/);
assert.match(bridge, /narration\[cursor\] === token\.normalized \+ tokens\[index \+ 1\]\.normalized/);
assert.match(bridge, /combined\.setStart[\s\S]*combined\.setEnd/);
assert.equal(offline["./pg139_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
