import { model } from "../state/model.js";
import {
  closeModal,
  icon,
  mlabel,
  $,
  svg,
  view,
  btn,
  money,
} from "./components.js";
import C from "../domain/finance.js";
import { homePage } from "../screens/home.js";
import { expensesPage } from "../screens/expenses.js";
import { debtsPage } from "../screens/debts.js";
import {
  calendarPage,
  projectionPage,
  timelinePage,
} from "../screens/calendar.js";
import { goalsPage } from "../screens/goals.js";
import { settingsPage } from "../screens/settings.js";
import {
  reconstructionSettings,
  rebuildPage,
} from "../screens/reconstruction.js";

export const fullScreens = ["timeline", "projection", "rebuild"];

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

export function periodChooser() {
  return `<div class="toolbar">${icon("back", "Mes anterior", "prev")}<strong style="flex:1;text-align:center">${mlabel(model.period)}</strong>${icon("back", "Mes siguiente", "next", "", 'style="transform:rotate(180deg)"')}</div>`;
}

export function render() {
  document.body.classList.toggle(
    "full-screen",
    fullScreens.includes(model.tab),
  );
  document.body.classList.toggle("expenses-screen", model.tab === "expense");
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
        `<button data-action="tab" data-id="${k}" class="${model.tab === k ? "active" : ""}" ${model.tab === k ? 'aria-current="page"' : ""}>${svg(k)}${t}</button>`,
    )
    .join("");
  if (
    !model.state.started &&
    !model.state.migration &&
    model.tab !== "rebuild"
  ) {
    view.innerHTML = `<div class="page onboard"><img class="onboard-art" src="logo.png" alt=""><div class="eyebrow">Un nuevo comienzo</div><h1>Haz espacio para<br>lo que quieres.</h1><p>Tus cuentas, tus metas y un poco<br>más de claridad. Todo en tu teléfono.</p><div class="card">${btn("Importar respaldo de Melange / ProjectOSP", "import", "", "primary full")}${btn("Empezar desde cero", "start", "", "full")}${btn("Reconstruir meses anteriores", "rebuildStart", "", "full")}<p class="note">Tu información permanece en este dispositivo.<br>No necesitas crear una cuenta.</p></div></div>`;
    return;
  }
  const pages = {
    home: homePage,
    expense: expensesPage,
    debt: debtsPage,
    calendar: calendarPage,
    goal: goalsPage,
    settings: () =>
      settingsPage().replace("</h1>", "</h1>" + reconstructionSettings()),
    projection: projectionPage,
    timeline: timelinePage,
    rebuild: rebuildPage,
  };
  view.innerHTML = `<div class="page">${(pages[model.tab] || homePage)()}</div>`;
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
