import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg009_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const expected = "Table description. The table has five rows and ten columns. The first row contains 151 to 160. The second row contains 161 to 170. The third row contains 171 to 180. The fourth row contains 181 to 190. The fifth row contains 191 to 200. Rows are read from left to right.";
assert.equal(texts.pg009_p005, expected);
assert.equal(audios.pg009_p005, "pg009_p005_table_description.mp3");
assert.equal(createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${audios.pg009_p005}`)).digest("hex"), "dced2e6fc6eaab257e32b26c8443b339f91a5d41a0cd593d2fc53c46f2936b4c");

const narration = expected.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
const timed = timecodes.pg009_p005.timecodes[1].word_timestamps;
assert.deepEqual(timed.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
assert.ok(timed.every(({ start, end }) => end - start >= 0.099));

assert.ok(page.indexOf('data-id="pg009_p004"') < page.indexOf('data-id="pg009_p005"'));
assert.ok(page.indexOf('data-id="pg009_p005"') < page.indexOf('data-id="pg009_p006"'));
assert.match(page, /data-id="pg009_p005"[\s\S]*<table class="number-table"/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=102/);
assert.match(bridge, /sourceId === "pg009_p005"/);
assert.match(config.bundleVersion, /-pg009-table-description-1(?:-|$)/);

const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");
assert.equal(hash("pg009_p003.mp3"), "b7177467bca37271c9a207c130a7c19ddbe99e3b3a072b92a960b44905d9a26b");
assert.equal(hash("pg009_p004.mp3"), "2ca2e4a3b0eb3326cebaf5c89504067f906a69da86067085d5f89d24efbd7763");
assert.equal(hash("pg009_p006.mp3"), "045004987d00f16497895f146c2582ad34ab40288d01f8ec264e2dca4e7140a8");

assert.equal(offline["./pg009_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 9 Exercise 3 now introduces and describes its number table.");
