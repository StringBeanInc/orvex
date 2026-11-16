import { httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import type { LineItem } from './data';
import { functions } from './firebase';
import { resolveProductionCompanyId } from './production-company';

type SaveResult = {
  workOrderId: string;
  revision: number;
  totalCents: number;
};

export async function saveProductionWorkOrderLineItems(
  user: User,
  workOrderId: string,
  expectedRevision: number,
  items: LineItem[]
): Promise<SaveResult> {
  const companyId = await resolveProductionCompanyId(user);

  if (!companyId) {
    throw new Error('No active company selected.');
  }

  const cleanItems = items.map(item => {
    if (item.receipts?.length) {
      throw new Error(
        'Line-item receipt attachments are not enabled yet.'
      );
    }

    return {
      id: item.id,
      ...(item.catalogItemId
        ? { catalogItemId: item.catalogItemId }
        : {}),
      category: item.category,
      description: item.description,
      ...(item.details !== undefined
        ? { details: item.details }
        : {}),
      ...(item.materialUrl !== undefined
        ? { materialUrl: item.materialUrl }
        : {}),
      ...(item.skuCode !== undefined
        ? { skuCode: item.skuCode }
        : {}),
      ...(item.includeTaxes !== undefined
        ? { includeTaxes: item.includeTaxes }
        : {}),
      quantity: item.quantity,
      unitCostCents: item.unitCostCents
    };
  });

  const callable = httpsCallable<
    {
      companyId: string;
      workOrderId: string;
      expectedRevision: number;
      items: typeof cleanItems;
    },
    SaveResult
  >(functions, 'saveWorkOrderLineItems');

  const response = await callable({
    companyId,
    workOrderId,
    expectedRevision,
    items: cleanItems
  });

  return response.data;
}
