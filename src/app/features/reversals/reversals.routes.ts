import { Routes } from '@angular/router';
export const REVERSALS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./reversals-view/reversals-view').then(m => m.ReversalsView) }
];
