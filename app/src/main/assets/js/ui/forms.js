import { creditPayForm } from "../screens/credit.js";
import { recurrenceFields, recurrenceValue } from "./recurrence-fields.js";
import { debtForm } from "./debt-wizard.js";
import {
  accountCreateControl,
  afterSelect,
  applyContextualCreations,
  categoryCreateControl,
  contextualDraftOptions,
} from "./contextual-create.js";
import {
  modal,
  accountName,
  svg,
  btn,
  input,
  amount,
  select,
  accountOptions,
  spendingOptions,
  form,
  moneyValue,
  empty,
  toast,
  paymentFields,
  esc,
  money,
  confirmAction,
  kindName,
  mlabel,
  dlabel,
} from "./components.js";
import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";
import { paymentRow } from "../screens/home.js";

const nameKey = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\bmsi\b|meses sin intereses/g, "")
    .replace(/[^a-z0-9áéíóúüñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function newMovement() {
  modal(
    "Registrar movimiento",
    `<div class="quick"><button data-action="expense"><span class="icon">${svg("minus")}</span>Gasto</button><button data-action="income"><span class="icon">${svg("plus")}</span>Ingreso</button><button data-action="transfer"><span class="icon">${svg("transfer")}</span>Transferir</button></div>${btn("Pagar una deuda o gasto fijo", "choosePayment", "", "full")}`,
  );
}

export function transactionForm(kind = "expense", existing) {
  const t = existing || {
    kind,
    amount: 0,
    name: "",
    date: C.today(),
    accountId: "debit",
    categoryId: "",
  };
  if (existing?.kind === "fixed") {
    form(
      "Editar pago fijo",
      input("name", "Concepto", t.name, "text", 'required maxlength="120"') +
        afterSelect(
          paymentFields(
            t.amount,
            true,
            t.creditCardId ? "credit:" + t.creditCardId : t.accountId,
          ),
          "accountId",
          accountCreateControl("accountId"),
        ) +
        select(
          "categoryId",
          "Categoría",
          [
            ["", "Sin categoría"],
            ...model.state.categories.map((c) => [c.id, c.name]),
          ],
          t.categoryId || "",
        ) +
        categoryCreateControl("categoryId") +
        '<p class="note">La corrección conserva este vencimiento y sus vínculos. No se registra un segundo pago. Si aumentas el importe por encima del vencimiento, solo ese vencimiento se ajusta al nuevo cobro; las próximas cuotas no cambian.</p>',
      async (f) =>
        commit("Pago fijo corregido", (s) => {
          const value = applyContextualCreations(s, f);
          C.editFixedPayment(s, t.id, {
            name: value.name.trim(),
            amount: moneyValue(value.amount),
            date: value.date,
            accountId: value.accountId.startsWith("credit:")
              ? null
              : value.accountId,
            creditCardId: value.accountId.startsWith("credit:")
              ? value.accountId.slice(7)
              : null,
            categoryId: value.categoryId || "",
          });
        }),
      "Guardar",
      {
        draftKey: `fixed-payment:${t.id}`,
        ...contextualDraftOptions(),
      },
    );
    document.querySelector('[name="date"]').value = t.date;
    return;
  }
  if (
    existing &&
    [
      "debt",
      "fixed",
      "adjustment",
      "loan_in",
      "loan_out",
      "card_payment",
    ].includes(t.kind)
  ) {
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
      "accountId",
      kind === "income" ? "Recibir en" : "Pagar desde",
      kind === "expense" ? spendingOptions() : accountOptions(),
      t.creditCardId ? "credit:" + t.creditCardId : t.accountId,
    ) +
    accountCreateControl("accountId") +
    (kind === "expense"
      ? `<div id="credit-purchase-fields" ${t.creditCardId ? "" : "hidden"}><p class="note">La compra cuenta como gasto y usa crédito. Tu disponible libre solo cambia cuando pagas la tarjeta.</p>${input("cardDueDate", "Vencimiento del estado de cuenta (opcional)", t.cardDueDate || "", "date")}<p class="note">Si lo dejas vacío, se calcula usando corte y día de pago. Las compras del día de corte se incluyen en ese corte.</p><p class="note warning">Si esta compra es a MSI, regístrala como deuda vinculada a la tarjeta y no la dupliques aquí.</p></div>`
      : "") +
    (kind === "expense"
      ? select(
          "categoryId",
          "Categoría",
          [
            ["", "Sin categoría"],
            ...model.state.categories.map((c) => [c.id, c.name]),
          ],
          t.categoryId,
        ) + categoryCreateControl("categoryId")
      : "") +
    (kind === "transfer"
      ? select(
          "toAccountId",
          "Destino",
          accountOptions(),
          t.toAccountId || "cash",
        ) + accountCreateControl("toAccountId")
      : "") +
    (kind === "transfer"
      ? '<p class="note">Puedes distribuir saldo hacia vales sin crear ingresos ni gastos. Una cuenta de vales no puede transferir dinero a cuentas libres.</p>'
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
        accountId: f.accountId.startsWith("credit:") ? null : f.accountId,
        ...(f.accountId.startsWith("credit:")
          ? {
              creditCardId: f.accountId.slice(7),
              ...(f.cardDueDate ? { cardDueDate: f.cardDueDate } : {}),
            }
          : {}),
        categoryId: f.categoryId || "",
        ...(kind === "transfer" ? { toAccountId: f.toAccountId } : {}),
      };
      if (kind === "transfer" && f.toAccountId === f.accountId)
        throw Error("El origen y destino deben ser diferentes.");
      if (kind === "expense" && value.creditCardId) {
        const duplicate = model.state.debts.find(
          (d) =>
            d.creditCardId === value.creditCardId &&
            d.originalAmount === value.amount &&
            d.balance > 0 &&
            !d.archived &&
            d.startDate &&
            nameKey(d.name) === nameKey(value.name) &&
            C.month(d.startDate) === C.month(value.date),
        );
        if (duplicate)
          throw Error(
            `Ya registraste el MSI "${duplicate.name}" por ese importe. No registres también la compra normal: duplicaría la deuda.`,
          );
      }
      await commit(
        existing ? "Movimiento actualizado" : "Movimiento registrado",
        (s) => {
          const resolved = applyContextualCreations(s, value);
          if (existing) {
            C.editTransaction(s, existing.id, resolved);
          } else C.record(s, resolved);
        },
      );
    },
    "Guardar",
    {
      draftKey: `transaction:${kind}:${existing?.id || "new"}`,
      ...contextualDraftOptions(),
    },
  );
}

