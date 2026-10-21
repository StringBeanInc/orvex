import BackendEmployees from './BackendEmployees';

import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { hostedSpark, getPricingFunctions } from '../firebase';
import {
  listStaffProfiles,
  createStaffProfile,
  updateStaffProfile,
} from './sparkEmployees';
import type { StaffProfile } from './sparkEmployees';
import './employees.css';

export async function employeeApi<T>(
  name: string,
  data: unknown
): Promise<T> {
  if (hostedSpark) {
    const { sparkApi } = await import('./sparkRepository');
    return (await sparkApi(name, data)) as T;
  }

  return (
    await httpsCallable<unknown, T>(
      await getPricingFunctions(),
      name
    )(data)
  ).data;
}

const staffRoles = [
  'Administrator',
  'Manager',
  'Office Staff',
  'Technician',
];

function SparkEmployees({
  companyId,
  owner,
}: {
  companyId: string;
  owner: boolean;
}) {
  const [employees, setEmployees] = useState<StaffProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<StaffProfile | null>(null);
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState('Technician');
  const [active, setActive] = useState(true);

  async function load() {
    setBusy(true);
    setError('');

    try {
      setEmployees(await listStaffProfiles(companyId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  function resetForm() {
    setEditing(null);
    setAdding(false);
    setName('');
    setEmail('');
    setPhone('');
    setJobTitle('');
    setRole('Technician');
    setActive(true);
  }

  function startAdd() {
    resetForm();
    setAdding(true);
  }

  function startEdit(employee: StaffProfile) {
    setEditing(employee);
    setAdding(false);
    setName(employee.name);
    setEmail(employee.email || '');
    setPhone(employee.phone || '');
    setJobTitle(employee.jobTitle || '');
    setRole(employee.role);
    setActive(employee.active);
  }

  async function save() {
    setBusy(true);
    setError('');

    try {
      const input = {
        name,
        email,
        phone,
        jobTitle,
        role,
      };

      if (editing) {
        await updateStaffProfile(
          companyId,
          editing.id,
          input,
          active,
          editing.revision
        );
      } else {
        await createStaffProfile(companyId, input);
      }

      resetForm();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = employees.filter((employee) =>
    [
      employee.name,
      employee.email,
      employee.phone,
      employee.jobTitle,
      employee.role,
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <section className="panel employees-panel">
      <h2>Employees & Technicians</h2>

      <p>
        Manage staff profiles independently of ORVEX login
        accounts. Creating a profile does not grant system access.
      </p>

      {error && <p role="alert">{error} <button className="btn secondary" disabled={busy} onClick={()=>void load()}>Retry</button></p>}

      {busy && <p role="status">Loading employees…</p>}

      {owner && !adding && !editing && (
        <button
          className="btn primary"
          disabled={busy}
          onClick={startAdd}
        >
          Add Employee
        </button>
      )}

      {(adding || editing) && (
        <form
          className="employee-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h3>
            {editing ? 'Edit Employee' : 'Add Employee'}
          </h3>

          <fieldset disabled={busy}>
            <label>
              Full Name
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label>
              Phone
              <input
                maxLength={80}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>

            <label>
              Job Title
              <input
                maxLength={120}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </label>

            <label>
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {staffRoles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            {editing && (
              <label>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) =>
                    setActive(e.target.checked)
                  }
                />
                Active Employee
              </label>
            )}

            <button
              className="btn primary"
              type="submit"
            >
              {editing
                ? 'Save Changes'
                : 'Create Employee'}
            </button>

            <button
              className="btn secondary"
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          </fieldset>
        </form>
      )}

      <label>
        Search Employees
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((employee) => (
              <tr key={employee.id}>
                <td>
                  {employee.name}
                  <br />
                  <span>{employee.jobTitle}</span>
                </td>

                <td>{employee.role}</td>

                <td>
                  {employee.active
                    ? 'Active'
                    : 'Inactive'}
                </td>

                <td>
                  {owner && (
                    <button
                      className="btn secondary"
                      disabled={busy}
                      onClick={() =>
                        startEdit(employee)
                      }
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {!filtered.length && (
              <tr>
                <td colSpan={4}>
                  No employee profiles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        className="btn secondary"
        disabled={busy}
        onClick={() => void load()}
      >
        Refresh
      </button>
    </section>
  );
}

export default function CompanyEmployees({
  companyId,
  owner,
}: {
  companyId: string;
  owner: boolean;
}) {
  if (hostedSpark) {
    return (
      <SparkEmployees
        companyId={companyId}
        owner={owner}
      />
    );
  }

  return (
    <BackendEmployees
      companyId={companyId}
      owner={owner}
    />
  );
}
