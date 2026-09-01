(function () {
  "use strict";

  var CONTENT_ID = "content";
  var MARKER_ID = "adt-visible-narration-highlight";
  var STYLE_ID = "adt-visible-narration-highlight-style";
  var CUSTOM_HIGHLIGHT_NAME = "adt-narration-word";
  var WORD_SELECTOR = "[data-word-index].bg-yellow-300";
  var WORD_PATTERN = /[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*|[+\-−–×÷=<>/]/gu;
  var currentSource = null;
  var currentMode = "";
  var currentMap = null;
  var scheduled = 0;

  var ORDERED_TEXT_ROOTS = {
    pg142_sec001: [
      ".pg142-banner",
      ".pg142-intro",
      ".pg142-item-one .pg142-number",
      ".pg142-item-one .pg142-caption",
      ".pg142-item-two .pg142-number",
      ".pg142-item-two .pg142-caption",
      ".pg142-item-three .pg142-number",
      ".pg142-item-three .pg142-caption",
      ".pg142-item-four .pg142-number",
      ".pg142-item-four .pg142-caption",
      ".pg142-item-five .pg142-number",
      ".pg142-item-five .pg142-caption",
      ".pg142-item-six .pg142-number",
      ".pg142-item-six .pg142-caption",
      ".pg142-prompts .pg142-prompt:nth-child(1)",
      ".pg142-prompts .pg142-prompt:nth-child(2)"
    ]
  };

  function normalizeWord(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "#" + MARKER_ID + "{position:fixed;inset:0;pointer-events:none;z-index:45}" +
      "#" + MARKER_ID + ">span{position:absolute;box-sizing:border-box;border-radius:3px;background:rgba(253,224,71,.58);mix-blend-mode:multiply}" +
      "::highlight(" + CUSTOM_HIGHLIGHT_NAME + "){background:#fde047;color:inherit}" +
      "#" + MARKER_ID + "[data-source-id^='pg036_']>span{background:#fde047}" +
      "#" + MARKER_ID + "[data-source-id='pg046_p079']>span{background:#fde047}" +
      "#" + MARKER_ID + "[data-source-id^='pg047_p17']>span{background:#fde047}" +
      "#" + MARKER_ID + "[data-source-id^='pg048_p05']>span{background:#fde047}" +
      "#" + MARKER_ID + ".adt-block-highlight>span{background:rgba(37,99,235,.10);box-shadow:inset 0 0 0 2px rgba(37,99,235,.85);mix-blend-mode:normal}";
    document.head.appendChild(style);
  }

  function getMarker() {
    ensureStyles();
    var marker = document.getElementById(MARKER_ID);
    if (!marker) {
      marker = document.createElement("div");
      marker.id = MARKER_ID;
      marker.setAttribute("aria-hidden", "true");
      document.body.appendChild(marker);
    }
    return marker;
  }

  function clearMarker() {
    if (window.CSS && CSS.highlights) CSS.highlights.delete(CUSTOM_HIGHLIGHT_NAME);
    var marker = document.getElementById(MARKER_ID);
    if (!marker) return;
    marker.replaceChildren();
    marker.removeAttribute("data-source-id");
    marker.removeAttribute("data-word-index");
    marker.removeAttribute("data-custom-highlight");
    marker.classList.remove("adt-block-highlight");
  }

  function isHiddenNarrationElement(element) {
    if (!element) return false;
    if (element.matches(".sr-only,.narration-only,[hidden]")) return true;
    if (element.closest(".sr-only,.narration-only,[hidden]")) return true;
    var style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return true;
    var rect = element.getBoundingClientRect();
    return rect.width <= 2 && rect.height <= 2 && (style.position === "absolute" || style.position === "fixed");
  }

  function findActiveNarration(content) {
    var highlightedWords = content.querySelectorAll(WORD_SELECTOR);
    for (var i = 0; i < highlightedWords.length; i += 1) {
      var source = highlightedWords[i].closest("[data-id]");
      if (source && isHiddenNarrationElement(source)) {
        return { mode: "word", source: source, word: highlightedWords[i] };
      }
    }

    var highlightedBlocks = content.querySelectorAll("[data-id].tts-active-block");
    for (var j = 0; j < highlightedBlocks.length; j += 1) {
      if (isHiddenNarrationElement(highlightedBlocks[j])) {
        return { mode: "block", source: highlightedBlocks[j], word: null };
      }
    }
    return null;
  }

  function excludedTextNode(node, content) {
    var parent = node.parentElement;
    if (!parent || !node.nodeValue || !node.nodeValue.trim()) return true;
    for (var element = parent; element && element !== content; element = element.parentElement) {
      if (element.matches("script,style,noscript,.sr-only,.narration-only,[hidden]")) return true;
      var style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return true;
    }
    return false;
  }

  function textRoots(content) {
    var section = content.querySelector("[data-section-id]");
    var selectors = section && ORDERED_TEXT_ROOTS[section.getAttribute("data-section-id")];
    if (!selectors) return [content];
    var roots = selectors.map(function (selector) {
      return section.querySelector(selector);
    }).filter(Boolean);
    return roots.length ? roots : [content];
  }

  function collectRootTokens(root, content) {
    var tokens = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (excludedTextNode(node, content)) continue;
      WORD_PATTERN.lastIndex = 0;
      var match;
      while ((match = WORD_PATTERN.exec(node.nodeValue))) {
        var normalized = normalizeWord(match[0]);
        if (!normalized) continue;
        var range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        tokens.push({ normalized: normalized, range: range });
      }
    }
    return tokens;
  }

  function collectVisibleTokens(content) {
    var tokens = [];
    textRoots(content).forEach(function (root) {
      tokens.push.apply(tokens, collectRootTokens(root, content));
    });
    return tokens;
  }

  function collectNarrationTokens(source) {
    var wrapped = source.querySelectorAll("[data-word-index]");
    if (wrapped.length) {
      return Array.from(wrapped, function (element) {
        return normalizeWord(element.textContent);
      });
    }
    var tokens = [];
    WORD_PATTERN.lastIndex = 0;
    var match;
    while ((match = WORD_PATTERN.exec(source.textContent || ""))) {
      tokens.push(normalizeWord(match[0]));
    }
    return tokens;
  }

  function wrapPage36VisualWords(copy) {
    if (!copy || copy.getAttribute("data-visual-words-ready") === "true") return;
    var walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    var wordIndex = 0;
    nodes.forEach(function (textNode) {
      var value = textNode.nodeValue || "";
      var pattern = new RegExp(WORD_PATTERN.source, "gu");
      var fragment = document.createDocumentFragment();
      var cursor = 0;
      var match;
      while ((match = pattern.exec(value))) {
        if (match.index > cursor) fragment.appendChild(document.createTextNode(value.slice(cursor, match.index)));
        var span = document.createElement("span");
        span.className = "visual-word";
        span.setAttribute("data-visual-word-index", String(wordIndex));
        span.textContent = match[0];
        fragment.appendChild(span);
        wordIndex += 1;
        cursor = match.index + match[0].length;
      }
      if (cursor < value.length) fragment.appendChild(document.createTextNode(value.slice(cursor)));
      textNode.replaceWith(fragment);
    });
    copy.setAttribute("data-visual-words-ready", "true");
  }

  function syncPage36InstructionHighlight(content) {
    content.querySelectorAll('.exercise-nine .live-copy').forEach(function (liveCopy) {
      var visualCopy = liveCopy.querySelector('.visual-copy');
      var highlightCopy = liveCopy.querySelector('.highlight-copy');
      if (!visualCopy || !highlightCopy) return;
      wrapPage36VisualWords(visualCopy);
      var active = highlightCopy.querySelector('[data-word-index].bg-yellow-300');
      var activeIndex = active ? active.getAttribute('data-word-index') : null;
      visualCopy.querySelectorAll('[data-visual-word-index]').forEach(function (word) {
        word.classList.toggle('visual-word-active', activeIndex !== null && word.getAttribute('data-visual-word-index') === activeIndex);
      });
    });
  }

  function alignTokens(narration, visible) {
    var rows = narration.length + 1;
    var cols = visible.length + 1;
    var table = new Uint16Array(rows * cols);
    var i;
    var j;
    for (i = narration.length - 1; i >= 0; i -= 1) {
      for (j = visible.length - 1; j >= 0; j -= 1) {
        var at = i * cols + j;
        table[at] = narration[i] === visible[j].normalized
          ? 1 + table[(i + 1) * cols + j + 1]
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
      }
    }

    var mapping = new Array(narration.length).fill(null);
    i = 0;
    j = 0;
    while (i < narration.length && j < visible.length) {
      if (narration[i] === visible[j].normalized && table[i * cols + j] === 1 + table[(i + 1) * cols + j + 1]) {
        mapping[i] = visible[j].range;
        i += 1;
        j += 1;
      } else if (table[(i + 1) * cols + j] > table[i * cols + j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    return mapping;
  }

  function buildPage94ShareMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg094_p001") return null;
    var section = content.querySelector('[data-section-id="pg094_sec001"]');
    if (!section) return null;

    var mapping = new Array(narration.length).fill(null);
    var cursor = 0;
    section.querySelectorAll(".share").forEach(function (share) {
      var roots = [share.querySelector(".share-title")].concat(Array.from(share.querySelectorAll(".group-heading")));
      roots.filter(Boolean).forEach(function (root) {
        collectRootTokens(root, content).forEach(function (token) {
          while (cursor < narration.length && narration[cursor] !== token.normalized) cursor += 1;
          if (cursor < narration.length) {
            mapping[cursor] = token.range;
            cursor += 1;
          }
        });
      });
    });
    return mapping;
  }

  function buildPage23TableMap(content, source, narration) {
    var targets = {
      pg023_p019: "all",
      pg023_im002: 0,
      pg023_im003: 1,
      pg023_im001: 2
    };
    var id = source.getAttribute("data-id");
    if (!Object.prototype.hasOwnProperty.call(targets, id)) return null;
    var section = content.querySelector('[data-section-id="pg023_sec001"]');
    if (!section) return null;
    var headings = Array.from(section.querySelectorAll(".question:first-child .column-heading")).map(function (heading) {
      var token = collectRootTokens(heading, content)[0];
      return token && token.range;
    }).filter(Boolean);
    if (headings.length !== 3) return null;

    if (targets[id] !== "all") return new Array(narration.length).fill(headings[targets[id]]);
    return narration.map(function (word) {
      if (word === "hundreds") return headings[0];
      if (word === "tens") return headings[1];
      if (word === "ones") return headings[2];
      return headings;
    });
  }

  function buildPage24AnswerBlankMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg024_p(?:008|009|010|015|016|017|022|023|024)$/.test(id || "")) return null;
    var section = content.querySelector('[data-section-id="pg024_sec001"]');
    if (!section) return null;
    var line = section.querySelector('[data-answer-for="' + id + '"]');
    var target = line && line.closest(".answer-cell");
    return target ? new Array(narration.length).fill(target) : null;
  }

  function buildPage25AnswerBlankMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg025_p(?:005|007|009|011|013|015)$/.test(id || "")) return null;
    var section = content.querySelector('[data-section-id="pg025_sec001"]');
    if (!section) return null;
    var target = section.querySelector('[data-answer-for="' + id + '"]');
    return target ? new Array(narration.length).fill(target) : null;
  }

  function buildPage27AnswerBlankMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (/^pg027_p(?:010|012|014|016|018|020|022|024|026)$/.test(id || "")) {
      var numberRow = source.closest(".place-value-row");
      var numberTarget = numberRow && numberRow.querySelector(".visual-question-number");
      return numberTarget ? new Array(narration.length).fill(numberTarget) : null;
    }
    if (!/^pg027_p(?:011|013|015|017|019|021|023|025|027|028)$/.test(id || "")) return null;
    var row = source.closest(".place-value-row");
    if (!row) return null;
    var mapping = alignTokens(narration, collectRootTokens(row, content));
    var lines = Array.from(row.querySelectorAll('[data-answer-for="' + id + '"]'));
    var blankIndex = 0;
    narration.forEach(function (word, index) {
      if (word === "blank" && lines[blankIndex]) {
        mapping[index] = lines[blankIndex];
        blankIndex += 1;
      }
    });
    return blankIndex === 3 ? mapping : null;
  }

  function buildPage28ExerciseRowMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg028_p(?:004|010|016|022|028|034|040|046|052|058)$/.test(id || "")) return null;
    var row = source.closest(".exercise3-row");
    return row ? alignTokens(narration, collectRootTokens(row, content)) : null;
  }

  function buildPage29ExerciseDiagramMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg029_p(?:009|010|011|012|013|014)$/.test(id || "")) return null;
    var question = source.closest(".diagram-question");
    if (!question) return null;
    var targets = [];
    var questionNumber = question.querySelector(".question-number");
    if (questionNumber) targets.push(collectRootTokens(questionNumber, content)[0]);
    ["hundreds", "tens", "ones"].forEach(function (place) {
      var digit = question.querySelector('[data-place-digit="' + place + '"]');
      var label = question.querySelector(".place-line." + place + " span");
      if (digit) targets.push(collectRootTokens(digit, content)[0]);
      if (digit && label) targets.push(collectRootTokens(label, content)[0]);
    });
    if (targets.length !== narration.length || targets.some(function (target) { return !target; })) return null;
    return narration.map(function (word, index) {
      return targets[index].normalized === word ? targets[index].range : null;
    });
  }

  function buildPage30ExerciseMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (/^pg030_p00[1-8]$/.test(id || "")) {
      var question = source.closest(".diagram-question");
      if (!question) return null;
      var targets = [];
      var questionNumber = question.querySelector(".question-number");
      if (questionNumber) targets.push(collectRootTokens(questionNumber, content)[0]);
      ["hundreds", "tens", "ones"].forEach(function (place) {
        var digit = question.querySelector('[data-place-digit="' + place + '"]');
        var label = question.querySelector(".place-line." + place + " span");
        if (digit) targets.push(collectRootTokens(digit, content)[0]);
        if (digit && label) targets.push(collectRootTokens(label, content)[0]);
      });
      if (targets.length !== narration.length || targets.some(function (target) { return !target; })) return null;
      return narration.map(function (word, index) {
        return targets[index].normalized === word ? targets[index].range : null;
      });
    }
    if (!/^pg030_p(?:012|014|016|018|020|022|024|026|028|030)$/.test(id || "")) return null;
    var row = source.closest(".number-list p");
    return row ? alignTokens(narration, collectRootTokens(row, content)) : null;
  }

  function buildPage31AnswerBlankMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg031_p(?:007|009|011|013|015)$/.test(id || "")) return null;
    var section = content.querySelector('[data-section-id="pg031_sec001"]');
    if (!section) return null;
    var target = section.querySelector('[data-answer-for="' + id + '"]');
    return target ? new Array(narration.length).fill(target) : null;
  }

  function buildPage36TableMap(content, source, narration) {
    var id = source.getAttribute("data-id") || "";
    if (/^pg036_p(?:086|087|088|089|090|091|092|093)$/.test(id)) {
      var blankCell = source.closest("td");
      return blankCell ? new Array(narration.length).fill(blankCell) : null;
    }
    var question3 = /^pg036_p07[6-9]$|^pg036_p080$/.test(id);
    var question4 = /^pg036_p08[1-5]$/.test(id);
    if (!question3 && !question4) return null;

    var section = source.closest("section");
    var table = section && section.querySelector("table");
    if (!table) return null;
    var rowIndex = Number(id.slice(-3)) - (question3 ? 76 : 81);
    var row = table.tBodies[0] && table.tBodies[0].rows[rowIndex];
    if (!row) return null;

    var headers = Array.from(table.querySelectorAll("thead th")).map(function (header) {
      var token = collectRootTokens(header, content)[0];
      return token && token.range;
    });
    var cells = Array.from(row.cells).map(function (cell) {
      var token = collectRootTokens(cell, content)[0];
      return token && token.range;
    });

    if (question3) {
      var printedNumber = collectRootTokens(row.cells[0], content)[0];
      var digitNames = { "2": "two", "3": "three", "6": "six", "9": "nine" };
      var cellCursor = 1;
      var blankTarget = null;
      var lastPlaceHeader = null;
      return narration.map(function (word, index) {
        if (printedNumber && index < 4) return printedNumber.range;
        if (printedNumber && word === printedNumber.normalized) return printedNumber.range;
        if (word === "blank" && cellCursor < cells.length) {
          blankTarget = row.cells[cellCursor];
          var target = blankTarget;
          blankTarget = null;
          cellCursor += 1;
          return target;
        }
        if (cellCursor < cells.length && cells[cellCursor]) {
          var printedDigit = collectRootTokens(row.cells[cellCursor], content)[0];
          if (printedDigit && word === digitNames[printedDigit.normalized]) {
            cellCursor += 1;
            return printedDigit.range;
          }
        }
        if (word === "hundreds") lastPlaceHeader = headers[1];
        else if (word === "tens") lastPlaceHeader = headers[2];
        else if (word === "ones") lastPlaceHeader = headers[3];
        else if (word !== "column") return null;
        return lastPlaceHeader;
      });
    }

    var placeCursor = 0;
    var lastHeader = null;
    var numberNames = /^(?:zero|one|two|three|four|five|six|seven|eight|nine)$/;
    return narration.map(function (word) {
      if (numberNames.test(word) && placeCursor < 3) {
        var target = cells[placeCursor];
        placeCursor += 1;
        return target;
      }
      if (word === "blank") return row.cells[3];
      if (word === "hundreds") lastHeader = headers[0];
      else if (word === "tens") lastHeader = headers[1];
      else if (word === "ones") lastHeader = headers[2];
      else if (word === "number") lastHeader = headers[3];
      else if (word !== "column") return null;
      return lastHeader;
    });
  }

  function buildPage37ChapterBannerMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg037_im007") return null;
    var ids = ["pg037_p023", "pg037_p024", "pg037_p022"];
    var targets = ids.map(function (id) {
      var element = content.querySelector('[data-id="' + id + '"]');
      var token = element && collectRootTokens(element, content)[0];
      return token ? token.range : null;
    });
    if (targets.some(function (target) { return !target; })) return null;
    return narration.map(function (_word, index) {
      return targets[index] || null;
    });
  }

  function buildPage37ExampleMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg037_im008") return null;

    function tokens(id) {
      var element = content.querySelector('[data-id="' + id + '"]');
      return element ? collectRootTokens(element, content) : [];
    }

    function textRange(id, start, end) {
      var element = content.querySelector('[data-id="' + id + '"]');
      var node = element && element.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE || end > node.nodeValue.length) return null;
      var range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      return range;
    }

    var label = tokens("pg037_p007");
    var expression = tokens("pg037_p008");
    var finalLine = tokens("pg037_p021");
    var hundreds = tokens("pg037_p009")[0];
    var tens = tokens("pg037_p010")[0];
    var ones = tokens("pg037_p011")[0];
    var addHundreds = tokens("pg037_p012")[0];
    var addTens = tokens("pg037_p013")[0];
    var addOnes = tokens("pg037_p014")[0];
    var equalsHundreds = tokens("pg037_p015")[0];
    var equalsTens = tokens("pg037_p016")[0];
    var equalsOnes = tokens("pg037_p017")[0];
    var fiveHundreds = tokens("pg037_p018")[0];
    var sixTens = tokens("pg037_p019")[0];
    var eightOnes = tokens("pg037_p020")[0];
    if (label.length < 2 || expression.length < 2 || finalLine.length < 4 || !hundreds || !tens || !ones) return null;

    var mapping = new Array(narration.length).fill(null);
    mapping[0] = label[0].range;
    mapping[1] = label[1].range;
    mapping[3] = textRange("pg037_p008", 0, 3);
    mapping[4] = textRange("pg037_p008", 4, 5);
    mapping[5] = textRange("pg037_p008", 6, 9);
    mapping[7] = [hundreds.range, tens.range, ones.range];
    mapping[8] = mapping[7];
    mapping[9] = textRange("pg037_p008", 0, 1);
    mapping[10] = hundreds.range;
    mapping[11] = addHundreds && addHundreds.range;
    mapping[12] = mapping[11];
    mapping[13] = textRange("pg037_p008", 6, 7);
    mapping[14] = hundreds.range;
    mapping[15] = equalsHundreds && equalsHundreds.range;
    mapping[16] = fiveHundreds && fiveHundreds.range;
    mapping[17] = hundreds.range;
    mapping[18] = textRange("pg037_p008", 1, 2);
    mapping[19] = tens.range;
    mapping[20] = addTens && addTens.range;
    mapping[21] = mapping[20];
    mapping[22] = textRange("pg037_p008", 7, 8);
    mapping[23] = tens.range;
    mapping[24] = equalsTens && equalsTens.range;
    mapping[25] = sixTens && sixTens.range;
    mapping[26] = tens.range;
    mapping[28] = textRange("pg037_p008", 2, 3);
    mapping[29] = ones.range;
    mapping[30] = addOnes && addOnes.range;
    mapping[31] = mapping[30];
    mapping[32] = textRange("pg037_p008", 8, 9);
    mapping[33] = ones.range;
    mapping[34] = equalsOnes && equalsOnes.range;
    mapping[35] = eightOnes && eightOnes.range;
    mapping[36] = ones.range;
    mapping[37] = finalLine[0].range;
    mapping[38] = finalLine[1].range;
    mapping[39] = textRange("pg037_p021", 15, 16);
    mapping[40] = finalLine[2].range;
    mapping[41] = textRange("pg037_p021", 21, 22);
    mapping[42] = finalLine[3].range;
    return mapping;
  }

  function buildPage39ModelMap(_content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg039_p039" && sourceId !== "pg039_p040") return null;
    var model = source.closest(".place-model");
    var columns = model ? Array.from(model.querySelectorAll(".place-model-grid > div")) : [];
    if (columns.length !== 3) return null;

    var headers = columns.map(function (column) { return column.querySelector("h3"); });
    var firstCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[0]; });
    var secondCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[1]; });
    var adds = columns.map(function (column) { return column.querySelectorAll(".model-word")[0]; });
    var equals = columns.map(function (column) { return column.querySelectorAll(".model-word")[1]; });
    var answers = columns.map(function (column) { return column.querySelector(".model-answer"); });
    var finalLine = model.querySelector(".model-final");
    if ([headers, firstCounters, secondCounters, adds, equals, answers].some(function (items) { return items.some(function (item) { return !item; }); }) || !finalLine) return null;

    var mapping = new Array(narration.length).fill(null);
    function assign(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }

    assign(3, 6, headers[0]);
    assign(7, 9, firstCounters[0]);
    assign(10, 12, adds[0]);
    assign(13, 15, secondCounters[0]);
    mapping[16] = equals[0];
    assign(17, 20, headers[1]);
    assign(21, 23, firstCounters[1]);
    assign(24, 26, adds[1]);
    assign(27, 29, secondCounters[1]);
    mapping[30] = equals[1];
    assign(31, 34, headers[2]);
    assign(35, 37, firstCounters[2]);
    assign(38, 40, adds[2]);
    assign(41, 43, secondCounters[2]);
    mapping[44] = equals[2];
    assign(45, 50, answers);
    assign(51, 54, finalLine);
    return mapping;
  }

  function buildPage40ModelMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg040_p037" && sourceId !== "pg040_p038") return null;
    var model = source.closest(".place-model");
    var columns = model ? Array.from(model.querySelectorAll(".place-model-grid > div")) : [];
    if (columns.length !== 3) return null;

    function wordRange(element) {
      var tokens = element ? collectRootTokens(element, content) : [];
      return tokens[0] && tokens[0].range;
    }

    var headers = columns.map(function (column) { return wordRange(column.querySelector("h3")); });
    var firstCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[0]; });
    var secondCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[1]; });
    var adds = columns.map(function (column) { return wordRange(column.querySelectorAll(".model-word")[0]); });
    var equals = columns.map(function (column) { return wordRange(column.querySelectorAll(".model-word")[1]); });
    var answers = columns.map(function (column) { return column.querySelector(".model-answer"); });
    var finalLine = model.querySelector(".model-final");
    if ([headers, firstCounters, secondCounters, adds, equals, answers].some(function (items) { return items.some(function (item) { return !item; }); }) || !finalLine) return null;

    var mapping = new Array(narration.length).fill(null);
    function assign(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }

    assign(3, 6, headers[0]);
    assign(7, 9, firstCounters[0]);
    assign(10, 12, adds[0]);
    assign(13, 15, secondCounters[0]);
    mapping[16] = equals[0];
    assign(17, 20, headers[1]);
    assign(21, 23, firstCounters[1]);
    assign(24, 26, adds[1]);
    assign(27, 29, secondCounters[1]);
    mapping[30] = equals[1];
    assign(31, 34, headers[2]);
    assign(35, 37, firstCounters[2]);
    assign(38, 40, adds[2]);
    assign(41, 43, secondCounters[2]);
    mapping[44] = equals[2];
    assign(45, 50, answers);
    assign(51, 54, finalLine);
    return mapping;
  }

  function buildPage41ModelMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg041_p037" && sourceId !== "pg041_p038") return null;
    var model = source.closest(".place-model");
    var columns = model ? Array.from(model.querySelectorAll(".place-model-grid > div")) : [];
    if (columns.length !== 3) return null;

    function wordRange(element) {
      var tokens = element ? collectRootTokens(element, content) : [];
      return tokens[0] && tokens[0].range;
    }

    var headers = columns.map(function (column) { return wordRange(column.querySelector("h3")); });
    var firstCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[0]; });
    var secondCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[1]; });
    var adds = columns.map(function (column) { return wordRange(column.querySelectorAll(".model-word")[0]); });
    var equals = columns.map(function (column) { return wordRange(column.querySelectorAll(".model-word")[1]); });
    var answers = columns.map(function (column) { return column.querySelector(".model-answer"); });
    var finalLine = model.querySelector(".model-final");
    if ([headers, firstCounters, secondCounters, adds, equals, answers].some(function (items) { return items.some(function (item) { return !item; }); }) || !finalLine) return null;

    var mapping = new Array(narration.length).fill(null);
    function assign(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }

    assign(3, 6, headers[0]);
    assign(7, 9, firstCounters[0]);
    assign(10, 12, adds[0]);
    assign(13, 15, secondCounters[0]);
    mapping[16] = equals[0];
    assign(17, 20, headers[1]);
    assign(21, 23, firstCounters[1]);
    assign(24, 26, adds[1]);
    assign(27, 29, secondCounters[1]);
    mapping[30] = equals[1];
    assign(31, 34, headers[2]);
    assign(35, 37, firstCounters[2]);
    assign(38, 40, adds[2]);
    assign(41, 43, secondCounters[2]);
    mapping[44] = equals[2];
    assign(45, 50, answers);
    assign(51, 54, finalLine);
    return mapping;
  }

  function buildPage45SolutionMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg045_p025" && sourceId !== "pg045_p053") return null;
    var solution = content.querySelector('[data-section-id="pg045_sec001"] .example-card .solution-pair > div:nth-child(2)');
    if (!solution) return null;

    var title = solution.querySelector("h2");
    var headings = Array.from(solution.querySelectorAll(".place-head > span"));
    var equation = solution.querySelector(".place-sum");
    var result = Array.from(solution.querySelectorAll('[data-id="pg045_p034"],[data-id="pg045_p035"],[data-id="pg045_p036"]'));
    if (!title || headings.length !== 3 || !equation || result.length !== 3) return null;

    function firstRange(element) {
      var token = collectRootTokens(element, content)[0];
      return token && token.range;
    }

    var titleRange = firstRange(title);
    var headingRanges = headings.map(firstRange);
    if (!titleRange || headingRanges.some(function (range) { return !range; })) return null;

    if (sourceId === "pg045_p025") {
      var shortTargets = {
        solution: titleRange,
        hundreds: headingRanges[0],
        tens: headingRanges[1],
        ones: headingRanges[2]
      };
      return narration.map(function (word) { return shortTargets[word] || null; });
    }

    return narration.map(function (word, index) {
      if (word === "solution") return titleRange;
      if (word === "hundreds") return headingRanges[0];
      if (word === "tens") return headingRanges[1];
      if (word === "ones") return headingRanges[2];
      if (index >= 1 && index <= 5) return equation;
      if (index >= 6 && index <= 16) return headings;
      if (index >= 17) return result;
      return null;
    });
  }

  function buildPage46ExerciseMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg046_p079") return null;
    var section = content.querySelector('[data-section-id="pg046_sec001"] .exercise-card');
    var problems = section ? Array.from(section.querySelectorAll(".sum-problem")) : [];
    if (problems.length !== 6 || narration.length !== problems.length * 5) return null;

    function visibleRanges(elements) {
      var ranges = [];
      Array.from(elements).forEach(function (element) {
        var root = element.matches(".live-copy") ? element.querySelector(".visual-copy") : element;
        if (!root) return;
        collectRootTokens(root, content).forEach(function (token) { ranges.push(token.range); });
      });
      return ranges;
    }

    function firstRawRange(element) {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var match = node.nodeValue && node.nodeValue.match(WORD_PATTERN);
        if (!match) continue;
        var start = node.nodeValue.indexOf(match[0]);
        var range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + match[0].length);
        return range;
      }
      return null;
    }

    var mapping = new Array(narration.length).fill(null);
    problems.forEach(function (problem, problemIndex) {
      var questionNumber = problem.querySelector(":scope > .question-number");
      var rows = problem.querySelectorAll(".sum-row");
      var plus = rows[1] && rows[1].querySelector(":scope > [data-id]");
      if (!questionNumber || rows.length !== 2 || !plus) return;
      var questionRange = collectRootTokens(questionNumber, content)[0];
      var firstNumberRanges = visibleRanges(rows[0].children);
      var plusRange = firstRawRange(plus);
      var secondNumberRanges = visibleRanges(Array.from(rows[1].children).filter(function (element) { return element !== plus; }));
      if (!questionRange || !plusRange || !firstNumberRanges.length || !secondNumberRanges.length) return;
      var offset = problemIndex * 5;
      mapping[offset] = questionRange.range;
      mapping[offset + 1] = questionRange.range;
      mapping[offset + 2] = firstNumberRanges;
      mapping[offset + 3] = plusRange;
      mapping[offset + 4] = secondNumberRanges;
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage47ExerciseMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg047_p171" && sourceId !== "pg047_p172") return null;
    var container = sourceId === "pg047_p171"
      ? source.closest(".continuation-card")
      : source.closest(".exercise-card");
    var problems = container ? Array.from(container.querySelectorAll(".sum-problem")) : [];
    if (!problems.length || narration.length !== problems.length * 5) return null;

    function visibleRanges(elements) {
      var ranges = [];
      Array.from(elements).forEach(function (element) {
        collectRootTokens(element, content).forEach(function (token) { ranges.push(token.range); });
      });
      return ranges;
    }

    function firstRawRange(element) {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var match = node.nodeValue && node.nodeValue.match(WORD_PATTERN);
        if (!match) continue;
        var start = node.nodeValue.indexOf(match[0]);
        var range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + match[0].length);
        return range;
      }
      return null;
    }

    var mapping = new Array(narration.length).fill(null);
    problems.forEach(function (problem, problemIndex) {
      var questionNumber = problem.querySelector(":scope > .question-number");
      var rows = problem.querySelectorAll(".sum-row");
      var plus = rows[1] && rows[1].querySelector(":scope > [data-id]");
      if (!questionNumber || rows.length !== 2 || !plus) return;
      var questionRange = collectRootTokens(questionNumber, content)[0];
      var firstNumberRanges = visibleRanges(rows[0].children);
      var plusRange = firstRawRange(plus);
      var secondNumberRanges = visibleRanges(Array.from(rows[1].children).filter(function (element) { return element !== plus; }));
      if (!questionRange || !plusRange || !firstNumberRanges.length || !secondNumberRanges.length) return;
      var offset = problemIndex * 5;
      mapping[offset] = questionRange.range;
      mapping[offset + 1] = questionRange.range;
      mapping[offset + 2] = firstNumberRanges;
      mapping[offset + 3] = plusRange;
      mapping[offset + 4] = secondNumberRanges;
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage48Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg048_p052" && sourceId !== "pg048_p053") return null;
    var section = content.querySelector('[data-section-id="pg048_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg048_p052") {
      var problems = Array.from(source.closest(".continuation-card").querySelectorAll(".sum-problem"));
      if (problems.length !== 3 || narration.length !== 15) return null;
      var questionMap = new Array(narration.length).fill(null);
      problems.forEach(function (problem, problemIndex) {
        var questionNumber = problem.querySelector(":scope > .question-number");
        var rows = problem.querySelectorAll(".sum-row");
        var plus = rows[1] && rows[1].querySelector(":scope > [data-id]");
        if (!questionNumber || rows.length !== 2 || !plus) return;
        var questionRanges = rawRanges(questionNumber);
        var firstNumberRanges = rawRanges(rows[0]);
        var plusRanges = rawRanges(plus);
        var secondNumberRanges = rawRanges(rows[1]).slice(1);
        if (!questionRanges.length || !firstNumberRanges.length || !plusRanges.length || !secondNumberRanges.length) return;
        var offset = problemIndex * 5;
        questionMap[offset] = questionRanges;
        questionMap[offset + 1] = questionRanges;
        questionMap[offset + 2] = firstNumberRanges;
        questionMap[offset + 3] = plusRanges;
        questionMap[offset + 4] = secondNumberRanges;
      });
      return questionMap.some(function (target) { return !target; }) ? null : questionMap;
    }

    if (narration.length !== 75) return null;
    var exampleMap = new Array(narration.length).fill(null);
    function assignRange(start, end, ranges) {
      if (ranges.length !== end - start + 1) return false;
      ranges.forEach(function (range, index) { exampleMap[start + index] = range; });
      return true;
    }
    function visualCopy(id) {
      var highlight = section.querySelector('.highlight-copy[data-id="' + id + '"]');
      var liveCopy = highlight && highlight.closest(".live-copy");
      return liveCopy && liveCopy.querySelector(".visual-copy");
    }

    var stepsHeading = rawRanges(section.querySelector('[data-id="pg048_p033"]'));
    var valid =
      assignRange(0, 3, rawRanges(section.querySelector('[data-id="pg048_p030"]'))) &&
      assignRange(4, 4, rawRanges(section.querySelector('[data-id="pg048_p031"]'))) &&
      assignRange(5, 9, rawRanges(section.querySelector('[data-id="pg048_p032"]'))) &&
      stepsHeading.length === 1 &&
      assignRange(12, 19, rawRanges(visualCopy("pg048_p034"))) &&
      assignRange(20, 23, rawRanges(visualCopy("pg048_p035"))) &&
      assignRange(24, 28, rawRanges(visualCopy("pg048_p036"))) &&
      assignRange(29, 34, rawRanges(visualCopy("pg048_p037"))) &&
      assignRange(35, 41, rawRanges(visualCopy("pg048_p038"))) &&
      assignRange(43, 52, rawRanges(visualCopy("pg048_p042"))) &&
      assignRange(53, 57, rawRanges(visualCopy("pg048_p043"))) &&
      assignRange(58, 62, rawRanges(visualCopy("pg048_p044"))) &&
      assignRange(63, 74, rawRanges(visualCopy("pg048_p045")));
    if (!valid) return null;
    exampleMap[10] = stepsHeading[0];
    exampleMap[11] = stepsHeading[0];
    exampleMap[42] = stepsHeading[0];
    return exampleMap.some(function (target) { return !target; }) ? null : exampleMap;
  }

  function buildPage49Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg049_p030" && sourceId !== "pg049_p031") return null;
    var section = content.querySelector('[data-section-id="pg049_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function visualRanges(id) {
      var highlight = section.querySelector('.highlight-copy[data-id="' + id + '"]');
      var liveCopy = highlight && highlight.closest(".live-copy");
      var visualCopy = liveCopy && liveCopy.querySelector(".visual-copy");
      return visualCopy ? rawRanges(visualCopy) : [];
    }

    if (sourceId === "pg049_p030") {
      if (narration.length !== 22) return null;
      var firstStep = visualRanges("pg049_p001");
      var writtenAnswer = visualRanges("pg049_p002");
      var conclusion = rawRanges(section.querySelector('[data-id="pg049_p004"]'));
      if (firstStep.length !== 10 || writtenAnswer.length !== 6 || conclusion.length !== 5) return null;
      var stepMap = new Array(narration.length).fill(null);
      stepMap[0] = firstStep[0];
      stepMap[1] = firstStep[0];
      firstStep.slice(1).forEach(function (range, index) { stepMap[index + 2] = range; });
      writtenAnswer.forEach(function (range, index) { stepMap[index + 11] = range; });
      conclusion.forEach(function (range, index) { stepMap[index + 17] = range; });
      return stepMap.some(function (target) { return !target; }) ? null : stepMap;
    }

    if (narration.length !== 60) return null;
    var rows = Array.from(section.querySelectorAll(".answer-list .answer-row"));
    if (rows.length !== 10) return null;
    var questionMap = new Array(narration.length).fill(null);
    rows.forEach(function (row, rowIndex) {
      var ranges = Array.from(row.querySelectorAll(".visual-copy")).flatMap(rawRanges);
      if (ranges.length !== 5) return;
      var offset = rowIndex * 6;
      questionMap[offset] = ranges[0];
      questionMap[offset + 1] = ranges[0];
      questionMap[offset + 2] = ranges[1];
      questionMap[offset + 3] = ranges[2];
      questionMap[offset + 4] = ranges[3];
      questionMap[offset + 5] = ranges[4];
    });
    return questionMap.some(function (target) { return !target; }) ? null : questionMap;
  }

  function buildPage50Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg050_p068" && sourceId !== "pg050_p069") return null;
    var container = source.closest(".continuation-card,.exercise-card");
    if (!container) return null;
    var rows = Array.from(container.querySelectorAll(".answer-list .answer-row"));
    var expectedRows = sourceId === "pg050_p068" ? 10 : 20;
    if (rows.length !== expectedRows || narration.length !== expectedRows * 6) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var mapping = new Array(narration.length).fill(null);
    rows.forEach(function (row, rowIndex) {
      var ranges = Array.from(row.querySelectorAll(".visual-copy")).flatMap(rawRanges);
      if (ranges.length !== 5) return;
      var offset = rowIndex * 6;
      mapping[offset] = ranges[0];
      mapping[offset + 1] = ranges[0];
      mapping[offset + 2] = ranges[1];
      mapping[offset + 3] = ranges[2];
      mapping[offset + 4] = ranges[3];
      mapping[offset + 5] = ranges[4];
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage51Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg051_p060" && sourceId !== "pg051_p061") return null;
    var section = content.querySelector('[data-section-id="pg051_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg051_p060") {
      if (narration.length !== 11) return null;
      var equationParts = Array.from(section.querySelectorAll(".solution-pair .compact-equation > span"));
      if (equationParts.length !== 3) return null;
      var instructionMap = new Array(narration.length).fill(null);
      instructionMap[0] = equationParts;
      instructionMap.fill(equationParts[0], 1, 5);
      instructionMap[5] = equationParts[1];
      instructionMap.fill(equationParts[2], 6, 10);
      instructionMap[10] = equationParts;
      return instructionMap;
    }

    if (narration.length !== 152) return null;

    function visualRanges(id) {
      var highlight = section.querySelector('.highlight-copy[data-id="' + id + '"]');
      var liveCopy = highlight && highlight.closest(".live-copy");
      var visualCopy = liveCopy && liveCopy.querySelector(".visual-copy");
      return visualCopy ? rawRanges(visualCopy) : [];
    }

    function byId(id) {
      return section.querySelector('[data-id="' + id + '"]');
    }

    var placeSum = section.querySelector(".solution-pair .place-sum");
    var solutionHeading = rawRanges(byId("pg051_p002"));
    var headings = rawRanges(section.querySelector(".solution-pair .place-head"));
    var firstRow = [byId("pg051_p011"), byId("pg051_p013"), byId("pg051_p015")];
    var secondRow = [byId("pg051_p012"), byId("pg051_p014"), byId("pg051_p016")];
    var plusSign = byId("pg051_p010");
    var answerRow = [byId("pg051_p017"), byId("pg051_p018"), byId("pg051_p019")];
    var stepsHeading = rawRanges(byId("pg051_p020"));
    var stepOne = visualRanges("pg051_p021");
    var regroup = visualRanges("pg051_p022");
    var writeOnes = visualRanges("pg051_p024");
    var stepTwo = visualRanges("pg051_p035");
    var writeTens = visualRanges("pg051_p036");
    var stepThree = visualRanges("pg051_p046");
    var writeHundreds = visualRanges("pg051_p047");
    var conclusion = rawRanges(byId("pg051_p057"));
    if (!placeSum || solutionHeading.length !== 1 || headings.length !== 3 || firstRow.some(function (item) { return !item; }) || secondRow.some(function (item) { return !item; }) || !plusSign || answerRow.some(function (item) { return !item; }) || stepsHeading.length !== 1 || stepOne.length !== 8 || regroup.length !== 9 || writeOnes.length !== 13 || stepTwo.length !== 10 || writeTens.length !== 6 || stepThree.length !== 8 || writeHundreds.length !== 6 || conclusion.length !== 5) return null;

    var mapping = new Array(narration.length).fill(null);
    function fill(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }
    function assign(start, ranges) {
      ranges.forEach(function (range, index) { mapping[start + index] = range; });
    }

    mapping[0] = solutionHeading[0];
    fill(1, 11, placeSum);
    mapping[3] = headings[0];
    mapping[4] = headings[1];
    mapping[5] = headings;
    mapping[6] = headings[2];
    fill(12, 15, firstRow);
    fill(16, 20, firstRow[0]);
    fill(21, 25, firstRow[1]);
    mapping[26] = firstRow;
    fill(27, 31, firstRow[2]);
    fill(32, 35, secondRow);
    fill(36, 40, secondRow[0]);
    fill(41, 45, secondRow[1]);
    mapping[46] = secondRow;
    fill(47, 51, secondRow[2]);
    fill(52, 59, plusSign);
    fill(60, 63, answerRow);
    fill(64, 68, answerRow[0]);
    fill(69, 73, answerRow[1]);
    mapping[74] = answerRow;
    fill(75, 79, answerRow[2]);
    mapping[80] = stepsHeading[0];
    mapping[81] = stepsHeading[0];
    assign(82, stepOne);
    assign(90, regroup);
    assign(99, writeOnes);
    mapping[112] = stepsHeading[0];
    assign(113, stepTwo);
    assign(123, writeTens);
    mapping[129] = stepsHeading[0];
    assign(130, stepThree);
    assign(138, writeHundreds);
    conclusion.slice(0, 4).forEach(function (range, index) { mapping[144 + index] = range; });
    fill(148, 151, conclusion[4]);
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage52Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg052_p065" && sourceId !== "pg052_p066") return null;
    var section = content.querySelector('[data-section-id="pg052_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg052_p065") {
      if (narration.length !== 11) return null;
      var equation = rawRanges(section.querySelector(".worked-top .top-sum"));
      if (equation.length !== 3) return null;
      var instructionMap = new Array(narration.length).fill(null);
      instructionMap[0] = equation;
      instructionMap.fill(equation[0], 1, 5);
      instructionMap[5] = equation[1];
      instructionMap.fill(equation[2], 6, 10);
      instructionMap[10] = equation;
      return instructionMap;
    }

    if (narration.length !== 169) return null;
    var placeSum = section.querySelector(".place-solution .place-sum");
    var labels = rawRanges(placeSum && placeSum.querySelector(".labels"));
    var rows = placeSum ? Array.from(placeSum.querySelectorAll(".row")) : [];
    var firstRow = rows[0] ? Array.from(rows[0].querySelectorAll("span")).slice(1) : [];
    var secondRow = rows[1] ? Array.from(rows[1].querySelectorAll("span")) : [];
    var plusSign = rows[1] && rows[1].querySelector("b");
    var answerRow = rows[2] ? Array.from(rows[2].querySelectorAll("span")).slice(1) : [];
    var stepsHeading = rawRanges(section.querySelector(".steps-title"));
    var stepRows = Array.from(section.querySelectorAll(".step-row"));
    var stepOne = stepRows[0] && rawRanges(stepRows[0].querySelector(".step-lead"));
    var stepOneCopy = stepRows[0] && rawRanges(stepRows[0].querySelector(".step-copy p:nth-child(2)"));
    var stepTwo = stepRows[1] && rawRanges(stepRows[1].querySelector(".step-lead"));
    var stepTwoCopy = stepRows[1] && rawRanges(stepRows[1].querySelector(".step-copy p:nth-child(2)"));
    var stepThree = stepRows[2] && rawRanges(stepRows[2].querySelector(".step-lead"));
    var stepThreeCopy = stepRows[2] && rawRanges(stepRows[2].querySelector(".step-copy p:nth-child(2)"));
    var conclusion = rawRanges(section.querySelector(".therefore"));
    if (!placeSum || labels.length !== 3 || firstRow.length !== 3 || secondRow.length !== 3 || !plusSign || answerRow.length !== 3 || stepsHeading.length !== 1 || !stepOne || stepOne.length !== 8 || !stepOneCopy || stepOneCopy.length !== 22 || !stepTwo || stepTwo.length !== 10 || !stepTwoCopy || stepTwoCopy.length !== 22 || !stepThree || stepThree.length !== 10 || !stepThreeCopy || stepThreeCopy.length !== 6 || conclusion.length !== 5) return null;

    var mapping = new Array(narration.length).fill(null);
    function fill(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }
    function assign(start, ranges) {
      ranges.forEach(function (range, index) { mapping[start + index] = range; });
    }

    fill(0, 10, placeSum);
    mapping[2] = labels[0];
    mapping[3] = labels[1];
    mapping[4] = labels;
    mapping[5] = labels[2];
    fill(11, 14, firstRow);
    fill(15, 19, firstRow[0]);
    fill(20, 24, firstRow[1]);
    mapping[25] = firstRow;
    fill(26, 30, firstRow[2]);
    fill(31, 34, secondRow);
    fill(35, 39, secondRow[0]);
    fill(40, 44, secondRow[1]);
    mapping[45] = secondRow;
    fill(46, 50, secondRow[2]);
    fill(51, 58, plusSign);
    fill(59, 62, answerRow);
    fill(63, 67, answerRow[0]);
    fill(68, 72, answerRow[1]);
    mapping[73] = answerRow;
    fill(74, 78, answerRow[2]);
    mapping[79] = stepsHeading[0];
    mapping[80] = stepsHeading[0];
    assign(81, stepOne);
    assign(89, stepOneCopy);
    mapping[111] = stepsHeading[0];
    assign(112, stepTwo);
    assign(122, stepTwoCopy);
    mapping[144] = stepsHeading[0];
    assign(145, stepThree);
    assign(155, stepThreeCopy);
    conclusion.slice(0, 4).forEach(function (range, index) { mapping[161 + index] = range; });
    fill(165, 168, conclusion[4]);
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage53Exercise8Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg053_p119" && sourceId !== "pg053_p120" && sourceId !== "pg053_p148") return null;
    var section = content.querySelector('[data-section-id="pg053_sec001"]');
    var exercise = section && section.querySelector(".pg053-eight");
    if (!exercise) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg053_p119") {
      var heading = rawRanges(exercise.querySelector(".pg053-label"));
      return narration.length === 2 && heading.length === 2 ? heading : null;
    }
    if (sourceId === "pg053_p120") {
      var instruction = rawRanges(exercise.querySelector(".pg053-intro"));
      return narration.length === 6 && instruction.length === 6 ? instruction : null;
    }
    if (narration.length !== 15) return null;
    var rows = Array.from(exercise.querySelectorAll(".pg053-problem"));
    if (rows.length !== 3) return null;

    var mapping = new Array(narration.length).fill(null);
    rows.forEach(function (row, rowIndex) {
      var ranges = rawRanges(row);
      if (ranges.length !== 4) return;
      var offset = rowIndex * 5;
      mapping[offset] = ranges[0];
      mapping[offset + 1] = ranges[0];
      mapping[offset + 2] = ranges[1];
      mapping[offset + 3] = ranges[2];
      mapping[offset + 4] = ranges[3];
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage54ChartMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg054_p137" && sourceId !== "pg054_p138") return null;
    var section = content.querySelector('[data-section-id="pg054_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg054_p138") {
      var explanation = rawRanges(section.querySelector(".pg054-explanation"));
      return narration.length === 52 && explanation.length === 52 ? explanation : null;
    }

    if (narration.length !== 76) return null;
    var table = section.querySelector(".pg054-chart");
    var headerCells = table ? Array.from(table.querySelectorAll("thead th")).slice(1) : [];
    var bodyRows = table ? Array.from(table.querySelectorAll("tbody tr")) : [];
    var rowHeaders = bodyRows.map(function (row) { return row.querySelector("th"); });
    var valueRows = bodyRows.map(function (row) { return Array.from(row.querySelectorAll("td")); });
    if (!table || headerCells.length !== 5 || bodyRows.length !== 5 || rowHeaders.some(function (cell) { return !cell; }) || valueRows.some(function (cells) { return cells.length !== 5; })) return null;

    var mapping = new Array(narration.length).fill(null);
    function fill(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }
    fill(0, 5, table.querySelector("thead"));
    mapping[6] = headerCells[0];
    mapping[7] = headerCells[1];
    mapping[8] = headerCells[2];
    mapping[9] = headerCells[3];
    mapping[10] = headerCells;
    mapping[11] = headerCells[4];
    mapping[12] = rowHeaders;
    mapping[13] = rowHeaders;
    mapping[14] = rowHeaders;
    mapping[15] = rowHeaders[0];
    mapping[16] = rowHeaders[1];
    mapping[17] = rowHeaders[2];
    mapping[18] = rowHeaders[3];
    mapping[19] = rowHeaders;
    mapping[20] = rowHeaders[4];
    bodyRows.forEach(function (row, rowIndex) {
      var offset = 21 + rowIndex * 11;
      fill(offset, offset + 2, row);
      mapping[offset + 3] = rowHeaders[rowIndex];
      mapping[offset + 4] = row;
      mapping[offset + 5] = valueRows[rowIndex][0];
      mapping[offset + 6] = valueRows[rowIndex][1];
      mapping[offset + 7] = valueRows[rowIndex][2];
      mapping[offset + 8] = valueRows[rowIndex][3];
      mapping[offset + 9] = valueRows[rowIndex];
      mapping[offset + 10] = valueRows[rowIndex][4];
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage55Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    var supported = ["pg055_p001", "pg055_p002", "pg055_p023", "pg055_p024", "pg055_p041", "pg055_p042", "pg055_p043"];
    if (supported.indexOf(sourceId) === -1) return null;
    var section = content.querySelector('[data-section-id="pg055_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var exerciseNine = section.querySelector(".pg055-card:not(.pg055-ten)");
    var exerciseTen = section.querySelector(".pg055-ten");
    if (!exerciseNine || !exerciseTen) return null;
    var directTargets = {
      pg055_p001: exerciseNine.querySelector(".pg055-label"),
      pg055_p002: exerciseNine.querySelector(".pg055-intro"),
      pg055_p023: exerciseTen.querySelector(".pg055-label"),
      pg055_p024: exerciseTen.querySelector(".pg055-intro")
    };
    if (directTargets[sourceId]) {
      var direct = rawRanges(directTargets[sourceId]);
      return direct.length === narration.length ? direct : null;
    }

    function mapQuestionRows(rows) {
      var mapping = new Array(narration.length).fill(null);
      var cursor = 0;
      for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        var ranges = rawRanges(rows[rowIndex]);
        if (!ranges.length || narration[cursor] !== "question" || cursor + ranges.length >= narration.length + 1) return null;
        mapping[cursor] = ranges[0];
        ranges.forEach(function (range, index) { mapping[cursor + index + 1] = range; });
        cursor += ranges.length + 1;
      }
      return cursor === narration.length && !mapping.some(function (target) { return !target; }) ? mapping : null;
    }

    if (sourceId === "pg055_p042") {
      return mapQuestionRows(Array.from(exerciseNine.querySelectorAll(".pg055-questions li")));
    }
    if (sourceId === "pg055_p043") {
      if (narration.length !== 57) return null;
      var sequenceRows = Array.from(exerciseTen.querySelectorAll(".pg055-pattern"));
      if (sequenceRows.length !== 7) return null;
      var sequenceMap = new Array(narration.length).fill(null);
      var sequenceCursor = 0;
      sequenceRows.forEach(function (row, rowIndex) {
        var ranges = rawRanges(row);
        var blanks = Array.from(row.querySelectorAll(".pg055-blank"));
        if (blanks.length !== 3 || ranges.length !== (rowIndex === 6 ? 5 : 4)) return;
        sequenceMap[sequenceCursor] = ranges[0];
        sequenceMap[sequenceCursor + 1] = ranges[0];
        sequenceMap[sequenceCursor + 2] = ranges[1];
        sequenceMap[sequenceCursor + 3] = ranges[2];
        sequenceMap[sequenceCursor + 4] = ranges[3];
        sequenceMap[sequenceCursor + 5] = blanks[0];
        sequenceMap[sequenceCursor + 6] = blanks[1];
        if (rowIndex === 6) {
          sequenceMap[sequenceCursor + 7] = ranges[4];
          sequenceMap[sequenceCursor + 8] = blanks[2];
          sequenceCursor += 9;
        } else {
          sequenceMap[sequenceCursor + 7] = blanks[2];
          sequenceCursor += 8;
        }
      });
      return sequenceCursor === narration.length && !sequenceMap.some(function (target) { return !target; }) ? sequenceMap : null;
    }

    if (narration.length !== 44) return null;
    var table = exerciseNine.querySelector(".pg055-chart");
    var allHeaderCells = table ? Array.from(table.querySelectorAll("thead th")) : [];
    var plusCell = allHeaderCells[0];
    var columnHeaders = allHeaderCells.slice(1);
    var bodyRows = table ? Array.from(table.querySelectorAll("tbody tr")) : [];
    var rowHeaders = bodyRows.map(function (row) { return row.querySelector("th"); });
    var valueRows = bodyRows.map(function (row) { return Array.from(row.querySelectorAll("td")); });
    if (!table || !plusCell || columnHeaders.length !== 6 || bodyRows.length !== 6 || rowHeaders.some(function (cell) { return !cell; }) || valueRows.some(function (cells) { return cells.length !== 6; })) return null;
    var firstShown = valueRows[3][4];
    var secondShown = valueRows[5][2];
    var mapping = new Array(narration.length).fill(null);
    function fill(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }
    fill(0, 5, table.querySelector("thead"));
    mapping[6] = columnHeaders[0];
    mapping[7] = columnHeaders[1];
    mapping[8] = columnHeaders[2];
    mapping[9] = columnHeaders[3];
    mapping[10] = columnHeaders[4];
    mapping[11] = columnHeaders;
    mapping[12] = columnHeaders[5];
    mapping[13] = rowHeaders;
    mapping[14] = rowHeaders;
    mapping[15] = rowHeaders;
    mapping[16] = rowHeaders[0];
    mapping[17] = rowHeaders[1];
    mapping[18] = rowHeaders[2];
    mapping[19] = rowHeaders[3];
    mapping[20] = rowHeaders[4];
    mapping[21] = rowHeaders;
    mapping[22] = rowHeaders[5];
    fill(23, 27, [firstShown, secondShown]);
    mapping[28] = rowHeaders[3];
    mapping[29] = plusCell;
    mapping[30] = columnHeaders[4];
    mapping[31] = firstShown;
    mapping[32] = firstShown;
    mapping[33] = [firstShown, secondShown];
    mapping[34] = rowHeaders[5];
    mapping[35] = plusCell;
    mapping[36] = columnHeaders[2];
    mapping[37] = secondShown;
    mapping[38] = secondShown;
    fill(39, 43, table.querySelector("tbody"));
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage56SequenceMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg056_p018" || narration.length !== 25) return null;
    var section = content.querySelector('[data-section-id="pg056_sec001"]');
    var rows = section ? Array.from(section.querySelectorAll(".pg056-pattern")) : [];
    if (rows.length !== 3) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var mapping = new Array(narration.length).fill(null);
    var cursor = 0;
    rows.forEach(function (row, rowIndex) {
      var ranges = rawRanges(row);
      var blanks = Array.from(row.querySelectorAll(".pg056-blank"));
      if (blanks.length !== 3 || ranges.length !== (rowIndex === 2 ? 5 : 4)) return;
      mapping[cursor] = ranges[0];
      mapping[cursor + 1] = ranges[0];
      mapping[cursor + 2] = ranges[1];
      mapping[cursor + 3] = ranges[2];
      mapping[cursor + 4] = ranges[3];
      mapping[cursor + 5] = blanks[0];
      mapping[cursor + 6] = blanks[1];
      if (rowIndex === 2) {
        mapping[cursor + 7] = ranges[4];
        mapping[cursor + 8] = blanks[2];
        cursor += 9;
      } else {
        mapping[cursor + 7] = blanks[2];
        cursor += 8;
      }
    });
    return cursor === narration.length && !mapping.some(function (target) { return !target; }) ? mapping : null;
  }

  function buildPage57Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    var supported = ["pg057_p022", "pg057_p023", "pg057_p041", "pg057_p042", "pg057_p043"];
    if (supported.indexOf(sourceId) === -1) return null;
    var section = content.querySelector('[data-section-id="pg057_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg057_p022" || sourceId === "pg057_p023") {
      var guidanceRanges = rawRanges(section.querySelector(".pg057-guidance"));
      var split = sourceId === "pg057_p022" ? guidanceRanges.slice(0, 11) : guidanceRanges.slice(11);
      return split.length === narration.length ? split : null;
    }

    if (sourceId === "pg057_p041") {
      if (narration.length !== 69) return null;
      var steps = Array.from(section.querySelectorAll(".pg057-steps li"));
      var stepMap = new Array(narration.length).fill(null);
      var cursor = 0;
      steps.forEach(function (step) {
        var ranges = rawRanges(step);
        if (!ranges.length || narration[cursor] !== "step") return;
        stepMap[cursor] = ranges[0];
        ranges.forEach(function (range, index) { stepMap[cursor + index + 1] = range; });
        cursor += ranges.length + 1;
      });
      return cursor === narration.length && !stepMap.some(function (target) { return !target; }) ? stepMap : null;
    }

    if (sourceId === "pg057_p043") {
      if (narration.length !== 31) return null;
      var solutionTable = section.querySelector(".pg057-solution-table");
      var solutionHeaders = solutionTable ? Array.from(solutionTable.querySelectorAll("thead th")) : [];
      var solutionRows = solutionTable ? Array.from(solutionTable.querySelectorAll("tbody tr")) : [];
      var totalCopy = section.querySelector(".pg057-total");
      if (solutionHeaders.length !== 3 || solutionRows.length !== 3 || !totalCopy) return null;
      var solutionCells = solutionRows.map(function (row) { return Array.from(row.querySelectorAll("td")); });
      if (solutionCells.some(function (row) { return row.length !== 3; })) return null;
      var ashaHeader = rawRanges(solutionHeaders[1])[0];
      var annaHeader = rawRanges(solutionHeaders[2])[0];
      var ashaFirst = rawRanges(solutionCells[0][1])[0];
      var annaFirst = rawRanges(solutionCells[0][2])[0];
      var ashaSecond = rawRanges(solutionCells[1][1]);
      var annaSecond = rawRanges(solutionCells[1][2]);
      var ashaTotal = rawRanges(solutionCells[2][1])[0];
      var annaTotal = rawRanges(solutionCells[2][2])[0];
      var totalRanges = rawRanges(totalCopy);
      if (!ashaHeader || !annaHeader || !ashaFirst || !annaFirst || ashaSecond.length !== 2 || annaSecond.length !== 2 || !ashaTotal || !annaTotal || totalRanges.length !== 15) return null;
      return [
        ashaHeader, ashaHeader, ashaHeader, ashaFirst, ashaSecond[0], ashaSecond[1], ashaTotal, ashaTotal,
        annaHeader, annaHeader, annaHeader, annaFirst, annaSecond[0], annaSecond[1], annaTotal, annaTotal,
        totalRanges[0], totalRanges[1], totalRanges[2], totalRanges[3], totalRanges[4], totalRanges[5], totalRanges[6],
        totalRanges[7], totalRanges[8], totalRanges[9], totalRanges[10], totalRanges[11], totalRanges[12], totalRanges[13], totalRanges[14]
      ];
    }

    if (narration.length !== 18) return null;
    var table = section.querySelector(".pg057-table:not(.pg057-solution-table)");
    var headers = table ? Array.from(table.querySelectorAll("thead th")) : [];
    var rows = table ? Array.from(table.querySelectorAll("tbody tr")) : [];
    if (headers.length !== 3 || rows.length !== 2) return null;
    var headerRanges = headers.map(rawRanges);
    var cells = rows.map(function (row) { return Array.from(row.querySelectorAll("td")); });
    if (headerRanges[0].length !== 2 || headerRanges[1].length !== 1 || headerRanges[2].length !== 1 || cells.some(function (row) { return row.length !== 3; })) return null;
    var cellRanges = cells.map(function (row) { return row.map(function (cell) { return rawRanges(cell)[0]; }); });
    if (cellRanges.some(function (row) { return row.some(function (range) { return !range; }); })) return null;
    return [
      headerRanges[0][0], headerRanges[0][1], headerRanges[1][0], headerRanges[2][0],
      cellRanges[0][0], cellRanges[0][0], cellRanges[0][0], headerRanges[1][0], cellRanges[0][1], headerRanges[2][0], cellRanges[0][2],
      cellRanges[1][0], cellRanges[1][0], cellRanges[1][0], headerRanges[1][0], cellRanges[1][1], headerRanges[2][0], cellRanges[1][2]
    ];
  }

  function buildPage58QuestionMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg058_p025" || narration.length !== 111) return null;
    var section = content.querySelector('[data-section-id="pg058_sec001"]');
    var rows = section ? Array.from(section.querySelectorAll(".pg058-list li")) : [];
    if (rows.length !== 8) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var mapping = new Array(narration.length).fill(null);
    var cursor = 0;
    rows.forEach(function (row) {
      var ranges = rawRanges(row);
      if (!ranges.length || narration[cursor] !== "question") return;
      mapping[cursor] = ranges[0];
      ranges.forEach(function (range, index) { mapping[cursor + index + 1] = range; });
      cursor += ranges.length + 1;
    });
    return cursor === narration.length && !mapping.some(function (target) { return !target; }) ? mapping : null;
  }

  function buildPage59FishNumberMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg059_p053" || narration.length !== 83) return null;
    var section = content.querySelector('[data-section-id="pg059_sec001"]');
    var topSum = section ? section.querySelector(".pg059-top .pg059-sum") : null;
    if (!topSum) return null;
    var ranges = [];
    var walker = document.createTreeWalker(topSum, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (excludedTextNode(node, content)) continue;
      var pattern = new RegExp(WORD_PATTERN.source, "gu");
      var match;
      while ((match = pattern.exec(node.nodeValue || ""))) {
        var range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.push(range);
      }
    }
    if (ranges.length !== 4) return null;
    var mapping = alignTokens(narration, collectVisibleTokens(content));
    mapping[9] = ranges[0];
    mapping[18] = ranges[2];
    return mapping;
  }

  function buildPage60Step2Map(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg060_p051" || narration.length !== 98) return null;
    var section = content.querySelector('[data-section-id="pg060_sec001"]');
    var row = section ? section.querySelector(".pg060-row-two") : null;
    if (!row) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var numberRange = rawRanges(row.querySelector(".pg060-number"))[0];
    var paragraphs = Array.from(row.querySelectorAll(".pg060-copy p"));
    var first = paragraphs[0] ? rawRanges(paragraphs[0]) : [];
    var second = paragraphs[1] ? rawRanges(paragraphs[1]) : [];
    if (!numberRange || first.length !== 24 || second.length !== 7) return null;
    var mapping = alignTokens(narration, collectVisibleTokens(content));
    mapping[42] = numberRange;
    mapping[43] = numberRange;
    mapping[44] = first[0];
    mapping[45] = first[1];
    mapping[46] = first[1];
    for (var index = 47; index <= 57; index += 1) mapping[index] = first[index - 45];
    mapping[58] = [first[13], first[14]];
    for (var afterHundred = 59; afterHundred <= 67; afterHundred += 1) mapping[afterHundred] = first[afterHundred - 44];
    mapping[68] = second[0];
    mapping[69] = [second[1], second[2]];
    for (var tail = 70; tail <= 73; tail += 1) mapping[tail] = second[tail - 67];
    return mapping;
  }

  function buildPage63ExampleMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg063_p036" || narration.length !== 64) return null;
    var section = content.matches('[data-section-id="pg063_sec001"]')
      ? content
      : content.querySelector('[data-section-id="pg063_sec001"]');
    var example = section ? section.querySelector(".example") : null;
    if (!example) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var label = rawRanges(example.querySelector(".example-label"))[0];
    var equation = rawRanges(example.querySelector(".equation"));
    var solution = rawRanges(example.querySelector(".solution"))[0];
    var table = example.querySelector(".place-table");
    var labels = table ? Array.from(table.querySelectorAll(".cell.label")) : [];
    var values = table ? Array.from(table.querySelectorAll(".cell.value")) : [];
    var labelRanges = labels.map(function (cell) { return rawRanges(cell)[0]; });
    var valueRanges = values.map(function (cell) { return rawRanges(cell)[0]; });
    var arrows = example.querySelector(".arrows");
    if (!label || equation.length !== 4 || !solution || labels.length !== 11 || values.length !== 11 || !arrows) return null;
    if ([0, 1, 2, 4, 5, 6, 8, 9, 10].some(function (index) { return !labelRanges[index]; }) || valueRanges.some(function (range) { return !range; })) return null;

    var mapping = new Array(narration.length).fill(null);
    mapping[0] = label;
    mapping[1] = equation[0];
    mapping[2] = equation[1];
    mapping[3] = equation[2];
    mapping[4] = equation[3];
    mapping[5] = solution;
    for (var introduction = 6; introduction <= 9; introduction += 1) mapping[introduction] = table;
    for (var fromRight = 10; fromRight <= 13; fromRight += 1) mapping[fromRight] = labelRanges[2];

    function mapPlace(start, placeLabels, firstValue, secondValue, resultValue) {
      for (var index = start; index <= start + 3; index += 1) mapping[index] = placeLabels;
      mapping[start + 4] = valueRanges[firstValue];
      mapping[start + 5] = valueRanges[3];
      mapping[start + 6] = valueRanges[secondValue];
      mapping[start + 7] = valueRanges[7];
      mapping[start + 8] = valueRanges[resultValue];
    }
    mapPlace(14, [labelRanges[2], labelRanges[6], labelRanges[10]], 2, 6, 10);
    mapPlace(23, [labelRanges[1], labelRanges[5], labelRanges[9]], 1, 5, 9);
    mapPlace(32, [labelRanges[0], labelRanges[4], labelRanges[8]], 0, 4, 8);

    mapping[41] = [labels[8], labels[9], labels[10], values[8], values[9], values[10]];
    mapping[42] = [valueRanges[0], valueRanges[1], valueRanges[2]];
    mapping[43] = valueRanges[3];
    mapping[44] = [valueRanges[4], valueRanges[5], valueRanges[6]];
    mapping[45] = valueRanges[7];
    mapping[46] = [valueRanges[8], valueRanges[9], valueRanges[10]];
    for (var diagram = 47; diagram <= 53; diagram += 1) mapping[diagram] = arrows;
    mapping[54] = [labelRanges[2], labelRanges[6], labelRanges[10]];
    mapping[55] = arrows;
    mapping[56] = [labelRanges[2], labelRanges[6], labelRanges[10]];
    mapping[57] = [labelRanges[1], labelRanges[5], labelRanges[9]];
    mapping[58] = arrows;
    mapping[59] = [labelRanges[1], labelRanges[5], labelRanges[9]];
    mapping[60] = arrows;
    mapping[61] = [labelRanges[0], labelRanges[4], labelRanges[8]];
    mapping[62] = arrows;
    mapping[63] = [labelRanges[0], labelRanges[4], labelRanges[8]];
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage64StepsMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg064_p059" || narration.length !== 92) return null;
    var section = content.querySelector('[data-section-id="pg064_sec001"]');
    var title = section ? section.querySelector(".pg064-title") : null;
    var steps = section ? Array.from(section.querySelectorAll(".pg064-step")) : [];
    var therefore = section ? section.querySelector(".pg064-therefore") : null;
    if (!title || steps.length !== 3 || !therefore) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var rows = steps.map(function (step) {
      var paragraphs = step.querySelectorAll(".pg064-copy p");
      var diagram = step.querySelector(".pg064-diagram");
      var heads = Array.from(step.querySelectorAll(".pg064-head"));
      var digits = Array.from(step.querySelectorAll(".pg064-digit"));
      return {
        number: rawRanges(step.querySelector(".pg064-number"))[0],
        first: rawRanges(paragraphs[0]),
        second: rawRanges(paragraphs[1]),
        diagram: diagram,
        heads: heads.map(function (cell) { return rawRanges(cell)[0]; }),
        digits: digits.map(function (cell) { return rawRanges(cell)[0]; })
      };
    });
    if (rows.some(function (row) {
      return !row.number || row.first.length !== 7 || row.second.length !== 6 || !row.diagram || row.heads.length !== 11 || row.digits.length !== 11;
    })) return null;

    function column(row, offset) {
      return [row.heads[offset], row.heads[offset + 4], row.heads[offset + 8]].filter(Boolean);
    }
    function allHeadings(row) {
      return [0, 1, 2, 4, 5, 6, 8, 9, 10].map(function (index) { return row.heads[index]; }).filter(Boolean);
    }

    var mapping = new Array(narration.length).fill(null);
    mapping[0] = rawRanges(title)[0];

    var first = rows[0];
    mapping[1] = first.number; mapping[2] = first.number;
    mapping[3] = first.first[0]; mapping[4] = first.first[1]; mapping[5] = [first.first[1]].concat(column(first, 2));
    for (var firstSum = 6; firstSum <= 10; firstSum += 1) mapping[firstSum] = first.first[firstSum - 4];
    for (var firstWrite = 11; firstWrite <= 16; firstWrite += 1) mapping[firstWrite] = first.second[firstWrite - 11];
    mapping[15] = [first.second[4]].concat(column(first, 2));
    mapping[17] = first.diagram; mapping[18] = first.diagram;
    mapping[19] = allHeadings(first); mapping[20] = allHeadings(first);
    mapping[21] = first.diagram; mapping[22] = first.diagram;
    mapping[23] = [first.digits[0], first.digits[1], first.digits[2]];
    mapping[24] = first.digits[3]; mapping[25] = [first.digits[4], first.digits[5], first.digits[6]];
    mapping[26] = first.diagram; mapping[27] = first.digits[10]; mapping[28] = first.digits[10];
    mapping[29] = first.digits[10]; mapping[30] = first.digits[10];
    mapping[31] = column(first, 2); mapping[32] = first.heads[10];

    var second = rows[1];
    mapping[33] = second.number; mapping[34] = second.number;
    mapping[35] = second.first[0]; mapping[36] = second.first[1]; mapping[37] = [second.first[1]].concat(column(second, 1));
    for (var secondSum = 38; secondSum <= 42; secondSum += 1) mapping[secondSum] = second.first[secondSum - 36];
    for (var secondWrite = 43; secondWrite <= 48; secondWrite += 1) mapping[secondWrite] = second.second[secondWrite - 43];
    mapping[47] = [second.second[4]].concat(column(second, 1));
    mapping[49] = second.diagram; mapping[50] = second.diagram;
    mapping[51] = second.diagram; mapping[52] = second.diagram;
    mapping[53] = second.digits[9]; mapping[54] = column(second, 1);
    mapping[55] = second.diagram; mapping[56] = second.digits[10]; mapping[57] = column(second, 2);
    mapping[58] = [second.digits[9], second.digits[10]];
    mapping[59] = [second.digits[9], second.digits[10]];
    mapping[60] = [second.digits[9], second.digits[10]];

    var third = rows[2];
    mapping[61] = third.number; mapping[62] = third.number;
    mapping[63] = third.first[0]; mapping[64] = third.first[1]; mapping[65] = [third.first[1]].concat(column(third, 0));
    for (var thirdSum = 66; thirdSum <= 70; thirdSum += 1) mapping[thirdSum] = third.first[thirdSum - 64];
    for (var thirdWrite = 71; thirdWrite <= 76; thirdWrite += 1) mapping[thirdWrite] = third.second[thirdWrite - 71];
    mapping[75] = [third.second[4]].concat(column(third, 0));
    mapping[77] = third.diagram; mapping[78] = third.diagram;
    mapping[79] = third.diagram; mapping[80] = third.diagram;
    mapping[81] = [third.heads[8], third.digits[8]];
    mapping[82] = third.digits[9]; mapping[83] = column(third, 1);
    mapping[84] = third.diagram; mapping[85] = third.digits[10]; mapping[86] = column(third, 2);

    var ending = rawRanges(therefore);
    if (ending.length !== 5) return null;
    for (var end = 87; end <= 91; end += 1) mapping[end] = ending[end - 87];
    return mapping.some(function (target) { return !target || (Array.isArray(target) && !target.length); }) ? null : mapping;
  }

  function buildPage65Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg065_p036" && sourceId !== "pg065_p037") return null;
    var section = content.querySelector('[data-section-id="pg065_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg065_p036") {
      if (narration.length !== 48) return null;
      var example = section.querySelector(".pg065-example");
      var heading = example ? rawRanges(example.querySelector(".pg065-heading"))[0] : null;
      var equation = example ? rawRanges(example.querySelector(".pg065-equation")) : [];
      var abacus = example ? example.querySelector(".pg065-abacus") : null;
      var therefore = example ? rawRanges(example.querySelector(".pg065-therefore")) : [];
      if (!heading || equation.length !== 4 || !abacus || therefore.length !== 6) return null;
      var exampleMap = new Array(narration.length).fill(null);
      exampleMap[0] = heading;
      for (var equationIndex = 1; equationIndex <= 4; equationIndex += 1) exampleMap[equationIndex] = equation[equationIndex - 1];
      for (var abacusIndex = 5; abacusIndex <= 41; abacusIndex += 1) exampleMap[abacusIndex] = abacus;
      for (var resultIndex = 42; resultIndex <= 47; resultIndex += 1) exampleMap[resultIndex] = therefore[resultIndex - 42];
      return exampleMap;
    }

    if (narration.length !== 116) return null;
    var exercise = section.querySelector(".pg065-exercise");
    var exerciseHeading = exercise ? rawRanges(exercise.querySelector(".pg065-label")) : [];
    var instruction = exercise ? rawRanges(exercise.querySelector(".pg065-instruction")) : [];
    var problems = exercise ? Array.from(exercise.querySelectorAll(".pg065-problem")) : [];
    if (exerciseHeading.length !== 2 || instruction.length !== 6 || problems.length !== 18) return null;
    var exerciseMap = new Array(narration.length).fill(null);
    exerciseMap[0] = exerciseHeading[0]; exerciseMap[1] = exerciseHeading[1];
    for (var instructionIndex = 2; instructionIndex <= 7; instructionIndex += 1) exerciseMap[instructionIndex] = instruction[instructionIndex - 2];
    for (var problemIndex = 0; problemIndex < problems.length; problemIndex += 1) {
      var ranges = rawRanges(problems[problemIndex]);
      if (ranges.length !== 5) return null;
      var start = 8 + problemIndex * 6;
      exerciseMap[start] = ranges[0];
      exerciseMap[start + 1] = ranges[0];
      exerciseMap[start + 2] = ranges[1];
      exerciseMap[start + 3] = ranges[2];
      exerciseMap[start + 4] = ranges[3];
      exerciseMap[start + 5] = ranges[4];
    }
    return exerciseMap.some(function (target) { return !target; }) ? null : exerciseMap;
  }

  function buildPage66Map(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg066_p031" || narration.length !== 116) return null;
    var section = content.querySelector('[data-section-id="pg066_sec001"]');
    var exercise = section ? section.querySelector(".exercise") : null;
    if (!exercise) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var heading = rawRanges(exercise.querySelector(".banner"));
    var instruction = rawRanges(exercise.querySelector(".intro"));
    var problems = Array.from(exercise.querySelectorAll(".equation"));
    if (heading.length !== 2 || instruction.length !== 6 || problems.length !== 18) return null;

    var mapping = new Array(narration.length).fill(null);
    mapping[0] = heading[0]; mapping[1] = heading[1];
    for (var instructionIndex = 2; instructionIndex <= 7; instructionIndex += 1) mapping[instructionIndex] = instruction[instructionIndex - 2];
    for (var problemIndex = 0; problemIndex < problems.length; problemIndex += 1) {
      var ranges = rawRanges(problems[problemIndex]);
      if (ranges.length !== 5) return null;
      var start = 8 + problemIndex * 6;
      mapping[start] = ranges[0];
      mapping[start + 1] = ranges[0];
      mapping[start + 2] = ranges[1];
      mapping[start + 3] = ranges[2];
      mapping[start + 4] = ranges[3];
      mapping[start + 5] = ranges[4];
    }
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage67ActivityMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg067_p055" || narration.length !== 45) return null;
    var section = content.querySelector('[data-section-id="pg067_sec001"]');
    var layout = section ? section.querySelector(".pg067-layout") : null;
    var web = layout ? layout.querySelector(".pg067-web") : null;
    if (!layout || !web) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var question = rawRanges(layout.querySelector(".pg067-question"));
    var value300 = rawRanges(web.querySelector(".pg067-v300"))[0];
    var value800 = rawRanges(web.querySelector(".pg067-v800"))[0];
    var value200 = rawRanges(web.querySelector(".pg067-v200"))[0];
    var value400 = rawRanges(web.querySelector(".pg067-v400"))[0];
    if (question.length !== 9 || !value300 || !value800 || !value200 || !value400) return null;

    var mapping = new Array(narration.length).fill(web);
    mapping[0] = question[0]; mapping[1] = question[0];
    for (var questionIndex = 2; questionIndex <= 9; questionIndex += 1) mapping[questionIndex] = question[questionIndex - 1];
    mapping[14] = value300;
    mapping[35] = value800;
    mapping[38] = value200;
    mapping[41] = value400;
    return mapping;
  }

  function buildPage68ExampleMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg068_p063" || narration.length !== 74) return null;
    var section = content.querySelector('[data-section-id="pg068_sec001"]');
    var example = section ? section.querySelector(".pg068-example") : null;
    if (!example) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var stepNumber = rawRanges(example.querySelector(".pg068-number"))[0];
    var copy = rawRanges(example.querySelector(".pg068-copy"));
    var vertical = example.querySelector(".pg068-vertical-sum");
    var verticalRanges = rawRanges(vertical);
    var orWord = rawRanges(example.querySelector(".pg068-or"))[0];
    var abacus = example.querySelector(".pg068-abacus");
    var therefore = rawRanges(example.querySelector(".pg068-therefore"));
    if (!stepNumber || copy.length !== 13 || !vertical || verticalRanges.length !== 4 || !orWord || !abacus || therefore.length !== 5) return null;

    var mapping = new Array(narration.length).fill(null);
    mapping[0] = stepNumber; mapping[1] = stepNumber;
    for (var copyIndex = 2; copyIndex <= 14; copyIndex += 1) mapping[copyIndex] = copy[copyIndex - 2];
    for (var verticalIntro = 15; verticalIntro <= 18; verticalIntro += 1) mapping[verticalIntro] = vertical;
    mapping[19] = verticalRanges[0]; mapping[20] = verticalRanges[1]; mapping[21] = verticalRanges[2];
    mapping[22] = vertical; mapping[23] = verticalRanges[3];
    mapping[24] = orWord;
    for (var abacusIndex = 25; abacusIndex <= 68; abacusIndex += 1) mapping[abacusIndex] = abacus;
    for (var thereforeIndex = 69; thereforeIndex <= 73; thereforeIndex += 1) mapping[thereforeIndex] = therefore[thereforeIndex - 69];
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage69ExerciseMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    var settings = {
      pg069_p112: { selector: ".pg069-continuation", first: 7, count: 3, offset: 0, length: 15 },
      pg069_p113: { selector: ".pg069-four", first: 1, count: 9, offset: 8, length: 53 },
      pg069_p114: { selector: ".pg069-five", first: 1, count: 3, offset: 8, length: 23 }
    }[sourceId];
    if (!settings || narration.length !== settings.length) return null;
    var section = content.querySelector('[data-section-id="pg069_sec001"]');
    var card = section ? section.querySelector(settings.selector) : null;
    if (!card) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var mapping = new Array(narration.length).fill(null);
    if (settings.offset) {
      var label = rawRanges(card.querySelector(".pg069-label"));
      var instruction = rawRanges(card.querySelector(".pg069-intro"));
      if (label.length !== 2 || instruction.length !== 6) return null;
      mapping[0] = label[0]; mapping[1] = label[1];
      for (var instructionIndex = 2; instructionIndex <= 7; instructionIndex += 1) mapping[instructionIndex] = instruction[instructionIndex - 2];
    }

    var problems = Array.from(card.querySelectorAll(".pg069-problem"));
    for (var problemIndex = 0; problemIndex < settings.count; problemIndex += 1) {
      var questionNumber = settings.first + problemIndex;
      var problem = problems.find(function (candidate) {
        return parseInt(candidate.querySelector(".pg069-qno").textContent, 10) === questionNumber;
      });
      var ranges = problem ? rawRanges(problem) : [];
      if (ranges.length !== 4) return null;
      var start = settings.offset + problemIndex * 5;
      mapping[start] = ranges[0]; mapping[start + 1] = ranges[0];
      mapping[start + 2] = ranges[1]; mapping[start + 3] = ranges[2]; mapping[start + 4] = ranges[3];
    }
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage70ExampleMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg070_p075" || narration.length !== 79) return null;
    var section = content.querySelector('[data-section-id="pg070_sec001"]');
    var layout = section ? section.querySelector(".pg070-layout") : null;
    var example = layout ? layout.querySelector(".pg070-example") : null;
    if (!layout || !example) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var heading = rawRanges(layout.querySelector(".pg070-heading"));
    var introduction = rawRanges(layout.querySelector(".pg070-intro"));
    var label = rawRanges(example.querySelector(".pg070-label"));
    var equation = rawRanges(example.querySelector(".pg070-equation"));
    var abacus = example.querySelector(".pg070-abacus");
    if (heading.length !== 5 || introduction.length !== 7 || label.length !== 2 || equation.length !== 4 || !abacus) return null;

    var mapping = new Array(narration.length).fill(null);
    for (var headingIndex = 0; headingIndex <= 4; headingIndex += 1) mapping[headingIndex] = heading[headingIndex];
    for (var introIndex = 5; introIndex <= 11; introIndex += 1) mapping[introIndex] = introduction[introIndex - 5];
    mapping[12] = label[0]; mapping[13] = label[1];
    for (var equationIndex = 14; equationIndex <= 17; equationIndex += 1) mapping[equationIndex] = equation[equationIndex - 14];
    for (var abacusIndex = 18; abacusIndex <= 78; abacusIndex += 1) mapping[abacusIndex] = abacus;
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage71Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg071_p029" && sourceId !== "pg071_p030") return null;
    var section = content.querySelector('[data-section-id="pg071_sec001"]');
    var layout = section ? section.querySelector(".pg071-layout") : null;
    if (!layout) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg071_p029") {
      if (narration.length !== 123) return null;
      var continuation = layout.querySelector(".pg071-continuation");
      var heading = continuation ? rawRanges(continuation.querySelector(".pg071-heading"))[0] : null;
      var steps = continuation ? Array.from(continuation.querySelectorAll(".pg071-steps li")) : [];
      var therefore = continuation ? rawRanges(continuation.querySelector(".pg071-therefore")) : [];
      var stepStarts = [1, 27, 48, 67, 75, 89, 103];
      var stepEnds = [26, 47, 66, 74, 88, 102, 116];
      if (!heading || steps.length !== 7 || therefore.length !== 6) return null;

      var stepsMap = new Array(narration.length).fill(null);
      stepsMap[0] = heading;
      for (var stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
        var ranges = rawRanges(steps[stepIndex]);
        var first = stepStarts[stepIndex];
        var last = stepEnds[stepIndex];
        if (ranges.length !== last - first + 1) return null;
        for (var wordIndex = first; wordIndex <= last; wordIndex += 1) {
          stepsMap[wordIndex] = ranges[wordIndex - first];
        }
      }
      for (var endingIndex = 117; endingIndex <= 122; endingIndex += 1) {
        stepsMap[endingIndex] = therefore[endingIndex - 117];
      }
      return stepsMap.some(function (target) { return !target; }) ? null : stepsMap;
    }

    if (narration.length !== 22) return null;
    var example = layout.querySelector(".pg071-example");
    var label = example ? rawRanges(example.querySelector(".pg071-label")) : [];
    var equation = example ? rawRanges(example.querySelector(".pg071-equation")) : [];
    var solutionHeading = example ? rawRanges(example.querySelector(".pg071-solution")) : [];
    var workedEquation = example ? rawRanges(example.querySelector(".pg071-worked-equation")) : [];
    var stepsHeading = example ? rawRanges(example.querySelector(".pg071-heading")) : [];
    var stepNumber = example ? rawRanges(example.querySelector(".pg071-step-number")) : [];
    var stepCopy = example ? rawRanges(example.querySelector(".pg071-step-copy")) : [];
    if (label.length !== 2 || equation.length !== 4 || solutionHeading.length !== 1 || workedEquation.length !== 8 || stepsHeading.length !== 1 || stepNumber.length !== 1 || stepCopy.length !== 9) return null;

    var exampleMap = new Array(narration.length).fill(null);
    exampleMap[0] = label[0]; exampleMap[1] = label[1];
    exampleMap[2] = equation[0]; exampleMap[3] = equation[1]; exampleMap[4] = equation[2];
    exampleMap[5] = solutionHeading[0];
    exampleMap[6] = [workedEquation[0], workedEquation[1], workedEquation[2]];
    exampleMap[7] = workedEquation[3];
    exampleMap[8] = [workedEquation[4], workedEquation[5]];
    exampleMap[9] = workedEquation[6];
    exampleMap[10] = workedEquation[7];
    exampleMap[11] = stepsHeading[0]; exampleMap[12] = stepNumber[0];
    for (var copyIndex = 13; copyIndex <= 21; copyIndex += 1) exampleMap[copyIndex] = stepCopy[copyIndex - 13];
    return exampleMap.some(function (target) { return !target; }) ? null : exampleMap;
  }

  function buildPage72StepsMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg072_p038" || narration.length !== 105) return null;
    var section = content.querySelector('[data-section-id="pg072_sec001"]');
    var frame = section ? section.querySelector(".pg072-frame") : null;
    var rows = frame ? Array.from(frame.querySelectorAll(".pg072-row")) : [];
    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var conclusion = frame ? rawRanges(frame.querySelector(".pg072-conclusion")) : [];
    var starts = [0, 35, 56, 70, 84];
    var ends = [34, 55, 69, 83, 99];
    if (rows.length !== 5 || conclusion.length !== 5) return null;

    var mapping = new Array(narration.length).fill(null);
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      var number = rawRanges(rows[rowIndex].querySelector(".pg072-q"));
      var copy = rawRanges(rows[rowIndex].querySelector(".pg072-copy"));
      var first = starts[rowIndex];
      var last = ends[rowIndex];
      if (number.length !== 1 || copy.length !== last - first) return null;
      mapping[first] = number[0];
      for (var wordIndex = first + 1; wordIndex <= last; wordIndex += 1) {
        mapping[wordIndex] = copy[wordIndex - first - 1];
      }
    }
    for (var endingIndex = 100; endingIndex <= 104; endingIndex += 1) {
      mapping[endingIndex] = conclusion[endingIndex - 100];
    }
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage73ExerciseMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    var settings = {
      pg073_p051: { card: 0, firstProblem: 0, count: 16, heading: true, length: 104 },
      pg073_p052: { card: 1, firstProblem: 0, count: 8, heading: true, length: 56 },
      pg073_p054: { card: 1, firstProblem: 8, count: 8, heading: false, length: 48 }
    }[sourceId];
    if (!settings || narration.length !== settings.length) return null;
    var section = content.querySelector('[data-section-id="pg073_sec001"]');
    var cards = section ? Array.from(section.querySelectorAll(".page73-card")) : [];
    var card = cards[settings.card];
    if (!card) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var mapping = new Array(narration.length).fill(null);
    var offset = 0;
    if (settings.heading) {
      var label = rawRanges(card.querySelector(".page73-label"));
      var instruction = rawRanges(card.querySelector(".page73-instruction"));
      if (label.length !== 2 || instruction.length !== 6) return null;
      mapping[0] = label[0]; mapping[1] = label[1];
      for (var instructionIndex = 2; instructionIndex <= 7; instructionIndex += 1) {
        mapping[instructionIndex] = instruction[instructionIndex - 2];
      }
      offset = 8;
    }

    var problems = Array.from(card.querySelectorAll(".page73-problem")).slice(settings.firstProblem, settings.firstProblem + settings.count);
    if (problems.length !== settings.count) return null;
    for (var problemIndex = 0; problemIndex < problems.length; problemIndex += 1) {
      var ranges = rawRanges(problems[problemIndex]);
      if (ranges.length !== 5) return null;
      var start = offset + problemIndex * 6;
      mapping[start] = ranges[0];
      mapping[start + 1] = ranges[0];
      mapping[start + 2] = ranges[1];
      mapping[start + 3] = ranges[2];
      mapping[start + 4] = ranges[3];
      mapping[start + 5] = ranges[4];
    }
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage74WorkedExampleMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg074_p078" || narration.length !== 121) return null;
    var section = content.querySelector('[data-section-id="pg074_sec001"]');
    var card = section ? section.querySelector(".card") : null;
    if (!card) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var banner = rawRanges(card.querySelector(".banner"));
    var topStack = rawRanges(card.querySelector(".top-stack"));
    var place = card.querySelector(".place");
    var labels = place ? Array.from(place.querySelectorAll(".labels span")).map(function (label) { return rawRanges(label)[0]; }) : [];
    var placeRows = place ? Array.from(place.querySelectorAll(".place-row")) : [];
    var firstRow = placeRows[0] ? rawRanges(placeRows[0]) : [];
    var secondRow = placeRows[1] ? rawRanges(placeRows[1]) : [];
    var resultRow = placeRows[2] ? rawRanges(placeRows[2]) : [];
    var solution = rawRanges(card.querySelector(".solution-title"));
    var stepsHeading = rawRanges(card.querySelector(".steps-title"));
    var steps = Array.from(card.querySelectorAll(".step"));
    var therefore = rawRanges(card.querySelector(".therefore"));
    if (banner.length !== 1 || topStack.length !== 3 || !place || labels.some(function (label) { return !label; }) || labels.length !== 3 || firstRow.length !== 3 || secondRow.length !== 4 || resultRow.length !== 3 || solution.length !== 1 || stepsHeading.length !== 1 || steps.length !== 5 || therefore.length !== 5) return null;

    var mapping = new Array(narration.length).fill(null);
    mapping[0] = banner[0];
    for (var firstNumber = 1; firstNumber <= 4; firstNumber += 1) mapping[firstNumber] = topStack[0];
    mapping[5] = topStack[1];
    for (var secondNumber = 6; secondNumber <= 9; secondNumber += 1) mapping[secondNumber] = topStack[2];
    for (var arrangement = 10; arrangement <= 15; arrangement += 1) mapping[arrangement] = place;
    mapping[16] = labels[0]; mapping[17] = labels[1]; mapping[18] = card.querySelector(".labels"); mapping[19] = labels[2];
    mapping[20] = solution[0];
    for (var solutionFirst = 21; solutionFirst <= 24; solutionFirst += 1) mapping[solutionFirst] = firstRow;
    mapping[25] = secondRow[0];
    for (var solutionSecond = 26; solutionSecond <= 29; solutionSecond += 1) mapping[solutionSecond] = secondRow.slice(1);
    mapping[30] = placeRows[2];
    for (var solutionResult = 31; solutionResult <= 34; solutionResult += 1) mapping[solutionResult] = resultRow;
    mapping[35] = stepsHeading[0];

    var starts = [36, 46, 71, 85, 99];
    var ends = [45, 70, 84, 98, 112];
    for (var stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      var number = rawRanges(steps[stepIndex].querySelector(".number"));
      var copy = rawRanges(steps[stepIndex].querySelector(".copy"));
      var first = starts[stepIndex];
      var last = ends[stepIndex];
      if (number.length !== 1 || copy.length !== last - first) return null;
      mapping[first] = number[0];
      for (var wordIndex = first + 1; wordIndex <= last; wordIndex += 1) {
        mapping[wordIndex] = copy[wordIndex - first - 1];
      }
    }
    mapping[113] = therefore[0]; mapping[114] = therefore[1]; mapping[115] = therefore[2]; mapping[116] = therefore[3];
    for (var conclusionNumber = 117; conclusionNumber <= 120; conclusionNumber += 1) mapping[conclusionNumber] = therefore[4];
    return mapping.some(function (target) { return !target || (Array.isArray(target) && !target.length); }) ? null : mapping;
  }

  function buildPage75ExerciseMap(content, source, narration) {
    var questionsBySource = {
      pg075_p125: [1, 2, 3, 4, 5, 6, 7, 8],
      pg075_p126: [9],
      pg075_p127: [10],
      pg075_p128: [11],
      pg075_p129: [12, 13, 14, 15]
    };
    var id = source.getAttribute("data-id");
    var questionNumbers = questionsBySource[id];
    if (!questionNumbers) return null;
    var section = content.querySelector('[data-section-id="pg075_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var mapping = new Array(narration.length).fill(null);
    var cursor = 0;
    if (id === "pg075_p125") {
      var heading = rawRanges(section.querySelector(".pg075-label"));
      var intro = rawRanges(section.querySelector(".pg075-intro"));
      if (heading.length !== 2 || intro.length !== 6) return null;
      mapping[0] = heading[0]; mapping[1] = heading[1];
      for (var introIndex = 0; introIndex < intro.length; introIndex += 1) mapping[introIndex + 2] = intro[introIndex];
      cursor = 8;
    }

    var problems = Array.from(section.querySelectorAll(".pg075-problem"));
    for (var questionIndex = 0; questionIndex < questionNumbers.length; questionIndex += 1) {
      var questionNumber = questionNumbers[questionIndex];
      var problem = problems.find(function (candidate) {
        return Number.parseInt(candidate.querySelector(".pg075-qno").textContent, 10) === questionNumber;
      });
      var questionRange = problem ? rawRanges(problem.querySelector(".pg075-qno")) : [];
      var sumParts = problem ? problem.querySelectorAll(".pg075-sum > div") : [];
      var minuend = sumParts[0] ? rawRanges(sumParts[0]) : [];
      var subtrahend = sumParts[1] ? rawRanges(sumParts[1]) : [];
      if (!problem || questionRange.length !== 1 || minuend.length !== 1 || subtrahend.length !== 2 || narration[cursor] !== "question") return null;

      var minusIndex = narration.indexOf("minus", cursor + 2);
      var nextQuestion = narration.indexOf("question", minusIndex + 1);
      if (minusIndex < cursor + 2) return null;
      if (nextQuestion < 0) nextQuestion = narration.length;
      mapping[cursor] = questionRange[0];
      mapping[cursor + 1] = questionRange[0];
      for (var minuendIndex = cursor + 2; minuendIndex < minusIndex; minuendIndex += 1) mapping[minuendIndex] = minuend[0];
      mapping[minusIndex] = subtrahend[0];
      for (var subtrahendIndex = minusIndex + 1; subtrahendIndex < nextQuestion; subtrahendIndex += 1) mapping[subtrahendIndex] = subtrahend[1];
      cursor = nextQuestion;
    }
    return cursor === narration.length && mapping.every(Boolean) ? mapping : null;
  }

  function buildPage76Map(content, source, narration) {
    var questionsBySource = {
      pg076_p114: [1, 2, 3],
      pg076_p115: [4, 5, 6],
      pg076_p116: [7, 8, 9],
      pg076_p117: [10, 11, 12],
      pg076_p118: [13, 14, 15]
    };
    var id = source.getAttribute("data-id");
    if (!questionsBySource[id] && id !== "pg076_p119") return null;
    var section = content.querySelector('[data-section-id="pg076_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (id === "pg076_p119") {
      var proseHeading = rawRanges(section.querySelector(".pg076-copy h1"));
      var proseCopy = rawRanges(section.querySelector(".pg076-copy p"));
      if (proseHeading.length !== 4 || proseCopy.length !== 12 || narration.length !== 16) return null;
      return proseHeading.concat(proseCopy);
    }

    var mapping = new Array(narration.length).fill(null);
    var cursor = 0;
    if (id === "pg076_p114") {
      var exerciseHeading = rawRanges(section.querySelector(".pg076-label"));
      var instruction = rawRanges(section.querySelector(".pg076-intro"));
      if (exerciseHeading.length !== 2 || instruction.length !== 6) return null;
      mapping[0] = exerciseHeading[0]; mapping[1] = exerciseHeading[1];
      for (var instructionIndex = 0; instructionIndex < instruction.length; instructionIndex += 1) mapping[instructionIndex + 2] = instruction[instructionIndex];
      cursor = 8;
    }

    var rows = Array.from(section.querySelectorAll(".pg076-problem"));
    var questionNumbers = questionsBySource[id];
    for (var questionIndex = 0; questionIndex < questionNumbers.length; questionIndex += 1) {
      var questionNumber = questionNumbers[questionIndex];
      var row = rows.find(function (candidate) {
        return Number.parseInt(candidate.querySelector(".pg076-qno").textContent, 10) === questionNumber;
      });
      var questionRange = row ? rawRanges(row.querySelector(".pg076-qno")) : [];
      var sumParts = row ? row.querySelectorAll(".pg076-sum > div") : [];
      var minuend = sumParts[0] ? rawRanges(sumParts[0]) : [];
      var subtrahend = sumParts[1] ? rawRanges(sumParts[1]) : [];
      if (!row || questionRange.length !== 1 || minuend.length !== 1 || subtrahend.length !== 2 || narration[cursor] !== "question") return null;
      var minusIndex = narration.indexOf("minus", cursor + 2);
      var nextQuestion = narration.indexOf("question", minusIndex + 1);
      if (minusIndex < cursor + 2) return null;
      if (nextQuestion < 0) nextQuestion = narration.length;
      mapping[cursor] = questionRange[0]; mapping[cursor + 1] = questionRange[0];
      for (var minuendIndex = cursor + 2; minuendIndex < minusIndex; minuendIndex += 1) mapping[minuendIndex] = minuend[0];
      mapping[minusIndex] = subtrahend[0];
      for (var subtrahendIndex = minusIndex + 1; subtrahendIndex < nextQuestion; subtrahendIndex += 1) mapping[subtrahendIndex] = subtrahend[1];
      cursor = nextQuestion;
    }
    return cursor === narration.length && mapping.every(Boolean) ? mapping : null;
  }

  function buildPage77Map(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (id !== "pg077_p033" && id !== "pg077_p034" && id !== "pg077_p035") return null;
    var section = content.querySelector('[data-section-id="pg077_sec001"]');
    var cards = section ? section.querySelectorAll(".pg077-card") : [];
    if (cards.length !== 2) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function fill(mapping, first, last, target) {
      for (var index = first; index <= last; index += 1) mapping[index] = target;
    }

    if (id === "pg077_p033") {
      if (narration.length !== 63) return null;
      var introMap = new Array(63).fill(null);
      var label = rawRanges(cards[0].querySelector(".pg077-label"));
      var question = rawRanges(cards[0].querySelector(".pg077-question"));
      var solution = rawRanges(cards[0].querySelector(".pg077-heading"));
      var facts = rawRanges(cards[0].querySelector(".pg077-facts"));
      if (label.length !== 2 || question.length !== 17 || solution.length !== 1 || facts.length !== 18) return null;
      introMap[0] = label[0]; introMap[1] = label[1];
      introMap[2] = question[0]; introMap[3] = question[1]; fill(introMap, 4, 8, question[2]);
      introMap[9] = question[3]; introMap[10] = question[4]; introMap[11] = question[5]; introMap[12] = question[6]; introMap[13] = question[7]; fill(introMap, 14, 17, question[8]);
      for (var questionTail = 18; questionTail <= 25; questionTail += 1) introMap[questionTail] = question[questionTail - 9];
      introMap[26] = solution[0];
      introMap[27] = facts[0]; introMap[28] = facts[1]; introMap[29] = facts[2]; introMap[30] = facts[3]; fill(introMap, 31, 35, facts[4]);
      for (var givenLabel = 36; givenLabel <= 41; givenLabel += 1) introMap[givenLabel] = facts[givenLabel - 31];
      fill(introMap, 42, 45, facts[11]); introMap[46] = facts[12]; fill(introMap, 47, 51, facts[13]); introMap[52] = facts[14];
      fill(introMap, 53, 56, facts[15]); introMap[57] = facts[16]; fill(introMap, 58, 62, facts[17]);
      return introMap.every(Boolean) ? introMap : null;
    }

    if (id === "pg077_p034") {
      if (narration.length !== 94) return null;
      var stepsMap = new Array(94).fill(null);
      var stepsTitle = rawRanges(cards[0].querySelector(".pg077-steps-title"));
      var steps = cards[0].querySelectorAll(".pg077-step");
      var finalCopy = rawRanges(cards[0].querySelector(".pg077-final"));
      if (stepsTitle.length !== 1 || steps.length !== 3 || finalCopy.length !== 6) return null;
      stepsMap[0] = stepsTitle[0];
      var starts = [1, 27, 54];
      var writes = [9, 35, 62];
      var equationStarts = [15, 41, 68];
      var equationEnds = [26, 53, 83];
      for (var stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
        var stepNumber = rawRanges(steps[stepIndex].querySelector(".pg077-step-number"));
        var copy = rawRanges(steps[stepIndex].querySelector(".pg077-step-copy"));
        if (stepNumber.length !== 1 || copy.length !== 18) return null;
        var start = starts[stepIndex];
        stepsMap[start] = stepNumber[0]; stepsMap[start + 1] = copy[0]; stepsMap[start + 2] = copy[1];
        stepsMap[start + 3] = copy[2]; stepsMap[start + 4] = copy[3]; stepsMap[start + 5] = copy[4]; stepsMap[start + 6] = copy[5]; stepsMap[start + 7] = copy[6];
        for (var writeIndex = writes[stepIndex]; writeIndex < equationStarts[stepIndex]; writeIndex += 1) stepsMap[writeIndex] = copy[writeIndex - writes[stepIndex] + 7];
        fill(stepsMap, equationStarts[stepIndex], equationStarts[stepIndex] + 4, copy[13]);
        stepsMap[equationStarts[stepIndex] + 5] = copy[14];
        fill(stepsMap, equationStarts[stepIndex] + 6, equationEnds[stepIndex] - (stepIndex === 0 ? 2 : stepIndex === 1 ? 3 : 5), copy[15]);
        stepsMap[stepIndex === 0 ? 25 : stepIndex === 1 ? 51 : 78] = copy[16];
        fill(stepsMap, stepIndex === 0 ? 26 : stepIndex === 1 ? 52 : 79, equationEnds[stepIndex], copy[17]);
      }
      stepsMap[84] = finalCopy[0]; stepsMap[85] = finalCopy[1]; stepsMap[86] = finalCopy[2]; stepsMap[87] = finalCopy[3]; fill(stepsMap, 88, 92, finalCopy[4]); stepsMap[93] = finalCopy[5];
      return stepsMap.every(Boolean) ? stepsMap : null;
    }

    if (narration.length !== 89) return null;
    var exampleMap = new Array(89).fill(null);
    var exampleLabel = rawRanges(cards[1].querySelector(".pg077-label"));
    var exampleQuestion = rawRanges(cards[1].querySelector(".pg077-question"));
    var exampleSolution = rawRanges(cards[1].querySelector(".pg077-heading"));
    var exampleFacts = rawRanges(cards[1].querySelector(".pg077-facts"));
    var subtractLabel = rawRanges(cards[1].querySelector(".pg077-subtract-label"));
    var subtraction = cards[1].querySelector(".pg077-subtraction");
    var minuend = rawRanges(subtraction.querySelector(".pg077-minuend"));
    var subtrahend = rawRanges(subtraction.querySelector(".pg077-number-row:nth-child(2)"));
    var answer = rawRanges(subtraction.querySelector(".pg077-answer"));
    var carries = rawRanges(subtraction.querySelectorAll(".pg077-carry")[0]).concat(rawRanges(subtraction.querySelectorAll(".pg077-carry")[1]));
    if (exampleLabel.length !== 2 || exampleQuestion.length !== 16 || exampleSolution.length !== 1 || exampleFacts.length !== 12 || subtractLabel.length !== 1 || minuend.length !== 5 || subtrahend.length !== 4 || answer.length !== 3 || carries.length !== 2) return null;
    exampleMap[0] = exampleLabel[0]; exampleMap[1] = exampleLabel[1]; exampleMap[2] = exampleQuestion[0]; exampleMap[3] = exampleQuestion[1]; exampleMap[4] = exampleQuestion[2]; fill(exampleMap, 5, 9, exampleQuestion[3]);
    exampleMap[10] = exampleQuestion[4]; exampleMap[11] = exampleQuestion[5]; fill(exampleMap, 12, 16, exampleQuestion[6]);
    for (var questionEnd = 17; questionEnd <= 25; questionEnd += 1) exampleMap[questionEnd] = exampleQuestion[questionEnd - 10];
    exampleMap[26] = exampleSolution[0];
    for (var firstFact = 27; firstFact <= 31; firstFact += 1) exampleMap[firstFact] = exampleFacts[firstFact - 27];
    fill(exampleMap, 32, 36, exampleFacts[5]);
    for (var secondFact = 37; secondFact <= 41; secondFact += 1) exampleMap[secondFact] = exampleFacts[secondFact - 31];
    fill(exampleMap, 42, 46, exampleFacts[11]); exampleMap[47] = subtractLabel[0];
    fill(exampleMap, 48, 52, [minuend[0], minuend[2], minuend[4]]); exampleMap[53] = subtrahend[0]; fill(exampleMap, 54, 58, subtrahend.slice(1));
    exampleMap[59] = answer; fill(exampleMap, 60, 63, answer);
    fill(exampleMap, 64, 68, subtraction); fill(exampleMap, 69, 73, carries);
    exampleMap[74] = carries[1]; exampleMap[75] = subtrahend[0]; exampleMap[76] = subtrahend[3]; exampleMap[77] = answer[2]; exampleMap[78] = answer[2];
    exampleMap[79] = carries[0]; exampleMap[80] = subtrahend[0]; exampleMap[81] = subtrahend[2]; exampleMap[82] = answer[1]; exampleMap[83] = answer[1];
    exampleMap[84] = minuend[0]; exampleMap[85] = subtrahend[0]; exampleMap[86] = subtrahend[1]; exampleMap[87] = answer[0]; exampleMap[88] = answer[0];
    return exampleMap.every(Boolean) ? exampleMap : null;
  }

  function buildPage78Map(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (id !== "pg078_p071" && id !== "pg078_p072") return null;
    var section = content.querySelector('[data-section-id="pg078_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (id === "pg078_p071") {
      if (narration.length !== 90) return null;
      var title = rawRanges(section.querySelector(".pg078-title"));
      var rows = section.querySelectorAll(".pg078-row");
      var conclusion = rawRanges(section.querySelector(".pg078-therefore"));
      var expectedCopyLengths = [9, 30, 13, 13, 13];
      if (title.length !== 1 || rows.length !== 5 || conclusion.length !== 6) return null;
      var stepsMap = [title[0]];
      for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        var stepNumber = rawRanges(rows[rowIndex].querySelector(".number"));
        var stepCopy = rawRanges(rows[rowIndex].querySelector(".pg078-text"));
        if (stepNumber.length !== 1 || stepCopy.length !== expectedCopyLengths[rowIndex]) return null;
        stepsMap.push(stepNumber[0]);
        stepsMap.push.apply(stepsMap, stepCopy);
      }
      stepsMap.push.apply(stepsMap, conclusion);
      return stepsMap.length === narration.length && stepsMap.every(Boolean) ? stepsMap : null;
    }

    if (narration.length !== 42) return null;
    var heading = rawRanges(section.querySelector(".pg078-label"));
    var intro = rawRanges(section.querySelector(".pg078-intro"));
    var questions = section.querySelectorAll(".pg078-questions li");
    if (heading.length !== 2 || intro.length !== 5 || questions.length !== 2) return null;
    var firstNumber = rawRanges(questions[0].querySelector(".pg078-qno"));
    var firstQuestion = rawRanges(questions[0].querySelector("span:last-child"));
    var secondNumber = rawRanges(questions[1].querySelector(".pg078-qno"));
    var secondQuestion = rawRanges(questions[1].querySelector("span:last-child"));
    if (firstNumber.length !== 1 || firstQuestion.length !== 14 || secondNumber.length !== 1 || secondQuestion.length < 19) return null;
    var exerciseMap = heading.concat(intro, firstNumber, firstQuestion, secondNumber, secondQuestion.slice(0, 19));
    return exerciseMap.length === narration.length && exerciseMap.every(Boolean) ? exerciseMap : null;
  }

  function buildPage79Map(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg079_p029" || narration.length !== 199) return null;
    var section = content.querySelector('[data-section-id="pg079_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var continuation = rawRanges(section.querySelector(".pg079-continuation"));
    var questions = section.querySelectorAll(".exercise.prose li");
    if (continuation.length !== 6 || questions.length !== 10) return null;
    var mapping = continuation.slice();
    for (var index = 0; index < questions.length; index += 1) {
      var number = rawRanges(questions[index].querySelector(".pg079-qno"));
      if (number.length !== 1) return null;
      mapping.push(number[0]);
      mapping.push.apply(mapping, rawRanges(questions[index].querySelector(".pg079-qtext")));
    }
    return mapping.length === narration.length && mapping.every(Boolean) ? mapping : null;
  }

  function buildPage80Map(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (id !== "pg080_p020" && id !== "pg080_p021" && id !== "pg080_p022") return null;
    var section = content.matches('[data-section-id="pg080_sec001"]') ? content : content.querySelector('[data-section-id="pg080_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function append(mapping, selector) {
      mapping.push.apply(mapping, rawRanges(section.querySelector(selector)));
    }

    if (id === "pg080_p020") {
      if (narration.length !== 67) return null;
      var introMap = [];
      ["pg080_p016", "pg080_p017", "pg080_p015", "pg080_p001", "pg080_p002", "pg080_p003", "pg080_p004", "pg080_p006", "pg080_p007", "pg080_p008"].forEach(function (targetId) {
        append(introMap, '[data-id="' + targetId + '"]');
      });
      introMap.push.apply(introMap, rawRanges(section.querySelectorAll(".step-number")[0]));
      var firstStepCopy = rawRanges(section.querySelector('[data-id="pg080_p009"]'));
      if (firstStepCopy.length !== 10) return null;
      introMap.push.apply(introMap, firstStepCopy);
      append(introMap, '[data-id="pg080_p010"]');
      return introMap.length === narration.length && introMap.every(Boolean) ? introMap : null;
    }

    if (id === "pg080_p022") {
      if (narration.length !== 17) return null;
      var secondStepMap = rawRanges(section.querySelectorAll(".step-number")[1]);
      var secondStepCopy = rawRanges(section.querySelector('[data-id="pg080_p011"]'));
      if (secondStepCopy.length !== 10) return null;
      secondStepMap.push.apply(secondStepMap, secondStepCopy);
      append(secondStepMap, '[data-id="pg080_p012"]');
      return secondStepMap.length === narration.length && secondStepMap.every(Boolean) ? secondStepMap : null;
    }

    if (narration.length !== 6) return null;
    var exampleTwoMap = [];
    append(exampleTwoMap, '[data-id="pg080_p013"]');
    append(exampleTwoMap, '[data-id="pg080_p014"]');
    return exampleTwoMap.length === narration.length && exampleTwoMap.every(Boolean) ? exampleTwoMap : null;
  }

  function buildPage81Map(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (id !== "pg081_p036" && id !== "pg081_p037" && id !== "pg081_p038" && id !== "pg081_p039") return null;
    var section = content.querySelector('[data-section-id="pg081_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var targetsBySource = {
      pg081_p036: ["pg081_p001"],
      pg081_p037: ["pg081_p003", "pg081_p004", "pg081_p005", "pg081_p006"],
      pg081_p038: ["pg081_p012", "pg081_p013", "pg081_p014", "pg081_p015"],
      pg081_p039: ["pg081_p031"]
    };
    var mapping = [];
    targetsBySource[id].forEach(function (targetId) {
      mapping.push.apply(mapping, rawRanges(section.querySelector('[data-id="' + targetId + '"]')));
    });
    return mapping.length === narration.length && mapping.every(Boolean) ? mapping : null;
  }

  function buildPage82Map(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (id !== "pg082_p001" && id !== "pg082_p002" && id !== "pg082_p004" && id !== "pg082_p008" && id !== "pg082_p013" && id !== "pg082_p019" && id !== "pg082_p026" && id !== "pg082_p027" && id !== "pg082_im006") return null;
    var section = content.querySelector('[data-section-id="pg082_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function exact(selector) {
      var mapping = rawRanges(section.querySelector(selector));
      return mapping.every(Boolean) ? mapping : [];
    }

    function mapObjectRow(row, expectedNarration, wordsPerObject) {
      if (!row) return null;
      var mapping = rawRanges(row.querySelector(".pg082-qno"));
      var factor = row.querySelector(".pg082-factor");
      var factorRanges = rawRanges(factor);
      if (factorRanges.length) mapping.push.apply(mapping, factorRanges);
      else {
        var factorBlank = factor ? factor.querySelector(".pg082-blank") : null;
        if (factorBlank) mapping.push(factorBlank);
      }
      var images = row.querySelectorAll(".pg082-objects img");
      var symbols = row.querySelectorAll(".pg082-symbol");
      for (var imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
        for (var wordIndex = 0; wordIndex < wordsPerObject; wordIndex += 1) mapping.push(images[imageIndex]);
        if (symbols[imageIndex]) {
          var symbol = rawRanges(symbols[imageIndex]);
          if (symbol.length !== 1) return null;
          mapping.push(symbol[0]);
        }
      }
      var equals = rawRanges(row.querySelector(".pg082-equals"));
      var blank = row.querySelector(".pg082-answer .pg082-blank");
      var answer = rawRanges(row.querySelector(".pg082-answer > span:last-child"));
      if (equals.length !== 1 || !blank || answer.length !== 1) return [];
      mapping.push(equals[0], blank, answer[0]);
      return mapping.every(Boolean) ? mapping : [];
    }

    if (id === "pg082_p001") return exact(".pg082-exercise .pg082-label");
    if (id === "pg082_p002") return exact(".pg082-instruction");
    if (id === "pg082_p026") return exact(".pg082-heading");
    if (id === "pg082_p027") return exact(".pg082-explanation");

    var rows = section.querySelectorAll(".pg082-row");
    if (id === "pg082_p004") return mapObjectRow(rows[0], narration, 3);
    if (id === "pg082_p008") return mapObjectRow(rows[1], narration, 2);
    if (id === "pg082_p013") return mapObjectRow(rows[2], narration, 2);
    if (id === "pg082_p019") return mapObjectRow(rows[3], narration, 3);

    var example = section.querySelector(".pg082-example");
    var lines = example ? example.querySelectorAll(".pg082-line") : [];
    if (!example || lines.length !== 4) return null;
    var exampleMap = rawRanges(example.querySelector(".pg082-label"));
    exampleMap.push.apply(exampleMap, rawRanges(lines[0]));
    exampleMap.push.apply(exampleMap, rawRanges(example.querySelector("h2")));
    exampleMap.push.apply(exampleMap, rawRanges(lines[1]));
    exampleMap.push.apply(exampleMap, rawRanges(lines[2]));
    exampleMap.push.apply(exampleMap, rawRanges(lines[3]));
    return exampleMap.every(Boolean) ? exampleMap : [];
  }

  function buildPage83Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg083_p001" && id !== "pg083_p007" && id !== "pg083_p013") return null;
    var section = content.querySelector('[data-section-id="pg083_sec001"]');
    if (!section) return [];

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function append(mapping, root) {
      mapping.push.apply(mapping, rawRanges(root));
    }

    var card = id === "pg083_p001"
      ? section.querySelector(".example-two")
      : id === "pg083_p007"
        ? section.querySelector(".example-three")
        : section.querySelector(".example-four");
    if (!card) return [];
    var mapping = [];
    append(mapping, card.querySelector(".pg083-label"));
    append(mapping, card.querySelector(".pg083-equation"));
    append(mapping, card.querySelector(".pg083-solution"));

    if (id === "pg083_p013") {
      var image = card.querySelector(".pg083-array img");
      for (var imageWord = 0; imageWord < 11; imageWord += 1) mapping.push(image);
      append(mapping, card.querySelector(".pg083-array-caption"));
      var notes = card.querySelectorAll(".pg083-diagram-notes p");
      append(mapping, notes[0]);
      append(mapping, notes[1]);
      append(mapping, card.querySelector(".pg083-final"));
      return mapping.every(Boolean) ? mapping : [];
    }

    append(mapping, card.querySelector(".pg083-step"));
    var remaining = card.querySelectorAll(".pg083-step, .pg083-therefore");
    for (var line = 1; line < remaining.length; line += 1) append(mapping, remaining[line]);
    return mapping.every(Boolean) ? mapping : [];
  }

  function buildPage84Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg084_p001" && id !== "pg084_p030") return null;
    var section = content.querySelector('[data-section-id="pg084_sec001"]');
    if (!section) return [];

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function append(mapping, root, limit) {
      var ranges = rawRanges(root);
      mapping.push.apply(mapping, typeof limit === "number" ? ranges.slice(0, limit) : ranges);
    }

    function repeat(mapping, target, count) {
      for (var index = 0; index < count; index += 1) mapping.push(target);
    }

    var mapping = [];
    if (id === "pg084_p030") {
      var exerciseThree = section.querySelector(".pg084-three");
      if (!exerciseThree) return [];
      append(mapping, exerciseThree.querySelector(".pg084-label"));
      append(mapping, exerciseThree.querySelector(".pg084-intro"));
      exerciseThree.querySelectorAll(".pg084-question").forEach(function (question) {
        append(mapping, question.querySelector(".pg084-qno"));
        append(mapping, question.querySelector("span:last-child"));
      });
      return mapping.every(Boolean) ? mapping : [];
    }

    var exerciseTwo = section.querySelector(".pg084-two");
    var rows = exerciseTwo ? exerciseTwo.querySelectorAll("tbody tr") : [];
    if (!exerciseTwo || rows.length !== 10) return [];
    append(mapping, exerciseTwo.querySelector(".pg084-label"));
    append(mapping, exerciseTwo.querySelector(".pg084-intro"));
    append(mapping, rows[0]);

    append(mapping, rows[1].querySelector(".pg084-no"));
    append(mapping, rows[1].querySelector(".pg084-factor"));
    var rowTwoRepeated = rawRanges(rows[1].querySelector(".pg084-repeat"));
    mapping.push.apply(mapping, rowTwoRepeated.slice(0, -1));
    repeat(mapping, rows[1].querySelector(".pg084-answer .pg084-box"), 5);

    append(mapping, rows[2].querySelector(".pg084-no"));
    append(mapping, rows[2].querySelector(".pg084-factor"), 3);
    repeat(mapping, rows[2].querySelector(".pg084-repeat .pg084-box"), 5);
    repeat(mapping, rows[2].querySelector(".pg084-answer .pg084-box"), 4);

    append(mapping, rows[3].querySelector(".pg084-no"));
    repeat(mapping, rows[3].querySelector(".pg084-factor .pg084-box"), 5);
    repeat(mapping, rawRanges(rows[3].querySelector(".pg084-factor"))[0], 2);
    append(mapping, rows[3].querySelector(".pg084-repeat"), 7);
    repeat(mapping, rows[3].querySelector(".pg084-answer .pg084-box"), 5);

    append(mapping, rows[4].querySelector(".pg084-no"));
    repeat(mapping, rows[4].querySelector(".pg084-factor .pg084-box"), 5);
    repeat(mapping, rawRanges(rows[4].querySelector(".pg084-factor"))[0], 2);
    append(mapping, rows[4].querySelector(".pg084-repeat"));
    append(mapping, rows[4].querySelector(".pg084-answer .pg084-box"));

    for (var rowIndex = 5; rowIndex < rows.length; rowIndex += 1) {
      append(mapping, rows[rowIndex].querySelector(".pg084-no"));
      append(mapping, rows[rowIndex].querySelector(".pg084-factor"), 3);
      repeat(mapping, rows[rowIndex].querySelector(".pg084-repeat .pg084-box"), 4);
      repeat(mapping, rows[rowIndex].querySelector(".pg084-answer .pg084-box"), 4);
    }
    return mapping.every(Boolean) ? mapping : [];
  }

  function buildPage85Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg085_p001" && id !== "pg085_p037") return null;
    var section = content.querySelector('[data-section-id="pg085_sec001"]');
    if (!section) return [];

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function append(mapping, root) {
      mapping.push.apply(mapping, rawRanges(root));
    }

    function repeat(mapping, target, count) {
      for (var index = 0; index < count; index += 1) mapping.push(target);
    }

    var mapping = [];
    if (id === "pg085_p001") {
      var exercise = section.querySelector(".pg085-exercise");
      var table = exercise && exercise.querySelector(".pg085-table");
      var headerCells = table && table.querySelectorAll("thead th");
      var bodyRows = table && table.querySelectorAll("tbody tr");
      if (!exercise || !table || !headerCells || headerCells.length !== 10 || !bodyRows || bodyRows.length !== 9) return [];

      append(mapping, exercise.querySelector(".pg085-label"));
      append(mapping, exercise.querySelector(".pg085-prompt"));
      repeat(mapping, headerCells[0], 2);
      repeat(mapping, Array.from(headerCells), 4);
      for (var column = 1; column < headerCells.length; column += 1) append(mapping, headerCells[column]);

      var rowHeaders = Array.from(bodyRows, function (row) { return row.querySelector("th"); });
      repeat(mapping, rowHeaders, 4);
      rowHeaders.forEach(function (header) { append(mapping, header); });

      var givenCells = Array.from(table.querySelectorAll("td.given"));
      repeat(mapping, givenCells, 4);
      for (var rowIndex = 0; rowIndex < 3; rowIndex += 1) {
        var rowHeader = bodyRows[rowIndex].querySelector("th");
        repeat(mapping, rowHeader, 2);
        bodyRows[rowIndex].querySelectorAll("td.given").forEach(function (cell) { append(mapping, cell); });
      }
      return mapping.length === 64 && mapping.every(Boolean) ? mapping : [];
    }

    var example = section.querySelector(".pg085-example");
    if (!example) return [];
    append(mapping, section.querySelector(".pg085-heading"));
    append(mapping, section.querySelector(".pg085-intro"));
    append(mapping, example.querySelector(".pg085-label"));
    append(mapping, example.querySelector(".pg085-equation"));
    append(mapping, example.querySelector(".pg085-steps-title"));
    example.querySelectorAll(".pg085-step").forEach(function (step) {
      append(mapping, step.querySelector(".pg085-step-number"));
      append(mapping, step.querySelector("p"));
    });
    append(mapping, example.querySelector(".pg085-therefore"));
    return mapping.length === 63 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage86ExerciseMap(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg086_p009" && id !== "pg086_p013") return null;
    var section = content.querySelector('[data-section-id="pg086_sec001"]');
    var exercise = section && section.querySelector(".pg086-exercise");
    if (!exercise) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    if (id === "pg086_p009") {
      append(mapping, exercise.querySelector(".pg086-label"));
      append(mapping, exercise.querySelector(".pg086-intro"));
    }
    var column = exercise.querySelector(id === "pg086_p009" ? ".pg086-column:first-child" : ".pg086-column:last-child");
    if (!column) return [];
    column.querySelectorAll(".pg086-problem").forEach(function (problem) {
      append(mapping, problem.querySelector(".pg086-number"));
      append(mapping, problem.querySelector("span:last-child"));
    });
    var expectedLength = id === "pg086_p009" ? 43 : 35;
    return mapping.length === expectedLength && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage87Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg087_p001" && id !== "pg087_p013" && id !== "pg087_p025") return null;
    var section = content.querySelector('[data-section-id="pg087_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    if (id === "pg087_p025") {
      var exercise = section.querySelector(".pg087-exercise");
      if (!exercise) return [];
      append(mapping, exercise.querySelector(".pg087-label"));
      append(mapping, exercise.querySelector(".pg087-intro"));
      exercise.querySelectorAll(".pg087-problem").forEach(function (problem) {
        append(mapping, problem.querySelector(".pg087-qno"));
        append(mapping, problem.querySelector(".pg087-stack"));
      });
      return mapping.length === 24 && mapping.every(Boolean) ? mapping : [];
    }

    var example = section.querySelector(id === "pg087_p001" ? ".pg087-example:not(.pg087-example-two)" : ".pg087-example-two");
    if (!example) return [];
    append(mapping, example.querySelector(".pg087-label"));
    append(mapping, example.querySelector(".pg087-stack"));
    append(mapping, example.querySelector(".pg087-steps h2"));
    example.querySelectorAll(".pg087-step").forEach(function (step) {
      append(mapping, step.querySelector(".pg087-num"));
      append(mapping, step.querySelector("p"));
    });
    append(mapping, example.querySelector(".pg087-therefore"));
    return mapping.length === 45 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage88Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg088_p001" && id !== "pg088_p037" && id !== "pg088_p045" && id !== "pg088_p047") return null;
    var section = content.querySelector('[data-section-id="pg088_sec001"]');
    if (!section) return [];

    function rawRanges(root) {
      var ranges = [];
      if (!root) return ranges;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function append(mapping, root) {
      mapping.push.apply(mapping, rawRanges(root));
    }

    function whole(root) {
      if (!root) return null;
      var range = document.createRange();
      range.selectNodeContents(root);
      return range;
    }

    var mapping = [];
    if (id === "pg088_p001") {
      var problems = section.querySelectorAll(".problem");
      if (problems.length !== 6) return [];
      problems.forEach(function (problem) {
        append(mapping, problem.querySelector(".qno"));
        mapping.push(whole(problem.querySelector(".top-number")));
        append(mapping, problem.querySelector(".multiplier"));
      });
      return mapping.length === 24 && mapping.every(Boolean) ? mapping : [];
    }

    if (id === "pg088_p037") {
      append(mapping, section.querySelector(".title"));
      rawRanges(section.querySelector(".explanation")).forEach(function (range) {
        mapping.push(range);
        if (normalizeWord(range.toString()) === "comeback") mapping.push(range);
      });
      return mapping.length === 77 && mapping.every(Boolean) ? mapping : [];
    }

    var example = section.querySelector(id === "pg088_p045" ? ".example:first-child" : ".example:last-child");
    if (!example) return [];
    append(mapping, example.querySelector(".label"));
    append(mapping, example.querySelector(".equation"));
    var expectedLength = id === "pg088_p045" ? 7 : 6;
    return mapping.length === expectedLength && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage89Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg089_p001" && id !== "pg089_p007" && id !== "pg089_p020") return null;
    var section = content.querySelector('[data-section-id="pg089_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    function whole(root) {
      if (!root) return null;
      var range = document.createRange();
      range.selectNodeContents(root);
      return range;
    }

    var mapping = [];
    if (id === "pg089_p001") {
      var solution = section.querySelector(".pg089-solution");
      if (!solution) return [];
      append(mapping, solution.querySelector("h1"));
      solution.querySelectorAll("p").forEach(function (paragraph) { append(mapping, paragraph); });
      return mapping.length === 33 && mapping.every(Boolean) ? mapping : [];
    }

    if (id === "pg089_p007") {
      var example = section.querySelector(".pg089-example");
      var stacks = example && example.querySelectorAll(".pg089-stack");
      if (!example || !stacks || stacks.length !== 2) return [];
      append(mapping, example.querySelector(".pg089-label"));
      mapping.push(whole(stacks[0].querySelector(".pg089-top")));
      append(mapping, stacks[0].querySelector(".pg089-factor"));
      append(mapping, example.querySelector(".pg089-therefore"));
      mapping.push(whole(stacks[1].querySelector(".pg089-top")));
      append(mapping, stacks[1].querySelector(".pg089-factor"));
      mapping.push(stacks[1].querySelector(".pg089-rule"));
      var resultRows = stacks[1].querySelectorAll(".pg089-top");
      mapping.push(whole(resultRows[1]));
      return mapping.length === 11 && mapping.every(Boolean) ? mapping : [];
    }

    var exercise = section.querySelector(".pg089-exercise");
    var problems = exercise && exercise.querySelectorAll(".pg089-problem");
    if (!exercise || !problems || problems.length !== 10) return [];
    append(mapping, exercise.querySelector(".pg089-label"));
    append(mapping, exercise.querySelector(".pg089-instruction"));
    problems.forEach(function (problem, index) {
      append(mapping, problem.querySelector(".pg089-number"));
      if (index < 4) {
        mapping.push(whole(problem.querySelector(".pg089-top")));
        append(mapping, problem.querySelector(".pg089-factor"));
      } else {
        append(mapping, problem.querySelector(".pg089-inline"));
      }
    });
    return mapping.length === 54 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage90Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg090_p001" && id !== "pg090_p004" && id !== "pg090_p014") return null;
    var section = content.querySelector('[data-section-id="pg090_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    function whole(root) {
      if (!root) return null;
      var range = document.createRange();
      range.selectNodeContents(root);
      return range;
    }

    var mapping = [];
    if (id === "pg090_p001") {
      append(mapping, section.querySelector(".pg090-title"));
      append(mapping, section.querySelector(".pg090-intro"));
      return mapping.length === 16 && mapping.every(Boolean) ? mapping : [];
    }

    var card = section.querySelector(id === "pg090_p004" ? ".pg090-card-one" : ".pg090-card-two");
    if (!card) return [];
    append(mapping, card.querySelector(".pg090-label"));
    append(mapping, card.querySelector(".pg090-question"));
    append(mapping, card.querySelector(".pg090-solution-title"));
    if (id === "pg090_p004") {
      card.querySelectorAll(".pg090-line").forEach(function (line) { append(mapping, line); });
      append(mapping, card.querySelector(".pg090-therefore"));
      return mapping.length === 65 && mapping.every(Boolean) ? mapping : [];
    }

    var grid = card.querySelector(".pg090-solution-grid");
    var stack = grid && grid.querySelector(".pg090-stack");
    var rows = stack && stack.querySelectorAll(".pg090-stack-row");
    var rules = stack && stack.querySelectorAll(".pg090-stack-rule");
    if (!grid || !stack || !rows || rows.length !== 3 || !rules || rules.length !== 2) return [];
    grid.querySelectorAll(":scope > div:first-child .pg090-line").forEach(function (line) { append(mapping, line); });
    mapping.push(whole(rows[0]));
    append(mapping, rows[1]);
    mapping.push(rules[0]);
    mapping.push(whole(rows[2]));
    append(mapping, card.querySelector(".pg090-therefore"));
    return mapping.length === 50 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage91Map(content, source) {
    if (source.getAttribute("data-id") !== "pg091_p001") return null;
    var section = content.querySelector('[data-section-id="pg091_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    append(mapping, section.querySelector(".exercise-label"));
    append(mapping, section.querySelector(".intro"));
    section.querySelectorAll(".question").forEach(function (question) {
      append(mapping, question.querySelector(".question-number"));
      append(mapping, question.querySelector("p"));
    });
    return mapping.length === 210 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage92Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg092_p001" && id !== "pg092_p004") return null;
    var section = content.querySelector('[data-section-id="pg092_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    function repeat(mapping, target, count) {
      for (var index = 0; index < count; index += 1) mapping.push(target);
    }

    var mapping = [];
    if (id === "pg092_p001") {
      var question = section.querySelector(".question-box");
      if (!question) return [];
      append(mapping, question.querySelector(".question-number"));
      append(mapping, question.querySelector(".question-copy"));
      return mapping.length === 24 && mapping.every(Boolean) ? mapping : [];
    }

    var example = section.querySelector(".example-card");
    var images = example && example.querySelectorAll(".app-shots img");
    if (!example || !images || images.length !== 2) return [];
    append(mapping, section.querySelector(".topic-title"));
    append(mapping, section.querySelector(".topic-copy"));
    append(mapping, example.querySelector(".example-label"));
    append(mapping, example.querySelector(".equation"));
    append(mapping, example.querySelector(".solution-title"));
    append(mapping, example.querySelector(".solution-copy"));
    repeat(mapping, images[0], 9);
    repeat(mapping, images[1], 9);
    append(mapping, example.querySelector(".steps-title"));
    example.querySelectorAll(".steps li").forEach(function (step) {
      append(mapping, step.querySelector(".step-number"));
      append(mapping, step.querySelector("span:last-child"));
    });
    return mapping.length === 106 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage93Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg093_p001" && id !== "pg093_p009") return null;
    var section = content.matches('[data-section-id="pg093_sec001"]')
      ? content
      : content.querySelector('[data-section-id="pg093_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    if (id === "pg093_p001") {
      append(mapping, section.querySelector(".chapter-label"));
      append(mapping, section.querySelector(".chapter-title"));
      append(mapping, section.querySelector(".heading"));
      section.querySelectorAll(".intro, .rounds").forEach(function (paragraph) {
        append(mapping, paragraph);
      });
      return mapping.length === 74 && mapping.every(Boolean) ? mapping : [];
    }

    append(mapping, section.querySelector(".example-title"));
    append(mapping, section.querySelector(".question"));
    append(mapping, section.querySelector(".steps-title"));
    append(mapping, section.querySelector(".step-number"));
    append(mapping, section.querySelector(".step span:last-child"));
    var image = section.querySelector(".stars");
    for (var index = 0; image && index < 10; index += 1) mapping.push(image);
    return mapping.length === 37 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage95Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg095_p001" && id !== "pg095_p009") return null;
    var section = content.querySelector('[data-section-id="pg095_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    if (id === "pg095_p001") {
      append(mapping, section.querySelector(".activity-label"));
      append(mapping, section.querySelector(".activity-intro"));
      section.querySelectorAll(".questions li").forEach(function (question) {
        append(mapping, question.querySelector(".question-number"));
        append(mapping, question.querySelector(".question-copy"));
      });
      return mapping.length === 56 && mapping.every(Boolean) ? mapping : [];
    }

    append(mapping, section.querySelector(".topic"));
    append(mapping, section.querySelector(".example-label"));
    append(mapping, section.querySelector(".prompt"));
    append(mapping, section.querySelector(".solution"));
    append(mapping, section.querySelector(".explanation"));
    append(mapping, section.querySelector(".equation"));
    var diagram = section.querySelector(".diagram");
    for (var index = 0; diagram && index < 15; index += 1) mapping.push(diagram);
    section.querySelectorAll(".conclusion").forEach(function (conclusion) {
      append(mapping, conclusion);
    });
    return mapping.length === 64 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage96Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg096_p001" && id !== "pg096_p015") return null;
    var section = content.querySelector('[data-section-id="pg096_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var card = section.querySelector(id === "pg096_p001" ? ".pg096-card:first-child" : ".pg096-card-three");
    if (!card) return [];
    var mapping = [];
    append(mapping, card.querySelector(".pg096-banner"));
    append(mapping, card.querySelector(".pg096-prompt"));
    append(mapping, card.querySelector(".pg096-solution"));
    if (id === "pg096_p001") append(mapping, card.querySelector(".pg096-equation"));
    var diagram = card.querySelector(id === "pg096_p001" ? ".pg096-table" : ".pg096-object-table");
    var descriptionLength = id === "pg096_p001" ? 21 : 15;
    for (var index = 0; diagram && index < descriptionLength; index += 1) mapping.push(diagram);
    card.querySelectorAll(".pg096-result").forEach(function (result) {
      append(mapping, result);
    });
    var expectedLength = id === "pg096_p001" ? 56 : 38;
    return mapping.length === expectedLength && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage97Map(content, source) {
    if (source.getAttribute("data-id") !== "pg097_p001") return null;
    var section = content.querySelector('[data-section-id="pg097_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    append(mapping, section.querySelector(".banner"));
    append(mapping, section.querySelector(".intro"));
    var descriptionLengths = [11, 5, 5, 5];
    section.querySelectorAll(".problem").forEach(function (problem, problemIndex) {
      append(mapping, problem.querySelector(".number"));
      var pictures = problem.querySelector(".pictures");
      for (var index = 0; pictures && index < descriptionLengths[problemIndex]; index += 1) mapping.push(pictures);
      append(mapping, problem.querySelector(".equation"));
    });
    return mapping.length === 56 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage98Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg098_p001" && id !== "pg098_p003" && id !== "pg098_p016") return null;
    var section = content.querySelector('[data-section-id="pg098_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    if (id === "pg098_p001") {
      append(mapping, section.querySelector(".pg098-qno"));
      var bottles = section.querySelector(".pg098-bottles");
      for (var bottleIndex = 0; bottles && bottleIndex < 6; bottleIndex += 1) mapping.push(bottles);
      append(mapping, section.querySelector(".pg098-picture-equation"));
      return mapping.length === 11 && mapping.every(Boolean) ? mapping : [];
    }

    var examples = section.querySelectorAll(".pg098-example");
    var example = id === "pg098_p003" ? examples[0] : examples[1];
    if (!example) return [];
    if (id === "pg098_p003") {
      append(mapping, section.querySelector(".pg098-heading"));
      append(mapping, section.querySelector(".pg098-intro"));
    }
    append(mapping, example.querySelector(".pg098-banner"));
    append(mapping, example.querySelector(":scope > p:first-of-type"));
    append(mapping, example.querySelector(".pg098-solution"));
    var instruction = example.querySelector(".pg098-solution + p");
    append(mapping, instruction);
    if (id === "pg098_p003") {
      example.querySelectorAll(".pg098-steps p").forEach(function (step) { append(mapping, step); });
      append(mapping, example.querySelector(".pg098-conclusion"));
      return mapping.length === 64 && mapping.every(Boolean) ? mapping : [];
    }
    return mapping.length === 12 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage99Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg099_p001" && id !== "pg099_p005" && id !== "pg099_p027") return null;
    var section = content.querySelector('[data-section-id="pg099_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    if (id === "pg099_p001") {
      append(mapping, section.querySelector(".pg099-worked"));
      return mapping.length === 23 && mapping.every(Boolean) ? mapping : [];
    }

    var exercise = section.querySelector(id === "pg099_p005" ? ".pg099-exercise-two" : ".pg099-exercise-three");
    if (!exercise) return [];
    append(mapping, exercise.querySelector(".pg099-label"));
    append(mapping, exercise.querySelector(".pg099-intro"));
    Array.from(exercise.querySelectorAll(".pg099-problem"))
      .sort(function (left, right) {
        return Number.parseInt(left.querySelector(".pg099-qno").textContent, 10) - Number.parseInt(right.querySelector(".pg099-qno").textContent, 10);
      })
      .forEach(function (problem) {
        append(mapping, problem.querySelector(".pg099-qno"));
        append(mapping, problem.querySelector(".pg099-equation"));
      });
    var expectedLength = id === "pg099_p005" ? 85 : 83;
    return mapping.length === expectedLength && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage100Map(content, source) {
    var id = source.getAttribute("data-id");
    if (id !== "pg100_p001" && id !== "pg100_p013" && id !== "pg100_p020") return null;
    var section = content.querySelector('[data-section-id="pg100_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    if (id === "pg100_p001") {
      append(mapping, section.querySelector(".pg100-heading"));
      append(mapping, section.querySelector(".pg100-intro"));
      append(mapping, section.querySelector(".pg100-example-one"));
      return mapping.length === 65 && mapping.every(Boolean) ? mapping : [];
    }
    if (id === "pg100_p013") {
      append(mapping, section.querySelector(".pg100-example-two"));
      return mapping.length === 34 && mapping.every(Boolean) ? mapping : [];
    }
    append(mapping, section.querySelector(".pg100-exercise .pg100-banner"));
    append(mapping, section.querySelector(".pg100-exercise-intro"));
    append(mapping, section.querySelector(".pg100-question-row .pg100-number"));
    append(mapping, section.querySelector(".pg100-question-row p"));
    return mapping.length === 23 && mapping.every(Boolean) ? mapping : [];
  }

  function buildPage101Map(content, source) {
    if (source.getAttribute("data-id") !== "pg101_p001") return null;
    var section = content.querySelector('[data-section-id="pg101_sec001"]');
    if (!section) return [];

    function append(mapping, root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          mapping.push(range);
        }
      }
    }

    var mapping = [];
    section.querySelectorAll(".pg101-question").forEach(function (question) {
      append(mapping, question.querySelector(".pg101-qno"));
      append(mapping, question.querySelector(".pg101-copy"));
    });
    return mapping.length === 178 && mapping.every(Boolean) ? mapping : [];
  }

  function buildMap(content, source) {
    var narration = collectNarrationTokens(source);
    return buildPage23TableMap(content, source, narration) || buildPage24AnswerBlankMap(content, source, narration) || buildPage25AnswerBlankMap(content, source, narration) || buildPage27AnswerBlankMap(content, source, narration) || buildPage28ExerciseRowMap(content, source, narration) || buildPage29ExerciseDiagramMap(content, source, narration) || buildPage30ExerciseMap(content, source, narration) || buildPage31AnswerBlankMap(content, source, narration) || buildPage36TableMap(content, source, narration) || buildPage37ChapterBannerMap(content, source, narration) || buildPage37ExampleMap(content, source, narration) || buildPage39ModelMap(content, source, narration) || buildPage40ModelMap(content, source, narration) || buildPage41ModelMap(content, source, narration) || buildPage45SolutionMap(content, source, narration) || buildPage46ExerciseMap(content, source, narration) || buildPage47ExerciseMap(content, source, narration) || buildPage48Map(content, source, narration) || buildPage49Map(content, source, narration) || buildPage50Map(content, source, narration) || buildPage51Map(content, source, narration) || buildPage52Map(content, source, narration) || buildPage53Exercise8Map(content, source, narration) || buildPage54ChartMap(content, source, narration) || buildPage55Map(content, source, narration) || buildPage56SequenceMap(content, source, narration) || buildPage57Map(content, source, narration) || buildPage58QuestionMap(content, source, narration) || buildPage59FishNumberMap(content, source, narration) || buildPage60Step2Map(content, source, narration) || buildPage63ExampleMap(content, source, narration) || buildPage64StepsMap(content, source, narration) || buildPage65Map(content, source, narration) || buildPage66Map(content, source, narration) || buildPage67ActivityMap(content, source, narration) || buildPage68ExampleMap(content, source, narration) || buildPage69ExerciseMap(content, source, narration) || buildPage70ExampleMap(content, source, narration) || buildPage71Map(content, source, narration) || buildPage72StepsMap(content, source, narration) || buildPage73ExerciseMap(content, source, narration) || buildPage74WorkedExampleMap(content, source, narration) || buildPage75ExerciseMap(content, source, narration) || buildPage76Map(content, source, narration) || buildPage77Map(content, source, narration) || buildPage78Map(content, source, narration) || buildPage79Map(content, source, narration) || buildPage80Map(content, source, narration) || buildPage81Map(content, source, narration) || buildPage82Map(content, source, narration) || buildPage83Map(content, source, narration) || buildPage84Map(content, source, narration) || buildPage85Map(content, source, narration) || buildPage86ExerciseMap(content, source, narration) || buildPage87Map(content, source, narration) || buildPage88Map(content, source, narration) || buildPage89Map(content, source, narration) || buildPage90Map(content, source, narration) || buildPage91Map(content, source, narration) || buildPage92Map(content, source, narration) || buildPage93Map(content, source, narration) || buildPage94ShareMap(content, source, narration) || buildPage95Map(content, source, narration) || buildPage96Map(content, source, narration) || buildPage97Map(content, source, narration) || buildPage98Map(content, source, narration) || buildPage99Map(content, source, narration) || buildPage100Map(content, source, narration) || buildPage101Map(content, source, narration) || alignTokens(narration, collectVisibleTokens(content));
  }

  function usableRect(range) {
    if (!range) return null;
    var rects = Array.from(range.getClientRects()).filter(function (rect) {
      return rect.width > 0 && rect.height > 0;
    });
    return rects[0] || null;
  }

  function mergeLineRects(rects) {
    var sorted = rects.slice().sort(function (a, b) {
      return Math.abs(a.top - b.top) < 3 ? a.left - b.left : a.top - b.top;
    });
    var merged = [];
    sorted.forEach(function (rect) {
      var previous = merged[merged.length - 1];
      if (previous && Math.abs(previous.top - rect.top) < 3 && rect.left - previous.right < 8) {
        previous.right = Math.max(previous.right, rect.right);
        previous.bottom = Math.max(previous.bottom, rect.bottom);
        previous.width = previous.right - previous.left;
        previous.height = previous.bottom - previous.top;
      } else {
        merged.push({
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        });
      }
    });
    return merged;
  }

  function drawRects(rects, source, wordIndex, blockMode) {
    if (window.CSS && CSS.highlights) CSS.highlights.delete(CUSTOM_HIGHLIGHT_NAME);
    var marker = getMarker();
    marker.replaceChildren();
    marker.classList.toggle("adt-block-highlight", blockMode);
    marker.removeAttribute("data-custom-highlight");
    marker.setAttribute("data-source-id", source.getAttribute("data-id") || "");
    if (wordIndex === null) marker.removeAttribute("data-word-index");
    else marker.setAttribute("data-word-index", String(wordIndex));

    rects.forEach(function (rect) {
      var span = document.createElement("span");
      span.style.left = rect.left - 1 + "px";
      span.style.top = rect.top - 1 + "px";
      span.style.width = rect.width + 2 + "px";
      span.style.height = rect.height + 2 + "px";
      marker.appendChild(span);
    });
  }

  function drawWord(target, source, wordIndex) {
    var ranges = Array.isArray(target) ? target : [target];
    var hasElementTarget = ranges.some(function (item) {
      return item && item.nodeType === Node.ELEMENT_NODE;
    });
    if (!hasElementTarget && window.CSS && CSS.highlights && typeof window.Highlight === "function") {
      var marker = getMarker();
      marker.replaceChildren();
      marker.classList.remove("adt-block-highlight");
      marker.setAttribute("data-source-id", source.getAttribute("data-id") || "");
      marker.setAttribute("data-word-index", String(wordIndex));
      marker.setAttribute("data-custom-highlight", "true");
      CSS.highlights.set(CUSTOM_HIGHLIGHT_NAME, new Highlight(...ranges));
      return;
    }
    var rects = ranges.map(usableRect).filter(Boolean);
    if (rects.length) drawRects(rects, source, wordIndex, false);
  }

  function render() {
    scheduled = 0;
    var content = document.getElementById(CONTENT_ID);
    if (!content) {
      clearMarker();
      return;
    }
    syncPage36InstructionHighlight(content);
    var active = findActiveNarration(content);
    if (!active) {
      currentSource = null;
      currentMode = "";
      currentMap = null;
      clearMarker();
      return;
    }

    var sourceChanged = active.source !== currentSource || active.mode !== currentMode || !currentMap;
    if (sourceChanged) {
      clearMarker();
      currentSource = active.source;
      currentMode = active.mode;
      currentMap = buildMap(content, active.source);
    }

    if (active.mode === "word") {
      var index = Number(active.word.getAttribute("data-word-index"));
      var target = currentMap[index];
      var usable = (Array.isArray(target) ? target : [target]).some(function (item) { return usableRect(item); });
      if (usable) drawWord(target, active.source, index);
      else {
        var marker = document.getElementById(MARKER_ID);
        var samePassage = marker && marker.getAttribute("data-source-id") === (active.source.getAttribute("data-id") || "");
        var hasHighlight = marker && (marker.children.length || marker.getAttribute("data-custom-highlight") === "true");
        if (!samePassage || !hasHighlight) clearMarker();
      }
      return;
    }

    var rects = currentMap.flatMap(function (target) {
      return (Array.isArray(target) ? target : [target]).map(usableRect).filter(Boolean);
    });
    if (rects.length) drawRects(mergeLineRects(rects), active.source, null, true);
    else clearMarker();
  }

  function schedule() {
    if (!scheduled) scheduled = window.setTimeout(render, 0);
  }

  function start() {
    var content = document.getElementById(CONTENT_ID);
    if (!content) {
      requestAnimationFrame(start);
      return;
    }
    new MutationObserver(schedule).observe(content, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("adt:dock-resize", schedule);
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
