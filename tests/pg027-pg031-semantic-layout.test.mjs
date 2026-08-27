import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const texts = JSON.parse(fs.readFileSync(new URL("content/i18n/en-GB/texts.json", root), "utf8"));
const audios = JSON.parse(fs.readFileSync(new URL("content/i18n/en-GB/audios.json", root), "utf8"));
const css = fs.readFileSync(new URL("assets/semantic-pages-027-031.css", root), "utf8");
const offlineSource = fs.readFileSync(new URL("assets/offline-data.js", root), "utf8");

const prefix = "  var INLINE = ";
const suffix = ";\n  var BASE_DIR";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(suffix, start);
const offline = JSON.parse(offlineSource.slice(start, end));

function page(number) {
  const file = `pg${String(number).padStart(3, "0")}_sec001.html`;
  return { file, html: fs.readFileSync(new URL(file, root), "utf8") };
}

test("pages 27 to 31 use responsive semantic Sassoon layouts", () => {
  for (let number = 27; number <= 31; number += 1) {
    const { html } = page(number);
    assert.match(html, /width=device-width/);
    assert.match(html, /semantic-pages-027-031\.css/);
    assert.match(html, /class="book-page"/);
    assert.doesNotMatch(html, /page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
  }
  assert.match(css, /font-family: "Sassoon Primary Std"/);
  assert.match(css, /--exercise-blue: #219ade/);
  assert.match(css, /--exercise-border: #90ccee/);
  assert.match(css, /--table-blue: #31459c/);
  assert.match(css, /--ink: #231f20/);
});

test("all approved spoken IDs retain audio mappings", () => {
  const excluded = new Set([
    "pg027_p000", "pg027_p029", "pg027_p030",
    "pg028_p000", "pg028_p075", "pg028_p076",
    "pg029_p000", "pg029_im010", "pg029_p015", "pg029_p016",
    "pg030_p000", "pg030_p032", "pg030_p033",
    "pg031_p000", "pg031_p007", "pg031_p009", "pg031_p011", "pg031_p013", "pg031_p015", "pg031_p022", "pg031_p023"
  ]);
  for (let number = 27; number <= 31; number += 1) {
    const prefix = `pg${String(number).padStart(3, "0")}_`;
    for (const [id, value] of Object.entries(texts)) {
      if (!id.startsWith(prefix) || !value || excluded.has(id)) continue;
      assert.equal(typeof audios[id], "string", `${id} lost its approved audio mapping`);
    }
  }
});

test("earlier narration corrections are preserved", () => {
  assert.equal(texts.pg028_p016, "3. 0 hundreds 6 tens 9 ones =");
  assert.equal(texts.pg029_p012, "4. 3 tens 5 ones");
  assert.equal(texts.pg031_im003, "An abacus with 0 hundreds, 3 tens, and 3 ones.");
  assert.equal(texts.pg031_im005, "An abacus with 1 hundred, 3 tens, and 3 ones.");
  assert.match(page(28).html, /data-id="pg028_p016"/);
  assert.match(page(29).html, /data-id="pg029_p012"/);
  assert.match(page(31).html, /data-id="pg031_im003"/);
  assert.match(page(31).html, /data-id="pg031_im005"/);
});

test("pages 27 to 30 use the PDF-aligned fixed visual structures", () => {
  const page27 = page(27).html;
  const page28 = page(28).html;
  const page29 = page(29).html;
  const page30 = page(30).html;

  assert.match(page27, /diagram-grid continuation-grid/);
  assert.equal((page27.match(/class="place-value-row"/g) || []).length, 10);
  assert.equal((page27.match(/class="fixed-answer-line"/g) || []).length, 30);
  assert.doesNotMatch(page27, /class="value-row"/);

  assert.match(page28, /exercise-card exercise3-card/);
  assert.equal((page28.match(/class="exercise3-row"/g) || []).length, 10);
  assert.equal((page28.match(/class="fixed-answer-line"/g) || []).length, 10);

  assert.match(page29, /place-diagram no-hundreds two-digit/);
  assert.equal((page29.match(/class="diagram-question"/g) || []).length, 6);

  assert.match(page30, /diagram-grid continuation-grid/);
  assert.equal((page30.match(/class="diagram-question"/g) || []).length, 8);
  assert.equal((page30.match(/place-diagram no-hundreds two-digit/g) || []).length, 2);
  assert.equal((page30.match(/place-diagram no-hundreds no-tens one-digit/g) || []).length, 1);
});

test("page 31 keeps every question number, image description and answer line in order", () => {
  const html = page(31).html;
  const ids = [
    "pg031_p001", "pg031_p002",
    "pg031_p004", "pg031_im001", "pg031_p005",
    "pg031_p006", "pg031_im002", "pg031_p007",
    "pg031_p008", "pg031_im003", "pg031_p009",
    "pg031_p010", "pg031_im004", "pg031_p011",
    "pg031_p012", "pg031_im005", "pg031_p013",
    "pg031_p014", "pg031_im006", "pg031_p015"
  ];
  let position = -1;
  for (const id of ids) {
    const next = html.indexOf(`data-id="${id}"`);
    assert.ok(next > position, `${id} is missing or out of order`);
    position = next;
  }
});

test("offline HTML copies match all five source pages", () => {
  for (let number = 27; number <= 31; number += 1) {
    const { file, html } = page(number);
    assert.equal(offline[`./${file}`], html);
  }
});
