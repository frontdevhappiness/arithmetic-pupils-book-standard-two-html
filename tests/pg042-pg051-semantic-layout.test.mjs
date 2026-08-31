import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const css = fs.readFileSync(new URL("assets/semantic-pages-042-051.css", root), "utf8");
const highlightBridge = fs.readFileSync(new URL("assets/read-aloud-highlight-bridge.js", root), "utf8");
const texts = JSON.parse(fs.readFileSync(new URL("content/i18n/en-GB/texts.json", root), "utf8"));
const audios = JSON.parse(fs.readFileSync(new URL("content/i18n/en-GB/audios.json", root), "utf8"));
const timecodes = JSON.parse(fs.readFileSync(new URL("content/i18n/en-GB/timecode/timecode_output.json", root), "utf8"));
const offlineSource = fs.readFileSync(new URL("assets/offline-data.js", root), "utf8");
const offlinePrefix = "  var INLINE = ";
const offlineStart = offlineSource.indexOf(offlinePrefix) + offlinePrefix.length;
const offlineEnd = offlineSource.indexOf(";\n  var BASE_DIR", offlineStart);
const offline = JSON.parse(offlineSource.slice(offlineStart, offlineEnd));

function page(number) {
  const file = `pg${String(number).padStart(3, "0")}_sec001.html`;
  return { file, html: fs.readFileSync(new URL(file, root), "utf8") };
}

function idsIn(html) {
  return [...html.matchAll(/data-id="([^"]+)"/g)].map((match) => match[1]);
}

