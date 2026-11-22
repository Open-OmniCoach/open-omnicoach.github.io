(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);

  // ---------- shared helpers ----------

  const CASES = ["porsche", "istanbul", "launch"];
  const normCase = (k) => (k === "car_rev" ? "launch" : k);
  const W = 1000; // SVG units across a timeline track
  const MOD_NAME = { V: "frames", A: "audio", AV: "clip" };
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pad = (n) => String(n).padStart(2, "0");
  const mmss = (t) => {
    const d = Math.round(t * 10);
    return `${pad(Math.floor(d / 600))}:${pad(Math.floor((d % 600) / 10))}.${d % 10}`;
  };
  const mmssShort = (t) => `${pad(Math.floor(t / 60))}:${pad(Math.round(t % 60))}`;
  const range = (a, b) => `${mmss(a)}–${mmss(b)}`;
  const X = (t, v) => ((t - v[0]) / (v[1] - v[0])) * W;
  const pct = (t, v) => ((t - v[0]) / (v[1] - v[0])) * 100;
  const math = (s) => `<span class="math">${s}</span>`;
  const AX = math("<var>𝒜</var><sub>x</sub>");
  const listText = (items) => (items.length < 3 ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`);
  const stepOf = (c, n) => c.steps.find((s) => s.n === n);
  const row = (k, v, cls) => `<div class="st-row ${cls || ""}"><dt>${k}</dt><dd>${v}</dd></div>`;

  function markText(text, marks) {
    let html = esc(text);
    marks.forEach((m) => {
      const needle = esc(m);
      const i = html.indexOf(needle);
      if (i >= 0) html = `${html.slice(0, i)}<mark>${needle}</mark>${html.slice(i + needle.length)}`;
    });
    return html;
  }

  const marksFor = (st, field) => st.marks.filter((m) => m.field === field).map((m) => m.text);

  function evidenceSpans(c) {
    return c.task.evidence.map((e) => {
      const hasV = e.types.includes("visual");
      const hasA = e.types.some((x) => x !== "visual");
      return { start: e.start, end: e.end, mod: hasV && hasA ? "AV" : hasV ? "V" : "A",
        tip: `${e.types.join(" and ")} ${range(e.start, e.end)}: ${e.text}` };
    });
  }

  function verdictHtml(j) {
    const one = (name, x) => `<li class="${x.verdict === "pass" ? "is-ok" : "is-bad"}"><b>${name} check, ${x.verdict === "pass" ? "✓ pass" : "✗ fail"}.</b> ${esc(x.reason)}</li>`;
    return `<ul class="st-verdicts">${one("Audio", j.audio)}${one("Visual", j.visual)}</ul>`;
  }

  // Reasoning of a step: Think, or for the takeover step the student draft, verdicts and teacher correction.
  function reasoningRows(c, st) {
    if (st.draft) {
      return row("Student draft", `<div class="st-draft"><p>${markText(st.draft, marksFor(st, "draft"))}</p>${verdictHtml(c.student.judgement)}</div>`, "is-draft")
        + row("Teacher correction", `<div class="st-correction">${markText(st.correction, marksFor(st, "correction"))}</div>`);
    }
    return st.think ? row("Think", markText(st.think, marksFor(st, "think"))) : "";
  }

  function answerResult(c, st) {
    if (st.pred) return { ok: true, text: `✓ tIoU ${st.iou.toFixed(2)} with the target ${range(c.task.target[0], c.task.target[1])}` };
    const ok = st.answer === c.task.gold;
    return { ok, text: ok ? `✓ matches the correct answer ${c.task.gold}` : `✗ the correct answer is ${c.task.gold}` };
  }

  initNav();
  const explorer = initExplorer();
  const demos = initDemos();
  initDemoWall();
  initResults();
  initBibtexCopy();
  initRouter(explorer, demos);

  function initBibtexCopy() {
    const btn = document.getElementById("copy-bibtex-btn");
    const pre = document.getElementById("bibtex-code");
    if (!btn || !pre) return;
    btn.addEventListener("click", async () => {
      const text = pre.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        const orig = btn.textContent;
        btn.textContent = "Copied ✓";
        btn.classList.add("is-copied");
        setTimeout(() => { btn.textContent = orig; btn.classList.remove("is-copied"); }, 1800);
      } catch {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }

  function initResults() {
    const section = document.getElementById("results");
    const controls = section?.querySelector(".result-controls");
    if (!controls) return;
    const tabs = Array.from(section.querySelectorAll(".result-tab"));
    const model = section.querySelector("#result-model");
    const panel = section.querySelector("#results-panel");
    const announcement = section.querySelector("#result-announcement");
    let domain = "av";
    const update = () => {
      tabs.forEach((tab) => {
        const active = tab.dataset.domain === domain;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      section.querySelectorAll(".result-view").forEach((view) => {
        view.hidden = view.dataset.domain !== domain || view.dataset.model !== model.value;
      });
      section.querySelectorAll(".result-full").forEach((table) => { table.hidden = table.dataset.domain !== domain; });
      panel.setAttribute("aria-labelledby", `results-tab-${domain}`);
      announcement.textContent = `${domain === "av" ? "Audio-visual" : "Video"} results for Open OmniAgent-${model.value === "30b" ? "30B-A3B" : "7B"}.`;
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => { domain = tab.dataset.domain; update(); });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        domain = tabs[next].dataset.domain;
        update();
        tabs[next].focus();
      });
    });
    model.addEventListener("change", update);
    controls.hidden = false;
    update();
  }

  function initNav() {
    const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    if (!links.length) return;

    const header = document.querySelector(".site-nav");
    const linkById = {};
    const sections = [];
    links.forEach((link) => {
      const id = link.getAttribute("href").slice(1);
      const section = document.getElementById(id);
      if (section) {
        linkById[id] = link;
        sections.push(section);
      }
    });

    let currentId, scheduled = 0;
    const setCurrent = (id) => {
      if (id === currentId) return;
      currentId = id;
      links.forEach((link) => link.removeAttribute("aria-current"));
      if (linkById[id]) linkById[id].setAttribute("aria-current", "location");
    };

    // Track the section just below the bar, including direct anchor visits.
    // Clear the selection in the hero, trajectory explorer, and footer.
    function update() {
      const line = (header?.getBoundingClientRect().bottom || 0) + 24;
      const section = sections.find(section => {
        const rect = section.getBoundingClientRect();
        return rect.top <= line && rect.bottom > line;
      });
      setCurrent(section?.id);
    }
    function schedule() {
      if (scheduled) return;
      scheduled = requestAnimationFrame(() => { scheduled = 0; update(); });
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    schedule();
  }

  // ---------- Block 2b: trajectory explorer ----------

  function initExplorer() {
    const DATA = window.OMNI_TRACES;
    const root = document.getElementById("explorer");
    if (!DATA || !root) return null;

    const ORDER = CASES.filter((k) => DATA[k]);
    const tabs = root.querySelector(".ex-tabs");
    const panel = root.querySelector(".ex-panel");
    const lightbox = document.getElementById("ex-lightbox");
    const state = { key: null, view: null, selected: null };

    const current = () => DATA[state.key];
    const isZoomed = (c) => state.view[0] > 0 || state.view[1] < c.task.duration;

    function subTitle(c) {
      return `${c.kind === "reflection" ? "Error recovery" : "Multi-span search"} · ${c.steps.length} steps`;
    }

    // ----- tabs -----

    tabs.innerHTML = ORDER.map((k) => {
      const c = DATA[k];
      return `<button type="button" role="tab" class="ex-tab" id="ex-tab-${k}" data-key="${k}"
        aria-controls="ex-panel" aria-selected="false" tabindex="-1">
        <span class="ex-tab-title">${esc(c.scene)}</span><span class="ex-tab-sub">${esc(subTitle(c))}</span></button>`;
    }).join("");
    panel.id = "ex-panel";

    tabs.addEventListener("click", (e) => {
      const tab = e.target.closest(".ex-tab");
      if (tab && tab.dataset.key !== state.key) setCase(tab.dataset.key, false);
    });
    tabs.addEventListener("keydown", (e) => {
      const i = ORDER.indexOf(state.key);
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ORDER.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      setCase(ORDER[(next + ORDER.length) % ORDER.length], true);
    });

    function defaultStep(c) {
      const fig = c.steps.find((s) => s.figure);
      return c.takeover || c.select || (fig ? fig.n : 1);
    }

    function setCase(key, focusTab, n) {
      const c = DATA[key];
      state.key = key;
      state.view = c.view ? c.view.slice() : [0, c.task.duration];
      state.selected = n || defaultStep(c);
      tabs.querySelectorAll(".ex-tab").forEach((tab) => {
        const on = tab.dataset.key === key;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on && focusTab) tab.focus();
      });
      panel.setAttribute("aria-labelledby", `ex-tab-${key}`);
      panel.innerHTML = taskHtml(c) + `<details class="section-details ex-timeline-details"><summary>Evidence timeline</summary><div class="ex-timeline">${timelineHtml(c)}</div><p class="ex-source-note">Demo text is condensed and source clips are re-extracted. Playback timing and boxes are presentation annotations; frames sample the returned evidence.</p></details>` + stepsHtml(c);
      select(state.selected, false);
    }

    // ----- task header -----

    function taskHtml(c) {
      const t = c.task;
      const last = c.steps[c.steps.length - 1];
      const tg = t.family === "TG";
      const roles = c.kind === "reflection"
        ? `student S1${c.takeover > 2 ? ` to S${c.takeover - 1}` : ""}, teacher S${c.takeover} to S${c.steps.length}`
        : `teacher rollout, ${c.steps.length} steps`;
      const meta = `${tg ? "Temporal grounding (TG)" : "Multiple-choice question (MCQ)"}, ${c.length} video, ${roles}`;

      const question = `<p class="ex-q"><span class="ex-k">${tg ? "Query" : "Question"}</span>${esc(t.question)}</p>`;
      let body = "";
      if (tg) {
        body += `<p class="ex-target"><span class="ex-k">Target</span>${range(t.target[0], t.target[1])}, visual and sound evidence</p>`;
      } else {
        body += `<ol class="ex-options">${t.options.map((o, i) => {
          const L = "ABCDEFGH"[i];
          const gold = L === t.gold;
          const stu = c.student && c.student.answer === L;
          const tags = (gold ? '<span class="opt-tag is-ok">✓ correct</span>' : "")
            + (stu ? '<span class="opt-tag is-bad">✗ student’s answer</span>' : "");
          return `<li class="${gold ? "is-gold" : ""}${stu ? " is-student" : ""}"><span class="opt-l">${L}</span><span class="opt-t">${esc(o)}${tags}</span></li>`;
        }).join("")}</ol>`;
      }

      let outcome;
      if (tg) {
        outcome = `Prediction ${range(last.pred[0], last.pred[1])}, tIoU ${last.iou.toFixed(2)} with the target`;
      } else if (c.student) {
        outcome = `The student answered <b class="is-bad">${esc(c.student.answer)} ✗</b>. After the takeover, the trajectory answers <b class="is-ok">${esc(last.answer)} ✓</b>.`;
      } else {
        outcome = `Final answer <b class="is-ok">${esc(last.answer)} ✓</b>`;
      }
      return `<div class="ex-task"><p class="ex-meta">${esc(meta)}</p>${question}<details class="section-details ex-question-details"><summary>${tg ? "Target & outcome" : "Answer choices & outcome"}</summary>${body}<p class="ex-outcome">${outcome}</p></details></div>`;
    }

    // ----- timeline -----

    // Envelope as a mirrored area. Coarse envelopes (few bins in view) are drawn through bin centres
    // so that they do not read as hard steps.
    function waveSvg(wave, v, h, cls, extra) {
      const n = wave.v.length;
      const step = (wave.end - wave.start) / n;
      const mid = h / 2;
      const bins = [];
      for (let i = 0; i < n; i++) {
        const t0 = wave.start + i * step;
        const t1 = t0 + step;
        if (t1 <= v[0] || t0 >= v[1]) continue;
        bins.push([X(Math.max(t0, v[0]), v), X(Math.min(t1, v[1]), v), Math.max(0.5, wave.v[i] * (mid - 0.5))]);
      }
      let pts;
      if (bins.length < 40) {
        pts = bins.map(([x0, x1, a]) => [(x0 + x1) / 2, a]);
        pts.unshift([bins[0][0], bins[0][2]]);
        pts.push([bins[bins.length - 1][1], bins[bins.length - 1][2]]);
      } else {
        pts = bins.flatMap(([x0, x1, a]) => [[x0, a], [x1, a]]);
      }
      const top = pts.map(([x, a]) => `${x.toFixed(1)} ${(mid - a).toFixed(2)}`);
      const bot = pts.slice().reverse().map(([x, a]) => `${x.toFixed(1)} ${(mid + a).toFixed(2)}`);
      return `<svg class="${cls}" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" aria-hidden="true">${extra || ""}<path d="M${top.concat(bot).join("L")}Z"/></svg>`;
    }

    // Two lanes per row: frames on top (y 0 to 5.25), audio below (y 6.75 to 12); a clip covers both.
    function laneRects(spans, v, cls, minW) {
      return spans.map((s) => {
        if (s.end <= v[0] || s.start >= v[1]) return "";
        const x0 = X(Math.max(s.start, v[0]), v);
        const w = Math.max(X(Math.min(s.end, v[1]), v) - x0, minW || 3);
        const [y, h] = s.mod === "AV" ? [0, 12] : s.mod === "V" ? [0, 5.25] : [6.75, 5.25];
        const tip = s.tip || `${MOD_NAME[s.mod]} ${range(s.start, s.end)}`;
        return `<rect class="${cls}" x="${x0.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}"><title>${esc(tip)}</title></rect>`;
      }).join("");
    }

    const LANES = `<rect class="lane" x="0" y="0" width="${W}" height="5.25"/><rect class="lane" x="0" y="6.75" width="${W}" height="5.25"/>`;
    const lanesSvg = (inner) => `<svg class="tl-lanes" viewBox="0 0 ${W} 12" preserveAspectRatio="none" aria-hidden="true">${LANES}${inner}</svg>`;

    // At most one tick label per ~64 px of track.
    const maxTicks = () => Math.max(3, Math.min(9, Math.floor((panel.clientWidth - 80) / 64)));

    function niceStep(span) {
      const n = maxTicks();
      return [1, 2, 5, 10, 15, 30, 60, 120, 180, 300, 600, 900].find((s) => span / s <= n) || 1200;
    }

    function axisHtml(v, cls) {
      const step = niceStep(v[1] - v[0]);
      let ticks = "";
      for (let t = Math.ceil(v[0] / step) * step; t <= v[1] + 1e-6; t += step) {
        const p = pct(t, v);
        const edge = p < 1 ? " is-start" : p > 97 ? " is-end" : "";
        ticks += `<span class="tick${edge}" style="left:${p.toFixed(2)}%">${mmssShort(t)}</span>`;
      }
      return `<div class="tl-grid tl-axis ${cls || ""}"><span class="tl-lab"></span><div class="tl-track">${ticks}</div></div>`;
    }

    function stepRow(c, st, v) {
      const kind = st.role === "student" ? "student" : "teacher";
      let inner = laneRects(st.spans, v, st.rejected ? `sp sp-rej sp-rej-${kind}` : `sp sp-${kind}`);
      let note = "";
      if (st.pred) {
        inner += laneRects([{ start: st.pred[0], end: st.pred[1], mod: "AV", tip: `prediction ${range(st.pred[0], st.pred[1])}` }], v, "sp sp-pred");
        note = `<span class="tl-note" style="left:calc(${pct(st.pred[1], v).toFixed(2)}% + 8px)">answer, tIoU ${st.iou.toFixed(2)}</span>`;
      } else if (st.answer != null) {
        const ok = st.answer === c.task.gold;
        note = `<span class="tl-note ${ok ? "is-ok" : "is-bad"}">answer ${esc(st.answer)} ${ok ? "✓" : "✗"}</span>`;
      } else if (st.rejected) {
        note = `<span class="tl-note tl-note-rej">rejected</span>`;
      }
      const cls = `tl-grid tl-step is-${kind}${st.figure ? " is-figure" : ""}`;
      return `<button type="button" class="${cls}" data-n="${st.n}" aria-label="Step ${st.n}, ${esc(st.call_short)}">
        <span class="tl-lab">S${st.n}</span><span class="tl-track">${lanesSvg(inner)}${note}</span></button>`;
    }

    function ghostRow(c) {
      return `<button type="button" class="tl-grid tl-step tl-ghost is-student" data-n="${c.takeover}" data-ghost="1"
        aria-label="Student's own step ${c.takeover}, replaced by the teacher">
        <span class="tl-lab">S${c.takeover}</span><span class="tl-track">${lanesSvg("")}<span class="tl-note is-bad">student’s own S${c.takeover}: answer ${esc(c.student.answer)} ✗, replaced</span></span></button>`;
    }

    function timelineHtml(c) {
      const full = [0, c.task.duration];
      const v = state.view;
      const zoomed = isZoomed(c);
      const tg = c.task.family === "TG";

      let h = `<div class="tl-head"><p class="tl-title">Where each step looked</p>`;
      if (c.view) {
        h += `<div class="tl-zoom" role="group" aria-label="Time range">
          <button type="button" class="btn btn-small" data-view="zoom" aria-pressed="${zoomed}">${mmssShort(c.view[0])} to ${mmssShort(c.view[1])}</button>
          <button type="button" class="btn btn-small" data-view="full" aria-pressed="${!zoomed}">Full video</button></div>`;
      }
      h += `</div>`;

      h += `<div class="tl-grid tl-ov"><span class="tl-lab"><span>Video</span><span>Audio</span></span><div class="tl-track">
        <div class="tl-strip">${c.film.map((f) => `<img src="${f.src}" alt="" loading="lazy" width="320" height="180">`).join("")}</div>
        ${waveSvg(c.wave, full, 28, "tl-wave")}
        <div class="tl-layer tl-ovsel"></div>
        ${zoomed ? `<div class="tl-layer"><span class="tl-zoombox" style="left:${pct(v[0], full)}%;width:${pct(v[1], full) - pct(v[0], full)}%"></span></div>` : ""}
      </div></div>`;

      if (zoomed) {
        h += axisHtml(full, "tl-axis-ov");
        h += `<p class="tl-zoomnote">Zoomed to ${mmssShort(v[0])} to ${mmssShort(v[1])}, where every step of this trajectory looks.</p>`;
        h += `<div class="tl-grid tl-zwave"><span class="tl-lab">Audio</span><div class="tl-track">${waveSvg(c.view_wave, v, 28, "tl-wave")}</div></div>`;
      }
      h += axisHtml(v);

      const ev = evidenceSpans(c);
      h += `<div class="tl-rows"><div class="tl-layer tl-evguide">${bands(ev, v, "tl-evband")}</div><div class="tl-layer tl-rowsel"></div>`;
      h += `<div class="tl-grid tl-evi"><span class="tl-lab">${tg ? "Target" : AX}</span><span class="tl-track">${lanesSvg(laneRects(ev, v, "sp sp-ev", 5))}</span></div>`;
      c.steps.forEach((st) => {
        h += stepRow(c, st, v);
        if (c.student && st.n === c.takeover - 1) h += ghostRow(c);
      });
      h += `</div>`;

      const sw = (cls, text) => `<span class="lg"><i class="${cls}"></i>${text}</span>`;
      h += `<p class="tl-legend">${[
        sw("lg-v", "frames, top lane"),
        sw("lg-a", "audio, bottom lane"),
        sw("lg-av", "clip, both lanes"),
        c.student ? sw("lg-stu", "student step") : "",
        c.steps.some((s) => s.rejected) ? sw("lg-rej", "call rejected by the harness") : "",
        sw("lg-ev", tg ? "target interval" : `annotated evidence ${AX}`),
        tg ? sw("lg-pred", "predicted interval") : "",
      ].join("")}</p>`;
      if (c.evidence_note) h += `<p class="tl-evnote">${esc(c.evidence_note).replace("𝒜ₓ", AX)}</p>`;
      return h;
    }

    function bands(spans, v, cls) {
      return spans.map((s) => {
        if (s.end <= v[0] || s.start >= v[1]) return "";
        const a = Math.max(pct(s.start, v), 0);
        const b = Math.min(pct(s.end, v), 100);
        return `<span class="${cls || "tl-band"}" style="left:${a.toFixed(2)}%;width:${Math.max(b - a, 0.35).toFixed(2)}%"></span>`;
      }).join("");
    }

    // ----- steps -----

    function stepsHtml(c) {
      return `<div class="ex-steps">
        <div class="ex-steps-head"><p class="ex-steps-title" role="status"></p>
          <div class="ex-steps-ctl"><button type="button" class="btn btn-small" data-step-direction="-1" aria-label="Previous trajectory step">← Previous</button><button type="button" class="btn btn-small" data-step-direction="1" aria-label="Next trajectory step">Next →</button></div></div>
        <nav class="ex-step-nav" aria-label="Trajectory steps">${c.steps.map((st) => `<button type="button" data-select-step="${st.n}" aria-label="Step ${st.n}" aria-pressed="false">S${st.n}</button>`).join("")}</nav>
        <div class="ex-step-viewport" tabindex="0" role="region" aria-label="Selected trajectory step"></div>
      </div>`;
    }

    function inputHtml(c, st) {
      const inp = st.input;
      if (inp.kind === "initial") {
        return `<div class="st-input"><p class="st-input-head">Input at the start</p>
          <p class="st-input-text">The task, the tool specifications, timestamped frames covering the whole video (0.5 FPS, at most 256), and the full audio track.</p></div>`;
      }
      if (inp.kind === "rejected") {
        return `<div class="st-input is-error"><p class="st-input-head">Returned by S${inp.step}: harness error</p>
          <p class="st-input-text">The call in S${inp.step} (${esc(inp.call)}) exceeded a per-call limit of the harness, so this step receives an error message instead of media.</p></div>`;
      }
      const who = c.takeover && inp.step < c.takeover ? " (student)" : "";
      const shown = inp.groups.filter((g) => g.frames.length || g.wave);
      const empty = inp.groups.filter((g) => !g.frames.length && !g.wave).map((g) => g.label);
      return `<div class="st-input"><p class="st-input-head">Returned by S${inp.step}${who}: ${esc(inp.call)}</p>
        ${shown.length ? `<div class="st-groups${shown.length > 1 ? " is-multi" : ""}">${shown.map(groupHtml).join("")}</div>` : ""}
        ${empty.length ? `<p class="st-input-text">No display frames were extracted for ${listText(empty)}.</p>` : ""}</div>`;
    }

    function groupHtml(g) {
      const cap = `${g.label ? `${g.label}, ` : ""}${MOD_NAME[g.mod]} ${range(g.start, g.end)}`;
      const n = g.frames.length;
      const frames = g.frames.map((f) => `<button type="button" class="st-frame" data-src="${f.src}" data-cap="${esc(`${cap}, frame at ${mmss(f.t)}`)}">
          <img src="${f.src}" alt="Frame at ${mmss(f.t)}" loading="lazy"><span class="st-time">${mmss(f.t)}</span></button>`).join("");
      let wave = "";
      if (g.wave) {
        const v = [g.start, g.end];
        const marks = g.wave.marks || [];
        const bandsSvg = marks.map((m) => `<rect class="wv-mark" x="${X(m.start, v).toFixed(1)}" y="0" width="${Math.max(X(m.end, v) - X(m.start, v), 4).toFixed(1)}" height="32"/>`).join("");
        wave = `<div class="st-wave">${waveSvg(g.wave, v, 32, "st-wave-svg", bandsSvg)}
          <div class="st-wave-axis"><span>${mmss(v[0])}</span>${marks.map((m) => `<span class="st-wave-mark" style="left:${pct((m.start + m.end) / 2, v).toFixed(1)}%">${esc(m.label)}</span>`).join("")}<span>${mmss(v[1])}</span></div></div>`;
      }
      return `<figure class="st-group${n ? "" : " is-wave"}" style="--n:${n}"><figcaption>${esc(cap)}</figcaption>
        ${frames ? `<div class="st-frames">${frames}</div>` : ""}${wave}</figure>`;
    }

    function actionHtml(c, st) {
      let h = `<pre class="st-code">${esc(st.call)}</pre>`;
      if (st.rejected) {
        h += `<p class="st-result is-bad">Rejected by the harness. S${st.n + 1} reads the error and revises the call.</p>`;
      } else if (st.pred || st.answer != null) {
        const r = answerResult(c, st);
        h += `<p class="st-result ${r.ok ? "is-ok" : "is-bad"}">${r.text}</p>`;
      }
      return h;
    }

    function studentHtml(c) {
      const s = c.student.steps.find((x) => x.n === c.takeover);
      return `<details class="st-student"><summary>Student’s own S${s.n}, which the teacher replaced</summary>
        <dl class="st-text">${row("Observation", esc(s.observation))}${row("Think", esc(s.think))}
        ${row("Action", `<pre class="st-code">${esc(s.call)}</pre><p class="st-result is-bad">✗ the correct answer is ${c.task.gold}</p>`)}</dl></details>`;
    }

    function stepHtml(c, st) {
      const kind = st.role === "student" ? "student" : "teacher";
      const sum = `<header class="st-sum"><span class="st-n">S${st.n}</span>
        <span class="st-role">${kind === "student" ? "Student" : "Teacher"}</span>
        <span class="st-call">${esc(st.call_short)}</span>
        ${st.rejected ? '<span class="st-rej">rejected</span>' : ""}
        ${st.label ? `<span class="st-label">${esc(st.label)}</span>` : ""}
        </header>`;

      let text = "";
      if (st.observation) text += row("Observation", markText(st.observation, marksFor(st, "observation")));
      text += reasoningRows(c, st);
      text += row("Action", actionHtml(c, st));

      return `<article class="ex-step is-${kind}" id="step-${c.key}-${st.n}" data-n="${st.n}" aria-label="Step ${st.n}">
        ${sum}<div class="st-body">${inputHtml(c, st)}<dl class="st-text">${text}</dl>${st.draft && c.student ? studentHtml(c) : ""}
        </div></article>`;
    }

    // ----- interaction -----

    // reveal: false, "nearest" (timeline clicks: scroll only if the card is out of view) or "start" (deep links).
    function select(n, reveal, ghost) {
      const c = current();
      const st = stepOf(c, n);
      if (!st) return false;
      state.selected = n;
      panel.querySelectorAll(".tl-step").forEach((r) => {
        const on = Number(r.dataset.n) === n && Boolean(r.dataset.ghost) === Boolean(ghost);
        r.classList.toggle("is-selected", on);
        r.setAttribute("aria-pressed", String(on));
      });
      const viewport = panel.querySelector(".ex-step-viewport");
      if (!viewport.querySelector(`#step-${c.key}-${n}`)) {
        viewport.innerHTML = stepHtml(c, st);
        viewport.scrollTop = 0;
      }
      const index = c.steps.indexOf(st);
      panel.querySelector(".ex-steps-title").textContent = `Step ${index + 1} of ${c.steps.length}`;
      panel.querySelectorAll("[data-select-step]").forEach((button) => {
        const active = Number(button.dataset.selectStep) === n;
        button.setAttribute("aria-pressed", String(active));
        button.tabIndex = active ? 0 : -1;
      });
      panel.querySelector('[data-step-direction="-1"]').disabled = index === 0;
      panel.querySelector('[data-step-direction="1"]').disabled = index === c.steps.length - 1;

      const spans = ghost ? [] : st.spans.length ? st.spans : st.pred ? [{ start: st.pred[0], end: st.pred[1] }] : [];
      panel.querySelector(".tl-ovsel").innerHTML = bands(spans, [0, c.task.duration]);
      panel.querySelector(".tl-rowsel").innerHTML = bands(spans, state.view);

      if (reveal) {
        const card = document.getElementById(`step-${c.key}-${n}`);
        let target = viewport;
        if (ghost) {
          const student = card.querySelector(".st-student");
          if (student) { student.open = true; target = student; }
        }
        target.scrollIntoView({ block: reveal, behavior: smooth ? "smooth" : "auto" });
      }
      return true;
    }

    panel.addEventListener("click", (e) => {
      const stepButton = e.target.closest("[data-select-step]");
      if (stepButton) { select(Number(stepButton.dataset.selectStep), false); return; }
      const direction = e.target.closest("[data-step-direction]");
      if (direction) {
        const steps = current().steps;
        const index = steps.findIndex((st) => st.n === state.selected);
        const next = steps[index + Number(direction.dataset.stepDirection)];
        if (next) select(next.n, false);
        return;
      }
      const rowEl = e.target.closest(".tl-step");
      if (rowEl) {
        select(Number(rowEl.dataset.n), "nearest", rowEl.dataset.ghost);
        return;
      }
      const zoom = e.target.closest("[data-view]");
      if (zoom) {
        const c = current();
        state.view = zoom.dataset.view === "zoom" ? c.view.slice() : [0, c.task.duration];
        redrawTimeline();
        return;
      }
      const frame = e.target.closest(".st-frame");
      if (frame) {
        openLightbox(frame);
        return;
      }
    });

    panel.addEventListener("keydown", (e) => {
      const button = e.target.closest("[data-select-step]");
      if (!button || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const steps = current().steps;
      const index = steps.findIndex((st) => st.n === state.selected);
      const next = e.key === "Home" ? 0 : e.key === "End" ? steps.length - 1
        : Math.max(0, Math.min(steps.length - 1, index + (e.key === "ArrowRight" ? 1 : -1)));
      select(steps[next].n, false);
      panel.querySelector(`[data-select-step="${steps[next].n}"]`).focus({ preventScroll: true });
    });

    function redrawTimeline() {
      const ghost = panel.querySelector(".tl-ghost.is-selected");
      panel.querySelector(".ex-timeline").innerHTML = timelineHtml(current());
      select(state.selected, false, ghost ? "1" : "");
    }

    let tickCount = maxTicks();
    window.addEventListener("resize", () => {
      if (maxTicks() === tickCount) return;
      tickCount = maxTicks();
      redrawTimeline();
    });

    function openLightbox(btn) {
      if (!lightbox || typeof lightbox.showModal !== "function") {
        window.open(btn.dataset.src, "_blank", "noopener");
        return;
      }
      const img = lightbox.querySelector("img");
      img.src = btn.dataset.src;
      img.alt = btn.dataset.cap;
      lightbox.querySelector(".ex-lightbox-cap").textContent = btn.dataset.cap;
      lightbox.showModal();
    }

    if (lightbox) {
      lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox || e.target.closest(".ex-lightbox-close")) lightbox.close();
      });
    }

    const requested = normCase(params.get("case"));
    setCase(ORDER.includes(requested) ? requested : ORDER[0], false);

    return {
      cases: ORDER,
      // Open case `key` at step n and scroll its card to the top of the view.
      show(key, n) {
        key = normCase(key);
        if (!ORDER.includes(key) || !stepOf(DATA[key], n)) return false;
        if (key !== state.key) setCase(key, false, n);
        return select(n, "start");
      },
    };
  }

  // ---------- Block 2a: video demos ----------

  function initDemos() {
    const DEMOS = window.OMNI_DEMOS;
    const DATA = { ...window.OMNI_TRACES, ...window.OMNI_EXTRA_TRACES };
    const COPY = window.OMNI_DEMO_COPY || {};
    const gallery = document.getElementById("demo-player");
    const template = document.getElementById("demo-template");
    if (!DEMOS || !DATA || !gallery || !template) return null;
    const ORDER = ["porsche", "kitesurf", "istanbul", "speakers", "tractor", "game"].filter(k => DEMOS[k] && DATA[k]);
    const players = [];
    const shortOptions = {
      porsche: ["Two more", "Not mentioned; two visible", "One fewer", "Same count", "One more", "Two fewer"],
      launch: ["Understeering", "U-turn", "Accelerating onto the road", "Braking", "Revving while parked", "Downshifting"]
    };
    // Presentation annotations, manually checked against these exact returned frames.
    // These rectangles are not model-predicted spatial grounding.
    const highlights = {
      porsche: { 2: { src: "static/images/traces/porsche/0021.0.jpg", time: 21, label: "black 918", phrase: "black 918", box: [48, 33, 29, 28] } },
      istanbul: {
        3: { src: "static/images/traces/istanbul/0688.0.jpg", time: 688, label: "food cart", phrase: "food cart", box: [22.8, 47, 3.8, 11] },
        14: { src: "static/images/traces/istanbul/1756.0.jpg", time: 1756, label: "gas canisters", phrase: "canisters", box: [64, 54, 12, 38] }
      },
      launch: { 5: { src: "static/images/traces/launch/0166.0.jpg", time: 166, label: "blue car", phrase: "blue car", box: [18, 31, 59, 47] } }
    };
    function createPlayer(key) {
      const root = template.content.firstElementChild.cloneNode(true);
      root.id = `demo-${key}`;
      root.dataset.case = key;
      root.setAttribute("aria-labelledby", `demo-title-${key}`);
      gallery.appendChild(root);
      const $ = selector => root.querySelector(selector);
      $("h3").id = `demo-title-${key}`;
      $("h3").textContent = DATA[key].scene;
      $(".dm-more-link").setAttribute("aria-label", `Full ${DATA[key].scene} trajectory`);
      $(".dm-case-heading span").textContent = DATA[key].badge || (key === "porsche" ? "Error recovery" : key === "istanbul" ? "Temporal grounding" : "Audio-visual search");
      const video = $("video"), transcript = $(".dm-transcript");
      let log;
      const playBtn = $(".dm-play"), soundBtn = $(".dm-sound"), seek = $(".dm-seek");
      const still = $(".dm-still"), boxes = $(".dm-boxes");
      const state = { key: null, time: 0, playing: false, phases: [], rows: [], duration: 0, phase: -1, last: 0, raf: 0, autoStarted: false, follow: true, resumeOnView: false };
      const seconds = t => `${t.toFixed(1)}s`;
      const clock = t => `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}`;
      const trace = () => DATA[state.key];
      const demo = () => DEMOS[state.key];

      function buildTimeline(c, d) {
        let time = 0, held = 0.5;
        const phases = [], rows = [];
        const addText = (label, text, step, cls = "", highlight = null) => {
          const duration = Math.max(1.4, text.length / 38) + 0.65;
          const p = { kind: "text", label, text, step, cls, highlight, start: time, end: time + duration, held };
          phases.push(p); rows.push(p); time = p.end;
        };
        const steps = [...new Set(d.segments.map(s => s.step))];
        steps.forEach(n => {
          const st = stepOf(c, n), copy = COPY[c.key]?.[n] || {};
          if (st.draft) {
            addText(`Turn ${n} · Student draft`, copy.draft || st.draft, n, "draft");
            addText("Evidence check", copy.check || "Audio ✓: three mentioned. Visual ✗: the claim of three visible cars is unsupported.", n, "check", d.checkHighlights?.[n]);
            addText("Teacher correction", copy.correction || st.correction, n, "correction");
          } else addText(`Turn ${n}`, copy.think || st.think || st.call_short, n);
          const call = st.spans.length > 1
            ? `${st.type}(${st.spans.map(s => `${MOD_NAME[s.mod]} ${range(s.start, s.end)}`).join("; ")})`
            : st.call;
          addText(st.draft ? "Revised tool call" : "Tool Call", call, n, "tool");
          d.segments.filter(s => s.step === n).forEach(s => {
            const duration = s.reel[1] - s.reel[0];
            phases.push({ kind: "media", step: n, segment: s, start: time, end: time + duration, held: s.reel[0] });
            time += duration; held = Math.max(0, s.reel[1] - 0.04);
          });
          const observation = copy.observation || stepOf(c, n + 1)?.observation;
          if (observation) {
            const h = highlights[c.key]?.[n];
            const grounded = h ? observation.replace(h.phrase, `${h.phrase} @${mmss(h.time)}`) : observation;
            addText("Observation", grounded, n, "observation", h);
          }
        });
        const final = c.steps.find(st => st.answer != null);
        if (final) {
          const answer = final.pred ? `${range(final.pred[0], final.pred[1])}. Reference: ${range(c.task.target[0], c.task.target[1])}; tIoU ${final.iou.toFixed(2)}.`
            : `${final.answer}. ${c.task.options["ABCDEFGH".indexOf(final.answer)]} (${answerResult(c, final).ok ? "correct" : "reference: " + c.task.gold})`;
          addText("Answer", answer, final.n, "answer");
        }
        phases.push({ kind: "hold", start: time, end: time + 2, held, step: final?.n });
        return { phases, rows, duration: Math.ceil((time + 2) * 10) / 10 };
      }

      function initialize(key) {
        if (key === state.key) return;
        pause(); state.key = key; state.time = 0; state.phase = -1; state.follow = true;
        Object.assign(state, buildTimeline(DATA[key], DEMOS[key]));
        video.src = demo().video; video.poster = demo().poster; video.preload = "metadata";
        video.muted = !soundBtn.classList.contains("is-on");
        video.setAttribute("aria-label", `${trace().scene}: selected recorded evidence`);
        const c = trace();
        const options = shortOptions[key] || c.shortOptions;
        transcript.innerHTML = `<div class="dm-question-block"><p class="dm-question"><b>${c.task.family === "TG" ? "Query" : "Question"}:</b> ${esc(c.task.question)}</p>`
          + (options ? `<p class="dm-options"><b>Options:</b> ${options.map((s, i) => `${"ABCDEF"[i]}. ${esc(s)}.`).join(" ")}</p>` : "")
          + `</div>` + state.rows.map((p, i) => `<p class="dm-line dm-${p.cls || "turn"}" data-row="${i}" hidden><b>${esc(p.label)}:</b> <span></span></p>`).join("");
        log = transcript;
        state.rows.forEach((p, i) => { p.node = transcript.querySelector(`[data-row="${i}"]`); p.span = p.node.querySelector("span"); p.count = -1; });
        seek.max = state.duration.toFixed(2); seek.value = 0;
        log.scrollTop = 0;
        $(".dm-error").hidden = true;
        render(true);
      }

      function phaseIndex(t) {
        const i = state.phases.findIndex(p => t < p.end);
        return i < 0 ? state.phases.length - 1 : i;
      }
      function sourceTime(segment, reelTime) {
        const dt = Math.max(0, reelTime - segment.reel[0]);
        return segment.mode === "frames" ? segment.frames[Math.min(segment.frames.length - 1, Math.floor(dt / segment.hold + 1e-6))]
          : Math.min(segment.src[1], segment.src[0] + dt);
      }
      function typedHtml(p, count) {
        let text = esc(p.text.slice(0, count));
        text = text.replace(/\d{2}:\d{2}\.\d/g, '<span class="dm-timestamp">$&</span>');
        if (p.highlight && count >= p.text.indexOf(p.highlight.phrase) + p.highlight.phrase.length) {
          text = text.replace(esc(p.highlight.phrase), `<span class="dm-grounded">${esc(p.highlight.phrase)}</span>`);
        }
        return text;
      }
      function render(force = false) {
        if (!state.key) return;
        const t = state.time, i = phaseIndex(t), p = state.phases[i];
        const changed = force || i !== state.phase;
        const reelTime = p.kind === "media" ? p.held + t - p.start : p.held;
        const segment = p.segment || demo().segments.find(s => reelTime < s.reel[1]) || demo().segments.at(-1);
        if (changed) {
          state.phase = i;
          if (p.kind !== "media") video.pause();
          if (video.readyState && Math.abs(video.currentTime - reelTime) > 0.12) video.currentTime = reelTime;
          const h = p.highlight;
          still.hidden = !h;
          boxes.innerHTML = h ? `<span class="dm-box" style="left:${h.box[0]}%;top:${h.box[1]}%;width:${h.box[2]}%;height:${h.box[3]}%"><span>${esc(h.label)}</span></span>` : "";
          if (h) { still.src = h.src; still.alt = `Evidence frame at ${mmss(h.time)}: ${h.label}`; }
          const st = stepOf(trace(), p.step) || stepOf(trace(), segment.step);
          $(".dm-more-link").href = trace().transcript ? `${trace().transcript}#step-${p.step || segment.step}` : `#trace-${state.key}-S${p.step || segment.step}`;
          const toolSeen = state.rows.some(r => r.step === p.step && r.cls === "tool" && t >= r.start);
          $(".dm-source-spans").innerHTML = toolSeen ? st.spans.map(s => `<span style="left:${s.start / trace().task.duration * 100}%;width:${Math.max(.3, (s.end - s.start) / trace().task.duration * 100)}%"></span>`).join("") : "";
        }
        if (p.kind === "media" && state.playing) {
          if (video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - reelTime) > .65) video.currentTime = reelTime;
          if (video.paused && !video.seeking) video.play().catch(error => { if (error.name === "AbortError" || !state.playing) return; pause(); $(".dm-error").textContent = "Press Play to continue."; $(".dm-error").hidden = false; });
        }
        const source = p.highlight?.time ?? sourceTime(segment, reelTime);
        $(".dm-source-time").textContent = `${seconds(source)} / ${seconds(trace().task.duration)}`;
        $(".dm-source-progress").style.width = `${source / trace().task.duration * 100}%`;
        let textChanged = false;
        state.rows.forEach(r => {
          const visible = t >= r.start;
          r.node.hidden = !visible;
          const count = visible ? Math.min(r.text.length, Math.floor(Math.max(0, t - r.start) * 38)) : 0;
          r.node.classList.toggle("is-typing", visible && count < r.text.length && state.playing);
          if (count !== r.count) { r.span.innerHTML = typedHtml(r, count); r.count = count; textChanged = true; }
        });
        // The visual rectangle arrives with the cited phrase, never ahead of it.
        boxes.hidden = !p.highlight || t < p.start + (p.text.indexOf(p.highlight.phrase) + p.highlight.phrase.length) / 38;
        if (textChanged && state.follow) log.scrollTop = log.scrollHeight;
        seek.value = t;
        seek.setAttribute("aria-valuetext", `${clock(t)} of ${clock(state.duration)}`);
        $(".dm-elapsed").textContent = clock(t);
        seek.title = `${clock(t)} / ${clock(state.duration)}`;
        playBtn.textContent = state.playing ? "Pause" : t >= state.duration ? "Replay" : "Play";
      }
      function tick(now) {
        if (!state.playing) return;
        const p = state.phases[phaseIndex(state.time)];
        const buffering = p.kind === "media" && (video.readyState < 3 || video.seeking);
        const dt = Math.min((now - state.last) / 1000, .1); state.last = now;
        if (!buffering) state.time = Math.min(state.duration, state.time + dt);
        if (state.time >= state.duration) pause();
        render();
        if (state.playing) state.raf = requestAnimationFrame(tick);
      }
      function pause() { state.playing = false; cancelAnimationFrame(state.raf); video.pause(); if (state.key) render(); }
      function start() {
        if (state.time >= state.duration) { state.time = 0; state.phase = -1; log.scrollTop = 0; }
        video.preload = "auto";
        state.playing = true; state.follow = true; state.last = performance.now();
        $(".dm-error").hidden = true; render(true);
        cancelAnimationFrame(state.raf); state.raf = requestAnimationFrame(tick);
      }
      playBtn.addEventListener("click", () => { state.autoStarted = true; state.resumeOnView = false; state.playing ? pause() : start(); });
      function setMuted(muted) {
        video.muted = muted;
        soundBtn.classList.toggle("is-on", !muted);
        soundBtn.setAttribute("aria-pressed", String(!muted));
        soundBtn.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
        soundBtn.title = muted ? "Sound off" : "Sound on";
      }
      soundBtn.addEventListener("click", () => {
        const muted = !video.muted;
        if (!muted) players.forEach(player => { if (player.key !== key) player.setMuted(true); });
        setMuted(muted);
      });
      seek.addEventListener("input", () => {
        state.autoStarted = true;
        state.resumeOnView = false;
        const t = Number(seek.value); pause(); state.time = t; state.follow = true; render(true);
        if (t === 0) log.scrollTop = 0;
      });
      // Readers can scroll back without fighting automatic transcript following.
      transcript.addEventListener("wheel", e => { state.follow = e.deltaY >= 0 && log.scrollTop + log.clientHeight >= log.scrollHeight - 32; }, { passive: true });
      transcript.addEventListener("touchstart", () => { state.follow = false; }, { passive: true });
      $(".dm-more-link").addEventListener("click", pause);
      video.addEventListener("loadedmetadata", () => render(true));
      video.addEventListener("error", () => { pause(); $(".dm-error").textContent = "The evidence video could not load. Reload the page to retry."; $(".dm-error").hidden = false; });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && state.playing) { state.resumeOnView = true; pause(); }
        else if (!document.hidden && state.resumeOnView) {
          const rect = root.getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < innerHeight) { state.resumeOnView = false; start(); }
        }
      });
      initialize(key);
      // Each visible canvas plays independently. Offscreen canvases suspend work.
      const observer = new IntersectionObserver(entries => {
        const visible = entries[0].isIntersecting;
        if (!visible && state.playing) { state.resumeOnView = true; pause(); }
        if (visible && (state.resumeOnView || (!state.autoStarted && smooth))) {
          state.autoStarted = true; state.resumeOnView = false; start();
        }
      }, { threshold: .05 });
      observer.observe(root);
      return { key, root, setMuted };
    }

    ORDER.forEach(key => players.push(createPlayer(key)));
    return { cases: ORDER, show(key) {
      const player = players.find(p => p.key === normCase(key));
      if (!player) return false;
      player.root.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
      return true;
    } };
  }

  // The eight-scene wall stays still until a reader hovers or focuses a tile.
  function initDemoWall() {
    const wall = document.querySelector(".hero-mosaic");
    if (!wall) return;
    const data = { ...window.OMNI_TRACES, ...window.OMNI_EXTRA_TRACES };
    const order = ["porsche", "kitesurf", "tractor", "istanbul", "garage", "game", "launch", "speakers"];
    wall.innerHTML = order.map(key => {
      const hasDemo = Boolean(document.getElementById(`demo-${key}`));
      const href = hasDemo ? `#demo-${key}` : data[key].transcript || `#trace-${key}-S1`;
      const label = hasDemo ? `Watch ${data[key].scene}` : `Read the ${data[key].scene} trajectory`;
      return `<a class="wall-tile" href="${esc(href)}" aria-label="${esc(label)}"><video muted loop playsinline preload="none" poster="static/videos/wall/${key}.jpg?v=2" data-src="static/videos/wall/${key}.mp4?v=2" aria-hidden="true"></video><span>${esc(data[key].scene)}</span></a>`;
    }).join("");
    const tiles = Array.from(wall.children);
    let hovered = -1, focused = -1, visible = false;
    function render() {
      const selected = focused >= 0 ? focused : hovered;
      tiles.forEach((tile, i) => {
        const v = tile.querySelector("video");
        const active = i === selected && visible && !document.hidden;
        tile.classList.toggle("is-preview", active);
        if (active && smooth) {
          if (!v.getAttribute("src")) v.src = v.dataset.src;
          v.play().catch(() => {});
        } else v.pause();
      });
    }
    tiles.forEach((tile, i) => {
      tile.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") { hovered = i; render(); } });
      tile.addEventListener("pointerleave", () => { hovered = -1; render(); });
      tile.addEventListener("focus", () => { focused = i; render(); });
      tile.addEventListener("blur", () => { focused = -1; render(); });
    });
    document.addEventListener("visibilitychange", render);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; render(); }).observe(wall);
    render();
  }

  // ---------- deep links ----------

  // #trace-<case>-S<n> and #step-<case>-<n> open a step in the explorer; #demo-<case> opens a reel.
  function initRouter(ex, dm) {
    const route = (hash) => {
      if (hash === "#trajectories") {
        if (!document.getElementById("trajectories")) return false;
        document.getElementById("trajectories").scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
        return true;
      }
      let m = /^#(?:trace-([a-z_]+)-S|step-([a-z_]+)-)(\d+)$/.exec(hash);
      if (m) return Boolean(ex && ex.show(m[1] || m[2], Number(m[3])));
      m = /^#demo-([a-z_]+)$/.exec(hash);
      if (m) return Boolean(dm && dm.show(m[1]));
      return false;
    };

    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#trace-"], a[href^="#step-"], a[href^="#demo-"], a[href="#trajectories"]');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const hash = a.getAttribute("href");
      if (!route(hash)) return;
      e.preventDefault();
      if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    });
    window.addEventListener("hashchange", () => route(window.location.hash));
    if (window.location.hash) route(window.location.hash);
  }
})();
