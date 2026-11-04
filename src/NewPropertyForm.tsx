import type {FormEventHandler} from 'react';
import AddressFields from './addresses/AddressFields';
import PropertyEmailField from './PropertyEmailField';
import type {Customer} from './data';

type Props = {
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
  customers: Customer[];
  customerFilter: string;
};

export default function NewPropertyForm({onSubmit, onCancel, customers, customerFilter}: Props) {
  return (
    <form className="editor-form" onSubmit={onSubmit}>
      <label>Name<input name="name" required pattern=".*\S.*"/></label>
      <AddressFields kind="property" />
      <PropertyEmailField/>
      <label>Customer<select name="customerId" defaultValue={customerFilter||undefined} required>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Property type<select name="type">{['Office','Residential','Healthcare','Commercial','Industrial'].map(t=><option key={t}>{t}</option>)}</select></label>
      <div className="form-actions">
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn primary" type="submit">Add record</button>
      </div>
    </form>
  );
}
