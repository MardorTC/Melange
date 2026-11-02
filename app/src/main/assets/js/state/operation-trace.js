// Session-only diagnostics: never record amounts, names, book IDs or content.
const events = [];
let serial = 0;
export function traceOperation(operation, phase, revision, token) {
  const id = token ?? ++serial;
  events.push({ id, operation, phase, revision, time: Date.now() });
  if (events.length > 100) events.shift();
  return id;
}
export function operationTrace() {
  return events.map((event) => ({ ...event }));
}
