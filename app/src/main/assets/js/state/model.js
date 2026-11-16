import C from "../domain/finance.js";

export const model = {
  revision: 0,
  routes: [],
  // Pantallas de detalle: { kind, id } y las vistas que registra cada módulo.
  detail: null,
  detailViews: {},
  state: undefined,
  history: [],
  tab: "home",
  sub: "all",
  debtSub: "owe",
  accountSub: "wallet",
  calendarDay: "",
  period: C.month(),
  busy: false,
  formSubmit: null,
  toastTimer: undefined,
  importCandidate: null,
  filter: {
    q: "",
    from: C.month() + "-01",
    to: C.today(),
    category: "",
    accountId: "",
    kind: "",
    min: "",
    max: "",
  },
};
