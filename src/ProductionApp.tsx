import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import App from './App';
import type { Data } from './data';
import type { DevelopmentCloud } from './cloud-contract';
import { subscribeProductionRecords, createProductionCustomer, createProductionProperty } from './production-cloud';

export default function ProductionApp({ user }: { user: User }) {
  const [cloud, setCloud] = useState<DevelopmentCloud | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setCloud(null);
    setError('');

    const listeners = new Set<(data: Data) => void>();
    let latest: Data | null = null;

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
            const addedCustomers = next.customers.filter(c => !base.customers.some(b => b.id === c.id));
            const addedProperties = next.properties.filter(p => !base.properties.some(b => b.id === p.id));

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
          recovery: 'Connected to production Firestore (read-only)',
          canEdit: false
        });
      },
      failure => setError(failure.message)
    );

    return () => {
      stop();
      listeners.clear();
    };
  }, [user]);

  if (error) return <div role="alert" style={{ padding: 32 }}>Firestore connection failed: {error}</div>;
  if (!cloud) return <div style={{ padding: 32 }}>Connecting to ORVEX Firestore...</div>;

  return <App cloud={cloud} />;
}
