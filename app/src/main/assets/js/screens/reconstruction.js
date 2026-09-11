import { recurrenceFields, recurrenceValue } from "../ui/recurrence-fields.js";
import {
  btn,
  closeModal,
  toast,
  form,
  input,
  signedField,
  amount,
  signedMoney,
  moneyValue,
  pageHeading,
  empty,
  esc,
  money,
  icon,
  kindName,
  select,
  accountOptions,
  modal,
  mlabel,
} from "../ui/components.js";
import { model } from "../state/model.js";
import { writeStore } from "../platform/storage.js";
import C from "../domain/finance.js";
import HistoryRebuild from "../domain/reconstruction.js";
import { render, openPage, backPage } from "../ui/navigation.js";
import { lineChart } from "../ui/charts.js";
import { commit } from "../state/ledger.js";
import { exportState } from "../platform/backups.js";

export function reconstructionSettings() {
  return `<section class="card"><div class="eyebrow">Tu historia, desde el principio</div><h2>Reconstrucción histórica</h2><p>Parte de los saldos de una fecha pasada y registra lo ocurrido hasta hoy. Trabaja en un borrador separado; tus datos actuales no cambian hasta confirmar.</p>${btn(model.rebuildDraft ? "Continuar borrador" : "Reconstruir meses anteriores", "rebuildStart", "", "full primary")}</section>`;
}

export async function saveDraft(next) {
  if (model.busy) throw Error("Espera a que termine el guardado.");
  model.busy = true;
  try {
    await writeStore({
      state: model.state,
      history: model.history,
      draft: next,
      revision: model.revision,
    });
    model.rebuildDraft = next;
  } finally {
    model.busy = false;
  }
}

export async function changeDraft(fn) {
  const next = C.clone(model.rebuildDraft);
  fn(next);
  HistoryRebuild.build(next); // Never save an inconsistent candidate.
  await saveDraft(next);
  closeModal();
  render();
  toast("Borrador guardado · Tus datos actuales no cambiaron");
}

export function startRebuild() {
  if (model.rebuildDraft) {
    openPage("rebuild");
    return;
  }
  form(
    "Elegir punto de partida",
    `<p class="note">El borrador empieza sin movimientos, deudas ni metas; solo copia tus categorías y acreedores. Al confirmar sustituirá tus datos actuales, con opción de deshacer.</p>` +
      input(
        "startDate",
        "Fecha de inicio",
        C.addMonth(C.month(), -1) + "-01",
        "date",
        `required min="${C.addMonth(C.month(), -120)}-01" max="${C.today()}"`,
      ) +
      model.state.walletAccounts
        .map((a) => signedField(a.id, a.name + " al comenzar ese día"))
        .join("") +
      amount(
        "income",
        "Ingreso mensual previsto (0 si no lo sabes)",
        model.state.income,
      ),
    async (f) => {
      const next = HistoryRebuild.create(
        model.state,
        {
          startDate: f.startDate,
          openings: Object.fromEntries(
            model.state.walletAccounts.map((a) => [a.id, signedMoney(f[a.id])]),
          ),
          income: moneyValue(f.income),
        },
        model.revision,
      );
      await saveDraft(next);
      model.rebuildPaymentMonth = "";
      openPage("rebuild");
    },
    "Crear borrador",
  );
}

