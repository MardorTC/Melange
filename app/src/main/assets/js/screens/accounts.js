import { creditCardsSection } from "./credit.js";
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
  confirmAction,
  metric,
  svg,
  screenHead,
  sectionHead,
  modal,
  empty,
  dlabel,
} from "../ui/components.js";

const accountType = (a) =>
  a.type === "restricted"
    ? "Uso restringido"
    : a.type === "bank"
      ? "Cuenta bancaria"
      : "Cuenta de efectivo";

export function accountsPage() {
  const m = C.metrics(model.state);
  const selected = model.accountSub || "wallet";
  const tabs = `<div class="segmented" role="tablist" aria-label="Tipo de cuenta"><button class="${selected === "wallet" ? "active" : ""}" role="tab" aria-selected="${selected === "wallet"}" data-action="accountSub" data-id="wallet">Efectivo y débito</button><button class="${selected === "credit" ? "active" : ""}" role="tab" aria-selected="${selected === "credit"}" data-action="accountSub" data-id="credit">Crédito</button></div>`;
  if (selected === "credit") {
    const cards = model.state.creditCards.filter((c) => c.active !== false),
      used = cards.reduce(
        (n, c) => n + C.creditSummary(model.state, c.id).used,
        0,
      ),
      limit = cards.reduce((n, c) => n + c.limit, 0);
    return (
      screenHead("Cuentas", "Tu crédito, separado de tu dinero.", {
        action: "creditEdit",
        actionLabel: "Agregar tarjeta",
      }) +
      tabs +
      `<section class="card credit-hero-compact"><div><small>Disponible</small><strong class="${limit - used < 0 ? "bad" : ""}" data-metric="creditAvailable" data-value="${limit - used}">${money(limit - used)}</strong></div><div><small>Usado</small><strong>${money(used)}</strong></div><div><small>Límite</small><strong>${money(limit)}</strong></div></section>` +
      creditCardsSection()
    );
  }
  const accounts = C.accountSummary(model.state),
    active = accounts.filter((a) => a.active !== false),
    archived = accounts.filter((a) => a.active === false);
  return (
    screenHead("Cuentas", "Cada saldo en su lugar.", {
      action: "walletEdit",
      actionLabel: "Agregar cuenta",
    }) +
    tabs +
    `<section class="card hero"><small>Disponible libre</small>${metric(m.available, "walletFree")}<div class="hero-bottom"><div><small>Vales / despensa</small><strong>${money(m.restricted)}</strong></div><div><small>Congelado</small><strong>${money(m.frozen)}</strong></div></div></section>` +
    (m.unassigned
      ? `<section class="card"><h2>Reservas por asignar</h2><p class="note">${money(m.unassigned)} ya se descuentan del disponible global.</p>${model.state.goals
          .filter((g) => g.allocations.some((r) => !r.accountId))
          .map((g) => btn(g.name, "contribute", g.id))
          .join("")}</section>`
      : "") +
    sectionHead(
      "Tus cuentas",
      "",
      "Toca una cuenta para ver reservas y cajitas.",
    ) +
    `<section class="card account-list">${active.map(accountRow).join("") || empty("Sin cuentas", "Agrega una cuenta para separar tu dinero.")}</section>` +
    (archived.length
      ? `<details class="card settled-list"><summary>Cuentas archivadas (${archived.length})</summary>${archived.map(accountRow).join("")}</details>`
      : "")
  );
}

function accountRow(a) {
  const iconName =
    a.type === "cash" ? "cash" : a.type === "restricted" ? "ticket" : "bank";
  return `<button class="account-row" data-action="walletDetails" data-id="${esc(a.id)}"><span class="row-icon ${a.type === "cash" ? "green" : a.type === "restricted" ? "gray" : "gray"}">${svg(iconName)}</span><span class="account-copy"><strong>${esc(a.name)}</strong><small>${accountType(a)}${a.reserved ? ` · ${money(a.reserved)} reservado` : ""}${a.frozen ? ` · ${money(a.frozen)} congelado` : ""}</small></span><span class="account-amount">${money(a.total)}</span><span class="account-chevron">${svg("chevron")}</span></button>`;
}

