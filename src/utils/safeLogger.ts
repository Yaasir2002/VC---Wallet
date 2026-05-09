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

export const safeLogger = {
  debug(message: string, payload?: LogPayload) {
    if (!isDevelopment()) {
      return;
    }

    if (payload !== undefined) {
      console.debug(message, safePayload(payload));
      return;
    }

    console.debug(message);
  },

  info(message: string, payload?: LogPayload) {
    if (!isDevelopment()) {
      return;
    }

    if (payload !== undefined) {
      console.info(message, safePayload(payload));
      return;
    }

    console.info(message);
  },

  warn(message: string, payload?: LogPayload) {
    if (payload !== undefined) {
      console.warn(message, safePayload(payload));
      return;
    }

    console.warn(message);
  },

  error(message: string, payload?: LogPayload) {
    if (payload !== undefined) {
      console.error(message, safePayload(payload));
      return;
    }

    console.error(message);
  },
};