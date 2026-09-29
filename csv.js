export function parseCsv(text,fields){
  if(typeof text!=='string'||text.length>100000)throw Error('CSV maksimal 100 KB.');let rows=[],cells=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;cells.push(cell);cell='';if(cells.some(x=>x.trim()))rows.push(cells);cells=[];}else cell+=c;}
  if(quoted)throw Error('Tanda kutip CSV belum ditutup.');cells.push(cell);if(cells.some(x=>x.trim()))rows.push(cells);
  const header=(rows.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,''));if(header.length!==fields.length||header.some((x,i)=>x!==fields[i]))throw Error('Kolom CSV harus sesuai contoh dan urutannya tidak boleh berubah.');
  if(!rows.length||rows.length>100)throw Error('Isi 1–100 baris data.');
  return rows.map((line,i)=>{if(line.length!==fields.length)throw Error(`Jumlah kolom baris ${i+2} tidak sesuai.`);return Object.fromEntries(fields.map((key,n)=>[key,line[n].trim()]));});
}