export function choosePayment() {
  const items = C.obligations(model.state).filter((i) => !i.paid);
  modal(
    "Elegir compromiso",
    `<p class="note">Pagos pendientes de este mes. Para otros meses, abre Calendario.</p>${items.map(paymentRow).join("") || empty("Al día", "No hay pagos pendientes.")}`,
  );
}

export function payForm(key, m) {
  const linked = model.state.debts.find(
    (d) => d.creditCardId && key.startsWith(`debt:${d.id}:`),
  );
  if (linked) return creditPayForm(linked.creditCardId, m);
  const item =
    C.obligations(model.state, m).find((i) => i.key === key) ||
    C.planned(model.state, m).find((i) => i.key === key);
  if (!item || item.paid || C.isPaid(model.state, item)) {
    toast("Este compromiso ya está pagado o no está disponible.");
    return;
  }
  if (item.kind === "card_payment") return creditPayForm(item.ref, m);
  const d =
    item.kind === "debt"
      ? model.state.debts.find((d) => d.id === item.ref)
      : null;
  form(
    "Pagar " + item.name,
    `<p class="note">${item.n ? "Cuota " + item.n + " · " : ""}Vencimiento: ${dlabel(item.date)}. Con dinero propio se descontará del origen; a crédito se agregará al pago de la tarjeta. Puedes abonar una parte; el resto seguirá pendiente.</p>` +
      afterSelect(
        paymentFields(
          d?.balanceMode === "total"
            ? Math.min(d.balance, item.remaining ?? item.amount)
            : (item.remaining ?? item.amount),
          item.kind === "fixed",
          item.creditCardId ? "credit:" + item.creditCardId : "debit",
        ),
        "accountId",
        accountCreateControl("accountId"),
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
              ...model.state.categories.map((c) => [c.id, c.name]),
            ],
            item.categoryId || "",
          ) + categoryCreateControl("categoryId")
        : "") +
      '<p class="note">Necesitas saldo disponible o crédito suficiente, según el origen elegido.</p>',
    async (f) => {
      if (f.date > C.today())
        throw Error("La fecha real de pago no puede ser futura.");
      await commit("Pago registrado", (s) => {
        const value = applyContextualCreations(s, f);
        C.ensureBudget(s, m);
        C.pay(s, key, {
          period: m,
          amount: moneyValue(value.amount),
          accountId: value.accountId.startsWith("credit:")
            ? null
            : value.accountId,
          creditCardId: value.accountId.startsWith("credit:")
            ? value.accountId.slice(7)
            : undefined,
          date: value.date,
          categoryId: value.categoryId,
          principal: value.principal ? moneyValue(value.principal) : undefined,
        });
      });
    },
    "Registrar pago",
    {
      draftKey: `pay:${key}`,
      ...contextualDraftOptions(),
    },
  );
}

