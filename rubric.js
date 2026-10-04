// RUBRIK CONTOH. Ganti dengan soal/kunci jawaban asli sebelum dipakai untuk penilaian resmi.
export const RUBRIC = [
 {id:1,max:20,question:"Jelaskan pengertian seni.",groups:[
   ["cipta","karya","hasil"],["rasa","perasaan","emosi"],["karsa","kehendak","kemauan"],
   ["manusia","manusiawi"],["ekspresi","ungkapan"],["gagasan","ide","pikiran"]
 ]},
 {id:2,max:20,question:"Sebutkan prinsip seni rupa dua dimensi.",groups:[
   ["kesatuan","unity"],["keseimbangan","balance"],["proporsi"],["irama","ritme"],
   ["harmoni","keselarasan"],["penekanan","pusat perhatian"],["kontras"],["komposisi"]
 ]},
 {id:3,max:20,question:"Sebutkan unsur-unsur seni rupa.",groups:[
   ["titik"],["garis"],["bidang"],["bentuk"],["ruang"],["tekstur"],["warna"],["gelap terang","gelap-terang"]
 ]},
 {id:4,max:20,question:"Jelaskan jenis warna dan berikan contoh.",groups:[
   ["primer","merah","kuning","biru"],["sekunder","hijau","oranye","ungu"],
   ["tersier","campuran"],["netral","hitam","putih","abu"]
 ]},
 {id:5,max:20,question:"Jelaskan perbedaan seni rupa murni dan terapan beserta contoh.",groups:[
   ["murni","keindahan","estetis","ekspresi"],["terapan","fungsi","kegunaan"],
   ["lukisan","patung"],["batik","kursi","meja","kerajinan"]
 ]}
];

export function scoreAnswer(text, item){
  const t=(text||"").toLowerCase();
  if(!t.trim()) return {score:0,coverage:0};
  let hit=0;
  for(const group of item.groups){
    if(group.some(k=>t.includes(k))) hit++;
  }
  const coverage=hit/item.groups.length;
  let score=Math.round(item.max*Math.min(1,coverage*1.18));
  if(score<2 && t.length>15) score=2;
  return {score,coverage};
}
