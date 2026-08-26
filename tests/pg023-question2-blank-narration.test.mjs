import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const page = fs.readFileSync(path.join(root, "pg023_sec001.html"), "utf8");
const expectedAudio = {
  pg023_p005: "pg023_hundreds_blank_male_free_tts.mp3",
  pg023_p006: "pg023_tens_blank_male_free_tts.mp3",
  pg023_p007: "pg023_ones_blank_male_free_tts.mp3",
  pg023_p008: "pg023_total_words_blank_male_free_tts.mp3",
};

test("page 23 question 2 neutrally describes every answer line", () => {
  for (const [id, filename] of Object.entries(expectedAudio)) {
    assert.match(texts[id], /^_+$/, `${id} must remain a printed answer line`);
    assert.equal(audios[id], filename);
    assert.ok(fs.statSync(path.join(root, "content/i18n/en-GB/audio", filename)).size > 15_000);
    assert.equal(timecodes[id].timecodes[1].word_timestamps[0].text, texts[id]);
  }
});

test("page 23 question 2 reads each heading, picture, and answer line together", () => {
  const expectedOrder = [
    "pg023_p001",
    "pg023_p002", "pg023_im002", "pg023_p005",
    "pg023_p003", "pg023_im003", "pg023_p006",
    "pg023_p004", "pg023_im001", "pg023_p007",
    "pg023_p008", "pg023_p009",
  ];
  const positions = expectedOrder.map((id) => page.lastIndexOf(`"${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
