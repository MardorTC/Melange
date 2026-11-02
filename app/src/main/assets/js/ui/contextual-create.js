import C from "../domain/finance.js";
import { parseMoney } from "../domain/money-input.js";
import { model } from "../state/model.js";
import { esc, showError, toast, money, dlabel } from "./components.js";

// New categories/accounts are created in the same commit as the form that
// needed them. That keeps the original draft intact and avoids half-written
// operations. Accounts only materialize when the form actually uses them, so
// merely opening the helper can never change a balance.
const CATEGORY_PREFIX = "pending:category:";
const ACCOUNT_PREFIX = "pending:account:";
const registries = new WeakMap();

const registryFor = (form) => {
  let registry = registries.get(form);
  if (!registry) {
    registry = { categories: new Map(), accounts: new Map() };
    registries.set(form, registry);
  }
  return registry;
};

const isCategory = (value) => String(value || "").startsWith(CATEGORY_PREFIX);
const isAccount = (value) => String(value || "").startsWith(ACCOUNT_PREFIX);
const tempId = (prefix) => prefix + C.id();
const validName = (name) =>
  typeof name === "string" &&
  name.trim() === name &&
  name.length > 0 &&
  name.length <= 80;
const validAccountSpec = (spec) =>
  spec &&
  validName(spec.name) &&
  ["cash", "bank", "restricted"].includes(spec.type) &&
  Number.isSafeInteger(spec.opening) &&
  Math.abs(spec.opening) <= 1e14 &&
  C.validDate(spec.openingDate) &&
  spec.openingDate <= C.today();
const accountLabel = (spec) =>
  `${spec.name} · ${typeName(spec.type)} · saldo inicial ${money(spec.opening)} al ${dlabel(spec.openingDate)}`;

const typeName = (type) =>
  ({
    cash: "Efectivo",
    bank: "Cuenta bancaria",
    restricted: "Uso restringido / vales",
  })[type] || "Cuenta bancaria";

function selectNamed(form, name) {
  return [...(form?.querySelectorAll("select") || [])].find(
    (select) => select.name === name,
  );
}

function addOption(select, value, text) {
  if (!select || [...select.options].some((option) => option.value === value))
    return;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  option.dataset.pendingCatalog = "1";
  select.append(option);
}

function existingCategory(name) {
  return model.state.categories.find(
    (category) =>
      category.name.toLocaleLowerCase("es-MX") ===
      name.toLocaleLowerCase("es-MX"),
  );
}

function existingAccount(name, registry) {
  return (
    model.state.walletAccounts.find(
      (account) =>
        account.name.toLocaleLowerCase("es-MX") ===
        name.toLocaleLowerCase("es-MX"),
    ) ||
    [...registry.accounts.values()].find(
      (account) =>
        account.name.toLocaleLowerCase("es-MX") ===
        name.toLocaleLowerCase("es-MX"),
    )
  );
}

export function categoryCreateControl(target = "categoryId") {
  return `<div class="contextual-create" data-contextual-kind="category" data-contextual-target="${esc(target)}">
    <button type="button" class="btn link-btn" data-contextual-action="start" aria-expanded="false">+ Nueva categoría</button>
    <div data-contextual-panel hidden>
      <label>Nombre de la nueva categoría<input name="__ctx_${esc(target)}_name" data-contextual-field="name" type="text" maxlength="80" autocomplete="off"></label>
      <div class="actions"><button type="button" class="btn primary" data-contextual-action="add">Agregar y seleccionar</button><button type="button" class="btn" data-contextual-action="cancel">Cancelar</button></div>
      <p class="note">Se guardará junto con este formulario. Si cancelas la operación completa, no se crea la categoría.</p>
    </div>
  </div>`;
}

