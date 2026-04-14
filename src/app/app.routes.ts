import { Routes } from '@angular/router';
import { AppLayout } from './layout/app-layout/app-layout';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: '',
    component: AppLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      },
      {
        path: 'inventory',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
      },
      {
        path: 'pos',
        loadChildren: () => import('./features/pos/pos.routes').then(m => m.POS_ROUTES)
      },
      {
        path: 'sales',
        loadChildren: () => import('./features/sales/sales.routes').then(m => m.SALES_ROUTES)
      },
      {
        path: 'reversals',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/reversals/reversals.routes').then(m => m.REVERSALS_ROUTES)
      },
      {
        path: 'clients',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/clients/clients.routes').then(m => m.CLIENTS_ROUTES)
      },
      {
        path: 'admin/workers',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/workers/workers.routes').then(m => m.WORKERS_ROUTES)
      },
      {
        path: 'reports',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/reports/reports.routes').then(m => m.REPORTS_ROUTES)
      },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
