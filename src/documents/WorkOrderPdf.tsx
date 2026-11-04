import {useState} from 'react';
import type {Data} from '../data';
import type {DocumentUpdate} from './repository';
import {documentTypes,type DocumentStore,type DocumentType,type BusinessDocument} from './model';
import {makeDraft} from './draft';

export default function WorkOrderPdf({data,store,update,orderId,onOpen}:{data:Data;store:DocumentStore;update:DocumentUpdate;orderId:string;onOpen:(id:string)=>void}){
  const [open,setOpen]=useState(false);
  const [type,setType]=useState<DocumentType>('Estimate');
  const [templateId,setTemplateId]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState<BusinessDocument|null>(null);
  const templates=store.templates.filter(t=>t.type===type&&!t.deletedAt);
  const selected=templateId||store.types[type].templateId;
  function begin(){setType(documentTypes.find(t=>store.types[t].enabled)||'Estimate');setTemplateId('');setSaved(null);setError('');setOpen(true);}
  async function download(){
    setBusy(true);setError('');
    try{
      let document=saved;
      if(!document){
        if(!store.profile.businessName.trim())throw Error('Add the issuing business name in Documents & Templates settings first.');
        let id='';
        const result=await update(current=>{
          if(!current.types[type].enabled)throw Error('This document type is disabled.');
          const template=current.templates.find(t=>t.id===selected&&t.type===type&&!t.deletedAt);
          if(!template)throw Error('Select an available template.');
          const draft=makeDraft(current,data,type,'',orderId);
          draft.template=structuredClone({...template,accent:template.starter&&template.accent==='#243c58'?current.profile.accent:template.accent});
          draft.templateId=template.id;id=draft.id;
          return {...current,documents:[draft,...current.documents],types:{...current.types,[type]:{...current.types[type],nextNumber:Number(draft.number.slice(current.types[type].prefix.length))+1}}};
        });
        if(!result)throw Error('The draft could not be saved. No PDF was downloaded.');
        document=result.documents.find(d=>d.id===id)||null;
        if(!document)throw Error('The saved draft could not be found.');
        setSaved(document);
      }
      const {createDocumentPdf}=await import('./pdf');
      createDocumentPdf(document).save(`${document.number.replace(/[^a-z0-9_-]/gi,'-')}.pdf`);
    }catch(e){setError(e instanceof Error?e.message:'Could not generate PDF. Check the template and logo.');}
    finally{setBusy(false);}
  }
  return <div>
    <button className="btn secondary" onClick={begin}>Download PDF</button>
    {open&&<section className="panel document-create" aria-label="Work order PDF options">
      <h2>Download work order PDF</h2>
      <p>Choose an enabled document type and layout from Documents & Templates. A numbered draft is saved with your company branding and this work order’s customer and property.</p>
      <div className="form-grid">
        <label>PDF document type<select disabled={busy||!!saved} value={type} onChange={e=>{setType(e.target.value as DocumentType);setTemplateId('');setError('');}}>{documentTypes.filter(t=>store.types[t].enabled).map(t=><option key={t}>{t}</option>)}</select></label>
        <label>PDF template<select disabled={busy||!!saved} value={selected} onChange={e=>setTemplateId(e.target.value)}><option value="" disabled>Select a template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      {!documentTypes.some(t=>store.types[t].enabled)&&<p role="alert">Enable a document type in Documents & Templates settings.</p>}
      {type==='Change Order'&&<p>Change Orders start with blank change scope and pricing. Create a document using “Create document” to enter those details before downloading.</p>}
      {error&&<p role="alert">{error}</p>}
      {saved&&<p role="status">Draft {saved.number} saved. <button className="text-btn" onClick={()=>onOpen(saved.id)}>Review or edit document</button></p>}
      <div className="form-actions"><button disabled={busy} className="btn secondary" onClick={()=>setOpen(false)}>{saved?'Close':'Cancel'}</button><button className="btn primary" disabled={busy||!store.types[type].enabled||!templates.some(t=>t.id===selected)} onClick={download}>{busy?'Preparing PDF…':saved?'Download again':'Save draft & download PDF'}</button></div>
    </section>}
  </div>;
}