export function accountCreateControl(target = "accountId") {
  return `<div class="contextual-create" data-contextual-kind="account" data-contextual-target="${esc(target)}">
    <button type="button" class="btn link-btn" data-contextual-action="start" aria-expanded="false">+ Nueva cuenta</button>
    <div data-contextual-panel hidden>
      <label>Nombre de la nueva cuenta<input name="__ctx_${esc(target)}_name" data-contextual-field="name" type="text" maxlength="80" autocomplete="off"></label>
      <label>Tipo<select name="__ctx_${esc(target)}_type" data-contextual-field="type"><option value="bank">Cuenta bancaria</option><option value="cash">Efectivo</option><option value="restricted">Uso restringido / vales</option></select></label>
      <label>Saldo actual (no es un ingreso)<input name="__ctx_${esc(target)}_opening" data-contextual-field="opening" type="text" inputmode="decimal" data-money="1" placeholder="0.00" value="0"></label>
      <div class="actions"><button type="button" class="btn primary" data-contextual-action="add">Agregar y seleccionar</button><button type="button" class="btn" data-contextual-action="cancel">Cancelar</button></div>
      <p class="note">La cuenta se creará junto con este movimiento. Su saldo inicial no se registrará como ingreso ni como gasto.</p>
    </div>
  </div>`;
}

export function afterSelect(html, name, control) {
  const start = html.indexOf(`name="${name}"`);
  if (start < 0) return html;
  const end = html.indexOf("</label>", start);
  if (end < 0) return html;
  return html.slice(0, end + 8) + control + html.slice(end + 8);
}

function panelFor(button) {
  return button.closest("[data-contextual-kind]");
}

function resetPanel(wrapper) {
  const panel = wrapper.querySelector("[data-contextual-panel]");
  if (panel) panel.hidden = true;
  const button = wrapper.querySelector('[data-contextual-action="start"]');
  if (button) button.setAttribute("aria-expanded", "false");
  for (const input of wrapper.querySelectorAll("[data-contextual-field]"))
    if (input.tagName !== "SELECT") input.value = "";
}

function startPanel(wrapper) {
  const panel = wrapper.querySelector("[data-contextual-panel]");
  if (!panel) return;
  panel.hidden = false;
  const button = wrapper.querySelector('[data-contextual-action="start"]');
  if (button) button.setAttribute("aria-expanded", "true");
  panel.querySelector('[data-contextual-field="name"]')?.focus();
}

function addCategory(panel, form) {
  const registry = registryFor(form),
    name = panel.querySelector('[data-contextual-field="name"]')?.value.trim();
  if (!name) throw Error("Escribe el nombre de la categoría.");
  if (name.length > 80) throw Error("El nombre es demasiado largo.");
  const select = selectNamed(form, panel.dataset.contextualTarget);
  if (!select) throw Error("No se encontró el selector de categoría.");
  const pending = [...registry.categories].find(
    ([, spec]) =>
      spec.name.toLocaleLowerCase("es-MX") === name.toLocaleLowerCase("es-MX"),
  );
  if (pending) {
    select.value = pending[0];
    toast("Esa categoría ya está en la lista; se seleccionó.");
    return;
  }
  const duplicate = existingCategory(name);
  if (duplicate) {
    select.value = duplicate.id;
    toast("Esa categoría ya existe; se seleccionó.");
    return;
  }
  const id = tempId(CATEGORY_PREFIX);
  registry.categories.set(id, { name });
  addOption(select, id, name);
  select.value = id;
  toast("Categoría lista. Se guardará con este formulario.");
}

