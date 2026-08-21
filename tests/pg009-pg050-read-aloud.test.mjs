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
  const domIds = [...markup.matchAll(new RegExp(`<[^>]+\\sdata-id="(pg${page}_[^"]+)"`, "g"))].map((match) => match[1]);
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

const page12 = read("pg012_sec001.html");
assert.match(page12, /data-id="pg012_im002"[^>]*role="presentation"[^>]*aria-hidden="true"/, "page 12 duplicate Exercise 9 panel must be decorative");
assert.equal(audios.pg012_im002, undefined, "page 12 duplicate Exercise 9 panel must not have narration audio");
assert.equal(texts.pg012_p029, "730", "730 must be an independent table cell");
assert.equal(texts.pg012_p030, "731", "731 must be an independent table cell");
assert.equal(audios.pg012_p030, "pg012_p030_adt_gpt4omini.mp3", "731 must use the Arithmetic ADT voice preset");
assert.deepEqual(timecodes.pg012_p030.timecodes[1].word_timestamps, [{ text: "731", start: 0, end: 1.94 }], "731 highlight must follow its measured speech timestamps");
assert.match(page12, /data-id="pg012_p029"[\s\S]*?>730<\/span><\/p>\s*<p data-id="pg012_p030"[\s\S]*?>731<\/span><\/p>/, "730 and 731 must use separate overlay and narration elements");

const page13 = read("pg013_sec001.html");
assert.equal(texts.pg013_p106, "930", "930 must be an independent table cell");
assert.equal(texts.pg013_p107, "931", "931 must be an independent table cell");
assert.equal(audios.pg013_p107, "pg013_p107_adt_gpt4omini.mp3", "931 must use the Arithmetic ADT voice preset");
assert.deepEqual(timecodes.pg013_p107.timecodes[1].word_timestamps, [{ text: "931", start: 0, end: 1.26 }], "931 highlight must follow its measured speech timestamp");
assert.match(page13, /data-id="pg013_p106"[\s\S]*?>930<\/span><\/p>\s*<p data-id="pg013_p107"[\s\S]*?>931<\/span><\/p>/, "930 and 931 must use separate overlay and narration elements");

