import {
  Florence2ForConditionalGeneration,
  AutoProcessor,
  AutoTokenizer,
  RawImage
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

import { RUBRIC, scoreAnswer } from "./rubric.js";

const MODEL = "onnx-community/Florence-2-base-ft";
let model = null, processor = null, tokenizer = null;
let files = [], results = [];

const $ = id => document.getElementById(id);
const setStatus = (s, cls="") => {
  $("loadStatus").textContent = s;
  $("loadStatus").className = "status " + cls;
};

$("loadBtn").onclick = async () => {
  try {
    $("loadBtn").disabled = true;
    setStatus("Menyiapkan mesin AI browser. Pertama kali perlu mengunduh model... ");

    const preferredDevice = navigator.gpu ? "webgpu" : "wasm";
    $("engineBadge").textContent = "Menyiapkan • " + preferredDevice.toUpperCase();

    // Konfigurasi ini mengikuti contoh resmi Transformers.js untuk Florence-2:
    // embed_tokens fp16, vision/encoder/decoder q4 pada WebGPU.
    const dtype = {
      embed_tokens: "fp16",
      vision_encoder: "fp16",
      encoder_model: "q4",
      decoder_model_merged: "q4"
    };

    async function loadWith(device) {
      setStatus(`Memuat Florence-2 (${device.toUpperCase()})...`);
      return await Florence2ForConditionalGeneration.from_pretrained(MODEL, {
        dtype,
        device
      });
    }

    try {
      model = await loadWith(preferredDevice);
    } catch (firstError) {
      console.warn("Percobaan pertama gagal:", firstError);
      // Safari/iPad tertentu dapat gagal pada WebGPU. Coba CPU/WASM otomatis.
      if (preferredDevice !== "wasm") {
        setStatus("WebGPU tidak cocok pada perangkat ini. Mencoba mode kompatibilitas WASM...");
        model = await loadWith("wasm");
      } else {
        throw firstError;
      }
    }

    processor = await AutoProcessor.from_pretrained(MODEL);
    tokenizer = await AutoTokenizer.from_pretrained(MODEL);

    const actualDevice = model?.config?.device || (navigator.gpu ? "webgpu" : "wasm");
    $("engineBadge").textContent = "AI siap • " + String(actualDevice).toUpperCase();
    $("engineBadge").style.background = "#166534";
    setStatus("Mesin AI siap digunakan. Sekarang foto jawaban bisa diproses.", "ok");
    $("processBtn").disabled = files.length === 0;
  } catch (e) {
    console.error(e);
    const msg = e?.message || e?.cause?.message || e?.toString?.() || String(e);
    setStatus("Gagal memuat mesin: " + msg, "error");
    $("engineBadge").textContent = "Mesin gagal";
    $("loadBtn").disabled = false;
  }
};

$("files").onchange = e => {
  files = [...e.target.files].slice(0, 20);
  $("queue").innerHTML = files.map((f,i) =>
    `<div class="item"><div class="itemHead">
      <b>${escapeHtml((i+1)+". "+f.name)}</b>
      <span class="small">${Math.round(f.size/1024)} KB</span>
    </div></div>`
  ).join("");
  $("processBtn").disabled = !model || !files.length;
};

$("processBtn").onclick = async () => {
  $("processBtn").disabled = true;
  results = [];
  renderResults();

  for (let i=0; i<files.length; i++) {
    const f = files[i];
    $("loadBar").style.width = ((i/files.length)*100) + "%";
    setStatus(`Memproses ${i+1} dari ${files.length}: ${f.name}`);

    try {
      let text = await ocrImage(f);

      // Second pass with enhanced image if the first reading is suspiciously short.
      if ((text || "").trim().length < 30) {
        const enhanced = await enhanceImage(f);
        const second = await ocrImage(enhanced);
        if (second.length > text.length) text = second;
      }

      results.push(makeResult(f, text));
    } catch (e) {
      console.error(e);
      results.push({
        filename:f.name, name:"", className:"",
        answers:["","","","",""], scores:[0,0,0,0,0], total:0,
        status:"GAGAL TEKNIS", note:e?.message || String(e), raw:""
      });
    }

    renderResults();
  }

  $("loadBar").style.width = "100%";
  $("csvBtn").disabled = results.length === 0;
  setStatus(`Selesai memproses ${results.length} lembar.`);
  $("processBtn").disabled = false;
};

async function ocrImage(input) {
  const image = await RawImage.fromURL(
    typeof input === "string" ? input : await fileToDataURL(input)
  );

  const task = "<OCR>";
  const prompts = processor.construct_prompts(task);
  const visionInputs = await processor(image);
  const textInputs = tokenizer(prompts);

  const generatedIds = await model.generate({
    ...textInputs,
    ...visionInputs,
    max_new_tokens: 1200
  });

  const generatedText = tokenizer.batch_decode(
    generatedIds,
    { skip_special_tokens:false }
  )[0];

  const parsed = processor.post_process_generation(
    generatedText,
    task,
    image.size
  );

  if (parsed && typeof parsed === "object" && parsed["<OCR>"] != null) {
    return String(parsed["<OCR>"]);
  }
  return generatedText;
}

function makeResult(file,text) {
  const clean = (text||"").replace(/\r/g,"");
  const name = findName(clean);
  const className = findClass(clean);
  const answers = splitAnswers(clean);
  const scores = answers.map((a,i)=>scoreAnswer(a,RUBRIC[i]).score);
  const total = scores.reduce((a,b)=>a+b,0);
  const note = answers.some(a=>a.trim().length<15)
    ? "Sebagian jawaban sangat singkat/samar; sistem tetap mencoba menilai berdasarkan teks yang berhasil dibaca."
    : "Dinilai otomatis berdasarkan isi yang terbaca dan rubrik.";

  return {
    filename:file.name, name, className, answers, scores, total,
    status:"DINILAI OTOMATIS", note, raw:clean
  };
}

function splitAnswers(text) {
  const t=text.replace(/[ \t]+/g," ");
  const matches=[...t.matchAll(/(?:^|\n|\s)(?:soal\s*)?([1-5])[\.\):\-]\s*/gi)];

  if(matches.length>=3){
    const arr=Array(5).fill("");
    for(let i=0;i<matches.length;i++){
      const n=Number(matches[i][1]);
      if(n>=1&&n<=5){
        const start=matches[i].index+matches[i][0].length;
        const end=i+1<matches.length?matches[i+1].index:t.length;
        arr[n-1]=t.slice(start,end).trim();
      }
    }
    return arr;
  }

  const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const arr=Array(5).fill("");
  const chunk=Math.max(1,Math.ceil(lines.length/5));
  lines.forEach((line,i)=>{
    arr[Math.min(4,Math.floor(i/chunk))] += " "+line;
  });
  return arr.map(x=>x.trim());
}

