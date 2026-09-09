"use strict";
const C = OSP,
  $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const money = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    (n || 0) / 100,
  );
const mlabel = (m) =>
  new Date(m + "-15T12:00:00").toLocaleDateString("es-MX", {
    month: "short",
    year: "numeric",
  });
const icons = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  expense: "M5 3h14v18l-3-2-4 2-4-2-3 2ZM8 8h8M8 12h5",
  debt: "M3 6h18v14H3ZM3 10h18M6 16h4",
  calendar: "M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2",
  goal: "M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12l8-8M16 4h4v4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  transfer: "M3 7h17l-4-4M21 17H4l4 4",
  edit: "m4 16 12-12 4 4L8 20H4ZM13 7l4 4",
  trash: "M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6",
  eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  pay: "M4 6h16v14H4ZM8 13l3 3 5-6",
  close: "m6 6 12 12M6 18 18 6",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  back: "m15 5-7 7 7 7",
};
const svg = (k) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[k] || icons.plus}"/></svg>`;
const icon = (k, title, action, id = "", extra = "") =>
  `<button class="icon ${k === "trash" ? "danger" : ""}" aria-label="${esc(title)}" title="${esc(title)}" data-action="${action}" data-id="${esc(id)}" ${extra}>${svg(k)}</button>`;
const btn = (text, action, id = "", cls = "") =>
  `<button class="btn ${cls}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;
let state,
  history = [],
  tab = "home",
  sub = "all",
  period = C.month(),
  busy = false,
  formSubmit = null,
  toastTimer,
  storeDB,
  importCandidate = null,
  filter = {
    q: "",
    from: C.month() + "-01",
    to: C.today(),
    category: "",
    method: "",
    kind: "",
    min: "",
    max: "",
  },
  showFilters = false;
const view = $("#view"),
  dialog = $("#dialog");
async function openStore() {
  if (window.NativeOSP) return;
  storeDB = await new Promise((resolve, reject) => {
    const r = indexedDB.open("projectosp-android-preview", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function readStore() {
  if (window.NativeOSP) {
    const raw = NativeOSP.read();
    if (raw.startsWith("ERROR:")) throw Error(raw.slice(6));
    return raw ? JSON.parse(raw) : null;
  }
  return await new Promise((res, rej) => {
    const r = storeDB.transaction("state").objectStore("state").get("current");
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}
const saveRequests = new Map();
let saveSerial = 0;
window.nativeSaved = (id, result) => {
  const pending = saveRequests.get(id);
  if (!pending) return;
  saveRequests.delete(id);
  if (result === "OK") pending.resolve();
  else pending.reject(Error(result.replace("ERROR:", "")));
};
async function writeStore(v) {
  if (window.NativeOSP) {
    if (NativeOSP.writeAsync) {
      await new Promise((resolve, reject) => {
        const id = ++saveSerial;
        saveRequests.set(id, { resolve, reject });
        NativeOSP.writeAsync(JSON.stringify(v), id);
      });
    } else {
      const r = NativeOSP.write(JSON.stringify(v));
      if (r !== "OK") throw Error(r.replace("ERROR:", ""));
    }
    return;
  }
  await new Promise((res, rej) => {
    const tx = storeDB.transaction("state", "readwrite");
    tx.objectStore("state").put(v, "current");
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
function syncReminders() {
  if (window.NativeOSP)
    NativeOSP.configureReminders(
      JSON.stringify({
        enabled: state.settings.reminders,
        days: state.settings.reminderDays,
        items: C.reminders(state),
      }),
    );
}
async function commit(label, fn) {
  if (busy) return;
  busy = true;
  const old = C.clone(state),
    oldHistory = history;
  try {
    fn(state);
    C.validate(state);
    C.snapshot(state);
    const nextHistory = [
      ...history,
      { label, date: new Date().toISOString(), state: old },
    ].slice(-15);
    await writeStore({
      state,
      history: nextHistory,
      draft: rebuildDraft,
      revision: revision + 1,
    });
    revision++;
    history = nextHistory;
    syncReminders();
    closeModal();
    render();
    toast(label, true);
    return true;
  } catch (e) {
    state = old;
    history = oldHistory;
    showError(e.message);
    return false;
  } finally {
    busy = false;
  }
}
async function undo() {
  if (!history.length || busy) return;
  busy = true;
  try {
    const entry = history[history.length - 1],
      next = C.clone(entry.state);
    C.validate(next);
    await writeStore({
      state: next,
      history: history.slice(0, -1),
      draft: rebuildDraft,
      revision: revision + 1,
    });
    revision++;
    state = next;
    history = history.slice(0, -1);
    syncReminders();
    closeModal();
    render();
    toast("Se deshizo: " + entry.label);
  } catch (e) {
    toast("No se pudo deshacer: " + e.message);
  } finally {
    busy = false;
  }
}
function toast(text, undoable = false) {
  clearTimeout(toastTimer);
  $("#toast").innerHTML =
    `<span>${esc(text)}</span>${undoable ? '<button data-action="undo">Deshacer</button>' : ""}`;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 8000);
}
function showError(message) {
  const el = $(".form-error");
  if (el) el.textContent = message;
  else toast(message);
}
function modal(title, html, submit) {
  formSubmit = submit || null;
  $("#modal").innerHTML =
    `<div class="row"><h2>${esc(title)}</h2>${icon("close", "Cerrar", "close")}</div>${html}`;
  if (!dialog.open) dialog.showModal();
}
function closeModal() {
  dialog.close();
  formSubmit = null;
}
function form(title, fields, onSubmit, submitText = "Guardar") {
  modal(
    title,
    `<form id="form">${fields}<div class="form-error" role="alert"></div><div class="form-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn primary" type="submit">${submitText}</button></div></form>`,
    onSubmit,
  );
}
const input = (name, label, value = "", type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const amount = (name, label, value = 0) =>
  input(
    name,
    label,
    value ? String(value / 100) : "",
    "text",
    'inputmode="decimal" data-money="1" placeholder="0.00" required',
  );
const select = (name, label, options, value) =>
  `<label>${label}<select name="${name}">${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
const moneyValue = (f) => {
  const v = String(f || "").replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(v))
    throw Error("Introduce un importe con hasta dos decimales.");
  return C.cents(v);
};
const methodOptions = [
  ["debit", "Débito"],
  ["cash", "Efectivo"],
];
function paymentFields(a) {
  return (
    amount("amount", "Importe", a) +
    select("method", "Pagar desde", methodOptions, "debit") +
    input(
      "date",
      "Fecha real de pago",
      C.today(),
      "date",
      `required max="${C.today()}"`,
    )
  );
}
function periodChooser() {
  return `<div class="toolbar">${icon("back", "Mes anterior", "prev")}<strong style="flex:1;text-align:center">${mlabel(period)}</strong>${icon("back", "Mes siguiente", "next", "", 'style="transform:rotate(180deg)"')}</div>`;
}
const empty = (title, note) =>
  `<div class="empty"><strong>${title}</strong>${note}</div>`;
