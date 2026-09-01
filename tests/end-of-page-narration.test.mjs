import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const pages = JSON.parse(fs.readFileSync("content/pages.json", "utf8"));
const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(pages.length, 144);
assert.match(config.bundleVersion, /-end-of-page-narration-1(?:-|$)/);
assert.equal(offline["./assets/config.json"].bundleVersion, config.bundleVersion);
assert.match(bridge, /\/_p999\$\/\.test\(sourceId\)/);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);

const clip = "content/i18n/en-GB/audio/end_of_page_elimu_neural.mp3";
assert.ok(fs.existsSync(clip));
assert.equal(createHash("sha256").update(fs.readFileSync(clip)).digest("hex"), "3707305ecf03f82d4b95988093db49753fcc192259014e81a208677124768773");

for (const { section_id: sectionId, href } of pages) {
  const id = `${sectionId.slice(0, 5)}_p999`;
  const html = fs.readFileSync(href, "utf8");
  const hook = `<span class="sr-only" data-id="${id}">End of page.</span>`;
  assert.equal(texts[id], "End of page.", `${id} must use the exact final announcement`);
  assert.equal(audios[id], "end_of_page_elimu_neural.mp3", `${id} must reuse the dedicated clip`);
  assert.deepEqual(timecodes[id], {
    timecodes: [null, { word_timestamps: [
      { text: "End", start: 0.1, end: 0.325 },
      { text: "of", start: 0.325, end: 0.475 },
      { text: "page", start: 0.55, end: 0.7875 },
    ] }],
  });
  assert.equal(html.split(hook).length - 1, 1, `${href} must contain one final announcement`);
  const articleSource = html.slice(0, html.lastIndexOf("</article>"));
  assert.equal(articleSource.lastIndexOf("data-id="), articleSource.indexOf(`data-id="${id}"`), `${id} must be the page's final narrated element`);
  assert.ok(html.indexOf(hook) < html.lastIndexOf("</article>"), `${id} must remain inside the page article`);
  assert.equal(offline[`./${href}`], html, `${href} must match its offline copy`);
}

assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("All 144 pages end with the isolated 'End of page' narration.");
