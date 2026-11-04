import type {DashboardPreferences, Status, WorkOrderWorkflow} from '../data';
import {dashboardStages} from './stages';

export type DashboardStatusTotals = {
  total: number;
  stages: Record<string, number>;
  unmapped: Status[];
};

const legacyStatusIdsByName: Record<string, string> = {
  open: 'open',
  'in progress': 'in-progress',
  completed: 'completed',
  closed: 'closed',
};

const normalized = (value: string) => value.trim().toLocaleLowerCase();

/**
 * Resolves a status through the company's Dashboard stage assignments.
 * A status can produce one stage only; ambiguous and unassigned values stay unmapped.
 */
export function resolveDashboardStage(status: Status, workflow?: WorkOrderWorkflow, preferences?: DashboardPreferences): string | undefined {
  const stages = dashboardStages(preferences);
  const matchingDefinitions = workflow?.statuses.filter(definition => normalized(definition.name) === normalized(status)) ?? [];
  const matchingIds = matchingDefinitions.map(definition => definition.id);
  const statusId = matchingIds.length === 1 ? matchingIds[0] : matchingIds.length ? undefined : legacyStatusIdsByName[normalized(status)];
  if (!statusId) return undefined;
  const stageIds = stages.filter(stage => stage.statusIds.includes(statusId)).map(stage => stage.id);
  return stageIds.length === 1 ? stageIds[0] : undefined;
}

export function getDashboardStatusTotals(
  orders: ReadonlyArray<Pick<{status: Status}, 'status'>>,
  workflow?: WorkOrderWorkflow,
  preferences?: DashboardPreferences,
): DashboardStatusTotals {
  const stages = Object.fromEntries(dashboardStages(preferences).map(stage => [stage.id, 0])) as Record<string, number>;
  const unmapped = new Set<Status>();

  for (const order of orders) {
    const stage = resolveDashboardStage(order.status, workflow, preferences);
    if (stage) stages[stage] += 1;
    else unmapped.add(order.status);
  }

  return {total: orders.length, stages, unmapped: [...unmapped]};
}
