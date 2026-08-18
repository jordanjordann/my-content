/**
 * Production boot guard (#244). `register()` is called once when a new
 * Next.js server instance is initiated and must complete before the server
 * is ready to handle requests (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
 * That makes it the right place for a fail-fast environment check — it runs
 * at boot, never during `next build`. See `lib/server/env/productionEnv.ts`
 * for why the guard does NOT live in `lib/server/db.ts`.
 *
 * The `NEXT_RUNTIME` narrowing is the documented pattern for importing
 * runtime-specific code (node_modules/next/dist/docs/01-app/02-guides/instrumentation.md).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Verified against a real `docker run` (#244): a thrown/rejected `register()`
  // is logged by Next's standalone `server.js` ("Failed to prepare server" /
  // `unhandledRejection`) but does NOT terminate the process — the container
  // stays "Up" and every request 500s forever instead of the container
  // exiting. That defeats the point of a boot guard (a platform healthcheck
  // would never go green, but nothing ever tells the platform to give up and
  // restart/roll back). Exit explicitly so the container actually stops.
  //
  // The dynamic `import` is inside this `try` on purpose: a failed module
  // resolution (the #241 tracing failure mode) rejects exactly like a thrown
  // `assertProductionEnv` and must hit the same `process.exit(1)`, not
  // reject `register()` uncaught.
  try {
    const { assertProductionEnv } = await import("./lib/server/env/productionEnv");
    assertProductionEnv();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
