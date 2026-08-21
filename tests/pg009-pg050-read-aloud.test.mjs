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
for (let pageNumber = 9; pageNumber <= 61; pageNumber += 1) {
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

const page22 = read("pg022_sec001.html");
assert.match(page22, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 22 must not paint a second legacy highlight layer");
assert.match(page22, /data-id="pg022_im010"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the duplicate Exercise 1 panel must be decorative");
assert.equal(audios.pg022_im010, undefined, "the complete Exercise 1 panel must not repeat its text and images");
for (const id of ["pg022_im007", "pg022_im008"]) {
  assert.match(page22, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} repeated bundle crop must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not narrate one visual group as three separate images`);
}
assert.equal(texts.pg022_im006, "Three bundles of one hundred pencils.", "Example 5 must describe the complete hundreds group once");
assert.equal(audios.pg022_im006, "pg022_im003.mp3", "Example 5 must use matching narration for three bundles");
assert.match(page22, /data-id="pg022_p006"[\s\S]*?left:86px;line-height:19px;width:140px;height:20px/, "Three hundreds overlay must fit its printed phrase");
assert.match(page22, /data-id="pg022_p009"[\s\S]*?left:147px;line-height:19px;width:254px;height:20px/, "Example 5 answer overlay must match its centred printed sentence");
assert.match(page22, /"pg022_p001", "pg022_p002", "pg022_p003", "pg022_p004", "pg022_p005"[\s\S]*"pg022_im006", "pg022_im001", "pg022_im002"[\s\S]*"pg022_p006", "pg022_p007", "pg022_p008", "pg022_p009"/, "Example 5 must narrate text and images in visual order");
assert.match(page22, /"pg022_p010", "pg022_p011", "pg022_p013", "pg022_p014", "pg022_p015", "pg022_p016"[\s\S]*"pg022_im003", "pg022_im004", "pg022_im005"/, "Exercise 1 must narrate its prompt and images in visual order");

const page23 = read("pg023_sec001.html");
assert.match(page23, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 23 must not paint a second legacy highlight layer");
for (const id of ["pg023_im001", "pg023_im018"]) {
  assert.equal(texts[id], "Three single pencils, representing 3 ones.", `${id} must describe all three visible ones`);
  assert.equal(audios[id], "pg023_im001_adt_clean.mp3", `${id} must use the matching ADT description`);
}
assert.match(page23, /data-id="pg023_p010"[\s\S]*?left:154px;line-height:18px;width:75px;height:20px/, "item 3 Hundreds overlay must fit its printed word");
assert.match(page23, /"pg023_p001", "pg023_p002", "pg023_p003", "pg023_p004"[\s\S]*"pg023_im002", "pg023_im003", "pg023_im001"/, "item 2 must narrate its headers and images in visual order");
assert.match(page23, /"pg023_p009", "pg023_p010", "pg023_p011", "pg023_p012"[\s\S]*"pg023_im004", "pg023_im005", "pg023_im018"/, "item 3 must narrate its headers and images in visual order");

const page24 = read("pg024_sec001.html");
assert.match(page24, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 24 must not paint a second legacy highlight layer");
for (const id of ["pg024_im004", "pg024_im005"]) {
  assert.match(page24, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not duplicate visible narration`);
}
assert.equal(texts.pg024_p002, "Count the cups. Write their total in numerals in the blank space.", "the instruction must be one uninterrupted passage");
assert.equal(audios.pg024_p002, "pg024_p002_adt_clean.mp3", "the merged instruction must use clean ADT narration");
assert.equal(audios.pg024_p003, undefined, "the old instruction fragment must not create a pause or repetition");
assert.deepEqual(timecodes.pg024_p002.timecodes[1].word_timestamps.map(({ text }) => text), ["Count", "the", "cups", "Write", "their", "total", "in", "numerals", "in", "the", "blank", "space"], "the merged instruction must highlight every spoken word in order");
for (const [id, description] of Object.entries({
  pg024_im001: "Row 1 shows three cups in the hundreds column, two cups in the tens column, and five cups in the ones column.",
  pg024_im002: "Row 2 shows two cups in the hundreds column, three cups in the tens column, and four cups in the ones column.",
  pg024_im003: "Row 3 shows four cups in the hundreds column, three cups in the tens column, and no cups in the ones column."
})) {
  assert.equal(texts[id], description, `${id} must accurately describe its complete row`);
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must use matching ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text), description.match(/[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*/gu), `${id} timestamps must cover every description word`);
}
assert.match(page24, /data-id="pg024_p004"[\s\S]*?left:81px;line-height:18px;width:20px;height:20px/, "item 1 highlight overlay must fit only the printed item number");
assert.match(page24, /"pg024_p001", "pg024_p002"[\s\S]*"pg024_p004", "pg024_p005", "pg024_p006", "pg024_p007", "pg024_im001"[\s\S]*"pg024_p011", "pg024_p012", "pg024_p013", "pg024_p014", "pg024_im002"[\s\S]*"pg024_p018", "pg024_p019", "pg024_p020", "pg024_p021", "pg024_im003"/, "page 24 must narrate each row and its description in visual order");

const page25 = read("pg025_sec001.html");
assert.match(page25, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 25 must not paint a second legacy highlight layer");
for (const id of ["pg025_im007", "pg025_im008", "pg025_im009", "pg025_im010", "pg025_im011", "pg025_im012", "pg025_im013", "pg025_im014"]) {
  assert.match(page25, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate crop must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not repeat visible headings or the page number`);
}
assert.equal(audios.pg025_p010, "pg014_p019_adt_clean.mp3", "item 4 must say only four without a trailing and");
assert.deepEqual(timecodes.pg025_p010.timecodes[1].word_timestamps, [{ text: "4", start: 0, end: 0.64 }], "item 4 highlighting must cover only its clean narration");
for (const [id, description] of Object.entries({
  pg025_im001: "The place value frame shows two beads in the hundreds column, two beads in the tens column, and five beads in the ones column.",
  pg025_im002: "The place value frame shows two beads in the hundreds column, five beads in the tens column, and four beads in the ones column.",
  pg025_im003: "The place value frame shows five beads in the hundreds column, three beads in the tens column, and four beads in the ones column.",
  pg025_im004: "The place value frame shows nine beads in the hundreds column, nine beads in the tens column, and nine beads in the ones column.",
  pg025_im005: "The place value frame shows three beads in the hundreds column, no beads in the tens column, and four beads in the ones column.",
  pg025_im006: "The place value frame shows one bead in the hundreds column, no beads in the tens column, and nine beads in the ones column."
})) {
  assert.equal(texts[id], description, `${id} must accurately describe its place-value frame`);
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must use matching ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text), description.match(/[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*/gu), `${id} timestamps must cover every description word`);
}
assert.match(page25, /data-id="pg025_p004"[\s\S]*?left:95px;line-height:18px;width:20px;height:20px/, "item 1 highlight overlay must fit only the printed item number");
for (const [id, left, top] of [["pg025_p016", 131, 147], ["pg025_p017", 327, 145], ["pg025_p018", 131, 312], ["pg025_p020", 327, 313], ["pg025_p019", 131, 487], ["pg025_p021", 327, 487]]) {
  assert.match(page25, new RegExp(`data-id="${id}"[\\s\\S]*?top:${top}px;left:${left}px;line-height:16px;width:124px;height:18px`), `${id} must align with exactly one printed column header`);
}
assert.match(page25, /"pg025_p001", "pg025_p002"[\s\S]*"pg025_p004", "pg025_p016", "pg025_im001"[\s\S]*"pg025_p006", "pg025_p017", "pg025_im002"[\s\S]*"pg025_p008", "pg025_p018", "pg025_im003"[\s\S]*"pg025_p010", "pg025_p020", "pg025_im004"[\s\S]*"pg025_p012", "pg025_p019", "pg025_im005"[\s\S]*"pg025_p014", "pg025_p021", "pg025_im006"/, "page 25 must narrate each item once in visual order");

const page26 = read("pg026_sec001.html");
assert.match(page26, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 26 must not paint a second legacy highlight layer");
for (const id of ["pg026_im006", "pg026_im008"]) {
  assert.match(page26, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate panel must be decorative`);
  assert.equal(audios[id], undefined, `${id} must not repeat the chapter or exercise narration`);
}
for (const [id, text, filename] of [
  ["pg026_p006", "Write the place value of each digit in 324.", "pg026_p006_adt_clean.mp3"],
  ["pg026_p009", "Write the place value of each digit in 349.", "pg026_p009_adt_clean.mp3"],
  ["pg026_p011", "349 = 3 hundreds 4 tens 9 ones", "pg026_p011_adt_clean.mp3"]
]) {
  assert.equal(texts[id], text, `${id} must be a complete uninterrupted passage`);
  assert.equal(audios[id], filename, `${id} must use clean ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), text.match(/[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*|[+\-−–×÷=<>/]/gu), `${id} timestamps must cover every printed token`);
}
for (const id of ["pg026_p007", "pg026_p010", "pg026_p012"]) assert.equal(audios[id], undefined, `${id} obsolete fragment must not create a pause or repetition`);
for (const [id, number] of Object.entries({ pg026_im002: "224", pg026_im003: "185", pg026_im004: "402", pg026_im005: "306" })) {
  assert.equal(texts[id], number, `${id} must read only the printed exercise number`);
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must use number-only page 26 narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), [number], `${id} must highlight only its printed number`);
}
assert.equal(audios.pg026_p018, "pg014_p019_adt_clean.mp3", "exercise item 4 must say only four without a trailing and");
assert.deepEqual(timecodes.pg026_p018.timecodes[1].word_timestamps, [{ text: "4", start: 0, end: 0.64 }], "exercise item 4 must highlight only its clean narration");
assert.match(page26, /data-id="pg026_p006"[\s\S]*?top:324px;left:77px;line-height:18px;width:184px;height:41px/, "Example 1 instruction must highlight in the left column");
assert.match(page26, /data-id="pg026_p009"[\s\S]*?top:324px;left:283px;line-height:18px;width:184px;height:41px/, "Example 2 instruction must highlight in the right column");
assert.match(page26, /"pg026_p021", "pg026_p022", "pg026_p019", "pg026_p001", "pg026_p002"[\s\S]*"pg026_p005", "pg026_p006", "pg026_im001"[\s\S]*"pg026_p008", "pg026_p009", "pg026_p011"[\s\S]*"pg026_p013", "pg026_p014"[\s\S]*"pg026_p015", "pg026_im002", "pg026_p016", "pg026_im003"[\s\S]*"pg026_p017", "pg026_im004", "pg026_p018", "pg026_im005"/, "page 26 must narrate the chapter, examples, and exercise in visual order");

const page27 = read("pg027_sec001.html");
assert.match(page27, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 27 must not paint a second legacy highlight layer");
assert.match(page27, /data-id="pg027_im008"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the whole-exercise duplicate image must be decorative");
assert.equal(texts.pg027_im008, "", "the duplicate exercise image must not retain spoken description text");
assert.equal(audios.pg027_im008, undefined, "the duplicate exercise image must not repeat all visible lines");
for (const [id, description] of Object.entries({
  pg027_im001: "247",
  pg027_im002: "87",
  pg027_im003: "93",
  pg027_im004: "210",
  pg027_im005: "179",
  pg027_im006: "500"
})) {
  assert.equal(texts[id], description, `${id} must read only the printed question number`);
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must use its corrected page 27 narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(description), `${id} timestamps must cover its complete description`);
}
assert.equal(audios.pg027_p016, "pg014_p019_adt_clean.mp3", "Exercise 2 item 4 must say only four without a trailing and");
assert.deepEqual(timecodes.pg027_p016.timecodes[1].word_timestamps, [{ text: "4", start: 0, end: 0.64 }], "Exercise 2 item 4 must highlight only the clean word four");
for (const id of [
  "pg027_p011", "pg027_p013", "pg027_p015", "pg027_p017", "pg027_p019",
  "pg027_p021", "pg027_p023", "pg027_p025", "pg027_p027", "pg027_p028"
]) {
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must use clean ADT narration without stray words from blank lines`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts[id]), `${id} must highlight each printed token once and in order`);
}
assert.match(page27, /data-id="pg027_p007"[\s\S]*?top:341px;left:98px;line-height:17px;width:84px;height:19px/, "Exercise 2 heading highlight must fit only its printed words");
assert.match(page27, /data-id="pg027_p019"[\s\S]*?top:523px;left:152px;line-height:18px;width:324px;height:20px/, "item 5 overlay must not overlap item 6");
assert.match(page27, /data-id="pg027_p021"[\s\S]*?top:547px;left:152px;line-height:18px;width:324px;height:20px;text-align:right/, "item 6 overlay must cover its complete printed line");
assert.match(page27, /data-id="pg027_p028"[\s\S]*?top:645px;left:116px;line-height:18px;width:360px;height:20px/, "item 10 overlay must cover its complete printed line");
assert.match(page27, /"pg027_p010", "pg027_p011", "pg027_p012", "pg027_p013"[\s\S]*"pg027_p014", "pg027_p015", "pg027_p016", "pg027_p017"[\s\S]*"pg027_p026", "pg027_p027", "pg027_p028"/, "Exercise 2 must narrate every item once in visual order");

const page28 = read("pg028_sec001.html");
assert.match(page28, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 28 must not paint a second legacy highlight layer");
assert.match(page28, /data-id="pg028_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the Exercise 3 panel image must be decorative because its content is narrated by the rows");
assert.equal(texts.pg028_im001, "", "the Exercise 3 panel image must not duplicate the row narration");
assert.equal(audios.pg028_im001, undefined, "the Exercise 3 panel image must not repeat the exercise");
assert.equal(texts.pg028_im002, "In 478, 4 is in the hundreds place, 7 is in the tens place, and 8 is in the ones place.", "Example 1 must clearly explain each digit's place");
assert.equal(audios.pg028_im002, "pg028_im002_adt_clean.mp3", "Example 1 must use its clear place-value narration");
assert.deepEqual(timecodes.pg028_im002.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg028_im002), "Example 1 must highlight its description in spoken order");
assert.equal(texts.pg028_p002, "Write the numbers which represent the following place values:", "the Exercise 3 instruction must remain one uninterrupted passage");
assert.equal(audios.pg028_p002, "pg028_p002_adt_clean.mp3", "the combined instruction must use matching clean narration");
assert.deepEqual(timecodes.pg028_p002.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg028_p002), "the combined instruction must highlight every printed word in order");
assert.equal(texts.pg028_p003, "", "the obsolete second instruction fragment must be empty");
assert.equal(audios.pg028_p003, undefined, "the obsolete second instruction fragment must not create a pause or repetition");
assert.match(page28, /data-id="pg028_p002"[\s\S]*?top:102px;left:81px;line-height:17px;width:388px;height:40px/, "the combined instruction overlay must cover both printed lines");
const page28Rows = {
  pg028_p004: "1. 2 hundreds 0 tens 1 ones =",
  pg028_p010: "2. 3 hundreds 3 tens 4 ones =",
  pg028_p016: "3. 0 hundreds 6 tens 9 ones =",
  pg028_p022: "4. 0 hundreds 0 tens 5 ones =",
  pg028_p028: "5. 4 hundreds 0 tens 0 ones =",
  pg028_p034: "6. 1 hundreds 2 tens 3 ones =",
  pg028_p040: "7. 2 hundreds 5 tens 6 ones =",
  pg028_p046: "8. 4 hundreds 1 tens 0 ones =",
  pg028_p052: "9. 3 hundreds 0 tens 8 ones =",
  pg028_p058: "10. 2 hundreds 4 tens 1 ones ="
};
for (const [id, text] of Object.entries(page28Rows)) {
  assert.equal(texts[id], text, `${id} must narrate its complete row as one passage`);
  assert.equal(audios[id], `${id}_adt_row.mp3`, `${id} must use one complete row recording`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(text), `${id} must highlight its complete row in order`);
}
for (const number of [5,6,7,8,9,11,12,13,14,15,17,18,19,20,21,23,24,25,26,27,29,30,31,32,33,35,36,37,38,39,41,42,43,44,45,47,48,49,50,51,53,54,55,56,57,59,60,61,62,71,72,73,74]) {
  const id = `pg028_p${String(number).padStart(3, "0")}`;
  assert.equal(texts[id], "", `${id} obsolete fragment must not be narrated separately`);
  assert.equal(audios[id], undefined, `${id} obsolete fragment must not interrupt a complete row`);
}
assert.match(page28, /"pg028_p066", "pg028_p067",[\s\S]*"pg028_im002",[\s\S]*"pg028_p068", "pg028_p069", "pg028_p070"/, "Example 1 must narrate its place-value diagram before the explanation beneath it");