function findName(t){
  const m=t.match(/(?:nama|name)\s*[:\-]?\s*([^\n]+)/i);
  return m?m[1].trim():"";
}
function findClass(t){
  const m=t.match(/(?:kelas|class)\s*[:\-]?\s*([A-Za-z0-9 .\/-]+)/i);
  return m?m[1].trim():"";
}

function enhanceImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement("canvas"),ctx=c.getContext("2d");
      const max=1800,scale=Math.min(1,max/img.width);
      c.width=Math.round(img.width*scale);
      c.height=Math.round(img.height*scale);
      ctx.drawImage(img,0,0,c.width,c.height);
      const d=ctx.getImageData(0,0,c.width,c.height);
      for(let i=0;i<d.data.length;i+=4){
        const y=.299*d.data[i]+.587*d.data[i+1]+.114*d.data[i+2];
        const v=Math.max(0,Math.min(255,(y-128)*1.55+128));
        d.data[i]=d.data[i+1]=d.data[i+2]=v;
      }
      ctx.putImageData(d,0,0);
      resolve(c.toDataURL("image/jpeg",.9));
    };
    img.onerror=reject;
    img.src=URL.createObjectURL(file);
  });
}

function fileToDataURL(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function renderResults(){
  if(!results.length){
    $("resultsWrap").innerHTML='<div class="empty">Belum ada hasil.</div>';
    return;
  }
  $("resultsWrap").innerHTML=results.map((r,i)=>`
    <div class="item">
      <div class="itemHead">
        <b>${i+1}. ${escapeHtml(r.filename)}</b>
        <span class="${r.status==="GAGAL TEKNIS"?"error":"ok"}">${r.status}</span>
      </div>
      <p><b>Nama:</b> ${escapeHtml(r.name||"Tidak terbaca")}
      &nbsp; <b>Kelas:</b> ${escapeHtml(r.className||"Tidak terbaca")}</p>
      <div class="scores">${r.scores.map((s,j)=>
        `<div class="score">Soal ${j+1}<b>${s}</b><span>/ ${RUBRIC[j].max}</span></div>`
      ).join("")}</div>
      <p><b>Total: ${r.total}/100</b></p>
      <p class="small">${escapeHtml(r.note)}</p>
      <details><summary>Lihat teks yang berhasil dibaca</summary>
        <pre style="white-space:pre-wrap">${escapeHtml(r.raw||"")}</pre>
      </details>
    </div>
  `).join("");
}

$("csvBtn").onclick=()=>{
  const head=["No","File","Nama","Kelas","Soal 1","Soal 2","Soal 3","Soal 4","Soal 5","Total","Status","Catatan"];
  const rows=results.map((r,i)=>[
    i+1,r.filename,r.name,r.className,...r.scores,r.total,r.status,r.note
  ]);
  const csv=[head,...rows]
    .map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))
    .join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="hasil_penilaian.csv";
  a.click();
};
