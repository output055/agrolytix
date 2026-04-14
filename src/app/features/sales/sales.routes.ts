import { Routes } from '@angular/router';
export const SALES_ROUTES: Routes = [
  { path: '', redirectTo: 'retail', pathMatch: 'full' },
  { path: 'retail', loadComponent: () => import('./retail/retail-sales').then(m => m.RetailSales) },
  { path: 'wholesale', loadComponent: () => import('./wholesale/wholesale-sales').then(m => m.WholesaleSales) },
];
