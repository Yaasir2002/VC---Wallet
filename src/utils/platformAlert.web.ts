import type { AlertButton, AlertOptions } from 'react-native';
import { markSystemUIClosed, markSystemUIOpen } from './systemUIGuard';

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], _options?: AlertOptions) {
    const text = [title, message].filter(Boolean).join('\n\n');
    const action = buttons?.find((button) => button.style !== 'cancel');
    const cancel = buttons?.find((button) => button.style === 'cancel');
    markSystemUIOpen();
    try {
      if (cancel) {
        if (window.confirm(text)) action?.onPress?.();
        else cancel.onPress?.();
      } else {
        window.alert(text);
        action?.onPress?.();
      }
    } finally {
      markSystemUIClosed();
    }
  },
};