export function editDebt(id) {
  return debtForm(id);
}

export function editFixed(id) {
  const f = model.state.fixedExpenses.find((x) => x.id === id) || {
    name: "",
    amount: 0,
    kind: "fixed",
  };
  form(
    id ? "Editar gasto fijo" : "Nuevo gasto fijo",
    input("name", "Nombre", f.name, "text", 'required maxlength="120"') +
      select(
        "kind",
        "Tipo",
        [
          ["fixed", "Gasto fijo"],
          ["subscription", "Suscripción"],
        ],
        f.kind,
      ) +
      afterSelect(
        recurrenceFields(f, model.state, !!id),
        "categoryId",
        categoryCreateControl("categoryId"),
      ) +
      (id
        ? '<p class="note">Los pagos registrados no cambian. Si ya pagaste vencimientos por adelantado, el nuevo calendario empieza después del último de ellos. Archivar detiene los nuevos cobros sin borrar pagos.</p>'
        : "") +
      select(
        "active",
        "Estado",
        [
          ["yes", "Activo"],
          ["no", "Archivado"],
        ],
        f.active === false ? "no" : "yes",
      ),
    async (v) =>
      commit(id ? "Gasto fijo actualizado" : "Gasto fijo creado", (s) => {
        const value = applyContextualCreations(s, v);
        const rule = recurrenceValue(value);
        C.updateFixed(
          s,
          id,
          {
            name: value.name.trim(),
            kind: value.kind,
          },
          rule,
        );
      }),
    "Guardar",
    {
      draftKey: `fixed:${id || "new"}`,
      ...contextualDraftOptions(),
    },
  );
}

export function editCatalog(kind, id) {
  const list = kind === "Account" ? "creditors" : "categories",
    x = model.state[list].find((a) => a.id === id);
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
    "Guardar",
    { draftKey: `catalog:${list}:${id || "new"}` },
  );
}

export function editGoal(id) {
  const g = model.state.goals.find((x) => x.id === id) || {
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
        else s.goals.push({ ...v, id: C.id(), balance: 0, allocations: [] });
      }),
    "Guardar",
    { draftKey: `goal:${id || "new"}` },
  );
}

export function syncReserveFields() {
  const kind = document.querySelector(
    '[name="kind"][data-reserve-kind]',
  )?.value;
  if (!kind) return;
  for (const [name, visible] of [
    ["accountId", kind !== "remove"],
    ["allocation", kind !== "add"],
    ["amount", kind !== "assign"],
  ]) {
    const el = document.querySelector(`#form [name="${name}"]`);
    if (el) {
      el.closest("label").hidden = !visible;
      if (name === "amount") el.required = visible;
    }
  }
}