function addAccount(panel, form) {
  const registry = registryFor(form),
    name = panel.querySelector('[data-contextual-field="name"]')?.value.trim();
  if (!name) throw Error("Escribe el nombre de la cuenta.");
  if (name.length > 80) throw Error("El nombre es demasiado largo.");
  if (existingAccount(name, registry))
    throw Error("Ya existe una cuenta con ese nombre.");
  const type =
    panel.querySelector('[data-contextual-field="type"]')?.value || "bank";
  if (!["cash", "bank", "restricted"].includes(type))
    throw Error("Elige un tipo de cuenta válido.");
  const rawOpening =
    panel.querySelector('[data-contextual-field="opening"]')?.value || "0";
  const opening = parseMoney(rawOpening, true);
  const select = selectNamed(form, panel.dataset.contextualTarget);
  if (!select) throw Error("No se encontró el selector de cuenta.");
  const id = tempId(ACCOUNT_PREFIX);
  registry.accounts.set(id, {
    name,
    type,
    opening,
    openingDate: C.today(),
  });
  addOption(select, id, accountLabel(registry.accounts.get(id)));
  select.value = id;
  toast("Cuenta lista. Se creará junto con este movimiento.");
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const field = event.target.closest?.(
    "[data-contextual-panel] input[data-contextual-field]",
  );
  if (!field) return;
  event.preventDefault();
  field
    .closest("[data-contextual-kind]")
    ?.querySelector('[data-contextual-action="add"]')
    ?.click();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-contextual-action]");
  if (!button) return;
  const panel = panelFor(button);
  if (!panel) return;
  event.preventDefault();
  const action = button.dataset.contextualAction;
  if (action === "start") {
    startPanel(panel);
    return;
  }
  if (action === "cancel") {
    resetPanel(panel);
    return;
  }
  if (action !== "add") return;
  const form = button.closest("form") || document.querySelector("#form");
  try {
    if (panel.dataset.contextualKind === "category") addCategory(panel, form);
    else addAccount(panel, form);
    resetPanel(panel);
    const select = selectNamed(form, panel.dataset.contextualTarget);
    select?.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (error) {
    showError(error.message);
  }
});

export function captureContextualStructure() {
  const form = document.querySelector("#form");
  if (!form) return null;
  const registry = registryFor(form);
  return {
    categories: [...registry.categories].map(([id, value]) => ({
      id,
      name: value.name,
    })),
    accounts: [...registry.accounts].map(([id, value]) => ({ id, ...value })),
    selects: [...form.querySelectorAll("select")]
      .map((select) => ({
        name: select.name,
        pending: [...select.options]
          .filter((option) => option.dataset.pendingCatalog)
          .map((option) => ({
            value: option.value,
            text: option.textContent,
          })),
      }))
      .filter((entry) => entry.name && entry.pending.length),
  };
}

export function restoreContextualStructure(structure) {
  const form = document.querySelector("#form");
  if (!form || !structure) return;
  const categories = structure.categories || [],
    accounts = structure.accounts || [],
    selects = structure.selects || [];
  if (
    !Array.isArray(categories) ||
    !Array.isArray(accounts) ||
    !Array.isArray(selects) ||
    categories.length > 100 ||
    accounts.length > 100 ||
    selects.length > 20 ||
    categories.some(
      (entry) =>
        !entry ||
        typeof entry.id !== "string" ||
        !isCategory(entry.id) ||
        entry.id.length > 120 ||
        !validName(entry.name),
    ) ||
    accounts.some(
      (entry) =>
        !entry ||
        typeof entry.id !== "string" ||
        !isAccount(entry.id) ||
        entry.id.length > 120 ||
        !validAccountSpec(entry),
    ) ||
    selects.some(
      (entry) =>
        !entry ||
        !["accountId", "toAccountId", "categoryId"].includes(entry.name) ||
        !Array.isArray(entry.pending) ||
        entry.pending.length > 100,
    )
  )
    throw Error(
      "El borrador contiene cuentas o categorías inválidas. Descártalo y vuelve a agregarlas.",
    );
  const names = new Set(
    model.state.walletAccounts.map((account) =>
      account.name.toLocaleLowerCase("es-MX"),
    ),
  );
  for (const account of accounts) {
    const key = account.name.toLocaleLowerCase("es-MX");
    if (names.has(key))
      throw Error(
        "El borrador contiene una cuenta con un nombre que ya existe. Descártalo y vuelve a agregarla.",
      );
    names.add(key);
  }
  const categoryIds = new Set(categories.map((entry) => entry.id));
  const accountIds = new Set(accounts.map((entry) => entry.id));
  if (
    categoryIds.size !== categories.length ||
    accountIds.size !== accounts.length
  )
    throw Error("El borrador contiene identificadores nuevos duplicados.");
  for (const entry of selects) {
    const ids = entry.name === "categoryId" ? categoryIds : accountIds;
    if (
      !selectNamed(form, entry.name) ||
      entry.pending.some((option) => !option || !ids.has(option.value))
    )
      throw Error("El borrador contiene una selección nueva inválida.");
  }
  // Validate the entire replacement before touching the active draft or DOM.
  const registry = registryFor(form);
  registry.categories.clear();
  registry.accounts.clear();
  for (const category of categories)
    registry.categories.set(category.id, { name: category.name });
  for (const account of accounts)
    registry.accounts.set(account.id, {
      name: account.name,
      type: account.type,
      opening: account.opening,
      openingDate: account.openingDate,
    });
  for (const option of form.querySelectorAll("option[data-pending-catalog]"))
    option.remove();
  for (const entry of selects) {
    const select = selectNamed(form, entry.name);
    for (const option of entry.pending) {
      const spec =
        entry.name === "categoryId"
          ? registry.categories.get(option?.value)
          : registry.accounts.get(option?.value);
      addOption(
        select,
        option.value,
        entry.name === "categoryId" ? spec.name : accountLabel(spec),
      );
    }
  }
}

