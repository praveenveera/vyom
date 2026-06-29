// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild CLI — Output helpers
// ─────────────────────────────────────────────────────────────────────────────

export const dim  = (s: string) => `\x1b[2m${s}\x1b[0m`;
export const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
export const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
export const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
export const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

export function info(msg: string): void {
  process.stdout.write(`${cyan('ℹ')} ${msg}\n`);
}

export function success(msg: string): void {
  process.stdout.write(`${green('✓')} ${msg}\n`);
}

export function warn(msg: string): void {
  process.stderr.write(`${yellow('⚠')} ${msg}\n`);
}

export function error(msg: string): void {
  process.stderr.write(`${red('✗')} ${msg}\n`);
}

export function header(title: string): void {
  process.stdout.write(`\n${bold(title)}\n${'─'.repeat(title.length)}\n`);
}

export function table(rows: [string, string][]): void {
  const maxKey = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) {
    process.stdout.write(`  ${dim(k.padEnd(maxKey))}  ${v}\n`);
  }
}

export function fatal(msg: string): never {
  error(msg);
  process.exit(1);
}