export function contribute(id) {
  const g = model.state.goals.find((x) => x.id === id);
  form(
    g.name,
    select(
      "kind",
      "Acción",
      [
        ["add", "Reservar dinero"],
        ...(g.allocations.length ? [["remove", "Liberar reserva"]] : []),
        ...(g.allocations.some((r) => !r.accountId)
          ? [["assign", "Asignar reserva antigua a cuenta"]]
          : []),
      ],
      "add",
    ) +
      select(
        "accountId",
        "Cuenta",
        accountOptions(model.state, true),
        "debit",
      ) +
      (g.allocations.length
        ? select(
            "allocation",
            "Reserva existente",
            g.allocations.map((r, i) => [
              String(i),
              `${r.accountId ? accountName(r.accountId) : "Pendiente de asignar"} · ${money(r.amount)}${r.boxId ? " · Cajita" : ""}`,
            ]),
            "0",
          )
        : "") +
      amount("amount", "Importe (reservar / liberar)") +
      `<p class="note">Reservado en esta meta: ${money(g.balance)}. Reservar resta dinero del disponible sin crear un gasto; liberar una reserva lo devuelve.${g.allocations.some((allocation) => !allocation.accountId) ? " Asignar una reserva anterior a una cuenta no altera saldos ni avance." : ""}</p>`,
    async (f) =>
      commit("Reserva actualizada", (s) => {
        if (f.kind === "add")
          C.reserve(s, id, f.accountId, moneyValue(f.amount));
        else if (f.kind === "remove")
          C.releaseReserve(s, id, Number(f.allocation), moneyValue(f.amount));
        else C.assignReserve(s, id, Number(f.allocation), f.accountId);
      }),
    "Guardar",
    { draftKey: `reserve:${id}`, onDraftRestore: syncReserveFields },
  );
  document.querySelector('[name="kind"]').setAttribute("data-reserve-kind", "");
  syncReserveFields();
}

