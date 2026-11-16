// Escenas del desierto (dirección Paisaje). Cada pestaña abre con un paisaje
// que muestra un dato real: el sol de Inicio es el día de hoy dentro del mes y
// los puntos sobre la duna son los pagos. Los colores salen de las variables de
// tema, así que una misma escena sirve para Día y Noche.
import C from "../domain/finance.js";
import { esc, money, svg } from "./components.js";

const W = 390;

const stop = (offset, variable, opacity) =>
  `<stop offset="${offset}" style="stop-color: var(${variable})${opacity === undefined ? "" : `; stop-opacity: ${opacity}`}"></stop>`;

function defs(id, grain) {
  return `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">${stop(0, "--sky-1")}${stop(0.55, "--sky-2")}${stop(1, "--sky-3")}</linearGradient><radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">${stop(0, "--glow")}${stop(1, "--glow", 0)}</radialGradient><radialGradient id="${id}-orb" cx="0.38" cy="0.35" r="0.7">${stop(0, "--orb-2")}${stop(1, "--orb")}</radialGradient><linearGradient id="${id}-far" x1="0" y1="0" x2="0" y2="1">${stop(0, "--far-1")}${stop(1, "--far-2")}</linearGradient><linearGradient id="${id}-mid" x1="0" y1="0" x2="1" y2="0.4">${stop(0, "--mid-1")}${stop(1, "--mid-2")}</linearGradient>${
    grain
      ? `<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"></feTurbulence><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.28  0 0 0 0 0.12  0 0 0 0.45 0"></feColorMatrix></filter>`
      : ""
  }</defs>`;
}

function sky(id, h) {
  return `<rect width="${W}" height="${h}" fill="url(#${id}-sky)"></rect><g class="scene-stars" fill="#f4ebdd"><circle cx="34" cy="40" r="1"></circle><circle cx="92" cy="22" r="0.8"></circle><circle cx="150" cy="58" r="1.1"></circle><circle cx="226" cy="30" r="0.7"></circle><circle cx="268" cy="72" r="1"></circle><circle cx="352" cy="38" r="1.2"></circle><circle cx="58" cy="118" r="0.9"></circle><circle cx="300" cy="120" r="0.8"></circle></g>`;
}

function orb(id, x, y, r) {
  return `<circle cx="${x}" cy="${y}" r="${r * 3.2}" fill="url(#${id}-glow)"></circle><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}-orb)"></circle>`;
}

const moon = (x, y) =>
  `<g class="scene-moon"><circle cx="${x}" cy="${y}" r="9" fill="#d9cfbd"></circle></g>`;

const grainLayer = (id, h) =>
  `<rect width="${W}" height="${h}" filter="url(#${id}-grain)" class="scene-grain"></rect>`;

const dune = (d, fill, ridge = true) =>
  `<path d="${d} L${W} 1000 L0 1000 Z" fill="${fill}"></path>${ridge ? `<path d="${d}" fill="none" class="scene-ridge"></path>` : ""}`;

function wrap(kind, h, body, label = "") {
  return `<svg class="scene-art" viewBox="0 0 ${W} ${h}" preserveAspectRatio="xMidYMax slice" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'} focusable="false">${body}</svg>`;
}

// ---- Inicio: el sol de hoy y los pagos del mes sobre la duna -------------

export function monthHorizon(state, month = C.month()) {
  const days = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0,
    ).getDate(),
    today = C.today(),
    todayDay = C.month(today) === month ? Number(today.slice(8)) : 0,
    x = (day) => 34 + ((day - 1) * 322) / Math.max(days - 1, 1),
    items = C.obligations(state, month),
    biggest = Math.max(1, ...items.map((i) => i.amount)),
    radius = (n) => 3 + 5 * Math.sqrt(n / biggest);
  const pending = items.filter((i) => !i.paid);
  const markers = items
    .map((i) => {
      const day = Number(i.date.slice(8)),
        r = radius(i.amount).toFixed(1),
        late = !i.paid && i.date < today;
      return `<circle cx="${x(day).toFixed(1)}" cy="0" r="${r}" class="horizon-mark ${i.paid ? "paid" : late ? "late" : "due"}"></circle>`;
    })
    .join("");
  const label = `${pending.length} ${pending.length === 1 ? "pago pendiente" : "pagos pendientes"} este mes${todayDay ? `; hoy es día ${todayDay}` : ""}`;
  return { days, todayX: todayDay ? x(todayDay) : null, markers, label, x };
}

