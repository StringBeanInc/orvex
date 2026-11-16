import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { resolveProductionCompanyId } from './production-company';

import type { WorkOrderWorkflow } from './data';

export function getActiveStatusNames(
  workflow: WorkOrderWorkflow
): string[] {
  if (
    !Array.isArray(workflow.statuses) ||
    workflow.statuses.length < 1 ||
    workflow.statuses.length > 50
  ) {
    throw new Error(
      'A workflow must contain between 1 and 50 statuses.'
    );
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  const activeNames: string[] = [];

  for (const status of workflow.statuses) {
    const name = status.name.trim();

    if (
      !status.id ||
      status.id.length > 80 ||
      !name ||
      name.length > 80
    ) {
      throw new Error(
        'Every status requires a valid ID and name.'
      );
    }

    if (
      ids.has(status.id) ||
      names.has(name.toLowerCase())
    ) {
      throw new Error(
        'Duplicate status IDs or names are not allowed.'
      );
    }

    ids.add(status.id);
    names.add(name.toLowerCase());

    if (!status.archived) {
      activeNames.push(name);
    }
  }

  const defaultStatus = workflow.statuses.find(
    status => status.id === workflow.defaultStatusId
  );

  if (!defaultStatus || defaultStatus.archived) {
    throw new Error(
      'The default status must exist and be active.'
    );
  }

  return activeNames;
}


export async function initializeProductionWorkflow(
  user: User
): Promise<void> {
  const companyId = await resolveProductionCompanyId(user);

  const workflowRef = doc(
    db,
    'organizations',
    companyId,
    'workOrderSettings',
    'workflow'
  );

  const statuses = [
    { id: 'open', name: 'Open', color: '#2f6eb7', terminal: false },
    { id: 'in-progress', name: 'In progress', color: '#187457', terminal: false },
    { id: 'completed', name: 'Completed', color: '#64748b', terminal: true },
    { id: 'closed', name: 'Closed', color: '#475569', terminal: true }
  ];

  const workflow: WorkOrderWorkflow = {
    defaultStatusId: 'open',
    statuses
  };

  const activeStatusNames = getActiveStatusNames(workflow);

  await runTransaction(db, async transaction => {
    const existing = await transaction.get(workflowRef);

    if (existing.exists()) return;

    transaction.set(workflowRef, {
      companyId,
      schemaVersion: 1,
      revision: 1,
      statuses,
      activeStatusNames,
      defaultStatusId: workflow.defaultStatusId,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid
    });
  });
}
