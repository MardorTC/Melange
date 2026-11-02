import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";
import { input, select, esc, moneyValue, form } from "./components.js";

const TYPE_OPTIONS = [
  ["msi", "Compra a meses sin intereses (MSI)"],
  ["deferred", "Compra con pagos diferidos"],
  ["loan", "Préstamo con plazo"],
  ["revolving", "Crédito sin plazo fijo (pago variable)"],
  ["loan-open", "Deuda sin plazo fijo"],
];

const INSTALLMENT_TYPES = ["msi", "deferred", "loan"];
const OPEN_ENDED_TYPES = ["revolving", "loan-open"];

const TYPE_HELP = {
  msi: "MSI significa meses sin intereses. Si registras la tarjeta, vincula la compra para incluir cada mensualidad en el pago de la tarjeta.",
  deferred:
    "Para una compra que pagarás después en varias cuotas. Registra la primera fecha y el plazo si los conoces.",
  loan: "Para un préstamo con cuotas. Si no conoces la cuota, déjala en 0; podrás completarla al editarlo.",
  revolving:
    "Para una tarjeta de tienda u otro crédito que no tiene un número fijo de cuotas. La cuota es opcional.",
  "loan-open":
    "Puedes registrarla sin cuota ni plazo. Quedará marcada para revisar y no inventará fechas.",
};