export function homeScene(state) {
  const id = "sh",
    h = 500,
    horizon = monthHorizon(state),
    sunX = horizon.todayX ?? 195,
    line = 472;
  const body =
    defs(id, true) +
    sky(id, h) +
    moon(336, 118) +
    orb(id, sunX.toFixed(1), 348, 24) +
    dune(
      "M0 378 C 70 350 130 338 200 356 S 320 394 390 360",
      `url(#${id}-far)`,
    ) +
    dune(
      "M0 414 C 90 386 170 398 250 406 S 350 390 390 394",
      `url(#${id}-mid)`,
    ) +
    `<g class="scene-ripples"><path d="M26 432 C 80 420 130 424 180 430"></path><path d="M110 442 C 170 434 220 436 270 441"></path><path d="M230 424 C 280 416 320 418 372 421"></path></g>` +
    `<path d="M0 454 C 100 438 200 448 290 450 S 370 442 390 444 L390 ${h} L0 ${h} Z" class="scene-ground"></path>` +
    grainLayer(id, h) +
    `<line x1="34" y1="${line}" x2="356" y2="${line}" class="horizon-line"></line>` +
    (horizon.todayX
      ? `<line x1="34" y1="${line}" x2="${sunX.toFixed(1)}" y2="${line}" class="horizon-past"></line><line x1="${sunX.toFixed(1)}" y1="374" x2="${sunX.toFixed(1)}" y2="${line}" class="horizon-today"></line>`
      : "") +
    `<g transform="translate(0 ${line})">${horizon.markers}</g>` +
    `<text x="34" y="494" text-anchor="middle" class="horizon-label">1</text>` +
    (horizon.todayX
      ? `<text x="${sunX.toFixed(1)}" y="494" text-anchor="middle" class="horizon-label today">Hoy</text>`
      : "") +
    `<text x="356" y="494" text-anchor="middle" class="horizon-label">${horizon.days}</text>`;
  return wrap("home", h, body, `Horizonte del mes: ${horizon.label}`);
}

// ---- Escenas de pestaña -------------------------------------------------

const H = 260;

function footprints(points) {
  return `<g class="scene-steps">${points
    .map(
      ([x, y], i) =>
        `<ellipse cx="${x}" cy="${y + (i % 2 ? 4 : 0)}" rx="3.2" ry="1.6" transform="rotate(-12 ${x} ${y})"></ellipse>`,
    )
    .join("")}</g>`;
}

export function tabScene(kind) {
  const id = "s" + kind;
  let body = defs(id, true) + sky(id, H) + moon(64, 70);
  if (kind === "activity") {
    body +=
      orb(id, 306, 150, 18) +
      dune(
        "M0 176 C 80 150 160 146 240 164 S 350 186 390 168",
        `url(#${id}-far)`,
      ) +
      dune(
        "M0 214 C 90 196 170 204 250 210 S 350 198 390 202",
        `url(#${id}-mid)`,
      ) +
      footprints([
        [36, 236],
        [62, 232],
        [90, 229],
        [118, 226],
        [148, 224],
        [178, 222],
        [208, 221],
        [238, 220],
      ]);
  } else if (kind === "money") {
    body +=
      orb(id, 268, 116, 18) +
      dune(
        "M0 170 C 70 150 140 152 210 168 S 330 184 390 160",
        `url(#${id}-far)`,
      ) +
      dune(
        "M0 212 C 70 196 120 200 170 206 S 260 214 390 204",
        `url(#${id}-mid)`,
      ) +
      `<ellipse cx="258" cy="224" rx="70" ry="9" class="scene-water"></ellipse><ellipse cx="268" cy="224" rx="10" ry="2.4" class="scene-reflection"></ellipse>` +
      `<g class="scene-palm"><path d="M346 226 C 344 206 342 194 348 178" fill="none" stroke-width="3" stroke-linecap="round"></path><path d="M348 178 C 334 172 324 176 316 184 M348 178 C 360 168 372 170 380 176 M348 178 C 342 164 334 160 324 162 M348 178 C 356 164 366 160 376 164" fill="none" stroke-width="2.4" stroke-linecap="round"></path></g>`;
  } else {
    body +=
      orb(id, 300, 96, 16) +
      dune(
        "M0 120 C 90 124 160 150 230 184 S 330 214 390 216",
        `url(#${id}-far)`,
      ) +
      dune("M0 210 C 110 204 220 214 390 218", `url(#${id}-mid)`, false) +
      footprints([
        [70, 132],
        [100, 140],
        [130, 150],
        [158, 162],
        [186, 174],
        [214, 186],
        [244, 198],
        [276, 206],
      ]) +
      `<g class="scene-flag"><line x1="344" y1="214" x2="344" y2="186" stroke-width="2"></line><path d="M344 186 L360 191 L344 196 Z"></path></g>`;
  }
  body +=
    `<path d="M0 240 C 120 230 260 238 390 234 L390 ${H} L0 ${H} Z" class="scene-ground"></path>` +
    grainLayer(id, H);
  return wrap(kind, H, body);
}

