import { Routes } from '@angular/router';

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./billing-view/billing-view').then(m => m.BillingView)
  }
];
