import { Routes } from '@angular/router';
export const WORKERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./workers-view/workers-view').then(m => m.WorkersView) }
];
