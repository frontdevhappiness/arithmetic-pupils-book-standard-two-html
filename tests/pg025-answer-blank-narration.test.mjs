import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const page = fs.readFileSync(path.join(root, "pg025_sec001.html"), "utf8");
const bridge = fs.readFileSync(path.join(root, "assets/read-aloud-highlight-bridge.js"), "utf8");
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const answerIds = ["pg025_p005", "pg025_p007", "pg025_p009", "pg025_p011", "pg025_p013", "pg025_p015"];

test("page 25 narrates and highlights every visible answer space", () => {
  const audio = path.join(root, "content/i18n/en-GB/audio/pg025_answer_blank_space_elimu_neural.mp3");
  assert.ok(fs.statSync(audio).size > 10_000);
  assert.match(bridge, /buildPage25AnswerBlankMap/);

  for (const id of answerIds) {
    assert.equal(texts[id], "answer blank space");
    assert.equal(audios[id], "pg025_answer_blank_space_elimu_neural.mp3");
    assert.match(page, new RegExp(`class="answer-narration narration-only" data-id="${id}">answer blank space<`));
    assert.match(page, new RegExp(`class="answer-line" data-answer-for="${id}" aria-hidden="true">_+<`));
    const stamps = timecodes[id]?.timecodes?.[1]?.word_timestamps;
    assert.deepEqual(stamps?.map(({ text }) => text), ["answer", "blank", "space"]);
    assert.ok(stamps.every((stamp, index) => stamp.start >= 0 && stamp.end > stamp.start && (!index || stamp.start >= stamps[index - 1].end)));
  }
});

test("each frame is followed by its corresponding answer space in narration order", () => {
  const order = [
    "pg025_im001", "pg025_p005", "pg025_im002", "pg025_p007",
    "pg025_im003", "pg025_p009", "pg025_im004", "pg025_p011",
    "pg025_im005", "pg025_p013", "pg025_im006", "pg025_p015"
  ];
  const positions = order.map((id) => page.indexOf(`data-id="${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
