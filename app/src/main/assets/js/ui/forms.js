import { recurrenceFields, recurrenceValue } from "./recurrence-fields.js";
import { accountName } from "../ui/components.js";
import {
  modal,
  svg,
  btn,
  input,
  amount,
  select,
  accountOptions,
  form,
  moneyValue,
  empty,
  toast,
  paymentFields,
  debtType,
  esc,
  money,
  confirmAction,
  kindName,
  mlabel,
} from "./components.js";
import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";
import { paymentRow } from "../screens/home.js";

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
  if (
    existing &&
    ["debt", "fixed", "adjustment", "loan_in", "loan_out"].includes(t.kind)
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
      accountOptions(),
      t.accountId,
    ) +
    (kind === "expense"
      ? select(
          "categoryId",
          "Categoría",
          [
            ["", "Sin categoría"],
            ...model.state.categories.map((c) => [c.id, c.name]),
          ],
          t.categoryId,
        )
      : "") +
    (kind === "transfer"
      ? select(
          "toAccountId",
          "Destino",
          accountOptions(),
          t.toAccountId || "cash",
        )
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
        accountId: f.accountId,
        categoryId: f.categoryId || "",
        ...(kind === "transfer" ? { toAccountId: f.toAccountId } : {}),
      };
      if (kind === "transfer" && f.toAccountId === f.accountId)
        throw Error("El origen y destino deben ser diferentes.");
      await commit(
        existing ? "Movimiento actualizado" : "Movimiento registrado",
        (s) => {
          if (existing) {
            C.editTransaction(s, existing.id, value);
          } else C.record(s, value);
        },
      );
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
  const item =
    C.obligations(model.state, m).find((i) => i.key === key) ||
    C.planned(model.state, m).find((i) => i.key === key);
  if (!item || item.paid || C.isPaid(model.state, item)) {
    toast("Este compromiso ya está pagado o no está disponible.");
    return;
  }
  const d =
    item.kind === "debt"
      ? model.state.debts.find((d) => d.id === item.ref)
      : null;
  form(
    "Pagar " + item.name,
    `<p class="note">${item.n ? "Cuota " + item.n + " · " : ""}Vencimiento: ${item.date}. Se registrará una salida y se descontará del origen elegido. Puedes abonar una parte; el resto seguirá pendiente.</p>` +
      paymentFields(
        d?.balanceMode === "total"
          ? Math.min(d.balance, item.remaining ?? item.amount)
          : (item.remaining ?? item.amount),
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
            "",
          )
        : "") +
      '<p class="note">El pago requiere saldo disponible. Puedes liberar reservas o cajitas desde Cuentas antes de pagarlo.</p>',
    async (f) => {
      if (f.date > C.today())
        throw Error("La fecha real de pago no puede ser futura.");
      await commit("Pago registrado", (s) => {
        C.ensureBudget(s, m);
        C.pay(s, key, {
          period: m,
          amount: moneyValue(f.amount),
          accountId: f.accountId,
          date: f.date,
          categoryId: f.categoryId,
          principal: f.principal ? moneyValue(f.principal) : undefined,
        });
      });
    },
    "Registrar pago",
  );
}

