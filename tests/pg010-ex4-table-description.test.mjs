import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg010_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const expected = "Table description. The table has ten rows and ten columns. The first row contains 201 to 210. The second row contains 211 to 220. The third row contains 221 to 230. The fourth row contains 231 to 240. The fifth row contains 241 to 250. The sixth row contains 251 to 260. The seventh row contains 261 to 270. The eighth row contains 271 to 280. The ninth row contains 281 to 290. The tenth row contains 291 to 300. Rows are read from left to right.";
assert.equal(texts.pg010_im001, expected);
assert.equal(audios.pg010_im001, "pg010_im001_table_description.mp3");
assert.equal(createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${audios.pg010_im001}`)).digest("hex"), "e1613ae7d966ea6a02226b869bf287644714074c95b5408339044223b2bbe1b2");

const narration = expected.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
const timed = timecodes.pg010_im001.timecodes[1].word_timestamps;
assert.deepEqual(timed.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
assert.ok(timed.every(({ start, end }) => end - start >= 0.099));

assert.ok(page.indexOf('data-id="pg010_p003"') < page.indexOf('data-id="pg010_im001"'));
assert.ok(page.indexOf('data-id="pg010_im001"') < page.indexOf('data-id="pg010_p004"'));
assert.match(page, /data-id="pg010_im001"[\s\S]*?<table class="number-table"/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=104/);
assert.match(bridge, /sourceId === "pg010_im001"/);
assert.match(config.bundleVersion, /-pg010-ex4-table-description-1(?:-|$)/);

const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");
assert.equal(hash("pg010_p001.mp3"), "9f3f2e7484772348ed79176c976525bc21a94373847d4f2822fefd8626bfdade");
assert.equal(hash("pg010_p003.mp3"), "cbba7254cc0670a3681fe1e587db1f8caa6fa63c260b229997acb4587d105230");
assert.equal(hash("pg010_p004.mp3"), "912a69a7db82437372149e4700edceb822df8a1ad1d4b04226cea417bf11940c");

assert.deepEqual(offline["./assets/config.json"], config);
assert.equal(offline["./pg010_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 10 Exercise 4 now introduces and describes its number table.");
