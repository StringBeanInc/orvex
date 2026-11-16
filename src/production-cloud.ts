
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Data } from './data';
import { db } from './firebase';
import { resolveProductionCompanyId } from './production-company';

export const emptyProductionData = (): Data => ({
  version: 1,
  customers: [],
  properties: [],
  orders: [],
  technicians: [],
  catalog: [],
  activity: [],
  settings: {
    company: 'ORVEX',
    name: '',
    email: ''
  }
});

export async function verifyProductionMembership(
  user: User
): Promise<void> {
  await resolveProductionCompanyId(user);
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
  const lineItemSubscriptions = new Map<string, () => void>();
  const lineItemRecords = new Map<string, {
    revision: number;
    items: NonNullable<Data['orders'][number]['lineItems']>;
  }>();

  const emitRecords = () => {
    if (stopped || loaded.size !== 5) return;

    if (records.orders.some(order =>
      !lineItemRecords.has(order.id)
    )) return;

    onData({
      ...records,
      orders: records.orders.map(order => {
        const saved = lineItemRecords.get(order.id);

        return {
          ...order,
          lineItems: saved?.items ?? [],
          lineItemsRevision: saved?.revision ?? 0
        };
      })
    });
  };

  void resolveProductionCompanyId(user)
    .then(companyId => {
      if (stopped) return;

      const workflowUnsubscribe = onSnapshot(
        doc(
          db,
          'organizations',
          companyId,
          'workOrderSettings',
          'workflow'
        ),
        snapshot => {
          if (stopped || snapshot.metadata.fromCache) return;

          if (snapshot.exists()) {
            const value = snapshot.data();

            records.workOrderWorkflow = {
              statuses: value.statuses,
              defaultStatusId: value.defaultStatusId
            };
          } else {
            delete records.workOrderWorkflow;
          }

          loaded.add('workflow');

          emitRecords();
        },
        error => {
          if (!stopped) onError(error);
        }
      );

      unsubscribers.push(workflowUnsubscribe);

      const collections = [
        ['customers', 'customers'],
        ['properties', 'properties'],
        ['workOrders', 'orders'],
        ['lineItemCatalog', 'catalog']
      ] as const;

      for (const [collectionName, field] of collections) {
        const unsubscribe = onSnapshot(
          collection(
            db,
            'organizations',
            companyId,
            collectionName
          ),
          snapshot => {
            if (stopped || snapshot.metadata.fromCache) return;

            const visibleDocs = snapshot.docs;

            const documents = visibleDocs.map(item => ({
              ...mapProductionRecord(
                collectionName,
                item.id,
                item.data()
              ),
              id: item.id
            }));

            (records as unknown as Record<string, unknown>)[field] =
              documents;

            if (field === 'orders') {
              const orderIds = new Set(
                records.orders.map(order => order.id)
              );

              for (const [orderId, unsubscribe] of lineItemSubscriptions) {
                if (!orderIds.has(orderId)) {
                  unsubscribe();
                  lineItemSubscriptions.delete(orderId);
                  lineItemRecords.delete(orderId);
                }
              }

              for (const orderId of orderIds) {
                if (lineItemSubscriptions.has(orderId)) continue;

                const unsubscribe = onSnapshot(
                  doc(
                    db,
                    'organizations',
                    companyId,
                    'workOrders',
                    orderId,
                    'lineItems',
                    'current'
                  ),
                  lineSnapshot => {
                    if (stopped || lineSnapshot.metadata.fromCache) return;

                    if (lineSnapshot.exists()) {
                      const value = lineSnapshot.data();

                      lineItemRecords.set(orderId, {
                        revision: Number(value.revision ?? 0),
                        items: Array.isArray(value.items)
                          ? value.items
                          : []
                      });
                    } else {
                      lineItemRecords.set(orderId, {
                        revision: 0,
                        items: []
                      });
                    }

                    emitRecords();
                  },
                  error => {
                    if (!stopped) onError(error);
                  }
                );

                lineItemSubscriptions.set(orderId, unsubscribe);
              }
            }

            loaded.add(field);

            emitRecords();
          },
          error => {
            if (!stopped) onError(error);
          }
        );

        unsubscribers.push(unsubscribe);
      }
    })
    .catch(error => {
      if (!stopped) {
        onError(
          error instanceof Error
            ? error
            : new Error(String(error))
        );
      }
    });

  return () => {
    stopped = true;
    unsubscribers.forEach(unsubscribe => unsubscribe());
    lineItemSubscriptions.forEach(unsubscribe => unsubscribe());
  };
}

