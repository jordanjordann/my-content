/**
 * Node.js-only half of the production boot guard (#244), split out of
 * `instrumentation.ts` (#247 follow-up) so the Edge Runtime bundle of
 * `instrumentation.ts` never sees a `process.exit` reference. Next's
 * `next dev`/build-time module scanner statically walks every import in
 * `instrumentation.ts` for Node-only APIs when it produces the Edge bundle —
 * it does this regardless of the `NEXT_RUNTIME` runtime check, because that
 * check only affects which code path executes, not which code is present in
 * the file being scanned. Moving the Node-only logic into a separate file
 * that is only reached via a conditional dynamic `import()` (the documented
 * pattern: node_modules/next/dist/docs/01-app/02-guides/instrumentation.md,
 * "Importing runtime-specific code") keeps this file's Node APIs out of the
 * Edge bundle entirely, since Next code-splits dynamic imports instead of
 * inlining them.
 *
 * Verified against a real `docker run` (#244): a thrown/rejected `register()`
 * is logged by Next's standalone `server.js` ("Failed to prepare server" /
 * `unhandledRejection`) but does NOT terminate the process — the container
 * stays "Up" and every request 500s forever instead of the container
 * exiting. That defeats the point of a boot guard (a platform healthcheck
 * would never go green, but nothing ever tells the platform to give up and
 * restart/roll back). Exit explicitly so the container actually stops.
 *
 * The dynamic `import` of `productionEnv` is inside this `try` on purpose: a
 * failed module resolution (the #241 tracing failure mode) rejects exactly
 * like a thrown `assertProductionEnv` and must hit the same
 * `process.exit(1)`, not reject uncaught.
 */
try {
  const { assertProductionEnv } = await import("./lib/server/env/productionEnv");
  assertProductionEnv();
} catch (error) {
  console.error(error);
  process.exit(1);
}

// Marks this file as an ES module so top-level `await` above is permitted.
export {};
