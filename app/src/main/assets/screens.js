"use strict";
// Extra state belongs to the save envelope, outside the user's active ledger.
let rebuildDraft = null,
  revision = 0,
  routes = [],
  rebuildPaymentMonth = "";
const fullScreens = ["timeline", "projection", "rebuild"];
function openPage(name) {
  if (tab !== name) routes.push({ tab, period, y: window.scrollY });
  tab = name;
  closeModal();
  render();
  window.scrollTo(0, 0);
}
function backPage() {
  const route = routes.pop() || { tab: "calendar", period: C.month(), y: 0 };
  tab = route.tab;
  period = route.period;
  closeModal();
  render();
  window.scrollTo(0, route.y);
}
function pageHeading(title, subtitle = "") {
  return `<div class="full-heading"><button class="btn back-btn" data-action="screenBack">${svg("back")} Volver</button><div><div class="eyebrow">${subtitle}</div><h1>${title}</h1></div></div>`;
}
function projectionPage() {
  const months = Array.from({ length: 12 }, (_, i) => C.addMonth(period, i));
  return (
    pageHeading("Proyección de 12 meses", "Una mirada al horizonte") +
    periodChooser() +
    `<p class="note">Presupuesto antes de variables: los pagos realizados siguen formando parte del compromiso mensual. No es un pronóstico de saldo bancario.</p><section class="card"><div class="scroll" tabindex="0" aria-label="Proyección de 12 meses"><table><thead><tr><th>Mes</th><th>Ingreso previsto</th><th>Fijos</th><th>Deudas</th><th>Libre antes de variables</th></tr></thead><tbody>${months
      .map((m) => {
        const v = C.metrics(state, m);
        return `<tr><td>${mlabel(m)}</td><td>${money(v.income)}</td><td>${money(v.fixed)}</td><td>${money(v.debt)}</td><td class="${v.budgetFree < 0 ? "bad" : "good"}">${money(v.budgetFree)}</td></tr>`;
      })
      .join("")}</tbody></table></div></section>`
  );
}
function timelinePage() {
  const year = period.slice(0, 4),
    months = Array.from(
      { length: 12 },
      (_, i) => year + "-" + String(i + 1).padStart(2, "0"),
    );
  const byMonth = months.map((m) => C.obligations(state, m));
  const refs = new Map();
  byMonth
    .flat()
    .forEach((i) =>
      refs.set(i.kind + ":" + i.ref, {
        ref: i.ref,
        kind: i.kind,
        name: i.name,
      }),
    );
  return (
    pageHeading("Timeline anual", "Los compromisos, en perspectiva") +
    `<div class="toolbar">${icon("back", "Año anterior", "timelineYear", "-1")}<h2 style="flex:1;text-align:center;margin:0">${year}</h2>${icon("back", "Año siguiente", "timelineYear", "1", 'style="transform:rotate(180deg)"')}</div><p class="note">Cobre: pagado · Arena: pendiente · Rayado: abono parcial. Desliza para explorar los meses.</p><section class="card"><div class="scroll" tabindex="0" aria-label="Timeline anual"><table class="timeline"><thead><tr><th>Compromiso</th>${months.map((m) => `<th>${mlabel(m)}</th>`).join("")}</tr></thead><tbody><tr><td>Total del mes</td>${byMonth.map((items) => `<td>${money(items.reduce((a, i) => a + i.amount, 0))}</td>`).join("")}</tr>${[
      ...refs.values(),
    ]
      .map(
        (r) =>
          `<tr><td>${esc(r.name)}<br><small>${r.kind === "debt" ? "Deuda" : "Gasto fijo"}</small></td>${byMonth
            .map((items) => {
              const i = items.find((i) => i.ref === r.ref && i.kind === r.kind);
              return `<td>${i ? `<span class="timeline-dot ${i.paid ? "paid" : i.recorded ? "partial" : ""}" title="${i.paid ? "Pagado" : "Pendiente: " + money(i.remaining)}">${money(i.amount)}</span>` : "—"}</td>`;
            })
            .join("")}</tr>`,
      )
      .join(
        "",
      )}</tbody></table></div>${refs.size ? "" : empty("Sin compromisos", "No hay cuotas ni gastos fijos para este año.")}</section>`
  );
}
function reconstructionSettings() {
  return `<section class="card"><div class="eyebrow">Tu historia, desde el principio</div><h2>Reconstrucción histórica</h2><p>Parte de los saldos de una fecha pasada y registra lo ocurrido hasta hoy. Trabaja en un borrador separado; tus datos actuales no cambian hasta confirmar.</p>${btn(rebuildDraft ? "Continuar borrador" : "Reconstruir meses anteriores", "rebuildStart", "", "full primary")}</section>`;
}
function signedMoney(value) {
  const raw = String(value ?? "").replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{0,2})?$/.test(raw))
    throw Error("Escribe un saldo con hasta dos decimales.");
  return C.cents(raw);
}
function signedField(name, label, value = "") {
  return input(
    name,
    label,
    value,
    "text",
    'inputmode="decimal" required placeholder="0.00"',
  );
}
async function saveDraft(next) {
  if (busy) throw Error("Espera a que termine el guardado.");
  busy = true;
  try {
    await writeStore({ state, history, draft: next, revision });
    rebuildDraft = next;
  } finally {
    busy = false;
  }
}
async function changeDraft(fn) {
  const next = C.clone(rebuildDraft);
  fn(next);
  HistoryRebuild.build(next); // Never save an inconsistent candidate.
  await saveDraft(next);
  closeModal();
  render();
  toast("Borrador guardado · Tus datos actuales no cambiaron");
}
function startRebuild() {
  if (rebuildDraft) {
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
      signedField("debit", "Débito al comenzar ese día") +
      signedField("cash", "Efectivo al comenzar ese día") +
      amount(
        "income",
        "Ingreso mensual previsto (0 si no lo sabes)",
        state.income,
      ),
    async (f) => {
      const next = HistoryRebuild.create(
        state,
        {
          startDate: f.startDate,
          debit: signedMoney(f.debit),
          cash: signedMoney(f.cash),
          income: moneyValue(f.income),
        },
        revision,
      );
      await saveDraft(next);
      rebuildPaymentMonth = "";
      openPage("rebuild");
    },
    "Crear borrador",
  );
}
function rebuildPage() {
  if (!rebuildDraft)
    return (
      pageHeading("Reconstrucción histórica") +
      empty("Sin borrador", "Vuelve a Ajustes para iniciar.")
    );
  let s;
  try {
    s = HistoryRebuild.build(rebuildDraft);
  } catch (e) {
    return (
      pageHeading("Borrador pendiente de revisión") +
      `<p>${esc(e.message)}</p>${btn("Descartar borrador", "rebuildDiscard", "", "danger")}`
    );
  }
  const b = C.balances(s),
    rows = C.ledgerEntries(s),
    stale = rebuildDraft.baseRevision !== revision;
  return (
    pageHeading("Reconstruir mi historia", "Borrador privado · Paso a paso") +
    `<p class="note">Desde ${rebuildDraft.config.startDate} hasta ${C.today()}. Se guarda al agregar o corregir cada dato; puedes salir y continuar después.</p>${stale ? '<div class="card danger-zone"><strong>Tus datos activos cambiaron después de iniciar.</strong><p>Para evitar sobrescribir cambios nuevos, este borrador no puede confirmarse. Puedes revisarlo, exportar su resultado o empezar otro.</p></div>' : ""}<div class="grid"><div class="card accent"><small>Débito reconstruido</small><div class="metric small">${money(b.debit)}</div></div><div class="card sage"><small>Efectivo reconstruido</small><div class="metric small">${money(b.cash)}</div></div></div><div class="toolbar wrap">${btn("Editar saldos iniciales", "rebuildOpening")}${btn("Comparar con hoy", "rebuildReview", "", "primary")}</div>
    <section class="card"><h2>1. Compromisos que ya existían</h2><p class="note">Usa el saldo de las deudas al inicio del periodo, no el saldo actual. Las cuotas anteriores a esa fecha se marcan como antecedentes sin volver a descontar dinero.</p><div class="toolbar wrap">${btn("Agregar deuda", "rebuildDebt")}${btn("Agregar gasto fijo", "rebuildFixed")}</div>${[...rebuildDraft.debts.map((d) => ({ ...d, entity: "debt" })), ...rebuildDraft.fixedExpenses.map((f) => ({ ...f, entity: "fixed" }))].map((d) => `<div class="item row"><span>${esc(d.name)}<br><small>${d.entity === "debt" ? "Saldo inicial: " + money(d.balance) : money(d.amount) + "/mes"}</small></span><div class="actions">${icon("edit", "Editar compromiso", "rebuildDefinitionEdit", d.id, `data-kind="${d.entity}"`)}${icon("trash", "Quitar compromiso del borrador", "rebuildDefinitionDelete", d.id, `data-kind="${d.entity}"`)}</div></div>`).join("")}</section>
    <section class="card"><h2>2. Lo que ocurrió</h2><div class="toolbar wrap">${btn("Gasto", "rebuildEntry", "expense")}${btn("Ingreso", "rebuildEntry", "income")}${btn("Transferencia", "rebuildEntry", "transfer")}${btn("Pagar compromiso", "rebuildPayment")}</div><p class="note">Puedes capturar en cualquier orden: el cálculo ordena por fecha. Los movimientos del mismo día conservan el orden de captura.</p><div class="rebuild-ledger">${rows.map((t) => `<div class="item"><div class="row"><div><strong>${esc(t.name)}</strong><p>${t.date} · ${kindName(t.kind)} · ${money(t.amount)}</p><small>Después: débito ${money(t.debit)} · efectivo ${money(t.cash)}</small></div><div class="actions">${icon("edit", "Corregir movimiento del borrador", "rebuildEntryEdit", t.id)}${icon("trash", "Quitar movimiento del borrador", "rebuildEntryDelete", t.id)}</div></div></div>`).join("") || empty("Aún sin movimientos", "Captura los ingresos, gastos y pagos desde la fecha inicial.")}</div></section>
    <section class="card"><h2>Liquidez reconstruida</h2>${lineChart(s.liquidityHistory)}<p class="note">Saldos calculados desde los movimientos, no observaciones bancarias. No se inventan gastos ni ingresos.</p></section><div class="toolbar wrap">${btn("Exportar resultado del borrador", "rebuildExport")}${btn("Descartar borrador", "rebuildDiscard", "", "danger")}</div>`
  );
}
function rebuildOpeningForm() {
  const c = rebuildDraft.config;
  form(
    "Saldos al inicio",
    `<p class="note">Fecha inicial: ${c.startDate}. Para cambiar el periodo crea otro borrador.</p>` +
      signedField("debit", "Débito inicial", c.debit / 100) +
      signedField("cash", "Efectivo inicial", c.cash / 100) +
      amount("income", "Ingreso mensual previsto", c.income),
    async (f) =>
      changeDraft((d) => {
        d.config.debit = signedMoney(f.debit);
        d.config.cash = signedMoney(f.cash);
        d.config.income = moneyValue(f.income);
      }),
  );
}
function rebuildDefinition(kind, id = "") {
  const list = kind === "debt" ? "debts" : "fixedExpenses",
    found = rebuildDraft[list].find((x) => x.id === id);
  const d = found || {
    name: "",
    balance: 0,
    payment: 0,
    amount: 0,
    totalPayments: 0,
    dueDay: 1,
    startDate: rebuildDraft.config.startDate,
    startMonth: C.month(rebuildDraft.config.startDate),
    paidPayments: [],
    originalAmount: 0,
  };
  const fields =
    input("name", "Nombre", d.name, "text", 'required maxlength="120"') +
    (kind === "debt"
      ? select(
          "accountId",
          "Acreedor",
          [
            ["", "Sin acreedor"],
            ...rebuildDraft.accounts.map((a) => [a.id, a.name]),
          ],
          d.accountId || "",
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
            accountId: f.accountId,
            balance: moneyValue(f.balance),
            originalAmount: moneyValue(f.originalAmount),
            payment: moneyValue(f.payment),
            totalPayments: total,
            startDate: f.startDate,
            paidPayments: Array.from({ length: prior }, (_, i) => i + 1),
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
function rebuildEntry(kind, id = "") {
  const old = rebuildDraft.entries.find((e) => e.id === id);
  const e = old || {
    name: "",
    amount: 0,
    date: rebuildDraft.config.startDate,
    method: "debit",
    to: "cash",
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
        `required min="${rebuildDraft.config.startDate}" max="${C.today()}"`,
      ) +
      select(
        "method",
        kind === "income" ? "Recibir en" : "Origen",
        methodOptions,
        e.method,
      ) +
      (kind === "transfer"
        ? select("to", "Destino", methodOptions, e.to)
        : "") +
      (kind === "expense"
        ? select(
            "categoryId",
            "Categoría",
            [
              ["", "Sin categoría"],
              ...rebuildDraft.categories.map((c) => [c.id, c.name]),
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
          method: f.method,
          categoryId: f.categoryId || "",
          ...(kind === "transfer" ? { to: f.to } : {}),
        };
        if (old) d.entries[d.entries.findIndex((x) => x.id === id)] = value;
        else d.entries.push(value);
      }),
  );
}
function chooseRebuildPayment(month) {
  rebuildPaymentMonth =
    month || rebuildPaymentMonth || C.month(rebuildDraft.config.startDate);
  const s = HistoryRebuild.build(rebuildDraft),
    items = C.obligations(s, rebuildPaymentMonth).filter((i) => !i.paid);
  modal(
    "Elegir compromiso histórico",
    input(
      "rebuildMonth",
      "Mes del compromiso",
      rebuildPaymentMonth,
      "month",
      `min="${C.month(rebuildDraft.config.startDate)}" max="${C.month()}"`,
    ) +
      `<p class="note">Selecciona la cuota; después indica la fecha en que pagaste realmente.</p>${items.map((i) => `<div class="item row"><span>${esc(i.name)}<br><small>${i.date} · Pendiente ${money(i.remaining)}</small></span>${icon("pay", "Registrar pago histórico", "rebuildPay", i.key, `data-period="${rebuildPaymentMonth}"`)}</div>`).join("") || empty("Sin pendientes", "Prueba otro mes o agrega primero un compromiso.")}`,
  );
}
function rebuildPayForm(key, m, old) {
  const copy = C.clone(rebuildDraft);
  if (old) copy.entries = copy.entries.filter((e) => e.id !== old.id);
  const s = HistoryRebuild.build(copy),
    item = C.obligations(s, m).find((i) => i.key === key);
  if (!item)
    throw Error("No se encontró la cuota. Revisa primero su compromiso.");
  const d = s.debts.find((d) => d.id === item.ref);
  form(
    "Pago histórico: " + item.name,
    amount("amount", "Importe pagado", old?.amount || item.remaining) +
      select("method", "Pagar desde", methodOptions, old?.method || "debit") +
      input(
        "date",
        "Fecha real de pago",
        old?.date || (item.date < C.today() ? item.date : C.today()),
        "date",
        `required min="${rebuildDraft.config.startDate}" max="${C.today()}"`,
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
          method: f.method,
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
function reviewRebuild() {
  if (rebuildDraft.baseRevision !== revision)
    throw Error(
      "Tus datos activos cambiaron. Exporta el borrador o crea otro para evitar perder cambios.",
    );
  const s = HistoryRebuild.build(rebuildDraft),
    b = C.balances(s);
  form(
    "Comparar con tus saldos de hoy",
    `<p>Calculado: débito <strong>${money(b.debit)}</strong> · efectivo <strong>${money(b.cash)}</strong>.</p><p class="note">Introduce lo que tienes realmente. No uses cifras estimadas para ocultar una diferencia.</p>` +
      signedField("debit", "Débito real hoy") +
      signedField("cash", "Efectivo real hoy"),
    async (f) => {
      const actual = { debit: signedMoney(f.debit), cash: signedMoney(f.cash) };
      const result = HistoryRebuild.reconcile(rebuildDraft, actual);
      await saveDraft({ ...rebuildDraft, actual });
      form(
        "Confirmar reconstrucción",
        `<p>${result.matches ? "Los saldos coinciden." : "Hay diferencias por revisar:"}</p><div class="details"><div><small>Diferencia en débito</small>${money(result.differences.debit)}</div><div><small>Diferencia en efectivo</small>${money(result.differences.cash)}</div></div>` +
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
          if (rebuildDraft.baseRevision !== revision)
            throw Error(
              "Los datos activos cambiaron. No se aplicó la reconstrucción.",
            );
          const final = HistoryRebuild.reconcile(
            rebuildDraft,
            actual,
            !result.matches,
          );
          const pending = rebuildDraft;
          rebuildDraft = null;
          const ok = await commit(
            "Reconstrucción histórica confirmada",
            (target) => {
              Object.keys(target).forEach((k) => delete target[k]);
              Object.assign(target, final.state);
            },
          );
          if (!ok) {
            rebuildDraft = pending;
            return;
          }
          routes = [];
          tab = "home";
          render();
        },
        "Reemplazar datos con reconstrucción",
      );
    },
    "Comparar saldos",
  );
}
async function reconstructionAction(a, id, el) {
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
    const e = rebuildDraft.entries.find((x) => x.id === id);
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
    exportState(HistoryRebuild.build(rebuildDraft), "Melange-borrador");
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
document.addEventListener("change", (e) => {
  if (e.target.name === "rebuildMonth") {
    const m = e.target.value;
    if (m < C.month(rebuildDraft.config.startDate) || m > C.month()) return;
    try {
      chooseRebuildPayment(m);
    } catch (error) {
      showError(error.message);
    }
  }
});