export function rebuildPage() {
  if (!model.rebuildDraft)
    return (
      pageHeading("Reconstrucción histórica") +
      empty("Sin borrador", "Vuelve a Ajustes para iniciar.")
    );
  let s;
  try {
    s = HistoryRebuild.build(model.rebuildDraft);
  } catch (e) {
    return (
      pageHeading("Borrador pendiente de revisión") +
      `<p>${esc(e.message)}</p>${btn("Descartar borrador", "rebuildDiscard", "", "danger")}`
    );
  }
  const b = C.balances(s),
    rows = C.ledgerEntries(s),
    stale = model.rebuildDraft.baseRevision !== model.revision;
  return (
    pageHeading("Reconstruir mi historia", "Borrador privado · Paso a paso") +
    `<p class="note">Desde ${model.rebuildDraft.config.startDate} hasta ${C.today()}. Se guarda al agregar o corregir cada dato; puedes salir y continuar después.</p>${stale ? '<div class="card danger-zone"><strong>Tus datos activos cambiaron después de iniciar.</strong><p>Para evitar sobrescribir cambios nuevos, este borrador no puede confirmarse. Puedes revisarlo, exportar su resultado o empezar otro.</p></div>' : ""}<div class="grid">${s.walletAccounts.map((a) => `<div class="card"><small>${esc(a.name)} reconstruido</small><div class="metric small">${money(b[a.id])}</div></div>`).join("")}</div><div class="toolbar wrap">${btn("Editar saldos iniciales", "rebuildOpening")}${btn("Comparar con hoy", "rebuildReview", "", "primary")}</div>
    <section class="card"><h2>1. Compromisos que ya existían</h2><p class="note">Usa el saldo de las deudas al inicio del periodo, no el saldo actual. Las cuotas anteriores a esa fecha se marcan como antecedentes sin volver a descontar dinero.</p><div class="toolbar wrap">${btn("Agregar deuda", "rebuildDebt")}${btn("Agregar gasto fijo", "rebuildFixed")}</div>${[...model.rebuildDraft.debts.map((d) => ({ ...d, entity: "debt" })), ...model.rebuildDraft.fixedExpenses.map((f) => ({ ...f, entity: "fixed" }))].map((d) => `<div class="item row"><span>${esc(d.name)}<br><small>${d.entity === "debt" ? "Saldo inicial: " + money(d.balance) : money(d.amount) + " · " + C.recurrenceLabel(d)}</small></span><div class="actions">${icon("edit", "Editar compromiso", "rebuildDefinitionEdit", d.id, `data-kind="${d.entity}"`)}${icon("trash", "Quitar compromiso del borrador", "rebuildDefinitionDelete", d.id, `data-kind="${d.entity}"`)}</div></div>`).join("")}</section>
    <section class="card"><h2>2. Lo que ocurrió</h2><div class="toolbar wrap">${btn("Gasto", "rebuildEntry", "expense")}${btn("Ingreso", "rebuildEntry", "income")}${btn("Transferencia", "rebuildEntry", "transfer")}${btn("Pagar compromiso", "rebuildPayment")}</div><p class="note">Puedes capturar en cualquier orden: el cálculo ordena por fecha. Los movimientos del mismo día conservan el orden de captura.</p><div class="rebuild-ledger">${rows.map((t) => `<div class="item"><div class="row"><div><strong>${esc(t.name)}</strong><p>${t.date} · ${kindName(t.kind)} · ${money(t.amount)}</p><small>Después: ${s.walletAccounts.map((a) => esc(a.name) + " " + money(t.balances[a.id])).join(" · ")}</small></div><div class="actions">${icon("edit", "Corregir movimiento del borrador", "rebuildEntryEdit", t.id)}${icon("trash", "Quitar movimiento del borrador", "rebuildEntryDelete", t.id)}</div></div></div>`).join("") || empty("Aún sin movimientos", "Captura los ingresos, gastos y pagos desde la fecha inicial.")}</div></section>
    <section class="card"><h2>Liquidez reconstruida</h2>${lineChart(s.liquidityHistory)}<p class="note">Saldos calculados desde los movimientos, no observaciones bancarias. No se inventan gastos ni ingresos.</p></section><div class="toolbar wrap">${btn("Exportar resultado del borrador", "rebuildExport")}${btn("Descartar borrador", "rebuildDiscard", "", "danger")}</div>`
  );
}