const page29 = read("pg029_sec001.html");
assert.match(page29, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 29 must use only the exact runtime word highlight");
assert.equal(texts.pg029_im001, "In 395, 3 is in the hundreds place, 9 is in the tens place, and 5 is in the ones place.", "Example 2 must explain 395 from hundreds to ones");
assert.equal(audios.pg029_im001, "pg029_im001_adt_clean.mp3", "Example 2 must use clear place-value narration");
assert.deepEqual(timecodes.pg029_im001.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg029_im001), "Example 2 description must highlight in spoken order");
const page29Rows = {
  pg029_p009: "1. 3 hundreds 1 tens 2 ones",
  pg029_p010: "2. 1 hundreds 0 tens 8 ones",
  pg029_p011: "3. 4 hundreds 2 tens 5 ones",
  pg029_p012: "4. 3 tens 5 ones",
  pg029_p013: "5. 2 hundreds 1 tens 5 ones",
  pg029_p014: "6. 4 hundreds 0 tens 3 ones"
};
for (const [id, text] of Object.entries(page29Rows)) {
  assert.equal(texts[id], text, `${id} must narrate its complete diagram as one passage`);
  assert.equal(audios[id], `${id}_adt_row.mp3`, `${id} must use one complete place-value recording`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(text), `${id} must highlight the question number and place values in spoken order`);
}
for (const number of [2,3,4,5,6,7]) {
  const id = `pg029_im${String(number).padStart(3, "0")}`;
  assert.equal(texts[id], "", `${id} must not duplicate its combined exercise narration`);
  assert.equal(audios[id], undefined, `${id} must be decorative after its words move to the question overlay`);
}
assert.match(page29, /\{id:"pg029_p009", item:"1\.", h:"3", t:"1", o:"2", left:105, top:396\}/, "question 1 highlight segments must align with its printed diagram");
assert.match(page29, /\{id:"pg029_p012", item:"4\.", h:null, t:"3", o:"5", left:297, top:489\}/, "question 4 must omit a nonexistent hundreds place");

