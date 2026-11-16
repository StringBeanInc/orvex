
import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

export async function resolveProductionCompanyId(
  user: User
): Promise<string> {
  await user.reload();
  await user.getIdToken(true);

  if (!user.emailVerified) {
    throw new Error('A verified email address is required.');
  }

  const userSnapshot = await getDoc(doc(db, 'users', user.uid));

  if (!userSnapshot.exists()) {
    throw new Error(
      'Your company registration is incomplete. Please finish company setup.'
    );
  }

  const companyId = userSnapshot.data().companyId;

  if (
    typeof companyId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(companyId)
  ) {
    throw new Error('Your ORVEX company assignment is invalid.');
  }

  const membershipSnapshot = await getDoc(
    doc(db, 'organizations', companyId, 'members', user.uid)
  );

  if (!membershipSnapshot.exists()) {
    throw new Error('You do not have an active ORVEX company membership.');
  }

  const membership = membershipSnapshot.data();

  if (
    membership.uid !== user.uid ||
    membership.companyId !== companyId ||
    membership.active !== true ||
    (membership.status !== undefined && membership.status !== 'active')
  ) {
    throw new Error('You do not have an active ORVEX company membership.');
  }

  return companyId;
}
