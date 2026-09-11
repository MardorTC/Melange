import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";
import {
  btn,
  esc,
  money,
  form,
  input,
  amount,
  select,
  moneyValue,
  accountOptions,
  accountName,
  confirmAction,
} from "../ui/components.js";
export function accountsPage() {
  const m = C.metrics(model.state);
  return `<div class="row"><h1>Cuentas</h1>${btn("Agregar cuenta", "walletEdit")}</div><p class="note">Disponible libre: ${money(m.available)} · Vales: ${money(m.restricted)} · Congelado: ${money(m.frozen)} · Por recuperar: ${money(m.receivable)}</p>${
    m.unassigned
      ? `<section class="card"><h2>Reservas pendientes de asignar</h2><p>${money(m.unassigned)} ya se descuentan del disponible global.</p>${model.state.goals
          .filter((g) => g.allocations.some((r) => !r.accountId))
          .map((g) => btn(g.name, "contribute", g.id))
          .join("")}</section>`
      : ""
  }${C.accountSummary(model.state)
    .map(
      (a) =>
        `<section class="card"><div class="row"><h2>${esc(a.name)}</h2><span class="pill">${a.active === false ? "Archivada" : a.type === "restricted" ? "Uso restringido" : a.type === "bank" ? "Bancaria" : "Efectivo"}</span></div><div class="details">${[
          ["Saldo total", a.total],
          ["Reservas", a.reserved],
          ["Cajitas", a.frozen],
          ["Disponible", a.available],
        ]
          .map(
            ([k, v]) =>
              `<div><small>${k}</small><strong>${money(v)}</strong></div>`,
          )
          .join(
            "",
          )}</div><div class="toolbar wrap">${btn("Editar", "walletEdit", a.id)}${a.active !== false ? btn("Ajustar saldo", "walletAdjust", a.id) + (a.type !== "restricted" ? btn("Crear cajita", "boxCreate", a.id) : "") + btn("Archivar", "walletArchive", a.id) : ""}</div>${model.state.goals
          .filter((g) => g.allocations.some((r) => r.accountId === a.id))
          .map((g) => btn("Reserva: " + g.name, "contribute", g.id))
          .join("")}${model.state.boxes
          .filter((b) => b.accountId === a.id)
          .map(
            (b) =>
              `<div class="item"><strong>${esc(b.name)}</strong><p>${money(b.amount)} congelados · Disponibilidad prevista: ${b.availableDate}</p>${b.goalId ? `<p class="note">Meta: ${esc(model.state.goals.find((g) => g.id === b.goalId)?.name)}. La reserva permanece al descongelar.</p>` : ""}${b.amount ? btn("Confirmar liberación", "boxRelease", b.id) : '<span class="pill good">Liberada</span>'}${!b.goalId && b.amount ? btn("Vincular a meta", "boxLink", b.id) : ""}${a.active !== false ? btn("Registrar rendimiento recibido", "boxReturn", b.id) : ""}</div>`,
          )
          .join("")}</section>`,
    )
    .join("")}`;
}
export function accountAction(action, id) {
  if (!action.startsWith("wallet") && !action.startsWith("box")) return false;
  const a = model.state.walletAccounts.find((a) => a.id === id),
    b = model.state.boxes.find((b) => b.id === id);
  if (action === "walletEdit")
    form(
      a ? "Editar cuenta" : "Nueva cuenta",
      input(
        "name",
        "Nombre",
        a?.name || "",
        "text",
        'required maxlength="80"',
      ) +
        select(
          "type",
          "Tipo",
          [
            ["cash", "Efectivo"],
            ["bank", "Bancaria"],
            ["restricted", "Uso restringido / vales"],
          ],
          a?.type || "bank",
        ) +
        model.state.categories
          .map(
            (c) =>
              `<label><input type="checkbox" name="cat_${esc(c.id)}" ${a?.allowedCategories.includes(c.id) ? "checked" : ""}> ${esc(c.name)} (permitida en vales)</label>`,
          )
          .join("") +
        '<p class="note">Las cuentas nuevas empiezan en cero. Distribuye dinero con transferencias o registra el saldo mediante un ajuste. El tipo queda protegido al tener antecedentes.</p>',
      async (f) =>
        commit("Cuenta guardada", (s) => {
          const old = s.walletAccounts.find((x) => x.id === id);
          const value = {
            name: f.name.trim(),
            type: f.type,
            allowedCategories: s.categories
              .filter((c) => f["cat_" + c.id])
              .map((c) => c.id),
          };
          if (old) {
            if (
              old.type !== value.type &&
              (old.opening ||
                s.transactions.some(
                  (t) => t.accountId === id || t.toAccountId === id,
                ) ||
                s.boxes.some((b) => b.accountId === id) ||
                s.goals.some((g) =>
                  g.allocations.some((r) => r.accountId === id),
                ))
            )
              throw Error(
                "La cuenta tiene antecedentes; crea otra para usar un tipo distinto.",
              );
            Object.assign(old, value, { active: true });
          } else
            s.walletAccounts.push({
              ...value,
              id: C.id(),
              opening: 0,
              active: true,
            });
        }),
    );
  else if (action === "walletArchive")
    confirmAction(
      "Archivar cuenta",
      "Se conservarán sus movimientos. Primero deja su saldo, reservas y cajitas en cero.",
      "Cuenta archivada",
      (s) => {
        const x = C.accountSummary(s).find((a) => a.id === id);
        if (x.total || x.reserved || x.frozen)
          throw Error(
            "Transfiere o corrige el saldo y libera sus reservas antes de archivar.",
          );
        s.walletAccounts.find((a) => a.id === id).active = false;
      },
    );
  else if (action === "walletAdjust")
    form(
      "Corregir saldo: " + a.name,
      amount("amount", "Saldo real", C.balances(model.state)[id]) +
        '<p class="note">La diferencia se registrará como ajuste. No es ingreso ni gasto.</p>',
      async (f) =>
        commit("Saldo corregido", (s) => {
          const diff = moneyValue(f.amount) - C.balances(s)[id];
          if (diff)
            C.record(s, {
              kind: "adjustment",
              name: "Corrección de saldo",
              accountId: id,
              amount: Math.abs(diff),
              direction: Math.sign(diff),
              date: C.today(),
            });
        }),
    );
  else if (action === "boxCreate")
    form(
      "Crear cajita",
      input("name", "Nombre", "", "text", 'required maxlength="100"') +
        amount("amount", "Importe a congelar") +
        input(
          "createdDate",
          "Fecha de congelación",
          C.today(),
          "date",
          `required max="${C.today()}"`,
        ) +
        input(
          "availableDate",
          "Disponibilidad prevista",
          C.today(),
          "date",
          "required",
        ) +
        select(
          "goalId",
          "Vincular a meta",
          [["", "Sin meta"], ...model.state.goals.map((g) => [g.id, g.name])],
          "",
        ),
      async (f) =>
        commit("Dinero congelado", (s) =>
          C.freeze(s, {
            name: f.name.trim(),
            amount: moneyValue(f.amount),
            accountId: id,
            createdDate: f.createdDate,
            availableDate: f.availableDate,
            goalId: f.goalId || null,
          }),
        ),
    );
  else if (action === "boxRelease")
    form(
      "Confirmar dinero disponible",
      `<p>Confirma que ya puedes utilizar el dinero de ${esc(b.name)}. La fecha prevista no lo libera automáticamente.</p>` +
        amount("amount", "Importe realmente liberado", b.amount),
      async (f) =>
        commit("Cajita liberada", (s) =>
          C.releaseBox(s, id, moneyValue(f.amount)),
        ),
    );
  else if (action === "boxLink")
    form(
      "Vincular cajita a meta",
      select(
        "goalId",
        "Meta",
        model.state.goals.map((g) => [g.id, g.name]),
        "",
      ),
      async (f) =>
        commit("Cajita vinculada", (s) => C.linkBox(s, id, f.goalId)),
    );
  else if (action === "boxReturn")
    form(
      "Rendimiento recibido",
      amount("amount", "Importe recibido") +
        input(
          "date",
          "Fecha real",
          C.today(),
          "date",
          `required max="${C.today()}"`,
        ),
      async (f) =>
        commit("Rendimiento registrado", (s) =>
          C.record(s, {
            kind: "income",
            name: "Rendimiento: " + b.name,
            accountId: b.accountId,
            amount: moneyValue(f.amount),
            date: f.date,
          }),
        ),
    );
  return true;
}
