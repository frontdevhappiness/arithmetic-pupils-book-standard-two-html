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
for (let pageNumber = 9; pageNumber <= 82; pageNumber += 1) {
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

const page62 = read("pg062_sec001.html");
const page62Questions = "Question 8. A headteacher bought 150 exercise books. Later, she bought 216 more exercise books. How many exercise books did she buy altogether? Question 9. A village has 446 women and 358 men. How many people are there in the village? Question 10. A school has 590 pupils. Another school has 348 pupils. What is the total number of pupils in the two schools? Question 11. On Monday, 247 cows were sent to the open market. On Tuesday, 264 cows were sent to the open market. How many cows were sent to the open market in the two days? Question 12. A shopkeeper bought 516 eggs on the first day. He bought another 378 eggs on the second day. How many eggs did he buy in the two days? Question 13. A school shop had 464 bottles of soda. The shopkeeper added 385 more bottles of soda in the shop. How many bottles of soda are in the shop? Question 14. A primary school received a gift of 625 pencils. Later, it received 286 more pencils. How many pencils did the school get in total? Question 15. A health officer gave 766 mosquito nets to the villagers. Later, she gave 186 more mosquito nets to the villagers. How many mosquito nets did the villagers get? Question 16. One lorry carried 187 pawpaws. Another lorry carried 216 pawpaws. How many pawpaws did the two lorries carry?";
assert.equal(texts.pg062_p031, page62Questions, "page 62 must narrate questions 8 through 16 coherently");
assert.equal(audios.pg062_p031, "pg062_p031_adt_questions.mp3", "page 62 must use corrected ADT narration");
assert.deepEqual(timecodes.pg062_p031.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(page62Questions), "page 62 must retain real word-level timing");
assert.ok(page62Questions.includes("Another school has 348 pupils"), "question 10 must retain the printed value 348");
assert.equal(texts.pg062_im001, "", "the page-number crop must have no narration");
assert.match(page62, /data-id="pg062_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the page-number crop must be decorative");
assert.match(page62, /data-id="pg062_p031"[\s\S]*data-id="pg062_p001"/, "the consolidated questions must precede their visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg062_")).sort(), ["pg062_p031"], "page 62 must narrate every question exactly once");

