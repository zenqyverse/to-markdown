# Audit ukuran To Markdown 1.3.0

Tanggal: 17 November 2026. Audit membaca installer dan isi `release-1.3.0/win-unpacked`; tidak mengubah aplikasi, menjalankan QA, mengompresi ulang, atau menerbitkan rilis. Ukuran di bawah memakai MiB (1.048.576 byte), kecuali dinyatakan berbeda. Ukuran disk adalah jumlah panjang file, bukan allocation size filesystem.

## Hasil pengukuran

| Komponen | Ukuran |
| --- | ---: |
| Installer unduhan | 180,80 MiB (189,59 MB desimal) |
| Seluruh folder aplikasi diekstrak | 643,18 MiB |
| Runtime Electron dan resource pendukung di luar aplikasi | 357,15 MiB |
| Dependensi aplikasi | 285,62 MiB |
| Kode/aset proyek sendiri, termasuk font | 0,41 MiB |

Terdapat 14.380 file. File `To Markdown.exe` pada folder hasil ekstraksi sendiri berukuran 238,51 MiB. Installer unduhan sudah dikompresi; jangan menjumlahkan ukuran file hasil ekstraksi sebagai ukuran unduhan.

Dependensi terbesar (angka ini saling mencakup source map, bukan kategori tambahan):

| Paket | Ukuran hasil ekstraksi |
| --- | ---: |
| mermaid | 121,31 MiB |
| @napi-rs/canvas-win32-x64-msvc | 37,04 MiB |
| pdfjs-dist | 35,46 MiB |
| exceljs | 20,57 MiB |
| @mermaid-js/parser | 10,33 MiB |
| cytoscape-fcose | 8,87 MiB |
| elkjs | 7,83 MiB |

Dev tools Electron, electron-builder dan supertest tidak ditemukan sebagai paket tingkat atas dalam dependensi aplikasi hasil kemasan. Jadi bukan seluruh `node_modules` pengembangan yang ikut dikirim.

## Kandidat penghematan

| Kandidat | Ukuran mentah | Catatan |
| --- | ---: | --- |
| 786 file `.map` | 123,55 MiB | Data debugging. Kandidat pertama untuk dikeluarkan dari rilis; simpan pada lingkungan pengembangan. |
| 53 locale Chromium selain `id` dan `en-US` | 47,65 MiB | Pertahankan Indonesia dan fallback Inggris. Mengurangi lokalisasi UI bawaan Chromium, bukan kemampuan membaca teks Unicode dokumen. |
| Folder demo/examples dependency, tanpa `.map` | 8,16 MiB | Gunakan daftar pengecualian spesifik setelah memastikan tidak diimpor. |
| Mermaid standalone `mermaid.js` / `mermaid.min.js` | 17,79 MiB | Frontend proyek mengimpor `mermaid.esm.min.mjs`, bukan kedua bundle ini. |
| Mermaid chunks ESM non-minified, tanpa `.map` | 10,85 MiB | Frontend memakai jalur chunks ESM minified. Pertahankan semua dynamic imports yang dibutuhkan. |

Kategori kandidat di atas tidak tumpang tindih: total sekitar **208,00 MiB mentah**, atau sekitar **32%** folder hasil ekstraksi. Tiga kandidat pertama berjumlah sekitar 179,35 MiB. Ini inventaris kandidat, bukan hasil build teroptimasi atau jaminan seluruh berkas aman dihapus. Ukuran unduhan tidak akan turun sebesar angka mentah ini: file teks/map dapat dikompresi sangat baik. Penghematan installer harus diukur lewat build pembanding.

## Batas dan keputusan teknis

- Jangan langsung menghapus `@napi-rs/canvas`: PDF.js legacy mengacu padanya. Dampak pada konversi perlu ditelusuri sebelum mengurangi dependency ini.
- Jangan menghapus seluruh diagram/worker/chunk Mermaid: beberapa jenis diagram dimuat saat dibutuhkan.
- ExcelJS memiliki bundle browser selain entry Node `lib/exceljs.nodejs.js`; ini kandidat lanjutan setelah menelusuri dependensi.
- Konfigurasi saat ini memakai `asar: false`. Mengaktifkan ASAR bukan pengganti kompresi installer; perubahan itu juga perlu memperhitungkan worker, aset statis dan modul native.
- Pertahankan lisensi, resource PDF yang diperlukan, font, file updater dan komponen runtime. Jangan menghapus DLL hanya karena nama filenya terlihat tidak dipakai.

## Urutan optimasi yang disarankan

1. Kecualikan source map dari paket produksi.
2. Batasi locale Electron ke Indonesia/Inggris.
3. Kecualikan demo dan bundle duplikat dengan daftar file terarah.
4. Bangun kandidat rilis terpisah, bandingkan ukuran installer dan folder hasil ekstraksi, lalu periksa konversi serta diagram sebelum distribusi.

Belum perlu pindah framework hanya untuk memulai penghematan ini. Runtime Electron tetap merupakan biaya terbesar yang tersisa; target installer tertentu belum dapat dijanjikan dari audit baca-saja.

Data terukur tersimpan di [package-size-audit.json](package-size-audit.json) dan [package-size-candidates.json](package-size-candidates.json).
