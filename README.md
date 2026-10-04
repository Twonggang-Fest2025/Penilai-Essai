# Penilai Esai Tulisan Tangan — iPad / GitHub Pages / Tanpa API Key

## Konsep
Versi ini berjalan di browser. Tidak memakai Gemini API, Apps Script, server Python, Ollama, atau API key.

Mesin OCR-VL yang dipakai:
`lbm364dl/PaddleOCR-VL-1.5-ONNX`

Model tersebut adalah versi INT4 sekitar 1 GB dan dibuat untuk deployment browser dengan Transformers.js/ONNX Runtime Web.

## Cara memasang di GitHub
1. Buat repository baru di GitHub.
2. Upload:
   - index.html
   - style.css
   - app.js
   - rubric.js
3. Buka Settings → Pages.
4. Pilih Deploy from a branch.
5. Pilih branch `main` dan folder `/root`.
6. Simpan dan buka URL GitHub Pages.

## Cara menggunakan di iPad
1. Buka URL GitHub Pages.
2. Tekan "Aktifkan Mesin AI".
3. Tunggu model pertama kali selesai diunduh.
4. Setelah siap, pilih maksimal 20 foto.
5. Tekan "Mulai Menilai".
6. Hasil bisa diekspor menjadi CSV yang dapat dibuka di Excel/Numbers.

## Penting
- Model sekitar 1 GB, jadi pertama kali membutuhkan waktu dan ruang penyimpanan.
- Pemrosesan 20 foto dapat lama di iPad karena AI berjalan di perangkat.
- WebGPU digunakan bila tersedia; jika tidak, aplikasi mencoba WASM.
- Ini adalah versi uji browser-only. Akurasi tulisan tangan sangat bergantung pada kualitas foto dan kemampuan perangkat/model.
- Rubrik pada `rubric.js` masih contoh. Untuk penilaian ujian sebenarnya, ganti dengan soal dan kunci jawaban asli guru.
- Sistem tidak langsung memberi nilai 0 hanya karena teks pendek/samar. Ia tetap mencoba memberi nilai berdasarkan isi yang berhasil dibaca dan konsep rubrik.