export function editDebt(id) {
  const d = model.state.debts.find((x) => x.id === id) || {
    name: "",
    creditorId: "",
    type: "msi",
    originalAmount: 0,
    balance: 0,
    payment: 0,
    totalPayments: 0,
    startDate: C.today(),
    dueDay: 1,
    annualRate: 0,
    financingCost: 0,
    notes: "",
    balanceMode: "total",
  };
  const hasPaid =
    (d.paidPayments?.length || 0) > 0 ||
    model.state.transactions.some((t) => t.ref === id);
  form(
    id ? "Editar deuda" : "Nueva deuda",
    input("name", "Nombre", d.name, "text", 'required maxlength="120"') +
      select(
        "creditorId",
        "Acreedor",
        [
          ["", "Sin acreedor"],
          ...model.state.creditors.map((a) => [a.id, a.name]),
        ],
        d.creditorId,
      ) +
      select(
        "type",
        "Tipo",
        ["msi", "deferred", "loan", "revolving", "loan-open"].map((t) => [
          t,
          debtType(t),
        ]),
        d.type,
      ) +
      amount("originalAmount", "Monto original", d.originalAmount) +
      amount("balance", "Saldo pendiente registrado", d.balance) +
      select(
        "balanceMode",
        "Qué representa el saldo",
        [
          ["total", "Total por pagar (incluye financiamiento)"],
          ["principal", "Solo capital (separar intereses al pagar)"],
        ],
        d.balanceMode,
      ) +
      amount("payment", "Cuota o pago mensual previsto", d.payment) +
      input(
        "totalPayments",
        "Número de cuotas (0 = sin plazo)",
        d.totalPayments,
        "number",
        `min="0" max="1200" required ${hasPaid ? "readonly" : ""}`,
      ) +
      input(
        "priorPaid",
        "Cuotas ya liquidadas antes del registro",
        d.historicalPaidPayments?.length || 0,
        "number",
        'required min="0" max="1200"',
      ) +
      '<p class="note">Son antecedentes: no generan salidas ni vuelven a reducir el saldo pendiente.</p>' +
      input(
        "startDate",
        "Fecha de primera cuota",
        d.startDate || C.today(),
        "date",
        `required ${hasPaid ? "readonly" : ""}`,
      ) +
      input(
        "dueDay",
        "Día de vencimiento",
        d.dueDay || 1,
        "number",
        'min="1" max="31" required',
      ) +
      amount(
        "financingCost",
        "Costo total de financiamiento",
        d.financingCost,
      ) +
      input(
        "annualRate",
        "Tasa anual informativa (%)",
        d.annualRate || 0,
        "number",
        'min="0" max="1000" step="0.01"',
      ) +
      `<label>Notas<textarea name="notes" maxlength="2000">${esc(d.notes)}</textarea></label>` +
      (hasPaid
        ? '<p class="note">El inicio y número de cuotas están protegidos porque ya hay pagos. Los cambios de importe no reescriben movimientos anteriores.</p>'
        : ""),
    async (f) => {
      await commit(id ? "Deuda actualizada" : "Deuda agregada", (s) => {
        const debtId = id || C.id();
        const value = {
          name: f.name.trim(),
          creditorId: f.creditorId,
          type: f.type,
          originalAmount: moneyValue(f.originalAmount),
          balance: moneyValue(f.balance),
          payment: moneyValue(f.payment),
          totalPayments: Number(f.totalPayments),
          startDate: f.startDate,
          dueDay: Number(f.dueDay),
          financingCost: moneyValue(f.financingCost || "0"),
          annualRate: Number(f.annualRate),
          notes: f.notes,
          balanceMode: f.balanceMode,
        };
        if (!value.name) throw Error("Escribe un nombre.");
        if (value.payment <= 0) throw Error("La cuota debe ser mayor a cero.");
        if (id)
          Object.assign(
            s.debts.find((x) => x.id === id),
            value,
          );
        else
          s.debts.push({
            ...value,
            id: debtId,
            historicalPaidPayments: [],
            active: true,
            archived: false,
            paidPayments: [],
            paidMonths: [],
          });
        if (
          !id ||
          Number(f.priorPaid) !== (d.historicalPaidPayments?.length || 0)
        )
          C.setPriorPayments(
            s,
            s.debts.find((x) => x.id === debtId),
            Number(f.priorPaid),
          );
        C.refreshAllBudgets(s);
      });
    },
  );
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
      recurrenceFields(f, model.state, !!id) +
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
      commit("Gasto fijo actualizado", (s) => {
        const rule = recurrenceValue(v);
        let item = s.fixedExpenses.find((x) => x.id === id);
        if (!item) {
          item = { id: C.id(), rules: [] };
          s.fixedExpenses.push(item);
        }
        C.setRecurrence(s, item, rule);
        Object.assign(item, {
          name: v.name.trim(),
          kind: v.kind,
          amount: rule.amount,
          categoryId: rule.categoryId,
          active: rule.active,
        });
        C.refreshAllBudgets(s);
      }),
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
  );
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
        ["remove", "Liberar reserva"],
        ["assign", "Asignar reserva antigua a cuenta"],
      ],
      "add",
    ) +
      select(
        "accountId",
        "Cuenta",
        accountOptions(model.state, true),
        "debit",
      ) +
      select(
        "allocation",
        "Reserva existente",
        g.allocations.map((r, i) => [
          String(i),
          `${r.accountId ? accountName(r.accountId) : "Pendiente de asignar"} · ${money(r.amount)}${r.boxId ? " · Cajita" : ""}`,
        ]),
        "0",
      ) +
      amount("amount", "Importe (reservar / liberar)") +
      `<p class="note">Reservado: ${money(g.balance)}. Asignar una reserva antigua no altera saldos ni avance.</p>`,
    async (f) =>
      commit("Reserva actualizada", (s) => {
        if (f.kind === "add")
          C.reserve(s, id, f.accountId, moneyValue(f.amount));
        else if (f.kind === "remove")
          C.releaseReserve(s, id, Number(f.allocation), moneyValue(f.amount));
        else C.assignReserve(s, id, Number(f.allocation), f.accountId);
      }),
  );
}

