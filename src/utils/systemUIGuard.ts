/**
 * systemUIGuard.ts
 *
 * A module-level flag to tell the AppState change handler when the app has
 * gone to the background because of an in-app system UI overlay (e.g. image
 * picker, camera permission dialog, biometric prompt) — rather than the user
 * actually leaving the app.
 *
 * Problem:
 *   On Android, when expo-image-picker opens the gallery, the app state
 *   transitions to 'background'. The AppState change handler in _layout.tsx
 *   interprets this as the user leaving the app and calls lockSession().
 *   When the gallery closes and the user returns, their session is locked and
 *   they get redirected to the unlock screen.
 *
 * Solution:
 *   Before opening any system UI that causes a background state transition,
 *   call markSystemUIOpen(). In the AppState handler, skip lockSession() if
 *   the guard is active. After the system UI closes, call markSystemUIClosed()
 *   and refreshSession() to ensure the session stays alive.
 *
 * Usage:
 *   import { markSystemUIOpen, markSystemUIClosed } from '../utils/systemUIGuard';
 *
 *   markSystemUIOpen();
 *   try {
 *     const result = await ImagePicker.launchImageLibraryAsync(...);
 *   } finally {
 *     markSystemUIClosed();
 *   }
 */

let _isSystemUIOpen = false;

/**
 * Call BEFORE opening any system UI that causes AppState to go 'background'
 * (image picker, camera roll, share sheet, etc.)
 */
export function markSystemUIOpen(): void {
  _isSystemUIOpen = true;
}

/**
 * Call AFTER the system UI has closed (in a finally block to guarantee it runs).
 */
export function markSystemUIClosed(): void {
  _isSystemUIOpen = false;
}

/**
 * Returns true if a system UI is currently open.
 * Used by the AppState handler to skip lockSession().
 */
export function isSystemUIOpen(): boolean {
  return _isSystemUIOpen;
}
