/**
 * Production boot guard (#244). `register()` is called once when a new
 * Next.js server instance is initiated and must complete before the server
 * is ready to handle requests (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
 * That makes it the right place for a fail-fast environment check — it runs
 * at boot, never during `next build`. See `lib/server/env/productionEnv.ts`
 * for why the guard does NOT live in `lib/server/db.ts`.
 *
 * The `NEXT_RUNTIME` narrowing is the documented pattern for importing
 * runtime-specific code (node_modules/next/dist/docs/01-app/02-guides/instrumentation.md,
 * "Importing runtime-specific code" — the doc shows the pattern below for
 * code that "doesn't support specific runtimes"; it does not itself document
 * the static-scan mechanism explained next, which is this codebase's own
 * finding from the Edge Runtime warning below).
 *
 * The actual guard logic (including the Node-only `process.exit`) lives in
 * `./instrumentation-node` (PR #257), a separate file, and NOT inline here —
 * Next's Edge Runtime bundle of this file is built by statically scanning
 * its source for Node.js APIs, and it does that scan regardless of the
 * `NEXT_RUNTIME` check below (the check only affects which code path runs
 * at runtime, not what the bundler sees while building the Edge chunk). A
 * `process.exit` call written directly in this file trips that scan and
 * produces `A Node.js API is used (process.exit at line: N) which is not
 * supported in the Edge Runtime` even though the call is unreachable in the
 * Edge runtime. Keeping this file itself free of Node-only APIs, and only
 * reaching them through a conditional dynamic `import()`, is the fix — Next
 * code-splits dynamic imports rather than inlining them into the Edge
 * bundle, so `./instrumentation-node`'s `process.exit` reference is never
 * part of what gets scanned for the Edge chunk.
 *
 * `await import("./instrumentation-node")` below is wrapped in a `try`: a
 * failed module resolution here (a missed hop in `output: "standalone"`
 * tracing — the #241 failure mode, and this PR adds exactly one more hop to
 * the trace path: instrumentation.js -> instrumentation-node chunk ->
 * productionEnv chunk) would otherwise reject `register()` uncaught, and
 * #247 established by real `docker run` that an uncaught rejection there is
 * only logged by Next's standalone `server.js` — the container stays `Up`
 * and 500s forever instead of exiting, which is precisely the failure mode
 * this guard exists to prevent.
 *
 * `process.exit(1)` cannot be written directly in this `catch` — that
 * reintroduces the exact Edge warning this split fixes. A first attempt at
 * this reached `node:process`/`node:fs` via dynamic `import()` written
 * directly in this `catch` block, reasoning that Node **core** modules
 * aren't repo files `output: "standalone"` has to trace. That reasoning was
 * right about tracing but wrong about the Edge scanner: confirmed
 * empirically (`npm run dev`) that Next's Edge static scan flags any
 * `import("node:...")` **specifier literal** appearing anywhere in this
 * file's source ("A Node.js module is loaded ('node:fs' at line N) which is
 * not supported in the Edge Runtime"), regardless of whether that call is
 * inside the `NEXT_RUNTIME === "nodejs"` branch or reachable at all in the
 * Edge runtime — the scan is a source-text/AST scan of the whole file, not a
 * reachability analysis (consistent with, and reinforcing, the original
 * `process.exit` finding this split was built around).
 *
 * The fallback therefore lives in `./instrumentation-node-exit`, a third
 * file reached the same conditional-dynamic-import way as
 * `./instrumentation-node` itself, and deliberately self-contained (only
 * `node:fs`, no further repo imports) to keep its own tracing surface to one
 * minimal hop. Importing it can, in principle, still fail for the same
 * reason `./instrumentation-node` can — that residual gap is not closable
 * without putting `process.exit` directly in this file (which reintroduces
 * the Edge warning), so it is accepted and documented here rather than
 * silently assumed away. See `./instrumentation-node-exit` for the full
 * rationale.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { registerNode } = await import("./instrumentation-node");
      await registerNode();
    } catch (error) {
      const { exitWithBootFailure } = await import("./instrumentation-node-exit");
      exitWithBootFailure(error);
    }
  }
}
