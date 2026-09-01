import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const page = fs.readFileSync("pg134_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const narrationParts = [
  ["pg134_p001", "Chapter Eleven. Shapes. Plane figures. Plane figures are shapes drawn on flat surfaces. Example. The following are examples of plane figures and their shapes. 1. rectangle. The shape of a rectangle.", "pg134_p001_part1_original.mp3"],
  ["pg134_p001_part2", "2. square. The shape of a square.", "pg134_p001_part2_original.mp3"],
  ["pg134_p001_part3", "3. circle. A shape of a circle.", "pg134_p001_part3_original.mp3"],
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

const expected = [
  ["pg134_im002", "A light green horizontal rectangle. It is wider than it is tall.", "pg134_im002_description.mp3"],
  ["pg134_im004", "A light blue square. It has four equal sides.", "pg134_im004_description.mp3"],
  ["pg134_im006", "A light blue circle. It is round and has no corners.", "pg134_im006_description.mp3"],
];

for (const [id, description, filename] of expected) {
  assert.equal(texts[id], description);
  assert.equal(audios[id], filename);
  assert.match(page, new RegExp(`data-id="${id}">${description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/span>`));
  const words = description.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
  assert.deepEqual(
    timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text.toLowerCase()),
    words.map((word) => word.toLowerCase()),
  );
}

for (const id of ["pg134_im001", "pg134_im003", "pg134_im005"]) {
  assert.equal(texts[id], "");
  assert.equal(audios[id], undefined);
}

assert.match(page, /The shape of a rectangle<\/p><img src="images\/pg134_im002\.png" alt="A light green horizontal rectangle\. It is wider than it is tall\."/);
assert.match(page, /The shape of a square<\/p><img src="images\/pg134_im004\.png" alt="A light blue square\. It has four equal sides\."/);
assert.match(page, /A shape of a circle<\/p><img src="images\/pg134_im006\.png" alt="A light blue circle\. It is round and has no corners\."/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=91/);
assert.match(bridge, /function buildPage134SecondColumnImageMap/);
assert.match(bridge, /pg134_im002:[\s\S]*pg134_im004:[\s\S]*pg134_im006:/);
const order = ["pg134_p001", "pg134_im002", "pg134_p001_part2", "pg134_im004", "pg134_p001_part3", "pg134_im006"];
for (let index = 1; index < order.length; index += 1) {
  assert.ok(page.indexOf(`data-id="${order[index - 1]}"`) < page.indexOf(`data-id="${order[index]}"`));
}
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg134_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
