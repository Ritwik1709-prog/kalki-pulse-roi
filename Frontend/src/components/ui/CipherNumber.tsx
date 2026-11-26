import {useEffect,useState} from "react";
const H="0123456789ABCDEF#+%";
export default function CipherNumber({value,ms=450}:{value:string;ms?:number}){
 const [t,setT]=useState(value);
 useEffect(()=>{const s=performance.now();let r=0;const f=(n:number)=>{const p=Math.min((n-s)/ms,1);
  setT(value.split("").map((c,i)=>/\s|[.,₹$]/.test(c)||i<p*value.length?c:H[Math.random()*H.length|0]).join(""));
  if(p<1)r=requestAnimationFrame(f)};r=requestAnimationFrame(f);return()=>cancelAnimationFrame(r)},[value]);
 return <span className="num">{t}</span>}