export function rebuildOpeningForm() {
  const c = model.rebuildDraft.config;
  form(
    "Saldos al inicio",
    `<p class="note">Fecha inicial: ${c.startDate}. Para cambiar el periodo crea otro borrador.</p>` +
      model.rebuildDraft.walletAccounts
        .map((a) =>
          signedField(a.id, a.name + " inicial", c.openings[a.id] / 100),
        )
        .join("") +
      amount("income", "Ingreso mensual previsto", c.income),
    async (f) =>
      changeDraft((d) => {
        d.config.openings = Object.fromEntries(
          d.walletAccounts.map((a) => [a.id, signedMoney(f[a.id])]),
        );
        d.config.income = moneyValue(f.income);
      }),
  );
}

export function rebuildDefinition(kind, id = "") {
  const list = kind === "debt" ? "debts" : "fixedExpenses",
    found = model.rebuildDraft[list].find((x) => x.id === id);
  const d = found || {
    name: "",
    balance: 0,
    payment: 0,
    amount: 0,
    totalPayments: 0,
    dueDay: 1,
    startDate: model.rebuildDraft.config.startDate,
    startMonth: C.month(model.rebuildDraft.config.startDate),
    paidPayments: [],
    originalAmount: 0,
  };
  if (kind === "fixed") {
    form(
      "Gasto fijo histórico",
      input("name", "Nombre", d.name, "text", 'required maxlength="120"') +
        select(
          "kind",
          "Tipo",
          [
            ["fixed", "Gasto fijo"],
            ["subscription", "Suscripción"],
          ],
          d.kind || "fixed",
        ) +
        recurrenceFields(
          found || {
            ...d,
            rules: [
              {
                unit: "months",
                interval: 1,
                startDate: model.rebuildDraft.config.startDate,
                effectiveFrom: model.rebuildDraft.config.startDate,
                amount: 0,
              },
            ],
          },
          model.rebuildDraft,
          !!found,
        ),
      async (v) =>
        changeDraft((draft) => {
          const rule = recurrenceValue(v);
          let item = draft.fixedExpenses.find((x) => x.id === id);
          if (!item) {
            item = { id: C.id(), rules: [] };
            draft.fixedExpenses.push(item);
          }
          C.setRecurrence({ transactions: draft.entries }, item, rule);
          Object.assign(item, {
            name: v.name.trim(),
            kind: v.kind,
            amount: rule.amount,
            active: true,
            categoryId: rule.categoryId,
          });
        }),
    );
    return;
  }
  const fields =
    input("name", "Nombre", d.name, "text", 'required maxlength="120"') +
    (kind === "debt"
      ? select(
          "creditorId",
          "Acreedor",
          [
            ["", "Sin acreedor"],
            ...model.rebuildDraft.creditors.map((a) => [a.id, a.name]),
          ],
          d.creditorId || "",
        ) +
        amount("originalAmount", "Monto original", d.originalAmount) +
        amount("balance", "Saldo pendiente al inicio del periodo", d.balance) +
        select(
          "balanceMode",
          "El saldo representa",
          [
            ["total", "Total por pagar"],
            ["principal", "Solo capital"],
          ],
          d.balanceMode || "total",
        ) +
        amount("payment", "Cuota mensual", d.payment) +
        input(
          "totalPayments",
          "Número de cuotas (0 = sin plazo)",
          d.totalPayments,
          "number",
          'required min="0" max="1200"',
        ) +
        input(
          "startDate",
          "Fecha de primera cuota",
          d.startDate,
          "date",
          `required max="${C.today()}"`,
        ) +
        input(
          "priorPaid",
          "Cuotas consecutivas pagadas antes del inicio",
          d.paidPayments.length,
          "number",
          'required min="0" max="1200"',
        )
      : amount("amount", "Importe mensual", d.amount) +
        select(
          "kind",
          "Tipo",
          [
            ["fixed", "Gasto fijo"],
            ["subscription", "Suscripción"],
          ],
          d.kind || "fixed",
        ) +
        input(
          "startMonth",
          "Primer mes del gasto fijo",
          d.startMonth,
          "month",
          "required",
        )) +
    input(
      "dueDay",
      "Día de vencimiento",
      d.dueDay,
      "number",
      'required min="1" max="31"',
    );
  form(
    kind === "debt" ? "Deuda al inicio" : "Gasto fijo histórico",
    fields,
    async (f) =>
      changeDraft((draft) => {
        let value = {
          id: id || C.id(),
          name: f.name.trim(),
          dueDay: Number(f.dueDay),
          active: true,
        };
        if (kind === "debt") {
          const total = Number(f.totalPayments),
            prior = Number(f.priorPaid);
          if (!Number.isInteger(prior) || prior < 0 || prior > total)
            throw Error("Revisa las cuotas anteriores.");
          for (let i = 0; i < prior; i++)
            if (
              C.dueDate(
                C.addMonth(C.month(f.startDate), i),
                Number(f.dueDay),
              ) >= draft.config.startDate
            )
              throw Error(
                "Las cuotas dentro del periodo se registran como pagos, no como antecedentes.",
              );
          value = {
            ...value,
            type: total ? "loan" : "loan-open",
            creditorId: f.creditorId,
            balance: moneyValue(f.balance),
            originalAmount: moneyValue(f.originalAmount),
            payment: moneyValue(f.payment),
            totalPayments: total,
            startDate: f.startDate,
            paidPayments: Array.from({ length: prior }, (_, i) => i + 1),
            historicalPaidPayments: Array.from(
              { length: prior },
              (_, i) => i + 1,
            ),
            paidMonths: [],
            financingCost: 0,
            annualRate: 0,
            notes: "Creada en reconstrucción histórica",
            balanceMode: f.balanceMode,
          };
          if (value.payment <= 0)
            throw Error("La cuota debe ser mayor a cero.");
        } else {
          if (
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(f.startMonth) ||
            f.startMonth < C.month(draft.config.startDate) ||
            f.startMonth > C.month()
          )
            throw Error("Elige un mes dentro del periodo reconstruido.");
          value = {
            ...value,
            amount: moneyValue(f.amount),
            startMonth: f.startMonth,
            kind: f.kind,
          };
        }
        if (found)
          draft[list][draft[list].findIndex((x) => x.id === id)] = value;
        else draft[list].push(value);
      }),
  );
}

