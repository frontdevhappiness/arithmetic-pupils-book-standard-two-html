import assert from "node:assert/strict";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const page = fs.readFileSync("pg137_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(texts.pg137_p001, "Exercise 2 questions. 1. List all similar shapes by writing their letters together. 2. Write the letters of all the shapes of triangles. 3. Write the letters of all the shapes with four sides. 4. Write the names of all the shapes of plane figures you know.");
assert.equal(texts.pg137_p007, "Activity. Playing ukuti-ukuti. Let us play together by joining our hands. The picture shows nine schoolchildren holding hands in a circle outdoors.");
assert.equal(audios.pg137_p001, "pg137_p001_adt_natural.mp3");
assert.equal(audios.pg137_p007, "pg137_p007_adt_natural.mp3");

for (const number of [1, 2, 3, 4]) {
  assert.match(page, new RegExp(`<span class="pg137-question-number">${number}\\.<\\/span>`));
}
assert.doesNotMatch(page, /counter\(pg137-question\)/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=96/);
assert.match(bridge, /function buildPage137Map/);
assert.match(bridge, /\.pg137-question-number/);
assert.match(bridge, /\.pg137-question-text/);
assert.match(bridge, /mapping\[activityCursor\] = picture/);
assert.doesNotMatch(bridge, /var exercise = section\.querySelector\("\.pg137-exercise"\)/);
const questionWords = timecodes.pg137_p001.timecodes[1].word_timestamps;
assert.deepEqual(questionWords[3], { text: "1", start: 2.596, end: 2.989 });
assert.deepEqual(questionWords[13], { text: "2", start: 7.221, end: 7.522 });
assert.deepEqual(questionWords[23], { text: "3", start: 11.677, end: 11.988 });
assert.deepEqual(questionWords[34], { text: "4", start: 15.998, end: 16.347 });
assert.ok(questionWords[4].start >= 3.482, "question 1 words must wait for the spoken question");
assert.ok(questionWords[35].start >= 16.902, "question 4 words must wait for the spoken question");
assert.equal(offline["./pg137_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
