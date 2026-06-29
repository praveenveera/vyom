// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild CLI — Output helper tests
// ─────────────────────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import { dim, bold, cyan, green, yellow, red, info, success, warn, error, header, table, fatal } from './output.js';

// ── ANSI helpers ──────────────────────────────────────────────────────────────

describe('ANSI colour helpers', () => {
  it('dim wraps text with dim escape', () => {
    expect(dim('x')).toBe('\x1b[2mx\x1b[0m');
  });

  it('bold wraps text with bold escape', () => {
    expect(bold('x')).toBe('\x1b[1mx\x1b[0m');
  });

  it('cyan wraps text with cyan escape', () => {
    expect(cyan('x')).toBe('\x1b[36mx\x1b[0m');
  });

  it('green wraps text with green escape', () => {
    expect(green('x')).toBe('\x1b[32mx\x1b[0m');
  });

  it('yellow wraps text with yellow escape', () => {
    expect(yellow('x')).toBe('\x1b[33mx\x1b[0m');
  });

  it('red wraps text with red escape', () => {
    expect(red('x')).toBe('\x1b[31mx\x1b[0m');
  });
});

// ── Print helpers ─────────────────────────────────────────────────────────────

describe('print helpers', () => {
  let stdoutWrite: ReturnType<typeof jest.fn<typeof process.stdout.write>>;
  let stderrWrite: ReturnType<typeof jest.fn<typeof process.stderr.write>>;

  beforeEach(() => {
    stdoutWrite = jest.fn<typeof process.stdout.write>().mockReturnValue(true);
    stderrWrite = jest.fn<typeof process.stderr.write>().mockReturnValue(true);
    jest.spyOn(process.stdout, 'write').mockImplementation(stdoutWrite);
    jest.spyOn(process.stderr, 'write').mockImplementation(stderrWrite);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('info() writes to stdout', () => {
    info('hello');
    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const arg = (stdoutWrite.mock.calls[0] as [string])[0];
    expect(arg).toContain('hello');
  });

  it('success() writes to stdout', () => {
    success('ok');
    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const arg = (stdoutWrite.mock.calls[0] as [string])[0];
    expect(arg).toContain('ok');
  });

  it('warn() writes to stderr', () => {
    warn('careful');
    expect(stderrWrite).toHaveBeenCalledTimes(1);
    const arg = (stderrWrite.mock.calls[0] as [string])[0];
    expect(arg).toContain('careful');
  });

  it('error() writes to stderr', () => {
    error('bad');
    expect(stderrWrite).toHaveBeenCalledTimes(1);
    const arg = (stderrWrite.mock.calls[0] as [string])[0];
    expect(arg).toContain('bad');
  });

  it('header() writes title and underline to stdout', () => {
    header('Title');
    const output = (stdoutWrite.mock.calls[0] as [string])[0];
    expect(output).toContain('Title');
    expect(output).toContain('─');
  });

  it('table() aligns key column and prints values', () => {
    table([
      ['short', 'v1'],
      ['a longer key', 'v2'],
    ]);
    const output = (stdoutWrite.mock.calls as unknown as [string][][]).map(c => c[0]).join('');
    expect(output).toContain('short');
    expect(output).toContain('a longer key');
    expect(output).toContain('v1');
    expect(output).toContain('v2');
  });

  it('table() pads shorter keys to align columns', () => {
    table([
      ['ab', 'x'],
      ['abcdef', 'y'],
    ]);
    const lines = (stdoutWrite.mock.calls as unknown as [string][][]).map(c => c[0]);
    expect(lines[0]).toContain('ab    ');  // padded to 6
  });
});

// ── fatal ─────────────────────────────────────────────────────────────────────

describe('fatal()', () => {
  it('calls process.exit(1)', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error('process.exit called');
    });
    jest.spyOn(process.stderr, 'write').mockReturnValue(true);

    expect(() => fatal('boom')).toThrow('process.exit called');

    exitSpy.mockRestore();
  });
});
