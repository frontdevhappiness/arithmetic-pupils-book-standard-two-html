import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const page = fs.readFileSync(path.join(root, "pg031_sec001.html"), "utf8");
const bridge = fs.readFileSync(path.join(root, "assets/read-aloud-highlight-bridge.js"), "utf8");
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const answerIds = ["pg031_p007", "pg031_p009", "pg031_p011", "pg031_p013", "pg031_p015"];

test("page 31 narrates and highlights each unanswered abacus item", () => {
  const filename = "pg031_answer_blank_elimu_neural.mp3";
  const audio = path.join(root, "content/i18n/en-GB/audio", filename);
  assert.ok(fs.statSync(audio).size > 10_000);
  assert.match(bridge, /buildPage31AnswerBlankMap/);

  for (const id of answerIds) {
    assert.equal(texts[id], "answer blank");
    assert.equal(audios[id], filename);
    assert.match(page, new RegExp(`class="narration-only" data-id="${id}">answer blank<`));
    assert.match(page, new RegExp(`class="abacus-answer" data-answer-for="${id}" aria-hidden="true"><`));
    assert.deepEqual(timecodes[id]?.timecodes?.[1]?.word_timestamps.map(({ text }) => text), ["answer", "blank"]);
  }
});

test("each unanswered item has one visible blank and follows its abacus description", () => {
  assert.doesNotMatch(page, />_+</);
  assert.equal((page.match(/data-answer-for="pg031_p0(?:07|09|11|13|15)"/g) || []).length, 5);

  const order = [
    "pg031_im001", "pg031_p005",
    "pg031_im002", "pg031_p007",
    "pg031_im003", "pg031_p009",
    "pg031_im004", "pg031_p011",
    "pg031_im005", "pg031_p013",
    "pg031_im006", "pg031_p015"
  ];
  const positions = order.map((id) => page.indexOf(`data-id="${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
