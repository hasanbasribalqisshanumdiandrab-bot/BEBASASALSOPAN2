# Cari Jawaban Soal — versi GitHub Pages (hosting statis, tanpa server)

Bank soal **17.751 soal** (data lama tidak diubah + 780 soal baru dari 10 file Excel terbaru), login password tim,
panel Admin untuk mengganti password, baca 1–50 soal sekaligus, soal dari gambar, unggah Excel, referensi AI.

## A. Pasang di GitHub Pages (±5 menit)
1. Buka https://github.com → **New repository** → nama bebas (mis. `cari-soal`) → **Public** → Create.
2. Di halaman repo klik **uploading an existing file**, lalu **tarik ISI folder ini** (bukan zip-nya): `index.html`, folder `assets`, folder `data`, folder `tools`, folder `test`, `README.md`, dan `.nojekyll`.
   Pastikan folder `data` ikut (isinya `bank.js` dan `keys.js`). Klik **Commit changes**.
3. **Settings → Pages** → *Build and deployment* → Source: **Deploy from a branch** → Branch: `main` / folder `/ (root)` → **Save**.
4. Tunggu 1–2 menit. Alamatnya: `https://USERNAME.github.io/NAMA-REPO/`.

## B. Login
- **Tim:** Username (boleh dikosongkan) + Password. Huruf besar/kecil password tim tidak dibedakan.
- **Admin:** klik “Masuk sebagai Admin” → email admin + password admin.
- Sesi aktif **maksimal 2 jam**, lalu otomatis keluar dan harus login lagi. Tidak keluar sendiri sebelum itu. Berlaku sama di HP mana pun.
- Password awal diberikan terpisah oleh pembuat (tidak ditulis di repo). **Admin awal harus segera ganti password admin** (Panel Admin → Password admin).

## C. Ganti password tim (Panel Admin)
Login Admin → tombol **⚙️ Admin**:
1. **Akun tim**: ketik password baru lalu **Ganti**; bisa **Tambah akun** / **Hapus**.
2. **Terbitkan ke GitHub** → isi *token* → klik **Terbitkan akun & password**. Situs diperbarui ±1 menit; setelah itu password lama mati.
   - Membuat token: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate →
     Repository access: *Only select repositories* → pilih repo ini → Permissions: **Contents: Read and write** → Generate. Tempel di kolom Token
     (hanya disimpan di tab itu, hilang saat tab ditutup).
   - Tanpa token: klik **Unduh keys.js**, lalu di repo ganti file `data/keys.js` (Add file → Upload files).
3. **Rotasi penuh** (bagian bawah tab itu): dipakai bila password lama sudah bocor. Membuat kunci data baru, mengenkripsi ulang bank soal,
   dan memaksa semua password diganti. Perubahan password biasa **tidak** mencabut akses orang yang sudah menyimpan file `keys.js` lama.

## C1. Panel Admin, sinkron langsung, & kode pengguna baru
- Tombol **⚙️ Admin** meminta **password admin** lagi sebelum panel terbuka (tetap terbuka 5 menit setelah benar; 5 salah berturut-turut = jeda 30 detik).
- **Sinkron langsung (tanpa deploy):** isi *token GitHub* sekali di tab "Terbitkan ke GitHub". Setelah itu setiap buat/hapus kode, ganti password, tambah/hapus akun otomatis disimpan ke GitHub.
  Halaman login membaca data akun terbaru langsung dari GitHub (bukan dari cache situs), jadi akun/kode baru bisa dipakai dalam hitungan detik tanpa menunggu GitHub Pages.
- **Nonaktif otomatis:** perangkat yang sedang login memeriksa data terbaru tiap ±1 menit dan saat kembali ke tab. Akun/kode yang dihapus atau password yang diganti → pengguna otomatis keluar.
- **Login pengguna (non-admin) pakai Google Authenticator:** Panel Admin → tab "Pengguna Authenticator" → isi nama → *Buat pengguna & kode aktivasi*.
  Admin memberi **kode aktivasi** (10 karakter) ke pengguna. Pengguna: (1) buka halaman login, ketik kode aktivasi di kolom *Kode*; (2) pindai QR dengan Google Authenticator; (3) ketik kode 6 angka → masuk.
  Seterusnya di perangkat itu **cukup kode 6 angka** (username boleh dikosongkan). HP baru / ganti HP: buat ulang pengguna dengan nama yang sama → kode aktivasi baru.
  Hapus pengguna di tab itu → langsung nonaktif di semua perangkat (±1 menit). Perlu token GitHub agar perubahan langsung terbit (lihat C1b).
  Rahasia Authenticator tidak pernah tersimpan polos di `keys.js`: dibungkus kode aktivasi, dan kunci data dibungkus rahasia itu. Password akun tim lama tetap bisa dipakai di kolom yang sama.
