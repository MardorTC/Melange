import test from "node:test";
import assert from "node:assert/strict";
import {
  operationTrace,
  traceOperation,
} from "../app/src/main/assets/js/state/operation-trace.js";

test("operation diagnostics are bounded metadata and defensive copies", () => {
  for (let n = 0; n < 120; n++) traceOperation("undo", "start", n);
  const trace = operationTrace();
  assert.equal(trace.length, 100);
  assert.equal(trace[0].revision, 20);
  assert.deepEqual(Object.keys(trace[0]).sort(), [
    "id",
    "operation",
    "phase",
    "revision",
    "time",
  ]);
  trace[0].phase = "mutated";
  assert.equal(operationTrace()[0].phase, "start");
});
