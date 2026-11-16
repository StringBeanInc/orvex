
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { WorkOrder } from './data';
import { db } from './firebase';
import { resolveProductionCompanyId } from './production-company';

export async function createProductionWorkOrder(
  user: User,
  order: WorkOrder
): Promise<void> {

  const companyId = await resolveProductionCompanyId(user);

  const title = order.title.trim();
  const description = order.description.trim();
  const propertyId = order.propertyId.trim();

  if (!title || title.length > 200) {
    throw new Error(
      'A work-order title is required (maximum 200 characters).'
    );
  }

  if (!description || description.length > 12000) {
    throw new Error(
      'A work-order description is required (maximum 12000 characters).'
    );
  }

  if (!propertyId) {
    throw new Error('Select a property before creating the work order.');
  }

  const workflowRef = doc(
    db, 'organizations', companyId, 'workOrderSettings', 'workflow'
  );
  const sequenceRef = doc(
    db, 'organizations', companyId, 'numberSequences', 'workOrders'
  );
  const propertyRef = doc(
    db, 'organizations', companyId, 'properties', propertyId
  );
  const workOrderRef = doc(
    db, 'organizations', companyId, 'workOrders', crypto.randomUUID()
  );

  await runTransaction(db, async transaction => {
    const workflowSnapshot = await transaction.get(workflowRef);
    const sequenceSnapshot = await transaction.get(sequenceRef);
    const propertySnapshot = await transaction.get(propertyRef);
    const existingWorkOrder = await transaction.get(workOrderRef);

    if (!workflowSnapshot.exists()) {
      throw new Error('Company work-order workflow is not configured.');
    }

    if (!propertySnapshot.exists() || propertySnapshot.data().deletedAt != null) {
      throw new Error('The selected property is unavailable.');
    }

    if (existingWorkOrder.exists()) {
      throw new Error('Work-order ID already exists.');
    }

    const sequence = sequenceSnapshot.exists()
      ? sequenceSnapshot.data()
      : null;

    const property = propertySnapshot.data();

    if (
      sequence !== null &&
      (
        sequence.companyId !== companyId ||
        !Number.isSafeInteger(sequence.nextNumber) ||
        sequence.nextNumber < 2 ||
        sequence.nextNumber > 1000000000 ||
        !Number.isSafeInteger(sequence.revision) ||
        sequence.revision < 1
      )
    ) {
      throw new Error('Invalid work-order numbering sequence.');
    }

    if (
      property.companyId !== companyId ||
      typeof property.customerId !== 'string' ||
      !property.customerId.trim() ||
      !Number.isSafeInteger(property.revision) ||
      property.revision < 1
    ) {
      throw new Error('Invalid property data.');
    }

    const customerRef = doc(
      db, 'organizations', companyId, 'customers', property.customerId
    );

    const customerSnapshot = await transaction.get(customerRef);

    if (
      !customerSnapshot.exists() ||
      customerSnapshot.data().deletedAt != null ||
      customerSnapshot.data().companyId !== companyId
    ) {
      throw new Error(
        'The selected property belongs to an unavailable customer.'
      );
    }

    const currentWorkOrderCount = property.workOrderCount ?? 0;

    if (
      !Number.isSafeInteger(currentWorkOrderCount) ||
      currentWorkOrderCount < 0
    ) {
      throw new Error('Invalid property work-order count.');
    }

    const allocatedNumber = sequence ? sequence.nextNumber : 1;
    const activityId = `${workOrderRef.id}-r1`;

    const activityRef = doc(
      db,
      'organizations',
      companyId,
      'workOrders',
      workOrderRef.id,
      'activity',
      activityId
    );

    if (activityId.length > 128) {
      throw new Error('Invalid work-order activity ID.');
    }

    const scheduledDate = toProductionCalendarDate(order.scheduled);

    const priority =
      order.priority === 'Urgent' ? 'Emergency' :
      order.priority === 'Medium' ? 'Normal' :
      order.priority;

    if (!['Low', 'Normal', 'High', 'Emergency'].includes(priority)) {
      throw new Error('Invalid work-order priority.');
    }

    const serviceCategory =
      order.type?.trim() || 'General Maintenance';

    if (serviceCategory.length > 80) {
      throw new Error('Service category exceeds 80 characters.');
    }

    const timestamp = serverTimestamp();
    const actorUid = user.uid;
    const workflow = workflowSnapshot.data();
    const statuses = workflow.statuses;
    const defaultStatusId = workflow.defaultStatusId;

    if (
      workflow.companyId !== companyId ||
      !Array.isArray(statuses) ||
      typeof defaultStatusId !== 'string'
    ) {
      throw new Error('Invalid company work-order workflow.');
    }

    const defaultStatus = statuses.find(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        item.id === defaultStatusId
    );

    if (
      !defaultStatus ||
      defaultStatus.archived === true ||
      defaultStatus.active === false ||
      typeof defaultStatus.name !== 'string' ||
      !defaultStatus.name.trim() ||
      defaultStatus.name.length > 80
    ) {
      throw new Error(
        'The company default work-order status is invalid or archived.'
      );
    }

    const status = defaultStatus.name;

    if (
      !Array.isArray(workflow.activeStatusNames) ||
      !workflow.activeStatusNames.includes(status)
    ) {
      throw new Error(
        'The default work-order status is not in the active workflow.'
      );
    }

    transaction.set(workOrderRef, {
      id: workOrderRef.id,
      companyId,
      schemaVersion: 1,
      revision: 1,
      number: allocatedNumber,
      customerId: property.customerId,
      propertyId,
      title,
      description,
      serviceCategory,
      priority,
      status,
      assignedTechnicianId: '',
      scheduledDate,
      dueDate: '',
      internalNotes: '',
      createdAt: timestamp,
      createdBy: actorUid,
      updatedAt: timestamp,
      updatedBy: actorUid,
      lastActivityId: activityId
    });

    transaction.set(activityRef, {
      id: activityId,
      companyId,
      workOrderId: workOrderRef.id,
      revision: 1,
      actorUid,
      at: timestamp,
      created: true,
      statusChanged: false,
      priorityChanged: false,
      assignmentChanged: false,
      schedulingChanged: false,
      notesAdded: false,
      beforeStatus: '',
      afterStatus: status,
      beforePriority: '',
      afterPriority: priority,
      beforeAssignment: '',
      afterAssignment: '',
      beforeScheduled: '',
      afterScheduled: scheduledDate,
      beforeDue: '',
      afterDue: '',
      notes: ''
    });

    transaction.update(propertyRef, {
      workOrderCount: currentWorkOrderCount + 1,
      workOrderMutationId: workOrderRef.id,
      revision: property.revision + 1,
      updatedAt: timestamp,
      updatedBy: actorUid
    });

    if (sequence === null) {
      transaction.set(sequenceRef, {
        companyId,
        schemaVersion: 1,
        nextNumber: 2,
        revision: 1,
        lastWorkOrderId: workOrderRef.id,
        updatedAt: timestamp,
        updatedBy: actorUid
      });
    } else {
      transaction.update(sequenceRef, {
        nextNumber: allocatedNumber + 1,
        revision: sequence.revision + 1,
        lastWorkOrderId: workOrderRef.id,
        updatedAt: timestamp,
        updatedBy: actorUid
      });
    }
  });
}

