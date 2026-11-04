import AddressFields from './addresses/AddressFields';
import CustomerContactFields from './CustomerContactFields';
import type {FormEventHandler} from 'react';

type Props = {
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
};

export default function NewCustomerForm({onSubmit, onCancel}: Props) {
  return (
    <form className="editor-form" onSubmit={onSubmit}>
      <label>Name<input name="name" required pattern=".*\S.*"/></label>
      <CustomerContactFields/>
      <AddressFields kind="customer" />
      <div className="form-actions">
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn primary" type="submit">Add record</button>
      </div>
    </form>
  );
}
