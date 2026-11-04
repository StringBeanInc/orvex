import {useState} from 'react';
import AddressAutocomplete from './AddressAutocomplete';

type AddressValues = {
  address?: string;
  streetAddress?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type Props = {
  kind: 'customer' | 'property';
  initialValues?: AddressValues;
};

// Coordinates and provider metadata are deliberately excluded from form state.
export default function AddressFields({kind, initialValues = {}}: Props) {
  const customer = kind === 'customer';
  const [fields, setFields] = useState(() => ({
    street: (customer ? initialValues.streetAddress : initialValues.address) || '',
    addressLine2: initialValues.addressLine2 || '',
    city: initialValues.city || '',
    state: initialValues.state || '',
    postalCode: initialValues.postalCode || '',
    country: initialValues.country || '',
  }));
  const edit = (field: keyof typeof fields, value: string) =>
    setFields(previous => ({...previous, [field]: value}));
  const streetLabel = customer ? 'Street address' : 'Address';
  const contents = <>
    <label>{streetLabel}<AddressAutocomplete
      name={customer ? 'streetAddress' : 'address'}
      ariaLabel={streetLabel}
      value={fields.street}
      onChange={value => edit('street', value)}
      onManualChange={() => {}}
      onSelect={suggestion => setFields(previous => ({
        ...previous,
        street: suggestion.address,
        city: suggestion.city,
        state: suggestion.state,
        postalCode: suggestion.postalCode,
        country: suggestion.country,
      }))}
      required={!customer}
      pattern={customer ? undefined : '.*\\S.*'}
      placeholder={customer ? '123 Main Street' : 'Street address'}
    /></label>
    {customer && <label>Apartment, suite, etc.<input
      name="addressLine2" autoComplete="address-line2" placeholder="Suite 200"
      value={fields.addressLine2} onChange={event => edit('addressLine2', event.target.value)}
    /></label>}
    <div className="form-grid">
      <label>City<input name="city" autoComplete="address-level2" value={fields.city} onChange={event => edit('city', event.target.value)}/></label>
      <label>{customer ? 'State / province' : 'State'}<input name="state" autoComplete="address-level1" value={fields.state} onChange={event => edit('state', event.target.value)}/></label>
      <label>{customer ? 'ZIP / postal code' : 'ZIP code'}<input name="postalCode" autoComplete="postal-code" value={fields.postalCode} onChange={event => edit('postalCode', event.target.value)}/></label>
      {customer && <label>Country<input name="country" autoComplete="country-name" placeholder="United States" value={fields.country} onChange={event => edit('country', event.target.value)}/></label>}
    </div>
  </>;
  return customer ? <fieldset className="customer-address">
    <legend>Address information <span className="subtle">(optional)</span></legend>
    {contents}
  </fieldset> : contents;
}