function metric(n, key, cls = "") {
  return `<div class="metric ${cls}" data-metric="${key}" data-value="${n}">${money(n)}</div>`;
}
function render() {
  document.body.classList.toggle("full-screen", fullScreens.includes(tab));
  document.body.classList.toggle("expenses-screen", tab === "expense");
  const old = {};
  document
    .querySelectorAll("[data-metric]")
    .forEach((e) => (old[e.dataset.metric] = Number(e.dataset.value)));
  $("#nav").innerHTML = [
    ["home", "Inicio"],
    ["expense", "Gastos"],
    ["debt", "Deudas"],
    ["calendar", "Calendario"],
    ["goal", "Metas"],
  ]
    .map(
      ([k, t]) =>
        `<button data-action="tab" data-id="${k}" class="${tab === k ? "active" : ""}" ${tab === k ? 'aria-current="page"' : ""}>${svg(k)}${t}</button>`,
    )
    .join("");
  if (!state.started && !state.migration && tab !== "rebuild") {
    view.innerHTML = `<div class="page onboard"><img class="onboard-art" src="logo.png" alt=""><div class="eyebrow">Un nuevo comienzo</div><h1>Haz espacio para<br>lo que quieres.</h1><p>Tus cuentas, tus metas y un poco<br>más de claridad. Todo en tu teléfono.</p><div class="card">${btn("Importar respaldo de Melange / ProjectOSP", "import", "", "primary full")}${btn("Empezar desde cero", "start", "", "full")}${btn("Reconstruir meses anteriores", "rebuildStart", "", "full")}<p class="note">Tu información permanece en este dispositivo.<br>No necesitas crear una cuenta.</p></div></div>`;
    return;
  }
  const pages = {
    home: homePage,
    expense: expensesPage,
    debt: debtsPage,
    calendar: calendarPage,
    goal: goalsPage,
    settings: () => settingsPage().replace("</h1>", "</h1>" + reconstructionSettings()),
    projection: projectionPage,
    timeline: timelinePage,
    rebuild: rebuildPage,
  };
  view.innerHTML = `<div class="page">${(pages[tab] || homePage)()}</div>`;
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    document.querySelectorAll("[data-metric]").forEach((e) => {
      let target = Number(e.dataset.value),
        start = old[e.dataset.metric];
      if (start === undefined || start === target) return;
      const began = performance.now();
      function frame(t) {
        if (!e.isConnected) return;
        const p = Math.min((t - began) / 320, 1);
        e.textContent = money(
          Math.round(start + (target - start) * (1 - (1 - p) ** 3)),
        );
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
}
function homePage() {
  const m = C.metrics(state),
    items = C.obligations(state)
      .filter((i) => !i.paid)
      .sort((a, b) => a.date.localeCompare(b.date)),
    hist = state.liquidityHistory,
    delta = hist.length > 1 ? hist.at(-1).value - hist[0].value : null;
  return `<div class="row"><div><div class="eyebrow">${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</div><h1>Cada grano cuenta.</h1></div></div><section class="card hero"><div class="row"><span>Tu liquidez</span><span class="pill good">En este dispositivo</span></div>${metric(m.liquidity, "liquidity")}<div class="hero-bottom"><div><small>Débito</small><strong>${money(m.debit)}</strong></div><div><small>Efectivo</small><strong>${money(m.cash)}</strong></div></div></section><div class="quick"><button data-action="income"><span class="icon">${svg("plus")}</span>Ingreso</button><button data-action="expense"><span class="icon">${svg("minus")}</span>Gasto</button><button data-action="transfer"><span class="icon">${svg("transfer")}</span>Transferir</button></div><div class="grid"><div class="card accent"><small>Pendiente este mes</small>${metric(m.pending, "pending", "small")}<p class="note">${money(m.paid)} ya pagados</p></div><div class="card sage"><small>Disponible sin reservas</small>${metric(m.available, "available", "small")}<p class="note">${money(m.reserved)} para metas</p></div></div><section class="card"><div class="row"><h2>Lo que viene</h2>${btn("Ver mes", "tab", "calendar")}</div>${items.length ? items.slice(0, 3).map(paymentRow).join("") : empty("Al día", "No hay compromisos pendientes este mes.")}</section><section class="card"><div class="row"><h2>En qué se fue</h2><small>${mlabel(C.month())}</small></div>${donut(state.transactions.filter((t) => C.month(t.date) === C.month() && ["expense", "fixed"].includes(t.kind)))}<p class="note">Consumo registrado. Los pagos de deuda se muestran aparte para evitar duplicar compras.</p></section><section class="card"><div class="row"><h2>Las huellas de tu dinero</h2><span class="pill">${hist.length} ${state.reconstruction ? "saldos calculados" : "observaciones"}</span></div>${lineChart(hist)}<p class="note">${delta === null ? "Aún no hay suficientes puntos históricos." : `${money(delta)} de variación entre el primer y último saldo registrado.`} No equivale a ahorro mensual.</p></section><section class="card"><h2>Salud financiera</h2><div class="split"><div><small>Deuda / ingreso previsto</small><div class="metric">${m.dti === null ? "—" : m.dti.toFixed(1) + "%"}</div></div><div><small>Libre antes de variables</small>${metric(m.budgetFree, "free", "small")}</div></div><div class="bar"><span style="width:${Math.max(0, Math.min(100, ((m.fixed + m.debt) / Math.max(1, m.income)) * 100))}%"></span></div><p class="note">Compromisos: ${money(m.fixed + m.debt)} · Ingreso previsto: ${money(m.income)}. Pagar una cuota no cambia estos compromisos.</p>${btn("Explorar proyección", "projection", "", "full")}</section>`;
}
function paymentRow(i) {
  return `<div class="item row"><div><div class="item-title">${esc(i.name)}</div><p class="muted">${i.date}${i.n ? " · Cuota " + i.n : ""} ${i.date < C.today() && !i.paid ? '<span class="bad">· Vencido</span>' : ""}</p></div><div style="text-align:right"><div class="amount">${money(i.paid ? i.amount : (i.remaining ?? i.amount))}</div>${i.recorded && !i.paid ? "<small>Abono: " + money(i.recorded) + "</small>" : ""}${i.paid ? '<span class="pill good">Pagado</span>' : icon("pay", "Registrar pago", "pay", i.key, `data-period="${i.date.slice(0, 7)}"`)}</div></div>`;
}
const colors = [
  "#986437",
  "#c78b44",
  "#ba7856",
  "#79655e",
  "#b8a081",
  "#dac49f",
];
function donut(tx) {
  const map = {};
  tx.forEach((t) => {
    const name =
      state.categories.find((c) => c.id === t.categoryId)?.name ||
      (t.kind === "fixed" ? "Gastos fijos" : "Sin categoría");
    map[name] = (map[name] || 0) + t.amount;
  });
  let pairs = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (pairs.length > 5)
    pairs = [
      ...pairs.slice(0, 5),
      ["Otros", pairs.slice(5).reduce((a, x) => a + x[1], 0)],
    ];
  const total = pairs.reduce((a, x) => a + x[1], 0);
  if (!total)
    return empty(
      "Todavía sin gastos",
      "Los movimientos del periodo aparecerán aquí.",
    );
  let offset = 0;
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Gasto por categoría: ${esc(pairs.map(([n, a]) => n + " " + money(a)).join(", "))}"><circle cx="70" cy="70" r="51" fill="none" stroke="#eee8dd" stroke-width="20"/>${pairs
    .map(([name, a], i) => {
      const len = (a / total) * 320.442,
        off = offset;
      offset += len;
      return `<circle cx="70" cy="70" r="51" fill="none" stroke="${colors[i]}" stroke-width="20" stroke-dasharray="${len} ${320.442 - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(name)}: ${money(a)}</title></circle>`;
    })
    .join(
      "",
    )}<text x="70" y="67" text-anchor="middle" fill="#82796a" font-size="10">TOTAL</text><text x="70" y="84" text-anchor="middle" fill="#30291f" font-size="13" font-weight="700">${money(total)}</text></svg><div class="legend">${pairs.map(([n, a], i) => `<div><span><i class="dot" style="background:${colors[i]}"></i>${esc(n)}</span><strong>${Math.round((a / total) * 100)}%</strong></div>`).join("")}</div></div>`;
}
function lineChart(all) {
  const h = all.slice(-60);
  if (h.length < 2)
    return empty(
      "Tu historia comienza aquí",
      "El historial se construye con tus observaciones o movimientos reconstruidos.",
    );
  const min = Math.min(...h.map((x) => x.value)),
    max = Math.max(...h.map((x) => x.value)),
    range = max - min || 100;
  const start = Date.parse(h[0].date),
    end = Date.parse(h.at(-1).date),
    x = (d) => 15 + ((Date.parse(d) - start) / Math.max(1, end - start)) * 300,
    y = (v) => 125 - ((v - min) / range) * 90;
  const pts = h.map((p) => `${x(p.date)},${y(p.value)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 330 160" role="img" aria-label="Historial de liquidez de ${h[0].date} a ${h.at(-1).date}"><path d="M15 125H315M15 80H315M15 35H315" stroke="#e9e3d8" stroke-dasharray="3 5" fill="none"/><polygon points="15,130 ${pts} 315,130" fill="#efdfc2"/><polyline points="${pts}" fill="none" stroke="#986437" stroke-width="2.5" stroke-linejoin="round"/>${h.map((p) => `<circle cx="${x(p.date)}" cy="${y(p.value)}" r="3" fill="#986437"><title>${p.date}: ${money(p.value)}</title></circle>`).join("")}<text x="15" y="15">${money(max)}</text><text x="315" y="15" text-anchor="end">Último: ${money(h.at(-1).value)}</text><text x="15" y="152">${h[0].date}</text><text x="315" y="152" text-anchor="end">${h.at(-1).date}</text></svg>`;
}
function filtered() {
  return state.transactions
    .filter(
      (t) =>
        (!filter.q || t.name.toLowerCase().includes(filter.q.toLowerCase())) &&
        (!filter.from || t.date >= filter.from) &&
        (!filter.to || t.date <= filter.to) &&
        (!filter.category || t.categoryId === filter.category) &&
        (!filter.method || t.method === filter.method) &&
        (!filter.kind || t.kind === filter.kind) &&
        (!filter.min || t.amount >= Number(filter.min) * 100) &&
        (!filter.max || t.amount <= Number(filter.max) * 100),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
const kindName = (k) =>
  ({
    expense: "Gasto",
    fixed: "Gasto fijo",
    debt: "Pago de deuda",
    income: "Ingreso",
    transfer: "Transferencia",
    adjustment: "Ajuste",
  })[k] || k;
function expensesPage() {
  const tx = filtered(),
    out = tx
      .filter((t) => ["expense", "fixed", "debt"].includes(t.kind))
      .reduce((a, t) => a + t.amount, 0);
  return `<div class="row"><div><div class="eyebrow">Cada movimiento cuenta</div><h1>Gastos</h1></div>${icon("plus", "Agregar movimiento", "newMovement")}</div><div class="chips"><button class="chip ${sub === "all" ? "selected" : ""}" data-action="expenseSub" data-id="all">Movimientos</button><button class="chip ${sub === "fixed" ? "selected" : ""}" data-action="expenseSub" data-id="fixed">Fijos y suscripciones</button></div>${sub === "fixed" ? fixedList() : `<div class="toolbar"><input id="search" aria-label="Buscar movimientos" placeholder="Buscar movimiento…" value="${esc(filter.q)}">${icon("settings", "Mostrar filtros", "filters")}</div>${showFilters ? `<div class="card filters" id="filters">${input("from", "Desde", filter.from, "date")}${input("to", "Hasta", filter.to, "date")}${select("category", "Categoría", [["", "Todas"], ...state.categories.map((c) => [c.id, c.name])], filter.category)}${select("method", "Origen", [["", "Todos"], ...methodOptions], filter.method)}${select("kind", "Tipo", [["", "Todos"], ...["expense", "fixed", "debt", "income", "transfer", "adjustment"].map((k) => [k, kindName(k)])], filter.kind)}${input("min", "Importe mínimo", filter.min, "number", 'min="0" step="0.01"')}${input("max", "Importe máximo", filter.max, "number", 'min="0" step="0.01"')}${btn("Limpiar filtros", "clearFilters")}</div>` : ""}<div class="expenses-layout"><section class="card expense-chart"><h2>Consumo del periodo filtrado</h2>${donut(tx.filter((t) => ["expense", "fixed"].includes(t.kind)))}<p class="note">Mismos filtros que la lista. Pagos de deuda, transferencias y ajustes se muestran en movimientos, no en consumo.</p></section><section class="expense-list"><div class="row"><span class="muted">${tx.length} movimientos</span><strong>Salidas: ${money(out)}</strong></div><section class="card">${tx.length ? tx.map((t) => `<div class="item"><div class="row"><div><div class="item-title">${esc(t.name)}</div><p class="muted">${t.date} · ${kindName(t.kind)} · ${t.method === "cash" ? "Efectivo" : "Débito"} ${t.historical ? '<span class="badge">Importado</span>' : ""}</p></div><strong class="amount ${t.kind === "income" ? "good" : ""}">${t.kind === "income" ? "+" : ""}${money(t.amount)}</strong></div><div class="row" style="margin-top:8px"><small>${esc(state.categories.find((c) => c.id === t.categoryId)?.name || "Sin categoría")}</small><div class="actions">${icon("eye", "Ver movimiento", "transactionDetails", t.id)}${icon("edit", "Editar movimiento", "editTransaction", t.id)}${icon("trash", "Eliminar o revertir movimiento", "deleteTransaction", t.id)}</div></div></div>`).join("") : empty("Sin coincidencias", "Cambia los filtros o registra un movimiento.")}</section></section></div>`}`;
}
function fixedList() {
  return `${btn("Agregar gasto fijo", "editFixed", "", "primary full")}<section class="card">${state.fixedExpenses.length ? state.fixedExpenses.map((f) => `<div class="item"><div class="row"><div><div class="item-title">${esc(f.name)}</div><p class="muted">${f.kind === "subscription" ? "Suscripción" : "Gasto fijo"} · Día ${f.dueDay || 1}</p></div><strong>${money(f.amount)}</strong></div><div class="row" style="margin-top:9px"><span class="pill ${f.active !== false ? "good" : ""}">${f.active !== false ? "Activo" : "Archivado"}</span><div class="actions">${icon("eye", "Ver gasto fijo", "fixedDetails", f.id)}${icon("edit", "Editar gasto fijo", "editFixed", f.id)}${f.active !== false ? icon("pay", "Pagar gasto fijo", "pay", `fixed:${f.id}:${C.month()}`, `data-period="${C.month()}"`) : ""}${icon("trash", "Archivar gasto fijo", "deleteFixed", f.id)}</div></div></div>`).join("") : empty("Haz visibles tus compromisos", "Renta, internet y suscripciones viven aquí.")}</section>`;
}
function debtsPage() {
  const total = state.debts
    .filter((d) => !d.archived)
    .reduce((a, d) => a + d.balance, 0);
  return `<div class="row"><div><div class="eyebrow">Un pago más cerca</div><h1>Deudas</h1></div>${icon("plus", "Agregar deuda", "editDebt")}</div><div class="card hero"><small>Saldo registrado pendiente</small>${metric(total, "debtTotal")}<small>Consulta en cada deuda si incluye financiamiento.</small></div>${
    state.debts.length
      ? state.debts
          .map((d) => {
            const paid = d.paidPayments.length,
              pct = d.totalPayments
                ? Math.min(100, (paid / d.totalPayments) * 100)
                : d.originalAmount
                  ? Math.max(
                      0,
                      Math.min(100, (1 - d.balance / d.originalAmount) * 100),
                    )
                  : 0;
            const next = nextDebt(d);
            return `<section class="card"><div class="row"><div><h2>${esc(d.name)}</h2><small>${esc(state.accounts.find((a) => a.id === d.accountId)?.name || "Sin acreedor")} · ${esc(debtType(d.type))}</small></div><span class="pill ${d.balance === 0 ? "good" : ""}">${d.archived ? "Archivada" : d.balance === 0 ? "Liquidada" : "Activa"}</span></div><div class="row" style="margin-top:16px"><div><small>Saldo</small><div class="metric">${money(d.balance)}</div></div><div style="text-align:right"><small>Pago habitual</small><strong style="display:block">${money(d.payment)}</strong></div></div><div class="bar"><span style="width:${pct}%"></span></div><div class="row"><small>${d.totalPayments ? `${paid} / ${d.totalPayments} cuotas` : "Sin plazo fijo"}<br>${next ? "Próximo: " + next.date : "Sin pagos pendientes"}</small><div class="actions">${icon("eye", "Detalles de deuda", "debtDetails", d.id)}${icon("edit", "Editar deuda", "editDebt", d.id)}${next ? icon("pay", "Pagar deuda", "pay", next.key, `data-period="${next.date.slice(0, 7)}"`) : ""}${icon("trash", "Eliminar o archivar deuda", "deleteDebt", d.id)}</div></div></section>`;
          })
          .join("")
      : empty(
          "Tus deudas, en orden",
          "Agrega una deuda para organizar sus cuotas.",
        )
  }`;
}
const debtType = (t) =>
  ({
    msi: "Meses sin intereses",
    deferred: "Diferimiento",
    loan: "Préstamo",
    revolving: "Crédito revolvente",
    "loan-open": "Préstamo sin plazo",
  })[t] || t;
function nextDebt(d) {
  if (d.archived || d.balance <= 0) return null;
  let start = d.totalPayments && d.startDate ? C.month(d.startDate) : C.month(),
    count = d.totalPayments || 12;
  for (let n = 0; n < count; n++) {
    const i = C.schedule(d, C.addMonth(start, n));
    if (i && !C.isPaid(state, i)) return i;
  }
  return null;
}
function calendarPage() {
  const items = C.obligations(state, period),
    m = C.metrics(state, period);
  return `<div class="eyebrow">Tu mes, a la vista</div><h1>Calendario</h1><div class="calendar-shortcuts">${btn("Ver timeline anual", "timeline", "", "full")}${btn("Ver proyección de 12 meses", "projection", "", "full")}</div>${periodChooser()}<div class="grid"><div class="card accent"><small>Pendiente</small>${metric(m.pending, "calPending", "small")}</div><div class="card sage"><small>Pagado</small>${metric(m.paid, "calPaid", "small")}</div></div><section class="card"><div class="row"><h2>Compromisos</h2><small>${money(m.fixed + m.debt)} total</small></div>${
    items.length
      ? items
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(paymentRow)
          .join("")
      : empty("Un mes despejado", "No hay compromisos calendarizados.")
  }</section>`;
}
function goalsPage() {
  const m = C.metrics(state);
  return `<div class="row"><div><div class="eyebrow">Dale un propósito</div><h1>Metas de ahorro</h1></div>${icon("plus", "Crear meta", "editGoal")}</div><div class="card hero"><small>Dinero reservado</small>${metric(m.reserved, "reserved")}<small>Disponible para otros usos: ${money(m.available)}</small></div><p class="note">Reservar dinero no crea un gasto ni una cuenta nueva. Las reservas forman parte de tu efectivo y débito.</p>${
    state.goals.length
      ? state.goals
          .map((g) => {
            const pct = g.target
              ? Math.min(100, (g.balance / g.target) * 100)
              : 0;
            return `<section class="card"><div class="row"><h2>${esc(g.name)}</h2><span class="pill ${pct >= 100 ? "good" : ""}">${Math.round(pct)}%</span></div><div class="row"><strong>${money(g.balance)}</strong><small>de ${money(g.target)}</small></div><div class="bar"><span style="width:${pct}%"></span></div><div class="row"><small>${g.date ? "Objetivo: " + g.date : g.emergency ? "Tu colchón de tranquilidad" : "A tu ritmo"}</small><div class="actions">${icon("plus", "Aportar o liberar reserva", "contribute", g.id)}${icon("edit", "Editar meta", "editGoal", g.id)}${icon("trash", "Eliminar meta y liberar reserva", "deleteGoal", g.id)}</div></div></section>`;
          })
          .join("")
      : empty(
          "¿Qué quieres hacer posible?",
          "Crea una meta para tu fondo de emergencia, un viaje o una compra.",
        )
  }`;
}
function settingsPage() {
  return `<div class="eyebrow">A tu manera</div><h1>Ajustes</h1><section class="card"><h2>Tu punto de partida</h2><p class="note">Corrige saldos mediante un ajuste registrado. Define por separado el ingreso mensual esperado.</p><div class="toolbar">${btn("Ajustar saldos", "balances")}${btn("Ingreso previsto", "expectedIncome")}</div></section><section class="card"><div class="row"><h2>Acreedores</h2>${icon("plus", "Agregar acreedor", "editAccount")}</div>${state.accounts.map((a) => `<div class="item row"><span>${esc(a.name)}</span><div class="actions">${icon("edit", "Editar acreedor", "editAccount", a.id)}${icon("trash", "Eliminar acreedor", "deleteAccount", a.id)}</div></div>`).join("") || '<p class="muted">Sin acreedores.</p>'}</section><section class="card"><div class="row"><h2>Categorías</h2>${icon("plus", "Agregar categoría", "editCategory")}</div>${state.categories.map((a) => `<div class="item row"><span>${esc(a.name)}</span><div class="actions">${icon("edit", "Editar categoría", "editCategory", a.id)}${icon("trash", "Eliminar categoría", "deleteCategory", a.id)}</div></div>`).join("")}</section><section class="card"><h2>Recordatorios</h2><p>Avisos locales de próximos pagos, alrededor de las 9:00. Android puede retrasarlos por ahorro de batería.</p><p class="note">${state.settings.reminders ? "Activados en la app. " + (window.NativeOSP ? esc(NativeOSP.notificationStatus()) : "Solo disponibles en Android.") : "Desactivados."}</p>${btn(state.settings.reminders ? "Configurar recordatorios" : "Activar recordatorios", "reminders", "", "full")}</section><section class="card"><h2>Datos y recuperación</h2><div class="grid">${btn("Exportar respaldo", "export")}${btn("Importar respaldo", "import")}</div><div class="toolbar">${btn("Historial / deshacer", "history")}${btn("Instalar actualización", "update")}</div><p class="note">Melange 7.1 · Android · Base local SQLite.<br>Actualizar con un APK firmado con la misma clave conserva tus datos. Desinstalar borra los datos locales.</p>${state.migration ? '<p class="note">Migración v6: los gastos anteriores ya están incluidos en el saldo inicial. No se descontaron otra vez.</p>' : ""}</section><section class="card"><h2>Sincronización</h2><p class="muted">Esta versión funciona localmente. La conexión con Google Drive aún no está disponible.</p><p class="note">Puedes guardar un respaldo en Drive desde el selector de archivos de Android. Eso es una copia, no sincronización entre dispositivos.</p></section>`;
}
function newMovement() {
  modal(
    "Registrar movimiento",
    `<div class="quick"><button data-action="expense"><span class="icon">${svg("minus")}</span>Gasto</button><button data-action="income"><span class="icon">${svg("plus")}</span>Ingreso</button><button data-action="transfer"><span class="icon">${svg("transfer")}</span>Transferir</button></div>${btn("Pagar una deuda o gasto fijo", "choosePayment", "", "full")}`,
  );
}
function transactionForm(kind = "expense", existing) {
  const t = existing || {
    kind,
    amount: 0,
    name: "",
    date: C.today(),
    method: "debit",
    categoryId: "",
  };
  if (existing && ["debt", "fixed", "adjustment"].includes(t.kind)) {
    modal(
      "Movimiento vinculado",
      `<p>Para cambiar importe, fecha u origen, revierte este movimiento y regístralo de nuevo. Así se mantienen conectados el saldo y el compromiso.</p>${btn("Revertir movimiento", "deleteTransaction", t.id, "danger full")}`,
    );
    return;
  }
  const fields =
    input(
      "name",
      kind === "income" ? "Concepto del ingreso" : "Concepto",
      t.name,
      "text",
      'required maxlength="120"',
    ) +
    amount("amount", "Importe", t.amount) +
    input("date", "Fecha", t.date, "date", `required max="${C.today()}"`) +
    select(
      "method",
      kind === "income" ? "Recibir en" : "Pagar desde",
      methodOptions,
      t.method,
    ) +
    (kind === "expense"
      ? select(
          "categoryId",
          "Categoría",
          [
            ["", "Sin categoría"],
            ...state.categories.map((c) => [c.id, c.name]),
          ],
          t.categoryId,
        )
      : "") +
    (kind === "transfer"
      ? select("to", "Destino", methodOptions, t.to || "cash")
      : "") +
    (t.historical
      ? '<p class="note">Movimiento importado: editarlo no altera tu saldo inicial.</p>'
      : "");
  form(
    existing
      ? "Editar movimiento"
      : kind === "income"
        ? "Registrar ingreso"
        : kind === "transfer"
          ? "Transferir dinero"
          : "Registrar gasto",
    fields,
    async (f) => {
      const value = {
        kind,
        name: f.name.trim(),
        amount: moneyValue(f.amount),
        date: f.date,
        method: f.method,
        categoryId: f.categoryId || "",
        ...(kind === "transfer" ? { to: f.to } : {}),
      };
      if (kind === "transfer" && f.to === f.method)
        throw Error("El origen y destino deben ser diferentes.");
      await commit(
        existing ? "Movimiento actualizado" : "Movimiento registrado",
        (s) => {
          if (existing) {
            const original = s.transactions.find((x) => x.id === existing.id);
            Object.assign(original, value);
          } else C.record(s, value);
        },
      );
    },
  );
}
function choosePayment() {
  const items = C.obligations(state).filter((i) => !i.paid);
  modal(
    "Elegir compromiso",
    `<p class="note">Pagos pendientes de este mes. Para otros meses, abre Calendario.</p>${items.map(paymentRow).join("") || empty("Al día", "No hay pagos pendientes.")}`,
  );
}
function payForm(key, m) {
  const item =
    C.obligations(state, m).find((i) => i.key === key) ||
    C.planned(state, m).find((i) => i.key === key);
  if (!item || item.paid || C.isPaid(state, item)) {
    toast("Este compromiso ya está pagado o no está disponible.");
    return;
  }
  const d =
    item.kind === "debt" ? state.debts.find((d) => d.id === item.ref) : null;
  form(
    "Pagar " + item.name,
    `<p class="note">${item.n ? "Cuota " + item.n + " · " : ""}Vencimiento: ${item.date}. Se registrará una salida y se descontará del origen elegido. Puedes abonar una parte; el resto seguirá pendiente.</p>` +
      paymentFields(
        d?.balanceMode === "total"
          ? Math.min(d.balance, item.remaining ?? item.amount)
          : (item.remaining ?? item.amount),
      ) +
      (d?.balanceMode === "principal"
        ? amount(
            "principal",
            "Parte del pago que reduce capital",
            Math.min(d.balance, item.remaining ?? item.amount),
          )
        : "") +
      (item.kind === "fixed"
        ? select(
            "categoryId",
            "Categoría",
            [
              ["", "Gastos fijos"],
              ...state.categories.map((c) => [c.id, c.name]),
            ],
            "",
          )
        : "") +
      '<p class="note">Si el saldo disponible no alcanza, el resultado se mostrará negativo; no se recortará a cero.</p>',
    async (f) => {
      if (f.date > C.today())
        throw Error("La fecha real de pago no puede ser futura.");
      await commit("Pago registrado", (s) => {
        C.ensureBudget(s, m);
        C.pay(s, key, {
          period: m,
          amount: moneyValue(f.amount),
          method: f.method,
          date: f.date,
          categoryId: f.categoryId,
          principal: f.principal ? moneyValue(f.principal) : undefined,
        });
      });
    },
    "Registrar pago",
  );
}
function editDebt(id) {
  const d = state.debts.find((x) => x.id === id) || {
    name: "",
    accountId: "",
    type: "msi",
    originalAmount: 0,
    balance: 0,
    payment: 0,
    totalPayments: 0,
    startDate: C.today(),
    dueDay: 1,
    annualRate: 0,
    financingCost: 0,
    notes: "",
    balanceMode: "total",
  };
  const hasPaid =
    (d.paidPayments?.length || 0) > 0 ||
    state.transactions.some((t) => t.ref === id);
  form(
    id ? "Editar deuda" : "Nueva deuda",
    input("name", "Nombre", d.name, "text", 'required maxlength="120"') +
      select(
        "accountId",
        "Acreedor",
        [["", "Sin acreedor"], ...state.accounts.map((a) => [a.id, a.name])],
        d.accountId,
      ) +
      select(
        "type",
        "Tipo",
        ["msi", "deferred", "loan", "revolving", "loan-open"].map((t) => [
          t,
          debtType(t),
        ]),
        d.type,
      ) +
      amount("originalAmount", "Monto original", d.originalAmount) +
      amount("balance", "Saldo pendiente registrado", d.balance) +
      select(
        "balanceMode",
        "Qué representa el saldo",
        [
          ["total", "Total por pagar (incluye financiamiento)"],
          ["principal", "Solo capital (separar intereses al pagar)"],
        ],
        d.balanceMode,
      ) +
      amount("payment", "Cuota o pago mensual previsto", d.payment) +
      input(
        "totalPayments",
        "Número de cuotas (0 = sin plazo)",
        d.totalPayments,
        "number",
        `min="0" max="1200" required ${hasPaid ? "readonly" : ""}`,
      ) +
      input(
        "startDate",
        "Fecha de primera cuota",
        d.startDate || C.today(),
        "date",
        `required ${hasPaid ? "readonly" : ""}`,
      ) +
      input(
        "dueDay",
        "Día de vencimiento",
        d.dueDay || 1,
        "number",
        'min="1" max="31" required',
      ) +
      amount(
        "financingCost",
        "Costo total de financiamiento",
        d.financingCost,
      ) +
      input(
        "annualRate",
        "Tasa anual informativa (%)",
        d.annualRate || 0,
        "number",
        'min="0" max="1000" step="0.01"',
      ) +
      `<label>Notas<textarea name="notes" maxlength="2000">${esc(d.notes)}</textarea></label>` +
      (hasPaid
        ? '<p class="note">El inicio y número de cuotas están protegidos porque ya hay pagos. Los cambios de importe no reescriben movimientos anteriores.</p>'
        : ""),
    async (f) => {
      await commit(id ? "Deuda actualizada" : "Deuda agregada", (s) => {
        const value = {
          name: f.name.trim(),
          accountId: f.accountId,
          type: f.type,
          originalAmount: moneyValue(f.originalAmount),
          balance: moneyValue(f.balance),
          payment: moneyValue(f.payment),
          totalPayments: Number(f.totalPayments),
          startDate: f.startDate,
          dueDay: Number(f.dueDay),
          financingCost: moneyValue(f.financingCost),
          annualRate: Number(f.annualRate),
          notes: f.notes,
          balanceMode: f.balanceMode,
        };
        if (!value.name) throw Error("Escribe un nombre.");
        if (value.payment <= 0) throw Error("La cuota debe ser mayor a cero.");
        if (id)
          Object.assign(
            s.debts.find((x) => x.id === id),
            value,
          );
        else
          s.debts.push({
            ...value,
            id: C.id(),
            active: true,
            archived: false,
            paidPayments: [],
            paidMonths: [],
          });
        C.refreshBudget(s);
      });
    },
  );
}
function editFixed(id) {
  const f = state.fixedExpenses.find((x) => x.id === id) || {
    name: "",
    amount: 0,
    dueDay: 1,
    kind: "fixed",
    active: true,
  };
  form(
    id ? "Editar gasto fijo" : "Nuevo gasto fijo",
    input("name", "Nombre", f.name, "text", 'required maxlength="120"') +
      amount("amount", "Importe mensual", f.amount) +
      select(
        "kind",
        "Tipo",
        [
          ["fixed", "Gasto fijo"],
          ["subscription", "Suscripción"],
        ],
        f.kind,
      ) +
      input(
        "dueDay",
        "Día de vencimiento",
        f.dueDay || 1,
        "number",
        'min="1" max="31" required',
      ) +
      select(
        "active",
        "Estado",
        [
          ["yes", "Activo"],
          ["no", "Archivado"],
        ],
        f.active !== false ? "yes" : "no",
      ),
    async (v) =>
      commit(id ? "Gasto fijo actualizado" : "Gasto fijo agregado", (s) => {
        const value = {
          name: v.name.trim(),
          amount: moneyValue(v.amount),
          kind: v.kind,
          dueDay: Number(v.dueDay),
          active: v.active === "yes",
        };
        if (id)
          Object.assign(
            s.fixedExpenses.find((x) => x.id === id),
            value,
          );
        else
          s.fixedExpenses.push({ ...value, id: C.id(), startMonth: C.month() });
        C.refreshBudget(s);
      }),
  );
}
function editCatalog(kind, id) {
  const list = kind === "Account" ? "accounts" : "categories",
    x = state[list].find((a) => a.id === id);
  form(
    (id ? "Editar " : "Agregar ") +
      (kind === "Account" ? "acreedor" : "categoría"),
    input("name", "Nombre", x?.name || "", "text", 'required maxlength="80"'),
    async (f) =>
      commit("Catálogo actualizado", (s) => {
        const name = f.name.trim();
        if (!name) throw Error("Escribe un nombre.");
        if (
          s[list].some(
            (a) => a.id !== id && a.name.toLowerCase() === name.toLowerCase(),
          )
        )
          throw Error("Ya existe ese nombre.");
        if (id) s[list].find((a) => a.id === id).name = name;
        else s[list].push({ id: C.id(), name });
      }),
  );
}
function editGoal(id) {
  const g = state.goals.find((x) => x.id === id) || {
    name: "",
    target: 0,
    date: "",
  };
  form(
    id ? "Editar meta" : "Nueva meta",
    input("name", "Nombre", g.name, "text", 'required maxlength="100"') +
      amount("target", "Objetivo", g.target) +
      input("date", "Fecha objetivo (opcional)", g.date || "", "date"),
    async (f) =>
      commit(id ? "Meta actualizada" : "Meta creada", (s) => {
        const v = {
          name: f.name.trim(),
          target: moneyValue(f.target),
          date: f.date || null,
        };
        if (v.target <= 0) throw Error("La meta debe ser mayor a cero.");
        if (id)
          Object.assign(
            s.goals.find((x) => x.id === id),
            v,
          );
        else s.goals.push({ ...v, id: C.id(), balance: 0 });
      }),
  );
}
function contribute(id) {
  const g = state.goals.find((x) => x.id === id);
  form(
    g.name,
    select(
      "kind",
      "Acción",
      [
        ["add", "Reservar dinero"],
        ["remove", "Liberar reserva"],
      ],
      "add",
    ) +
      amount("amount", "Importe") +
      `<p class="note">Reservado: ${money(g.balance)}. Disponible sin reservas: ${money(C.metrics(state).available)}. No se crea un gasto.</p>`,
    async (f) =>
      commit("Reserva actualizada", (s) => {
        const goal = s.goals.find((x) => x.id === id),
          n = moneyValue(f.amount);
        if (n <= 0) throw Error("Introduce un importe mayor a cero.");
        if (f.kind === "add") {
          if (n > C.metrics(s).available)
            throw Error("No hay suficiente dinero sin reservar.");
          goal.balance += n;
        } else {
          if (n > goal.balance)
            throw Error("No puedes liberar más de lo reservado.");
          goal.balance -= n;
        }
      }),
  );
}
function confirmAction(title, message, label, fn) {
  form(
    title,
    `<p>${esc(message)}</p>`,
    async () => commit(label, fn),
    "Confirmar",
  );
}
function deleteEntity(type, id) {
  if (type === "Debt") {
    const d = state.debts.find((x) => x.id === id),
      linked =
        state.transactions.some((t) => t.ref === id) ||
        d.paidPayments.length > 0;
    confirmAction(
      linked ? "Archivar deuda" : "Eliminar deuda",
      linked
        ? "Se conservarán los pagos y movimientos. La deuda dejará de generar compromisos pendientes."
        : "Se eliminará esta deuda y sus compromisos pendientes. Puedes deshacerlo.",
      linked ? "Deuda archivada" : "Deuda eliminada",
      (s) => {
        if (linked) {
          s.debts.find((x) => x.id === id).archived = true;
        } else s.debts = s.debts.filter((x) => x.id !== id);
        C.refreshBudget(s);
      },
    );
  } else if (type === "Fixed")
    confirmAction(
      "Archivar gasto fijo",
      "Se conservarán sus pagos realizados y dejará de generar compromisos nuevos.",
      "Gasto fijo archivado",
      (s) => {
        s.fixedExpenses.find((x) => x.id === id).active = false;
        C.refreshBudget(s);
      },
    );
  else if (type === "Goal")
    confirmAction(
      "Eliminar meta",
      "Se liberará su reserva. Tu liquidez total no cambia.",
      "Meta eliminada",
      (s) => (s.goals = s.goals.filter((x) => x.id !== id)),
    );
  else {
    const key = type === "Account" ? "accounts" : "categories";
    if (
      (type === "Account" && state.debts.some((d) => d.accountId === id)) ||
      (type === "Category" &&
        state.transactions.some((t) => t.categoryId === id))
    ) {
      modal(
        "Este elemento tiene movimientos",
        `<p>Puedes cambiar su nombre. Para eliminarlo, primero reasigna las referencias que lo utilizan.</p>${btn("Entendido", "close", "", "full")}`,
      );
      return;
    }
    confirmAction(
      "Eliminar elemento",
      "Puedes recuperar este cambio con Deshacer.",
      "Elemento eliminado",
      (s) => (s[key] = s[key].filter((x) => x.id !== id)),
    );
  }
}
function transactionDetails(id) {
  const t = state.transactions.find((x) => x.id === id);
  modal(
    t.name,
    `<div class="details"><div><small>Importe</small><strong>${money(t.amount)}</strong></div><div><small>Tipo</small>${kindName(t.kind)}</div><div><small>Fecha</small>${t.date}</div><div><small>Origen</small>${t.method === "cash" ? "Efectivo" : "Débito"}</div></div>${t.historical ? '<p class="note">Importado de v6. Este gasto ya está contemplado en el saldo inicial; no se volvió a descontar.</p>' : ""}${t.obligation ? '<p class="note">Vinculado a un compromiso de ' + mlabel(t.period) + ".</p>" : ""}`,
  );
}
function debtDetails(id) {
  const d = state.debts.find((x) => x.id === id);
  modal(
    d.name,
    `<div class="details">${[
      ["Monto original", money(d.originalAmount)],
      ["Saldo", money(d.balance)],
      ["Pago habitual", money(d.payment)],
      ["Financiamiento total", money(d.financingCost)],
      ["Tasa anual", d.annualRate + "%"],
      [
        "Saldo representa",
        d.balanceMode === "principal" ? "Solo capital" : "Total pendiente",
      ],
    ]
      .map(
        ([k, v]) => `<div><small>${k}</small><strong>${esc(v)}</strong></div>`,
      )
      .join(
        "",
      )}</div><p>${esc(d.notes || "Sin notas")}</p><p class="note">${d.paidPayments.length} cuotas marcadas como pagadas. Los pagos migrados no tienen fecha real ni cuenta de origen.</p>${d.balance > 0 ? btn("Registrar abono adicional", "extraPayment", id, "full") : ""}<h3 style="margin-top:20px">Movimientos vinculados</h3>${
      state.transactions
        .filter((t) => t.ref === id)
        .map(
          (t) =>
            `<div class="item row"><span>${t.date}</span><strong>${money(t.amount)}</strong></div>`,
        )
        .join("") || '<p class="muted">Sin movimientos nuevos.</p>'
    }`,
  );
}
function extraPayment(id) {
  const d = state.debts.find((x) => x.id === id);
  form(
    "Abono adicional",
    paymentFields(0) +
      amount("principal", "Reducción del saldo", 0) +
      '<p class="note">No marca cuotas como pagadas ni recalcula el contrato. Si cambia el calendario, ajusta la deuda después.</p>',
    async (f) =>
      commit("Abono registrado", (s) => {
        const debt = s.debts.find((x) => x.id === id),
          a = moneyValue(f.amount),
          p = moneyValue(f.principal);
        if (p > a || p > debt.balance)
          throw Error("Revisa la reducción de saldo.");
        C.record(s, {
          kind: "debt",
          name: debt.name + " · Abono",
          amount: a,
          principal: p,
          ref: id,
          date: f.date,
          method: f.method,
          categoryId: "",
        });
        debt.balance -= p;
        if (!debt.balance) debt.active = false;
      }),
  );
}
function deleteTransaction(id) {
  const t = state.transactions.find((t) => t.id === id);
  confirmAction(
    t.historical ? "Eliminar antecedente" : "Revertir movimiento",
    t.historical
      ? "Se quitará del histórico. No cambia el saldo inicial importado."
      : "Se devolverá el importe a su origen y se reabrirá el compromiso asociado, cuando corresponda.",
    "Movimiento revertido",
    (s) => {
      if (t.historical)
        s.transactions = s.transactions.filter((x) => x.id !== id);
      else C.reverseTransaction(s, id);
    },
  );
}
function showProjection() {
  openPage("projection");
}
function timeline() {
  openPage("timeline");
}
async function importRaw(raw) {
  try {
    importCandidate = C.migrate(
      typeof raw === "string" ? JSON.parse(raw) : raw,
    );
    const s = importCandidate;
    modal(
      "Revisar importación",
      `<p>Se reemplazarán los datos actuales por este respaldo. El estado anterior quedará en Deshacer.</p><div class="details"><div><small>Deudas</small>${s.debts.length}</div><div><small>Movimientos</small>${s.transactions.length}</div><div><small>Débito</small>${money(C.balances(s).debit)}</div><div><small>Efectivo</small>${money(C.balances(s).cash)}</div></div><p class="note">${esc(s.migration?.note || "Respaldo compatible de Melange / ProjectOSP.")}</p>${btn("Importar estos datos", "confirmImport", "", "primary full")}`,
    );
  } catch (e) {
    toast("No se importó: " + e.message);
  }
}
window.receiveImport = importRaw;
window.nativeMessage = (message) => toast(message);
function doExport() {
  exportState(state);
}
function exportState(exported, filename = "Melange") {
  const json = JSON.stringify(
    {
      format: "projectosp-backup",
      version: 7,
      exportedAt: new Date().toISOString(),
      state: exported,
    },
    null,
    2,
  );
  if (window.NativeOSP) NativeOSP.exportBackup(json);
  else {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + "-" + C.today() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
async function action(a, id, el) {
  if (a.startsWith("rebuild")) {
    await reconstructionAction(a, id, el);
    return;
  }
  if (a === "screenBack") {
    backPage();
    return;
  }
  if (a === "timelineYear") {
    period = C.addMonth(period, 12 * Number(id));
    render();
    return;
  }
  if (a === "tab") {
    tab = id;
    period = C.month();
    closeModal();
    render();
    window.scrollTo(0, 0);
  } else if (a === "close") closeModal();
  else if (a === "settings") {
    tab = "settings";
    render();
    window.scrollTo(0, 0);
  } else if (a === "start")
    await commit("App preparada", (s) => {
      s.started = true;
      C.ensureBudget(s);
    });
  else if (a === "undo") await undo();
  else if (a === "expense" || a === "income" || a === "transfer")
    transactionForm(a);
  else if (a === "newMovement") newMovement();
  else if (a === "choosePayment") choosePayment();
  else if (a === "pay") payForm(id, el.dataset.period || C.month());
  else if (a === "editDebt") editDebt(id);
  else if (a === "editFixed") editFixed(id);
  else if (a === "editGoal") editGoal(id);
  else if (a === "contribute") contribute(id);
  else if (a === "editAccount" || a === "editCategory")
    editCatalog(a.slice(4), id);
  else if (
    [
      "deleteDebt",
      "deleteFixed",
      "deleteGoal",
      "deleteAccount",
      "deleteCategory",
    ].includes(a)
  )
    deleteEntity(a.slice(6), id);
  else if (a === "transactionDetails") transactionDetails(id);
  else if (a === "editTransaction") {
    const t = state.transactions.find((t) => t.id === id);
    transactionForm(t.kind, t);
  } else if (a === "deleteTransaction") deleteTransaction(id);
  else if (a === "debtDetails") debtDetails(id);
  else if (a === "extraPayment") extraPayment(id);
  else if (a === "fixedDetails") {
    const f = state.fixedExpenses.find((f) => f.id === id);
    modal(
      f.name,
      `<p>${money(f.amount)} al mes · Día ${f.dueDay}</p><p>${f.kind === "subscription" ? "Suscripción" : "Gasto fijo"}</p><p class="note">Cada pago se vincula al mes que corresponde.</p>`,
    );
  } else if (a === "expenseSub") {
    sub = id;
    render();
  } else if (a === "filters") {
    showFilters = !showFilters;
    render();
  } else if (a === "clearFilters") {
    filter = {
      q: "",
      from: "",
      to: "",
      category: "",
      method: "",
      kind: "",
      min: "",
      max: "",
    };
    render();
  } else if (a === "prev" || a === "next") {
    period = C.addMonth(period, a === "prev" ? -1 : 1);
    render();
  } else if (a === "projection") showProjection();
  else if (a === "timeline") timeline();
  else if (a === "balances") {
    const b = C.balances(state);
    form(
      "Ajustar saldos",
      amount("debit", "Débito real", b.debit) +
        amount("cash", "Efectivo real", b.cash) +
        '<p class="note">La diferencia queda registrada como ajuste, no como ingreso ni gasto.</p>',
      async (f) =>
        commit("Saldos ajustados", (s) => {
          const current = C.balances(s);
          for (const method of ["cash", "debit"]) {
            const diff = moneyValue(f[method]) - current[method];
            if (diff)
              C.record(s, {
                kind: "adjustment",
                name: "Ajuste de saldo",
                method,
                amount: Math.abs(diff),
                direction: diff < 0 ? -1 : 1,
                date: C.today(),
              });
          }
        }),
    );
  } else if (a === "expectedIncome")
    form(
      "Ingreso mensual previsto",
      amount("income", "Ingreso previsto", state.income) +
        '<p class="note">No aumenta tu saldo. Registra cada ingreso recibido desde Inicio.</p>',
      async (f) =>
        commit("Ingreso previsto actualizado", (s) => {
          s.income = moneyValue(f.income);
          C.refreshBudget(s);
        }),
    );
  else if (a === "import") {
    if (window.NativeOSP) NativeOSP.importBackup();
    else $("#importFile").click();
  } else if (a === "confirmImport") {
    const incoming = C.clone(importCandidate);
    await commit("Respaldo importado", (s) => {
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, incoming, { started: true });
      C.ensureBudget(s);
    });
  } else if (a === "export") doExport();
  else if (a === "update") {
    modal(
      "Actualizar Melange",
      `<p>Selecciona un APK nuevo de Melange. Android verificará la firma y conservará los datos al actualizar.</p><p class="note">No desinstales la versión actual. Puedes exportar un respaldo antes de continuar.</p>${btn("Exportar respaldo", "export", "", "full")}${window.NativeOSP ? btn("Seleccionar APK", "pickApk", "", "primary full") : "<p>Disponible en Android.</p>"}`,
    );
  } else if (a === "pickApk") NativeOSP.installUpdate();
  else if (a === "reminders") {
    form(
      "Recordatorios de pago",
      select(
        "enabled",
        "Avisos",
        [
          ["yes", "Activados"],
          ["no", "Desactivados"],
        ],
        state.settings.reminders ? "yes" : "no",
      ) +
        select(
          "days",
          "Anticipación",
          [
            ["0", "El día del vencimiento"],
            ["1", "Un día antes"],
            ["2", "Dos días antes"],
            ["3", "Tres días antes"],
            ["7", "Una semana antes"],
          ],
          String(state.settings.reminderDays),
        ),
      async (f) => {
        const ok = await commit("Recordatorios actualizados", (s) => {
          s.settings.reminders = f.enabled === "yes";
          s.settings.reminderDays = Number(f.days);
        });
        if (ok && state.settings.reminders && window.NativeOSP)
          NativeOSP.requestNotifications();
      },
    );
  } else if (a === "history")
    modal(
      "Cambios recientes",
      `<p class="note">Se conservan los últimos 15 cambios, incluso al cerrar la app. Deshacer revierte el último cambio completo.</p>${history.length ? btn("Deshacer: " + esc(history.at(-1).label), "undo", "", "primary full") : ""}${
        [...history]
          .reverse()
          .map(
            (h) =>
              `<div class="item"><strong>${esc(h.label)}</strong><p class="muted">${new Date(h.date).toLocaleString("es-MX")}</p></div>`,
          )
          .join("") ||
        empty("Sin cambios", "Tus próximas acciones aparecerán aquí.")
      }`,
    );
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el)
    Promise.resolve(action(el.dataset.action, el.dataset.id || "", el)).catch(
      (e) => showError(e.message),
    );
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form") return;
  e.preventDefault();
  const callback = formSubmit;
  if (!callback || busy) return;
  const button = e.target.querySelector("[type=submit]");
  button.disabled = true;
  try {
    await callback(Object.fromEntries(new FormData(e.target)));
  } catch (err) {
    showError(err.message);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    const pos = e.target.selectionStart;
    filter.q = e.target.value;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  } else if (e.target.dataset.money) {
    const el = e.target,
      raw = el.value.replace(/[^\d.]/g, ""),
      parts = raw.split(".");
    if (parts.length > 2) parts.splice(2);
    const whole = parts[0]
      .replace(/^0+(?=\d)/, "")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    el.value = whole + (parts.length > 1 ? "." + parts[1].slice(0, 2) : "");
  }
});
document.addEventListener("change", (e) => {
  if (e.target.closest("#filters")) {
    filter[e.target.name] = e.target.value;
    render();
  }
});
$("#importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (f) {
    if (f.size > 20 * 1024 * 1024) toast("El respaldo supera 20 MB.");
    else await importRaw(await f.text());
  }
  e.target.value = "";
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog && e.clientY < dialog.getBoundingClientRect().top)
    closeModal();
});
window.handleBack = () => {
  if (dialog.open) {
    closeModal();
    return true;
  }
  if (fullScreens.includes(tab)) {
    backPage();
    return true;
  }
  if (tab !== "home") {
    tab = "home";
    render();
    return true;
  }
  return false;
};
(async () => {
  try {
    await openStore();
    const saved = await readStore();
    state = saved ? C.validate(saved.state) : C.empty();
    history = saved?.history || [];
    rebuildDraft = saved?.draft || null;
    revision = saved?.revision || 0;
    C.ensureBudget(state);
    if (saved) {
      C.snapshot(state);
      await writeStore({ state, history, draft: rebuildDraft, revision });
    }
    render();
    syncReminders();
  } catch (e) {
    view.innerHTML = `<div class="card danger-zone"><h1>No se pudieron abrir los datos</h1><p>${esc(e.message)}</p><p>No se han reemplazado ni borrado. Cierra la app y vuelve a intentarlo.</p></div>`;
  }
})();
