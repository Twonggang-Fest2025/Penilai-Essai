import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MODEL = "Xenova/trocr-small-handwritten";
let ocr = null, file = null, img = new Image();
const $ = id => document.getElementById(id);
const setMsg = (t,c="info") => { $("message").textContent=t; $("message").className="message "+c; };
const pct = id => Number($(id).value);
const updateLabels = () => { for (const id of ["x1","x2","y1","y2"]) $(id+"v").value=$(id).value+"%"; drawCrop(); };

async function loadOCR(){
  $("loadBtn").disabled=true; setMsg("Memuat mesin OCR. Pertama kali bisa cukup lama…"); $("status").textContent="Memuat…"; $("bar").style.width="8%";
  try{
    // Pakai WASM secara sengaja untuk tes stabil di browser; tidak bergantung WebGPU.
    ocr = await pipeline("image-to-text", MODEL, {
      device: "wasm",
      dtype: "q8",
      progress_callback: p => { if(typeof p?.progress === "number") $("bar").style.width=(10+Math.round(p.progress*85))+"%"; }
    });
    $("bar").style.width="100%"; $("status").textContent="Mesin siap"; $("status").className="badge ok";
    setMsg("Mesin OCR siap. Pilih foto lalu potong 1–2 baris tulisan.","success"); $("fileInput").disabled=false;
  }catch(e){
    console.error(e); $("status").textContent="Gagal"; $("status").className="badge bad";
    setMsg("Gagal memuat mesin: "+(e?.message||String(e)),"error"); $("loadBtn").disabled=false;
  }
}

function drawCrop(){
  if(!img.naturalWidth) return;
  const c=$("cropCanvas"), ctx=c.getContext("2d");
  const sx=Math.round(img.naturalWidth*pct("x1")/100), sy=Math.round(img.naturalHeight*pct("y1")/100);
  const ex=Math.round(img.naturalWidth*pct("x2")/100), ey=Math.round(img.naturalHeight*pct("y2")/100);
  const sw=Math.max(2,ex-sx), sh=Math.max(2,ey-sy);
  const maxW=1200, scale=Math.min(1,maxW/sw); c.width=Math.max(2,Math.round(sw*scale)); c.height=Math.max(2,Math.round(sh*scale));
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
}
function presets(name){
  if(name==="top"){ $("x1").value=8; $("x2").value=92; $("y1").value=12; $("y2").value=32; }
  if(name==="middle"){ $("x1").value=8; $("x2").value=92; $("y1").value=35; $("y2").value=55; }
  if(name==="bottom"){ $("x1").value=8; $("x2").value=92; $("y1").value=55; $("y2").value=78; }
  updateLabels();
}

$("loadBtn").onclick=loadOCR;
$("fileInput").onchange=e=>{
  file=e.target.files?.[0]; if(!file)return;
  img.onload=()=>{ $("sourcePreview").src=img.src; $("sourcePreview").hidden=false; drawCrop(); $("ocrBtn").disabled=!ocr; $("result").textContent="Potongan siap. Atur area sampai berisi 1–2 baris tulisan."; };
  img.src=URL.createObjectURL(file);
};
for(const id of ["x1","x2","y1","y2"]) $(id).oninput=updateLabels;
for(const b of document.querySelectorAll("[data-preset]")) b.onclick=()=>presets(b.dataset.preset);

$("ocrBtn").onclick=async()=>{
  if(!ocr||!img.naturalWidth)return;
  $("ocrBtn").disabled=true; setMsg("Sedang membaca potongan tulisan…"); $("result").textContent="Memproses…";
  try{
    const c=$("cropCanvas");
    // PNG dari canvas mempertahankan tulisan dengan latar bersih dan menghindari membaca area luar.
    const blob=await new Promise(r=>c.toBlob(r,"image/png",1));
    const out=await ocr(blob,{max_new_tokens:64,num_beams:2});
    const text=Array.isArray(out)?out.map(x=>x.generated_text||"").join(" "):String(out);
    $("result").textContent=text.trim()||"(Tidak ada teks yang terbaca)";
    setMsg("Selesai. Jika masih salah, geser batas potongan agar hanya mengenai 1–2 baris tulisan.","success");
  }catch(e){ console.error(e); $("result").textContent=""; setMsg("Gagal membaca: "+(e?.message||String(e)),"error"); }
  finally{ $("ocrBtn").disabled=false; }
};
updateLabels();
