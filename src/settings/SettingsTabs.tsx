import {useEffect,useState} from 'react';
import './settings-tabs.css';

type Tab={id:string;label:string;node:HTMLElement};

export default function SettingsTabs(){
  const [tabs,setTabs]=useState<Tab[]>([]);
  const [active,setActive]=useState('');

  useEffect(()=>{
    const content=document.querySelector('.page-content');
    if(!content)return;
    const collect=()=>{
      const nodes=Array.from(document.querySelectorAll('.page-content > section,.page-content > .settings-grid,.status-library'))
        .filter((node):node is HTMLElement=>node instanceof HTMLElement);
      const next=nodes.map((node,index)=>({
        id:`settings-tab-${index}`,
        label:node.querySelector('h2')?.textContent?.trim()||`Settings ${index+1}`,
        node,
      }));
      setTabs(next);
      setActive(current=>next.some(tab=>tab.id===current)?current:next[0]?.id||'');
    };
    collect();
    const observer=new MutationObserver(collect);
    const statusSlot=document.getElementById('settings-status-library-slot');
    if(statusSlot)observer.observe(statusSlot,{childList:true});
    return()=>{
      observer.disconnect();
      Array.from(document.querySelectorAll('.page-content > section,.page-content > .settings-grid,.status-library')).forEach(node=>{
        if(node instanceof HTMLElement)node.hidden=false;
      });
    };
  },[]);

  useEffect(()=>{
    tabs.forEach(tab=>{tab.node.hidden=Boolean(active&&tab.id!==active)});
  },[active,tabs]);

  return <>
    {tabs.length>0&&<nav className="settings-tabs" aria-label="Settings sections">
      {tabs.map(tab=><button key={tab.id} className={active===tab.id?'active':''} onClick={()=>setActive(tab.id)}>{tab.label}</button>)}
    </nav>}
    <div id="settings-status-library-slot"/>
  </>;
}
