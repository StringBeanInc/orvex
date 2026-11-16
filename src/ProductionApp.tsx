import { saveProductionWorkOrderLineItems } from './production-work-order-lines';
import { saveProductionCatalogItem } from './production-catalog';
import { useEffect, useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import App from './App';
import type { Data } from './data';
import type { DevelopmentCloud } from './cloud-contract';
import { subscribeProductionRecords, createProductionCustomer, createProductionProperty } from './production-cloud';
import { createProductionWorkOrder, updateProductionWorkOrder } from './production-work-orders';
import { initializeProductionWorkflow } from './production-workflow';

export default function ProductionApp({ user }: { user: User }) {
  const [cloud, setCloud] = useState<DevelopmentCloud | null>(null);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setCloud(null);
    setError('');
    setSessionExpired(false);
    let active = true;
    const handleFailure = (failure: unknown) => {
      if (!active) return;
      const code = typeof failure === 'object' && failure !== null && 'code' in failure ? failure.code : '';
      setSessionExpired(['auth/invalid-refresh-token', 'auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled', 'auth/user-not-found'].includes(String(code)));
      setError(failure instanceof Error ? failure.message : String(failure));
    };

    const listeners = new Set<(data: Data) => void>();
    let latest: Data | null = null;

    void initializeProductionWorkflow(user).catch(handleFailure);

    const stop = subscribeProductionRecords(
      user,
      data => {
        latest = data;
        listeners.forEach(listener => listener(data));

        setCloud(existing => existing ?? {
          initial: data,
          subscribe: listener => {
            listeners.add(listener);
            if (latest) listener(latest);
            return () => { listeners.delete(listener); };
          },
          save: async (base, next) => {
            const catalogChanged =
              JSON.stringify(base.catalog ?? []) !==
              JSON.stringify(next.catalog ?? []);

            if (catalogChanged) {
              const removed = (base.catalog ?? []).filter(
                item => !(next.catalog ?? []).some(n => n.id === item.id)
              );

              if (removed.length > 0) {
                throw new Error(
                  'Catalog deletion is not enabled yet.'
                );
              }

              const changed = (next.catalog ?? []).filter(item => {
                const previous = (base.catalog ?? []).find(
                  b => b.id === item.id
                );
                return !previous ||
                  JSON.stringify(previous) !== JSON.stringify(item);
              });

              if (changed.length !== 1) {
                throw new Error(
                  'Save one catalog item at a time.'
                );
              }

              const item = changed[0];

              if (item.receipts?.length) {
                throw new Error(
                  'Catalog receipt attachments are not enabled yet.'
                );
              }

              if (
                JSON.stringify(base.customers) !== JSON.stringify(next.customers) ||
                JSON.stringify(base.properties) !== JSON.stringify(next.properties) ||
                JSON.stringify(base.orders) !== JSON.stringify(next.orders)
              ) {
                throw new Error(
                  'Catalog changes must be saved separately.'
                );
              }

              const result = await saveProductionCatalogItem(item);

              return {
                ...next,
                catalog: (next.catalog ?? []).map(entry =>
                  entry.id === result.id
                    ? { ...entry, revision: result.revision }
                    : entry
                )
              };
            }

            const addedCustomers = next.customers.filter(c => !base.customers.some(b => b.id === c.id));
            const addedProperties = next.properties.filter(p => !base.properties.some(b => b.id === p.id));

            const addedOrders = next.orders.filter(o => !base.orders.some(b => b.id === o.id));

            const changedOrders = next.orders.filter(order => {
              const previous = base.orders.find(b => b.id === order.id);
              return previous && (
                previous.title !== order.title ||
                previous.description !== order.description ||
                previous.type !== order.type ||
                previous.status !== order.status ||
                previous.priority !== order.priority ||
                previous.propertyId !== order.propertyId ||
                previous.technicianId !== order.technicianId ||
                previous.scheduled !== order.scheduled ||
                JSON.stringify(previous.lineItems ?? []) !== JSON.stringify(order.lineItems ?? [])
              );
            });

            if (
              changedOrders.length === 1 &&
              addedOrders.length === 0 &&
              addedCustomers.length === 0 &&
              addedProperties.length === 0 &&
              next.orders.length === base.orders.length &&
              next.customers.length === base.customers.length &&
              next.properties.length === base.properties.length
            ) {
              const updated = changedOrders[0];
              const previous = base.orders.find(o => o.id === updated.id);

              if (!previous) {
                throw new Error('Original work order was not found.');
              }

              const lineItemsChanged =
                JSON.stringify(previous.lineItems ?? []) !==
                JSON.stringify(updated.lineItems ?? []);

              if (lineItemsChanged) {
                const headerChanged =
                  previous.title !== updated.title ||
                  previous.description !== updated.description ||
                  previous.type !== updated.type ||
                  previous.status !== updated.status ||
                  previous.priority !== updated.priority ||
                  previous.propertyId !== updated.propertyId ||
                  previous.technicianId !== updated.technicianId ||
                  previous.scheduled !== updated.scheduled;

                if (headerChanged) {
                  throw new Error(
                    'Save work-order Line Items separately from other changes.'
                  );
                }

                const result = await saveProductionWorkOrderLineItems(
                  user,
                  updated.id,
                  previous.lineItemsRevision ?? 0,
                  updated.lineItems ?? []
                );

                return {
                  ...next,
                  orders: next.orders.map(order =>
                    order.id === updated.id
                      ? {
                          ...order,
                          lineItemsRevision: result.revision
                        }
                      : order
                  )
                };
              }

              await updateProductionWorkOrder(user, previous, updated);
              return next;
            }

            if (addedOrders.length === 1 &&
                addedCustomers.length === 0 &&
                addedProperties.length === 0 &&
                next.orders.length === base.orders.length + 1) {
              await createProductionWorkOrder(user, addedOrders[0]);
              return next;
            }

            if (next.orders.length !== base.orders.length ||
                (addedCustomers.length === 1 && addedProperties.length !== 0) ||
                (addedProperties.length === 1 && addedCustomers.length !== 0) ||
                (addedCustomers.length !== 1 && addedProperties.length !== 1)) {
              throw new Error('This production operation is not enabled yet.');
            }

            if (addedCustomers.length === 1) {
              await createProductionCustomer(user, addedCustomers[0]);
            } else {
              await createProductionProperty(user, addedProperties[0]);
            }
            return next;
          },
          recovery: 'Connected to Firebase Firestore',
          canEdit: import.meta.env.DEV &&
                   import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT === 'demo-orvex'
        });
      },
      handleFailure
    );

    return () => {
      active = false;
      stop();
      listeners.clear();
    };
  }, [user]);

  if (error) return <div role="alert" style={{ padding: 32 }}>
    <h2>{sessionExpired ? 'Please sign in again' : 'Unable to connect to ORVEX'}</h2>
    <p style={{ margin: '12px 0' }}>{sessionExpired ? 'Your saved sign-in session is no longer valid. Sign in again to reconnect.' : error}</p>
    {sessionExpired && <button type="button" className="btn primary" disabled={signingOut} onClick={async () => {
      setSigningOut(true);
      try {
        await signOut(auth);
        window.location.replace('/account?mode=login');
      } catch {
        setError('Unable to end the expired session. Please try again.');
        setSigningOut(false);
      }
    }}>{signingOut ? 'Opening sign in…' : 'Sign in again'}</button>}
  </div>;
  if (!cloud) return <div style={{ padding: 32 }}>Connecting to ORVEX Firestore...</div>;

  return <App cloud={cloud} />;
}







