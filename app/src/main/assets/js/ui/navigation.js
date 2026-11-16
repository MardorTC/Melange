import { accountsPage } from "../screens/accounts.js";
import { model } from "../state/model.js";
import {
  closeModal,
  $,
  svg,
  view,
  money,
  esc,
  screenHead,
} from "./components.js";
import C from "../domain/finance.js";
import { homePage } from "../screens/home.js";
import { expensesPage } from "../screens/expenses.js";
import { debtsPage } from "../screens/debts.js";
import { calendarPage, projectionPage } from "../screens/calendar.js";
import { timelinePage } from "../screens/timeline.js";
import { goalsPage } from "../screens/goals.js";
import { settingsPage } from "../screens/settings.js";
import { welcomeScene } from "./scene.js";

export const fullScreens = ["timeline", "projection", "settings", "detail"];

// Calendario vive dentro de Actividad y Metas dentro de Dinero.
export const navGroup = (tab) =>
  tab === "calendar"
    ? "expense"
    : tab === "goal"
      ? "accounts"
      : tab === "detail"
        ? {
            account: "accounts",
            card: "accounts",
            debt: "debt",
            fixed: "expense",
          }[model.detail?.kind] || "home"
        : tab;

const screenTitles = {
  home: "Melange",
  accounts: "Dinero",
  expense: "Actividad",
  debt: "Deudas",
  calendar: "Actividad",
  goal: "Dinero",
  settings: "Ajustes",
  projection: "Proyección",
  timeline: "Ruta de deudas",
};

let topbarKey = "";

export function syncTopbar() {
  const bar = $("#topbar");
  if (!bar || !model.state) return;
  const onboarding =
    !model.state.started &&
    !model.state.migration &&
    !fullScreens.includes(model.tab);
  const visible = !onboarding && window.scrollY > 54;
  bar.classList.toggle("visible", visible);
  bar.setAttribute("aria-hidden", visible ? "false" : "true");
  const key = visible
    ? `${model.tab}:${fullScreens.includes(model.tab) ? "back" : "tab"}`
    : "";
  if (key === topbarKey) return;
  topbarKey = key;
  bar.innerHTML = visible
    ? `${fullScreens.includes(model.tab) ? `<button class="icon back-btn" data-action="screenBack" aria-label="Atrás">${svg("back")}</button>` : ""}<span class="topbar-title">${model.tab === "detail" ? esc(model.detailTitle || "") : screenTitles[model.tab] || "Melange"}</span>${model.tab === "home" ? `<button class="icon topbar-action" data-action="settings" aria-label="Abrir ajustes">${svg("settings")}</button>` : ""}`
    : "";
}

window.addEventListener("scroll", syncTopbar, { passive: true });

export function openPage(name) {
  if (model.tab !== name)
    model.routes.push({
      tab: model.tab,
      period: model.period,
      y: window.scrollY,
    });
  model.tab = name;
  closeModal();
  render();
  window.scrollTo(0, 0);
}

// Abre la pantalla de detalle de una cuenta, tarjeta, deuda o gasto fijo.
// Las acciones del detalle abren hojas encima; al guardar se vuelve a él.
export function openDetail(kind, id) {
  const same =
    model.tab === "detail" &&
    model.detail?.kind === kind &&
    model.detail?.id === id;
  if (!same)
    model.routes.push({
      tab: model.tab,
      period: model.period,
      y: window.scrollY,
      detail: model.detail,
    });
  model.detail = { kind, id };
  model.tab = "detail";
  closeModal();
  render();
  if (!same) window.scrollTo(0, 0);
}

function detailPage() {
  const { kind, id } = model.detail || {};
  const view = model.detailViews[kind]?.(id);
  if (!view)
    return `${screenHead("Ya no está disponible", "", { back: true })}<p class="note">Este elemento se eliminó o ya no existe.</p>`;
  model.detailTitle = view.title;
  return `${screenHead(esc(view.title), view.subtitle || "", { back: true })}<div class="detail-body">${view.html}</div>`;
}

export function backPage() {
  const route = model.routes.pop() || {
    tab: "home",
    period: C.month(),
    y: 0,
  };
  model.tab = route.tab;
  model.period = route.period;
  model.detail = route.detail || null;
  closeModal();
  render();
  window.scrollTo(0, route.y);
}

export function render() {
  const previous = document.body.dataset.screen;
  // Los detalles conservan la barra inferior; las demás pantallas completas no.
  document.body.classList.toggle(
    "full-screen",
    fullScreens.includes(model.tab) && model.tab !== "detail",
  );
  document.body.classList.toggle("detail-screen", model.tab === "detail");
  const onboarding =
    !model.state.started &&
    !model.state.migration &&
    !fullScreens.includes(model.tab);
  document.body.classList.toggle("onboarding", onboarding);
  document.body.dataset.screen = model.tab;
  document.body.dataset.debtSub = model.debtSub || "";
  const old = {};
  document
    .querySelectorAll("[data-metric]")
    .forEach((e) => (old[e.dataset.metric] = Number(e.dataset.value)));
  const group = navGroup(model.tab);
  $("#nav").innerHTML = onboarding
    ? ""
    : [
        ["home", "Inicio", "home"],
        ["expense", "Actividad", "expense"],
        null,
        ["accounts", "Dinero", "wallet"],
        ["debt", "Deudas", "dunePath"],
      ]
        .map((item) =>
          item
            ? `<button data-action="tab" data-id="${item[0]}" class="${group === item[0] ? "active" : ""}" ${group === item[0] ? 'aria-current="page"' : ""}><span class="nav-icon">${svg(item[2])}</span><span>${item[1]}</span></button>`
            : `<button class="nav-register" data-action="register" aria-label="Registrar"><span class="nav-sun">${svg("plus")}</span></button>`,
        )
        .join("");
  if (onboarding) {
    view.innerHTML = `<div class="page onboard">${welcomeScene()}<div class="onboard-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 23c5 0 8-8 13-8s8 8 13 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path><circle cx="21" cy="9.5" r="4" class="wordmark-sun"></circle></svg><span>Melange</span></div><div class="onboard-main"><div class="onboard-copy"><div class="eyebrow">Finanzas personales</div><h1>Haz espacio para lo que quieres.</h1><p>Tus cuentas, deudas y metas, sin registro ni conexión con tu banco. Todo vive en este teléfono.</p></div></div><div class="onboard-actions"><button class="btn primary full" data-action="start">Empezar desde cero</button><button class="btn full" data-action="import">${svg("download")} Importar respaldo</button><p class="note">Los datos se guardan solo aquí. Si pierdes el teléfono o desinstalas, necesitarás un respaldo para recuperarlos.</p></div></div>`;
    syncTopbar();
    return;
  }
  const pages = {
    home: homePage,
    accounts: accountsPage,
    expense: expensesPage,
    debt: debtsPage,
    calendar: calendarPage,
    goal: goalsPage,
    settings: settingsPage,
    projection: projectionPage,
    timeline: timelinePage,
    detail: detailPage,
  };
  const animate = !previous || previous !== model.tab;
  view.innerHTML = `<div class="page${animate ? "" : " no-anim"}">${(pages[model.tab] || homePage)()}</div>`;
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
  syncTopbar();
}
