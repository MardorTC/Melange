import C from "../domain/finance.js";

export const model = {
  rebuildDraft: null,
  revision: 0,
  routes: [],
  rebuildPaymentMonth: "",
  state: undefined,
  history: [],
  tab: "home",
  sub: "all",
  debtSub: "owe",
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
  showFilters: false,
};