test("pages 42 to 51 use the shared responsive Sassoon layout", () => {
  for (let number = 42; number <= 51; number += 1) {
    const { html } = page(number);
    assert.match(html, /width=device-width/);
    assert.match(html, /semantic-pages-042-051\.css/);
    assert.match(html, /class="book-page/);
    assert.doesNotMatch(html, /page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
  }
  assert.match(css, /font-family:"Sassoon Primary Std"/);
  assert.match(css, /\.question-number \{ color:var\(--exercise-blue\)!important/);
});

test("each rebuilt page retains every original ID exactly once", () => {
  for (let number = 42; number <= 51; number += 1) {
    const { file, html } = page(number);
    const ids = idsIn(html);
    const original = execFileSync("git", ["show", `HEAD:${file}`], {
      cwd: new URL(".", root), encoding: "utf8",
    });
    const prefix = `pg${String(number).padStart(3, "0")}_`;
    const originalIds = new Set(idsIn(original).filter((id) => id.startsWith(prefix)));
    assert.ok(ids.length > 0, `${file} has no localization IDs`);
    assert.equal(new Set(ids).size, ids.length, `${file} contains duplicate localization IDs`);
    for (const id of originalIds) assert.ok(ids.includes(id), `${file} lost ${id}`);
    assert.match(html, /base\.bundle\.local\.js/);
    assert.match(html, /offline-preloader\.js/);
  }
});

test("visible read-aloud copies retain highlightable IDs", () => {
  for (const number of [42, 43, 49, 50]) {
    assert.match(page(number).html, /class="highlight-copy" data-id="pg\d{3}_p\d{3}"/);
  }
  assert.match(css, /\.highlight-copy \[data-word-index\]\.bg-yellow-300/);
  assert.match(css, /background:rgba\(253,224,71,\.48\)!important/);
});

test("page 42 questions use the same solid yellow highlight as the exercise heading", () => {
  assert.match(css, /\[data-section-id="pg042_sec001"\] \.answer-list \.highlight-copy \[data-word-index\]\.bg-yellow-300 \{ color:#000!important; background:#fde047!important; \}/);
});

test("page 43 question numbers and words use the same solid yellow highlight as the Questions heading", () => {
  assert.match(css, /\[data-section-id="pg043_sec001"\] \.question-stack \.highlight-copy \[data-word-index\]\.bg-yellow-300 \{ color:#000!important; background:#fde047!important; \}/);
});

test("page 44 step numbers and words use the same solid yellow highlight as the Steps heading", () => {
  assert.match(css, /\[data-section-id="pg044_sec001"\] \.step-grid \.highlight-copy \[data-word-index\]\.bg-yellow-300 \{ color:#000!important; background:#fde047!important; \}/);
});

test("page 45 step numbers and words use solid yellow and Example 2 has a local solution map", () => {
  assert.match(css, /\[data-section-id="pg045_sec001"\] \.step-grid \.highlight-copy \[data-word-index\]\.bg-yellow-300 \{ color:#000!important; background:#fde047!important; \}/);
  assert.match(page(45).html, /semantic-pages-042-051\.css\?v=5/);
  assert.match(page(45).html, /read-aloud-highlight-bridge\.js\?v=24/);
  assert.match(highlightBridge, /function buildPage45SolutionMap\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg045_p025" && sourceId !== "pg045_p053"/);
  assert.match(highlightBridge, /buildPage45SolutionMap\(content, source, narration\)/);
});

test("page 46 steps use solid yellow and Exercise 3 maps every spoken sum locally", () => {
  assert.match(css, /\[data-section-id="pg046_sec001"\] \.step-grid \.highlight-copy \[data-word-index\]\.bg-yellow-300 \{ color:#000!important; background:#fde047!important; \}/);
  assert.match(page(46).html, /semantic-pages-042-051\.css\?v=6/);
  assert.match(page(46).html, /read-aloud-highlight-bridge\.js\?v=28/);
  assert.match(highlightBridge, /function buildPage46ExerciseMap\(content, source, narration\)/);
  assert.match(highlightBridge, /source\.getAttribute\("data-id"\) !== "pg046_p079"/);
  assert.match(highlightBridge, /\[data-source-id='pg046_p079'\]>span\{background:#fde047\}/);
  assert.match(highlightBridge, /mapping\[offset \+ 2\] = firstNumberRanges/);
  assert.match(highlightBridge, /var plusRange = firstRawRange\(plus\)/);
  assert.match(highlightBridge, /mapping\[offset \+ 3\] = plusRange/);
  assert.match(highlightBridge, /mapping\[offset \+ 4\] = secondNumberRanges/);
});

test("page 47 continuation and Exercise 4 map every spoken sum locally", () => {
  assert.match(page(47).html, /read-aloud-highlight-bridge\.js\?v=29/);
  assert.match(highlightBridge, /function buildPage47ExerciseMap\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg047_p171" && sourceId !== "pg047_p172"/);
  assert.match(highlightBridge, /sourceId === "pg047_p171"[\s\S]*?source\.closest\("\.continuation-card"\)[\s\S]*?source\.closest\("\.exercise-card"\)/);
  assert.match(highlightBridge, /\[data-source-id\^='pg047_p17'\]>span\{background:#fde047\}/);
  assert.match(highlightBridge, /buildPage47ExerciseMap\(content, source, narration\)/);
});

test("page 48 continuation and regrouping example use exact local highlight maps", () => {
  assert.match(page(48).html, /read-aloud-highlight-bridge\.js\?v=33/);
  assert.match(highlightBridge, /function buildPage48Map\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg048_p052" && sourceId !== "pg048_p053"/);
  assert.match(highlightBridge, /assignRange\(0, 3, rawRanges\(section\.querySelector\('\[data-id="pg048_p030"\]'\)\)\)/);
  assert.match(highlightBridge, /assignRange\(4, 4, rawRanges\(section\.querySelector\('\[data-id="pg048_p031"\]'\)\)\)/);
  assert.match(highlightBridge, /assignRange\(5, 9, rawRanges\(section\.querySelector\('\[data-id="pg048_p032"\]'\)\)\)/);
  assert.match(highlightBridge, /assignRange\(63, 74, rawRanges\(visualCopy\("pg048_p045"\)\)\)/);
  assert.match(highlightBridge, /buildPage48Map\(content, source, narration\)/);
  assert.match(texts.pg048_p053, /^167 plus 138 equals\. Solution\. 167 plus 138 equals 305\. Steps\. Step 1\./);
  assert.equal(audios.pg048_p053, "pg048_p053_adt_example_solution_steps.mp3");
  assert.deepEqual(
    timecodes.pg048_p053.timecodes[1].word_timestamps.slice(0, 12).map(({ text }) => text),
    ["167", "plus", "138", "equals", "Solution", "167", "plus", "138", "equals", "305", "Steps", "Step"],
  );
});

test("page 49 Step 3 and Exercise 5 use exact local highlight maps and reading order", () => {
  const html = page(49).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=35/);
  assert.ok(html.indexOf('data-id="pg049_p030"') < html.indexOf('data-id="pg049_p001"'));
  assert.ok(html.indexOf('data-id="pg049_p008"') < html.indexOf('data-id="pg049_p031"'));
  assert.ok(html.indexOf('data-id="pg049_p031"') < html.indexOf('class="answer-list'));
  assert.match(highlightBridge, /function buildPage49Map\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg049_p030" && sourceId !== "pg049_p031"/);
  assert.match(highlightBridge, /firstStep\.slice\(1\).*stepMap\[index \+ 2\]/);
  assert.match(highlightBridge, /questionMap\[offset\] = ranges\[0\]/);
  assert.match(highlightBridge, /questionMap\[offset \+ 5\] = ranges\[4\]/);
  assert.equal(texts.pg049_p030, "Step 3. Add hundreds: 1 plus 1 plus 1 equals 3. Write 3 in the hundreds place. Therefore, the answer is 305.");
  assert.equal(audios.pg049_p030, "pg049_p030_adt_step3_ordered.mp3");
  assert.equal(audios.pg049_p031, "pg049_p031_adt_exercise5_equals.mp3");
  assert.equal(
    timecodes.pg049_p031.timecodes[1].word_timestamps.filter(({ text }) => text === "equals").length,
    10,
  );
  assert.deepEqual(
    timecodes.pg049_p030.timecodes[1].word_timestamps.slice(-5).map(({ text }) => text),
    ["Therefore", "the", "answer", "is", "305"],
  );
});

test("page 50 question sets read equals and highlight within their own rows", () => {
  const html = page(50).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=36/);
  assert.ok(html.indexOf('data-id="pg050_p068"') < html.indexOf('data-id="pg050_p001"'));
  assert.ok(html.indexOf('data-id="pg050_p021"') < html.indexOf('data-id="pg050_p069"'));
  assert.ok(html.indexOf('data-id="pg050_p069"') < html.indexOf('data-id="pg050_p022"'));
  assert.match(highlightBridge, /function buildPage50Map\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg050_p068" && sourceId !== "pg050_p069"/);
  assert.match(highlightBridge, /mapping\[offset \+ 5\] = ranges\[4\]/);
  assert.equal(audios.pg050_p068, "pg050_p068_adt_questions11to20_equals.mp3");
  assert.equal(audios.pg050_p069, "pg050_p069_adt_exercise6_equals.mp3");
  assert.equal(timecodes.pg050_p068.timecodes[1].word_timestamps.filter(({ text }) => text === "equals").length, 10);
  assert.equal(timecodes.pg050_p069.timecodes[1].word_timestamps.filter(({ text }) => text === "equals").length, 20);
});

test("page 51 solution narration precedes its visuals and uses an exact worked-example map", () => {
  const html = page(51).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=39/);
  assert.ok(html.indexOf('data-id="pg051_p002"') < html.indexOf('data-id="pg051_p061"'));
  assert.ok(html.indexOf('data-id="pg051_p061"') < html.indexOf('class="solution-pair"'));
  assert.match(highlightBridge, /function buildPage51Map\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg051_p060" && sourceId !== "pg051_p061"/);
  assert.match(highlightBridge, /instructionMap\.fill\(equationParts\[0\], 1, 5\)/);
  assert.match(highlightBridge, /instructionMap\[5\] = equationParts\[1\]/);
  assert.match(highlightBridge, /instructionMap\.fill\(equationParts\[2\], 6, 10\)/);
  assert.match(highlightBridge, /mapping\[0\] = solutionHeading\[0\]/);
  assert.match(highlightBridge, /assign\(82, stepOne\)/);
  assert.match(highlightBridge, /assign\(113, stepTwo\)/);
  assert.match(highlightBridge, /assign\(130, stepThree\)/);
  assert.match(highlightBridge, /fill\(148, 151, conclusion\[4\]\)/);
  assert.equal(audios.pg051_p002, undefined);
  assert.equal(audios.pg051_p061, "pg051_p061_adt_solution_heading_worked.mp3");
  assert.equal(timecodes.pg051_p061.timecodes[1].word_timestamps[0].text, "Solution");
  assert.equal(texts.pg051_p022, "Regroup 12 ones into 1 ten and 2 ones.");
  assert.equal(texts.pg051_p024, "Write 2 in the ones place. Take 1 ten to the tens place.");
  assert.equal(texts.pg051_p035, "2. Add tens: 1 + 6 + 2 = 9.");
});

test("page 52 instruction and worked solution use exact local highlight maps", () => {
  const html = page(52).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=40/);
  assert.match(highlightBridge, /function buildPage52Map\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg052_p065" && sourceId !== "pg052_p066"/);
  assert.match(highlightBridge, /instructionMap\.fill\(equation\[0\], 1, 5\)/);
  assert.match(highlightBridge, /assign\(81, stepOne\)/);
  assert.match(highlightBridge, /assign\(112, stepTwo\)/);
  assert.match(highlightBridge, /assign\(145, stepThree\)/);
  assert.match(highlightBridge, /fill\(165, 168, conclusion\[4\]\)/);
  assert.equal(timecodes.pg052_p065.timecodes[1].word_timestamps.length, 11);
  assert.equal(timecodes.pg052_p066.timecodes[1].word_timestamps.length, 169);
});

test("page 53 Exercise 8 maps each narrated sum to its own row", () => {
  const html = page(53).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=42/);
  assert.match(highlightBridge, /function buildPage53Exercise8Map\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg053_p119" && sourceId !== "pg053_p120" && sourceId !== "pg053_p148"/);
  assert.match(highlightBridge, /narration\.length === 2 && heading\.length === 2/);
  assert.match(highlightBridge, /narration\.length === 6 && instruction\.length === 6/);
  assert.match(highlightBridge, /var offset = rowIndex \* 5/);
  assert.match(highlightBridge, /mapping\[offset \+ 4\] = ranges\[3\]/);
  assert.equal(timecodes.pg053_p148.timecodes[1].word_timestamps.length, 15);
  assert.equal(timecodes.pg053_p119.timecodes[1].word_timestamps.length, 2);
  assert.equal(timecodes.pg053_p120.timecodes[1].word_timestamps.length, 6);
});

test("page 54 chart narration maps repeated values to exact table cells", () => {
  const html = page(54).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=43/);
  assert.match(highlightBridge, /function buildPage54ChartMap\(content, source, narration\)/);
  assert.match(highlightBridge, /sourceId !== "pg054_p137" && sourceId !== "pg054_p138"/);
  assert.match(highlightBridge, /var offset = 21 \+ rowIndex \* 11/);
  assert.match(highlightBridge, /mapping\[offset \+ 10\] = valueRows\[rowIndex\]\[4\]/);
  assert.match(highlightBridge, /narration\.length === 52 && explanation\.length === 52/);
  assert.equal(timecodes.pg054_p137.timecodes[1].word_timestamps.length, 76);
  assert.equal(timecodes.pg054_p138.timecodes[1].word_timestamps.length, 52);
});

test("page 55 maps all narration to its local chart, questions, and sequences", () => {
  const html = page(55).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=45/);
  assert.match(highlightBridge, /function buildPage55Map\(content, source, narration\)/);
  assert.match(highlightBridge, /var supported = \["pg055_p001", "pg055_p002", "pg055_p023", "pg055_p024", "pg055_p041", "pg055_p042", "pg055_p043"\]/);
  assert.match(highlightBridge, /function mapQuestionRows\(rows\)/);
  assert.match(highlightBridge, /if \(narration\.length !== 57\) return null/);
  assert.match(highlightBridge, /sequenceMap\[sequenceCursor \+ 5\] = blanks\[0\]/);
  assert.match(highlightBridge, /sequenceMap\[sequenceCursor \+ 8\] = blanks\[2\]/);
  assert.match(highlightBridge, /mapping\[32\] = firstShown/);
  assert.match(highlightBridge, /mapping\[38\] = secondShown/);
  for (const [id, length] of [["pg055_p001", 2], ["pg055_p002", 8], ["pg055_p023", 2], ["pg055_p024", 5], ["pg055_p041", 44], ["pg055_p042", 48], ["pg055_p043", 57]]) {
    assert.equal(timecodes[id].timecodes[1].word_timestamps.length, length);
  }
  assert.equal(timecodes.pg055_p043.timecodes[1].word_timestamps.filter(({ text }) => text === "blank").length, 21);
  assert.equal(audios.pg055_p043, "pg055_p043_adt_sequences_with_blanks.mp3");
});

test("page 56 narrates and maps every missing-number blank", () => {
  const html = page(56).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=46/);
  assert.match(highlightBridge, /function buildPage56SequenceMap\(content, source, narration\)/);
  assert.match(highlightBridge, /source\.getAttribute\("data-id"\) !== "pg056_p018" \|\| narration\.length !== 25/);
  assert.match(highlightBridge, /mapping\[cursor \+ 5\] = blanks\[0\]/);
  assert.match(highlightBridge, /mapping\[cursor \+ 8\] = blanks\[2\]/);
  assert.equal(timecodes.pg056_p018.timecodes[1].word_timestamps.length, 25);
  assert.equal(timecodes.pg056_p018.timecodes[1].word_timestamps.filter(({ text }) => text === "blank").length, 9);
  assert.equal(audios.pg056_p018, "pg056_p018_adt_sequences_with_blanks.mp3");
});

test("page 57 maps steps, guidance, and both tables exactly", () => {
  const html = page(57).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=49/);
  assert.equal((html.match(/class="pg057-step-no"/g) || []).length, 5);
  assert.match(highlightBridge, /function buildPage57Map\(content, source, narration\)/);
  assert.match(highlightBridge, /var supported = \["pg057_p022", "pg057_p023", "pg057_p041", "pg057_p042", "pg057_p043"\]/);
  assert.match(highlightBridge, /stepMap\[cursor\] = ranges\[0\]/);
  assert.match(highlightBridge, /cellRanges\[0\]\[0\], cellRanges\[0\]\[0\], cellRanges\[0\]\[0\]/);
  assert.match(highlightBridge, /sourceId === "pg057_p022" \|\| sourceId === "pg057_p023"/);
  assert.match(highlightBridge, /if \(sourceId === "pg057_p043"\)/);
  assert.match(highlightBridge, /ashaSecond\[0\], ashaSecond\[1\], ashaTotal, ashaTotal/);
  assert.equal(timecodes.pg057_p041.timecodes[1].word_timestamps.length, 69);
  assert.equal(timecodes.pg057_p042.timecodes[1].word_timestamps.length, 18);
  assert.equal(timecodes.pg057_p043.timecodes[1].word_timestamps.length, 31);
  assert.equal(audios.pg057_p043, "pg057_p043_adt_solution_visible_total.mp3");
});

test("page 58 maps every narrated question to its own visible row", () => {
  const html = page(58).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=50/);
  assert.match(html, /class="sr-only" data-id="pg058_p025"/);
  assert.equal((html.match(/class="pg058-qno"/g) || []).length, 8);
  assert.match(highlightBridge, /function buildPage58QuestionMap\(content, source, narration\)/);
  assert.match(highlightBridge, /source\.getAttribute\("data-id"\) !== "pg058_p025" \|\| narration\.length !== 111/);
  assert.match(highlightBridge, /mapping\[cursor\] = ranges\[0\]/);
  assert.equal(timecodes.pg058_p025.timecodes[1].word_timestamps.length, 111);
});

test("page 59 keeps the introductory fish counts in the top sum", () => {
  const html = page(59).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=51/);
  assert.match(highlightBridge, /function buildPage59FishNumberMap\(content, source, narration\)/);
  assert.match(highlightBridge, /source\.getAttribute\("data-id"\) !== "pg059_p053" \|\| narration\.length !== 83/);
  assert.match(highlightBridge, /mapping\[9\] = ranges\[0\]/);
  assert.match(highlightBridge, /mapping\[18\] = ranges\[2\]/);
  assert.equal(timecodes.pg059_p053.timecodes[1].word_timestamps[9].text, "112");
  assert.equal(timecodes.pg059_p053.timecodes[1].word_timestamps[18].text, "210");
});

test("page 60 keeps all Step 2 highlights inside the second row", () => {
  const html = page(60).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=52/);
  assert.match(highlightBridge, /function buildPage60Step2Map\(content, source, narration\)/);
  assert.match(highlightBridge, /source\.getAttribute\("data-id"\) !== "pg060_p051" \|\| narration\.length !== 98/);
  assert.match(highlightBridge, /mapping\[42\] = numberRange/);
  assert.match(highlightBridge, /mapping\[58\] = \[first\[13\], first\[14\]\]/);
  assert.match(highlightBridge, /mapping\[69\] = \[second\[1\], second\[2\]\]/);
  assert.equal(timecodes.pg060_p051.timecodes[1].word_timestamps[42].text, "Step");
  assert.equal(timecodes.pg060_p051.timecodes[1].word_timestamps[73].text, "place");
});

test("page 63 maps every example token to its exact visual target", () => {
  const html = page(63).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=54/);
  assert.match(highlightBridge, /function buildPage63ExampleMap\(content, source, narration\)/);
  assert.match(highlightBridge, /source\.getAttribute\("data-id"\) !== "pg063_p036" \|\| narration\.length !== 64/);
  assert.match(highlightBridge, /content\.matches\('\[data-section-id="pg063_sec001"\]'\)/);
  assert.match(highlightBridge, /mapping\[4\] = equation\[3\]/);
  assert.match(highlightBridge, /mapPlace\(14, \[labelRanges\[2\], labelRanges\[6\], labelRanges\[10\]\], 2, 6, 10\)/);
  assert.match(highlightBridge, /mapping\[46\] = \[valueRanges\[8\], valueRanges\[9\], valueRanges\[10\]\]/);
  assert.match(highlightBridge, /mapping\[63\] = \[labelRanges\[0\], labelRanges\[4\], labelRanges\[8\]\]/);
  assert.equal(timecodes.pg063_p036.timecodes[1].word_timestamps.length, 64);
});

test("page 64 maps every step token to its exact diagram and place-value column", () => {
  const html = page(64).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=55/);
  assert.match(highlightBridge, /function buildPage64StepsMap\(content, source, narration\)/);
  assert.match(highlightBridge, /source\.getAttribute\("data-id"\) !== "pg064_p059" \|\| narration\.length !== 92/);
  assert.match(highlightBridge, /mapping\[31\] = column\(first, 2\)/);
  assert.match(highlightBridge, /mapping\[54\] = column\(second, 1\)/);
  assert.match(highlightBridge, /mapping\[81\] = \[third\.heads\[8\], third\.digits\[8\]\]/);
  assert.match(highlightBridge, /mapping\[86\] = column\(third, 2\)/);
  assert.equal(timecodes.pg064_p059.timecodes[1].word_timestamps.length, 92);
});

test("page 65 reads every equals sign and maps each equation locally", () => {
  const html = page(65).html;
  assert.match(html, /read-aloud-highlight-bridge\.js\?v=56/);
  assert.match(highlightBridge, /function buildPage65Map\(content, source, narration\)/);
  assert.match(highlightBridge, /if \(narration\.length !== 48\) return null/);
  assert.match(highlightBridge, /if \(narration\.length !== 116\) return null/);
  assert.match(highlightBridge, /exerciseMap\[start \+ 5\] = ranges\[4\]/);
  assert.equal(timecodes.pg065_p036.timecodes[1].word_timestamps[4].text, "equals");
  assert.equal(timecodes.pg065_p037.timecodes[1].word_timestamps.length, 116);
  assert.equal(timecodes.pg065_p037.timecodes[1].word_timestamps.filter(({ text }) => text === "equals").length, 18);
  assert.equal(audios.pg065_p036, "pg065_p036_adt_abacus_equals_clean.mp3");
  assert.equal(audios.pg065_p037, "pg065_p037_adt_exercise_equals_clean_trimmed.mp3");
});

test("page 66 reads every equals sign and maps each equation locally", () => {
  const page66 = page(66).html;
  const words = timecodes.pg066_p031.timecodes[1].word_timestamps;
  assert.match(page66, /read-aloud-highlight-bridge\.js\?v=23/);
  assert.match(highlightBridge, /function buildPage66Map\(content, source, narration\)/);
  assert.equal(words.length, 116);
  assert.equal(words.filter(({ text }) => text === "equals").length, 18);
  assert.equal(audios.pg066_p031, "pg066_p031_adt_exercise_equals_clean.mp3");
});

test("page 67 maps balloon values in narrated order", () => {
  const words = timecodes.pg067_p055.timecodes[1].word_timestamps.map(({ text }) => text);
  assert.equal(words.length, 45);
  assert.deepEqual([words[14], words[35], words[38], words[41]], ["300", "800", "200", "400"]);
  assert.match(highlightBridge, /function buildPage67ActivityMap\(content, source, narration\)/);
  for (const selector of ["pg067-v300", "pg067-v800", "pg067-v200", "pg067-v400"]) assert.match(highlightBridge, new RegExp(selector));
});

test("page 68 keeps Or and the counting-frame narration on stable targets", () => {
  const words = timecodes.pg068_p063.timecodes[1].word_timestamps.map(({ text }) => text);
  assert.equal(words.length, 74);
  assert.equal(words[24], "Or");
  assert.deepEqual(words.slice(25, 29), ["use", "the", "counting", "frame"]);
  assert.match(highlightBridge, /function buildPage68ExampleMap\(content, source, narration\)/);
  assert.match(highlightBridge, /mapping\[24\] = orWord/);
  assert.match(highlightBridge, /abacusIndex = 25; abacusIndex <= 68/);
});

test("page 69 maps both exercises by local question number", () => {
  const exercise4 = timecodes.pg069_p113.timecodes[1].word_timestamps.map(({ text }) => text);
  const exercise5 = timecodes.pg069_p114.timecodes[1].word_timestamps.map(({ text }) => text);
  assert.equal(exercise4.length, 53);
  assert.equal(exercise5.length, 23);
  assert.deepEqual(exercise4.slice(0, 2), ["Exercise", "4"]);
  assert.deepEqual(exercise5.slice(0, 2), ["Exercise", "5"]);
  assert.match(highlightBridge, /function buildPage69ExerciseMap\(content, source, narration\)/);
  assert.match(highlightBridge, /pg069_p113: \{ selector: "\.pg069-four", first: 1, count: 9/);
  assert.match(highlightBridge, /pg069_p114: \{ selector: "\.pg069-five", first: 1, count: 3/);
  assert.match(highlightBridge, /parseInt\(candidate\.querySelector\("\.pg069-qno"\)\.textContent, 10\) === questionNumber/);
});

test("page 70 reads equals and keeps the counting-frame narration on the abacus", () => {
  const words = timecodes.pg070_p075.timecodes[1].word_timestamps.map(({ text }) => text);
  assert.equal(words.length, 79);
  assert.deepEqual(words.slice(12, 18), ["Example", "1", "243", "minus", "127", "equals"]);
  assert.equal(audios.pg070_p075, "pg070_p075_adt_example_equals_clean.mp3");
  assert.match(highlightBridge, /function buildPage70ExampleMap\(content, source, narration\)/);
  assert.match(highlightBridge, /equationIndex = 14; equationIndex <= 17/);
  assert.match(highlightBridge, /abacusIndex = 18; abacusIndex <= 78/);
});

test("page 71 maps every spoken step and Example 2 token locally", () => {
  const steps = timecodes.pg071_p029.timecodes[1].word_timestamps.map(({ text }) => text);
  const example = timecodes.pg071_p030.timecodes[1].word_timestamps.map(({ text }) => text);
  assert.equal(steps.length, 123);
  assert.equal(example.length, 22);
  assert.deepEqual(steps.slice(67, 75), ["4", "Add", "ones", "10", "plus", "3", "equals", "13"]);
  assert.deepEqual(example.slice(0, 13), ["Example", "2", "100", "minus", "47", "Solution", "100", "minus", "47", "equals", "53", "Steps", "1"]);
  assert.match(page(71).html, /read-aloud-highlight-bridge\.js\?v=26/);
  assert.match(highlightBridge, /function buildPage71Map\(content, source, narration\)/);
  assert.match(highlightBridge, /stepStarts = \[1, 27, 48, 67, 75, 89, 103\]/);
  assert.match(page(71).html, /className='pg071-continuation-step-number'/);
  assert.match(highlightBridge, /workedEquation\.length !== 8/);
  assert.match(highlightBridge, /exampleMap\[6\] = \[workedEquation\[0\], workedEquation\[1\], workedEquation\[2\]\]/);
  assert.match(highlightBridge, /exampleMap\[8\] = \[workedEquation\[4\], workedEquation\[5\]\]/);
  assert.match(highlightBridge, /exampleMap\[11\] = stepsHeading\[0\]; exampleMap\[12\] = stepNumber\[0\]/);
});

test("page 72 maps step numbers 2 through 6 to their own rows", () => {
  const words = timecodes.pg072_p038.timecodes[1].word_timestamps.map(({ text }) => text);
  assert.equal(words.length, 105);
  assert.deepEqual([words[0], words[35], words[56], words[70], words[84]], ["2", "3", "4", "5", "6"]);
  assert.match(page(72).html, /read-aloud-highlight-bridge\.js\?v=26/);
  assert.match(highlightBridge, /function buildPage72StepsMap\(content, source, narration\)/);
  assert.match(highlightBridge, /starts = \[0, 35, 56, 70, 84\]/);
  assert.match(highlightBridge, /mapping\[first\] = number\[0\]/);
  assert.match(highlightBridge, /function buildPage72StepsMap[\s\S]*new RegExp\(WORD_PATTERN\.source, "gu"\)/);
});

test("page 73 reads equals and maps both exercises without cross-jumps", () => {
  const exercise6 = timecodes.pg073_p051.timecodes[1].word_timestamps.map(({ text }) => text);
  const exercise7a = timecodes.pg073_p052.timecodes[1].word_timestamps.map(({ text }) => text);
  const exercise7b = timecodes.pg073_p054.timecodes[1].word_timestamps.map(({ text }) => text);
  assert.equal(exercise6.filter((word) => word === "equals").length, 16);
  assert.equal(exercise7a.filter((word) => word === "equals").length, 8);
  assert.equal(exercise7b.filter((word) => word === "equals").length, 8);
  assert.equal(audios.pg073_p051, "pg073_p051_adt_exercise6_equals_clean_v2.mp3");
  assert.equal(audios.pg073_p052, "pg073_p052_adt_exercise7_part1_equals_clean_v2.mp3");
  assert.equal(audios.pg073_p054, "pg073_p054_adt_exercise7_part2_equals_clean_v2.mp3");
  assert.match(page(73).html, /read-aloud-highlight-bridge\.js\?v=27/);
  assert.match(highlightBridge, /function buildPage73ExerciseMap\(content, source, narration\)/);
  assert.match(highlightBridge, /pg073_p054: \{ card: 1, firstProblem: 8, count: 8/);
  assert.match(highlightBridge, /mapping\[start\] = ranges\[0\]/);
  assert.match(highlightBridge, /mapping\[start \+ 5\] = ranges\[4\]/);
});

test("page-specific corrected structures are present", () => {
  assert.match(page(42).html, /answer-list two-columns column-flow/);
  assert.match(page(43).html, /class="money-scene"/);
  for (const number of [44, 45, 46, 51]) assert.match(page(number).html, /class="place-sum(?:\s|")/);
  for (const number of [46, 47, 48]) assert.match(page(number).html, /class="sum-grid"|class="sum-problem"/);
  assert.match(page(49).html, /class="or-label"/);
  assert.match(page(49).html, /class="bead-frame"/);
  assert.match(page(50).html, /answer-list two-columns column-flow/);
  assert.match(page(51).html, /class="step-grid compact-sums"/);
});

test("offline copies match pages 42 to 73", () => {
  for (let number = 42; number <= 73; number += 1) {
    const { file, html } = page(number);
    assert.equal(offline[`./${file}`], html);
  }
});
