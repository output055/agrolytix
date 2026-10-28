import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  { path: '', redirectTo: 'retail', pathMatch: 'full' },
  { path: 'retail', loadComponent: () => import('./retail/retail-inventory').then(m => m.RetailInventory) },
  { path: 'wholesale', loadComponent: () => import('./wholesale/wholesale-inventory').then(m => m.WholesaleInventory) },
  { path: 'transfers', loadComponent: () => import('./transfer-history/transfer-history').then(m => m.TransferHistory) },
  { path: 'stocktake', loadComponent: () => import('./stocktake/stocktake-view/stocktake-view').then(m => m.StocktakeView) },
  { path: 'stocktake/:id', loadComponent: () => import('./stocktake/stocktake-active/stocktake-active').then(m => m.StocktakeActive) },
];
