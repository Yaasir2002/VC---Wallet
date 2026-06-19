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