import {useEffect,useRef,useState} from "react";import gsap from "gsap";
const L=["MOUNTING ONNX RUNTIME...","REDIS FEATURE STORE: 0.8ms","READY"];
export default function Preloader({done}:{done:()=>void}){
 const el=useRef<HTMLDivElement>(null);const [i,setI]=useState(0);
 useEffect(()=>{const a=setTimeout(()=>setI(1),300),b=setTimeout(()=>setI(2),600);
  const c=setTimeout(()=>gsap.to(el.current,{clipPath:"inset(0 0 100% 0)",duration:.5,ease:"power4.inOut",onComplete:done}),900);
  return()=>[a,b,c].forEach(clearTimeout)},[]);
 return <div ref={el} className="fixed inset-0 z-[100] grid place-items-center bg-[#030306] num text-cyan-300 text-sm" style={{clipPath:"inset(0)"}}>{L[i]}</div>}
