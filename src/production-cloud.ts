import { collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Data } from './data';
import { db } from './firebase';

export const productionCompanyId = 'cdIqu7W9joFMiYucuNHl';

export const emptyProductionData = (): Data => ({
  version: 1,
  customers: [],
  properties: [],
  orders: [],
  technicians: [],
  catalog: [],
  activity: [],
  settings: {
    company: 'String Bean Inc.',
    name: '',
    email: ''
  }
});

export async function verifyProductionMembership(user: User): Promise<void> {
  await user.getIdToken(true);

  if (!user.emailVerified) {
    throw new Error('A verified email address is required.');
  }

  const member = await getDoc(
    doc(db, 'organizations', productionCompanyId, 'members', user.uid)
  );

  const value = member.data();

  if (
    !member.exists() ||
    value?.uid !== user.uid ||
    value?.companyId !== productionCompanyId ||
    value?.active !== true ||
    (value?.status !== undefined && value.status !== 'active')
  ) {
    throw new Error('You do not have an active ORVEX company membership.');
  }
}

export function subscribeProductionRecords(
  user: User,
  onData: (data: Data) => void,
  onError: (error: Error) => void
): () => void {
  let stopped = false;
  const unsubscribers: Array<() => void> = [];
  const records = emptyProductionData();
  const loaded = new Set<string>();

  void verifyProductionMembership(user).then(() => {
    if (stopped) return;

    const collections = [
      ['customers', 'customers'],
      ['properties', 'properties'],
      ['workOrders', 'orders']
    ] as const;

    for (const [collectionName, field] of collections) {
      const unsubscribe = onSnapshot(
        collection(db, 'organizations', productionCompanyId, collectionName),
        snapshot => {
          if (stopped || snapshot.metadata.fromCache) return;

          const documents = snapshot.docs.map(item => ({
            ...mapProductionRecord(collectionName, item.id, item.data()),
            id: item.id
          }));

          (records as unknown as Record<string, unknown>)[field] = documents;
          loaded.add(field);

          if (loaded.size === collections.length) {
            onData({ ...records });
          }
        },
        error => {
          if (!stopped) onError(error);
        }
      );

      unsubscribers.push(unsubscribe);
    }
  }).catch(error => {
    if (!stopped) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return () => {
    stopped = true;
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
}

export function mapProductionRecord(
  kind: 'customers' | 'properties' | 'workOrders',
  id: string,
  value: Record<string, any>
) {
  const revision = typeof value.revision === 'number' ? value.revision : 0;
  const metadata = {
    revision,
    deletedAt: value.deletedAt ?? null,
    deletedBy: value.deletedBy ?? null
  };

  if (kind === 'customers') {
    return {
      ...metadata,
      id,
      name: String(value.name ?? ''),
      contact: String(value.contact ?? value.contactName ?? ''),
      email: String(value.email ?? ''),
      phone: String(value.phone ?? ''),
      streetAddress: String(value.streetAddress ?? value.address ?? ''),
      city: String(value.city ?? ''),
      state: String(value.state ?? ''),
      postalCode: String(value.postalCode ?? '')
    };
  }

  if (kind === 'properties') {
    return {
      ...metadata,
      id,
      name: String(value.name ?? ''),
      address: String(value.address ?? value.streetAddress ?? ''),
      customerId: String(value.customerId ?? ''),
      type: String(value.type ?? ''),
      city: String(value.city ?? ''),
      state: String(value.state ?? ''),
      postalCode: String(value.postalCode ?? '')
    };
  }

  return {
    ...metadata,
    id,
    title: String(value.title ?? ''),
    description: String(value.description ?? ''),
    propertyId: String(value.propertyId ?? ''),
    technicianId: String(value.assignedTechnicianId ?? ''),
    status: value.status === 'New' ? 'Open' : String(value.status ?? 'Open'),
    priority: value.priority === 'Emergency' ? 'Urgent' :
      value.priority === 'Normal' ? 'Medium' :
      value.priority ?? 'Medium',
    scheduled: value.scheduledDate?.toDate?.()?.toISOString?.() ?? (typeof value.scheduledDate === 'string' ? value.scheduledDate : ''),
    created: value.createdAt?.toDate?.()?.toISOString?.() ??
      String(value.created ?? '')
  };
}





export async function createProductionCustomer(user: User, customer: Data['customers'][number]): Promise<void> {
  await verifyProductionMembership(user);

  const ref = doc(db, 'organizations', productionCompanyId, 'customers', customer.id);

  await runTransaction(db, async transaction => {
    const existing = await transaction.get(ref);
    if (existing.exists()) throw new Error('Customer already exists.');

    const name = customer.name.trim();
    const contact = customer.contact.trim();
    const phone = customer.phone.trim();
    const email = customer.email.trim();

    if (!name || (email !== '' && !/^[^ @]+@[^ @]+[.][^ @]+$/.test(email))) {
      throw new Error('Customer name is required. Email must be valid if provided.');
    }

    transaction.set(ref, {
      id: customer.id,
      companyId: productionCompanyId,
      schemaVersion: 1,
      revision: 1,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
      deletedAt: null,
      deletedBy: null,
      recoverUntil: null,
      name,
      contact,
      phone,
      email,
      streetAddress: customer.streetAddress ?? '',
      addressLine2: customer.addressLine2 ?? '',
      city: customer.city ?? '',
      state: customer.state ?? '',
      postalCode: customer.postalCode ?? '',
      country: customer.country ?? '',
      propertyCount: 0,
      relationshipMutationId: ''
    });
  });
}



export async function createProductionProperty(user: User, property: Data['properties'][number]): Promise<void> {
  await verifyProductionMembership(user);

  const propertyRef = doc(db, 'organizations', productionCompanyId, 'properties', property.id);
  const customerRef = doc(db, 'organizations', productionCompanyId, 'customers', property.customerId);

  await runTransaction(db, async transaction => {
    const existingProperty = await transaction.get(propertyRef);
    const customer = await transaction.get(customerRef);

    if (existingProperty.exists()) throw new Error('Property already exists.');
    if (!customer.exists() || customer.data().deletedAt != null) {
      throw new Error('Select an active customer.');
    }

    const name = property.name.trim();
    const address = property.address.trim();
    const allowedTypes = ['Office', 'Residential', 'Healthcare', 'Commercial', 'Industrial'];

    if (!name || !address || !allowedTypes.includes(property.type)) {
      throw new Error('Property name, address, and a valid property type are required.');
    }

    transaction.set(propertyRef, {
      id: property.id,
      companyId: productionCompanyId,
      schemaVersion: 1,
      revision: 1,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
      deletedAt: null,
      deletedBy: null,
      recoverUntil: null,
      name,
      address,
      city: property.city ?? '',
      state: property.state ?? '',
      postalCode: property.postalCode ?? '',
      type: property.type,
      customerId: property.customerId,
      workOrderCount: 0,
      workOrderMutationId: ''
    });

    transaction.update(customerRef, {
      propertyCount: customer.data().propertyCount + 1,
      relationshipMutationId: property.id,
      revision: customer.data().revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid
    });
  });
}
