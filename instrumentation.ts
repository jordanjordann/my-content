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
 * The actual guard logic (including the Node-only `process.exit`) lives in
 * `./instrumentation-node`, a separate file, and NOT inline here — Next's
 * Edge Runtime bundle of this file is built by statically scanning its
 * source for Node.js APIs, and it does that scan regardless of the
 * `NEXT_RUNTIME` check below (the check only affects which code path runs,
 * not what the bundler sees). A `process.exit` call written directly in this
 * file trips that scan and produces the Edge Runtime warning even though it
 * is unreachable in the Edge runtime. Keeping this file itself free of
 * Node-only APIs, and only reaching them through a conditional dynamic
 * `import()`, is the documented fix (see "Importing runtime-specific code"
 * in the doc above) — Next code-splits dynamic imports rather than inlining
 * them into the Edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