export function rebuildEntry(kind, id = "") {
  const old = model.rebuildDraft.entries.find((e) => e.id === id);
  const e = old || {
    name: "",
    amount: 0,
    date: model.rebuildDraft.config.startDate,
    accountId: "debit",
    toAccountId: "cash",
    categoryId: "",
  };
  if (old && ["debt", "fixed"].includes(old.kind)) {
    rebuildPayForm(old.obligation, old.period, old);
    return;
  }
  form(
    id
      ? "Corregir movimiento histórico"
      : "Registrar " + kindName(kind).toLowerCase(),
    input("name", "Concepto", e.name, "text", 'required maxlength="120"') +
      amount("amount", "Importe", e.amount) +
      input(
        "date",
        "Fecha real",
        e.date,
        "date",
        `required min="${model.rebuildDraft.config.startDate}" max="${C.today()}"`,
      ) +
      select(
        "accountId",
        kind === "income" ? "Recibir en" : "Origen",
        accountOptions(model.rebuildDraft),
        e.accountId,
      ) +
      (kind === "transfer"
        ? select(
            "toAccountId",
            "Destino",
            accountOptions(model.rebuildDraft),
            e.toAccountId,
          )
        : "") +
      (kind === "expense"
        ? select(
            "categoryId",
            "Categoría",
            [
              ["", "Sin categoría"],
              ...model.rebuildDraft.categories.map((c) => [c.id, c.name]),
            ],
            e.categoryId,
          )
        : ""),
    async (f) =>
      changeDraft((d) => {
        const value = {
          id: id || C.id(),
          kind,
          name: f.name.trim(),
          amount: moneyValue(f.amount),
          date: f.date,
          accountId: f.accountId,
          categoryId: f.categoryId || "",
          ...(kind === "transfer" ? { toAccountId: f.toAccountId } : {}),
        };
        if (old) d.entries[d.entries.findIndex((x) => x.id === id)] = value;
        else d.entries.push(value);
      }),
  );
}

