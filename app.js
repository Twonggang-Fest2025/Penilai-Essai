import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MODEL = "Xenova/trocr-small-handwritten";
let ocr = null;
let selectedFile = null;

const $ = (id) => document.getElementById(id);
const setMessage = (text, cls="info") => {
  $("message").textContent = text;
  $("message").className = "message " + cls;
};
const setProgress = (n) => $("bar").style.width = `${Math.max(0, Math.min(100,n))}%`;

async function loadOCR() {
  $("loadBtn").disabled = true;
  $("status").textContent = "Memuat mesin…";
  setProgress(5);
  setMessage("Mengunduh mesin OCR pertama kali. Ukurannya besar, jadi mohon tunggu.", "info");

  try {
    const hasGPU = !!navigator.gpu;
    setMessage(`Mencoba mesin OCR (${hasGPU ? "WebGPU tersedia" : "WASM fallback"})…`, "info");
    setProgress(15);

    // Official Transformers.js image-to-text pipeline for this model.
    ocr = await pipeline("image-to-text", MODEL, {
      device: hasGPU ? "webgpu" : "wasm",
      progress_callback: (p) => {
        if (p && typeof p.progress === "number") {
          setProgress(15 + Math.round(p.progress * 0.7));
        }
      }
    });

    setProgress(100);
    $("status").textContent = "Mesin siap";
    $("status").style.background = "#166534";
    setMessage("BERHASIL. Mesin OCR sudah aktif di browser ini. Sekarang pilih satu foto tulisan tangan.", "success");
    $("fileInput").disabled = false;
  } catch (err) {
    console.error(err);
    $("status").textContent = "Mesin gagal";
    setMessage(
      "GAGAL. " + (err?.message || String(err)) +
      "\\n\\nJika error menyebut WebGPU/ONNX, kita akan uji WASM murni pada langkah berikutnya.",
      "error"
    );
    $("loadBtn").disabled = false;
  }
}

$("loadBtn").addEventListener("click", loadOCR);

$("fileInput").addEventListener("change", (e) => {
  selectedFile = e.target.files?.[0] || null;
  if (!selectedFile) return;
  const url = URL.createObjectURL(selectedFile);
  $("preview").src = url;
  $("preview").hidden = false;
  $("ocrBtn").disabled = !ocr;
  $("result").textContent = "Foto siap dibaca.";
});

$("ocrBtn").addEventListener("click", async () => {
  if (!ocr || !selectedFile) return;
  $("ocrBtn").disabled = true;
  setMessage("Sedang membaca tulisan…", "info");
  $("result").textContent = "Memproses…";

  try {
    const output = await ocr(selectedFile, { max_new_tokens: 128 });
    const text = Array.isArray(output)
      ? output.map(x => x.generated_text || "").join("\\n")
      : String(output);

    $("result").textContent = text.trim() || "(Tidak ada teks yang terbaca)";
    setMessage("Pembacaan selesai. Ini masih tahap uji mesin, belum tahap penilaian.", "success");
  } catch (err) {
    console.error(err);
    $("result").textContent = "";
    setMessage("Gagal membaca foto: " + (err?.message || String(err)), "error");
  } finally {
    $("ocrBtn").disabled = false;
  }
});
