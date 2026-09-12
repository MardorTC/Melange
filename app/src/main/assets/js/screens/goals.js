import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { icon, metric, money, esc, empty, btn, svg } from "../ui/components.js";

export function goalsPage() {
  const m = C.metrics(model.state);
  return `<div class="debt-page-heading"><div><div class="eyebrow">Dale un propósito</div><h1>Metas de ahorro</h1><p>Tu próximo objetivo, un paso más cerca.</p></div>${icon("plus", "Crear meta", "editGoal")}</div><div class="card hero"><small>Dinero reservado</small>${metric(m.reserved, "reserved")}<small>Disponible para otros usos: ${money(m.available)}</small></div><p class="note">Reservar dinero no crea un gasto ni una cuenta nueva. Las reservas forman parte de tu efectivo y débito.</p>${
    model.state.goals.length
      ? model.state.goals
          .map((g) => {
            const pct = g.target
              ? Math.min(100, (g.balance / g.target) * 100)
              : 0;
            return `<section class="card goal-card"><div class="row"><div class="wallet-title"><span class="visual-icon goal">${svg("goal")}</span><h2>${esc(g.name)}</h2></div><span class="pill ${pct >= 100 ? "good" : ""}">${Math.round(pct)}%</span></div><div class="goal-amount"><div class="metric">${money(g.balance)}</div><small>de ${money(g.target)}</small></div><div class="bar"><span style="width:${pct}%"></span></div><p class="goal-remaining">${pct >= 100 ? "Objetivo alcanzado" : "Faltan " + money(g.target - g.balance)}</p><div class="goal-footer"><small>${g.date ? "Objetivo: " + g.date : g.emergency ? "Tu colchón de tranquilidad" : "A tu ritmo"}</small><div class="actions">${btn("Reservar / liberar", "contribute", g.id, "primary")}${icon("edit", "Editar meta", "editGoal", g.id)}${icon("trash", "Eliminar meta y liberar reserva", "deleteGoal", g.id)}</div></div></section>`;
          })
          .join("")
      : empty(
          "¿Qué quieres hacer posible?",
          "Crea una meta para tu fondo de emergencia, un viaje o una compra.",
        )
  }`;
}