export function chooseRebuildPayment(month) {
  model.rebuildPaymentMonth =
    month ||
    model.rebuildPaymentMonth ||
    C.month(model.rebuildDraft.config.startDate);
  const s = HistoryRebuild.build(model.rebuildDraft),
    items = C.obligations(s, model.rebuildPaymentMonth).filter((i) => !i.paid);
  modal(
    "Elegir compromiso histórico",
    input(
      "rebuildMonth",
      "Mes del compromiso",
      model.rebuildPaymentMonth,
      "month",
      `min="${C.month(model.rebuildDraft.config.startDate)}" max="${C.month()}"`,
    ) +
      `<p class="note">Selecciona la cuota; después indica la fecha en que pagaste realmente.</p>${items.map((i) => `<div class="item row"><span>${esc(i.name)}<br><small>${i.date} · Pendiente ${money(i.remaining)}</small></span>${icon("pay", "Registrar pago histórico", "rebuildPay", i.key, `data-period="${model.rebuildPaymentMonth}"`)}</div>`).join("") || empty("Sin pendientes", "Prueba otro mes o agrega primero un compromiso.")}`,
  );
}

export function rebuildPayForm(key, m, old) {
  const copy = C.clone(model.rebuildDraft);
  if (old) copy.entries = copy.entries.filter((e) => e.id !== old.id);
  const s = HistoryRebuild.build(copy),
    item = C.obligations(s, m).find((i) => i.key === key);
  if (!item)
    throw Error("No se encontró la cuota. Revisa primero su compromiso.");
  const d = s.debts.find((d) => d.id === item.ref);
  form(
    "Pago histórico: " + item.name,
    amount("amount", "Importe pagado", old?.amount || item.remaining) +
      select(
        "accountId",
        "Pagar desde",
        accountOptions(model.rebuildDraft),
        old?.accountId || "debit",
      ) +
      input(
        "date",
        "Fecha real de pago",
        old?.date || (item.date < C.today() ? item.date : C.today()),
        "date",
        `required min="${model.rebuildDraft.config.startDate}" max="${C.today()}"`,
      ) +
      (d?.balanceMode === "principal"
        ? amount("principal", "Parte que reduce capital", old?.principal || 0)
        : "") +
      `<p class="note">Compromiso de ${mlabel(m)}. El importe restante seguirá pendiente si registras un abono parcial.</p>`,
    async (f) =>
      changeDraft((draft) => {
        const value = {
          id: old?.id || C.id(),
          kind: item.kind,
          ref: item.ref,
          obligation: key,
          period: m,
          name: item.name,
          amount: moneyValue(f.amount),
          date: f.date,
          accountId: f.accountId,
          categoryId: "",
          ...(f.principal ? { principal: moneyValue(f.principal) } : {}),
        };
        if (old)
          draft.entries[draft.entries.findIndex((e) => e.id === old.id)] =
            value;
        else draft.entries.push(value);
      }),
  );
}

