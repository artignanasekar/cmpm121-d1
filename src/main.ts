// CMPM 121 • D1 — Cat Crew: Energy Clicker (strict TS, lint-safe)
//shared with live session

/* ---------------- TYPES AND INTERFACES ---------------- */
type ProducerDef = {
  id: string;
  name: string;
  baseCost: number;
  cps: number;
  key: string;
};
type OwnedProducer = { id: string; owned: number };
type GameState = {
  version: string;
  cookies: number; // internal currency (UI = Energy)
  lifetime: number; // total energy gathered
  clickPower: number;
  clickUpgrades: number;
  producers: OwnedProducer[];
};

/* ---------------- GAME CONFIGURATIONS ---------------- */
(() => {
  "use strict";

  const VERSION = "d1.6.1-catcrew";

  // keep IDs stable; rename the visible names only
  const PRODUCERS: ProducerDef[] = [
    {
      id: "cursorUpgrade",
      name: "🐾 Paw Pointer",
      baseCost: 15,
      cps: 0.1,
      key: "1",
    },
    { id: "familiar", name: "🐈 Helper Cat", baseCost: 100, cps: 1, key: "2" },
    {
      id: "garden",
      name: "🌿 Catnip Garden",
      baseCost: 1100,
      cps: 8,
      key: "3",
    },
    {
      id: "cavern",
      name: "💎 Crystal Cave",
      baseCost: 12000,
      cps: 47,
      key: "4",
    },
    {
      id: "workshop",
      name: "🔧 Cozy Workshop",
      baseCost: 130000,
      cps: 260,
      key: "5",
    },
  ];

  // Plain-English hover text + short punchlines
  const FLAVOR: Record<string, { what: string; punch: string }> = {
    cursorUpgrade: {
      what: "A tiny paw that auto-clicks now and then.",
      punch: "“Every little boop boop helps.”",
    },
    familiar: {
      what: "A friendly cat that adds steady energy each second.",
      punch: "“Purr… progress!”",
    },
    garden: {
      what: "Grow catnip that gently increases energy per second.",
      punch: "“Plant it, pet it, profit.”",
    },
    cavern: {
      what: "Shiny crystals hum and release extra energy.",
      punch: "“Find the sparkle, feel the power.”",
    },
    workshop: {
      what: "Neat tools keep the energy flowing reliably.",
      punch: "“Well-oiled whiskers.”",
    },
    upgrade: {
      what: "Increase energy gained per click by +1.",
      punch: "“From tap to zap.”",
    },
    save: {
      what: "Save your progress to this browser.",
      punch: "“No more losing streaks.”",
    },
    reset: {
      what: "Start over from the beginning.",
      punch: "“Fresh start, fresh purr.”",
    },
    export: {
      what: "Copy a save code you can store or share.",
      punch: "“Pocket your progress.”",
    },
    import: {
      what: "Paste a save code to continue where you left off.",
      punch: "“Back to business.”",
    },
  };

  const CLICK_UPGRADE = { baseCost: 50, factor: 1.3 };

  /* ---------------- GAME STATE ---------------- */
  const state: GameState = {
    version: VERSION,
    cookies: 0,
    lifetime: 0,
    clickPower: 1,
    clickUpgrades: 0,
    producers: PRODUCERS.map((p) => ({ id: p.id, owned: 0 })),
  };

  /* ---------------- HELPER FUNCTIONS ---------------- */
  const nf = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const fmt = (n: number) => nf.format(n);
  const now = () => performance.now();

  function requireDef(id: string): ProducerDef {
    const d = PRODUCERS.find((p) => p.id === id);
    if (!d) throw new Error(`Unknown producer id "${id}"`);
    return d;
  }
  const costOf = (base: number, owned: number) =>
    Math.ceil(base * Math.pow(1.15, owned));
  const clickUpgradeCost = (k: number) =>
    Math.ceil(CLICK_UPGRADE.baseCost * Math.pow(CLICK_UPGRADE.factor, k));
  const eps = () =>
    state.producers.reduce((a, pr) => a + requireDef(pr.id).cps * pr.owned, 0);

  function clamp(): void {
    state.cookies = Math.max(0, state.cookies);
    state.lifetime = Math.max(0, state.lifetime);
    state.clickPower = Math.max(1, state.clickPower);
    state.clickUpgrades = Math.max(0, state.clickUpgrades | 0);
    state.producers.forEach((p) => (p.owned = Math.max(0, p.owned | 0)));
  }

  /* ---------------- PERSISTENCE (moved above DOM) ---------------- */
  const SAVE_KEY = "cmpm121_d1_save";

  function save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      toast("Saved.");
    } catch (_err) {
      /* ignore: localStorage may be unavailable (private mode, quota, etc.) */
    }
  }
  function load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw) as GameState);
      clamp();
    } catch (_err) {
      /* ignore: corrupted or unavailable save */
    }
  }

  /* ---------------- DOM scaffold ---------------- */
  let appMaybe = document.querySelector<HTMLDivElement>("#app");
  if (!appMaybe) {
    const d = document.createElement("div");
    d.id = "app";
    document.body.appendChild(d);
    appMaybe = d;
  }
  const $app: HTMLDivElement = appMaybe!;
  $app.style.maxWidth = "880px";
  $app.style.margin = "2rem auto";
  $app.style.fontFamily =
    "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

  $app.innerHTML = `
    <header>
      <h1 style="margin:0 0 .25rem 0;">Cat Crew: Energy Clicker</h1>
      <p style="margin:.25rem 0 .25rem 0;color:#555">Version ${VERSION}</p>
      <p style="margin:0 0 1rem 0;color:#555">
        <em>You lead a team of helpful cats. Click to gather <strong>energy</strong>, hire cats to help,
        and build a steady energy machine.</em>
      </p>
    </header>

    <section id="stats" style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
      <div class="card" style="border:1px solid #eee;border-radius:.75rem;padding:1rem;min-width:260px">
        <div><small>Energy</small><br><strong class="val" id="count">0</strong></div>
        <div style="height:.5rem"></div>
        <div><small>Total Energy</small><br><strong class="val" id="lifetime">0</strong></div>
        <div style="height:.5rem"></div>
        <div><small>Energy / Sec (EPS)</small><br><strong class="val" id="cps">0</strong></div>
      </div>

      <div class="card" style="border:1px solid #eee;border-radius:.75rem;padding:1rem;display:flex;flex-direction:column;gap:.5rem;align-items:flex-start">
        <button id="tap" aria-label="Gather energy"
          style="padding:.6rem .9rem;border:1px solid #ddd;border-radius:.6rem;cursor:pointer">
          🪄✨ Gather Energy!
        </button>
        <small>Space = click • 1–5 = hire • U = upgrade</small>
      </div>
    </section>

    <section>
      <h2 style="margin:1.25rem 0 .5rem 0;">Cat Crew</h2>
      <ul id="producers" style="list-style:none;margin:0;padding:0"></ul>
    </section>

    <section>
      <h2 style="margin:1.25rem 0 .5rem 0;">Upgrades</h2>
      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
        <button id="buyUpg"
          style="padding:.45rem .75rem;border:1px solid #ddd;border-radius:.5rem;cursor:pointer">🪄✨ Upgrade Gather (+1)</button>
        <div id="upgInfo"></div>
      </div>
    </section>

    <section>
      <h2 style="margin:1.25rem 0 .5rem 0;">Save & Share</h2>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button id="save"  style="padding:.4rem .7rem;border:1px solid #ddd;border-radius:.5rem;cursor:pointer">Save</button>
        <button id="reset" style="padding:.4rem .7rem;border:1px solid #ddd;border-radius:.5rem;cursor:pointer">Reset</button>
        <button id="export" style="padding:.4rem .7rem;border:1px solid #ddd;border-radius:.5rem;cursor:pointer">Export</button>
        <button id="import" style="padding:.4rem .7rem;border:1px solid #ddd;border-radius:.5rem;cursor:pointer">Import</button>
      </div>
    </section>

    <div id="toasts" style="position:fixed;right:1rem;bottom:1rem;display:flex;flex-direction:column;gap:.5rem;z-index:9999"></div>
  `;

  /* >>> Added: global button polish (3D shadow + press/hover) <<< */
  const $style = document.createElement("style");
  $style.textContent = `
    #app button {
      box-shadow: 0 2px 0 rgba(0,0,0,.12), 0 6px 12px rgba(0,0,0,.06);
      transition: transform .06s ease, box-shadow .06s ease, opacity .2s ease;
      will-change: transform, box-shadow;
    }
    #app button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 3px 0 rgba(0,0,0,.14), 0 10px 16px rgba(0,0,0,.08);
    }
    #app button:active:not(:disabled) {
      transform: translateY(1px);
      box-shadow: 0 1px 0 rgba(0,0,0,.1), 0 4px 8px rgba(0,0,0,.06);
    }
    #app button:disabled {
      opacity: .6;
      box-shadow: none;
      transform: none;
      cursor: not-allowed;
    }
    /* Nice visible keyboard focus */
    #app button:focus-visible {
      outline: 2px solid #6aa9ff;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild($style);
  /* <<< End added block <<< */

  // Typed refs - button styles
  const $count = document.querySelector<HTMLSpanElement>("#count")!;
  const $life = document.querySelector<HTMLSpanElement>("#lifetime")!;
  const $cps = document.querySelector<HTMLSpanElement>("#cps")!;
  const $tap = document.querySelector<HTMLButtonElement>("#tap")!;
  const $list = document.querySelector<HTMLUListElement>("#producers")!;
  const $buyUpg = document.querySelector<HTMLButtonElement>("#buyUpg")!;
  const $upgInfo = document.querySelector<HTMLDivElement>("#upgInfo")!;
  const $save = document.querySelector<HTMLButtonElement>("#save")!;
  const $reset = document.querySelector<HTMLButtonElement>("#reset")!;
  const $export = document.querySelector<HTMLButtonElement>("#export")!;
  const $import = document.querySelector<HTMLButtonElement>("#import")!;
  const $toasts = document.querySelector<HTMLDivElement>("#toasts")!;

  /* ---------------- Tooltip system ---------------- */
  const $tip = document.createElement("div");
  $tip.setAttribute("role", "tooltip");
  $tip.style.cssText = [
    "position:fixed",
    "max-width:280px",
    "background:#111",
    "color:#fff",
    "padding:.55rem .7rem",
    "border-radius:.6rem",
    "box-shadow:0 6px 20px rgba(0,0,0,.25)",
    "font-size:.9rem",
    "line-height:1.25",
    "z-index:99999",
    "pointer-events:none",
    "opacity:0",
    "transform:translateY(4px)",
    "transition:opacity .12s ease, transform .12s ease",
  ].join(";");
  document.body.appendChild($tip);

  let tipActiveEl: HTMLElement | null = null;

  function positionTip(el: HTMLElement): void {
    const r = el.getBoundingClientRect();
    const margin = 8;
    const viewportW = globalThis.innerWidth; // Deno lint: use globalThis, not window
    const viewportH = globalThis.innerHeight; // Deno lint: use globalThis, not window
    const x = Math.min(
      viewportW - $tip.offsetWidth - margin,
      Math.max(margin, r.left + r.width / 2 - $tip.offsetWidth / 2),
    );
    const yBelow = r.bottom + margin;
    const y = yBelow + $tip.offsetHeight > viewportH
      ? r.top - $tip.offsetHeight - margin
      : yBelow;
    $tip.style.left = `${x}px`;
    $tip.style.top = `${Math.max(4, y)}px`;
  }
  function showTipFor(el: HTMLElement, html: string): void {
    tipActiveEl = el;
    $tip.innerHTML = html;
    positionTip(el);
    $tip.style.opacity = "1";
    $tip.style.transform = "translateY(0)";
  }
  function hideTip(): void {
    tipActiveEl = null;
    $tip.style.opacity = "0";
    $tip.style.transform = "translateY(4px)";
  }
  // Deno lint: prefer globalThis or no prefix over window.*
  globalThis.addEventListener("resize", () => {
    if (tipActiveEl) positionTip(tipActiveEl);
  });

  function bindTooltip(el: HTMLElement, builder: () => string): void {
    el.setAttribute("tabindex", el.getAttribute("tabindex") ?? "0");
    el.addEventListener("mouseenter", () => showTipFor(el, builder()));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", () => showTipFor(el, builder()));
    el.addEventListener("blur", hideTip);
    el.addEventListener("mousemove", () => {
      if (tipActiveEl === el) positionTip(el);
    });
  }
  const line = (label: string, value: string) =>
    `<div><strong>${label}:</strong> ${value}</div>`;

  /* ---------------- Base64 helpers (used by export/import) ---------------- */
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  function encodeSave(obj: unknown): string {
    const json = JSON.stringify(obj);
    const bytes = enc.encode(json);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function decodeSave<T>(str: string): T {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = dec.decode(bytes);
    return JSON.parse(json) as T;
  }

  /* ---------------- UI BUILDERS & REFRESHERS (after DOM) ---------------- */
  function buildProducers(): void {
    $list.replaceChildren();
    for (const def of PRODUCERS) {
      const owned = state.producers.find((p) => p.id === def.id)?.owned ?? 0;
      const priceofitem = costOf(def.baseCost, owned);

      const li = document.createElement("li");
      li.id = `pr_${def.id}`;
      li.style.cssText =
        "display:flex;justify-content:space-between;gap:.75rem;align-items:center;padding:.5rem;border:1px solid #eee;border-radius:.5rem;margin:.25rem 0";
      li.innerHTML = `
        <div>
          <strong>${def.name}</strong><br>
          <small>${fmt(def.cps)} EPS each • Owned: <strong class="owned">${owned}</strong></small>
        </div>
        <button class="buy" data-id="${def.id}" title="Key [${def.key}]"
          style="padding:.4rem .7rem;border:1px solid #ddd;border-radius:.5rem;cursor:pointer">
          ✨ Hire (${fmt(priceofitem)})
        </button>
      `;
      $list.appendChild(li);

      // dynamic tooltips
      const btn = li.querySelector<HTMLButtonElement>("button.buy")!;
      bindTooltip(btn, () => {
        const own = state.producers.find((p) => p.id === def.id)?.owned ?? 0;
        const next = costOf(def.baseCost, own);
        const desc = FLAVOR[def.id];
        return `
          <div style="margin-bottom:.25rem">${desc.what}</div>
          ${line("Effect", `${fmt(requireDef(def.id).cps)} EPS each`)}
          ${line("Owned", String(own))}
          ${line("Next Cost", fmt(next))}
          <div style="opacity:.85;margin-top:.35rem"><em>${desc.punch}</em></div>
        `;
      });
    }
  }

  function refreshNumbers(): void {
    $count.textContent = fmt(state.cookies); // Energy
    $life.textContent = fmt(state.lifetime); // Total Energy
    $cps.textContent = fmt(eps()); // EPS
    $upgInfo.textContent =
      `Current per click: +${state.clickPower} • Next cost: ${fmt(clickUpgradeCost(state.clickUpgrades))}`;
  }

  function refreshButtons(): void {
    for (const def of PRODUCERS) {
      const owned = state.producers.find((p) => p.id === def.id)?.owned ?? 0;
      const priceofitem = costOf(def.baseCost, owned);
      const btn = document.querySelector<HTMLButtonElement>(
        `#pr_${def.id} .buy`,
      );
      if (!btn) continue;
      btn.disabled = state.cookies < priceofitem;
      btn.textContent = `✨ Hire (${fmt(priceofitem)})`;
      const ownedEl = document.querySelector<HTMLSpanElement>(
        `#pr_${def.id} .owned`,
      );
      if (ownedEl) ownedEl.textContent = String(owned);
    }
    const nextCost = clickUpgradeCost(state.clickUpgrades);
    $buyUpg.disabled = state.cookies < nextCost;
  }

  /* ---------------- GAME ACTIONS ---------------- */
  function clickCookie(): void {
    state.cookies += state.clickPower;
    state.lifetime += state.clickPower;
    refreshNumbers();
    refreshButtons();
  }

  function buyProducer(id: string): void {
    const def = requireDef(id);
    const owned = state.producers.find((p) => p.id === id)?.owned ?? 0;
    const priceofitem = costOf(def.baseCost, owned);
    if (state.cookies < priceofitem) return;
    state.cookies -= priceofitem;
    const slot = state.producers.find((p) => p.id === id);
    if (slot) slot.owned++;
    toast(`Hired ${def.name}.`);
    refreshNumbers();
    refreshButtons();
  }

  function buyClickUpgrade(): void {
    const priceofitem = clickUpgradeCost(state.clickUpgrades);
    if (state.cookies < priceofitem) return;
    state.cookies -= priceofitem;
    state.clickUpgrades++;
    state.clickPower++;
    toast("Click power +1.");
    refreshNumbers();
    refreshButtons();
  }

  let last = now();
  function frame(): void {
    const t = now();
    const dt = t - last;
    last = t;

    const income = eps() * (dt / 1000);
    state.cookies += income;
    state.lifetime += income;

    refreshNumbers();
    refreshButtons();
    requestAnimationFrame(frame);
  }

  /* ---------------- EVENTS ---------------- */
  $tap.addEventListener("click", clickCookie);

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      clickCookie();
      return;
    }
    const p = PRODUCERS.find((d) => d.key === e.key);
    if (p) buyProducer(p.id);
    if (e.key.toLowerCase() === "u") buyClickUpgrade();
  });

  $list.addEventListener("click", (e: MouseEvent) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest("button.buy");
    if (btn instanceof HTMLButtonElement) {
      const id = btn.getAttribute("data-id");
      if (id) buyProducer(id);
    }
  });

  $buyUpg.addEventListener("click", buyClickUpgrade);

  const lineSimple = (k: keyof typeof FLAVOR) =>
    `<div>${FLAVOR[k].what}</div><div style="opacity:.85;margin-top:.35rem"><em>${FLAVOR[k].punch}</em></div>`;

  bindTooltip(
    $buyUpg,
    () =>
      `<div>${FLAVOR.upgrade.what}</div>${line("Current", `+${state.clickPower} per click`)}${line("Next Cost", fmt(clickUpgradeCost(state.clickUpgrades)))}<div style="opacity:.85;margin-top:.35rem"><em>${FLAVOR.upgrade.punch}</em></div>`,
  );

  // Bind tooltips for save/reset/export/import
  bindTooltip($save, () => lineSimple("save"));
  bindTooltip($reset, () => lineSimple("reset"));
  bindTooltip($export, () => lineSimple("export"));
  bindTooltip($import, () => lineSimple("import"));

  // Bind actions for save/reset/export/import
  $save.addEventListener("click", save);
  $reset.addEventListener("click", () => {
    if (!confirm("Reset your progress?")) return;
    const keep = state.version;
    Object.assign(state, {
      version: keep,
      cookies: 0,
      lifetime: 0,
      clickPower: 1,
      clickUpgrades: 0,
      producers: PRODUCERS.map((p) => ({ id: p.id, owned: 0 })),
    } as GameState);
    buildProducers();
    refreshNumbers();
    refreshButtons();
    save();
  });

  /* ---------------- EXPORT / IMPORT ---------------- */
  $export.addEventListener("click", () => {
    try {
      const str = encodeSave(state);
      void navigator.clipboard?.writeText(str);
      prompt("Copy your save code:", str);
    } catch (_err) {
      /* ignore: clipboard or prompt may be blocked */
    }
  });

  $import.addEventListener("click", () => {
    const raw = prompt("Paste your save code:");
    if (!raw) return;
    try {
      const json = decodeSave<GameState>(raw);
      Object.assign(state, json);
      clamp();
      buildProducers();
      refreshNumbers();
      refreshButtons();
      save();
      toast("Progress restored.");
    } catch (_err) {
      alert("That code didn't work. Please try again.");
    }
  });

  /* ---------------- INIT ---------------- */
  load();
  buildProducers();
  refreshNumbers();
  refreshButtons();
  setInterval(save, 10_000);
  requestAnimationFrame(frame);

  function toast(msg: string): void {
    const n = document.createElement("div");
    n.textContent = msg;
    n.style.cssText =
      "background:#111;color:#fff;padding:.5rem .75rem;border-radius:.5rem;opacity:.95";
    $toasts.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }
})();
