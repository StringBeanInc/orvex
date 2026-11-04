export default function PropertyEmailField({emails=[]}:{emails?:string[]}){
  return <label>Property emails (optional)
    <input name="propertyEmails" type="email" multiple defaultValue={emails.join(', ')} placeholder="manager@example.com, office@example.com"/>
    <span className="subtle">Separate multiple email addresses with commas.</span>
  </label>;
}
export function propertyEmails(form:FormData):string[]{
  return [...new Set(String(form.get('propertyEmails')||'').split(',').map(value=>value.trim()).filter(Boolean))];
}