export function reviewRebuild() {
  if (model.rebuildDraft.baseRevision !== model.revision)
    throw Error(
      "Tus datos activos cambiaron. Exporta el borrador o crea otro para evitar perder cambios.",
    );
  const s = HistoryRebuild.build(model.rebuildDraft),
    b = C.balances(s);
  form(
    "Comparar con tus saldos de hoy",
    `<p>Calculado: ${s.walletAccounts.map((a) => esc(a.name) + " " + money(b[a.id])).join(" · ")}.</p><p class="note">Introduce lo que tienes realmente. No uses cifras estimadas para ocultar una diferencia.</p>` +
      s.walletAccounts
        .map((a) => signedField(a.id, a.name + " real hoy"))
        .join(""),
    async (f) => {
      const actual = Object.fromEntries(
        s.walletAccounts.map((a) => [a.id, signedMoney(f[a.id])]),
      );
      const result = HistoryRebuild.reconcile(model.rebuildDraft, actual);
      await saveDraft({ ...model.rebuildDraft, actual });
      form(
        "Confirmar reconstrucción",
        `<p>${result.matches ? "Los saldos coinciden." : "Hay diferencias por revisar:"}</p><div class="details">${s.walletAccounts.map((a) => `<div><small>Diferencia en ${esc(a.name)}</small>${money(result.differences[a.id])}</div>`).join("")}</div>` +
          (result.matches
            ? ""
            : select(
                "resolve",
                "Cómo resolver",
                [
                  ["review", "Volver para revisar movimientos"],
                  ["adjust", "Crear ajustes explícitos por las diferencias"],
                ],
                "review",
              )) +
          `<p class="note">Al confirmar reemplazarás los datos actuales, incluidas deudas y metas, por esta reconstrucción. La versión anterior quedará en Deshacer. Exporta un respaldo si deseas conservarla fuera de la app.</p>`,
        async (choice) => {
          if (!result.matches && choice.resolve !== "adjust") {
            closeModal();
            render();
            return;
          }
          if (model.rebuildDraft.baseRevision !== model.revision)
            throw Error(
              "Los datos activos cambiaron. No se aplicó la reconstrucción.",
            );
          const final = HistoryRebuild.reconcile(
            model.rebuildDraft,
            actual,
            !result.matches,
          );
          const pending = model.rebuildDraft;
          model.rebuildDraft = null;
          const ok = await commit(
            "Reconstrucción histórica confirmada",
            (target) => {
              Object.keys(target).forEach((k) => delete target[k]);
              Object.assign(target, final.state);
            },
          );
          if (!ok) {
            model.rebuildDraft = pending;
            return;
          }
          model.routes = [];
          model.tab = "home";
          render();
        },
        "Reemplazar datos con reconstrucción",
      );
    },
    "Comparar saldos",
  );
}

export async function reconstructionAction(a, id, el) {
  if (a === "rebuildStart") startRebuild();
  else if (a === "rebuildOpening") rebuildOpeningForm();
  else if (a === "rebuildDebt" || a === "rebuildFixed")
    rebuildDefinition(a === "rebuildDebt" ? "debt" : "fixed");
  else if (a === "rebuildDefinitionEdit")
    rebuildDefinition(el.dataset.kind, id);
  else if (a === "rebuildDefinitionDelete")
    form(
      "Quitar compromiso del borrador",
      "<p>Sus movimientos vinculados deben quitarse primero. Tus datos actuales no cambian.</p>",
      async () =>
        changeDraft((d) => {
          if (d.entries.some((e) => e.ref === id))
            throw Error("Este compromiso tiene pagos en el borrador.");
          const key = el.dataset.kind === "debt" ? "debts" : "fixedExpenses";
          d[key] = d[key].filter((x) => x.id !== id);
        }),
      "Quitar del borrador",
    );
  else if (a === "rebuildEntry") rebuildEntry(id);
  else if (a === "rebuildEntryEdit") {
    const e = model.rebuildDraft.entries.find((x) => x.id === id);
    rebuildEntry(e.kind, id);
  } else if (a === "rebuildEntryDelete")
    form(
      "Quitar movimiento del borrador",
      "<p>Se recalcularán los saldos del borrador. Los datos actuales permanecen intactos.</p>",
      async () =>
        changeDraft((d) => {
          d.entries = d.entries.filter((e) => e.id !== id);
        }),
      "Quitar del borrador",
    );
  else if (a === "rebuildPayment") chooseRebuildPayment();
  else if (a === "rebuildPay") rebuildPayForm(id, el.dataset.period);
  else if (a === "rebuildReview") reviewRebuild();
  else if (a === "rebuildExport")
    exportState(HistoryRebuild.build(model.rebuildDraft), "Melange-borrador");
  else if (a === "rebuildDiscard")
    form(
      "Descartar borrador",
      "<p>Se eliminará solo la reconstrucción sin confirmar. Tus datos activos no cambian. Esta eliminación del borrador no se puede deshacer.</p>",
      async () => {
        await saveDraft(null);
        backPage();
        toast("Borrador descartado; datos actuales conservados.");
      },
      "Descartar borrador",
    );
}
