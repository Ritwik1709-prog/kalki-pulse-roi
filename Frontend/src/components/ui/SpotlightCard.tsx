export default function SpotlightCard({children,className=""}:{children:React.ReactNode;className?:string}){
 return <div className={`glass spot ${className}`} onPointerMove={e=>{const b=e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mouse-x",`${e.clientX-b.left}px`);e.currentTarget.style.setProperty("--mouse-y",`${e.clientY-b.top}px`)}}>{children}</div>}
