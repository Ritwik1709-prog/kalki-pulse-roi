import {useRef} from "react";import {motion,useMotionValue,useSpring} from "framer-motion";
export default function MagneticButton({children,onClick,primary=true,className=""}:{children:React.ReactNode;onClick?:()=>void;primary?:boolean;className?:string}){
 const r=useRef<HTMLButtonElement>(null);const x=useMotionValue(0),y=useMotionValue(0);
 const sx=useSpring(x,{stiffness:350,damping:25}),sy=useSpring(y,{stiffness:350,damping:25});
 const mv=(e:React.PointerEvent)=>{const b=r.current!.getBoundingClientRect();const dx=e.clientX-(b.left+b.width/2),dy=e.clientY-(b.top+b.height/2);
  if(Math.abs(dx)<b.width/2+40&&Math.abs(dy)<b.height/2+40){x.set(dx*.3);y.set(dy*.3)}};
 return <motion.button ref={r} style={{x:sx,y:sy}} onPointerMove={mv} onPointerLeave={()=>{x.set(0);y.set(0)}} onClick={onClick}
  className={`px-6 py-3 rounded-full text-sm font-semibold focus-visible:outline outline-2 outline-cyan-300 ${primary?"bg-white text-black shadow-[0_0_40px_-8px_#00F0FF]":"glass"} ${className}`}>{children}</motion.button>}