const nameKey = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\bmsi\b|meses sin intereses/g, "")
    .replace(/[^a-z0-9áéíóúüñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const field = (name, html) => `<div data-debt-field="${name}">${html}</div>`;

const moneyField = (name, label, value = 0, required = false) =>
  input(
    name,
    label,
    value === null || value === undefined ? "" : String(value / 100),
    "text",
    `inputmode="decimal" data-money="1" placeholder="0.00" ${required ? "required" : ""}`,
  );

function paymentIsKnown(form) {
  const raw = String(form?.querySelector('[name="payment"]')?.value || "")
    .trim()
    .replace(/\s/g, "");
  return !!raw && !/^0+([.,]0+)?$/.test(raw);
}

function debtControls(form) {
  return [
    ...(form?.querySelectorAll("input[name],select[name],textarea[name]") ||
      []),
  ];
}

// form-drafts snapshots include disabled controls, but restoring skips them.
// Keep an explicit structure so a hidden value survives a draft round-trip.
function captureDebtStructure() {
  const form = document.querySelector("#form");
  if (!form) return null;
  return {
    fields: debtControls(form).map((control) => ({
      name: control.name,
      value: control.value,
    })),
  };
}

function restoreDebtStructure(structure) {
  const form = document.querySelector("#form");
  if (!form) return;
  for (const saved of structure?.fields || []) {
    const control = debtControls(form).find(
      (candidate) => candidate.name === saved.name,
    );
    if (control) control.value = saved.value;
  }
}

function syncDebtFields() {
  const form = document.querySelector("#form");
  const type = form?.querySelector('[name="type"]')?.value || "msi";
  const hasPaid = form?.dataset.debtHasPaid === "1";
  const hasAntecedents = form?.dataset.debtAntecedents === "1";
  const preserveOpenData =
    form?.dataset.debtEditing === "1" &&
    form?.dataset.debtOriginalType === "loan-open";
  const totalPayments = Number(
    form?.querySelector('[name="totalPayments"]')?.value || 0,
  );
  const showsOpenPayment =
    type !== "loan-open" ||
    paymentIsKnown(form) ||
    hasPaid ||
    hasAntecedents ||
    (preserveOpenData && totalPayments > 0);
  const visible = new Set([
    "name",
    "type",
    "balance",
    "creditorId",
    "originalAmount",
    "balanceMode",
    "financingCost",
    "annualRate",
    "notes",
  ]);
  if (type === "msi") visible.add("creditCardId");
  if (showsOpenPayment) {
    visible.add("payment");
    visible.add("dueDay");
  }
  if (INSTALLMENT_TYPES.includes(type)) {
    visible.add("totalPayments");
    visible.add("startDate");
    visible.add("priorPaid");
  }
  if (
    type === "loan-open" &&
    (hasPaid || hasAntecedents || (preserveOpenData && totalPayments > 0))
  )
    visible.add("priorPaid");
  for (const wrapper of form?.querySelectorAll("[data-debt-field]") || []) {
    const shown = visible.has(wrapper.dataset.debtField);
    wrapper.hidden = !shown;
    for (const control of wrapper.querySelectorAll("input,select,textarea")) {
      if (control.dataset.debtRequired === undefined)
        control.dataset.debtRequired = control.required ? "1" : "0";
      control.disabled = !shown;
      control.required = shown && control.dataset.debtRequired === "1";
    }
  }
  const help = form?.querySelector("[data-debt-type-help]");
  if (help) help.textContent = TYPE_HELP[type] || "";
}

function integerField(value, label, min = 0, max = 1200) {
  const number = Number(value || 0);
  if (!Number.isInteger(number) || number < min || number > max)
    throw Error(`Revisa ${label}.`);
  return number;
}

export function debtForm(id) {
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
      model.state.transactions.some((t) => t.ref === id) ||
      C.allocations(model.state).some((a) => a.ref === id),
    hasAntecedents = (d.historicalPaidPayments?.length || 0) > 0,
    advancedOpen =
      !!id &&
      Boolean(
        hasPaid ||
          hasAntecedents ||
          d.creditorId ||
          d.originalAmount ||
          d.balanceMode === "principal" ||
          d.financingCost ||
          d.annualRate ||
          d.notes ||
          (d.totalPayments && !INSTALLMENT_TYPES.includes(d.type)),
      );
  const advancedFields =
    field(
      "creditorId",
      select(
        "creditorId",
        "¿A quién le debes?",
        [
          ["", "Sin acreedor"],
          ...model.state.creditors.map((a) => [a.id, a.name]),
        ],
        d.creditorId,
      ),
    ) +
    field(
      "originalAmount",
      moneyField("originalAmount", "Monto original", d.originalAmount),
    ) +
    field(
      "balanceMode",
      select(
        "balanceMode",
        "Qué representa el saldo",
        [
          ["total", "Total por pagar (incluye financiamiento)"],
          ["principal", "Solo capital (separar intereses al pagar)"],
        ],
        d.balanceMode,
      ),
    ) +
    field(
      "priorPaid",
      input(
        "priorPaid",
        "Cuotas ya liquidadas antes del registro",
        d.historicalPaidPayments?.length || 0,
        "number",
        'min="0" max="1200"',
      ),
    ) +
    field(
      "financingCost",
      moneyField(
        "financingCost",
        "Costo total de financiamiento",
        d.financingCost,
      ),
    ) +
    field(
      "annualRate",
      input(
        "annualRate",
        "Tasa anual informativa (%)",
        d.annualRate || 0,
        "number",
        'min="0" max="1000" step="0.01"',
      ),
    ) +
    field(
      "notes",
      `<label>Notas<textarea name="notes" maxlength="2000">${esc(d.notes)}</textarea></label>`,
    );
  const fields =
    field(
      "type",
      select("type", "¿Qué tipo de deuda es?", TYPE_OPTIONS, d.type),
    ) +
    '<p class="note" data-debt-type-help></p>' +
    field(
      "name",
      input("name", "Nombre", d.name, "text", 'required maxlength="120"'),
    ) +
    field(
      "creditCardId",
      select(
        "creditCardId",
        "Vincular a tarjeta (compra a meses sin intereses)",
        [
          ["", "Sin tarjeta vinculada"],
          ...model.state.creditCards
            .filter((c) => c.active !== false || c.id === d.creditCardId)
            .map((c) => [c.id, c.name]),
        ],
        d.creditCardId || "",
      ),
    ) +
    field(
      "balance",
      moneyField("balance", "Saldo pendiente actual", d.balance, true),
    ) +
    field(
      "payment",
      moneyField("payment", "Cuota mensual (0 si no la conoces)", d.payment),
    ) +
    field(
      "totalPayments",
      input(
        "totalPayments",
        "Número de cuotas (0 = sin plazo)",
        d.totalPayments,
        "number",
        `min="0" max="1200" ${hasPaid ? "readonly" : ""}`,
      ),
    ) +
    field(
      "startDate",
      input(
        "startDate",
        "Fecha de primera cuota",
        d.startDate || C.today(),
        "date",
        hasPaid ? "readonly" : "",
      ),
    ) +
    field(
      "dueDay",
      input(
        "dueDay",
        "Día de vencimiento",
        d.dueDay || 1,
        "number",
        'min="1" max="31" required',
      ),
    ) +
    `<details data-debt-advanced ${advancedOpen ? "open" : ""}><summary>Más detalles (opcional)</summary><div style="display:grid;gap:13px;margin-top:12px">${advancedFields}</div></details>` +
    '<p class="note">Las cuotas liquidadas antes del registro son antecedentes: no generan salidas ni vuelven a reducir el saldo.</p>' +
    (hasPaid
      ? '<p class="note">El inicio y el número de cuotas están protegidos porque ya hay pagos. Los cambios de importe no reescriben movimientos anteriores.</p>'
      : "");

  form(
    id ? "Editar deuda" : "Nueva deuda",
    fields,
    async (f) => {
      const selectedType = f.type || d.type,
        linkedCard = selectedType === "msi" ? String(f.creditCardId || "") : "",
        formEl = document.querySelector("#form"),
        isHidden = (name) =>
          Boolean(formEl?.querySelector(`[name="${name}"]`)?.disabled),
        preserveHidden = !!id && d.type === selectedType,
        convertingToOpen =
          !!id &&
          d.type !== selectedType &&
          OPEN_ENDED_TYPES.includes(selectedType);
      if (convertingToOpen && hasPaid)
        throw Error(
          "Esta deuda ya tiene pagos o antecedentes. Conserva su tipo y calendario; puedes corregir nombre e importes.",
        );
      if (id && d.creditCardId && selectedType !== "msi" && hasPaid)
        throw Error(
          "Esta deuda es un MSI con pagos registrados. Conserva la tarjeta y el tipo para no perder su historial.",
        );
      const originalAmount = f.originalAmount?.trim()
          ? moneyValue(f.originalAmount)
          : 0,
        balance = f.balance?.trim() ? moneyValue(f.balance) : 0,
        financingCost = f.financingCost?.trim()
          ? moneyValue(f.financingCost)
          : 0,
        hiddenValue = (name) =>
          formEl?.querySelector(`[name="${name}"]`)?.value;
      const totalPayments = isHidden("totalPayments")
          ? preserveHidden
            ? d.totalPayments || 0
            : 0
          : integerField(f.totalPayments, "el número de cuotas"),
        priorPaid = isHidden("priorPaid")
          ? preserveHidden
            ? d.historicalPaidPayments?.length || 0
            : 0
          : integerField(f.priorPaid, "las cuotas ya liquidadas"),
        startDate = isHidden("startDate")
          ? preserveHidden
            ? d.startDate || ""
            : ""
          : f.startDate || "",
        payment = isHidden("payment")
          ? preserveHidden
            ? hiddenValue("payment")?.trim()
              ? moneyValue(hiddenValue("payment"))
              : 0
            : 0
          : f.payment?.trim()
            ? moneyValue(f.payment)
            : 0,
        dueDay = isHidden("dueDay")
          ? preserveHidden
            ? integerField(
                hiddenValue("dueDay") || d.dueDay || 1,
                "el día de vencimiento",
                1,
                31,
              )
            : 1
          : integerField(f.dueDay, "el día de vencimiento", 1, 31);
      if (!f.name?.trim()) throw Error("Escribe un nombre.");
      if (linkedCard && (!totalPayments || !startDate))
        throw Error(
          "Un MSI vinculado a tarjeta necesita un plazo mayor a cero y una fecha de primera cuota.",
        );
      if (totalPayments && !startDate)
        throw Error(
          "Indica la fecha de la primera cuota o deja el número de cuotas en cero.",
        );
      if (linkedCard && payment <= 0)
        throw Error(
          "Un MSI vinculado a tarjeta necesita una cuota mayor a cero.",
        );
      const value = {
        name: f.name.trim(),
        creditorId: f.creditorId,
        creditCardId: linkedCard || null,
        type: selectedType,
        originalAmount,
        balance,
        payment,
        totalPayments,
        startDate: startDate || null,
        dueDay,
        financingCost,
        annualRate: Number(f.annualRate || 0),
        notes: f.notes || "",
        balanceMode: linkedCard ? "total" : f.balanceMode,
      };
      await commit(id ? "Deuda actualizada" : "Deuda agregada", (s) => {
        const debtId = id || C.id();
        if (
          id &&
          C.allocations(s).some((a) => a.ref === id) &&
          [
            "creditCardId",
            "balance",
            "payment",
            "dueDay",
            "startDate",
            "totalPayments",
            "balanceMode",
            "type",
          ].some((k) => (d[k] ?? null) !== (value[k] ?? null))
        )
          throw Error(
            "La deuda tiene pagos de tarjeta. Revierte esos pagos antes de cambiar su saldo, vínculo o calendario.",
          );
        if (
          linkedCard &&
          (!id ||
            ["balance", "payment", "totalPayments"].some(
              (k) => value[k] !== d[k],
            ) ||
            priorPaid !== (d.historicalPaidPayments || []).length)
        )
          C.validateInstallmentPlan(
            value,
            priorPaid,
            (d.paidPayments || []).filter(
              (n) => !(d.historicalPaidPayments || []).includes(n),
            ).length,
          );
        if (
          linkedCard &&
          (!id ||
            d.creditCardId !== linkedCard ||
            d.originalAmount !== value.originalAmount ||
            d.startDate !== value.startDate)
        ) {
          const duplicate = s.transactions.find(
            (t) =>
              C.isCreditPurchase(t) &&
              t.creditCardId === linkedCard &&
              t.amount === value.originalAmount &&
              nameKey(t.name) === nameKey(value.name) &&
              C.month(t.date) === C.month(value.startDate),
          );
          if (duplicate)
            throw Error(
              `Ya registraste "${duplicate.name}" por ese importe en esta tarjeta. Si es la misma compra, no la dupliques como MSI: revisa la compra o elimina una de las dos fuentes.`,
            );
        }
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
        if (!id || priorPaid !== (d.historicalPaidPayments?.length || 0))
          C.setPriorPayments(
            s,
            s.debts.find((x) => x.id === debtId),
            priorPaid,
          );
        C.refreshAllBudgets(s);
      });
    },
    "Guardar",
    {
      draftKey: `debt:${id || "new"}`,
      captureStructure: captureDebtStructure,
      restoreStructure: restoreDebtStructure,
      onDraftRestore: syncDebtFields,
    },
  );

  const formEl = document.querySelector("#form");
  if (formEl) {
    formEl.dataset.debtHasPaid = hasPaid ? "1" : "0";
    formEl.dataset.debtAntecedents = hasAntecedents ? "1" : "0";
    formEl.dataset.debtEditing = id ? "1" : "0";
    formEl.dataset.debtOriginalType = d.type;
  }
  const typeSelect = formEl?.querySelector('[name="type"]');
  typeSelect?.addEventListener("change", syncDebtFields);
  formEl
    ?.querySelector('[name="payment"]')
    ?.addEventListener("input", syncDebtFields);
  if (!id) {
    const original = formEl?.querySelector('[name="originalAmount"]');
    const balance = formEl?.querySelector('[name="balance"]');
    balance?.addEventListener("input", () => {
      balance.dataset.touched = "1";
    });
    original?.addEventListener("input", () => {
      if (balance && !balance.dataset.touched) balance.value = original.value;
    });
  }
  syncDebtFields();
}
