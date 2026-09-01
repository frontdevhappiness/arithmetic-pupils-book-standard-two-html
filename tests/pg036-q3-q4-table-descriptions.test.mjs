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

const descriptions = {
  pg036_im004: "Table description. The table has four columns headed Number, Hundreds, Tens, and Ones, followed by five rows. Rows are read from left to right. The first row contains 229, a blank in Hundreds, 2 in Tens, and a blank in Ones. The second row contains 368, 3 in Hundreds, a blank in Tens, and a blank in Ones. The third row contains 876, a blank in Hundreds, a blank in Tens, and 6 in Ones. The fourth row contains 569, a blank in Hundreds, 6 in Tens, and a blank in Ones. The fifth row contains 997, 9 in Hundreds, a blank in Tens, and a blank in Ones.",
  pg036_im005: "Table description. The table has four columns headed Hundreds, Tens, Ones, and Number, followed by five rows. Rows are read from left to right. The first row contains 1 in Hundreds, 1 in Tens, 9 in Ones, and a blank in Number. The second row contains 8 in Hundreds, 2 in Tens, 7 in Ones, and a blank in Number. The third row contains 2 in Hundreds, 6 in Tens, 3 in Ones, and a blank in Number. The fourth row contains 6 in Hundreds, 1 in Tens, 0 in Ones, and a blank in Number. The fifth row contains 3 in Hundreds, 3 in Tens, 3 in Ones, and a blank in Number.",
};
const expectedAudio = {
  pg036_im004: ["pg036_im004_table_description.mp3", "d0f6207c7548b9528c310699ba0cd8eb65972741ac7f9dbbc01cb45c831fed47", 46.2],
  pg036_im005: ["pg036_im005_table_description.mp3", "a6c15906086d5d45a91e24c3e433915eebe50a2a5d4b04f86da0774ae7915ae3", 43.152],
};
const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");

for (const [id, expected] of Object.entries(descriptions)) {
  const [filename, expectedHash, duration] = expectedAudio[id];
  assert.equal(texts[id], expected);
  assert.equal(audios[id], filename);
  assert.equal(hash(filename), expectedHash);
  const narration = expected.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
  const timed = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(timed.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
  assert.ok(timed.every(({ start, end }) => end - start >= 0.099));
  assert.ok(timed.every(({ start, end }, index) => end <= duration && (!index || start >= timed[index - 1].end)));
  assert.match(bridge, new RegExp(`sourceId === "${id}"`));
  assert.equal((page.match(new RegExp(`data-id="${id}"`, "g")) || []).length, 1);
}

assert.ok(page.indexOf('data-id="pg036_p032"') < page.indexOf('data-id="pg036_im004"'));
assert.ok(page.indexOf('data-id="pg036_im004"') < page.indexOf('data-id="pg036_p034"'));
assert.ok(page.indexOf('data-id="pg036_p048"') < page.indexOf('data-id="pg036_im005"'));
assert.ok(page.indexOf('data-id="pg036_im005"') < page.indexOf('data-id="pg036_p050"'));
assert.match(page, /read-aloud-highlight-bridge\.js\?v=111/);
assert.match(config.bundleVersion, /-pg036-q3-q4-table-descriptions-1$/);
assert.doesNotMatch(descriptions.pg036_im005, /\b(?:119|827|263|610|333)\b/, "Question 4 must not supply formed-number answers");

assert.equal(hash("pg036_im003_table_description.mp3"), "2051b002ad21f29dae024a959bc3ee53c056c57305d7485f1e36f87f3eab5927");
assert.equal(hash("pg036_p032.mp3"), "d542958af790a244d677c6f90d1767390cd4d941347c3f5a0f444c5b00c2151a");
assert.equal(hash("pg036_p034.mp3"), "892eceeb3c278fc54a2479ec1348a6dc543d94e817b91652e2b7e2ab7ef0f6a5");
assert.equal(hash("pg036_p048.mp3"), "423ea74ca1e979a7fa8d0d4ae12a07b44d022e4d0f9333f22bf2fa3015f780e7");
assert.equal(hash("pg036_p050.mp3"), "0370ece4663ba83d1abfc87543d4bd6bbd0f0d3008480fd31ebf706a580b724a");

assert.deepEqual(offline["./assets/config.json"], config);
assert.equal(offline["./pg036_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 36 Questions 3 and 4 now introduce and describe their place-value tables.");