export function mapProductionRecord(
  kind: 'customers' | 'properties' | 'workOrders' | 'lineItemCatalog',
  id: string,
  value: Record<string, any>
) {
  const revision =
    typeof value.revision === 'number'
      ? value.revision
      : 0;

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
      contact: String(
        value.contact ?? value.contactName ?? ''
      ),
      email: String(value.email ?? ''),
      phone: String(value.phone ?? ''),
      streetAddress: String(
        value.streetAddress ?? value.address ?? ''
      ),
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
      address: String(
        value.address ?? value.streetAddress ?? ''
      ),
      customerId: String(value.customerId ?? ''),
      type: String(value.type ?? ''),
      city: String(value.city ?? ''),
      state: String(value.state ?? ''),
      postalCode: String(value.postalCode ?? '')
    };
  }

  if (kind === 'lineItemCatalog') {
    return {
      ...metadata,
      id,
      category: value.category,
      description: String(value.description ?? ''),
      unitCostCents: Number(value.unitCostCents ?? 0),
      baseCostCents: value.baseCostCents,
      markupPercent: value.markupPercent,
      markupCents: value.markupCents,
      details: value.details,
      materialUrl: value.materialUrl,
      skuCode: value.skuCode,
      includeTaxes: value.includeTaxes
    };
  }
  return {
    ...metadata,
    id,
    title: String(value.title ?? ''),
    description: String(value.description ?? ''),
    propertyId: String(value.propertyId ?? ''),
    technicianId: String(
      value.assignedTechnicianId ?? ''
    ),
    status: String(value.status ?? ''),
    type: String(value.serviceCategory ?? ''),
    priority:
      value.priority === 'Emergency'
        ? 'Urgent'
        : value.priority === 'Normal'
          ? 'Medium'
          : value.priority ?? 'Medium',
    scheduled:
      value.scheduledDate?.toDate?.()?.toISOString?.() ??
      (typeof value.scheduledDate === 'string'
        ? value.scheduledDate
        : ''),
    created:
      value.createdAt?.toDate?.()?.toISOString?.() ??
      String(value.created ?? '')
  };
}

export async function createProductionCustomer(
  user: User,
  customer: Data['customers'][number]
): Promise<void> {
  const companyId = await resolveProductionCompanyId(user);

  const ref = doc(
    db,
    'organizations',
    companyId,
    'customers',
    customer.id
  );

  await runTransaction(db, async transaction => {
    const existing = await transaction.get(ref);

    if (existing.exists()) {
      throw new Error('Customer already exists.');
    }

    const name = customer.name.trim();
    const contact = customer.contact.trim();
    const phone = customer.phone.trim();
    const email = customer.email.trim();

    if (
      !name ||
      (email !== '' &&
        !/^[^ @]+@[^ @]+[.][^ @]+$/.test(email))
    ) {
      throw new Error(
        'Customer name is required. Email must be valid if provided.'
      );
    }

    transaction.set(ref, {
      id: customer.id,
      companyId,
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

export async function createProductionProperty(
  user: User,
  property: Data['properties'][number]
): Promise<void> {
  const companyId = await resolveProductionCompanyId(user);

  const propertyRef = doc(
    db,
    'organizations',
    companyId,
    'properties',
    property.id
  );

  const customerRef = doc(
    db,
    'organizations',
    companyId,
    'customers',
    property.customerId
  );

  await runTransaction(db, async transaction => {
    const existingProperty =
      await transaction.get(propertyRef);

    const customer = await transaction.get(customerRef);

    if (existingProperty.exists()) {
      throw new Error('Property already exists.');
    }

    if (
      !customer.exists() ||
      customer.data().deletedAt != null ||
      customer.data().companyId !== companyId
    ) {
      throw new Error('Select an active customer.');
    }

    const name = property.name.trim();
    const address = property.address.trim();

    const allowedTypes = [
      'Office',
      'Residential',
      'Healthcare',
      'Commercial',
      'Industrial'
    ];

    if (
      !name ||
      !address ||
      !allowedTypes.includes(property.type)
    ) {
      throw new Error(
        'Property name, address, and a valid property type are required.'
      );
    }

    const customerData = customer.data();

    transaction.set(propertyRef, {
      id: property.id,
      companyId,
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
      propertyCount: customerData.propertyCount + 1,
      relationshipMutationId: property.id,
      revision: customerData.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid
    });
  });
}







