import C from "../domain/finance.js";
import { model } from "../state/model.js";
import {
  icon,
  metric,
  money,
  esc,
  empty,
  btn,
  svg,
  screenHead,
  sectionHead,
  dlabel,
} from "../ui/components.js";

export function goalsPage() {
  const m = C.metrics(model.state);
  return (
    screenHead("Metas", "Lo que estás construyendo.", {
      action: "editGoal",
      actionLabel: "Crear meta",
    }) +
    `<section class="card hero goal-summary"><div><small>Dinero reservado</small><div class="metric">${money(m.reserved)}</div><p class="note">Disponible para otros usos: ${money(m.available)}</p></div><span class="visual-icon goal">${svg("goal")}</span></section>` +
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
            return `<section class="card goal-card-new"><div class="goal-top"><div class="goal-ring" style="--p:${pct}"><span>${Math.round(pct)}%</span></div><div class="goal-copy"><h2>${esc(g.name)}</h2><small>${g.date ? "Objetivo " + dlabel(g.date) : "A tu ritmo"}</small></div>${icon("edit", "Editar meta", "editGoal", g.id)}</div><div class="goal-figures"><strong>${money(g.balance)}</strong><span>de ${money(g.target)}</span></div><p class="goal-remaining">${pct >= 100 ? "Objetivo alcanzado" : "Faltan " + money(g.target - g.balance)}</p><div class="bar"><span style="--p:${pct}%"></span></div><div class="goal-actions">${btn("Reservar / liberar", "contribute", g.id, "primary")}${icon("trash", "Eliminar meta y liberar reserva", "deleteGoal", g.id)}</div></section>`;
          })
          .join("")
      : `<section class="card">${empty("¿Qué quieres hacer posible?", "Crea una meta para tu fondo de emergencia, un viaje o una compra.")}</section>`) +
    `<details class="fine-print"><summary>Cómo funciona</summary><p>Las reservas forman parte de tu efectivo y débito, pero no están disponibles para gastar. Puedes liberarlas cuando quieras.</p></details>`
  );
}
