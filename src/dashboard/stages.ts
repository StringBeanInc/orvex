import type {DashboardPreferences, DashboardStageDefinition} from '../data';

export const defaultDashboardStages: DashboardStageDefinition[] = [
  {id: 'open-work-orders', label: 'Open work orders', statusIds: ['open']},
  {id: 'in-progress', label: 'In progress', statusIds: ['in-progress']},
  {id: 'completed', label: 'Completed', statusIds: ['completed', 'closed']},
];

export const dashboardStages = (preferences?: DashboardPreferences): DashboardStageDefinition[] => preferences?.stages?.length ? preferences.stages : defaultDashboardStages;
