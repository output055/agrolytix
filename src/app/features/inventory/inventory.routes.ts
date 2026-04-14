import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  { path: '', redirectTo: 'retail', pathMatch: 'full' },
  { path: 'retail', loadComponent: () => import('./retail/retail-inventory').then(m => m.RetailInventory) },
  { path: 'wholesale', loadComponent: () => import('./wholesale/wholesale-inventory').then(m => m.WholesaleInventory) },
];
