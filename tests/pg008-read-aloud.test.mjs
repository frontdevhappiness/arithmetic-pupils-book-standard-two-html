import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));
const tokens = (text) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
const normal = (word) => word.toLocaleLowerCase("en-GB");

const html = read("pg008_sec001.html");
const pageMarkup = html.split("</main>", 1)[0];
const sharedCss = read("content/tailwind_output.css");
const fontCss = read("assets/fonts.css");
const bridge = read("assets/read-aloud-highlight-bridge.js");
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");

const domIds = [...pageMarkup.matchAll(/data-id="(pg008_[^"]+)"/g)].map((match) => match[1]);
const spokenOrder = domIds.filter((id) => audios[id] && id.includes("_p"));
const expectedOrder = Object.keys(audios).filter((id) => /^pg008_p/.test(id));
assert.deepEqual(spokenOrder, expectedOrder, "page-8 narration must follow the printed reading order");
assert.equal(new Set(spokenOrder).size, spokenOrder.length, "no passage may play twice");
assert.doesNotMatch(pageMarkup, /data-id="pg008_im00[13]"/, "duplicate exercise and activity descriptions must remain decorative");

let spokenWordCount = 0;
for (const id of spokenOrder) {
  const words = tokens(texts[id]);
  const stamps = timecodes[id]?.timecodes?.[1]?.word_timestamps;
  assert.ok(Array.isArray(stamps), `${id} must have word-level timestamps`);
  assert.deepEqual(stamps.map(({ text }) => normal(text)), words.map(normal), `${id} must map one timing interval to every displayed numeral or word`);
  spokenWordCount += words.length;

  let previousEnd = 0;
  for (const [index, stamp] of stamps.entries()) {
    assert.ok(Number.isFinite(stamp.start) && Number.isFinite(stamp.end), `${id} word ${index} timing must be finite`);
    assert.ok(stamp.end - stamp.start >= 0.1 - 1e-6, `${id} word ${index} must remain visible for multiple media-clock frames`);
    assert.ok(stamp.start >= previousEnd - 1e-6, `${id} word ${index} must not overlap the prior word`);
    previousEnd = stamp.end;
  }

  const probe = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1",
    new URL(`../content/i18n/en-GB/audio/${audios[id]}`, import.meta.url).pathname
  ], { encoding: "utf8" });
  const duration = Number(probe.stdout.trim());
  assert.ok(Number.isFinite(duration), `${id} audio duration must be readable`);
  assert.ok(previousEnd <= duration + 0.05, `${id} timestamps must fit its narration audio`);
}

for (const [id, expected] of Object.entries({
  pg008_p022: ["118"],
  pg008_p026: ["123"],
  pg008_p028: ["125", "126"],
  pg008_p033: ["132"],
  pg008_p034: ["133"],
  pg008_p035: ["134"]
})) {
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text), expected, `${id} spoken expansion must highlight its displayed numeral continuously`);
}

assert.match(html, /assets\/fonts\.css\?v=2/);
assert.match(html, /assets\/read-aloud-highlight-bridge\.js\?v=20/);
assert.match(sharedCss, /span\[data-word-index\]\.bg-yellow-300/);
assert.doesNotMatch(fontCss, /Word highlighting is temporarily disabled book-wide/);
assert.match(bridge, /position:fixed/);
assert.match(bridge, /range\.getClientRects\(\)/);
assert.doesNotMatch(bridge, /transition:[^;}]*\b(?:left|top|width|height)\b/, "overlay geometry must not lag behind narration");

console.log(`pg008 read-aloud regression: ${spokenOrder.length} passages and ${spokenWordCount} spoken words verified`);
