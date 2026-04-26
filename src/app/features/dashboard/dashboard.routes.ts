import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./dashboard-view/dashboard-view').then(m => m.DashboardView) }
];
