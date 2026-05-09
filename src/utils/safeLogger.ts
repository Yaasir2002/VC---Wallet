import { redactSensitiveData } from './redactSensitiveData';

type LogPayload = Record<string, unknown> | unknown;

function isDevelopment(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function safePayload(payload?: LogPayload) {
  if (payload === undefined) {
    return undefined;
  }

  return redactSensitiveData(payload);
}

function writeConsole(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  payload?: LogPayload
) {
  if (!isDevelopment()) {
    return;
  }

  if (payload !== undefined) {
    console[level](message, safePayload(payload));
    return;
  }

  console[level](message);
}

export const safeLogger = {
  debug(message: string, payload?: LogPayload) {
    writeConsole('debug', message, payload);
  },

  info(message: string, payload?: LogPayload) {
    writeConsole('info', message, payload);
  },

  warn(message: string, payload?: LogPayload) {
    writeConsole('warn', message, payload);
  },

  error(message: string, payload?: LogPayload) {
    writeConsole('error', message, payload);
  },
};