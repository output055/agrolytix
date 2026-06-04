import { Routes } from '@angular/router';
export const CLIENTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./clients-view/clients-view').then(m => m.ClientsView) },
  { path: ':id', loadComponent: () => import('./client-detail/client-detail').then(m => m.ClientDetailComponent) }
];
