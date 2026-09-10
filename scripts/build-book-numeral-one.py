"""Build the plain-stroke 1 supplement. Requires fontTools; leaves the source intact."""

from pathlib import Path

from fontTools import subset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
font = TTFont(ROOT / "assets/fonts/SassoonPrimaryStd-Regular.otf")
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
one, stroke = cmap[ord("1")], cmap[ord("I")]
width = font["hmtx"][one][0]

# Sassoon's default capital I supplies the book's plain stroke. Keep U+0031,
# the original numeral's advance width and height, and all source font metadata
# except the family names (this is a distinct, single-character supplement).
stroke_bounds, one_bounds = BoundsPen(glyphs), BoundsPen(glyphs)
glyphs[stroke].draw(stroke_bounds)
glyphs[one].draw(one_bounds)
x_min, y_min, x_max, y_max = stroke_bounds.bounds
_, one_y_min, _, one_y_max = one_bounds.bounds
scale_y = (one_y_max - one_y_min) / (y_max - y_min)
shift_x = (width - (x_max - x_min)) / 2 - x_min
pen = T2CharStringPen(width, glyphs)
glyphs[stroke].draw(TransformPen(pen, (1, 0, 0, scale_y, shift_x, one_y_min - y_min * scale_y)))
top = font["CFF "].cff.topDictIndex[0]
top.CharStrings[one] = pen.getCharString(private=top.Private, globalSubrs=font["CFF "].cff.GlobalSubrs)
font["hmtx"][one] = (width, round(x_min + shift_x))

options = subset.Options()
options.layout_features = []
options.name_IDs = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[ord("1")])
subsetter.subset(font)
for name_id, value in {1: "Book Numeral One", 2: "Regular", 3: "BookNumeralOne-Regular-1", 4: "Book Numeral One Regular", 6: "BookNumeralOne-Regular"}.items():
    for record in font["name"].names:
        if record.nameID == name_id:
            record.string = value.encode(record.getEncoding())
font["CFF "].cff.fontNames = ["BookNumeralOne-Regular"]
top.FamilyName = "Book Numeral One"
top.FullName = "Book Numeral One Regular"
font.save(ROOT / "assets/book-numeral-one.otf")
