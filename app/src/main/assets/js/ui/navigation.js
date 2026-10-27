import { accountsPage } from "../screens/accounts.js";
import { model } from "../state/model.js";
import { closeModal, $, svg, view, money } from "./components.js";
import C from "../domain/finance.js";
import { homePage } from "../screens/home.js";
import { expensesPage } from "../screens/expenses.js";
import { debtsPage } from "../screens/debts.js";
import { calendarPage, projectionPage } from "../screens/calendar.js";
import { timelinePage } from "../screens/timeline.js";
import { goalsPage } from "../screens/goals.js";
import { settingsPage } from "../screens/settings.js";

export const fullScreens = ["timeline", "projection", "settings"];

const screenTitles = {
  home: "Melange",
  accounts: "Cuentas",
  expense: "Movimientos",
  debt: "Deudas",
  calendar: "Calendario",
  goal: "Metas",
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
    ? `${fullScreens.includes(model.tab) ? `<button class="icon back-btn" data-action="screenBack" aria-label="Atrás">${svg("back")}</button>` : ""}<span class="topbar-title">${screenTitles[model.tab] || "Melange"}</span>${model.tab === "home" ? `<button class="icon topbar-action" data-action="settings" aria-label="Abrir ajustes">${svg("settings")}</button>` : ""}`
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

export function backPage() {
  const route = model.routes.pop() || {
    tab: "calendar",
    period: C.month(),
    y: 0,
  };
  model.tab = route.tab;
  model.period = route.period;
  closeModal();
  render();
  window.scrollTo(0, route.y);
}

export function render() {
  const previous = document.body.dataset.screen;
  document.body.classList.toggle(
    "full-screen",
    fullScreens.includes(model.tab),
  );
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
  $("#nav").innerHTML = onboarding
    ? ""
    : [
        ["home", "Inicio"],
        ["expense", "Movimientos"],
        ["debt", "Deudas"],
        ["calendar", "Calendario"],
        ["goal", "Metas"],
      ]
        .map(
          ([k, t]) =>
            `<button data-action="tab" data-id="${k}" class="${model.tab === k ? "active" : ""}" ${model.tab === k ? 'aria-current="page"' : ""}><span class="nav-icon">${svg(k)}</span><span>${t}</span></button>`,
        )
        .join("");
  if (onboarding) {
    view.innerHTML = `<div class="page onboard"><div class="onboard-brand"><img src="logo.png" alt=""><span>Melange</span></div><div class="onboard-main"><div class="onboard-art"><img src="logo.png" alt=""></div><div class="onboard-copy"><div class="eyebrow">Finanzas personales</div><h1>Haz espacio para lo que quieres.</h1><p>Tus cuentas, tus metas y un poco más de claridad. Sin cuentas en línea ni ruido.</p></div></div><div class="onboard-actions"><button class="btn primary full" data-action="start">Empezar desde cero</button><button class="btn full" data-action="import">${svg("download")} Importar respaldo</button><p class="note">Tu información permanece en este dispositivo.</p></div></div>`;
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
