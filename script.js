(() => {
  "use strict";

  const ROOT_FONT_SIZE = 16;

  const DEFAULTS = {
    minSize: 0, maxSize: 0,
    minBp: 320, maxBp: 1440,
    unit: "rem", previewVw: 880, defaultVw: 880, mode: "text",
  };

  const state = {
    minSize: 0, maxSize: 0,
    minBp: 320, maxBp: 1440,
    unit: "rem",
    previewVw: 880,
    // the viewport the user typed — what ⟲ returns to. Distinct from
    // previewVw, which the slider moves freely.
    defaultVw: 880,
    mode: "text",
    copied: false,
  };

  const el = {
    previewText: document.getElementById("previewText"),
    previewElement: document.getElementById("previewElement"),
    previewStage: document.querySelector(".preview-stage"),
    slider: document.getElementById("viewportSlider"),
    viewportInput: document.getElementById("viewportInput"),
    viewportReset: document.getElementById("viewportReset"),
    renderedLabel: document.getElementById("renderedLabel"),
    minSize: document.getElementById("minSize"),
    maxSize: document.getElementById("maxSize"),
    minBp: document.getElementById("minBp"),
    maxBp: document.getElementById("maxBp"),
    output: document.getElementById("output"),
    copyBtn: document.getElementById("copyBtn"),
    clearBtn: document.getElementById("clearBtn"),
    warn: document.getElementById("warn"),
    wordmark: document.getElementById("wordmark"),
    modeButtons: document.querySelectorAll(".seg[data-mode]"),
    unitButtons: document.querySelectorAll(".seg[data-unit]"),
  };

  let copyTimer = null;
  let tipDismissed = false;

  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const fmt = (n) => (!isFinite(n) ? "0" : parseFloat(n.toFixed(3)).toString());

  // Treat x / X / × as multiplication. Only meaningful between two operands,
  // so a bare "x" or a trailing "12x" stays invalid rather than silently
  // becoming something else.
  const normalizeOps = (s) => String(s).replace(/[x×X]/g, "*");

  // Safe arithmetic: evaluates + - * / ( ) and decimals only.
  // Returns a number, or null if the expression isn't valid.
  // Safe arithmetic: evaluates + - * / ( ) and decimals only.
  // Also accepts x and × as multiplication — common in many locales.
  // Returns a number, or null if the expression isn't valid.
  function evalExpr(input) {
    const src = normalizeOps(String(input).trim());
    if (src === "") return null;
    if (!/^[0-9+\-*/().\s]+$/.test(src)) return null;
    let i = 0;
    const peek = () => src[i];
    const skip = () => { while (/\s/.test(src[i])) i++; };
    function parseExpr() {
      let v = parseTerm();
      skip();
      while (peek() === "+" || peek() === "-") {
        const op = src[i++];
        const t = parseTerm();
        v = op === "+" ? v + t : v - t;
        skip();
      }
      return v;
    }
    function parseTerm() {
      let v = parseFactor();
      skip();
      while (peek() === "*" || peek() === "/") {
        const op = src[i++];
        const f = parseFactor();
        v = op === "*" ? v * f : v / f;
        skip();
      }
      return v;
    }
    function parseFactor() {
      skip();
      if (peek() === "+") { i++; return parseFactor(); }
      if (peek() === "-") { i++; return -parseFactor(); }
      if (peek() === "(") {
        i++;
        const v = parseExpr();
        skip();
        if (peek() !== ")") throw new Error("unbalanced");
        i++;
        return v;
      }
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!m) throw new Error("expected number");
      i += m[0].length;
      return parseFloat(m[0]);
    }
    try {
      const result = parseExpr();
      skip();
      if (i !== src.length) return null;
      return isFinite(result) ? result : null;
    } catch (e) {
      return null;
    }
  }

  function geom() {
    const { minSize, maxSize, minBp, maxBp } = state;
    const span = (maxBp - minBp) || 1;
    const slopePx = (maxSize - minSize) / span;
    const slopeVw = slopePx * 100;
    const interceptPx = minSize - slopePx * minBp;
    const lo = Math.min(minSize, maxSize);
    const hi = Math.max(minSize, maxSize);
    const sizeAt = (vw) => Math.max(lo, Math.min(hi, interceptPx + slopePx * vw));
    return { slopeVw, interceptPx, sizeAt };
  }

  // Returns a warning {html} if the inputs won't produce a sane clamp, else null.
  function problem() {
    const { minSize, maxSize, minBp, maxBp } = state;
    if (minBp === maxBp) return { text: "Min and max breakpoint can't be equal." };
    if (minBp > maxBp) return { text: "Min breakpoint is larger than max breakpoint." };
    if (minSize === maxSize && minSize !== 0) return { text: "Min and max size are equal — this won't scale." };
    if (!tipDismissed && minSize > 0 && maxSize > 0 && maxSize < minSize * 2) {
      return { html: 'For text, keep max ≥ 2× min so users can still zoom to 200%. <a href="https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html" target="_blank" rel="noopener">WCAG 1.4.4</a>', soft: true };
    }
    return null;
  }

  function buildClamp() {
    const { slopeVw, interceptPx } = geom();
    const { minSize, maxSize, unit } = state;
    const lo = Math.min(minSize, maxSize), hi = Math.max(minSize, maxSize);
    const vwStr = (slopeVw >= 0 ? "+ " : "- ") + fmt(Math.abs(slopeVw)) + "vw";
    if (unit === "px") {
      return `clamp(${fmt(lo)}px, ${fmt(interceptPx)}px ${vwStr}, ${fmt(hi)}px)`;
    }
    const r = ROOT_FONT_SIZE;
    return `clamp(${fmt(lo / r)}rem, ${fmt(interceptPx / r)}rem ${vwStr}, ${fmt(hi / r)}rem)`;
  }

  function render() {
    const { minBp, maxBp, unit, mode } = state;
    const lo = Math.min(minBp, maxBp), hi = Math.max(minBp, maxBp);
    const previewVw = Math.max(lo, Math.min(hi, state.previewVw));
    state.previewVw = previewVw;

    const sizePx = geom().sizeAt(previewVw);
    // When no real size is set yet, still show the preview at a readable
    // default so typed text/element never disappears. The clamp output
    // always uses the true values.
    const displayPx = sizePx > 0 ? sizePx : 48;

    // preview mode
    const isText = mode === "text";
    el.previewText.hidden = !isText;
    el.previewElement.hidden = isText;

    if (isText) {
      const empty = el.previewText.textContent.trim() === "";
      if (empty) {
        el.previewText.style.fontSize = "";  // let placeholder use its own size
        el.previewStage.classList.remove("is-capped");
      } else {
        // Measure text at the true size once, then scale down by a ratio so
        // it always fits — no iterative loop, so no jitter while sliding.
        const stage = el.previewStage;
        const maxW = (stage.clientWidth || 400) - 24;
        const maxH = (stage.clientHeight || 190) - 24;
        el.previewText.style.fontSize = displayPx + "px";
        const w = el.previewText.scrollWidth;
        const h = el.previewText.scrollHeight;
        const ratio = Math.min(1, maxW / (w || 1), maxH / (h || 1));
        const shown = displayPx * ratio;
        el.previewText.style.fontSize = fmt(shown) + "px";
        el.previewStage.classList.toggle("is-capped", ratio < 0.999);
      }
      el.previewText.classList.toggle("is-placeholder-size", sizePx <= 0);
    } else {
      const stage = el.previewStage;
      const cap = Math.min((stage.clientWidth || 400) - 24, (stage.clientHeight || 190) - 24);
      const shown = Math.min(displayPx, cap);
      el.previewElement.style.width = fmt(shown) + "px";
      el.previewElement.style.height = fmt(shown) + "px";
      el.previewElement.classList.toggle("is-placeholder-size", sizePx <= 0);
      el.previewStage.classList.toggle("is-capped", shown < displayPx - 0.5);
    }

    // slider
    el.slider.min = lo;
    el.slider.max = hi;
    if (num(el.slider.value) !== previewVw) el.slider.value = previewVw;
    // don't fight the user while they're typing in the field
    if (document.activeElement !== el.viewportInput) {
      el.viewportInput.value = Math.round(previewVw);
    }
    // ⟲ only earns its place once the preview has moved off their default
    el.viewportReset.hidden = Math.round(previewVw) === Math.round(state.defaultVw);
    el.renderedLabel.textContent = unit === "px"
      ? fmt(sizePx) + "px"
      : fmt(sizePx / ROOT_FONT_SIZE) + "rem";

    // toggles
    el.modeButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    el.unitButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.unit === unit)));

    // warning
    const msg = problem();
    el.warn.hidden = !msg;
    if (msg) {
      el.warn.classList.toggle("warn--soft", !!msg.soft);
      if (msg.soft) {
        el.warn.innerHTML =
          '<span class="warn-text">' + msg.html + '</span>' +
          '<button type="button" class="warn-dismiss" aria-label="Dismiss tip">✕</button>';
        el.warn.querySelector(".warn-dismiss")
          .addEventListener("click", () => { tipDismissed = true; render(); });
      } else if (msg.html) {
        el.warn.innerHTML = msg.html;
      } else {
        el.warn.textContent = msg.text;
      }
    }

    // output
    el.output.textContent = buildClamp();

    syncUrl();
  }

  function copy() {
    const text = buildClamp();
    const done = () => {
      state.copied = true;
      el.copyBtn.classList.add("copied");
      el.copyBtn.textContent = "Copied ✓";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        state.copied = false;
        el.copyBtn.classList.remove("copied");
        el.copyBtn.textContent = "Copy to Clipboard";
      }, 1600);
    };
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => { fallback(); done(); });
    } else { fallback(); done(); }
  }

  function reset() {
    Object.assign(state, DEFAULTS);
    el.minSize.value = DEFAULTS.minSize; el.maxSize.value = DEFAULTS.maxSize;
    el.minBp.value = DEFAULTS.minBp; el.maxBp.value = DEFAULTS.maxBp;
    el.viewportInput.value = DEFAULTS.previewVw;
    el.previewText.textContent = "";
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    render();
  }

  // URL state — makes any configuration shareable via the address bar.
  let urlTimer = null;
  function syncUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const p = new URLSearchParams();
      p.set("min", fmt(state.minSize));
      p.set("max", fmt(state.maxSize));
      p.set("minbp", fmt(state.minBp));
      p.set("maxbp", fmt(state.maxBp));
      p.set("unit", state.unit);
      p.set("vw", fmt(state.defaultVw));
      try { history.replaceState(null, "", "?" + p.toString()); } catch (e) {}
    }, 250);
  }

  function loadFromUrl() {
    const p = new URLSearchParams(location.search);
    if (![...p.keys()].length) return;
    const n = (k, d) => { const v = parseFloat(p.get(k)); return isFinite(v) ? v : d; };
    state.minSize = n("min", state.minSize);
    state.maxSize = n("max", state.maxSize);
    state.minBp = n("minbp", state.minBp);
    state.maxBp = n("maxbp", state.maxBp);
    if (p.get("unit") === "px" || p.get("unit") === "rem") state.unit = p.get("unit");
    state.defaultVw = n("vw", state.defaultVw);
    state.previewVw = state.defaultVw;
    el.minSize.value = fmt(state.minSize);
    el.maxSize.value = fmt(state.maxSize);
    el.minBp.value = fmt(state.minBp);
    el.maxBp.value = fmt(state.maxBp);
    el.viewportInput.value = Math.round(state.defaultVw);
  }

  // Events

  // Each numeric field supports arithmetic like "18*1.5" or "1440-80".
  // Live typing updates the preview from the evaluated value; pressing
  // Enter or leaving the field replaces the text with the result.
  function bindField(input, key) {
    input.addEventListener("input", () => {
      // allow only digits and math characters (x/× accepted as multiply)
      const cleaned = input.value.replace(/[^0-9+\-*/(). x×X]/g, "");
      if (cleaned !== input.value) input.value = cleaned;
      const v = evalExpr(input.value);
      state[key] = v === null ? num(input.value) : v;
      render();
    });
    const commit = () => {
      const v = evalExpr(input.value);
      // invalid or empty → fall back to 0; never negative
      let val = v === null ? 0 : v;
      if (val < 0) val = 0;
      input.value = fmt(val);
      state[key] = val;
      render();
    };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); input.blur(); }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const cur = evalExpr(input.value);
        const base = cur === null ? 0 : cur;
        const next = Math.max(0, base + (e.key === "ArrowUp" ? step : -step));
        input.value = fmt(next);
        state[key] = next;
        render();
      }
    });
  }

  bindField(el.maxSize, "maxSize");
  bindField(el.minSize, "minSize");
  bindField(el.maxBp, "maxBp");
  bindField(el.minBp, "minBp");

  el.slider.addEventListener("input", (e) => { state.previewVw = num(e.target.value); render(); });

  // Viewport field — accepts arithmetic like the other inputs. Committing a
  // value (Enter/blur) makes it the user's default, so ⟲ comes back here.
  el.viewportInput.addEventListener("input", () => {
    const cleaned = el.viewportInput.value.replace(/[^0-9+\-*/(). x×X]/g, "");
    if (cleaned !== el.viewportInput.value) el.viewportInput.value = cleaned;
    const v = evalExpr(el.viewportInput.value);
    if (v !== null) { state.previewVw = v; render(); }
  });
  const commitViewport = () => {
    const v = evalExpr(el.viewportInput.value);
    const lo = Math.min(state.minBp, state.maxBp);
    const hi = Math.max(state.minBp, state.maxBp);
    // invalid → fall back to the existing default rather than 0, which
    // would be a nonsense viewport
    let val = v === null ? state.defaultVw : v;
    val = Math.max(lo, Math.min(hi, val));
    state.previewVw = val;
    state.defaultVw = val;
    el.viewportInput.value = Math.round(val);
    render();
  };
  el.viewportInput.addEventListener("change", commitViewport);
  el.viewportInput.addEventListener("blur", commitViewport);
  el.viewportInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commitViewport(); el.viewportInput.blur(); }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const cur = evalExpr(el.viewportInput.value);
      const base = cur === null ? state.previewVw : cur;
      const lo = Math.min(state.minBp, state.maxBp);
      const hi = Math.max(state.minBp, state.maxBp);
      const next = Math.max(lo, Math.min(hi, base + (e.key === "ArrowUp" ? step : -step)));
      el.viewportInput.value = Math.round(next);
      state.previewVw = next;
      render();
    }
  });

  el.viewportReset.addEventListener("click", () => {
    state.previewVw = state.defaultVw;
    el.viewportInput.value = Math.round(state.defaultVw);
    render();
  });

  el.modeButtons.forEach((b) =>
    b.addEventListener("click", () => { state.mode = b.dataset.mode; render(); }));
  el.unitButtons.forEach((b) =>
    b.addEventListener("click", () => { state.unit = b.dataset.unit; render(); }));

  el.copyBtn.addEventListener("click", copy);
  el.clearBtn.addEventListener("click", reset);
  el.wordmark.addEventListener("click", reset);

  // Editable preview text
  el.previewText.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); el.previewText.blur(); }
    e.stopPropagation();
  });
  el.previewText.addEventListener("input", () => {
    const t = el.previewText.textContent;
    if (t.length > 12) {
      el.previewText.textContent = t.slice(0, 12);
      // move caret to end after truncating
      const r = document.createRange();
      r.selectNodeContents(el.previewText);
      r.collapse(false);
      const s = window.getSelection();
      s.removeAllRanges(); s.addRange(r);
    }
    render();
  });
  el.previewText.addEventListener("blur", () => {
    // leave empty so the placeholder shows
  });

  window.addEventListener("keydown", (e) => {
    const editing = document.activeElement === el.previewText;
    const key = (e.key || "").toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === "c") {
      if (editing) return;
      const sel = (window.getSelection && window.getSelection().toString()) || "";
      if (sel.trim() !== "") return;
      e.preventDefault();
      copy();
    } else if (key === "escape") {
      if (editing) { el.previewText.blur(); return; }
      reset();
    }
  });

  window.addEventListener("resize", render);

  loadFromUrl();
  render();
  requestAnimationFrame(render); // re-fit once stage has real dimensions
})();
