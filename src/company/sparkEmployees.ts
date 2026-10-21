
import {
  collection,
  doc,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
  runTransaction,
} from 'firebase/firestore';

import { getCompanyCloudServices } from '../firebase';
import { companyScope } from './directoryRepository';

export type StaffProfile = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  role: string;
  active: boolean;
  revision: number;
};

export type StaffProfileInput = {
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  role: string;
};

const staffRoles = [
  'Administrator',
  'Manager',
  'Office Staff',
  'Technician',
] as const;

function validate(input: StaffProfileInput) {
  const name = input.name.trim();
  const email = (input.email || '').trim().toLowerCase();
  const phone = (input.phone || '').trim();
  const jobTitle = (input.jobTitle || '').trim();

  if (!name || name.length > 120) {
    throw Error('Employee name must be 1–120 characters.');
  }

  if (email.length > 254) {
    throw Error('Employee email is too long.');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Error('Enter a valid employee email.');
  }

  if (phone.length > 80 || jobTitle.length > 120) {
    throw Error('Phone or job title is too long.');
  }

  if (!staffRoles.includes(input.role as typeof staffRoles[number])) {
    throw Error('Choose a valid employee role.');
  }

  return {
    name,
    email,
    phone,
    jobTitle,
    role: input.role,
  };
}

export async function listStaffProfiles(
  companyId: string
): Promise<StaffProfile[]> {
  const { db, cid } = await companyScope(companyId);

  const snapshot = await getDocsFromServer(
    collection(db, 'organizations', cid, 'staffProfiles')
  );

  return snapshot.docs.map((row) => ({
    ...row.data(),
    id: row.id,
  })) as StaffProfile[];
}

export async function createStaffProfile(
  companyId: string,
  input: StaffProfileInput
): Promise<string> {
  const { db, cid } = await companyScope(companyId);
  const { auth } = await getCompanyCloudServices();

  if (!auth.currentUser?.emailVerified) {
    throw Error('Verified company sign-in required.');
  }

  const values = validate(input);
  const ref = doc(
    collection(db, 'organizations', cid, 'staffProfiles')
  );

  await setDoc(ref, {
    id: ref.id,
    companyId: cid,
    ...values,
    active: true,
    revision: 1,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
  });

  return ref.id;
}

export async function updateStaffProfile(
  companyId: string,
  employeeId: string,
  input: StaffProfileInput,
  active: boolean,
  expectedRevision: number
): Promise<void> {
  const { db, cid } = await companyScope(companyId);
  const { auth } = await getCompanyCloudServices();

  if (!auth.currentUser?.emailVerified) {
    throw Error('Verified company sign-in required.');
  }

  const values = validate(input);

  await runTransaction(db, async transaction => {
    const ref = doc(db, 'organizations', cid, 'staffProfiles', employeeId);
    const current = await transaction.get(ref);
    if (!current.exists() || current.data().revision !== expectedRevision) {
      throw Error('Save conflict: refresh employees and review the latest record.');
    }
    transaction.update(ref, {...values, active, revision: expectedRevision + 1,
      updatedAt: serverTimestamp(), updatedBy: auth.currentUser!.uid});
  });
}