export const contextualDraftOptions = () => ({
  captureStructure: captureContextualStructure,
  restoreStructure: restoreContextualStructure,
});

function categoryFor(s, name) {
  if (!validName(name)) throw Error("Revisa el nombre de la nueva categoría.");
  const normalized = name.toLocaleLowerCase("es-MX");
  let category = s.categories.find(
    (item) => item.name.toLocaleLowerCase("es-MX") === normalized,
  );
  if (!category) {
    category = { id: C.id(), name };
    s.categories.push(category);
  }
  return category;
}

function accountFor(s, spec) {
  if (!validAccountSpec(spec))
    throw Error("Revisa los datos de la nueva cuenta.");
  if (
    s.walletAccounts.some(
      (account) =>
        account.name.toLocaleLowerCase("es-MX") ===
        spec.name.toLocaleLowerCase("es-MX"),
    )
  )
    throw Error("Ya existe una cuenta con ese nombre.");
  const account = {
    id: C.id(),
    name: spec.name,
    type: spec.type,
    opening: spec.opening,
    openingDate: C.validDate(spec.openingDate) ? spec.openingDate : C.today(),
    active: true,
    allowedCategories: [],
  };
  if (account.type === "restricted") {
    let category = s.categories.find((item) =>
      /alimenta|despensa|supermerc/i.test(item.name),
    );
    if (!category) category = categoryFor(s, "Despensa");
    account.allowedCategories = [category.id];
  }
  s.walletAccounts.push(account);
  return account;
}

// Resolve temporary catalog identifiers inside the same domain commit as the
// original form. If the caller never used the helper, values pass through
// untouched. A dangling temporary id is rejected instead of being persisted.
export function applyContextualCreations(s, values) {
  const form = document.querySelector("#form");
  const registry = form ? registries.get(form) : null;
  if (!registry) return values;
  const next = { ...values };
  const categoryMap = new Map();
  for (const [id, spec] of registry.categories)
    if (id === values.categoryId)
      categoryMap.set(id, categoryFor(s, spec.name).id);
  const categoryId = values.categoryId;
  if (isCategory(categoryId)) {
    if (!categoryMap.has(categoryId))
      throw Error(
        "La categoría nueva ya no está disponible. Vuelve a agregarla.",
      );
    next.categoryId = categoryMap.get(categoryId);
  }
  const accountMap = new Map();
  for (const field of ["accountId", "toAccountId"]) {
    const id = values[field];
    if (!isAccount(id)) continue;
    if (!accountMap.has(id)) {
      const spec = registry.accounts.get(id);
      if (!spec)
        throw Error(
          "La cuenta nueva ya no está disponible. Vuelve a agregarla.",
        );
      accountMap.set(id, accountFor(s, spec).id);
    }
    next[field] = accountMap.get(id);
  }
  if (isAccount(next.accountId) || isAccount(next.toAccountId))
    throw Error("No se pudo crear la cuenta nueva.");
  return next;
}
