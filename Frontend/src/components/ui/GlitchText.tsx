import {useEffect,useState} from "react";
const rm=()=>matchMedia("(prefers-reduced-motion:reduce)").matches;
export default function GlitchText({children,periodic=true}:{children:string;periodic?:boolean}){
 const [on,set]=useState(false);
 const fire=()=>{if(rm())return;set(true);setTimeout(()=>set(false),200)};
 useEffect(()=>{if(!periodic)return;const i=setInterval(fire,6000);return()=>clearInterval(i)},[]);
 return <span className={`glitch ${on?"on":""}`} data-t={children} onMouseEnter={fire}>{children}</span>}
