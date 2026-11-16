import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { moneyHeader } from "../ui/scene.js";
import {
  icon,
  metric,
  money,
  esc,
  empty,
  btn,
  svg,
  sectionHead,
  dlabel,
} from "../ui/components.js";

export function goalsPage() {
  const m = C.metrics(model.state);
  return (
    moneyHeader(model.state, m, "goal") +
    `<section class="goal-summary"><div><small>Dinero reservado</small><strong class="serif-figure">${money(m.reserved)}</strong><p class="note">Disponible para otros usos: ${money(m.available)}</p></div></section>` +
    sectionHead(
      "Tus objetivos",
      "",
      "Reservar dinero no crea un gasto ni una cuenta nueva.",
    ) +
    (model.state.goals.length
      ? model.state.goals
          .map((g) => {
            const pct = g.target
              ? Math.min(100, (g.balance / g.target) * 100)
              : 0;
            return `<section class="card goal-card-new"><div class="goal-top">${goalDrop(pct, g.id)}<div class="goal-copy"><h2>${esc(g.name)}</h2><small>${g.date ? "Objetivo " + dlabel(g.date) : "A tu ritmo"}</small></div>${icon("edit", "Editar meta", "editGoal", g.id)}</div><div class="goal-figures"><strong>${money(g.balance)}</strong><span>de ${money(g.target)}</span></div><p class="goal-remaining">${pct >= 100 ? "Objetivo alcanzado" : "Faltan " + money(g.target - g.balance)}</p><div class="bar"><span style="--p:${pct}%"></span></div><div class="goal-actions">${btn("Reservar / liberar", "contribute", g.id, "primary")}${icon("trash", "Eliminar meta y liberar reserva", "deleteGoal", g.id)}</div></section>`;
          })
          .join("")
      : `<section class="card">${empty("¿Qué quieres hacer posible?", "Crea una meta para tu fondo de emergencia, un viaje o una compra.")}<div class="actions">${btn("Crear mi primera meta", "editGoal", "", "primary")}</div></section>`) +
    `<details class="fine-print"><summary>Cómo funciona</summary><p>Las reservas forman parte de tu efectivo y débito, pero no están disponibles para gastar. Puedes liberarlas cuando quieras.</p></details>`
  );
}

// Cada meta es una gota que se llena con lo reservado.
function goalDrop(pct, id) {
  const level = 58 - (Math.max(0, Math.min(100, pct)) / 100) * 54,
    clip = "drop-" + String(id).replace(/[^a-z0-9_-]/gi, "");
  return `<span class="goal-drop" role="img" aria-label="${Math.round(pct)}% reservado"><svg viewBox="0 0 48 60" aria-hidden="true"><defs><clipPath id="${clip}"><path d="M24 2s20 21 20 36a20 20 0 0 1-40 0C4 23 24 2 24 2z"></path></clipPath></defs><path d="M24 2s20 21 20 36a20 20 0 0 1-40 0C4 23 24 2 24 2z" class="drop-shell"></path><path d="M0 ${level} Q 12 ${level - 4} 24 ${level} T 48 ${level} V60 H0Z" class="drop-water" clip-path="url(#${clip})"></path></svg><span>${Math.round(pct)}%</span></span>`;
}
