(()=> {
const N=4;
const defs={
 A:[[0,0,0],[0,0,1],[0,0,2],[0,0,3],[0,1,3],[1,0,0]],
 B:[[0,0,0],[0,0,1],[0,0,2],[0,1,0],[0,1,1],[0,1,2],[0,1,3]],
 C:[[0,0,0],[0,0,1],[0,0,2],[0,0,3],[0,1,2],[0,1,3]],
 D:[[0,0,0],[0,0,1],[0,0,2],[0,0,3],[1,0,0],[1,0,1]],
 E:[[0,0,1],[0,0,2],[0,1,0],[0,1,1],[0,1,3]],
 F:[[0,0,1],[0,0,2],[0,0,3],[1,0,0],[1,0,3]],
 G:[[0,0,0],[0,0,1],[0,0,2],[0,0,3],[0,1,3]],
 H:[[0,0,0],[0,0,1],[0,0,2],[1,0,0],[1,0,1],[1,0,2]],
 I:[[0,0,1],[0,0,2],[0,1,0],[0,1,1],[0,1,2],[0,1,3],[0,2,3]],
 J:[[0,1,2],[1,0,0],[1,0,1],[1,0,2],[1,0,3],[1,1,0],[1,1,3]],
 CORE:[[0,0,0],[0,0,1],[0,0,2],[0,0,3]]
};
const ids=["A","B","C","D","E","F","G","H","I","J","CORE"];
const labels=["A","B","C","D","E","F","G","H","I","J","O"];
const flipMap={0:0,1:3,2:2,3:1};
const norm=s=>{const mr=Math.min(...s.map(x=>x[0])),mc=Math.min(...s.map(x=>x[1]));return s.map(([r,c,d])=>[r-mr,c-mc,d]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2])};
const rot=s=>norm(s.map(([r,c,d])=>[c,-r,(d+1)%4]));
const flip=s=>norm(s.map(([r,c,d])=>[r,-c,flipMap[d]]));
function transforms(shape){
 const out=new Map();let a=norm(shape);
 for(let f=0;f<2;f++){
  let t=f?flip(a):a;
  for(let k=0;k<4;k++){const key=JSON.stringify(t);out.set(key,t);t=rot(t)}
 }
 return [...out.values()]
}
function placements(shape){
 const out=[],seen=new Set();
 for(const sh of transforms(shape)){
  const h=Math.max(...sh.map(x=>x[0]))+1,w=Math.max(...sh.map(x=>x[1]))+1;
  for(let ar=0;ar<=N-h;ar++)for(let ac=0;ac<=N-w;ac++){
   const cells=sh.map(([r,c,d])=>[ar+r,ac+c,d]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
   const key=JSON.stringify(cells);if(seen.has(key))continue;seen.add(key);
   let mask=0n;for(const [r,c,d] of cells)mask|=1n<<BigInt((r*N+c)*4+d);
   out.push({cells,mask})
  }
 }
 return out
}
const all=ids.map(id=>placements(defs[id]));
const byCell=Array.from({length:64},()=>[]);
all.forEach((arr,pi)=>arr.forEach((p,pj)=>p.cells.forEach(([r,c,d])=>byCell[(r*N+c)*4+d].push([pi,pj]))));
const used=Array(ids.length).fill(false),chosen=Array(ids.length),solutions=[];
let occ=0n;
function rec(){
 if(solutions.length>2000)throw new Error("Unexpectedly large solution set");
 let best=null,opts=null;
 for(let cell=0;cell<64;cell++){
  const bit=1n<<BigInt(cell);if(occ&bit)continue;
  const cur=[];
  for(const [pi,pj] of byCell[cell]){
   if(used[pi])continue;const p=all[pi][pj];if((p.mask&occ)===0n)cur.push([pi,pj])
  }
  if(!cur.length)return;
  if(!opts||cur.length<opts.length){best=cell;opts=cur;if(cur.length===1)break}
 }
 if(!opts){
  const chars=Array(64).fill("?");
  chosen.forEach((p,pi)=>p.cells.forEach(([r,c,d])=>chars[(r*N+c)*4+d]=labels[pi]));
  solutions.push(chars.join(""));return
 }
 for(const [pi,pj] of opts){
  const p=all[pi][pj];used[pi]=true;chosen[pi]=p;occ|=p.mask;rec();occ^=p.mask;used[pi]=false;chosen[pi]=null
 }
}
rec();
const centerMask=[0,1,2,3].map(d=>(1*N+1)*4+d);
const centerCount=solutions.filter(s=>centerMask.every(i=>s[i]==="O")).length;
if(solutions.length!==1360||centerCount!==60)throw new Error("Diamond DB verification failed: "+solutions.length+"/"+centerCount);
window.BOON_DIAMOND_SOLUTIONS=solutions;
window.BOON_DIAMOND_SOLUTION_COUNT=solutions.length;
window.BOON_DIAMOND_CENTER_COUNT=centerCount;
window.BOON_DIAMOND_TRIANGLE_CELLS=64;
})();