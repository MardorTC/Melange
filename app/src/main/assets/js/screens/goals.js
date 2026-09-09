import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { icon, metric, money, esc, empty } from "../ui/components.js";

export function goalsPage() {
  const m = C.metrics(model.state);
  return `<div class="row"><div><div class="eyebrow">Dale un propósito</div><h1>Metas de ahorro</h1></div>${icon("plus", "Crear meta", "editGoal")}</div><div class="card hero"><small>Dinero reservado</small>${metric(m.reserved, "reserved")}<small>Disponible para otros usos: ${money(m.available)}</small></div><p class="note">Reservar dinero no crea un gasto ni una cuenta nueva. Las reservas forman parte de tu efectivo y débito.</p>${
    model.state.goals.length
      ? model.state.goals
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