export function toProductionCalendarDate(value: string): string {
  if (!value) return '';

  const date = value.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid scheduled date.');
  }

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1900 ||
    year > 2200 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('Invalid scheduled date.');
  }

  return date;
}


export async function updateProductionWorkOrder(
  user: User,
  base: WorkOrder,
  next: WorkOrder
): Promise<void> {
  if (base.id !== next.id) {
    throw new Error('Work-order identity cannot be changed.');
  }

  if (!Number.isSafeInteger(base.revision) || !base.revision || base.revision < 1) {
    throw new Error('Work-order revision is missing. Refresh and try again.');
  }

  const unchanged = (
    base.propertyId === next.propertyId &&
    base.technicianId === next.technicianId &&
    base.scheduled === next.scheduled &&
    base.created === next.created &&
    JSON.stringify(base.lineItems ?? []) === JSON.stringify(next.lineItems ?? [])
  );

  if (!unchanged) {
    throw new Error(
      'Property, assignment, scheduling, and Line Items editing are not enabled yet.'
    );
  }

  const title = next.title.trim();
  const description = next.description.trim();
  const serviceCategory = next.type?.trim() || 'General Maintenance';
  const status = next.status.trim();

  const priority =
    next.priority === 'Urgent' ? 'Emergency' :
    next.priority === 'Medium' ? 'Normal' :
    next.priority;

  if (!title || title.length > 200) {
    throw new Error('A work-order title is required (maximum 200 characters).');
  }

  if (!description || description.length > 12000) {
    throw new Error('A work-order description is required (maximum 12000 characters).');
  }

  if (!serviceCategory || serviceCategory.length > 80) {
    throw new Error('Invalid service category.');
  }

  if (!['Low', 'Normal', 'High', 'Emergency'].includes(priority)) {
    throw new Error('Invalid work-order priority.');
  }

  if (!status || status.length > 80) {
    throw new Error('Invalid work-order status.');
  }

  const companyId = await resolveProductionCompanyId(user);

  const workOrderRef = doc(
    db, 'organizations', companyId, 'workOrders', base.id
  );

  const workflowRef = doc(
    db, 'organizations', companyId, 'workOrderSettings', 'workflow'
  );

  await runTransaction(db, async transaction => {
    const workOrderSnapshot = await transaction.get(workOrderRef);
    const workflowSnapshot = await transaction.get(workflowRef);

    if (!workOrderSnapshot.exists()) {
      throw new Error('Work order no longer exists.');
    }

    const current = workOrderSnapshot.data();

    if (
      current.companyId !== companyId ||
      current.deletedAt != null ||
      current.revision !== base.revision
    ) {
      throw new Error('Work order changed elsewhere. Refresh before editing.');
    }

    if (!workflowSnapshot.exists()) {
      throw new Error('Company work-order workflow is unavailable.');
    }

    const workflow = workflowSnapshot.data();

    if (
      workflow.companyId !== companyId ||
      !Array.isArray(workflow.activeStatusNames) ||
      !workflow.activeStatusNames.includes(status)
    ) {
      throw new Error('The selected status is not active in this company.');
    }

    const revision = current.revision + 1;
    const activityId = `${base.id}-r${revision}`;

    if (activityId.length > 128) {
      throw new Error('Invalid work-order activity ID.');
    }

    const activityRef = doc(
      db,
      'organizations',
      companyId,
      'workOrders',
      base.id,
      'activity',
      activityId
    );

    const activitySnapshot = await transaction.get(activityRef);

    if (activitySnapshot.exists()) {
      throw new Error('Work-order activity revision already exists.');
    }

    const timestamp = serverTimestamp();

    transaction.update(workOrderRef, {
      title,
      description,
      serviceCategory,
      priority,
      status,
      revision,
      updatedAt: timestamp,
      updatedBy: user.uid,
      lastActivityId: activityId
    });

    transaction.set(activityRef, {
      id: activityId,
      companyId,
      workOrderId: base.id,
      revision,
      actorUid: user.uid,
      at: timestamp,
      created: false,
      statusChanged: current.status !== status,
      priorityChanged: current.priority !== priority,
      assignmentChanged: false,
      schedulingChanged: false,
      notesAdded: false,
      beforeStatus: current.status,
      afterStatus: status,
      beforePriority: current.priority,
      afterPriority: priority,
      beforeAssignment: current.assignedTechnicianId,
      afterAssignment: current.assignedTechnicianId,
      beforeScheduled: current.scheduledDate,
      afterScheduled: current.scheduledDate,
      beforeDue: current.dueDate,
      afterDue: current.dueDate,
      notes: current.internalNotes
    });
  });
}
