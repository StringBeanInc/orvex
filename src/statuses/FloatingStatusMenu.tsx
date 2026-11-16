import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export default function FloatingStatusMenu({anchor,children,onClose}:{anchor:HTMLElement;children:ReactNode;onClose:()=>void}){
  const menu=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState({top:0,left:0});
  useLayoutEffect(()=>{
    const bounds=anchor.getBoundingClientRect();
    const height=menu.current?.offsetHeight||0;
    const width=menu.current?.offsetWidth||160;
    setPosition({left:Math.max(8,Math.min(bounds.left,window.innerWidth-width-8)),top:bounds.bottom+height+6<window.innerHeight?bounds.bottom+6:Math.max(8,bounds.top-height-6)});
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!menu.current?.contains(event.target)&&!anchor.contains(event.target))onClose();};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){onClose();anchor.focus();}};
    const scroll=(event:Event)=>{if(event.target instanceof Node&&menu.current?.contains(event.target))return;onClose();};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    window.addEventListener('scroll',scroll,true);
    window.addEventListener('resize',onClose);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',onClose);};
  },[anchor,onClose]);
  return createPortal(<div ref={menu} className="table-status-menu" role="menu" aria-label="Work order status" style={{position:'fixed',zIndex:1000,...position,maxHeight:'calc(100vh - 16px)',overflowY:'auto'}} onClick={event=>event.stopPropagation()}>{children}</div>,document.body);
}
