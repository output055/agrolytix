import { Routes } from '@angular/router';
export const POS_ROUTES: Routes = [
  { path: '', redirectTo: 'retail', pathMatch: 'full' },
  { path: 'retail', loadComponent: () => import('./retail/retail-pos').then(m => m.RetailPos) },
  { path: 'wholesale', loadComponent: () => import('./wholesale/wholesale-pos').then(m => m.WholesalePos) },
];
