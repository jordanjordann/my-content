import { writeSync } from "node:fs";

/**
 * Last-resort exit path for the production boot guard (#244), split out of
 * `instrumentation-node.ts` (PR #257 follow-up) so it can also be reached
 * from `instrumentation.ts` when *loading* `./instrumentation-node` itself
 * fails (a missed `output: "standalone"` tracing hop — the #241 failure
 * mode). See `instrumentation.ts` for why that boundary needs its own
 * fallback and cannot just call `process.exit(1)` inline.
 *
 * Deliberately self-contained: this file imports nothing from the repo, only
 * `node:fs` (a Node **core** module baked into the Node binary, not a repo
 * file `output: "standalone"` has to trace/bundle). That does not make this
 * file's own `import("./instrumentation-node-exit")` un-failable — Next
 * still has to trace and emit this one small chunk — but it minimizes the
 * remaining risk to a single self-contained hop with no further transitive
 * repo imports, which is the practical floor: closing this boundary
 * completely would require putting `process.exit` directly in
 * `instrumentation.ts`, which reintroduces the Edge Runtime warning this
 * split exists to avoid (confirmed empirically — Next's Edge static scan
 * flags any `import("node:...")` specifier appearing anywhere in
 * `instrumentation.ts`'s source, not just ones that execute in the Edge
 * runtime). If loading *this* file ever fails too, `register()` still
 * rejects uncaught and the container hangs `Up` serving 500s — that residual
 * gap is accepted and documented here rather than silently assumed closed.
 *
 * `writeSync(2, ...)` (not `console.error`): on piped stderr (Docker/
 * Railway, not a local TTY), `console.error`'s write is async and
 * `process.exit()` does not wait for it to flush — the process can exit
 * before the message reaches the log. `fs.writeSync` is a blocking syscall,
 * so the message is guaranteed to have left the process before `exit`.
 */
export function exitWithBootFailure(error: unknown): never {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  writeSync(2, `${message}\n`);
  process.exit(1);
}