export function deleteEntity(type, id) {
  if (type === "Debt") {
    const d = model.state.debts.find((x) => x.id === id);
    if (d.balance > 0) {
      modal(
        "Esta deuda tiene saldo",
        `<p>Liquida o corrige el saldo antes de eliminarla o archivarla. Así no desaparece una deuda pendiente de tus totales.</p>${btn("Entendido", "close", "", "full")}`,
      );
      return;
    }
    const linked =
      model.state.transactions.some((t) => t.ref === id) ||
      C.allocations(model.state).some((a) => a.ref === id) ||
      d.paidPayments.length > 0;
    confirmAction(
      linked ? "Archivar deuda" : "Eliminar deuda",
      linked
        ? "Se conservarán los pagos y movimientos. La deuda dejará de generar compromisos pendientes."
        : "Se eliminará esta deuda y sus compromisos pendientes. Puedes deshacerlo.",
      linked ? "Deuda archivada" : "Deuda eliminada",
      (s) => {
        if (
          s.debts.find((d) => d.id === id)?.creditCardId &&
          s.debts.find((d) => d.id === id).balance > 0
        )
          throw Error("Liquida o desvincula los MSI antes de archivarlos.");
        if (linked) {
          s.debts.find((x) => x.id === id).archived = true;
        } else s.debts = s.debts.filter((x) => x.id !== id);
        C.refreshBudget(s);
      },
    );
  } else if (type === "Fixed")
    confirmAction(
      "Archivar gasto fijo",
      "Se conservarán sus pagos realizados, incluso los adelantados. Dejará de generar nuevos cobros desde hoy. No necesitas revertir ningún pago.",
      "Gasto fijo archivado",
      (s) => {
        const f = s.fixedExpenses.find((x) => x.id === id);
        C.updateFixed(
          s,
          id,
          { name: f.name, kind: f.kind },
          {
            ...C.rulesFor(f).at(-1),
            effectiveFrom: C.today(),
            active: false,
          },
        );
      },
    );
  else if (type === "Goal")
    confirmAction(
      "Eliminar meta",
      "Se liberará su reserva. Tu liquidez total no cambia.",
      "Meta eliminada",
      (s) => {
        s.goals = s.goals.filter((x) => x.id !== id);
        s.boxes
          .filter((b) => b.goalId === id)
          .forEach((b) => {
            b.goalId = null;
          });
      },
    );
  else {
    const key = type === "Account" ? "creditors" : "categories";
    if (
      (type === "Account" &&
        model.state.debts.some((d) => d.creditorId === id)) ||
      (type === "Category" &&
        model.state.transactions.some((t) => t.categoryId === id))
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

export function transactionDetails(id) {
  const t = model.state.transactions.find((x) => x.id === id);
  const allocations =
    t.kind === "card_payment"
      ? `<h3>Desglose del pago</h3>${t.allocations
          .map((a) => {
            const name =
              a.kind === "unassigned"
                ? "Abono pendiente de asignar"
                : a.kind === "debt"
                  ? `${model.state.debts.find((d) => d.id === a.ref)?.name} · Cuota ${a.n}`
                  : a.kind === "opening"
                    ? "Saldo anterior"
                    : model.state.transactions.find((p) => p.id === a.ref)
                        ?.name;
            return `<p>${esc(name)}: ${money(a.amount)}</p>`;
          })
          .join("")}`
      : "";
  modal(
    t.name,
    `<div class="details"><div><small>Importe</small><strong>${money(t.amount)}</strong></div><div><small>Tipo</small>${kindName(t.kind)}</div><div><small>Fecha</small>${dlabel(t.date)}</div><div><small>Origen</small>${esc(accountName(t.accountId || t.creditCardId))}</div>${t.categoryId ? `<div><small>Categoría</small>${esc(model.state.categories.find((category) => category.id === t.categoryId)?.name || "Sin categoría")}</div>` : ""}${t.toAccountId ? `<div><small>Destino</small>${esc(accountName(t.toAccountId))}</div>` : ""}</div>${t.historical ? '<p class="note">Importado de v6. Este gasto ya está contemplado en el saldo inicial; no se volvió a descontar.</p>' : ""}${allocations || (t.creditCardId ? `<p class="note">Compra a crédito · Vence ${dlabel(t.cardDueDate)}. No descontó dinero de tus cuentas.</p>` : "")}${t.obligation ? '<p class="note">Vinculado a un compromiso de ' + mlabel(t.period) + ".</p>" : ""}<div class="toolbar wrap"><button class="btn" data-action="editTransaction" data-id="${esc(t.id)}">Editar</button><button class="btn danger" data-action="deleteTransaction" data-id="${esc(t.id)}">${t.kind === "fixed" ? "Eliminar pago" : "Eliminar"}</button></div>`,
  );
}

export function debtDetails(id) {
  const d = model.state.debts.find((x) => x.id === id);
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
      )}</div><p>${esc(d.notes || "Sin notas")}</p><p class="note">${d.historicalPaidPayments?.length || 0} cuotas como antecedentes; ${d.paidPayments.length - (d.historicalPaidPayments?.length || 0)} liquidadas mediante pagos registrados. Los antecedentes no afectan el saldo de tus cuentas.</p>${btn("Editar deuda", "editDebt", id, "full")}${d.balance > 0 ? btn("Registrar abono adicional", "extraPayment", id, "full") : ""}<h3 style="margin-top:20px">Movimientos vinculados</h3>${
      model.state.transactions
        .filter((t) => t.ref === id)
        .map(
          (t) =>
            `<div class="item row"><span>${dlabel(t.date, false)}</span><strong>${money(t.amount)}</strong></div>`,
        )
        .join("") || '<p class="muted">Sin movimientos nuevos.</p>'
    }`,
  );
}

export function extraPayment(id) {
  const d = model.state.debts.find((x) => x.id === id);
  if (d.creditCardId) return creditPayForm(d.creditCardId);
  form(
    "Abono adicional",
    afterSelect(
      paymentFields(0),
      "accountId",
      accountCreateControl("accountId"),
    ) +
      amount("principal", "Reducción del saldo", 0) +
      '<p class="note">No marca cuotas como pagadas ni recalcula el contrato. Si cambia el calendario, ajusta la deuda después.</p>',
    async (f) =>
      commit("Abono registrado", (s) => {
        const value = applyContextualCreations(s, f),
          debt = s.debts.find((x) => x.id === id),
          a = moneyValue(value.amount),
          p = moneyValue(value.principal);
        if (p > a || p > debt.balance)
          throw Error("Revisa la reducción de saldo.");
        C.record(s, {
          kind: "debt",
          name: debt.name + " · Abono",
          amount: a,
          principal: p,
          ref: id,
          date: value.date,
          accountId: value.accountId,
          categoryId: "",
        });
        debt.balance -= p;
        if (!debt.balance) debt.active = false;
      }),
    "Guardar",
    contextualDraftOptions(),
  );
}

export function deleteTransaction(id) {
  const t = model.state.transactions.find((t) => t.id === id);
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
