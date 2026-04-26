import { Routes } from '@angular/router';

export const SUPER_ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard',  loadComponent: () => import('./overview/sa-overview').then(m => m.SaOverview) },
  { path: 'businesses', loadComponent: () => import('./businesses/sa-businesses').then(m => m.SaBusinesses) },
  { path: 'payments',   loadComponent: () => import('./payments/sa-payments').then(m => m.SaPayments) },
  { path: 'messages',   loadComponent: () => import('./messages/sa-messages').then(m => m.SaMessages) },
];
