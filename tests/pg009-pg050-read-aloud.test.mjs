import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const json = (path) => JSON.parse(read(path));
const tokens = (text) => String(text ?? "").match(/[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*|[+\-−–×÷=<>/]/gu) ?? [];
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const runtime = read("assets/base.bundle.local.js");

const durationCache = new Map();
function duration(filename) {
  if (!durationCache.has(filename)) {
    const path = new URL(`content/i18n/en-GB/audio/${filename}`, root).pathname;
    const probe = spawnSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path
    ], { encoding: "utf8" });
    assert.equal(probe.status, 0, `${filename} must be readable audio`);
    durationCache.set(filename, Number(probe.stdout.trim()));
  }
  return durationCache.get(filename);
}

function meanVolume(filename) {
  const path = new URL(`content/i18n/en-GB/audio/${filename}`, root).pathname;
  const measure = spawnSync("ffmpeg", [
    "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"
  ], { encoding: "utf8" });
  assert.equal(measure.status, 0, `${filename} volume must be measurable`);
  const match = measure.stderr.match(/mean_volume:\s*(-?[\d.]+) dB/);
  assert.ok(match, `${filename} must report a mean volume`);
  return Number(match[1]);
}

let passageCount = 0;
let tokenCount = 0;
for (let pageNumber = 9; pageNumber <= 50; pageNumber += 1) {
  const page = String(pageNumber).padStart(3, "0");
  const markup = read(`pg${page}_sec001.html`).split("</main>", 1)[0];
  const domIds = [...markup.matchAll(new RegExp(`data-id="(pg${page}_[^"]+)"`, "g"))].map((match) => match[1]);
  const spoken = domIds.filter((id) => audios[id] && id.includes("_p"));
  const mapped = Object.keys(audios).filter((id) => id.startsWith(`pg${page}_p`));
  assert.deepEqual(new Set(spoken), new Set(mapped), `page ${pageNumber} must expose every mapped body narration`);
  assert.equal(new Set(spoken).size, spoken.length, `page ${pageNumber} must not play a body passage twice`);

  for (const id of spoken) {
    const expected = tokens(texts[id]);
    const stamps = timecodes[id]?.timecodes?.[1]?.word_timestamps;
    assert.ok(Array.isArray(stamps), `${id} must have word-level timestamps`);
    assert.deepEqual(stamps.map(({ text }) => text), expected, `${id} must highlight every printed token in order`);
    const audioUrl = new URL(`content/i18n/en-GB/audio/${audios[id]}`, root);
    assert.ok(existsSync(audioUrl), `${id} audio must exist`);
    assert.ok(statSync(audioUrl).size >= 10_000, `${id} must not use the old silent placeholder clip`);

    let previousEnd = 0;
    for (const [index, stamp] of stamps.entries()) {
      assert.ok(Number.isFinite(stamp.start) && Number.isFinite(stamp.end), `${id} token ${index} timing must be finite`);
      assert.ok(stamp.end - stamp.start >= 0.099, `${id} token ${index} must remain visibly highlighted`);
      assert.ok(stamp.start >= previousEnd - 1e-6, `${id} token ${index} must not overlap the previous token`);
      previousEnd = stamp.end;
    }
    assert.ok(previousEnd <= duration(audios[id]) + 0.05, `${id} timestamps must fit its audio`);
    passageCount += 1;
    tokenCount += expected.length;
  }
}

const offline = read("assets/offline-data.js");
const payloadStart = offline.indexOf("  var INLINE = ") + "  var INLINE = ".length;
const payloadEnd = offline.indexOf(";\n  var BASE_DIR", payloadStart);
const inline = JSON.parse(offline.slice(payloadStart, payloadEnd));
assert.deepEqual(inline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes, "offline timestamps must match network-loaded timestamps");
assert.deepEqual(inline["./content/i18n/en-GB/texts.json"], texts, "offline text must match network-loaded text");
assert.deepEqual(inline["./content/i18n/en-GB/audios.json"], audios, "offline audio mappings must match network-loaded mappings");

