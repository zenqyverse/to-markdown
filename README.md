# To Markdown

Konverter dokumen dan Markdown editor untuk web lokal serta Windows. Versi desktop terbaru: **1.3.0**. Installer: [To-Markdown-Setup-1.3.0-x64.exe](release-1.3.0/To-Markdown-Setup-1.3.0-x64.exe).

## Aplikasi Windows (.exe)

### Pembaruan online mulai versi 1.3.0

Pasang 1.3.0 secara manual sekali jika masih memakai 1.2.0. Aplikasi memeriksa rilis stabil dari [GitHub Releases](https://github.com/zenqyverse/to-markdown/releases) setelah dibuka; pemeriksaan juga tersedia melalui **Bantuan → Periksa pembaruan**. Unduhan dimulai setelah disetujui, dengan progres di judul jendela dan taskbar. Pemasangan meminta persetujuan dan hanya dilanjutkan jika dokumen telah disimpan ke file. Tidak ada pemasangan otomatis saat keluar aplikasi. Saat offline, editor tetap dapat dipakai.

Versi 1.3.0 belum memiliki sertifikat penerbit. `verifyUpdateCodeSignature: false` dinyatakan secara eksplisit untuk distribusi unsigned ini; checksum SHA-512 dan HTTPS tetap digunakan, tetapi bukan pengganti verifikasi identitas penerbit. Ketika sertifikat tersedia, aktifkan signing serta verifikasi tanda tangan dan rencanakan rilis transisi. Jangan menyertakan token GitHub dalam aplikasi.

Untuk rilis berikutnya: naikkan versi package, sesuaikan direktori output, build, lalu unggah `.exe`, `.exe.blockmap`, dan `latest.yml` bersama-sama ke GitHub Release stabil dengan tag versi yang sesuai. Pertahankan `appId` dan nama produk. QA/instalasi serta simulasi upgrade antarversi belum dijalankan pada 1.3.0; validasi rilis ini terbatas pada sintaks, build, dan kelengkapan artefak.

Installer `To-Markdown-Setup-1.3.0-x64.exe` ditujukan untuk Windows 10/11 64-bit. Jalankan installer (memerlukan izin administrator), lalu buka To Markdown dari Start Menu atau shortcut desktop. Node.js, npm, dan browser terpisah tidak diperlukan.

Untuk menjadikannya aplikasi default: klik kanan file `.md` → **Open with / Buka dengan** → **Choose another app / Pilih aplikasi lain** → **To Markdown** → **Always / Selalu**. Ulangi untuk `.markdown` jika digunakan. Installer mendaftarkan asosiasi; pilihan default tetap ditentukan pengguna melalui Windows.

Versi desktop menyediakan **Simpan**, **Simpan sebagai**, `Ctrl+S`, dan `Ctrl+Shift+S`. File yang dibuka dari Explorer diteruskan ke jendela aplikasi yang sudah berjalan. Perubahan file eksternal diperiksa sebelum menimpa. Simpan menggunakan UTF-8 dan penggantian file sementara secara atomik. Autosave draf tetap terpisah dari penyimpanan ke file asli. Aplikasi memperingatkan saat menutup dokumen yang belum disimpan ke file.

Server internal hanya mendengarkan `127.0.0.1` dan berjalan bersama aplikasi. Port pertama disimpan dalam konfigurasi pengguna agar autosave tetap dapat dipulihkan. Jika port tersebut dipakai aplikasi lain, tutup aplikasi yang memakai port itu lalu buka kembali To Markdown. Akselerasi GPU dinonaktifkan untuk kompatibilitas. Installer belum ditandatangani sertifikat penerbit, sehingga Windows dapat menampilkan **Unknown publisher** atau SmartScreen. Tidak ada perubahan otomatis pada aplikasi default pengguna.

Untuk membangun ulang: `npm ci`, kemudian `npm run dist`. Konfigurasi build berada di `electron-builder.json`, integrasi desktop di `desktop/main.cjs` dan `desktop/preload.cjs`. Installer berada di direktori output build. Untuk rilis 1.2.0, pemeriksaan terbatas pada sintaks dan keberhasilan build; QA serta instalasi tidak dijalankan.

## Markdown editor

Buka tab **Markdown editor** atau tekan **Edit di Markdown Editor** pada hasil konversi. Panel hasil konverter mengikuti tinggi panel upload di desktop; pratinjau/kode bergulir di dalam panel dan footer unduhan tetap di tempatnya. Pada layar kecil panel hasil memiliki tinggi terbatas.

Editor menyediakan heading 1–6, bold/italic/coret, kode inline, daftar, checklist, kutipan, garis pemisah, dialog tautan/gambar/tabel/blok kode, Mermaid, dan rumus KaTeX. Toolbar dikelompokkan dan membungkus sesuai lebar layar. Tersedia undo/redo, cari/ganti literal (termasuk ganti semua dan pencocokan huruf besar/kecil), outline, statistik, scroll sinkron, mode tulis/pratinjau/berdampingan, mode fokus, tema gelap, ukuran teks, pemeriksaan ejaan browser, serta template catatan/rapat/README/teknis.

**Penyimpanan:** autosave menyimpan satu draf beserta nama file dalam localStorage browser ini. Draf dipulihkan saat reload. Ini bukan penyimpanan cloud; hapus data browser berarti kehilangan draf. Jika kuota penuh, editor memberi pesan agar pengguna mengunduh salinan. Pengaturan menyediakan tombol hapus draf lokal yang juga menonaktifkan autosave. Mengganti dokumen yang berisi teks meminta konfirmasi. Perubahan draf dari tab lain menjeda autosave untuk menghindari penimpaan. `Ctrl/Cmd+S` mengunduh `.md`; undo/redo hanya berlaku selama sesi editor, bukan lintas reload.

**Teknis:** aset Mermaid, KaTeX, dan highlight.js disajikan dari npm lokal. Kode tidak dijalankan. Mermaid menggunakan mode strict; konfigurasi diagram dalam dokumen diabaikan. KaTeX tidak mengaktifkan trusted commands. HTML disanitasi; referensi gambar disimpan dalam Markdown tetapi media eksternal tidak dimuat. CSP tetap membatasi skrip ke origin sendiri; inline style diizinkan untuk tata letak KaTeX/Mermaid.

**Batas editor:** file UTF-8 atau UTF-16 BOM `.md`, `.markdown`, `.txt`, maksimum 5 MiB. Pratinjau dibatasi 200.000 karakter pertama (ditandai pada status), maksimum 10 diagram, 20.000 karakter dan 250 edge per diagram; teks unduhan tetap lengkap. Pencarian memakai teks literal, bukan regex. Penyorotan kode tersedia untuk bahasa bawaan highlight.js; bahasa lain tetap ditampilkan sebagai kode biasa. Markdown tambahan seperti footnote tidak didukung secara khusus. Scroll sinkron bersifat proporsional. Riwayat undo dibatasi sekitar 100 snapshot/16 MiB.

Kode editor berada di `public/editor.js`, `public/editor-core.js`, `public/editor-renderer.js`, `public/editor.css`; helper render/unduh di `public/markdown.js`. Tes logika editor berada di `test/editor.test.js`.

Aplikasi web lokal untuk mengubah **DOCX, PDF, TXT, HTML, XLSX, dan CSV** menjadi Markdown. Mendukung drag-and-drop, pemilihan file, progres upload, indikator konversi, pembatalan, pratinjau, tampilan kode, salin, dan unduh `.md`. Antarmuka dan pesan kesalahan menggunakan bahasa Indonesia.

## Instalasi dan menjalankan

Gunakan **Node.js 22.13+ atau 24 LTS** dan npm. Jalankan dari folder proyek:

```powershell
cd C:\To-MD-File
npm ci
npm start
```

Buka **http://127.0.0.1:3000**. Internet diperlukan untuk instalasi dependensi; aplikasi tidak membutuhkan CDN, akun, API key, database, atau layanan konversi eksternal setelah terpasang.

```sh
npm run dev   # restart backend otomatis saat kode berubah
npm test      # pengujian integrasi dengan fixture yang dibuat di memori
```

Jika port 3000 terpakai, gunakan PowerShell:

```powershell
$env:PORT = '3001'
npm start
```

Untuk macOS/Linux: `PORT=3001 npm start`. Alamat bind default adalah `127.0.0.1`; variabel `HOST` dapat diatur bila aplikasi memang akan dijalankan di jaringan atau container.

## Cara menggunakan

1. Letakkan satu dokumen pada area upload atau tekan **Pilih file**.
2. Tekan **Konversi ke Markdown**. Ukuran maksimum adalah **10 MiB** (10.485.760 byte), ditampilkan sebagai 10 MB di antarmuka.
3. Persentase menunjukkan byte upload yang sebenarnya. Setelah upload selesai, indikator menjadi indeterminate karena library konversi tidak menyediakan persentase pengerjaan yang seragam. Tidak ada progres konversi buatan.
4. Periksa tab **Pratinjau** atau **Kode Markdown**, kemudian tekan **Salin** atau **Unduh .md**.
5. Tombol **Coba dengan contoh dokumen** mengirim HTML contoh ke backend melalui alur konversi yang sama.

## Pilihan teknologi

| Komponen | Pilihan dan alasan |
| --- | --- |
| Frontend | HTML, CSS, JavaScript ES modules: tanpa bundler/framework, mudah diubah dan dijalankan. |
| HTTP server | Express: satu server untuk aset frontend dan API, sehingga tidak memerlukan konfigurasi CORS. |
| Upload | Multer `memoryStorage`: upload berbatas ukuran tanpa file sementara di disk. |
| DOCX | Mammoth → HTML → Turndown + plugin GFM untuk struktur dasar dan tabel. |
| PDF | PDF.js resmi Mozilla, mengekstrak teks per halaman. |
| TXT | `TextDecoder` bawaan Node, UTF-8 atau UTF-16 dengan BOM. |
| HTML | sanitize-html → Turndown + GFM. |
| XLSX | ExcelJS: membaca sheet dan nilai tersimpan tanpa menjalankan rumus. |
| CSV | csv-parse: memahami quoted fields, multiline, dan pemisah koma/titik koma/tab. |
| Pratinjau | Marked + DOMPurify, disajikan lokal dari dependensi npm. |
| Isolasi kerja | Worker thread per konversi, menjaga event loop HTTP responsif dan memungkinkan penghentian proses. |

Versi dependensi yang terpasang dikunci dalam `package-lock.json`. Gunakan `npm ci` untuk instalasi ulang yang konsisten.

`overrides` membatasi dependensi `uuid` milik ExcelJS ke seri 11 yang telah memperbaiki temuan audit pada versi lama dan tetap menyediakan API CommonJS `v4` yang digunakan ExcelJS. Library format dimuat sesuai kebutuhan agar konversi teks sederhana tidak menunggu inisialisasi parser PDF/Office.

## Struktur proyek

```text
To-MD-File/
├── package.json
├── package-lock.json
├── .gitignore
├── README.md
├── electron-builder.json      # nama aplikasi, ikon, NSIS dan lokasi output
├── desktop/
│   ├── main.cjs               # jendela, buka/simpan native, pembaruan manual
│   ├── preload.cjs            # jembatan terbatas antara UI dan Electron
│   ├── icon.ico               # logo proyek untuk Windows
│   └── build-icon.ps1         # pembuat ikon beberapa resolusi
├── examples/
│   └── catatan.txt              # dokumen contoh untuk upload manual
├── public/
│   ├── index.html              # UI responsif, kontrol upload dan hasil
│   ├── styles.css              # styling dasar konverter
│   ├── app.js                  # state UI, upload XHR, preview dan download
│   ├── theme.css               # palet global, font dan jumbotron ringkas
│   ├── theme.js                # dark/light mode dan penyimpanan preferensi
│   ├── fonts/                  # font lokal dan lisensi OFL
│   ├── editor.js               # editor, autosave dan integrasi desktop
│   ├── editor-core.js          # operasi teks
│   ├── editor-renderer.js      # render kode, Mermaid dan KaTeX
│   ├── editor.css              # layout editor
│   ├── markdown.js             # sanitasi preview dan unduhan
│   └── favicon.svg
├── shared/
│   └── formats.js              # allowlist MIME/ekstensi dan batas 10 MiB
├── server/
│   ├── index.js                # entry point HTTP, host/port dan timeout
│   ├── app.js                  # middleware, API, aset lokal, error handler
│   ├── converters.js           # konverter enam format
│   ├── validate-content.js     # validasi UTF dan struktur/dekompresi ZIP
│   ├── conversion-worker.js    # menjalankan konverter dalam worker
│   ├── run-conversion.js       # timeout, pembatalan, terminasi worker
│   └── errors.js               # kesalahan yang aman ditampilkan ke pengguna
└── test/
    ├── app.test.js             # pengujian integrasi HTTP dan batas sumber daya
    └── fixtures.js             # DOCX, PDF, XLSX sintetis; dibuat di memori
```

## API

`POST /api/convert`, `multipart/form-data`, tepat satu field file bernama `file`. Contoh PowerShell (`curl.exe`, bukan alias PowerShell):

```powershell
curl.exe -F "file=@catatan.docx" http://127.0.0.1:3000/api/convert
```

Respons sukses:

```json
{
  "markdown": "# Catatan\n",
  "filename": "catatan.md",
  "durationMs": 620,
  "warnings": []
}
```

Respons gagal berbentuk `{"error":"Pesan untuk pengguna"}`. Kode HTTP: `400` permintaan kosong/tidak valid, `413` upload terlalu besar, `415` tipe tidak didukung/tidak sesuai MIME, `422` isi rusak/tidak dapat dikonversi, `408` timeout, `503` kapasitas proses penuh. `GET /api/health` mengembalikan `{"status":"ok"}`.

## Validasi, privasi, dan penggunaan memori

- Batas ukuran dan allowlist ekstensi/MIME diterapkan pada klien dan server. MIME kosong atau `application/octet-stream` diizinkan karena dapat dikirim browser/OS; server tetap memeriksa isi. MIME hanyalah deklarasi, bukan bukti keaslian format.
- PDF diperiksa header dan parsernya. DOCX/XLSX harus berupa ZIP dengan struktur Office yang sesuai. Semua entri dibaca dengan validasi ukuran sebelum parser Office dijalankan. Teks harus lolos decoding Unicode dan pemeriksaan karakter biner.
- Tidak ada folder upload, file sementara, database, log isi dokumen, ataupun pengiriman dokumen ke layanan pihak ketiga. Multer menyimpan buffer di RAM; buffer aplikasi dihapus isinya dalam blok `finally` dan referensinya dilepas. Worker dihentikan setelah sukses, gagal, timeout, atau pembatalan. Alokasi internal library dibebaskan oleh runtime; ini bukan jaminan penghapusan forensik RAM atau swap OS.
- Respons API memakai `Cache-Control: no-store`. Hasil tetap berada di tab browser sampai diganti/dimuat ulang; file yang diunduh berada di perangkat pengguna.
- Preview menggunakan DOMPurify dan CSP. Konten aktif serta media jarak jauh tidak dirender. HTML/DOCX juga disanitasi di server. Markdown TXT dipertahankan sebagai teks asli; raw Markdown hasil download belum tentu aman jika dirender oleh aplikasi lain tanpa sanitasi.
- Maksimum dua upload/konversi aktif. Batas upload request 60 detik; konversi maksimal 30 detik. Worker mendapat batas heap JavaScript 256 MiB; batas ini **bukan** batas total RSS/native memory.
- Batas tambahan: ZIP Office 3.000 entri/50 MiB setelah dekompresi, PDF 200 halaman, tabel 10.000 baris/200 kolom/100.000 sel, dan output 5 MiB. Untuk XLSX, jumlah baris/sel dihitung lintas sheet. Dokumen yang melebihi batas ditolak, bukan diam-diam dipotong.
- Aplikasi ini ditujukan untuk penggunaan lokal atau trafik ringan. Untuk hosting publik, gunakan HTTPS, autentikasi bila diperlukan, pembatasan request per pengguna/IP, batas body/timeouts pada reverse proxy, serta limit RAM/CPU proses/container. Worker thread bukan sandbox untuk menjalankan kode tidak tepercaya.

## Batasan yang diketahui

- **PDF:** belum tersedia OCR. Scan tanpa teks menghasilkan pesan yang jelas. Urutan teks pada banyak kolom dapat kurang tepat; tabel, heading, gambar, dan rumus tidak direkonstruksi secara semantik. Halaman kosong diberi penanda. PDF berpassword ditolak.
- **DOCX:** struktur heading/list/bold/tabel dasar dipertahankan sejauh didukung Mammoth dan GFM. Tata letak halaman, warna, font, gambar, dan gaya kompleks tidak dipertahankan. Embedded style map dan akses file eksternal dinonaktifkan.
- **HTML:** script, CSS, form, iframe, dan gambar dihilangkan. Tabel kompleks atau tanpa header dapat berubah struktur. URL relatif tidak diubah menjadi URL absolut.
- **XLSX:** setiap sheet menjadi bagian Markdown; baris nonkosong pertama menjadi header. Baris kosong dilewati. Grafik, gambar, ukuran kolom, styling, dan semantik sel gabungan tidak dipertahankan. Rumus tidak dihitung; nilai cache yang hilang bisa kosong. Sheet tersembunyi juga disertakan.
- **CSV:** mendeteksi pemisah umum dari hingga sepuluh record awal; data ambigu bisa salah terdeteksi. Struktur baris yang tidak konsisten atau quoted fields rusak akan ditolak. Baris pertama menjadi header.
- **TXT:** tidak menebak heading/list dari teks biasa; isi dipertahankan dengan normalisasi line ending. Encoding selain UTF-8 dan UTF-16 BOM perlu dikonversi terlebih dahulu.
- File besar/kompleks memerlukan lebih banyak waktu dan memori. Waktu di footer termasuk startup worker dan konversi, tanpa waktu upload. Maksimum 5 MiB output tetap dapat membuat preview lambat pada perangkat terbatas.

## Pembaruan antarmuka web

- Konverter dan Markdown Editor memakai lebar ruang kerja yang sama, maksimum 1800 px. Pada desktop, kedua panel konverter sama lebar dan konten hasil bergulir di dalam panel.
- Jumbotron ringkas sekitar 170 px: “Dokumen jadi Markdown.” dan “Konversi, edit, dan unduh dalam satu tempat.”
- Tombol **Maximize** pada Hasil Markdown berlaku untuk Pratinjau dan Kode Markdown. Gunakan **Kembalikan** atau `Esc` untuk kembali; tombol unduh dan edit tetap tersedia.
- **Edit di Markdown Editor** membawa hasil konversi beserta nama file ke editor. Konfirmasi penggantian draf yang ada tetap berlaku.
- Tombol tema di header mengubah seluruh aplikasi antara gelap dan terang. Preferensi disimpan di browser dan disinkronkan dengan pengaturan tema editor.
- Palet charcoal/tosca dengan coral untuk kesalahan dan kuning untuk peringatan. League Spartan dan Plus Jakarta Sans disajikan lokal dari `public/fonts`, beserta lisensi OFL.

Pembaruan ini tersedia pada web melalui `npm start` dan installer desktop versi 1.3.0 di `release-1.3.0/To-Markdown-Setup-1.3.0-x64.exe`.

### Pembaruan desktop

Nama aplikasi adalah **To Markdown**, dengan logo proyek pada executable dan installer. Ikon Windows dibuat ulang dengan `powershell -NoProfile -ExecutionPolicy Bypass -File desktop/build-icon.ps1`.

Menu **Bantuan → Pasang installer manual** menampilkan versi terpasang dan memungkinkan pengguna memilih serta menjalankan installer baru. Unduh installer dari sumber yang dipercaya, simpan dokumen, lalu jalankan installer ke lokasi instalasi yang sama. Identitas aplikasi tetap sama untuk pembaruan instalasi lama. Tidak perlu menghapus aplikasi terlebih dahulu.

Sejak 1.3.0, updater online menggunakan GitHub Releases zenqyverse/to-markdown. Installer belum ditandatangani sertifikat penerbit. Untuk build: `npm run dist -- --publish never`. Rilis ini tidak melalui QA testing; hanya pemeriksaan sintaks dan proses build.

## Panduan pemula: sertifikat penerbit dan auto-update

Bagian signing berikut tetap berupa panduan persiapan. Integrasi updater dan konfigurasi GitHub sudah diterapkan pada 1.3.0; langkah updater di bawah menjadi acuan pemeliharaan rilis berikutnya.

### 1. Apa yang perlu disiapkan?

- **Tanda tangan digital (code signing):** Windows dapat memeriksa identitas penerbit dan apakah EXE berubah setelah ditandatangani. Nama aplikasi tetap To Markdown; nama penerbit mengikuti identitas pribadi/perusahaan yang disahkan penyedia sertifikat.
- **Hosting rilis:** tempat installer dan informasi versi dapat diunduh. Pilihan awal untuk proyek ini: repositori publik GitHub khusus rilis, misalnya `to-markdown-releases`. Source code boleh tetap disimpan terpisah.
- **Kode updater:** fitur di aplikasi untuk memeriksa versi online, mengunduh pembaruan, dan meminta pengguna menyimpan dokumen sebelum pemasangan.

### 2. Mendapatkan sertifikat penerbit

1. Tentukan penerbitnya: diri sendiri atau perusahaan. Siapkan dokumen identitas sesuai persyaratan penyedia.
2. Pilih layanan **Windows public-trust code signing**, bukan sertifikat SSL website atau sertifikat buatan sendiri. Sebelum membayar, tanyakan apakah penyedia menerima negara domisili dan jenis pemohon Anda, serta mendukung penandatanganan aplikasi Electron/NSIS.
3. Periksa biaya perpanjangan, kebutuhan token USB/HSM atau layanan cloud, serta integrasi build. Jangan menganggap semua sertifikat tersedia sebagai file PFX yang bisa diunduh.
4. Selesaikan validasi identitas. Simpan kunci privat dan kredensial di tempat aman; jangan unggah ke repositori atau mengirimkannya lewat chat.
5. Hubungkan metode signing penyedia ke electron-builder. Proyek ini memakai electron-builder **26.18.0**: hapus `win.signExecutable: false`, konfigurasi metode signing yang sesuai, dan gunakan `forceCodeSigning: true` untuk rilis agar build gagal jika tidak bisa ditandatangani. Jangan menonaktifkan pengeditan resource karena logo dan metadata memerlukannya.
6. Build ulang sehingga executable aplikasi dan installer ditandatangani. Gunakan timestamp dari layanan signing. Verifikasi hasil melalui Properties → Digital Signatures pada EXE, atau `Get-AuthenticodeSignature` di PowerShell.

Microsoft memiliki **Azure Artifact Signing**, dahulu disebut Trusted Signing. Kelayakan negara dan individu/perusahaan dibatasi; cek daftar resmi sebelum mendaftar. Indonesia tidak tercantum pada daftar Public Trust organisasi yang diperiksa saat dokumentasi ini diperbarui. Jika tidak memenuhi syarat, cari penyedia sertifikat yang melayani domisili Anda. [Persyaratan Microsoft](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart).

Tanda tangan valid tidak menjamin semua peringatan SmartScreen langsung hilang: reputasi aplikasi/penerbit juga berpengaruh. [Penjelasan Microsoft](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation). Konfigurasi untuk toolchain proyek: [signing Windows electron-builder v26](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/).

### 3. Menyiapkan auto-update online

1. Buat akun GitHub dan repositori publik untuk rilis. Repositori publik memudahkan pengguna mengunduh tanpa token pribadi di aplikasi.
2. Pengembang perlu menambahkan `electron-updater` dengan versi yang kompatibel, konfigurasi provider GitHub di `electron-builder.json`, serta penanganan status cek/unduh/error pada proses utama Electron. Gunakan dokumentasi v26 sesuai toolchain, bukan menyalin konfigurasi v27 tanpa migrasi.
3. Alur yang disarankan: cek versi saat aplikasi dibuka → tampilkan pembaruan → unduh dengan progres → minta pengguna menyimpan dokumen → pasang dan mulai ulang. Internet gagal harus menghasilkan pesan, tanpa menghalangi editor.
4. Naikkan nomor versi, misalnya 1.3.0. Build dengan signing aktif dan konfigurasi publish. Unggah installer `.exe`, metadata `latest.yml`, serta `.exe.blockmap` hasil build ke satu GitHub Release. Publikasikan release stabil, bukan draft. Jangan mengubah EXE setelah metadata dibuat.
5. Pengguna 1.2.0 harus memasang 1.3.0 secara manual sekali, sebab 1.2.0 belum memiliki updater online. Rilis berikutnya dapat diperiksa oleh updater baru.

Panduan mekanisme dan provider: [Auto Update electron-builder v26](https://www.electron.build/v26/docs/features/auto-update/). Token penerbitan GitHub hanya disimpan pada mesin build/CI sebagai secret; tidak dibundel ke aplikasi pengguna.

### 4. Urutan pekerjaan untuk proyek ini

1. Anda menyiapkan URL repositori rilis serta menentukan identitas dan penyedia signing.
2. Pengembang memasang integrasi signing/updater, menjaga `appId` tetap `id.tomarkdown.desktop`, dan mempertahankan data pengguna serta alur penyimpanan dokumen.
3. Build versi baru, periksa tanda tangan dan lakukan uji pembaruan sebelum distribusi publik. Pengujian ini belum dilakukan pada rilis 1.2.0.
4. Publikasikan rilis dan pasang versi pertama yang mendukung updater secara manual. Setelah itu, setiap perubahan tetap memerlukan nomor versi baru, build bertanda tangan, dan publikasi rilis baru.

Lokasi output saat ini `release-1.3.0` dalam `electron-builder.json`; sesuaikan untuk rilis berikutnya atau gunakan folder tetap seperti `release`. Memperbarui README saja tidak mengubah installer yang sudah dibuat.

## Status pengujian

Rilis 1.2.0 tidak menjalankan QA testing sesuai permintaan. Daftar berikut menjelaskan tes yang tersedia, bukan hasil pengujian rilis ini.

`npm test` menguji konversi enam format, UTF-16, tabel/quoted CSV, isi HTML aktif, PDF tanpa teks, file rusak, MIME palsu, limit ukuran/ZIP/tabel, metadata unduhan, kapasitas proses, pembersihan buffer, timeout, dan pembatalan worker. Fixture dibuat secara sintetis di RAM; dokumen pribadi tidak digunakan.

## Dokumentasi library

- [Mammoth](https://github.com/mwilliamson/mammoth.js)
- [PDF.js, contoh Node](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs)
- [Multer](https://expressjs.com/en/resources/middleware/multer/)
- [Turndown](https://github.com/mixmark-io/turndown)
- [ExcelJS](https://github.com/exceljs/exceljs)
- [csv-parse](https://csv.js.org/parse/options/)
- [DOMPurify](https://github.com/cure53/DOMPurify)