const page14 = read("pg014_sec001.html");
assert.match(page14, /data-id="pg014_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "page 14 duplicate full-page exercise panel must be decorative");
assert.equal(audios.pg014_im001, undefined, "page 14 exercise content must not be narrated twice");
assert.match(page14, /"pg014_p004", "pg014_p005", "pg014_p009", "pg014_p010"[\s\S]*root\.insertBefore\(element, firstRightColumnItem\)/, "Exercise 11 must narrate the left column before the right column");
assert.equal(audios.pg014_p011, "pg014_p011_adt_clean.mp3", "item 15 must not begin with an unrelated word");
assert.equal(audios.pg014_p019, "pg014_p019_adt_clean.mp3", "item 4 must not contain a trailing unrelated word");
assert.equal(audios.pg014_p070, "pg014_p070_adt_clean.mp3", "Exercise 12 item 6 must not contain trailing unrelated words");
assert.deepEqual(timecodes.pg014_p011.timecodes[1].word_timestamps, [{ text: "15", start: 0, end: 0.82 }], "item 15 highlight must use measured clean-audio timing");
assert.deepEqual(timecodes.pg014_p019.timecodes[1].word_timestamps, [{ text: "4", start: 0, end: 0.64 }], "item 4 highlight must use measured clean-audio timing");
assert.match(page14, /data-id="pg014_p069"[\s\S]*?style="position:absolute;top:606px;left:72px;line-height:18px;width:394px;height:20px"/, "Exercise 12 item 5 must use a stable full-line overlay");
for (const id of ["pg014_p069", "pg014_p070", "pg014_p071"]) {
  const element = page14.match(new RegExp(`<p data-id="${id}"[\\s\\S]*?</p>`))?.[0] ?? "";
  assert.doesNotMatch(element, /text-align:center/, `${id} must not shift word coordinates by centring its overlay`);
}
assert.deepEqual(timecodes.pg014_p069.timecodes[1].word_timestamps, [
  { text: "5", start: 0, end: 0.88 },
  { text: "Three", start: 1.74, end: 1.84 },
  { text: "hundred", start: 1.84, end: 2 },
  { text: "and", start: 2, end: 2.34 },
  { text: "three", start: 2.34, end: 2.48 }
], "Exercise 12 item 5 highlight must follow measured spoken-word boundaries");

const page15 = read("pg015_sec001.html");
assert.match(page15, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 15 must not paint a second legacy highlight layer");
assert.match(page15, /data-id="pg015_p002"[\s\S]*?style="position:absolute;top:100px;left:95px;line-height:18px;width:408px;height:20px"/, "Exercise 12 item 9 must use a stable full-line overlay");
for (const id of ["pg015_p002", "pg015_p003", "pg015_p005", "pg015_p006"]) {
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must use clean ADT narration without unrelated words`);
}
assert.deepEqual(timecodes.pg015_p002.timecodes[1].word_timestamps, [
  { text: "9", start: 0, end: 1.08 },
  { text: "One", start: 1.9, end: 2.14 },
  { text: "hundred", start: 2.14, end: 2.42 },
  { text: "and", start: 2.42, end: 2.7 },
  { text: "nine", start: 2.7, end: 2.96 }
], "Exercise 12 item 9 highlight must follow measured clean-audio timing");

const page16 = read("pg016_sec001.html");
assert.match(page16, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 16 must not paint a second legacy highlight layer");
for (const id of ["pg016_im001", "pg016_im002", "pg016_im003"]) {
  assert.match(page16, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate text panel must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not repeat text already represented by word overlays`);
}
assert.match(page16, /\["pg016_p058", "pg016_p059", "pg016_p056"\][\s\S]*root\.insertBefore\(element, firstBodyHeading\)/, "page 16 must narrate the chapter heading before the body text");
assert.equal(audios.pg016_p045, "pg014_p019_adt_clean.mp3", "page 16 item 4 must not contain a trailing 'and'");
assert.deepEqual(timecodes.pg016_p045.timecodes[1].word_timestamps, [{ text: "4", start: 0, end: 0.64 }], "page 16 item 4 highlight must stop with the clean narration");

const page17 = read("pg017_sec001.html");
assert.match(page17, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 17 must not paint a second legacy highlight layer");
for (const id of ["pg017_im001", "pg017_im002", "pg017_im003", "pg017_im004"]) {
  assert.match(page17, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate panel must be decorative`);
}
for (const id of ["pg017_im001", "pg017_im002", "pg017_im003"]) {
  assert.equal(audios[id], undefined, `${id} must not repeat exercise text already represented by word overlays`);
}
assert.match(page17, /"pg017_p027", "pg017_p032", "pg017_p037", "pg017_p042", "pg017_p047"[\s\S]*"pg017_p029", "pg017_p030"[\s\S]*root\.insertBefore\(orderedItems, insertionPoint\)/, "Exercise 4 must narrate the left column before the right column");
for (const id of ["pg017_p020", "pg017_p021", "pg017_p022", "pg017_p023"]) {
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must not speak blank lines as unrelated words`);
}
assert.deepEqual(timecodes.pg017_p020.timecodes[1].word_timestamps, [
  { text: "2", start: 0, end: 0.62 },
  { text: "109", start: 1.18, end: 2.28 },
  { text: "110", start: 2.96, end: 3.86 },
  { text: "111", start: 4.58, end: 5.38 }
], "Exercise 3 item 2 must use measured clean-audio timing");

const page18 = read("pg018_sec001.html");
assert.match(page18, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 18 must not paint a second legacy highlight layer");
for (const id of ["pg018_im001", "pg018_im002", "pg018_im003"]) {
  assert.match(page18, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate panel must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not repeat content already represented by word overlays`);
}

const page19 = read("pg019_sec001.html");
assert.match(page19, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 19 must not paint a second legacy highlight layer");
for (const id of ["pg019_im001", "pg019_im002"]) {
  assert.match(page19, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate panel must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not repeat content already represented by word overlays`);
}
assert.match(page19, /"pg019_p004", "pg019_p005", "pg019_p008", "pg019_p009", "pg019_p012", "pg019_p013"[\s\S]*"pg019_p006", "pg019_p007"/, "Exercise 7 must narrate the left column before the right column");
assert.match(page19, /"pg019_p019", "pg019_p020", "pg019_p023", "pg019_p024"[\s\S]*"pg019_p021", "pg019_p022"/, "Exercise 8 must narrate items 1-5 before items 6-10");
assert.equal(texts.pg019_p015, "315, _____, 313", "Exercise 7 item 6 must end with the printed number 313");
assert.equal(audios.pg019_p015, "pg019_p015_clean.mp3", "Exercise 7 item 6 must use corrected local narration");
assert.deepEqual(timecodes.pg019_p015.timecodes[1].word_timestamps, [
  { text: "315", start: 0, end: 1.66 },
  { text: "313", start: 2.74, end: 3.54 }
], "Exercise 7 item 6 must highlight 315 and 313 at their spoken times");
for (const id of ["pg019_p007", "pg019_p009", "pg019_p011", "pg019_p013", "pg019_p028", "pg019_p030", "pg019_p036"]) {
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must use clean ADT narration without unrelated words`);
}
assert.deepEqual(timecodes.pg019_p007.timecodes[1].word_timestamps, [
  { text: "380", start: 0, end: 1.42 },
  { text: "378", start: 2.18, end: 3.62 }
], "Exercise 7 item 4 must keep each number highlighted for its complete spoken phrase");
assert.deepEqual(timecodes.pg019_p030.timecodes[1].word_timestamps, [
  { text: "179", start: 0, end: 2.3 },
  { text: "178", start: 3.84, end: 4.38 }
], "Exercise 8 item 8 must not highlight a stray leading word");
for (const id of ["pg019_p006", "pg019_p031"]) {
  assert.equal(audios[id], "pg014_p019_adt_clean.mp3", `${id} must say only 'four' without a trailing 'and'`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps, [
    { text: "4", start: 0, end: 0.64 }
  ], `${id} highlight must stop when the clean item number ends`);
}

const page20 = read("pg020_sec001.html");
assert.match(page20, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 20 must not paint a second legacy highlight layer");
for (const id of ["pg020_im005", "pg020_im006"]) {
  assert.match(page20, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate panel must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not repeat visible text and worked examples`);
}
assert.equal(texts.pg020_im002, "Four groups of ten pencils, representing four tens.", "the tens illustration must describe all four visible groups");
assert.equal(texts.pg020_im003, "Two pencils, representing two ones.", "the ones illustration must describe both visible pencils");
assert.equal(audios.pg020_im002, "pg020_im002_adt_clean.mp3", "the corrected tens description must use matching narration");
assert.equal(audios.pg020_im003, "pg020_im003_adt_clean.mp3", "the corrected ones description must use matching narration");
assert.deepEqual(timecodes.pg020_im002.timecodes[1].word_timestamps.map(({ text }) => text), [
  "Four", "groups", "of", "ten", "pencils", "representing", "four", "tens"
], "the tens description timing must follow every spoken word in order");
assert.deepEqual(timecodes.pg020_im003.timecodes[1].word_timestamps.map(({ text }) => text), [
  "Two", "pencils", "representing", "two", "ones"
], "the ones description timing must follow every spoken word in order");
assert.match(page20, /"pg020_p017", "pg020_p018", "pg020_p016"[\s\S]*"pg020_p001", "pg020_p002"/, "page 20 must narrate the chapter title before its body");
assert.equal(audios.pg020_p015, undefined, "the old combined label overlay must not create a wide group highlight");
for (const [id, word, left] of [
  ["pg020_p021", "hundreds", "193px"],
  ["pg020_p022", "tens", "272px"],
  ["pg020_p023", "ones", "318px"]
]) {
  assert.equal(texts[id], word, `${id} must contain only its visible label`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text), [word], `${id} must highlight only its spoken word`);
  assert.match(page20, new RegExp(`data-id="${id}"[\\s\\S]*?left:${left}`), `${id} must be positioned directly over its printed label`);
}
assert.match(page20, /"pg020_p012", "pg020_p013", "pg020_p021", "pg020_p022", "pg020_p023", "pg020_im004", "pg020_p014"/, "Example 2 must narrate its labels and counting frame before the answer");

const page21 = read("pg021_sec001.html");
assert.match(page21, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 21 must not paint a second legacy highlight layer");
for (const id of ["pg021_im007", "pg021_im008"]) {
  assert.match(page21, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate example panel must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not repeat the complete worked example`);
}
assert.match(page21, /data-id="pg021_im009"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the page-number crop must be decorative");
assert.equal(texts.pg021_p002, "Count the following pencils. Write their total in words.", "Example 3 instruction must be one uninterrupted passage");
assert.equal(audios.pg021_p002, "pg021_p012.mp3", "Example 3 must use the complete clean instruction narration");
assert.equal(audios.pg021_p003, undefined, "the old second instruction fragment must not cause a pause or repeat");
assert.deepEqual(timecodes.pg021_p002.timecodes[1].word_timestamps.map(({ text }) => text), ["Count", "the", "following", "pencils", "Write", "their", "total", "in", "words"], "Example 3 instruction must highlight every word continuously");
assert.match(page21, /"pg021_p001", "pg021_p002", "pg021_p004", "pg021_p005", "pg021_p006"[\s\S]*"pg021_im002", "pg021_im003", "pg021_im001"[\s\S]*"pg021_p007", "pg021_p008", "pg021_p009", "pg021_p010"/, "Example 3 must narrate its content and images in visual order");
assert.match(page21, /"pg021_p011", "pg021_p012", "pg021_p013", "pg021_p014", "pg021_p015"[\s\S]*"pg021_im004", "pg021_im005", "pg021_im006"[\s\S]*"pg021_p016", "pg021_p017", "pg021_p018", "pg021_p019"/, "Example 4 must narrate its content and images in visual order");
assert.match(page21, /data-id="pg021_p010"[\s\S]*?left:196px;line-height:18px;width:190px;height:20px/, "Example 3 answer overlay must begin at the printed sentence, not the table's left edge");
assert.match(page21, /data-id="pg021_p013"[\s\S]*?left:115px;line-height:18px;width:72px;height:20px/, "Example 4 Hundreds overlay must fit its printed word");
assert.match(page21, /data-id="pg021_p019"[\s\S]*?left:163px;line-height:19px;width:234px;height:20px/, "Example 4 answer overlay must match its centred printed sentence");

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
assert.deepEqual(timecodes.pg012_p009.timecodes[1].word_timestamps.map(({ text }) => text).slice(-2), ["728", "729"], "page 12 retained row audio must end before its separate 730 and 731 cells");

for (const id of ["pg044_p017", "pg044_p030", "pg045_p003", "pg045_p040", "pg046_p003", "pg046_p017"]) {
  assert.equal(texts[id], "hundreds", `${id} must use the printed place-value word`);
}

assert.match(runtime, /audio\.currentTime/, "highlighting must follow the audio media clock");
assert.match(runtime, /requestAnimationFrame\(tick\)/, "word boundaries must be sampled on each media frame");
assert.match(runtime, /document\.createRange\(\)/, "highlight width must be measured from the current word text range");
assert.match(runtime, /range\.selectNodeContents\(word\)/, "highlight measurement must exclude the surrounding paragraph box");
assert.match(runtime, /rect\.top \+ \(rect\.height - height\) \/ 2/, "highlight must be vertically centred on the current word");
assert.match(runtime, /background:rgba\(253,224,71,\.3\)/, "highlight must use a soft semi-transparent yellow");
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
