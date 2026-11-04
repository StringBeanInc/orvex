import {useId,useState} from 'react';
import './customer-contact-fields.css';

function ContactField({name,label,type='text',initialValue='',editing=false}:{name:string;label:string;type?:string;initialValue?:string;editing?:boolean}){
  const id=useId();
  const [excluded,setExcluded]=useState(editing&&!initialValue.trim());
  return <div className="customer-contact-field">
    <div className="customer-contact-heading">
      <label htmlFor={id}>{label}</label>
      <label className="customer-exclude"><input type="checkbox" checked={excluded} aria-label={`Exclude ${label.toLowerCase()}`} onChange={event=>setExcluded(event.target.checked)}/>Exclude</label>
    </div>
    <input id={id} name={name} type={type} defaultValue={initialValue} disabled={excluded} required={!excluded} pattern={type==='email'?undefined:'.*\\S.*'}/>
    {excluded&&<span className="subtle">This information will be left blank when saved.</span>}
  </div>;
}

export default function CustomerContactFields({initialValues}:{initialValues?:{contact:string;email:string;phone:string}}){
  return <>
    <ContactField name="contact" label="Contact person" initialValue={initialValues?.contact} editing={!!initialValues}/>
    <ContactField name="email" label="Email" type="email" initialValue={initialValues?.email} editing={!!initialValues}/>
    <ContactField name="phone" label="Phone" type="tel" initialValue={initialValues?.phone} editing={!!initialValues}/>
  </>;
}
