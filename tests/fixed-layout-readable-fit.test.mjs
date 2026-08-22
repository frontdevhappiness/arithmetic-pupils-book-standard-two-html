import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const fitter = read("assets/auto-fit.js");

for (let pageNumber = 1; pageNumber <= 144; pageNumber += 1) {
  const filename = pageNumber === 1
    ? "index.html"
    : `pg${String(pageNumber).padStart(3, "0")}_sec001.html`;
  const page = read(filename);
  assert.match(page, /data-fl-reference-width="558"/, `${filename} must expose its fixed-layout width`);
  assert.match(page, /<script src="\.\/assets\/auto-fit\.js"><\/script>/, `${filename} must load the shared readable-page fitter`);
}

assert.match(fitter, /originalFit \* 1\.2/, "desktop pages must grow 20% beyond whole-page fit");
assert.match(fitter, /Math\.min\(2\.4, widthScale, originalFit \* 1\.2\)/, "enlargement must remain bounded and fit the viewport width");
assert.match(fitter, /overflowY = "auto"/, "enlarged pages must scroll vertically");
assert.match(fitter, /overflowX = "hidden"/, "fixed-layout pages must not scroll horizontally");
assert.match(fitter, /transformOrigin = "top center"/, "enlarged pages must stay centred without clipping their top edge");
assert.match(fitter, /scaledHeight \+ dock \+ 12/, "document height must include the whole enlarged page and reader dock");
assert.match(fitter, /adt:dock-resize/, "page fitting must respond to dock height changes");

console.log("Readable fixed-layout sizing verified across 144 pages.");
