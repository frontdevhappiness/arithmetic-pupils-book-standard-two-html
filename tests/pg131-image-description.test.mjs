import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const page = fs.readFileSync("pg131_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(texts.pg131_p006, "Example. A cup has a smaller volume than a bucket.");
assert.equal(audios.pg131_p006, "pg131_p006_adt_natural.mp3");
assert.match(page, /data-id="pg131_p006">Example\. A cup has a smaller volume than a bucket\.<\/span>/);

const expected = [
  ["pg131_im001", "A blue bucket with a metal handle.", "pg131_im001_description.mp3", 7, 2.664],
  ["pg131_im002", "A yellow cup with a handle.", "pg131_im002_description.mp3", 6, 2.352],
];
for (const [id, description, filename, tokenCount, expectedDuration] of expected) {
  assert.equal(texts[id], description);
  assert.equal(audios[id], filename);
  const words = timecodes[id].timecodes[1].word_timestamps;
  const narration = description.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
  assert.equal(words.length, tokenCount);
  assert.deepEqual(words.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
  const duration = Number(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
    `content/i18n/en-GB/audio/${filename}`,
  ], { encoding: "utf8" }).trim());
  assert.ok(Math.abs(duration - expectedDuration) < 0.01);
  assert.ok(words.at(-1).end <= duration);
}

assert.match(page, /class="pg131-small-bucket"[^>]+alt="A blue bucket with a metal handle\."/);
assert.match(page, /class="pg131-cup"[^>]+alt="A yellow cup with a handle\."/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=89/);
assert.match(bridge, /function buildPage131ImageMap/);
assert.match(bridge, /new Array\(narration\.length\)\.fill\(image\)/);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg131_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
