# 🆔 NF Identity ID

**NF Identity ID** adalah aplikasi **Mobile Identity Wallet** berbasis **Self-Sovereign Identity (SSI)** yang dikembangkan menggunakan **React Native** dan **Expo**.

Aplikasi ini membantu pengguna mengelola identitas digital secara mandiri melalui fitur **Wallet**, **DID**, **Verifiable Credential (VC)**, **Verifiable Presentation (VP)**, **QR Scanner**, dan **Verifier**.

---

## 📌 Status Project

Project ini dikembangkan sebagai bagian dari tugas akhir:

> Implementasi Antarmuka Pengguna Mobile Identity Wallet Berbasis Self-Sovereign Identity Menggunakan React Native

| Keterangan | Detail |
|---|---|
| Nama Aplikasi | NF Identity ID |
| Platform | Android |
| Framework | React Native + Expo |
| Fokus | Frontend / Client-Side Wallet |
| Pengembang | Yaasir Aidil Fitrah |
| Institusi | STT Terpadu Nurul Fikri |

---

## ✨ Fitur Utama

- 🔐 Membuat dan mengelola **wallet identitas digital**
- 🧩 Membuat dan memulihkan wallet dengan **recovery phrase**
- 🔑 Mengamankan wallet menggunakan **PIN** dan **biometric authentication**
- 🌐 Membuat dan menampilkan **Decentralized Identifier (DID)**
- 🎓 Menerima, menyimpan, melihat, dan menghapus **Verifiable Credential (VC)**
- 📄 Membuat **Verifiable Presentation (VP)**
- 📷 Memindai QR Code credential atau presentation
- ✅ Melakukan verifikasi **VC** dan **VP**
- 🛡️ Menyimpan data secara lokal dan aman

---

## 🧠 Konsep Self-Sovereign Identity

**Self-Sovereign Identity (SSI)** adalah konsep identitas digital yang memberikan kendali kepada pengguna atas identitas dan credential miliknya sendiri.

| Peran | Fungsi |
|---|---|
| Holder | Pengguna yang memiliki wallet dan credential |
| Issuer | Pihak yang menerbitkan credential |
| Verifier | Pihak yang memverifikasi credential atau presentation |

---

## 🛠️ Teknologi

Project ini menggunakan:

- React Native
- Expo
- Expo Router
- TypeScript
- Expo Camera
- Expo Secure Store
- Expo File System
- Expo Local Authentication
- did-jwt
- did-jwt-vc
- jose
- bip39
- React Navigation

---

## 📱 Alur Aplikasi

```text
Buka Aplikasi
↓
Buat Wallet
↓
Simpan Recovery Phrase
↓
Buat PIN
↓
Masuk Dashboard
↓
Kelola Credential
↓
Scan QR Code
↓
Buat VP
↓
Verifikasi VC / VP
```

---

## ⚙️ Instalasi

Clone repository:

```bash
git clone <URL_REPOSITORY>
```

Masuk ke folder project:

```bash
cd VC---Wallet
```

Install dependency:

```bash
npm install
```

Jalankan aplikasi:

```bash
npm start
```

Atau:

```bash
npx expo start
```

Jalankan di Android:

```bash
npm run android
```

---

## 📜 Script

| Perintah | Fungsi |
|---|---|
| `npm start` | Menjalankan Expo |
| `npm run android` | Menjalankan aplikasi di Android |
| `npm run web` | Menjalankan aplikasi versi web |
| `npm run lint` | Mengecek kualitas kode |
| `npm run typecheck` | Mengecek TypeScript |
| `npm test` | Menjalankan testing |

---

## 🔒 Catatan Keamanan

- Jangan membagikan **recovery phrase** kepada siapa pun.
- Gunakan **PIN** yang aman.
- Aktifkan biometrik jika perangkat mendukung.
- Pastikan QR Code berasal dari sumber terpercaya.
- Simpan credential hanya dari issuer yang valid.

---

## 👨‍💻 Pengembang

**Yaasir Aidil Fitrah**  
Program Studi Teknik Informatika  
STT Terpadu Nurul Fikri

---

## 📝 Lisensi

Project ini dikembangkan untuk kebutuhan tugas akhir dan dokumentasi aplikasi **NF Identity ID**.

---

## Versi Web dan Vercel

Versi web menggunakan Expo Router sebagai single-page application. Konfigurasi
build, output `dist`, dan fallback route berada di `vercel.json`.

```bash
npm ci
npm run typecheck
npm test -- --runInBand
npm run build:web
npx expo serve --port 8081
```

Untuk deploy dari terminal yang sudah login Vercel:

```bash
npx vercel login
npx vercel --prod
```

Atau impor repository melalui dashboard Vercel. Gunakan build command
`npm run build:web` dan output directory `dist`. Tidak diperlukan environment
variable atau private key issuer untuk menjalankan frontend wallet.
Folder `issuer-output`, file environment, dan konfigurasi lokal dikecualikan
dari upload melalui `.vercelignore`.

### Penyimpanan dan autentikasi web

- Profil, mnemonic, private key wallet, dan credential dienkripsi menggunakan
  AES-256-GCM di IndexedDB. Kunci enkripsi browser tidak dapat diekspor melalui
  Web Crypto, tetapi script pada origin yang sama masih dapat menggunakannya.
  Perlindungan ini tidak setara dengan Android Keystore/iOS Keychain.
- Gunakan versi web untuk demo dengan data uji. PIN mengontrol akses melalui
  aplikasi; PIN bukan kunci enkripsi database browser.
- Reload halaman mengunci sesi; operasi sensitif meminta PIN wallet dengan
  input tersembunyi. Biometrik native tetap tersedia hanya di Android/iOS.
- Penyimpanan terpisah untuk setiap browser dan origin. Menghapus data browser
  menghapus credential lokal. Recovery phrase memulihkan identitas dan kunci,
  bukan file credential atau profil.
- Kamera dan Web Crypto memerlukan HTTPS (atau localhost untuk pengembangan).
  Resolusi `did:web` memerlukan server issuer yang mengizinkan CORS.
- Implementasi native tetap memakai SecureStore dan file credential terenkripsi;
  berkas `.web.ts` dipilih hanya oleh build web.

### Pengujian browser

```bash
npx playwright install chromium
npm run test:web
```

Jalankan server lokal terlebih dahulu. Untuk menguji hasil deployment,
set environment variable `WALLET_TEST_URL` ke URL Vercel, lalu jalankan
`npm run test:web`. Pada PowerShell:

```powershell
$env:WALLET_TEST_URL = 'https://nama-project.vercel.app'
npm run test:web
```

Pengujian browser memakai wallet dan issuer fixture baru, bukan data pengguna.
Pengujian mencakup onboarding, PIN, refresh, recovery phrase, profil, impor VC,
dan signature VP. DID Document issuer pada pengujian dimock; ketersediaan
issuer publik, izin kamera perangkat, dan biometrik native perlu diuji manual.
