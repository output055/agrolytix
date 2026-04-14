import { Routes } from '@angular/router';
export const REPORTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./reports-view/reports-view').then(m => m.ReportsView) }
];