const page9 = read("pg009_sec001.html");
assert.match(page9, /data-id="pg009_im002"[^>]*role="presentation"[^>]*aria-hidden="true"/, "duplicate question panel must be decorative");
assert.equal(audios.pg009_im002, undefined, "duplicate question panel must not have narration audio");
assert.ok(audios.pg009_im001, "the children-and-ball illustration must have narration audio");
assert.ok(texts.pg009_im001?.startsWith("Ten schoolchildren"), "the main illustration must have a useful description");
assert.match(page9, /\[\s*"pg009_im001",\s*"pg009_p046"[\s\S]*root\.insertBefore\(element, question\)/, "the illustration and labels must be narrated before the question");

const page10 = read("pg010_sec001.html");
for (const id of ["pg010_im001", "pg010_im002"]) {
  assert.match(page10, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate exercise panel must be decorative`);
  assert.equal(audios[id], undefined, `${id} duplicate exercise panel must not have narration audio`);
}

const page11 = read("pg011_sec001.html");
assert.match(page11, /data-id="pg011_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "page 11 duplicate exercise panel must be decorative");
assert.equal(audios.pg011_im001, undefined, "page 11 duplicate exercise panel must not have narration audio");
assert.equal(texts.pg011_p213, "630", "630 must be an independent table cell");
assert.equal(texts.pg011_p244, "631", "631 must be an independent table cell");
assert.match(page11, /data-id="pg011_p213"[\s\S]*?>630<\/span><\/p>\s*<p data-id="pg011_p244"[\s\S]*?>631<\/span><\/p>/, "630 and 631 must use separate overlay and narration elements");
assert.equal(texts.pg011_p230, "650", "650 must be an independent table cell");
assert.equal(texts.pg011_p245, "651", "651 must be an independent table cell");
assert.match(page11, /data-id="pg011_p230"[\s\S]*?>650<\/span><\/p>\s*<p data-id="pg011_p245"[\s\S]*?>651<\/span><\/p>/, "650 and 651 must use separate overlay and narration elements");

const hash = (filename) => createHash("sha256").update(readFileSync(new URL(`content/i18n/en-GB/audio/${filename}`, root))).digest("hex");
const oneSource = hash(audios.pg028_p008);
const threeSource = hash(audios.pg014_p014);
for (const [id, source] of [
  ["pg014_p004", oneSource], ["pg016_p012", oneSource], ["pg050_p022", oneSource],
  ["pg028_p011", threeSource], ["pg045_p013", threeSource], ["pg048_p015", threeSource]
]) assert.equal(hash(audios[id]), source, `${id} must use repaired audible narration`);
assert.equal(hash(audios.pg010_p166), hash(audios.pg013_p040), "both printed 360 entries must use the same repaired narration");
assert.ok(meanVolume(audios.pg010_p166) > -35, "360 must contain clearly audible speech, not a silent placeholder");
assert.deepEqual(timecodes.pg010_p166.timecodes[1].word_timestamps, [{ text: "360", start: 0.166, end: 1.798 }], "360 highlight must span its spoken narration");
assert.ok(duration(audios.pg010_p002) < 5, "page 10 instruction must not repeat the complete number table");
assert.deepEqual(timecodes.pg012_p009.timecodes[1].word_timestamps.map(({ text }) => text).slice(-2), ["730", "731"], "page 12 must narrate its final table cell");

for (const id of ["pg044_p017", "pg044_p030", "pg045_p003", "pg045_p040", "pg046_p003", "pg046_p017"]) {
  assert.equal(texts[id], "hundreds", `${id} must use the printed place-value word`);
}

assert.match(runtime, /audio\.currentTime/, "highlighting must follow the audio media clock");
assert.match(runtime, /requestAnimationFrame\(tick\)/, "word boundaries must be sampled on each media frame");
assert.match(runtime, /\[\+\\-−–×÷=<>\/\]/, "spoken arithmetic symbols must be highlight tokens");
assert.match(runtime, /session !== playSessionRef\.current/, "stale playback sessions must be ignored");
assert.match(runtime, /cancelAnimationFrame\(highlightFrameRef\.current\)/, "old highlight loops must be cancelled");
assert.match(runtime, /marker\.style\.width = `\$\{rect\.width\}px`/);
assert.match(runtime, /marker\.style\.height = `\$\{height\}px`/);
assert.match(runtime, /\^\\s\*\\d\+\[\.\)\]\?\\s\*\$.*segments\[0\]\.text/, "item numbers must stay beside their printed line");
assert.match(runtime, /Math\.max\(1\.9, segments\.length \* 0\.75\)/, "single-line fixed-layout boxes must not gain artificial breaks");
assert.match(runtime, /description\.length > 0 && !textNarration\.includes\(description\)/, "duplicate image narration must be suppressed");
assert.match(runtime, /normalizeNarrationComparison/, "duplicate-image comparison must ignore punctuation differences");
assert.match(runtime, /aria-hidden.*presentation/, "decorative images must be excluded from narration");

console.log(`pg009-pg050 read-aloud regression: ${passageCount} passages and ${tokenCount} printed tokens verified`);
