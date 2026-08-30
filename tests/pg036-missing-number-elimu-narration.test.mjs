import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const page = read("pg036_sec001.html");
const bridge = read("assets/read-aloud-highlight-bridge.js");
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const ids = Array.from({ length: 8 }, (_, index) => `pg036_p${String(index + 86).padStart(3, "0")}`);
const filename = "pg036_missing_number_elimu_neural.mp3";
const tokens = (value) => value.match(/[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*/gu) ?? [];

test("all eight question 1 blanks use the ElimuNeural missing-number clip", () => {
  for (const id of ids) {
    assert.equal(texts[id], "missing number");
    assert.equal(audios[id], filename);
    assert.deepEqual(timecodes[id].timecodes[1].word_timestamps, [
      { text: "missing", start: 0.1, end: 0.475 },
      { text: "number", start: 0.537, end: 0.875 }
    ]);
    assert.equal((page.match(new RegExp(`data-id="${id}"`, "g")) ?? []).length, 1);
  }
  assert.ok(fs.statSync(path.join(root, "content/i18n/en-GB/audio", filename)).size > 10_000);
});

test("blank narration remains in row-major reading order", () => {
  const order = [...page.matchAll(/data-id="(pg036_p\d{3})"/g)].map((match) => match[1]);
  const expected = [
    ["pg036_p004", "pg036_p086", "pg036_p005"],
    ["pg036_p007", "pg036_p087", "pg036_p008"],
    ["pg036_p012", "pg036_p088", "pg036_p013"],
    ["pg036_p014", "pg036_p089", "pg036_p015"],
    ["pg036_p016", "pg036_p090", "pg036_p017"],
    ["pg036_p022", "pg036_p091", "pg036_p023"],
    ["pg036_p026", "pg036_p092"],
    ["pg036_p027", "pg036_p093", "pg036_p028"]
  ];
  for (const sequence of expected) {
    const positions = sequence.map((id) => order.indexOf(id));
    assert.ok(positions.every((position, index) => index === 0 || position > positions[index - 1]), sequence.join(" → "));
  }
});

test("the highlight bridge targets each blank table cell", () => {
  assert.match(bridge, /pg036_p\(\?:086\|087\|088\|089\|090\|091\|092\|093\)/);
  assert.match(bridge, /blankCell = source\.closest\("td"\)/);
  assert.match(bridge, /new Array\(narration\.length\)\.fill\(blankCell\)/);
});

test("question 3 identifies both empty cells as column-specific blanks with ElimuNeural", () => {
  const rows = {
    pg036_p076: "Two hundred and twenty-nine. Blank in the hundreds column. Two is in the tens column. Blank in the ones column.",
    pg036_p077: "Three hundred and sixty-eight. Three is in the hundreds column. Blank in the tens column. Blank in the ones column.",
    pg036_p078: "Eight hundred and seventy-six. Blank in the hundreds column. Blank in the tens column. Six is in the ones column.",
    pg036_p079: "Five hundred and sixty-nine. Blank in the hundreds column. Six is in the tens column. Blank in the ones column.",
    pg036_p080: "Nine hundred and ninety-seven. Nine is in the hundreds column. Blank in the tens column. Blank in the ones column."
  };
  for (const [id, expected] of Object.entries(rows)) {
    assert.equal(texts[id], expected);
    assert.equal((expected.match(/Blank/g) ?? []).length, 2);
    assert.equal(audios[id], `${id}_elimu_missing.mp3`);
    assert.ok(fs.statSync(path.join(root, "content/i18n/en-GB/audio", audios[id])).size > 50_000);
    const stamps = timecodes[id].timecodes[1].word_timestamps;
    assert.deepEqual(stamps.map(({ text }) => text), tokens(expected));
    assert.ok(stamps.every((stamp, index) => stamp.end > stamp.start && (!index || stamp.start >= stamps[index - 1].end)));
  }
});

test("question 3 mapping advances through hundreds, tens, and ones cells", () => {
  assert.match(bridge, /printedNumber && index < 4/);
  assert.match(bridge, /var cellCursor = 1/);
  assert.match(bridge, /word === "blank" && cellCursor < cells\.length/);
  assert.match(bridge, /blankTarget = row\.cells\[cellCursor\]/);
  assert.match(bridge, /cellCursor \+= 1/);
  assert.match(bridge, /word === "hundreds"\) lastPlaceHeader = headers\[1\]/);
  assert.match(bridge, /word === "tens"\) lastPlaceHeader = headers\[2\]/);
  assert.match(bridge, /word === "ones"\) lastPlaceHeader = headers\[3\]/);
});

test("question 4 identifies the answer cell as a blank in the number column", () => {
  const rows = {
    pg036_p081: "One is in the hundreds column, one is in the tens column, and nine is in the ones column. Blank in the number column.",
    pg036_p082: "Eight is in the hundreds column, two is in the tens column, and seven is in the ones column. Blank in the number column.",
    pg036_p083: "Two is in the hundreds column, six is in the tens column, and three is in the ones column. Blank in the number column.",
    pg036_p084: "Six is in the hundreds column, one is in the tens column, and zero is in the ones column. Blank in the number column.",
    pg036_p085: "Three is in the hundreds column, three is in the tens column, and three is in the ones column. Blank in the number column."
  };
  for (const [id, expected] of Object.entries(rows)) {
    assert.equal(texts[id], expected);
    assert.equal(audios[id], `${id}_elimu_blank.mp3`);
    assert.ok(fs.statSync(path.join(root, "content/i18n/en-GB/audio", audios[id])).size > 40_000);
    const stamps = timecodes[id].timecodes[1].word_timestamps;
    assert.deepEqual(stamps.map(({ text }) => text), tokens(expected));
    assert.ok(stamps.every((stamp, index) => stamp.end > stamp.start && (!index || stamp.start >= stamps[index - 1].end)));
  }
  assert.match(bridge, /word === "blank"\) return row\.cells\[3\]/);
  assert.match(bridge, /word === "number"\) lastHeader = headers\[3\]/);
});