const page63 = read("pg063_sec001.html");
const page63Intro = "Chapter Six. Subtraction. Subtracting numbers not exceeding 999. Numbers can be subtracted horizontally or vertically. Subtraction is done by considering the place value of each digit in a number. Subtracting numbers horizontally without regrouping. Numbers are subtracted starting from the right to the left.";
const page63Example = "Example. 247 minus 123. Solution. Subtract by place value, starting from the right. In the ones place, 7 minus 3 equals 4. In the tens place, 4 minus 2 equals 2. In the hundreds place, 2 minus 1 equals 1. Therefore, 247 minus 123 equals 124. The diagram uses coloured arrows to match ones with ones, tens with tens, and hundreds with hundreds.";
for (const [id, expected, filename] of [["pg063_p035", page63Intro, "pg063_p035_adt_intro.mp3"], ["pg063_p036", page63Example, "pg063_p036_adt_example.mp3"]]) {
  assert.equal(texts[id], expected, `${id} must narrate page 63 coherently`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const id of ["pg063_im001", "pg063_im002"]) {
  assert.equal(texts[id], "", `${id} duplicate composite must have no separate narration`);
  assert.match(page63, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
for (const id of ["pg063_p011", "pg063_p014", "pg063_p017"]) assert.equal(texts[id], "hundreds", `${id} must spell hundreds correctly`);
assert.doesNotMatch(page63, /hundres(?:&quot;|<)/, "page 63 must not retain the misspelling hundres");
assert.match(page63, /data-id="pg063_p035"[\s\S]*data-id="pg063_p001"/, "the chapter introduction must precede its visual fragments");
assert.match(page63, /data-id="pg063_p008"[\s\S]*data-id="pg063_p036"[\s\S]*data-id="pg063_p009"/, "the consolidated example must follow its heading");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg063_")).sort(), ["pg063_p035", "pg063_p036"], "page 63 must narrate its introduction and example exactly once");

const page64 = read("pg064_sec001.html");
const page64Steps = "Steps. Step 1. Subtract the ones. 7 minus 3 equals 4. Write 4 in the ones place. The first place value diagram shows 247 minus 123, with 4 written in the ones place. Step 2. Subtract the tens. 4 minus 2 equals 2. Write 2 in the tens place. The second diagram shows 2 tens and 4 ones in the answer. Step 3. Subtract the hundreds. 2 minus 1 equals 1. Write 1 in the hundreds place. The final diagram shows 100, 2 tens and 4 ones. Therefore, the answer is 124.";
assert.equal(texts.pg064_p059, page64Steps, "page 64 must narrate all subtraction steps in order");
assert.equal(audios.pg064_p059, "pg064_p059_adt_steps.mp3", "page 64 must use corrected ADT narration");
assert.deepEqual(timecodes.pg064_p059.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(page64Steps), "page 64 must retain real word-level timing");
assert.equal(texts.pg064_im001, "", "page 64 composite image must not duplicate the step narration");
assert.match(page64, /data-id="pg064_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "page 64 composite image must be decorative");
for (const id of ["pg064_p008", "pg064_p011", "pg064_p014", "pg064_p027", "pg064_p030", "pg064_p033", "pg064_p046", "pg064_p049", "pg064_p052"]) assert.equal(texts[id], "hundreds", `${id} must spell hundreds correctly`);
assert.doesNotMatch(page64, /hundres(?:&quot;|<)/, "page 64 must not retain the misspelling hundres");
assert.match(page64, /data-id="pg064_p059"[\s\S]*data-id="pg064_p001"/, "the ordered step narration must precede its visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg064_")).sort(), ["pg064_p059"], "page 64 must narrate its worked example exactly once");

const page65 = read("pg065_sec001.html");
const page65Abacus = "Or. 247 minus 123. The abacus has columns for hundreds, tens and ones. Crossed beads show the amount subtracted. 1 bead remains in the hundreds column, 2 beads remain in the tens column, and 4 beads remain in the ones column. Therefore, 247 minus 123 equals 124.";
const page65Exercise = "Exercise 1. Write the answer in each question. Question 1. 299 minus 133. Question 2. 795 minus 275. Question 3. 444 minus 200. Question 4. 568 minus 346. Question 5. 306 minus 204. Question 6. 597 minus 50. Question 7. 980 minus 440. Question 8. 600 minus 300. Question 9. 649 minus 48. Question 10. 937 minus 415. Question 11. 935 minus 213. Question 12. 528 minus 417. Question 13. 438 minus 216. Question 14. 287 minus 240. Question 15. 386 minus 215. Question 16. 756 minus 524. Question 17. 368 minus 118. Question 18. 999 minus 439.";
for (const [id, expected, filename] of [["pg065_p036", page65Abacus, "pg065_p036_adt_abacus.mp3"], ["pg065_p037", page65Exercise, "pg065_p037_adt_exercise.mp3"]]) {
  assert.equal(texts[id], expected, `${id} must narrate page 65 in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const id of ["pg065_im001", "pg065_im002", "pg065_im003", "pg065_im004"]) {
  assert.equal(texts[id], "", `${id} duplicate composite must have no separate narration`);
  assert.match(page65, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page65, /data-id="pg065_p036"[\s\S]*data-id="pg065_p001"/, "the abacus narration must precede its visual fragments");
assert.match(page65, /data-id="pg065_p037"[\s\S]*data-id="pg065_p004"/, "the exercise narration must precede its visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg065_")).sort(), ["pg065_p036", "pg065_p037"], "page 65 must narrate the example and exercise exactly once");

const page66 = read("pg066_sec001.html");
const page66Exercise = "Exercise 2. Write the answer in each question. Question 1. 436 minus 321. Question 2. 758 minus 643. Question 3. 239 minus 115. Question 4. 384 minus 243. Question 5. 895 minus 670. Question 6. 267 minus 145. Question 7. 530 minus 410. Question 8. 682 minus 381. Question 9. 999 minus 717. Question 10. 246 minus 123. Question 11. 896 minus 643. Question 12. 900 minus 500. Question 13. 729 minus 408. Question 14. 256 minus 113. Question 15. 446 minus 325. Question 16. 185 minus 172. Question 17. 388 minus 216. Question 18. 888 minus 283.";
const page66Activity = "Activity 1. Subtraction game. Question 1. Use the direction of the arrows to fill the missing numbers in the balloons. The diagram has six balloons connected by arrows. The left path shows 900 minus 100 equals 800. The right path shows 900 minus a missing number equals 600. The bottom row shows 800 minus a missing number equals 600.";
for (const [id, expected, filename] of [["pg066_p031", page66Exercise, "pg066_p031_adt_exercise.mp3"], ["pg066_p032", page66Activity, "pg066_p032_adt_activity.mp3"]]) {
  assert.equal(texts[id], expected, `${id} must narrate page 66 in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const id of ["pg066_im001", "pg066_im002", "pg066_im003"]) {
  assert.equal(texts[id], "", `${id} duplicate composite must have no separate narration`);
  assert.match(page66, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page66, /data-id="pg066_p031"[\s\S]*data-id="pg066_p001"/, "the exercise narration must precede its visual fragments");
assert.match(page66, /data-id="pg066_p032"[\s\S]*data-id="pg066_p021"/, "the activity narration must precede its visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg066_")).sort(), ["pg066_p031", "pg066_p032"], "page 66 must narrate the exercise and activity exactly once");

const page67 = read("pg067_sec001.html");
const page67Activity = "Question 2. Fill in the missing numbers in the balloons. The number web has 300 in the centre and six balloons around it. Starting at the upper left and moving clockwise, the outer balloons show 800, a blank, 200, a blank, 400, and a blank.";
const page67Example = "Subtracting numbers vertically without regrouping. Numbers are subtracted vertically from the right to the left. Example. 668 minus 346. Solution. 668 minus 346 equals 322. Steps. Step 1. Subtract ones. 8 minus 6 equals 2. Write 2 in the ones place. Step 2. Subtract tens. 6 minus 4 equals 2. Write 2 in the tens place.";
for (const [id, expected, filename] of [["pg067_p055", page67Activity, "pg067_p055_adt_activity.mp3"], ["pg067_p056", page67Example, "pg067_p056_adt_example.mp3"]]) {
  assert.equal(texts[id], expected, `${id} must narrate page 67 in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const id of ["pg067_im001", "pg067_im002"]) {
  assert.equal(texts[id], "", `${id} duplicate composite must have no separate narration`);
  assert.match(page67, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page67, /data-id="pg067_p055"[\s\S]*data-id="pg067_p001"/, "the balloon activity must precede its visual fragments");
assert.match(page67, /data-id="pg067_p056"[\s\S]*data-id="pg067_p002"/, "the vertical subtraction narration must precede its visual fragments");
assert.doesNotMatch(texts.pg067_p055, /equals|minus/, "the balloon activity must not reveal missing answers");
assert.doesNotMatch(texts.pg067_p056, /Step 3/, "page 67 must not narrate a third step that is not displayed");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg067_")).sort(), ["pg067_p055", "pg067_p056"], "page 67 must narrate the activity and example exactly once");

const page68 = read("pg068_sec001.html");
const page68Example = "Step 3. Subtract hundreds. 6 minus 3 equals 3. Write 3 in the hundreds place. The vertical subtraction is 668 minus 346 equals 322. Or, use the counting frame. It shows 6 counters in the hundreds column, 6 counters in the tens column, and 8 counters in the ones column. 3 hundreds, 4 tens, and 6 ones are crossed out. This leaves 3 hundreds, 2 tens, and 2 ones. Therefore, the answer is 322.";
const page68Exercise = "Exercise 3. Write the answer in each question. Question 1. 178 minus 175. Question 2. 486 minus 244. Question 3. 490 minus 250. Question 4. 478 minus 470. Question 5. 445 minus 334. Question 6. 384 minus 251.";
for (const [id, expected, filename] of [["pg068_p063", page68Example, "pg068_p063_adt_example.mp3"], ["pg068_p064", page68Exercise, "pg068_p064_adt_exercise.mp3"]]) {
  assert.equal(texts[id], expected, `${id} must narrate page 68 in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const id of ["pg068_im001", "pg068_im002"]) {
  assert.equal(texts[id], "", `${id} duplicate composite must have no separate narration`);
  assert.match(page68, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page68, /data-id="pg068_p063"[\s\S]*data-id="pg068_p001"/, "the Step 3 narration must precede its visual fragments");
assert.match(page68, /data-id="pg068_p064"[\s\S]*data-id="pg068_p015"/, "the exercise narration must precede its visual fragments");
assert.doesNotMatch(texts.pg068_p064, /equals|answer is/i, "the exercise narration must not reveal answers");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg068_")).sort(), ["pg068_p063", "pg068_p064"], "page 68 must narrate the example and exercise exactly once");

const page69 = read("pg069_sec001.html");
const page69Exercise3 = "Question 7. 287 minus 185. Question 8. 357 minus 242. Question 9. 248 minus 101.";
const page69Exercise4 = "Exercise 4. Write the answer in each question. Question 1. 815 minus 604. Question 2. 744 minus 333. Question 3. 509 minus 104. Question 4. 787 minus 645. Question 5. 812 minus 710. Question 6. 555 minus 324. Question 7. 975 minus 230. Question 8. 659 minus 548. Question 9. 758 minus 234.";
const page69Exercise5 = "Exercise 5. Write the answer in each question. Question 1. 632 minus 321. Question 2. 799 minus 566. Question 3. 431 minus 221.";
for (const [id, expected, filename] of [["pg069_p112", page69Exercise3, "pg069_p112_adt_exercise3.mp3"], ["pg069_p113", page69Exercise4, "pg069_p113_adt_exercise4.mp3"], ["pg069_p114", page69Exercise5, "pg069_p114_adt_exercise5.mp3"]]) {
  assert.equal(texts[id], expected, `${id} must narrate page 69 in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
  assert.doesNotMatch(expected, /equals|answer is/i, `${id} must not reveal answers`);
}
for (const id of ["pg069_im001", "pg069_im002", "pg069_im003"]) {
  assert.equal(texts[id], "", `${id} duplicate composite must have no separate narration`);
  assert.match(page69, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page69, /data-id="pg069_p112"[\s\S]*data-id="pg069_p001"/, "the Exercise 3 continuation must precede its visual fragments");
assert.match(page69, /data-id="pg069_p113"[\s\S]*data-id="pg069_p022"/, "the Exercise 4 narration must precede its visual fragments");
assert.match(page69, /data-id="pg069_p114"[\s\S]*data-id="pg069_p087"/, "the Exercise 5 narration must precede its visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg069_")).sort(), ["pg069_p112", "pg069_p113", "pg069_p114"], "page 69 must narrate its three exercise sections exactly once");

const page70 = read("pg070_sec001.html");
const page70Questions = "Question 4. 328 minus 215. Question 5. 776 minus 715. Question 6. 824 minus 221. Question 7. 624 minus 321. Question 8. 515 minus 102. Question 9. 345 minus 215. Question 10. 467 minus 115. Question 11. 349 minus 117. Question 12. 286 minus 123.";
const page70Example = "Subtracting numbers horizontally by regrouping. Numbers can be subtracted horizontally by regrouping. Example 1. 243 minus 127. The counting frame starts with 2 beads in the hundreds column, 4 beads in the tens column, and 3 beads in the ones column. Regroup 1 ten as 10 ones. There are now 3 tens and 13 ones. Cross out 7 ones, leaving 6. Cross out 2 tens, leaving 1. Cross out 1 hundred, leaving 1. The remaining beads show 116.";
for (const [id, expected, filename] of [["pg070_p074", page70Questions, "pg070_p074_adt_questions.mp3"], ["pg070_p075", page70Example, "pg070_p075_adt_example.mp3"]]) {
  assert.equal(texts[id], expected, `${id} must narrate page 70 in order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.doesNotMatch(texts.pg070_p074, /equals|answer is/i, "the exercise questions must not reveal answers");
for (const id of ["pg070_im001", "pg070_im002", "pg070_im003"]) {
  assert.equal(texts[id], "", `${id} duplicate composite must have no separate narration`);
  assert.match(page70, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page70, /data-id="pg070_p074"[\s\S]*data-id="pg070_p001"/, "questions 4 to 12 must precede their visual fragments");
assert.match(page70, /data-id="pg070_p075"[\s\S]*data-id="pg070_p067"/, "the regrouping example must precede its visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg070_")).sort(), ["pg070_p074", "pg070_p075"], "page 70 must narrate its questions and example exactly once");

const page71 = read("pg071_sec001.html");
const page71Steps = "Steps. 1. Put the beads in the abacus: 3 beads in the ones place, 4 beads in the tens place, and 2 beads in the hundreds place. 2. Subtract 7 beads from the ones place. It is not sufficient. There are only 3 beads in the ones place. 3. Take 1 group of tens from 4 tens. Regroup it into 10 ones. Remember that 3 tens remain. 4. Add ones: 10 plus 3 equals 13. 5. Subtract ones: 13 minus 7 equals 6. Write 6 in the ones place. 6. Subtract tens: 3 minus 2 equals 1. Write 1 in the tens place. 7. Subtract hundreds: 2 minus 1 equals 1. Write 1 in the hundreds place. Therefore, 243 minus 127 equals 116.";
const page71Example = "Example 2. 100 minus 47. Solution. 100 minus 47 equals 53. Steps. 1. Subtract ones: 0 minus 7. It is not sufficient.";
for (const [id, expected, filename] of [["pg071_p029", page71Steps, "pg071_p029_adt_exact_v5.mp3"], ["pg071_p030", page71Example, "pg071_p030_adt_exact_v2.mp3"]]) {
  assert.equal(texts[id], expected, `${id} must narrate page 71 in printed order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const id of ["pg071_im001", "pg071_im002"]) {
  assert.equal(texts[id], "", `${id} duplicate composite must have no separate narration`);
  assert.match(page71, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page71, /data-id="pg071_p029"[\s\S]*data-id="pg071_p001"/, "the seven steps must precede their visual text fragments");
assert.match(page71, /data-id="pg071_p030"[\s\S]*data-id="pg071_p018"/, "Example 2 narration must precede its visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg071_")).sort(), ["pg071_p029", "pg071_p030"], "page 71 must narrate its two sections exactly once");

const page72 = read("pg072_sec001.html");
const page72Steps = "2. Take 1 group of tens from 0 tens. It is not sufficient. Take 1 group of hundreds from 1 hundreds. Regroup it into 10 tens. Remember that 0 hundreds remained in the hundreds place. 3. Take 1 tens from 10 tens. Regroup 1 tens into 10 ones. Remember 9 tens remained in the tens place. 4. Subtract ones: 10 minus 7 equals 3. Write 3 in the ones place. 5. Subtract tens: 9 minus 4 equals 5. Write 5 in the tens place. 6. Subtract hundreds: 0 minus 0 equals 0. Leave a blank space in the hundreds place. Therefore, the answer is 53.";
assert.equal(texts.pg072_p038, page72Steps, "page 72 must preserve the printed numbered continuation exactly");
assert.equal(audios.pg072_p038, "pg072_p038_adt_exact_v1.mp3", "page 72 must use corrected ADT narration");
assert.deepEqual(timecodes.pg072_p038.timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(page72Steps), "page 72 must retain real word-level timing");
assert.equal(texts.pg072_im001, "", "the duplicate worked-example image must have no separate narration");
assert.match(page72, /data-id="pg072_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the duplicate worked-example image must be decorative");
assert.match(page72, /data-id="pg072_p038"[\s\S]*data-id="pg072_p009"/, "the corrected continuation must precede its repeated diagram fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg072_")).sort(), ["pg072_p038"], "page 72 must narrate its continuation exactly once");

const page73 = read("pg073_sec001.html");
const page73Exercise6 = "Exercise 6. Write the answer in each question. Question 1. 823 minus 147. Question 2. 295 minus 76. Question 3. 864 minus 576. Question 4. 890 minus 698. Question 5. 100 minus 21. Question 6. 640 minus 128. Question 7. 584 minus 286. Question 8. 770 minus 493. Question 9. 586 minus 138. Question 10. 654 minus 337. Question 11. 778 minus 469. Question 12. 984 minus 427. Question 13. 881 minus 457. Question 14. 456 minus 257. Question 15. 551 minus 499. Question 16. 100 minus 25.";
const page73Exercise7a = "Exercise 7. Write the answer in each question. Question 1. 764 minus 147. Question 2. 354 minus 215. Question 3. 582 minus 396. Question 4. 755 minus 267. Question 5. 633 minus 278. Question 6. 987 minus 498. Question 7. 287 minus 97. Question 8. 384 minus 295.";
const page73Exercise7b = "Question 9. 863 minus 289. Question 10. 692 minus 188. Question 11. 449 minus 187. Question 12. 249 minus 194. Question 13. 904 minus 106. Question 14. 816 minus 798. Question 15. 387 minus 197. Question 16. 100 minus 12.";
const page73Heading = "Subtracting numbers vertically by regrouping. Numbers can be subtracted vertically by regrouping.";
for (const [id, expected, filename] of [
  ["pg073_p051", page73Exercise6, "pg073_p051_adt_exercise6.mp3"],
  ["pg073_p052", page73Exercise7a, "pg073_p052_adt_exercise7_part1.mp3"],
  ["pg073_p054", page73Exercise7b, "pg073_p054_adt_exercise7_part2.mp3"],
  ["pg073_p053", page73Heading, "pg073_p053_adt_heading.mp3"]
]) {
  assert.equal(texts[id], expected, `${id} must narrate page 73 in numerical order`);
  assert.equal(audios[id], filename, `${id} must use corrected ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
assert.doesNotMatch(`${texts.pg073_p051} ${texts.pg073_p052} ${texts.pg073_p054}`, /equals/i, "page 73 must not imply or reveal blank answers");
assert.match(texts.pg073_p051, /Question 11\. 778 minus 469\./, "Exercise 6 question 11 must match the printed 778");
for (const id of ["pg073_im001", "pg073_im002"]) {
  assert.equal(texts[id], "", `${id} duplicate exercise image must have no separate narration`);
  assert.match(page73, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page73, /data-id="pg073_p051"[\s\S]*data-id="pg073_p001"/, "Exercise 6 narration must precede its visual fragments");
assert.match(page73, /data-id="pg073_p052"[\s\S]*data-id="pg073_p020"/, "Exercise 7 narration must precede its visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg073_")).sort(), ["pg073_p051", "pg073_p052", "pg073_p053", "pg073_p054"], "page 73 must narrate four ordered passages exactly once");

const page74 = read("pg074_sec001.html");
const page74Example = "Example. Three hundred and fourteen minus two hundred and eight. The numbers are arranged vertically under hundreds, tens, and ones. Solution. Three hundred and fourteen minus two hundred and eight equals one hundred and six. Steps. One. Subtract ones: four minus eight. It is not sufficient. Two. Take one group of tens from one ten. Regroup it into ten ones. Remember zero tens remain. Add ones: ten plus four equals fourteen. Three. Subtract ones: fourteen minus eight equals six. Write six in the ones place. Four. Subtract tens: zero minus zero equals zero. Write zero in the tens place. Five. Subtract hundreds: three minus two equals one. Write one in the hundreds place. Therefore, the answer is one hundred and six.";
assert.equal(texts.pg074_p078, page74Example, "page 74 must narrate the complete worked example in printed order");
assert.equal(audios.pg074_p078, "pg074_p078_adt_worked_example.mp3", "page 74 must use its corrected ADT narration");
const page74Stamps = timecodes.pg074_p078.timecodes[1].word_timestamps;
assert.equal(page74Stamps.length, 121, "page 74 must retain all 121 spoken tokens");
assert.deepEqual(page74Stamps.map(({ text: word }) => word), tokens(page74Example), "page 74 must retain measured word-level timing in narration order");
assert.match(texts.pg074_p078, /Steps\. One\.[\s\S]*Two\.[\s\S]*Three\.[\s\S]*Four\.[\s\S]*Five\./, "page 74 must announce every numbered step in order");
assert.match(texts.pg074_p078, /Therefore, the answer is one hundred and six\.$/, "page 74 must finish with the printed result");
for (const id of ["pg074_im002", "pg074_im004"]) {
  assert.equal(texts[id], "", `${id} duplicate image must have no separate narration`);
  assert.match(page74, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page74, /data-id="pg074_p078"[\s\S]*data-id="pg074_p001"/, "the ordered page 74 narration must precede its visual fragments");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg074_")).sort(), ["pg074_p078"], "page 74 must narrate one ordered passage exactly once");

const page75 = read("pg075_sec001.html");
const page75Passages = [
  ["pg075_p125", "Exercise 8. Write the answer in each question. Question 1. 564 minus 235. Question 2. 487 minus 9. Question 3. 600 minus 482. Question 4. 925 minus 688. Question 5. 841 minus 759. Question 6. 100 minus 90. Question 7. 753 minus 65. Question 8. 896 minus 618.", "pg075_p125_adt_exercise8_part1.mp3"],
  ["pg075_p126", "Question nine. Eight hundred and fifty six minus sixty seven.", "pg075_p126_adt_exercise8.mp3"],
  ["pg075_p127", "Question ten. Nine hundred and eighty two minus five hundred and ninety three.", "pg075_p127_adt_exercise8.mp3"],
  ["pg075_p128", "Question eleven. Eight hundred and ninety six minus six hundred and seventeen.", "pg075_p128_adt_exercise8.mp3"],
  ["pg075_p129", "Question twelve. Four hundred and seventy seven minus two hundred and eighty nine. Question thirteen. Eight hundred and seventy eight minus four hundred and ninety eight. Question fourteen. Nine hundred minus seven hundred and ninety eight. Question fifteen. One hundred minus nineteen.", "pg075_p129_adt_exercise8.mp3"]
];
for (const [id, expected, filename] of page75Passages) {
  assert.equal(texts[id], expected, `${id} must narrate the printed subtraction questions in order`);
  assert.equal(audios[id], filename, `${id} must use verified ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain measured word-level timing`);
}
assert.doesNotMatch(page75Passages.map(([, text]) => text).join(" "), /equals|answer is/i, "page 75 must not reveal the blank answers");
assert.equal(texts.pg075_im001, "", "the duplicate page 75 exercise image must have no separate narration");
assert.match(page75, /data-id="pg075_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the duplicate page 75 exercise image must be decorative");
assert.match(page75, /data-id="pg075_p125"[\s\S]*data-id="pg075_p126"[\s\S]*data-id="pg075_p127"[\s\S]*data-id="pg075_p128"[\s\S]*data-id="pg075_p129"[\s\S]*data-id="pg075_p001"/, "page 75 narration chunks must precede visual fragments in numerical order");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg075_")).sort(), page75Passages.map(([id]) => id), "page 75 must narrate five verified passages exactly once");

const page76 = read("pg076_sec001.html");
const page76Passages = [
  ["pg076_p114", "Exercise nine. Write the answer in each question. Question one. Nine hundred and seventy five minus six hundred and eighty nine. Question two. Six hundred and forty seven minus four hundred and twenty nine. Question three. Nine hundred and sixty eight minus five hundred and eighty nine.", "pg076_p114_adt_exercise9_part1.mp3"],
  ["pg076_p115", "Question four. Five hundred and forty eight minus two hundred and ninety nine. Question five. Seven hundred and ninety eight minus three hundred and forty nine. Question six. Seven hundred and eighty four minus four hundred and ninety five.", "pg076_p115_adt_exercise9_part2.mp3"],
  ["pg076_p116", "Question seven. Six hundred and sixty three minus four hundred and eighty seven. Question eight. Eight hundred and seventeen minus one hundred and nine. Question nine. Five hundred and seventy six minus two hundred and sixty eight.", "pg076_p116_adt_exercise9_part3.mp3"],
  ["pg076_p117", "Question ten. Seven hundred and fifty four minus two hundred and sixty nine. Question eleven. Eight hundred and seventy six minus five hundred and ninety five. Question twelve. Five hundred and eighty two minus three hundred and ninety seven.", "pg076_p117_adt_exercise9_part4.mp3"],
  ["pg076_p118", "Question thirteen. Nine hundred and seventy six minus four hundred and eighty nine. Question fourteen. Eight hundred and one minus seven hundred and seventy nine. Question fifteen. Eight hundred and sixty two minus two hundred and seventy nine.", "pg076_p118_adt_exercise9_part5.mp3"],
  ["pg076_p119", "Word problems on subtraction. Word problems involving subtraction are questions written in one or more sentence.", "pg076_p119_adt_word_problems_intro.mp3"]
];
for (const [id, expected, filename] of page76Passages) {
  assert.equal(texts[id], expected, `${id} must narrate page 76 in printed order`);
  assert.equal(audios[id], filename, `${id} must use verified ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain measured word-level timing`);
}
assert.doesNotMatch(page76Passages.slice(0, 5).map(([, text]) => text).join(" "), /equals|answer is/i, "page 76 must not reveal blank answers");
assert.equal(texts.pg076_im001, "", "the duplicate page 76 exercise image must have no separate narration");
assert.match(page76, /data-id="pg076_im001"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the duplicate page 76 exercise image must be decorative");
assert.match(page76, /data-id="pg076_p114"[\s\S]*data-id="pg076_p115"[\s\S]*data-id="pg076_p116"[\s\S]*data-id="pg076_p117"[\s\S]*data-id="pg076_p118"[\s\S]*data-id="pg076_p119"[\s\S]*data-id="pg076_p001"/, "page 76 narration chunks must precede visual fragments in order");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg076_")).sort(), page76Passages.map(([id]) => id), "page 76 must narrate six verified passages exactly once");

const page77 = read("pg077_sec001.html");
const page77Passages = [
  ["pg077_p033", "Example one. Kabula had nine hundred and fifty six sweets. She gave her sibling eight hundred and thirteen sweets. How many sweets did she remain with? Solution. Number of sweets equals nine hundred and fifty six. Number of sweets given away equals eight hundred and thirteen. Subtract: nine hundred and fifty six minus eight hundred and thirteen equals one hundred and forty three.", "pg077_p033_adt_example1_intro.mp3"],
  ["pg077_p034", "Steps. One. Subtract ones: six minus three equals three. Write three in the ones place. Nine hundred and fifty six minus eight hundred and thirteen equals three. Two. Subtract tens: five minus one equals four. Write four in the tens place. Nine hundred and fifty six minus eight hundred and thirteen equals forty three. Three. Subtract hundreds: nine minus eight equals one. Write one in the hundreds place. Nine hundred and fifty six minus eight hundred and thirteen equals one hundred and forty three. Therefore, Kabula remained with one hundred and forty three sweets.", "pg077_p034_adt_example1_steps.mp3"],
  ["pg077_p035", "Example two. A school had five hundred and forty three desks. If one hundred and twenty nine desks were damaged, how many desks were not damaged? Solution. Total number of desks equals five hundred and forty three. Number of damaged desks equals one hundred and twenty nine. Subtract: five hundred and forty three minus one hundred and twenty nine equals four hundred and fourteen. The vertical subtraction shows regrouping one ten as ten ones. Thirteen minus nine equals four. Three minus two equals one. Five minus one equals four.", "pg077_p035_adt_example2.mp3"]
];
for (const [id, expected, filename] of page77Passages) {
  assert.equal(texts[id], expected, `${id} must narrate page 77 in mathematical order`);
  assert.equal(audios[id], filename, `${id} must use verified ADT narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain measured word-level timing`);
}
for (const id of ["pg077_im001", "pg077_im002"]) {
  assert.equal(texts[id], "", `${id} duplicate image must have no separate narration`);
  assert.match(page77, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page77, /data-id="pg077_p033"[\s\S]*data-id="pg077_p034"[\s\S]*data-id="pg077_p035"[\s\S]*data-id="pg077_p001"/, "page 77 narration chunks must precede visual fragments in order");
assert.match(texts.pg077_p034, /Subtract ones:[\s\S]*Subtract tens:[\s\S]*Subtract hundreds:/, "Example 1 must narrate ones, tens, then hundreds");
assert.match(texts.pg077_p035, /Thirteen minus nine equals four[\s\S]*Three minus two equals one[\s\S]*Five minus one equals four/, "Example 2 must narrate the regrouped subtraction in column order");
assert.doesNotMatch(texts.pg077_p035, /Therefore/, "Example 2 must not add an ending that is not printed");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg077_")).sort(), page77Passages.map(([id]) => id), "page 77 must narrate three verified passages exactly once");

const page78 = read("pg078_sec001.html");
const page78Passages = [
  ["pg078_p071", "Steps. 1. Subtract ones: 3 – 9, it is not sufficient. 2. Take 1 group of tens from 4 tens. Regroup 1 tens into 10 ones. Remember that 3 tens remained in the tens place. Add ones: 10 + 3 = 13. 3. Subtract ones: 13 – 9 = 4. Write 4 in the ones place. 4. Subtract tens: 3 – 2 = 1. Write 1 in the tens place. 5. Subtract hundreds: 5 – 1 = 4. Write 4 in the hundreds place. Therefore, 414 desks were not damaged.", "pg078_p071_adt_steps.mp3"],
  ["pg078_p072", "Exercise 10. Answer the following word problems. 1. Shija had 649 eggs. If he sold 415 eggs, how many eggs were left? 2. A passenger train carried 874 pupils. On the way, 360 pupils got off the train. Find the number of", "pg078_p072_adt_exercise10_ends_of_v2.mp3"]
];
for (const [id, expected, filename] of page78Passages) {
  assert.equal(texts[id], expected, `${id} must narrate page 78 in printed order`);
  assert.equal(audios[id], filename, `${id} must use the verified page 78 narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain real word-level timing`);
}
for (const id of ["pg078_im001", "pg078_im002"]) {
  assert.equal(texts[id], "", `${id} duplicate image must have no separate narration`);
  assert.equal(audios[id], undefined, `${id} duplicate image must not repeat the page`);
  assert.match(page78, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page78, /data-id="pg078_p071"[\s\S]*data-id="pg078_p072"[\s\S]*data-id="pg078_p001"/, "page 78 narration must precede visual OCR fragments in order");
assert.match(texts.pg078_p071, /Subtract ones:[\s\S]*Take 1 group of tens[\s\S]*Subtract tens:[\s\S]*Subtract hundreds:[\s\S]*Therefore, 414 desks were not damaged/, "page 78 must explain regrouping in mathematical order");
assert.ok(texts.pg078_p072.endsWith("Find the number of"), "question 2 must stop where the printed page continues onto page 79");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg078_")).sort(), page78Passages.map(([id]) => id), "page 78 must narrate two verified passages exactly once");

const page79 = read("pg079_sec001.html");
const page79Text = "pupils who continued with the journey. 3. A teacher had 596 books. He gave out 421 books to his pupils. How many books did the teacher remain with? 4. Roza had 365 oranges. If she sold 365 oranges, how many oranges did she remain with? 5. There were 635 pencils in a shop. If 412 pencils were sold, how many pencils were left in the shop? 6. A second-hand toy vendor had 888 toys. He sold 573 toys. Find the number of toys that remained. 7. A businesswoman bought 760 bottles of juice. She sold 650 bottles. How many bottles was she left with? 8. Erika had 500 shillings for buying exercise book. If an exercise book costs 355 shillings, how much money did she remain with? 9. Some ducks laid 734 eggs. If 218 eggs were broken, how many eggs remained? 10. A flock of 500 birds landed on a tree. Some 308 birds flew away. How many birds remained on the tree? 11. Juma had 463 oranges. He sold 185 oranges. How many oranges remained? 12. In a class of 210 students, 170 students sat for an examination. How many students did not sit for the examination?";
assert.equal(texts.pg079_p029, page79Text, "page 79 must narrate the printed continuation and questions in order");
assert.equal(audios.pg079_p029, "pg079_p029_adt_questions.mp3", "page 79 must use its consolidated narration");
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg079_")).sort(), ["pg079_p029"], "page 79 must narrate its questions exactly once");
assert.match(page79, /data-id="pg079_p029"[\s\S]*data-id="pg079_p001"/, "page 79 consolidated narration must precede visual OCR fragments");
assert.match(page79, /images\/pg079_page_hq_pdf_clean\.png/, "page 79 must use the sharper watermark-free page image");
assert.ok(texts.pg078_p072.endsWith("of") && texts.pg079_p029.startsWith("pupils who"), "question 2 must continue cleanly from page 78 to page 79");

const page80 = read("pg080_sec001.html");
const page80Passages = [
  ["pg080_p020", "Chapter Seven: Multiplication. Multiplication using objects. Multiplication is a repeated addition of a number or objects. The operation of multiplication is represented by the sign ×. For example, 2 × 1 is read as, 2 multiplied by 1. It is also read as 2 times 1. Example 1. 2 × 1 =. Steps. 1. Put two cups in one group only once. This means, 2 × 1.", "pg080_p020_adt_before_cup_image.mp3"],
  ["pg080_im001", "Two cups shown side by side to represent one group of two.", "pg080_im001.mp3"],
  ["pg080_p022", "2. Add the number of cups. The sum is 2 cups. Therefore, 2 × 1 = 2.", "pg080_p022_adt_after_cup_image.mp3"],
  ["pg080_p021", "Example 2. 2 × 2 =.", "pg080_p021_adt_example2_start.mp3"]
];
for (const [id, expected, filename] of page80Passages) {
  assert.equal(texts[id], expected, `${id} must narrate page 80 in printed order`);
  assert.equal(audios[id], filename, `${id} must use the consolidated page 80 narration`);
}
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg080_")).sort(), page80Passages.map(([id]) => id).sort(), "page 80 must narrate its content exactly once");
assert.match(page80, /data-id="pg080_im001"[^>]*alt="Two cups shown side by side to represent one group of two\."/, "the cup picture must have a useful description");
assert.equal(texts.pg080_im002, "", "the duplicated chapter banner must not have separate narration");
assert.equal(audios.pg080_im002, undefined, "the duplicated chapter banner must not repeat page 80 narration");
assert.match(page80, /data-id="pg080_im002"[^>]*role="presentation"[^>]*aria-hidden="true"/, "the chapter banner extraction must be decorative");
assert.match(page80, /data-id="pg080_p020"[\s\S]*data-id="pg080_im001"[\s\S]*data-id="pg080_p022"[\s\S]*data-id="pg080_p021"[\s\S]*data-id="pg080_p000"/, "page 80 narration and cup description must follow printed reading order");
assert.match(page80, /images\/pg080_page_hq_pdf_clean\.png/, "page 80 must use the sharper watermark-free page image");

const page81 = read("pg081_sec001.html");
const page81Passages = [
  ["pg081_p036", "Solution.", "pg081_p001.mp3"],
  ["pg081_im001", "Two sticks plus two sticks equals four sticks.", "pg081_im001.mp3"],
  ["pg081_p037", "Therefore, 2 × 2 = 4. Example 3. 3 × 2 =. Solution.", "pg081_p037_adt_examples.mp3"],
  ["pg081_im002", "Three balls plus three balls equals six balls.", "pg081_im002_adt_equation.mp3"],
  ["pg081_p038", "Therefore, 3 × 2 = 6. Example 4. 4 × 3 =. Solution.", "pg081_p038_adt_example4.mp3"],
  ["pg081_im005", "Four bottle tops plus four bottle tops plus four bottle tops equals twelve bottle tops.", "pg081_im005_adt_equation.mp3"],
  ["pg081_p039", "Therefore, 4 × 3 = 12.", "pg081_p039_adt_conclusion.mp3"]
];
for (const [id, expected, filename] of page81Passages) {
  assert.equal(texts[id], expected, `${id} must narrate page 81 in printed order`);
  assert.equal(audios[id], filename, `${id} must use the consolidated page 81 narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain word-level timing`);
}
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg081_")).sort(), page81Passages.map(([id]) => id).sort(), "page 81 must narrate each passage and image exactly once");
assert.match(page81, /data-id="pg081_p036"[\s\S]*data-id="pg081_im001"[\s\S]*data-id="pg081_p037"[\s\S]*data-id="pg081_im002"[\s\S]*data-id="pg081_p038"[\s\S]*data-id="pg081_im005"[\s\S]*data-id="pg081_p039"[\s\S]*data-id="pg081_p000"/, "page 81 text and image descriptions must follow the mathematical reading order");
assert.match(page81, /alt="Three balls plus three balls equals six balls\." data-id="pg081_im002"/, "the ball picture must have a useful equation description");
assert.match(page81, /alt="Four bottle tops plus four bottle tops plus four bottle tops equals twelve bottle tops\." data-id="pg081_im005"/, "the bottle-top picture must have a useful equation description");
for (const id of ["pg081_im003", "pg081_im004", "pg081_im006", "pg081_im007", "pg081_im008"]) {
  assert.equal(texts[id], "", `${id} duplicate picture must have no narration`);
  assert.equal(audios[id], undefined, `${id} duplicate picture must not repeat page 81`);
  assert.match(page81, new RegExp(`data-id="${id}"[^>]*role="presentation"[^>]*aria-hidden="true"`), `${id} must be decorative`);
}
assert.match(page81, /images\/pg081_page_hq_pdf_clean\.png/, "page 81 must use the sharper watermark-free page image");
assert.match(texts.pg081_p038, /4 × 3/, "Example 4 must describe the three visible groups of four accurately");
assert.equal(texts.pg081_p039, "Therefore, 4 × 3 = 12.", "the final equation must be mathematically correct");

const page82 = read("pg082_sec001.html");
const page82Passages = [
  ["pg082_p001", "Exercise 1", "pg082_p001.mp3"],
  ["pg082_p002", "Use objects to multiply each of the following numbers.", "pg082_p002_adt_instruction.mp3"],
  ["pg082_p004", "1. 4 × 2. Four yellow cars plus four yellow cars.", "pg082_p004_adt_natural.mp3"],
  ["pg082_p008", "2. 6 × 3. Six pencils plus six pencils plus six pencils.", "pg082_p008_adt_natural.mp3"],
  ["pg082_p013", "3. Three bells plus three bells plus three bells.", "pg082_p013_adt_natural.mp3"],
  ["pg082_p019", "4. Five green sticks plus five green sticks plus five green sticks plus five green sticks.", "pg082_p019_adt_natural.mp3"],
  ["pg082_p026", "Multiplying using repeated addition", "pg082_p026.mp3"],
  ["pg082_p027", "Multiplication can be done using repeated addition of a number.", "pg082_p027.mp3"],
  ["pg082_im006", "Example 1. Two times four equals. Solution. Repeated addition: 2 + 2 + 2 + 2 = 8. Multiply: 2 × 4 = 8. Therefore, 2 × 4 = 8.", "pg082_im006_adt_example.mp3"]
];
for (const [id, expected, filename] of page82Passages) {
  assert.equal(texts[id], expected, `${id} must narrate page 82 in printed order`);
  assert.equal(audios[id], filename, `${id} must use the reviewed page 82 narration`);
  assert.deepEqual(timecodes[id].timecodes[1].word_timestamps.map(({ text: word }) => word), tokens(expected), `${id} must retain word-level timing`);
}
assert.deepEqual(Object.keys(audios).filter((id) => id.startsWith("pg082_")).sort(), page82Passages.map(([id]) => id).sort(), "page 82 must narrate each passage and object group exactly once");
assert.match(page82, /data-id="pg082_p001"[\s\S]*data-id="pg082_p002"[\s\S]*data-id="pg082_p004"[\s\S]*data-id="pg082_p008"[\s\S]*data-id="pg082_p013"[\s\S]*data-id="pg082_p019"[\s\S]*data-id="pg082_p026"[\s\S]*data-id="pg082_p027"[\s\S]*data-id="pg082_im006"/, "page 82 narration must follow the printed order");
for (const id of ["pg082_im001", "pg082_im002", "pg082_im003", "pg082_im004"]) {
  assert.equal(audios[id], undefined, `${id} description is included in its complete question passage and must not repeat`);
}
assert.match(page82, /images\/pg082_page_hq_pdf_clean\.png/, "page 82 must use the sharper watermark-free page image");
for (const id of ["pg082_p003", "pg082_p005", "pg082_p006", "pg082_p007", "pg082_p009", "pg082_p010", "pg082_p011", "pg082_p012", "pg082_p014", "pg082_p015", "pg082_p016", "pg082_p017", "pg082_p018", "pg082_p020", "pg082_p021", "pg082_p022", "pg082_p023", "pg082_p024", "pg082_p025", "pg082_p029", "pg082_p030", "pg082_p031", "pg082_p032", "pg082_p033", "pg082_p034"]) {
  assert.equal(texts[id], "", `${id} blank or duplicate fragment must not be narrated`);
  assert.equal(audios[id], undefined, `${id} blank or duplicate fragment must have no audio mapping`);
}

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

console.log(`pg009-pg077 read-aloud regression: ${passageCount} passages and ${tokenCount} printed tokens verified`);