function walletDetails(id) {
  const a = C.accountSummary(model.state).find((x) => x.id === id);
  if (!a) return;
  const goals = model.state.goals.filter((g) =>
      g.allocations.some((r) => r.accountId === id),
    ),
    boxes = model.state.boxes.filter((b) => b.accountId === id);
  modal(
    a.name,
    `<div class="details"><div><small>Saldo total</small><strong>${money(a.total)}</strong></div><div><small>Disponible</small><strong>${money(a.available)}</strong></div><div><small>Reservas</small><strong>${money(a.reserved)}</strong></div><div><small>Cajitas</small><strong>${money(a.frozen)}</strong></div></div>${
      a.active === false
        ? `<p class="note">Esta cuenta está archivada y conserva sus movimientos.</p><div class="toolbar wrap">${btn("Reactivar cuenta", "walletReactivate", a.id, "primary")}</div>`
        : `<div class="toolbar wrap">${btn("Ajustar saldo", "walletAdjust", a.id, "primary")}${a.type !== "restricted" ? btn("Crear cajita", "boxCreate", a.id) : ""}${btn("Editar", "walletEdit", a.id)}${btn("Archivar", "walletArchive", a.id, "danger")}</div>`
    }${
      goals.length
        ? `<h3>Reservas</h3><section class="list">${goals.map((g) => `<button class="list-row" data-action="contribute" data-id="${g.id}"><span class="row-icon green">${svg("goal")}</span><span class="row-copy"><strong>${esc(g.name)}</strong><small>${money(g.balance)} de ${money(g.target)}</small></span><span class="row-chevron">${svg("chevron")}</span></button>`).join("")}</section>`
        : ""
    }${
      boxes.length
        ? `<h3>Cajitas</h3><section class="list">${boxes
            .map(
              (b) =>
                `<div class="item"><div class="row"><strong>${esc(b.name)}</strong><span class="amount">${money(b.amount)}</span></div><p class="muted">Congelado hasta ${dlabel(b.availableDate)}${b.goalId ? ` · Meta: ${esc(model.state.goals.find((g) => g.id === b.goalId)?.name || "")}` : ""}</p><div class="actions">${b.amount ? btn("Confirmar liberación", "boxRelease", b.id) : '<span class="pill good">Liberada</span>'}${!b.goalId && b.amount ? btn("Vincular a meta", "boxLink", b.id) : ""}${a.active !== false ? btn("Rendimiento recibido", "boxReturn", b.id) : ""}</div></div>`,
            )
            .join("")}</section>`
        : ""
    }<p class="note">Las reservas y cajitas forman parte de tu efectivo y débito, pero no están disponibles para gastar.</p>`,
  );
}
export function accountAction(action, id) {
  if (!action.startsWith("wallet") && !action.startsWith("box")) return false;
  const a = model.state.walletAccounts.find((a) => a.id === id),
    b = model.state.boxes.find((b) => b.id === id);
  if (action === "walletDetails") walletDetails(id);
  else if (action === "walletReactivate")
    confirmAction(
      "Reactivar cuenta",
      "Volverá a aparecer para registrar movimientos y recibir reservas.",
      "Cuenta reactivada",
      (s) => {
        const account = s.walletAccounts.find((x) => x.id === id);
        if (!account) throw Error("Cuenta no encontrada.");
        account.active = true;
      },
    );
  else if (action === "walletEdit")
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
        `<div id="wallet-restrictions" ${a?.type === "restricted" ? "" : "hidden"}><p class="note">Los vales se destinan a despensa. Puedes recibir aquí el saldo que antes tenías agrupado en otra cuenta.</p><details><summary>Personalizar categorías (opcional)</summary>${model.state.categories.map((c) => `<label><input type="checkbox" name="cat_${esc(c.id)}" ${(a ? a.allowedCategories.includes(c.id) : /alimenta|despensa|supermerc/i.test(c.name)) ? "checked" : ""}>${esc(c.name)}</label>`).join("")}</details></div>` +
        '<p class="note">Las cuentas nuevas empiezan en cero. Distribuye dinero con transferencias o registra el saldo mediante un ajuste. El tipo queda protegido al tener antecedentes.</p>',
      async (f) =>
        commit("Cuenta guardada", (s) => {
          const old = s.walletAccounts.find((x) => x.id === id);
          const value = {
            name: f.name.trim(),
            type: f.type,
            allowedCategories:
              f.type === "restricted"
                ? s.categories.filter((c) => f["cat_" + c.id]).map((c) => c.id)
                : [],
          };
          if (value.type === "restricted" && !value.allowedCategories.length) {
            let category = s.categories.find((c) =>
              /alimenta|despensa|supermerc/i.test(c.name),
            );
            if (!category) {
              category = { id: C.id(), name: "Despensa" };
              s.categories.push(category);
            }
            value.allowedCategories = [category.id];
          }
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