// Cabecera de pestaña: escena + título serif + cifra + acciones.
export function tabHeader({
  kind,
  title,
  kicker = "",
  figure = "",
  note = "",
  actions = "",
}) {
  return `<header class="scene-head scene-${kind}">${tabScene(kind)}<div class="scene-copy"><div class="scene-top"><h1 class="scene-title">${title}</h1><div class="scene-actions">${actions}<button class="icon ghost-sky" data-action="settings" aria-label="Ajustes" title="Ajustes">${svg("settings")}</button></div></div>${kicker ? `<p class="scene-kicker">${kicker}</p>` : ""}${figure ? `<div class="scene-figure">${figure}</div>` : ""}${note ? `<p class="scene-note">${note}</p>` : ""}</div></header>`;
}

export const headerAction = (action, label, iconName = "plus") =>
  `<button class="icon ghost-sky" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${svg(iconName)}</button>`;

// Pestañas internas subrayadas. items: [label, action, id, active]
export function subTabs(label, items) {
  return `<div class="subtabs" role="tablist" aria-label="${esc(label)}">${items
    .map(
      ([text, action, id, active, aria]) =>
        `<button role="tab" aria-selected="${active ? "true" : "false"}" class="${active ? "active" : ""}" data-action="${action}" data-id="${esc(id)}"${aria ? ` aria-label="${esc(aria)}"` : ""}>${text}</button>`,
    )
    .join("")}</div>`;
}

// Encabezado común de Actividad (Movimientos, Calendario, Fijos).
export function activityHeader(state, metrics, current) {
  const actions =
    current === "fixed"
      ? headerAction("editFixed", "Agregar gasto fijo")
      : current === "calendar"
        ? ""
        : headerAction("newMovement", "Agregar movimiento");
  return (
    tabHeader({
      kind: "activity",
      title: "Actividad",
      kicker: `Salidas de ${new Date(C.today() + "T12:00:00").toLocaleDateString("es-MX", { month: "long" })}`,
      figure: `<span class="scene-amount">${money(metrics.outflow)}</span>`,
      note: `Entradas ${money(metrics.received)} · las huellas de tu dinero`,
      actions,
    }) +
    subTabs("Secciones de actividad", [
      ["Movimientos", "expenseSub", "all", current === "all"],
      ["Calendario", "tab", "calendar", current === "calendar"],
      [
        "Fijos",
        "expenseSub",
        "fixed",
        current === "fixed",
        "Fijos y suscripciones",
      ],
    ])
  );
}

// Encabezado común de Dinero (Cuentas, Tarjetas, Metas).
export function moneyHeader(state, metrics, current) {
  const own = C.accountSummary(state)
    .filter((a) => a.active !== false && a.type !== "restricted")
    .reduce((n, a) => n + a.total, 0);
  const actions =
    current === "credit"
      ? headerAction("creditEdit", "Agregar tarjeta")
      : current === "goal"
        ? headerAction("editGoal", "Crear meta")
        : headerAction("walletEdit", "Agregar cuenta");
  return (
    tabHeader({
      kind: "money",
      title: "Dinero",
      kicker: "Tu dinero en cuentas",
      figure: `<span class="scene-amount">${money(own)}</span>`,
      note: `Disponible para gastar ${money(metrics.available)}`,
      actions,
    }) +
    subTabs("Secciones de dinero", [
      ["Cuentas", "accountSub", "wallet", current === "wallet"],
      ["Tarjetas", "accountSub", "credit", current === "credit"],
      ["Metas", "tab", "goal", current === "goal"],
    ])
  );
}

// Bienvenida: escena completa con el sol (o la luna) sobre las dunas.
export function welcomeScene() {
  const id = "sw",
    h = 844;
  const body =
    defs(id, true) +
    `<rect width="${W}" height="${h}" fill="url(#${id}-sky)"></rect><g class="scene-stars" fill="#f4ebdd"><circle cx="40" cy="80" r="1.1"></circle><circle cx="120" cy="40" r="0.9"></circle><circle cx="300" cy="60" r="1.2"></circle><circle cx="352" cy="140" r="0.8"></circle><circle cx="70" cy="220" r="1"></circle><circle cx="250" cy="180" r="0.8"></circle><circle cx="180" cy="110" r="0.7"></circle><circle cx="20" cy="320" r="0.9"></circle></g>` +
    `<g class="scene-moon"><circle cx="300" cy="150" r="12" fill="#d9cfbd"></circle></g>` +
    orb(id, 150, 300, 46) +
    dune(
      "M0 330 C 80 296 160 288 240 312 S 350 346 390 320",
      `url(#${id}-far)`,
    ) +
    dune(
      "M0 392 C 110 362 210 376 300 384 S 370 372 390 374",
      `url(#${id}-mid)`,
    ) +
    `<g class="scene-ripples"><path d="M30 418 C 100 404 160 408 230 416"></path><path d="M180 438 C 250 428 310 430 380 434"></path></g>` +
    `<path d="M0 456 C 120 442 260 452 390 446 L390 ${h} L0 ${h} Z" class="scene-ground"></path>` +
    grainLayer(id, h);
  return wrap("welcome", h, body);
}