const page30 = read("pg030_sec001.html");
assert.match(page30, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 30 must use only the exact runtime word highlight");
const page30Diagrams = {
  pg030_p001: "7. 5 hundreds 0 tens 0 ones",
  pg030_p002: "8. 6 tens 4 ones",
  pg030_p003: "9. 6 ones",
  pg030_p004: "10. 6 tens 1 ones",
  pg030_p005: "11. 1 hundreds 3 tens 2 ones",
  pg030_p006: "12. 3 hundreds 8 tens 7 ones",
  pg030_p007: "13. 2 hundreds 9 tens 4 ones",
  pg030_p008: "14. 3 hundreds 7 tens 1 ones"
};
for (const [id, text] of Object.entries(page30Diagrams)) {
  assert.equal(texts[id], text, `${id} must narrate its complete place-value diagram`);
  assert.equal(audios[id], `${id}_adt_row.mp3`, `${id} must use one complete diagram recording`);
  const stamps = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(stamps.map(({ text: word }) => word), tokens(text), `${id} must highlight its diagram from the question number through ones`);
  assert.ok(stamps[1].start - stamps[0].end >= 0.35, `${id} question number must not run into its first place value`);
}
const page30Items = {
  pg030_p012: "1. 201", pg030_p016: "2. 700", pg030_p020: "3. 333", pg030_p024: "4. 29", pg030_p028: "5. 218",
  pg030_p014: "6. 480", pg030_p018: "7. 11", pg030_p022: "8. 88", pg030_p026: "9. 999", pg030_p030: "10. 765"
};
for (const [id, text] of Object.entries(page30Items)) {
  assert.equal(texts[id], text, `${id} must keep its question number and value in one passage`);
  assert.equal(audios[id], `${id}_adt_item.mp3`, `${id} must use one complete item recording`);
  const stamps = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(stamps.map(({ text: word }) => word), tokens(text), `${id} must highlight its number and value in order`);
  assert.ok(stamps[1].start - stamps[0].end >= 0.35, `${id} question number must not join its printed value`);
}
for (const id of ["pg030_im001","pg030_im002","pg030_im003","pg030_im004","pg030_im005","pg030_im006","pg030_im007","pg030_im008","pg030_im009","pg030_im010","pg030_p013","pg030_p015","pg030_p017","pg030_p019","pg030_p021","pg030_p023","pg030_p025","pg030_p027","pg030_p029","pg030_p031"]) {
  assert.equal(texts[id], "", `${id} obsolete duplicate must not be narrated`);
  assert.equal(audios[id], undefined, `${id} obsolete duplicate must not interrupt a complete item`);
}
assert.match(page30, /\{id:"pg030_p003",item:"9\.",h:null,t:null,o:"6"/, "question 9 must narrate only its ones place");
assert.match(page30, /"pg030_p012","pg030_p016","pg030_p020","pg030_p024","pg030_p028",[\s\S]*"pg030_p014","pg030_p018","pg030_p022","pg030_p026","pg030_p030"/, "Exercise 5 must read items 1 through 10 in numerical order");

const page31 = read("pg031_sec001.html");
assert.match(page31, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 31 must use only the exact runtime word highlight");
assert.equal(texts.pg031_p002, "Write in numerals the numbers represented by the abacus. Question 1 is an example.", "page 31 instruction must be one uninterrupted passage");
assert.equal(audios.pg031_p002, "pg031_p002_adt_clean.mp3", "page 31 instruction must use its clean narration");
assert.deepEqual(timecodes.pg031_p002.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg031_p002), "page 31 instruction must highlight every spoken word in order");
const page31Frames = {
  pg031_im001: "An abacus with 0 hundreds, 2 tens, and 5 ones.",
  pg031_im002: "An abacus with 2 hundreds, 2 tens, and 5 ones.",
  pg031_im003: "An abacus with 0 hundreds, 3 tens, and 3 ones.",
  pg031_im004: "An abacus with 4 hundreds, 0 tens, and 4 ones.",
  pg031_im005: "An abacus with 1 hundred, 3 tens, and 3 ones.",
  pg031_im006: "An abacus with 3 hundreds, 7 tens, and 5 ones."
};
for (const [id, description] of Object.entries(page31Frames)) {
  assert.equal(texts[id], description, `${id} must accurately describe the visible abacus`);
  assert.equal(audios[id], `${id}_adt_clean.mp3`, `${id} must use its matching clean narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(description), `${id} must highlight every description word in spoken order`);
}
for (const [id, number] of Object.entries({ pg031_p004: "1", pg031_p006: "2", pg031_p008: "3", pg031_p010: "4", pg031_p012: "5", pg031_p014: "6" })) {
  assert.equal(audios[id], `${id}_adt_number.mp3`, `${id} must use a clean standalone item number`);
  const stamps = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(stamps.map(({ text: word }) => word), [number], `${id} must highlight only its printed item number`);
  assert.ok(duration(audios[id]) - stamps.at(-1).end >= 0.5, `${id} must pause before its abacus description begins`);
}
for (const id of ["pg031_p004", "pg031_p006"]) {
  assert.ok(meanVolume(audios[id]) > -35, `${id} must contain clearly audible speech`);
  assert.ok(timecodes[id].timecodes[1].word_timestamps[0].start >= 0.3, `${id} highlight must wait for the spoken word after its leading pause`);
}
for (const id of ["pg031_im007", "pg031_im011", "pg031_p003", "pg031_p016", "pg031_p017", "pg031_p018", "pg031_p019", "pg031_p020", "pg031_p021"]) {
  assert.equal(texts[id], "", `${id} duplicate narration must be empty`);
  assert.equal(audios[id], undefined, `${id} duplicate narration must not play`);
}
for (const id of ["pg031_im007", "pg031_im011"]) assert.match(page31, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} duplicate image must be decorative`);
assert.match(page31, /"pg031_p001","pg031_p002",[\s\S]*"pg031_p004","pg031_im001","pg031_p005",[\s\S]*"pg031_p006","pg031_im002",[\s\S]*"pg031_p008","pg031_im003",[\s\S]*"pg031_p010","pg031_im004",[\s\S]*"pg031_p012","pg031_im005",[\s\S]*"pg031_p014","pg031_im006"/, "page 31 must narrate each item and abacus once in visual order");

const page32 = read("pg032_sec001.html");
assert.match(page32, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 32 must use only the exact runtime word highlight");
for (const id of ["pg032_im002", "pg032_im003"]) {
  assert.equal(texts[id], "", `${id} duplicate panel description must be empty`);
  assert.equal(audios[id], undefined, `${id} duplicate panel description must not repeat visible text`);
  assert.match(page32, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
for (const [id, text, file] of [
  ["pg032_p002", "A number can be written in expanded form using the total value of its digits.", "pg032_p002_adt_clean.mp3"],
  ["pg032_p010", "Write 109 in expanded form.", "pg032_p010_adt_clean.mp3"]
]) {
  assert.equal(texts[id], text, `${id} must be one uninterrupted passage`);
  assert.equal(audios[id], file, `${id} must use its clean narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(text), `${id} must highlight every spoken token in order`);
}
assert.equal(audios.pg032_p007, "pg032_p007_adt_clean.mp3", "Example 1 Answer label must use clean narration without a trailing stray word");
assert.deepEqual(timecodes.pg032_p007.timecodes[1].word_timestamps.map(({ text: word }) => word), ["Answer"], "Example 1 Answer label must highlight only Answer");
assert.ok(meanVolume(audios.pg032_p007) > -35, "Example 1 Answer label must be clearly audible");
const page32Items = {
  pg032_p016: "1. 420 =", pg032_p019: "2. 46 =", pg032_p022: "3. 8 =", pg032_p025: "4. 302 =", pg032_p028: "5. 172 =",
  pg032_p017: "6. 93 =", pg032_p020: "7. 214 =", pg032_p023: "8. 163 =", pg032_p026: "9. 57 =", pg032_p029: "10. 291 ="
};
for (const [id, text] of Object.entries(page32Items)) {
  assert.equal(texts[id], text, `${id} must contain one complete exercise item`);
  assert.equal(audios[id], `${id}_adt_item.mp3`, `${id} must use one complete item recording`);
  const stamps = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(stamps.map(({ text: word }) => word), tokens(text), `${id} must highlight its item number, value, and equals sign in order`);
  assert.ok(stamps[1].start - stamps[0].end >= 0.4, `${id} item number must not run into its value`);
  assert.ok(meanVolume(audios[id]) > -35, `${id} must contain clearly audible speech`);
}
for (const id of ["pg032_p003", "pg032_p011", "pg032_p018", "pg032_p021", "pg032_p024", "pg032_p027"]) {
  assert.equal(texts[id], "", `${id} obsolete fragment must be empty`);
  assert.equal(audios[id], undefined, `${id} obsolete fragment must not interrupt narration`);
}
assert.match(page32, /answerTwo\.setAttribute\("style", "position:absolute;top:227px;left:286px/, "Example 2 answer highlight must stay in the right column");
assert.match(page32, /"pg032_p016","pg032_p019","pg032_p022","pg032_p025","pg032_p028",[\s\S]*"pg032_p017","pg032_p020","pg032_p023","pg032_p026","pg032_p029"/, "Exercise 7 must read items 1 through 10 in numerical order");

const page33 = read("pg033_sec001.html");
assert.match(page33, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 33 must use only the exact runtime word highlight");
for (const id of ["pg033_im002", "pg033_im003"]) {
  assert.equal(texts[id], "", `${id} duplicate panel description must be empty`);
  assert.equal(audios[id], undefined, `${id} duplicate panel description must not repeat visible text`);
  assert.equal(timecodes[id], undefined, `${id} duplicate panel description must not retain timing data`);
  assert.match(page33, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
const page33Items = {
  pg033_p003: "1. 200 + 30 + 9 =", pg033_p005: "2. 100 + 20 + 7 =", pg033_p007: "3. 300 + 50 + 2 =",
  pg033_p009: "4. 400 + 80 + 6 =", pg033_p011: "5. 200 + 70 + 1 =", pg033_p004: "6. 100 + 40 + 3 =",
  pg033_p006: "7. 400 + 60 + 5 =", pg033_p008: "8. 300 + 10 + 8 =", pg033_p010: "9. 200 + 90 + 4 =",
  pg033_p022: "10. 300 + 30 + 3 ="
};
for (const [id, text] of Object.entries(page33Items)) {
  assert.equal(texts[id], text, `${id} must contain one complete exercise item`);
  assert.equal(audios[id], `${id}_adt_item.mp3`, `${id} must use one complete item recording`);
  const stamps = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(stamps.map(({ text: word }) => word), tokens(text), `${id} must highlight its item number and expression in order`);
  assert.ok(stamps[1].start - stamps[0].end >= 0.4, `${id} item number must not run into its expression`);
  assert.ok(meanVolume(audios[id]) > -35, `${id} must contain clearly audible speech`);
}
assert.equal(texts.pg033_p012, "Activity 1", "the activity heading must have a natural space");
assert.equal(audios.pg033_p012, "pg033_p012_adt_clean.mp3", "the activity heading must use clean narration");
const page33ImageDescription = "Manka stands with Asha, Jane, and Hamisi beside an open box of exercise books. The two girls hold stacks of books, the boy reaches into the box, and Manka holds out a book.";
assert.equal(texts.pg033_im001, page33ImageDescription, "the story illustration must have a specific useful description");
assert.equal(audios.pg033_im001, "pg033_im001_adt_clean.mp3", "the story illustration must have clean narration");
assert.deepEqual(timecodes.pg033_im001.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(page33ImageDescription), "the illustration description must highlight every spoken word");
assert.match(page33, /"pg033_p001","pg033_p002","pg033_p003","pg033_p005","pg033_p007","pg033_p009","pg033_p011",[\s\S]*"pg033_p004","pg033_p006","pg033_p008","pg033_p010","pg033_p022",[\s\S]*"pg033_p012","pg033_p013","pg033_p015","pg033_p018","pg033_im001"/, "page 33 must narrate the exercise and story once in visual reading order");

const page34 = read("pg034_sec001.html");
assert.match(page34, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 34 must use only the exact runtime word highlight");
assert.equal(texts.pg034_im002, "", "the hidden questions panel must not repeat the eight visible questions");
assert.equal(audios.pg034_im002, undefined, "the hidden questions panel must not have narration audio");
assert.equal(timecodes.pg034_im002, undefined, "the hidden questions panel must not retain timing data");
assert.match(page34, /data-id="pg034_im002"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the hidden questions panel must be decorative");
const page34Questions = ["pg034_p002","pg034_p003","pg034_p005","pg034_p006","pg034_p008","pg034_p009","pg034_p011","pg034_p012"];
for (const id of page34Questions) {
  const stamps = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(stamps.map(({ text: word }) => word), tokens(texts[id]), `${id} must highlight every spoken question word in order`);
  const pause = stamps[1].start - stamps[0].end;
  assert.ok(pause >= 0.35 && pause <= 0.8, `${id} must use a natural pause after its question number`);
}
assert.equal(audios.pg034_p005, "pg034_p005_adt_clean.mp3", "question 3 must use the recording with its excessive silence removed");
assert.ok(meanVolume(audios.pg034_p005) > -35, "question 3 must remain clearly audible after cleaning");
assert.deepEqual(timecodes.pg034_im001.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg034_im001), "the balloon illustration must highlight its description in spoken order");
assert.match(page34, /data-id="pg034_p001"[\s\S]*data-id="pg034_p002"[\s\S]*data-id="pg034_p003"[\s\S]*data-id="pg034_p005"[\s\S]*data-id="pg034_p006"[\s\S]*data-id="pg034_p008"[\s\S]*data-id="pg034_p009"[\s\S]*data-id="pg034_p011"[\s\S]*data-id="pg034_p012"[\s\S]*data-id="pg034_p014"[\s\S]*data-id="pg034_p015"[\s\S]*data-id="pg034_im001"/, "page 34 must narrate questions and Activity 2 in visual reading order");

const page35 = read("pg035_sec001.html");
assert.match(page35, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 35 must use only the exact runtime word highlight");
for (const id of ["pg035_im002", "pg035_im004"]) {
  assert.equal(texts[id], "", `${id} hidden question panel must not repeat visible questions`);
  assert.equal(audios[id], undefined, `${id} hidden question panel must not have narration audio`);
  assert.equal(timecodes[id], undefined, `${id} hidden question panel must not retain timing data`);
  assert.match(page35, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
const page35Questions = ["pg035_p002","pg035_p003","pg035_p004","pg035_p006","pg035_p012","pg035_p013","pg035_p014","pg035_p015"];
for (const id of page35Questions) {
  const stamps = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(stamps.map(({ text: word }) => word), tokens(texts[id]), `${id} must highlight every spoken question word in order`);
  const pause = stamps[1].start - stamps[0].end;
  assert.ok(pause >= 0.25 && pause <= 0.8, `${id} must use a natural pause after its question number`);
}
assert.equal(audios.pg035_p002, "pg035_p002_adt_clean.mp3", "question 1 must pronounce hundreds, not hundredths");
for (const id of ["pg035_p002","pg035_p004","pg035_p012","pg035_p013","pg035_p014"]) {
  assert.ok(meanVolume(audios[id]) > -35, `${id} cleaned narration must remain clearly audible`);
}
assert.deepEqual(timecodes.pg035_im001.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg035_im001), "the arrow diagram must highlight its full spoken description in order");
assert.deepEqual(tokens(texts.pg035_im001).filter(word => /^\d+$/.test(word)), ["101","109","207","210","290","300","304","320","360","399","476","498","500","535","564","572","602","688","743","768","822","831","849","890","900","947","963","999"], "the arrow diagram must be narrated by following every arrow from 101 to 999");
assert.equal(audios.pg035_im001, "pg035_im001_adt_order.mp3", "the arrow diagram must use its corrected ordered narration");
assert.match(page35, /data-id="pg035_p001"[\s\S]*data-id="pg035_p002"[\s\S]*data-id="pg035_p003"[\s\S]*data-id="pg035_p004"[\s\S]*data-id="pg035_p006"[\s\S]*data-id="pg035_p008"[\s\S]*data-id="pg035_p009"[\s\S]*data-id="pg035_im001"[\s\S]*data-id="pg035_p011"[\s\S]*data-id="pg035_p012"[\s\S]*data-id="pg035_p013"[\s\S]*data-id="pg035_p014"[\s\S]*data-id="pg035_p015"/, "page 35 must narrate both question sets and Activity 3 in visual order");

const page36 = read("pg036_sec001.html");
assert.match(page36, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/, "page 36 must use only the exact runtime word highlight");
assert.match(page36, /#adt-runtime-word-highlight\{display:none!important\}/, "page 36 must temporarily hide the yellow runtime word marker without disabling audio");
assert.equal(audios.pg036_p002, "pg036_p002_adt_clean.mp3", "disabling page 36 highlighting must leave read-aloud audio enabled");
assert.equal(texts.pg036_im003, "", "the extracted Tens column must not repeat the bottom table");
assert.equal(audios.pg036_im003, undefined, "the extracted Tens column must not have narration audio");
assert.equal(timecodes.pg036_im003, undefined, "the extracted Tens column must not retain timing data");
assert.match(page36, /data-id="pg036_im003"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the extracted Tens column must be decorative");
assert.equal(texts.pg036_p002, "1. Write the place value of each missing number horizontally in the following chart.", "question 1 must be one complete instruction");
assert.equal(audios.pg036_p002, "pg036_p002_adt_clean.mp3", "question 1 must use one uninterrupted recording");
assert.equal(texts.pg036_p003, "", "the obsolete second instruction fragment must be empty");
assert.equal(audios.pg036_p003, undefined, "the obsolete second instruction fragment must not play separately");
assert.deepEqual(timecodes.pg036_p002.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg036_p002), "question 1 must highlight its complete instruction in spoken order");
assert.ok(meanVolume(audios.pg036_p002) > -35, "question 1 must remain clearly audible");
for (const id of ["pg036_p002","pg036_p031","pg036_p032","pg036_p048"]) {
  const stamps = timecodes[id].timecodes[1].word_timestamps;
  const pause = stamps[1].start - stamps[0].end;
  assert.ok(pause >= 0.5 && pause <= 0.85, `${id} must use a natural pause after its question number`);
}
const page36TopIds = ["pg036_p004","pg036_p005","pg036_p006","pg036_p007","pg036_p008","pg036_p009","pg036_p010","pg036_p011","pg036_p012","pg036_p013","pg036_p014","pg036_p015","pg036_p016","pg036_p017","pg036_p018","pg036_p019","pg036_p020","pg036_p021","pg036_p022","pg036_p023","pg036_p024","pg036_p025","pg036_p026","pg036_p027","pg036_p028","pg036_p029","pg036_p030"];
assert.deepEqual(page36TopIds.flatMap(id => tokens(texts[id])), ["201","202","203","205","206","207","208","209","301","303","304","305","306","307","308","309","401","402","403","404","405","407","408","409","501","502","503","504","506","507","508","509","601","603","604","605","606","607","608","609","701","702","703","704","705","706","708","709","801","802","803","804","805","806","807","808","901","902","904","905","906","907","908","909"], "the top chart must read every printed number once in row order");
assert.match(page36, /var columns=\[5,43,84,125,167,209,251,293,335\]/, "top-chart highlights must use the nine photographed column positions");
assert.deepEqual(["pg036_p054","pg036_p055","pg036_p056","pg036_p058","pg036_p059","pg036_p060","pg036_p062","pg036_p063","pg036_p064","pg036_p066","pg036_p067","pg036_p068","pg036_p070","pg036_p071","pg036_p072"].map(id => texts[id]), ["1","1","9","8","2","7","2","6","3","6","1","0","3","3","3"], "the bottom table must read hundreds, tens, and ones row by row");
assert.match(page36, /box\("pg036_p055",246,577,44,"center"\); box\("pg036_p071",246,658,44,"center"\); box\("pg036_p072",335,658,41,"center"\)/, "repeated digits must highlight their own Tens and Ones cells instead of overlapping Hundreds");
assert.match(page36, /style:at\(black,24,0\).*style:at\(black,24,21\)[\s\S]*?\],82,85,387,42\)/, "question 1 instruction highlights must align with both printed lines");
const page36Question3Rows = {
  pg036_p076: "229. Two is in the tens column.",
  pg036_p077: "368. Three is in the hundreds column.",
  pg036_p078: "876. Six is in the ones column.",
  pg036_p079: "569. Six is in the tens column.",
  pg036_p080: "997. Nine is in the hundreds column."
};
const page36Question4Rows = {
  pg036_p081: "One is in the hundreds column, one is in the tens column, and nine is in the ones column.",
  pg036_p082: "Eight is in the hundreds column, two is in the tens column, and seven is in the ones column.",
  pg036_p083: "Two is in the hundreds column, six is in the tens column, and three is in the ones column.",
  pg036_p084: "Six is in the hundreds column, one is in the tens column, and zero is in the ones column.",
  pg036_p085: "Three is in the hundreds column, three is in the tens column, and three is in the ones column."
};
for (const [id, expected] of Object.entries({ ...page36Question3Rows, ...page36Question4Rows })) {
  assert.equal(texts[id], expected, `${id} must narrate its complete place-value row`);
  assert.equal(audios[id], `${id}_adt_place_value.mp3`, `${id} must use the corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing in display order`);
  assert.equal((page36.match(new RegExp(`data-id="${id}"`, "g")) ?? []).length, 1, `${id} must occur once in page order`);
}
assert.match(page36, /function narration\(id,segments\).*?node\.style\.whiteSpace="nowrap"/s, "page 36 contextual narration must never wrap its hidden timing words into another question");
assert.match(page36, /\["pg036_p077","368","Three",425,250,"hundreds",220\]/, "question 3 row two must anchor its digit and Hundreds highlight to that row");
assert.match(page36, /\["pg036_p083",\["Two","six","three"\],618\]/, "question 4 row three must retain its correct place-value highlight anchors");
for (const id of ["pg036_p038","pg036_p039","pg036_p040","pg036_p041","pg036_p042","pg036_p043","pg036_p044","pg036_p045","pg036_p046","pg036_p047","pg036_p054","pg036_p055","pg036_p056","pg036_p058","pg036_p059","pg036_p060","pg036_p062","pg036_p063","pg036_p064","pg036_p066","pg036_p067","pg036_p068","pg036_p070","pg036_p071","pg036_p072"]) {
  assert.equal(audios[id], undefined, `${id} must not repeat an isolated table-cell clip`);
  assert.equal(timecodes[id], undefined, `${id} must not retain obsolete isolated timing`);
}

const page37 = read("pg037_sec001.html");
assert.equal(texts.pg037_p002, "Numbers can be added horizontally or vertically. Addition is done by considering the place value of each digit in a number.", "page 37 introduction must be one uninterrupted passage");
assert.equal(audios.pg037_p002, "pg037_p002_adt_intro.mp3", "page 37 introduction must use the corrected ADT recording");
assert.deepEqual(timecodes.pg037_p002.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg037_p002), "page 37 introduction must retain real word-level timing");
assert.equal(texts.pg037_p003, "", "the obsolete continuation fragment must be empty");
assert.equal(audios.pg037_p003, undefined, "the obsolete continuation fragment must not play separately");
assert.equal(timecodes.pg037_p003, undefined, "the obsolete continuation fragment must not retain timing");
assert.match(page37, /content\.insertBefore\(chapter,lesson\)/, "the Chapter Five description must play before the lesson title");
assert.match(page37, /expression\.after\(example\)/, "the complete example description must play at the example instead of before the introduction");
assert.equal(audios.pg037_im007, "pg037_im007.mp3", "the chapter banner must be narrated once");
assert.equal(audios.pg037_im008, "pg037_im008.mp3", "the place-value model must use one complete description");
for (const id of ["pg037_im001","pg037_im002","pg037_im003","pg037_im004","pg037_im005","pg037_im006"]) {
  assert.equal(texts[id], "", `${id} must be decorative because the complete model is already described`);
  assert.equal(audios[id], undefined, `${id} must not repeat an individual counter-group clip`);
  assert.equal(timecodes[id], undefined, `${id} must not retain duplicate timing`);
  assert.match(page37, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be marked decorative`);
}
for (const id of ["pg037_p007","pg037_p008","pg037_p009","pg037_p010","pg037_p011","pg037_p012","pg037_p013","pg037_p014","pg037_p015","pg037_p016","pg037_p017","pg037_p018","pg037_p019","pg037_p020","pg037_p021","pg037_p022","pg037_p023","pg037_p024"]) {
  assert.equal(audios[id], undefined, `${id} must not repeat text already covered by the consolidated chapter or example narration`);
  assert.equal(timecodes[id], undefined, `${id} must not retain duplicate timing`);
}

const page38 = read("pg038_sec001.html");
assert.equal(texts.pg038_im002, "", "the hidden page 38 composite must not repeat the complete first example");
assert.equal(audios.pg038_im002, undefined, "the hidden page 38 composite must not play narration");
assert.equal(timecodes.pg038_im002, undefined, "the hidden page 38 composite must not retain duplicate timing");
assert.match(page38, /data-id="pg038_im002"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the hidden page 38 composite must be decorative");
assert.equal(audios.pg038_im001, "pg038_im001.mp3", "the visible abacus must retain its focused description");
assert.equal(texts.pg038_p008, "3. Add hundreds: 3 + 2 = 5. Write 5 in the hundreds place.", "page 38 must use the correct hundreds calculation");
assert.equal(audios.pg038_p008, "pg038_p008_adt_corrected.mp3", "the corrected hundreds step must use the new ADT narration");
assert.deepEqual(timecodes.pg038_p008.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(texts.pg038_p008), "the corrected hundreds step must retain real word-level timing");
for (const id of ["pg038_p009", "pg038_p019"]) {
  assert.equal(audios[id], undefined, `${id} must not repeat the final equation immediately before Therefore`);
  assert.equal(timecodes[id], undefined, `${id} must not retain duplicate timing`);
}

const page39 = read("pg039_sec001.html");
const page39Models = {
  pg039_p039: "First place-value model. In the hundreds column, two green counters are added to one green counter. In the tens column, one blue counter is added to four blue counters. In the ones column, four red counters are added to three red counters. Fill in the three column totals and the final sum.",
  pg039_p040: "Second place-value model. In the hundreds column, three green counters are added to four green counters. In the tens column, four blue counters are added to three blue counters. In the ones column, two red counters are added to six red counters. Fill in the three column totals and the final sum."
};
for (const [id, expected] of Object.entries(page39Models)) {
  assert.equal(texts[id], expected, `${id} must describe every counter group without giving away the answer`);
  assert.equal(audios[id], `${id}_adt_model.mp3`, `${id} must use the complete ADT model narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.ok(page39.indexOf('data-id="pg039_p003"') < page39.indexOf('data-id="pg039_p039"'), "the first model description must follow its equation");
assert.ok(page39.indexOf('data-id="pg039_p020"') < page39.indexOf('data-id="pg039_p040"'), "the second model description must follow its equation");
for (const id of ["pg039_im001", "pg039_im002", "pg039_im003"]) {
  assert.equal(texts[id], "", `${id} must be decorative because the complete model is described once`);
  assert.equal(audios[id], undefined, `${id} must not play an isolated counter description`);
  assert.equal(timecodes[id], undefined, `${id} must not retain duplicate timing`);
  assert.match(page39, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be marked decorative`);
}
for (const id of ["pg039_p004","pg039_p005","pg039_p006","pg039_p007","pg039_p008","pg039_p009","pg039_p010","pg039_p011","pg039_p012","pg039_p021","pg039_p022","pg039_p023","pg039_p024","pg039_p025","pg039_p026","pg039_p027","pg039_p028","pg039_p029"]) {
  assert.equal(audios[id], undefined, `${id} must not repeat an isolated table label`);
  assert.equal(timecodes[id], undefined, `${id} must not retain obsolete isolated timing`);
}

const page40 = read("pg040_sec001.html");
const page40Models = {
  pg040_p037: "Third place-value model. In the hundreds column, one green counter is added to two green counters. In the tens column, two blue counters are added to three blue counters. In the ones column, five red counters are added to three red counters. Fill in the three column totals and the final sum.",
  pg040_p038: "Fourth place-value model. In the hundreds column, four green counters are added to five green counters. In the tens column, two blue counters are added to one blue counter. In the ones column, five red counters are added to two red counters. Fill in the three column totals and the final sum."
};
for (const [id, expected] of Object.entries(page40Models)) {
  assert.equal(texts[id], expected, `${id} must describe every counter group without giving away the answer`);
  assert.equal(audios[id], `${id}_adt_model.mp3`, `${id} must use the complete ADT model narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.ok(page40.indexOf('data-id="pg040_p001"') < page40.indexOf('data-id="pg040_p037"'), "the third model description must follow its equation");
assert.ok(page40.indexOf('data-id="pg040_p018"') < page40.indexOf('data-id="pg040_p038"'), "the fourth model description must follow its equation");
for (const id of ["pg040_im001", "pg040_im002", "pg040_im003"]) {
  assert.equal(texts[id], "", `${id} must be decorative because the complete model is described once`);
  assert.equal(audios[id], undefined, `${id} must not play an isolated counter description`);
  assert.equal(timecodes[id], undefined, `${id} must not retain duplicate timing`);
  assert.match(page40, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be marked decorative`);
}
for (const id of ["pg040_p002","pg040_p003","pg040_p004","pg040_p005","pg040_p006","pg040_p007","pg040_p008","pg040_p009","pg040_p010","pg040_p019","pg040_p020","pg040_p021","pg040_p022","pg040_p023","pg040_p024","pg040_p025","pg040_p026","pg040_p027"]) {
  assert.equal(audios[id], undefined, `${id} must not repeat an isolated table label`);
  assert.equal(timecodes[id], undefined, `${id} must not retain obsolete isolated timing`);
}

const page41 = read("pg041_sec001.html");
const page41Models = {
  pg041_p037: "Fifth place-value model. In the hundreds column, six green counters are added to two green counters. In the tens column, three blue counters are added to six blue counters. In the ones column, two red counters are added to seven red counters. Fill in the three column totals and the final sum.",
  pg041_p038: "Sixth place-value model. In the hundreds column, three green counters are added to three green counters. In the tens column, three blue counters are added to three blue counters. In the ones column, three red counters are added to three red counters. Fill in the three column totals and the final sum."
};
for (const [id, expected] of Object.entries(page41Models)) {
  assert.equal(texts[id], expected, `${id} must describe every counter group without giving away the answer`);
  assert.equal(audios[id], `${id}_adt_model.mp3`, `${id} must use the complete ADT model narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.ok(page41.indexOf('data-id="pg041_p001"') < page41.indexOf('data-id="pg041_p037"'), "the fifth model description must follow its equation");
assert.ok(page41.indexOf('data-id="pg041_p018"') < page41.indexOf('data-id="pg041_p038"'), "the sixth model description must follow its equation");
for (const id of ["pg041_im001", "pg041_im002", "pg041_im003"]) {
  assert.equal(texts[id], "", `${id} must be decorative because the complete model is described once`);
  assert.equal(audios[id], undefined, `${id} must not play an isolated counter description`);
  assert.equal(timecodes[id], undefined, `${id} must not retain duplicate timing`);
  assert.match(page41, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be marked decorative`);
}
for (const id of ["pg041_p002","pg041_p003","pg041_p004","pg041_p005","pg041_p006","pg041_p007","pg041_p008","pg041_p009","pg041_p010","pg041_p019","pg041_p020","pg041_p021","pg041_p022","pg041_p023","pg041_p024","pg041_p025","pg041_p026","pg041_p027"]) {
  assert.equal(audios[id], undefined, `${id} must not repeat an isolated table label`);
  assert.equal(timecodes[id], undefined, `${id} must not retain obsolete isolated timing`);
}

const page42 = read("pg042_sec001.html");
const page42ReadingOrder = [
  "pg042_p003", "pg042_p005", "pg042_p007", "pg042_p009", "pg042_p011",
  "pg042_p013", "pg042_p015", "pg042_p017", "pg042_p019", "pg042_p021",
  "pg042_p004", "pg042_p006", "pg042_p008", "pg042_p010", "pg042_p012",
  "pg042_p014", "pg042_p016", "pg042_p018", "pg042_p020", "pg042_p022"
];
const page42OrderSource = page42.match(/var readingOrder = \[([\s\S]*?)\];/);
assert.ok(page42OrderSource, "page 42 must define its two-column reading order before read-aloud starts");
assert.deepEqual(
  [...page42OrderSource[1].matchAll(/"(pg042_p\d+)"/g)].map((match) => match[1]),
  page42ReadingOrder,
  "page 42 must read questions 1–10 before questions 11–20"
);
for (const id of page42ReadingOrder) {
  assert.equal(audios[id], `${id}.mp3`, `${id} must retain its own equation narration`);
  assert.deepEqual(
    timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word),
    tokens(texts[id]),
    `${id} must retain word-level timing for its complete printed equation`
  );
}
assert.equal(texts.pg042_im001, "", "the page 42 composite exercise image must not repeat the visible exercise text");
assert.equal(audios.pg042_im001, undefined, "the page 42 composite exercise image must not play duplicate narration");
assert.equal(timecodes.pg042_im001, undefined, "the page 42 composite exercise image must not retain duplicate timing");
assert.match(page42, /data-id="pg042_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the page 42 composite exercise image must be decorative");

const page43 = read("pg043_sec001.html");
const page43Visual = "A schoolgirl stands looking down at three open boxes of coins. The boxes are pink, yellow, and orange, arranged from left to right.";
assert.equal(texts.pg043_im001, page43Visual, "the page 43 illustration must describe its visual scene without repeating the coin-count caption");
assert.equal(audios.pg043_im001, "pg043_im001_adt_visual.mp3", "the page 43 illustration must use the corrected ADT narration");
assert.deepEqual(
  timecodes.pg043_im001.timecodes[1].word_timestamps.map(({ text: word }) => word),
  tokens(page43Visual),
  "the page 43 illustration must retain real word-level timing"
);
assert.equal(texts.pg043_im002, "", "the hidden page 43 question composite must not summarize the questions before they are read");
assert.equal(audios.pg043_im002, undefined, "the hidden page 43 question composite must not play duplicate narration");
assert.equal(timecodes.pg043_im002, undefined, "the hidden page 43 question composite must not retain duplicate timing");
assert.match(page43, /data-id="pg043_im002"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the hidden page 43 question composite must be decorative");
assert.ok(page43.indexOf('data-id="pg043_im001"') < page43.indexOf('data-id="pg043_p001"'), "the illustration description must precede its three box labels");
assert.ok(page43.indexOf('data-id="pg043_p003"') < page43.indexOf('data-id="pg043_p004"'), "the coin-count passage must follow the three box labels");

const page44 = read("pg044_sec001.html");
const page44Setup = "Solution. Arrange 216 plus 102 vertically. Align the 100s, 10s, and 1s digits in their correct columns.";
assert.equal(texts.pg044_p051, page44Setup, "page 44 must narrate the vertical setup as one coherent passage");
assert.equal(audios.pg044_p051, "pg044_p051_adt_setup.mp3", "page 44 must use the corrected ADT setup narration");
assert.deepEqual(
  timecodes.pg044_p051.timecodes[1].word_timestamps.map(({ text: word }) => word),
  tokens(page44Setup),
  "the page 44 setup must retain real word-level timing"
);
assert.equal(texts.pg044_im001, "", "the page 44 composite must not repeat the complete worked example");
assert.equal(audios.pg044_im001, undefined, "the page 44 composite must not play duplicate narration");
assert.equal(timecodes.pg044_im001, undefined, "the page 44 composite must not retain duplicate timing");
assert.match(page44, /data-id="pg044_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the page 44 composite must be decorative");
assert.ok(page44.indexOf('data-id="pg044_p004"') < page44.indexOf('data-id="pg044_p051"'), "the setup narration must follow the example instruction");
assert.ok(page44.indexOf('data-id="pg044_p051"') < page44.indexOf('data-id="pg044_p014"'), "the numbered steps must follow the setup narration");
for (const id of [
  "pg044_p005", "pg044_p008", "pg044_p009", "pg044_p010", "pg044_p011", "pg044_p012", "pg044_p013",
  "pg044_p017", "pg044_p018", "pg044_p019", "pg044_p021", "pg044_p022", "pg044_p023", "pg044_p024",
  "pg044_p025", "pg044_p026", "pg044_p027", "pg044_p030", "pg044_p031", "pg044_p032", "pg044_p034",
  "pg044_p035", "pg044_p036", "pg044_p037", "pg044_p038", "pg044_p039", "pg044_p040", "pg044_p041",
  "pg044_p043", "pg044_p044", "pg044_p045", "pg044_p046", "pg044_p047", "pg044_p048"
]) {
  assert.equal(audios[id], undefined, `${id} must not play as an isolated diagram fragment`);
  assert.equal(timecodes[id], undefined, `${id} must not retain obsolete isolated timing`);
}

const page45 = read("pg045_sec001.html");
const page45Setup = "Solution. Arrange 345 plus 223 vertically. Align the hundreds, tens, and ones digits in their correct columns. The sum is 568.";
assert.equal(texts.pg045_p053, page45Setup, "page 45 must narrate Example 2 as one coherent vertical-addition setup");
assert.equal(audios.pg045_p053, "pg045_p053_adt_setup.mp3", "page 45 must use the corrected ADT setup narration");
assert.deepEqual(
  timecodes.pg045_p053.timecodes[1].word_timestamps.map(({ text: word }) => word),
  tokens(page45Setup),
  "the page 45 setup must retain real word-level timing"
);
assert.ok(page45.indexOf('data-id="pg045_p017"') < page45.indexOf('data-id="pg045_p053"'), "the Example 2 label must precede its setup narration");
assert.ok(page45.indexOf('data-id="pg045_p053"') < page45.indexOf('data-id="pg045_p037"'), "the Example 2 steps must follow its setup narration");
for (const id of [
  "pg045_p003", "pg045_p004", "pg045_p005", "pg045_p007", "pg045_p008", "pg045_p009",
  "pg045_p010", "pg045_p011", "pg045_p012", "pg045_p013", "pg045_p014", "pg045_p015",
  "pg045_p019", "pg045_p020", "pg045_p021", "pg045_p022", "pg045_p023", "pg045_p024",
  "pg045_p025", "pg045_p028", "pg045_p029", "pg045_p030", "pg045_p031", "pg045_p032",
  "pg045_p033", "pg045_p034", "pg045_p035", "pg045_p036", "pg045_p040", "pg045_p041",
  "pg045_p042", "pg045_p044", "pg045_p045", "pg045_p046", "pg045_p047", "pg045_p048",
  "pg045_p049", "pg045_p050"
]) {
  assert.equal(audios[id], undefined, `${id} must not play as an isolated page 45 diagram fragment`);
  assert.equal(timecodes[id], undefined, `${id} must not retain obsolete isolated page 45 timing`);
}

const page46 = read("pg046_sec001.html");
const page46Questions = "Question 1. 226 plus 432. Question 2. 342 plus 22. Question 3. 432 plus 41. Question 4. 325 plus 143. Question 5. 333 plus 304. Question 6. 137 plus 200.";
assert.equal(texts.pg046_p079, page46Questions, "page 46 must narrate all six sums clearly and in printed order");
assert.equal(audios.pg046_p079, "pg046_p079_adt_questions.mp3", "page 46 must use the corrected ADT exercise narration");
assert.deepEqual(
  timecodes.pg046_p079.timecodes[1].word_timestamps.map(({ text: word }) => word),
  tokens(page46Questions),
  "the page 46 exercise narration must retain real word-level timing"
);
assert.equal(texts.pg046_im001, "", "the page 46 composite must not repeat all worked steps and questions");
assert.equal(audios.pg046_im001, undefined, "the page 46 composite must not play duplicate narration");
assert.equal(timecodes.pg046_im001, undefined, "the page 46 composite must not retain duplicate timing");
assert.match(page46, /data-id="pg046_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the page 46 composite must be decorative");
assert.ok(page46.indexOf('data-id="pg046_p032"') < page46.indexOf('data-id="pg046_p079"'), "the exercise instruction must precede its questions");
for (const id of [
  "pg046_p003", "pg046_p004", "pg046_p005", "pg046_p007", "pg046_p008", "pg046_p009",
  "pg046_p010", "pg046_p011", "pg046_p012", "pg046_p013", "pg046_p014", "pg046_p017",
  "pg046_p018", "pg046_p019", "pg046_p021", "pg046_p022", "pg046_p023", "pg046_p024",
  "pg046_p025", "pg046_p026", "pg046_p027", "pg046_p028", "pg046_p029", "pg046_p033",
  "pg046_p035", "pg046_p036", "pg046_p037", "pg046_p038", "pg046_p039", "pg046_p040",
  "pg046_p041", "pg046_p043", "pg046_p044", "pg046_p045", "pg046_p046", "pg046_p047",
  "pg046_p049", "pg046_p050", "pg046_p051", "pg046_p052", "pg046_p053", "pg046_p055",
  "pg046_p056", "pg046_p057", "pg046_p058", "pg046_p059", "pg046_p060", "pg046_p061",
  "pg046_p063", "pg046_p064", "pg046_p065", "pg046_p066", "pg046_p067", "pg046_p068",
  "pg046_p069", "pg046_p071", "pg046_p072", "pg046_p073", "pg046_p074", "pg046_p075",
  "pg046_p076"
]) {
  assert.equal(audios[id], undefined, `${id} must not play as an isolated page 46 diagram fragment`);
  assert.equal(timecodes[id], undefined, `${id} must not retain obsolete isolated page 46 timing`);
}

const page47 = read("pg047_sec001.html");
const page47Continuation = "Question 7. 444 plus 222. Question 8. 70 plus 20. Question 9. 106 plus 450. Question 10. 121 plus 712. Question 11. 215 plus 421. Question 12. 560 plus 439. Question 13. 126 plus 563. Question 14. 561 plus 423. Question 15. 716 plus 231.";
const page47Exercise = "Question 1. 465 plus 334. Question 2. 613 plus 244. Question 3. 472 plus 324. Question 4. 715 plus 223. Question 5. 678 plus 210. Question 6. 421 plus 136. Question 7. 714 plus 133. Question 8. 352 plus 415. Question 9. 526 plus 313. Question 10. 564 plus 213. Question 11. 215 plus 421. Question 12. 128 plus 541.";
for (const [id, expected, filename] of [
  ["pg047_p171", page47Continuation, "pg047_p171_adt_questions7to15.mp3"],
  ["pg047_p172", page47Exercise, "pg047_p172_adt_exercise4.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate the printed page 47 sums in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const imageId of ["pg047_im001", "pg047_im002"]) {
  assert.equal(texts[imageId], "", `${imageId} must not repeat its complete exercise`);
  assert.equal(audios[imageId], undefined, `${imageId} must not play duplicate narration`);
  assert.equal(timecodes[imageId], undefined, `${imageId} must not retain duplicate timing`);
  assert.match(page47, new RegExp(`data-id="${imageId}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${imageId} must be decorative`);
}
assert.ok(page47.indexOf('data-id="pg047_p171"') < page47.indexOf('data-id="pg047_p001"'), "questions 7–15 must be introduced before their isolated visual fragments");
assert.ok(page47.indexOf('data-id="pg047_p072"') < page47.indexOf('data-id="pg047_p172"'), "Exercise 4 instructions must precede its sums");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg047_")).sort(),
  ["pg047_p071", "pg047_p072", "pg047_p171", "pg047_p172"],
  "page 47 must narrate only its headings and two coherent equation passages"
);

const page48 = read("pg048_sec001.html");
const page48Questions = "Question 13. 213 plus 331. Question 14. 213 plus 431. Question 15. 785 plus 214.";
const page48Example = "167 plus 138 equals 305. Solution. Step 1. Add ones: 7 plus 8 equals 15. Regroup 15 ones into 1 ten and 5 ones. Write 5 in the ones place. Carry 1 ten to the tens place. Step 2. Add tens: 1 plus 6 plus 3 equals 10. Regroup 10 tens into 1 hundred and 0 tens. Write 0 in the tens place. Carry 1 hundred to the hundreds place.";
for (const [id, expected, filename] of [
  ["pg048_p052", page48Questions, "pg048_p052_adt_questions13to15.mp3"],
  ["pg048_p053", page48Example, "pg048_p053_adt_example.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 48 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const imageId of ["pg048_im001", "pg048_im002"]) {
  assert.equal(texts[imageId], "", `${imageId} must not repeat its complete content`);
  assert.equal(audios[imageId], undefined, `${imageId} must not play duplicate narration`);
  assert.equal(timecodes[imageId], undefined, `${imageId} must not retain duplicate timing`);
  assert.match(page48, new RegExp(`data-id="${imageId}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${imageId} must be decorative`);
}
assert.ok(page48.indexOf('data-id="pg048_p052"') < page48.indexOf('data-id="pg048_p001"'), "questions 13–15 must precede their visual fragments");
assert.ok(page48.indexOf('data-id="pg048_p029"') < page48.indexOf('data-id="pg048_p053"'), "the Example heading must precede its coherent narration");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg048_")).sort(),
  ["pg048_p025", "pg048_p026", "pg048_p027", "pg048_p029", "pg048_p052", "pg048_p053"],
  "page 48 must narrate only its introduction and two coherent passages"
);

const page49 = read("pg049_sec001.html");
const page49Step = "Step 3. Add hundreds: 1 plus 1 plus 1 equals 3. Write 3 in the hundreds place. Therefore, 167 plus 138 equals 305.";
const page49Questions = "Question 1. 683 plus 138. Question 2. 364 plus 348. Question 3. 736 plus 249. Question 4. 262 plus 289. Question 5. 566 plus 284. Question 6. 292 plus 362. Question 7. 456 plus 258. Question 8. 272 plus 465. Question 9. 781 plus 209. Question 10. 189 plus 771.";
const page49Image = "Place-value bead frame showing regrouping for 167 plus 138. Fifteen red ones are regrouped: ten circled ones become one blue ten, leaving five ones. Then ten circled blue tens become one green hundred, leaving zero tens. Together with the existing hundreds, the final columns show 3 hundreds, 0 tens, and 5 ones. Therefore, 167 plus 138 equals 305.";
for (const [id, expected, filename] of [
  ["pg049_p030", page49Step, "pg049_p030_adt_step3.mp3"],
  ["pg049_p031", page49Questions, "pg049_p031_adt_exercise5.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 49 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.equal(texts.pg049_im003, "", "the Exercise 5 composite must not repeat all ten questions");
assert.equal(audios.pg049_im003, undefined, "the Exercise 5 composite must not play duplicate narration");
assert.equal(timecodes.pg049_im003, undefined, "the Exercise 5 composite must not retain duplicate timing");
assert.match(page49, /data-id="pg049_im003"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the Exercise 5 composite must be decorative");
assert.equal(texts.pg049_im001, page49Image, "the bead-frame description must explain both regrouping arrows and the final place values");
assert.equal(audios.pg049_im001, "pg049_im001_adt_regrouping.mp3", "the corrected bead-frame description must be narrated");
assert.deepEqual(timecodes.pg049_im001.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(page49Image), "the bead-frame description must retain real word-level timing");
assert.ok(page49.indexOf('data-id="pg049_p030"') < page49.indexOf('data-id="pg049_p001"'), "Step 3 must precede its isolated visual fragments");
assert.ok(page49.indexOf('data-id="pg049_p008"') < page49.indexOf('data-id="pg049_p031"'), "the Exercise 5 instruction must precede its questions");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg049_")).sort(),
  ["pg049_im001", "pg049_p005", "pg049_p007", "pg049_p008", "pg049_p030", "pg049_p031"],
  "page 49 must narrate only its worked step, visual alternative, heading, instruction, and coherent questions"
);

const page50 = read("pg050_sec001.html");
const page50Continuation = "Question 11. 484 plus 109. Question 12. 189 plus 102. Question 13. 801 plus 9. Question 14. 229 plus 229. Question 15. 518 plus 119. Question 16. 673 plus 117. Question 17. 239 plus 221. Question 18. 123 plus 229. Question 19. 444 plus 137. Question 20. 269 plus 21.";
const page50Exercise = "Question 1. 739 plus 15. Question 2. 118 plus 132. Question 3. 819 plus 113. Question 4. 287 plus 113. Question 5. 773 plus 9. Question 6. 333 plus 27. Question 7. 239 plus 8. Question 8. 123 plus 127. Question 9. 444 plus 219. Question 10. 269 plus 23. Question 11. 291 plus 19. Question 12. 839 plus 111. Question 13. 709 plus 29. Question 14. 469 plus 31. Question 15. 729 plus 148. Question 16. 456 plus 326. Question 17. 381 plus 409. Question 18. 462 plus 418. Question 19. 282 plus 365. Question 20. 627 plus 203.";
for (const [id, expected, filename] of [
  ["pg050_p068", page50Continuation, "pg050_p068_adt_questions11to20.mp3"],
  ["pg050_p069", page50Exercise, "pg050_p069_adt_exercise6.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate the printed page 50 sums in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.equal(texts.pg050_im001, "", "the questions 11–20 composite must not repeat its text narration");
assert.equal(audios.pg050_im001, undefined, "the questions 11–20 composite must not play duplicate narration");
assert.equal(timecodes.pg050_im001, undefined, "the questions 11–20 composite must not retain duplicate timing");
assert.match(page50, /data-id="pg050_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the questions 11–20 composite must be decorative");
assert.ok(page50.indexOf('data-id="pg050_p068"') < page50.indexOf('data-id="pg050_p001"'), "questions 11–20 must precede their isolated visual fragments");
assert.ok(page50.indexOf('data-id="pg050_p021"') < page50.indexOf('data-id="pg050_p069"'), "the Exercise 6 instruction must precede its questions");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg050_")).sort(),
  ["pg050_p020", "pg050_p021", "pg050_p062", "pg050_p063", "pg050_p064", "pg050_p068", "pg050_p069"],
  "page 50 must narrate only its headings, instructions, explanatory text, and two coherent question passages"
);

const page51 = read("pg051_sec001.html");
const page51Instruction = "Add one hundred and sixty-six and one hundred and twenty-six vertically.";
const page51Solution = "Align the hundreds, tens, and ones digits in their correct columns. The first row has 1 in the hundreds column, 6 in the tens column, and 6 in the ones column. The second row has 1 in the hundreds column, 2 in the tens column, and 6 in the ones column. A plus sign appears before the second row. The answer row shows 2 in the hundreds column, 9 in the tens column, and 2 in the ones column. Steps. Step 1. Add ones: 6 plus 6 equals 12. Regroup 12 ones into 1 ten and 2 ones. Write 2 in the ones place. Take 1 ten to the tens place. Step 2. Add tens: 1 plus 6 plus 2 equals 9. Write 9 in the tens place. Step 3. Add hundreds: 1 plus 1 equals 2. Write 2 in the hundreds place. Therefore, the answer is two hundred and ninety-two.";
for (const [id, expected, filename] of [
  ["pg051_p060", page51Instruction, "pg051_p060_adt_instruction.mp3"],
  ["pg051_p061", page51Solution, "pg051_p061_adt_solution.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 51 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.equal(texts.pg051_im001, "", "the page 51 composite must not repeat the worked example");
assert.equal(audios.pg051_im001, undefined, "the page 51 composite must not play duplicate narration");
assert.equal(timecodes.pg051_im001, undefined, "the page 51 composite must not retain duplicate timing");
assert.match(page51, /data-id="pg051_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the page 51 composite must be decorative");
assert.ok(page51.indexOf('data-id="pg051_p001"') < page51.indexOf('data-id="pg051_p060"'), "the Example heading must precede the instruction");
assert.ok(page51.indexOf('data-id="pg051_p060"') < page51.indexOf('data-id="pg051_p002"'), "the instruction must precede the Solution heading");
assert.ok(page51.indexOf('data-id="pg051_p002"') < page51.indexOf('data-id="pg051_p061"'), "the Solution heading must precede the worked steps");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg051_")).sort(),
  ["pg051_p001", "pg051_p002", "pg051_p060", "pg051_p061"],
  "page 51 must narrate only its heading, instruction, solution label, and coherent worked steps"
);

const page52 = read("pg052_sec001.html");
const page52Instruction = "Add one hundred and sixty-six and one hundred and ninety-eight vertically.";
const page52Solution = "Align the hundreds, tens, and ones digits in their correct columns. The first row has 1 in the hundreds column, 6 in the tens column, and 6 in the ones column. The second row has 1 in the hundreds column, 9 in the tens column, and 8 in the ones column. A plus sign appears before the second row. The answer row shows 3 in the hundreds column, 6 in the tens column, and 4 in the ones column. Steps. Step 1. Add ones: 6 plus 8 equals 14. Regroup 14 ones into 1 ten and 4 ones. Write 4 in the ones place. Take 1 ten to the tens place. Step 2. Add tens: 1 plus 6 plus 9 equals 16. Regroup 16 tens into 1 hundred and 6 tens. Write 6 in the tens place. Take 1 hundred to the hundreds place. Step 3. Add hundreds: 1 plus 1 plus 1 equals 3. Write 3 in the hundreds place. Therefore, the answer is three hundred and sixty-four.";
for (const [id, expected, filename] of [
  ["pg052_p065", page52Instruction, "pg052_p065_adt_instruction.mp3"],
  ["pg052_p066", page52Solution, "pg052_p066_adt_solution.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 52 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.equal(texts.pg052_im001, "", "the page 52 composite must not repeat the worked example");
assert.equal(audios.pg052_im001, undefined, "the page 52 composite must not play duplicate narration");
assert.equal(timecodes.pg052_im001, undefined, "the page 52 composite must not retain duplicate timing");
assert.match(page52, /data-id="pg052_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the page 52 composite must be decorative");
assert.ok(page52.indexOf('data-id="pg052_p001"') < page52.indexOf('data-id="pg052_p065"'), "the Example heading must precede the instruction");
assert.ok(page52.indexOf('data-id="pg052_p065"') < page52.indexOf('data-id="pg052_p002"'), "the instruction must precede the Solution heading");
assert.ok(page52.indexOf('data-id="pg052_p002"') < page52.indexOf('data-id="pg052_p066"'), "the Solution heading must precede the worked steps");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg052_")).sort(),
  ["pg052_p001", "pg052_p002", "pg052_p065", "pg052_p066"],
  "page 52 must narrate only its heading, instruction, solution label, and coherent worked steps"
);

const page53 = read("pg053_sec001.html");
const page53Exercise7 = "Question 1. 435 plus 219. Question 2. 476 plus 214. Question 3. 665 plus 192. Question 4. 375 plus 267. Question 5. 295 plus 494. Question 6. 386 plus 108. Question 7. 150 plus 252. Question 8. 444 plus 281. Question 9. 568 plus 372. Question 10. 776 plus 195. Question 11. 329 plus 295. Question 12. 576 plus 134. Question 13. 99 plus 1. Question 14. 453 plus 268. Question 15. 336 plus 485.";
const page53Exercise8 = "Question 1. 576 plus 234. Question 2. 248 plus 134. Question 3. 356 plus 275.";
for (const [id, expected, filename] of [
  ["pg053_p147", page53Exercise7, "pg053_p147_adt_exercise7.mp3"],
  ["pg053_p148", page53Exercise8, "pg053_p148_adt_exercise8.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate the printed page 53 sums in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.ok(page53.indexOf('data-id="pg053_p002"') < page53.indexOf('data-id="pg053_p147"'), "Exercise 7 instruction must precede its questions");
assert.ok(page53.indexOf('data-id="pg053_p120"') < page53.indexOf('data-id="pg053_p148"'), "Exercise 8 instruction must precede its questions");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg053_")).sort(),
  ["pg053_p001", "pg053_p002", "pg053_p119", "pg053_p120", "pg053_p147", "pg053_p148"],
  "page 53 must narrate only its headings, instructions, and two coherent question passages"
);

const page54 = read("pg054_sec001.html");
const page54Questions = "Question 4. 486 plus 116. Question 5. 367 plus 475. Question 6. 237 plus 295. Question 7. 429 plus 134. Question 8. 586 plus 236. Question 9. 178 plus 276. Question 10. 285 plus 37. Question 11. 328 plus 79. Question 12. 467 plus 295. Question 13. 88 plus 2. Question 14. 179 plus 95. Question 15. 587 plus 162.";
const page54Chart = "The addition chart has column headings 101, 102, 103, 104, and 105, and row headings 101, 102, 103, 104, and 105. The row headed 101 contains 202, 203, 204, 205, and 206. The row headed 102 contains 203, 204, 205, 206, and 207. The row headed 103 contains 204, 205, 206, 207, and 208. The row headed 104 contains 205, 206, 207, 208, and 209. The row headed 105 contains 206, 207, 208, 209, and 210.";
const page54Explanation = "Look at the first row. It has 101, 102, 103, 104, and 105. The first column has 101, 102, 103, 104, and 105. Observe where the rows and columns meet. Each number in the box is the sum of two numbers. Those numbers are in the first row and the first column.";
for (const [id, expected, filename] of [
  ["pg054_p136", page54Questions, "pg054_p136_adt_questions4to15.mp3"],
  ["pg054_p137", page54Chart, "pg054_p137_adt_chart.mp3"],
  ["pg054_p138", page54Explanation, "pg054_p138_adt_explanation.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 54 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.ok(page54.indexOf('data-id="pg054_p136"') < page54.indexOf('data-id="pg054_p001"'), "questions 4–15 must precede their isolated visual fragments");
assert.ok(page54.indexOf('data-id="pg054_p092"') < page54.indexOf('data-id="pg054_p137"'), "the chart introduction must precede its description");
assert.ok(page54.indexOf('data-id="pg054_p128"') < page54.indexOf('data-id="pg054_p138"'), "the chart cells must precede the printed explanation");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg054_")).sort(),
  ["pg054_p091", "pg054_p092", "pg054_p136", "pg054_p137", "pg054_p138"],
  "page 54 must narrate only the continued questions, chart heading, introduction, chart description, and explanation"
);

const page55 = read("pg055_sec001.html");
const page55Chart = "The addition chart has column headings 201, 202, 203, 204, 205, and 206, and row headings 201, 202, 203, 204, 205, and 206. Two sums are already shown: 204 plus 205 equals 409, and 206 plus 203 equals 409. Fill in the other sums.";
const page55Questions = "Question 1. Add the numbers in the chart. Question 2. Write the smallest number in the first row. Question 3. Write the largest number in the fifth row. Question 4. Write the largest number in the chart. Question 5. The largest number is the sum of which numbers?";
const page55Sequences = "Question 1. 102, 104, 106. Question 2. 105, 110, 115. Question 3. 200, 250, 300. Question 4. 820, 840, 860. Question 5. 890, 893, 896. Question 6. 799, 808, 817. Question 7. 601, 605, 609, 621.";
for (const [id, expected, filename] of [
  ["pg055_p041", page55Chart, "pg055_p041_adt_chart.mp3"],
  ["pg055_p042", page55Questions, "pg055_p042_adt_questions.mp3"],
  ["pg055_p043", page55Sequences, "pg055_p043_adt_sequences.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 55 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.match(page55, /data-id="pg055_im002"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the duplicate Exercise 10 panel must be decorative");
assert.equal(texts.pg055_im002, "", "the duplicate Exercise 10 panel must not repeat the sequence narration");
assert.ok(page55.indexOf('data-id="pg055_p002"') < page55.indexOf('data-id="pg055_p041"'), "the chart instruction must precede its description");
assert.ok(page55.indexOf('data-id="pg055_p041"') < page55.indexOf('data-id="pg055_p042"'), "the chart description must precede the questions");
assert.ok(page55.indexOf('data-id="pg055_p024"') < page55.indexOf('data-id="pg055_p043"'), "the Exercise 10 instruction must precede its sequences");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg055_")).sort(),
  ["pg055_p001", "pg055_p002", "pg055_p023", "pg055_p024", "pg055_p041", "pg055_p042", "pg055_p043"],
  "page 55 must narrate only its headings, instructions, chart description, questions, and sequences"
);

const page56 = read("pg056_sec001.html");
const page56Sequences = "Question 8. 401, 500, 599. Question 9. 306, 312, 318. Question 10. 497, 506, 515, 542.";
const page56Path201 = "Number path from HOME to SCHOOL. 201, 202, 203, 204, 205, 206, 207, 208, 209, 210.";
const page56Path301 = "301, 302, 303, 304, 305, 306, 307, 308, 309, 310.";
const page56Path401 = "401, 402, 403, 404, 405, 406, 407, 408, 409, 410.";
const page56Path501 = "501 at SCHOOL.";
const page56Steps = "Step 1. Play in pairs. Step 2. Use a cup or a tin. Step 3. Put a die in a cup or in a tin. Step 4. Each player must have a marble of different colour for identification.";
for (const [id, expected, filename] of [
  ["pg056_p018", page56Sequences, "pg056_p018_adt_sequences.mp3"],
  ["pg056_im001", page56Path201, "pg056_im001_adt_path_201.mp3"],
  ["pg056_p020", page56Path301, "pg056_p020_adt_path_301.mp3"],
  ["pg056_p021", page56Path401, "pg056_p021_adt_path_401.mp3"],
  ["pg056_p022", page56Path501, "pg056_p022_adt_path_501.mp3"],
  ["pg056_p019", page56Steps, "pg056_p019_adt_steps.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 56 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.equal(texts.pg056_im004, "", "the page-number crop must not repeat the printed page number");
assert.match(page56, /data-id="pg056_im004"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the page-number crop must be decorative");
assert.ok(page56.indexOf('data-id="pg056_p018"') < page56.indexOf('data-id="pg056_p001"'), "the continued sequences must precede their isolated visual fragments");
assert.ok(page56.indexOf('data-id="pg056_p008"') < page56.indexOf('data-id="pg056_im001"'), "the game introduction must precede the path description");
assert.ok(page56.indexOf('data-id="pg056_p010"') < page56.indexOf('data-id="pg056_p019"'), "the Steps heading must precede the consolidated steps");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg056_")).sort(),
  ["pg056_im001", "pg056_p006", "pg056_p007", "pg056_p008", "pg056_p010", "pg056_p018", "pg056_p019", "pg056_p020", "pg056_p021", "pg056_p022"],
  "page 56 must narrate only its activity headings, introduction, path description, sequences, and consolidated steps"
);

const page57 = read("pg057_sec001.html");
const page57Steps = "Step 5. Roll the die in the cup or tin. Step 6. Count the number of dots shown on the top face of the die. Step 7. Move your marble in the direction of the school as the picture shows. Step 8. The marble is moved in steps equal to the number of dots on a die. Step 9. The first person to reach school will be the winner.";
const page57Scores = "Game number. Asha. Anna. Game number one. Asha, 203. Anna, 205. Game number two. Asha, 206. Anna, 211.";
const page57Solution = "Add Asha's scores: 203 plus 206 equals 409. Add Anna's scores: 205 plus 211 equals 416. Therefore, Asha's total score is 409 and Anna's total score is 416.";
for (const [id, expected, filename] of [
  ["pg057_p041", page57Steps, "pg057_p041_adt_steps.mp3"],
  ["pg057_p042", page57Scores, "pg057_p042_adt_scores.mp3"],
  ["pg057_p043", page57Solution, "pg057_p043_adt_solution.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 57 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.equal(texts.pg057_im001, "", "the duplicate example composite must not repeat the table narration");
assert.match(page57, /data-id="pg057_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the duplicate example composite must be decorative");
assert.ok(page57.indexOf('data-id="pg057_p041"') < page57.indexOf('data-id="pg057_p001"'), "the consolidated steps must precede their isolated visual fragments");
assert.ok(page57.indexOf('data-id="pg057_p011"') < page57.indexOf('data-id="pg057_p042"'), "the score-table introduction must precede its narration");
assert.ok(page57.indexOf('data-id="pg057_p024"') < page57.indexOf('data-id="pg057_p043"'), "the Solution heading must precede the worked additions");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg057_")).sort(),
  ["pg057_p009", "pg057_p010", "pg057_p011", "pg057_p022", "pg057_p023", "pg057_p024", "pg057_p041", "pg057_p042", "pg057_p043"],
  "page 57 must narrate only the example text and its coherent steps, scores, and solution"
);

const page58 = read("pg058_sec001.html");
const page58Questions = "Question 1. Name the tools used to play this game. Question 2. How many faces does a die have? Question 3. What is the largest number of dots on a die? Question 4. What is the smallest number of dots on a die? Question 5. What is the smallest number in the game? Question 6. What is the largest number in the game? Question 7. How many steps are there before the number 210 in the game? Question 8. Asha and Anna each rolled a die once. Both of their marbles were at 407. Asha got 2 dots and Anna got 4 dots. Who moved her marble up to number 501?";
const page58Example = "A fisherman caught 112 fish in the morning. He then caught 210 fish in the afternoon. How many fish did he catch?";
for (const [id, expected, filename] of [
  ["pg058_p025", page58Questions, "pg058_p025_adt_questions.mp3"],
  ["pg058_p026", page58Example, "pg058_p026_adt_example.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 58 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.match(page58, /data-id="pg058_p025"[\s\S]*data-id="pg058_p004"/, "the consolidated questions must precede their visual fragments");
assert.match(page58, /data-id="pg058_p019"[\s\S]*data-id="pg058_p026"[\s\S]*data-id="pg058_p020"/, "the example heading must precede its consolidated problem narration");
assert.match(page58, /one or more sentences\./, "the word-problem definition must be grammatical");
assert.equal(audios.pg058_p001, "pg058_p001.mp3", "the Questions heading must be narrated");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg058_")).sort(),
  ["pg058_p001", "pg058_p002", "pg058_p016", "pg058_p017", "pg058_p019", "pg058_p025", "pg058_p026"],
  "page 58 must narrate each question and example exactly once"
);

const page59 = read("pg059_sec001.html");
const page59Solution = "Solution. Number of fish caught in the morning is 112. Number of fish caught in the evening is 210. Add the numbers vertically. 112 plus 210 equals 322. Steps. Step 1. Add the ones. 2 plus 0 equals 2. Write 2 in the ones place. Step 2. Add the tens. 1 plus 1 equals 2. Write 2 in the tens place. Step 3. Add the hundreds. 1 plus 2 equals 3. Write 3 in the hundreds place. Therefore, a fisherman caught 322 fish.";
const page59Example = "Example 2. A grandfather has 389 mango trees. A grandmother has 433 mango trees. How many mango trees do they both have? Solution. Grandfather's mango trees equal 389. Grandmother's mango trees equal 433.";
for (const [id, expected, filename] of [
  ["pg059_p053", page59Solution, "pg059_p053_adt_solution.mp3"],
  ["pg059_p054", page59Example, "pg059_p054_adt_example.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 59 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.match(page59, /data-id="pg059_p053"[\s\S]*data-id="pg059_p001"/, "the consolidated solution must precede its visual fragments");
assert.match(page59, /data-id="pg059_p054"[\s\S]*data-id="pg059_p044"/, "the consolidated second example must precede its visual fragments");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg059_")).sort(),
  ["pg059_p053", "pg059_p054"],
  "page 59 must narrate its solution and second example exactly once"
);

const page60 = read("pg060_sec001.html");
const page60Solution = "Add the numbers vertically. 389 plus 433 equals 822. Steps. Step 1. Add the ones. 9 plus 3 equals 12. Regroup 12 ones into 1 ten and 2 ones. Write 2 in the ones place. Take 1 ten to the tens place. Step 2. Add the tens. 1 plus 8 plus 3 equals 12. Regroup 12 tens into 100 and 2 tens. Write 2 in the tens place. Take 100 to the hundreds place. Step 3. Add the hundreds. 1 plus 3 plus 4 equals 8. Write 8 in the hundreds place. Therefore, they have 822 mango trees.";
assert.equal(texts.pg060_p051, page60Solution, "page 60 must narrate the complete vertical addition coherently");
assert.equal(audios.pg060_p051, "pg060_p051_adt_solution.mp3", "page 60 must use corrected ADT narration");
assert.deepEqual(timecodes.pg060_p051.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(page60Solution), "page 60 must retain real word-level timing");
assert.match(page60, /data-id="pg060_p051"[\s\S]*data-id="pg060_p001"/, "the consolidated solution must precede its visual fragments");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg060_")).sort(),
  ["pg060_p051"],
  "page 60 must narrate its complete solution exactly once"
);

const page61 = read("pg061_sec001.html");
const page61Questions = "Question 1. One family had 130 goats. Another family had 110 goats. How many goats did the two families have? Question 2. A farmer planted 403 orange seedlings. She then planted 592 guava seedlings. How many seedlings did she plant altogether? Question 3. In a certain primary school, 372 pupils participated in sports. They were joined by 527 fellow pupils. How many pupils participated in the sports altogether? Question 4. A primary school bought 601 sports uniforms. Later, the school bought 326 more sports uniforms. How many sports uniforms did the school buy? Question 5. A training in environmental care was attended by 294 girls and 312 boys. How many people attended the training? Question 6. A school bought 333 desks. Later, the school bought another 426 desks. How many desks did the school buy? Question 7. Standard One pupils were given 350 pencils after passing an examination. Standard Two pupils were given 520 pencils after passing their examination. How many pencils were given to the two classes?";
assert.equal(texts.pg061_p030, page61Questions, "page 61 must narrate all seven questions coherently");
assert.equal(audios.pg061_p030, "pg061_p030_adt_questions.mp3", "page 61 must use corrected ADT narration");
assert.deepEqual(timecodes.pg061_p030.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(page61Questions), "page 61 must retain real word-level timing");
assert.equal(texts.pg061_im001, "", "the duplicate Exercise 11 image label must have no narration");
assert.match(page61, /data-id="pg061_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the duplicate Exercise 11 image label must be decorative");
assert.match(page61, /data-id="pg061_p030"[\s\S]*data-id="pg061_p003"/, "the consolidated questions must precede their visual fragments");
assert.deepEqual(
  Object.keys(audios).filter((id) => id.startsWith("pg061_")).sort(),
  ["pg061_p001", "pg061_p002", "pg061_p030"],
  "page 61 must narrate its title, instruction, and questions exactly once"
);

const hash = (filename) => createHash("sha256").update(readFileSync(new URL(`content/i18n/en-GB/audio/${filename}`, root))).digest("hex");
const oneSource = hash(audios.pg028_p008);
const threeSource = hash(audios.pg014_p014);
for (const [id, source] of [
  ["pg014_p004", oneSource], ["pg016_p012", oneSource],
  ["pg028_p011", threeSource]
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

console.log(`pg009-pg061 read-aloud regression: ${passageCount} passages and ${tokenCount} printed tokens verified`);
