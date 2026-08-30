import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const page = fs.readFileSync(path.join(root, "pg024_sec001.html"), "utf8");

const expected = {
  pg024_p008: ["Hundreds answer blank.", "pg023_hundreds_blank_male_free_tts.mp3"],
  pg024_p009: ["Tens answer blank.", "pg023_tens_blank_male_free_tts.mp3"],
  pg024_p010: ["Ones answer blank.", "pg023_ones_blank_male_free_tts.mp3"],
  pg024_p015: ["Hundreds answer blank.", "pg023_hundreds_blank_male_free_tts.mp3"],
  pg024_p016: ["Tens answer blank.", "pg023_tens_blank_male_free_tts.mp3"],
  pg024_p017: ["Ones answer blank.", "pg023_ones_blank_male_free_tts.mp3"],
  pg024_p022: ["Hundreds answer blank.", "pg023_hundreds_blank_male_free_tts.mp3"],
  pg024_p023: ["Tens answer blank.", "pg023_tens_blank_male_free_tts.mp3"],
  pg024_p024: ["Ones answer blank.", "pg023_ones_blank_male_free_tts.mp3"]
};

test("page 24 narrates every answer blank while preserving the printed lines", () => {
  for (const [id, [label, filename]] of Object.entries(expected)) {
    assert.equal(texts[id], label, `${id} spoken phrase is incorrect`);
    assert.equal(audios[id], filename, `${id} audio mapping is incorrect`);
    assert.match(page, new RegExp(`class="answer-narration narration-only" data-id="${id}">${label}<`));
    assert.match(page, new RegExp(`class="answer-line" data-answer-for="${id}" aria-hidden="true">_+<`));
    assert.ok(fs.statSync(path.join(root, "content/i18n/en-GB/audio", filename)).size > 15_000);
    const stamps = timecodes[id]?.timecodes?.[1]?.word_timestamps;
    assert.deepEqual(stamps?.map(({ text }) => text), label.replace(/\.$/, "").split(" "));
    assert.ok(stamps.every((stamp) => stamp.start >= 0 && stamp.end > stamp.start));
  }
});

test("page 24 reads each row description before its three answer blanks", () => {
  const order = [
    "pg024_im001", "pg024_p008", "pg024_p009", "pg024_p010",
    "pg024_im002", "pg024_p015", "pg024_p016", "pg024_p017",
    "pg024_im003", "pg024_p022", "pg024_p023", "pg024_p024"
  ];
  const positions = order.map((id) => page.indexOf(`data-id="${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
