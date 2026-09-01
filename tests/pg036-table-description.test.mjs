import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg036_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const expected = "Table description. The chart has eight rows and nine columns. Each row shows a sequence of three-digit numbers with one missing number. Rows are read from left to right. The missing number is in column four of the first row, column two of the second row, column six of the third row, column five of the fourth row, column two of the fifth row, column seven of the sixth row, column nine of the seventh row, and column three of the eighth row.";
assert.equal(texts.pg036_im003, expected);
assert.equal(audios.pg036_im003, "pg036_im003_table_description.mp3");
const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");
assert.equal(hash(audios.pg036_im003), "2051b002ad21f29dae024a959bc3ee53c056c57305d7485f1e36f87f3eab5927");

const narration = expected.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
const timed = timecodes.pg036_im003.timecodes[1].word_timestamps;
assert.deepEqual(timed.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
assert.ok(timed.every(({ start, end }) => end - start >= 0.099));
assert.ok(timed.every(({ start, end }, index) => end <= 27.144 && (!index || start >= timed[index - 1].end)));

assert.ok(page.indexOf('data-id="pg036_p002"') < page.indexOf('data-id="pg036_im003"'));
assert.ok(page.indexOf('data-id="pg036_im003"') < page.indexOf('data-id="pg036_p004"'));
assert.equal((page.match(/data-id="pg036_im003"/g) || []).length, 1);
assert.match(page, /data-id="pg036_im003"[\s\S]*?<table[\s\S]*?aria-label="Number chart from 201 to 909"/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=111/);
assert.match(bridge, /sourceId === "pg036_im003"/);
assert.match(config.bundleVersion, /-pg036-table-description-1(?:-|$)/);
assert.doesNotMatch(expected, /204|302|406|505|602|707|809|903/, "the description must not reveal missing-number answers");

assert.equal(hash("pg036_im003.mp3"), "83378e23de445167f7f8853769aaf3f88ccf3e9d53a11edefbe9c4365657f4dd");
assert.equal(hash("pg036_p001.mp3"), "7bc01bcb12b006fceaa74b0c2fdf89e9a2ded76551485422942446490b6736bd");
assert.equal(hash("pg036_p002_adt_clean.mp3"), "bfadca03c39aa8580632be9ff13cf62ecfe99c3b45817d760d2edd04668b67ab");
assert.equal(hash("pg036_p004.mp3"), "ecfbb35b25d7345834160403ff24a520bb398d3311dd342de7281d34ff1d6a7c");
assert.equal(hash("pg036_p031.mp3"), "070ad9ceec9005ba12dd0e9183a584baa594ed7c77ea2d036251cb0c1d1b95aa");

assert.deepEqual(offline["./assets/config.json"], config);
assert.equal(offline["./pg036_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 36 Exercise 9 now introduces its missing-number chart without revealing answers.");