export function deleteEntity(type, id) {
  if (type === "Debt") {
    const d = model.state.debts.find((x) => x.id === id),
      linked =
        model.state.transactions.some((t) => t.ref === id) ||
        d.paidPayments.length > 0;
    confirmAction(
      linked ? "Archivar deuda" : "Eliminar deuda",
      linked
        ? "Se conservarán los pagos y movimientos. La deuda dejará de generar compromisos pendientes."
        : "Se eliminará esta deuda y sus compromisos pendientes. Puedes deshacerlo.",
      linked ? "Deuda archivada" : "Deuda eliminada",
      (s) => {
        if (linked) {
          s.debts.find((x) => x.id === id).archived = true;
        } else s.debts = s.debts.filter((x) => x.id !== id);
        C.refreshBudget(s);
      },
    );
  } else if (type === "Fixed")
    confirmAction(
      "Archivar gasto fijo",
      "Se conservarán sus pagos realizados y dejará de generar compromisos nuevos.",
      "Gasto fijo archivado",
      (s) => {
        const f = s.fixedExpenses.find((x) => x.id === id);
        C.setRecurrence(s, f, {
          ...C.rulesFor(f).at(-1),
          effectiveFrom: C.today(),
          active: false,
        });
        f.active = false;
        C.refreshAllBudgets(s);
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
  modal(
    t.name,
    `<div class="details"><div><small>Importe</small><strong>${money(t.amount)}</strong></div><div><small>Tipo</small>${kindName(t.kind)}</div><div><small>Fecha</small>${t.date}</div><div><small>Origen</small>${esc(accountName(t.accountId))}</div></div>${t.historical ? '<p class="note">Importado de v6. Este gasto ya está contemplado en el saldo inicial; no se volvió a descontar.</p>' : ""}${t.obligation ? '<p class="note">Vinculado a un compromiso de ' + mlabel(t.period) + ".</p>" : ""}`,
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
      )}</div><p>${esc(d.notes || "Sin notas")}</p><p class="note">${d.historicalPaidPayments?.length || 0} cuotas como antecedentes; ${d.paidPayments.length - (d.historicalPaidPayments?.length || 0)} liquidadas mediante pagos registrados. Los antecedentes no afectan el saldo de tus cuentas.</p>${d.balance > 0 ? btn("Registrar abono adicional", "extraPayment", id, "full") : ""}<h3 style="margin-top:20px">Movimientos vinculados</h3>${
      model.state.transactions
        .filter((t) => t.ref === id)
        .map(
          (t) =>
            `<div class="item row"><span>${t.date}</span><strong>${money(t.amount)}</strong></div>`,
        )
        .join("") || '<p class="muted">Sin movimientos nuevos.</p>'
    }`,
  );
}

export function extraPayment(id) {
  const d = model.state.debts.find((x) => x.id === id);
  form(
    "Abono adicional",
    paymentFields(0) +
      amount("principal", "Reducción del saldo", 0) +
      '<p class="note">No marca cuotas como pagadas ni recalcula el contrato. Si cambia el calendario, ajusta la deuda después.</p>',
    async (f) =>
      commit("Abono registrado", (s) => {
        const debt = s.debts.find((x) => x.id === id),
          a = moneyValue(f.amount),
          p = moneyValue(f.principal);
        if (p > a || p > debt.balance)
          throw Error("Revisa la reducción de saldo.");
        C.record(s, {
          kind: "debt",
          name: debt.name + " · Abono",
          amount: a,
          principal: p,
          ref: id,
          date: f.date,
          accountId: f.accountId,
          categoryId: "",
        });
        debt.balance -= p;
        if (!debt.balance) debt.active = false;
      }),
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
