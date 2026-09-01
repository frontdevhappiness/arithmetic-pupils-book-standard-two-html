import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const page = fs.readFileSync("pg135_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const narrationParts = [
  ["pg135_p001", "The examples of plane figures continue. 4. parallelogram. The shape of a parallelogram.", "pg135_p001_part1_original.mp3"],
  ["pg135_p001_part2", "5. trapezium. The shape of a trapezium.", "pg135_p001_part2_original.mp3"],
  ["pg135_p001_part3", "6. triangle. The shape of a triangle.", "pg135_p001_part3_original.mp3"],
  ["pg135_p001_part4", "7. rhombus. The shape of a rhombus.", "pg135_p001_part4_original.mp3"],
  ["pg135_p001_part5", "8. oval. The shape of an oval.", "pg135_p001_part5_original.mp3"],
];

for (const [id, narration, filename] of narrationParts) {
  assert.equal(texts[id], narration);
  assert.equal(audios[id], filename);
  const words = narration.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
  const timedWords = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(timedWords.map(({ text }) => text.toLowerCase()), words.map((word) => word.toLowerCase()));
  const duration = Number(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
    `content/i18n/en-GB/audio/${filename}`,
  ], { encoding: "utf8" }).trim());
  assert.ok(timedWords.at(-1).end <= duration);
}

const descriptions = [
  ["pg135_im002", "An orange parallelogram. It has four sides and two pairs of opposite, parallel sides.", "pg135_im002_description.mp3", "The shape of a<br>parallelogram"],
  ["pg135_im004", "A purple trapezium. It has four sides and one pair of parallel sides.", "pg135_im004_description.mp3", "The shape of a trapezium"],
  ["pg135_im006", "A yellow triangle. It has three sides and three corners.", "pg135_im006_description.mp3", "The shape of a triangle"],
  ["pg135_im008", "A red rhombus. It has four equal sides, with opposite sides parallel.", "pg135_im008_description.mp3", "The shape of a rhombus"],
  ["pg135_im010", "A light blue oval. It is a stretched, rounded shape with no corners.", "pg135_im010_description.mp3", "The shape of an oval"],
];

for (const [id, description, filename, caption] of descriptions) {
  assert.equal(texts[id], description);
  assert.equal(audios[id], filename);
  const words = description.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
  assert.deepEqual(
    timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text.toLowerCase()),
    words.map((word) => word.toLowerCase()),
  );
  assert.match(page, new RegExp(`${caption}<\\/p><img src="images\\/${id}\\.png" alt="${description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
}

for (const id of ["pg135_im001", "pg135_im003", "pg135_im005", "pg135_im007", "pg135_im009"]) {
  assert.equal(texts[id], "");
  assert.equal(audios[id], undefined);
}

assert.match(page, /read-aloud-highlight-bridge\.js\?v=93/);
assert.match(bridge, /function buildPage135SecondColumnImageMap/);
assert.match(bridge, /function buildPage135Item4Map/);
assert.match(bridge, /row\.querySelector\("\.pg135-number"\)/);
assert.match(bridge, /pg135_im002:[\s\S]*pg135_im004:[\s\S]*pg135_im006:[\s\S]*pg135_im008:[\s\S]*pg135_im010:/);
const order = ["pg135_p001", "pg135_im002", "pg135_p001_part2", "pg135_im004", "pg135_p001_part3", "pg135_im006", "pg135_p001_part4", "pg135_im008", "pg135_p001_part5", "pg135_im010"];
for (let index = 1; index < order.length; index += 1) {
  assert.ok(page.indexOf(`data-id="${order[index - 1]}"`) < page.indexOf(`data-id="${order[index]}"`));
}

assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg135_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
