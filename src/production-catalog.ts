import { httpsCallable } from 'firebase/functions';
import type { CatalogItem } from './data';
import { auth, functions } from './firebase';
import { resolveProductionCompanyId } from './production-company';

type CatalogSaveResult = {
  id: string;
  revision: number;
};

export async function saveProductionCatalogItem(
  item: CatalogItem
): Promise<CatalogSaveResult> {
    const user = auth.currentUser;

  if (!user) {
    throw new Error('Sign in before saving catalog items.');
  }

  const companyId = await resolveProductionCompanyId(user);

  if (!companyId) {
    throw new Error('No active company selected.');
  }

  const fields = [
    'category',
    'description',
    'unitCostCents',
    'baseCostCents',
    'markupPercent',
    'markupCents',
    'details',
    'materialUrl',
    'skuCode',
    'includeTaxes'
  ] as const;

  const cleanItem: Record<string, unknown> = {};

  for (const field of fields) {
    const value = item[field];

    if (value !== undefined) {
      cleanItem[field] = value;
    }
  }

  const callable = httpsCallable<
    {
      companyId: string;
      id: string;
      expectedRevision: number;
      item: Record<string, unknown>;
    },
    CatalogSaveResult
  >(functions, 'saveCatalogItem');

  const response = await callable({
    companyId,
    id: item.id,
    expectedRevision: item.revision ?? 0,
    item: cleanItem
  });

  return response.data;
}

