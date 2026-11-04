import type {FormEventHandler} from 'react';

type Props = {
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
};

export default function NewTechnicianForm({onSubmit, onCancel}: Props) {
  return (
    <form className="editor-form" onSubmit={onSubmit}>
      <label>Name<input name="name" required pattern=".*\S.*"/></label>
      <label>Specialty<input name="specialty" required pattern=".*\S.*"/></label>
      <label>Email<input type="email" name="email" required/></label>
      <label>Phone<input name="phone" type="tel" required pattern=".*\S.*"/></label>
      <div className="form-actions">
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn primary" type="submit">Add record</button>
      </div>
    </form>
  );
}
