import { getPinLockStatus, refreshSession, verifyPin } from '../Storage/authStorage';
import { markSystemUIClosed, markSystemUIOpen } from '../utils/systemUIGuard';

export type WalletAuthResult = { success: boolean; reason?: string };

export async function isWalletBiometricAvailable(): Promise<boolean> {
  return false;
}

export async function authenticateWalletAccess(
  reason = 'Masukkan PIN wallet untuk melanjutkan.'
): Promise<WalletAuthResult> {
  const status = await getPinLockStatus();
  if (status.isLocked) return { success: false, reason: 'PIN terkunci. Coba lagi dalam 5 menit.' };
  markSystemUIOpen();
  let pin: string | null;
  try {
    pin = await requestPin(reason);
  } finally {
    markSystemUIClosed();
  }
  if (pin === null) return { success: false, reason: 'Autentikasi dibatalkan.' };
  if (!await verifyPin(pin.trim())) return { success: false, reason: 'PIN wallet salah.' };
  await refreshSession();
  return { success: true };
}

function requestPin(reason: string): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    const form = document.createElement('form');
    form.method = 'dialog';
    const label = document.createElement('label');
    label.textContent = reason;
    const input = document.createElement('input');
    input.type = 'password';
    input.inputMode = 'numeric';
    input.maxLength = 6;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'PIN Wallet');
    label.append(document.createElement('br'), input);
    const confirm = document.createElement('button');
    confirm.textContent = 'Konfirmasi';
    confirm.value = 'confirm';
    const cancel = document.createElement('button');
    cancel.textContent = 'Batal';
    cancel.type = 'button';
    cancel.onclick = () => dialog.close();
    form.append(label, document.createElement('br'), confirm, cancel);
    dialog.append(form);
    dialog.style.cssText = 'padding:24px;border:1px solid #CBD5E1;border-radius:12px;max-width:90vw';
    dialog.onclose = () => {
      resolve(dialog.returnValue === 'confirm' ? input.value : null);
      dialog.remove();
    };
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
  });
}
