import type { TerminalHistoryEntry } from './types';

const SENSITIVE_PATTERNS: Array<RegExp> = [
  /[A-Za-z0-9_]*(password|passwd|pass|pwd|secret|token|apikey|api_key|auth_token)[A-Za-z0-9_]*\s*[:=]\s*\S+/gi,
  /(--password|--pass|--token|--secret|--api-key|-p)\s+\S+/gi,
  /\bBearer\s+[A-Za-z0-9._-]+/gi,
  /\b(sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|xoxb-[0-9A-Za-z-]{12,})\b/g,
  /(https?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi,
  /\bcurl\b[^;\n]*\s(-u|--user)\s+\S+/gi,
];

export const TERMINAL_HISTORY_LIMIT = 20;

export function sanitizeTerminalCommand(rawCommand: string): {
  sanitized: string;
  redacted: boolean;
  excludeCompletely: boolean;
} {
  const trimmed = rawCommand.trim();
  if (!trimmed) {
    return { sanitized: '', redacted: false, excludeCompletely: true };
  }

  // Interactive password change commands should be scrubbed
  if (/^\s*(passwd|chpasswd|su\s+-c)\b/i.test(trimmed)) {
    return { sanitized: trimmed.split(/\s+/)[0] + ' [comando protegido]', redacted: true, excludeCompletely: false };
  }

  let sanitized = trimmed;
  let redacted = false;

  for (const rx of SENSITIVE_PATTERNS) {
    rx.lastIndex = 0;
    const next = sanitized.replace(rx, (match) => {
      redacted = true;
      if (match.startsWith('http')) {
        return match.replace(/:\/\/[^@]+@/, '://[REDACTADO]@');
      }
      const eqIdx = match.indexOf('=');
      if (eqIdx !== -1) {
        return `${match.slice(0, eqIdx + 1)}[REDACTADO]`;
      }
      const spaceIdx = match.indexOf(' ');
      if (spaceIdx !== -1) {
        return `${match.slice(0, spaceIdx)} [REDACTADO]`;
      }
      return '[REDACTADO]';
    });
    sanitized = next;
  }

  return { sanitized, redacted, excludeCompletely: false };
}

export function isDangerousTerminalCommand(command: string): boolean {
  return /\b(rm\s+-rf|mkfs|dd\s+if=|shutdown|reboot|poweroff|chmod\s+-R\s+777|:(){)/i.test(command);
}

export function appendTerminalHistory(
  existing: TerminalHistoryEntry[],
  newEntry: TerminalHistoryEntry
): TerminalHistoryEntry[] {
  const { sanitized, redacted, excludeCompletely } = sanitizeTerminalCommand(newEntry.command);
  if (excludeCompletely) return existing.slice(0, TERMINAL_HISTORY_LIMIT);

  const normalized: TerminalHistoryEntry = {
    ...newEntry,
    command: sanitized,
    redacted,
  };

  return [normalized, ...existing].slice(0, TERMINAL_HISTORY_LIMIT);
}