- **Auto-tempel:** tombol "Tempel & Cari" + opsi Auto-tempel (saat kotak soal kosong diketuk / saat kembali ke halaman). Butuh HTTPS (GitHub Pages sudah) dan izin "tempel" browser.

## C1b. Token GitHub bermasalah ("Resource not accessible by personal access token")
Artinya token ditolak GitHub untuk menulis file. Perbaiki salah satu:
- Token **klasik** (paling mudah): GitHub → Settings → Developer settings → Personal access tokens → *Tokens (classic)* → Generate → centang **repo** → salin.
- Token **fine-grained**: Repository access = repo situs ini; Permissions → **Contents = Read and write**. Token harus dibuat dari akun **pemilik repo**.
Panel Admin kini menampilkan petunjuk spesifik (termasuk bila token milik akun lain) dan status 🟢/🟡/🔴. Centang "Ingat token di perangkat ini" agar tidak mengisi ulang (hanya di perangkat pribadi).

## C1c. Google Authenticator untuk admin
Panel Admin → tab **Authenticator** → *Hubungkan* → pindai QR di aplikasi → ketik kode 6 angka → Konfirmasi. Setelah itu login admin meminta kode setelah password.
Catatan jujur: hosting statis tidak punya server, jadi ini lapisan tambahan di layar login, bukan pengganti password kuat (data tetap dienkripsi oleh password). Berlaku untuk admin, bukan pengguna tim.
Bila HP hilang: admin lain buka tab Authenticator → *Reset Authenticator admin lain*. Jika semua admin terkunci: hapus bagian `"tp":{...}` pada entri admin di `data/keys.js` lalu unggah.
Rotasi penuh menghapus Authenticator semua admin (perlu dihubungkan ulang).

## C2. Huruf jawaban (a/b/c/d/e)
Untuk soal pilihan ganda yang ditempel lengkap dengan pilihannya, hasil ditampilkan dengan huruf di depan, mis. `a/Keluhan pelanggan kategori place`.
Huruf dicari dari pilihan yang paling mirip dengan jawaban di bank soal (urutan pilihan mengikuti soal yang ditempel). Bila pilihan tidak terbaca atau ragu, hanya teks jawaban yang tampil.
Untuk banyak soal sekaligus ada baris **Kunci cepat** (mis. `1-a 2-c 3-ab`).

## D. Menambah soal
- **Semua orang:** kotak “Tambah soal dari Excel” (XLSX, XLS, XLSM, XLSB, CSV, ODS, ZIP). Tersimpan **di perangkat itu saja**.
  Soal yang sudah ada dilewati (isi lama tidak diubah).
- **Agar semua orang melihatnya:** Admin → Terbitkan ke GitHub → **Terbitkan data soal** (atau Unduh bank.js lalu ganti `data/bank.js`).

## E. Soal dari gambar & Referensi AI
Tombol “Referensi AI → Pengaturan”: pilih Gemini/Claude dan tempel API key Anda (disimpan di perangkat, dikirim langsung ke penyedia AI).
Tanpa key, gambar dibaca dengan OCR di browser (Tesseract, perlu internet, hasil lebih kasar).

## F. Keamanan — baca ini
Hosting statis tidak punya server, jadi pengamanan memakai **enkripsi**: file `data/bank.js` terenkripsi AES-256; password membuka kuncinya
(PBKDF2 600.000 putaran). Isi soal tidak terbaca tanpa password. Tetapi file terenkripsi itu publik, jadi orang yang menebak password secara offline
tidak dibatasi percobaan — **pakai password yang panjang & sulit ditebak** (mis. 12+ karakter). Password pendek seperti angka+nama mudah ditebak.
Kode email sekali pakai tidak mungkin tanpa server, karena itu 3 email dipakai sebagai identitas **admin** (email + password admin).

## G. Membangun ulang data dari nol (opsional)
`CS_TEAM="shanum:SHANUM:sandi1;balqis:BALQIS:sandi2" CS_ADMIN_EMAILS="a@x.com,b@y.com" CS_ADMIN_PASSWORD="sandiadmin" node tools/build.mjs entries.json "label"`
Uji: `npm i jsdom xlsx fflate && node --test test/app.test.mjs`.
