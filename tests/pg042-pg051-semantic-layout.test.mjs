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

test("offline copies match pages 42 to 51", () => {
  for (let number = 42; number <= 51; number += 1) {
    const { file, html } = page(number);
    assert.equal(offline[`./${file}`], html);
  }
});
