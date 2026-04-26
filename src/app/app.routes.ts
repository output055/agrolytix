import { Routes } from '@angular/router';
import { AppLayout } from './layout/app-layout/app-layout';
import { SuperAdminLayout } from './layout/super-admin-layout/super-admin-layout';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';
import { tenantGuard } from './core/guards/tenant.guard';

export const routes: Routes = [
  // ─── Public Landing Page ───────────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
    pathMatch: 'full'
  },

  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  // ─── Super Admin isolated shell ───────────────────────────────────────────
  {
    path: 'super-admin',
    component: SuperAdminLayout,
    canActivate: [authGuard, superAdminGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./features/super-admin/super-admin.routes').then(m => m.SUPER_ADMIN_ROUTES)
      }
    ]
  },

  // ─── Normal tenant shell ──────────────────────────────────────────────────
  {
    path: '',
    component: AppLayout,
    canActivate: [authGuard, tenantGuard],
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
        path: 'admin/audit-logs',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/audit-logs/audit-logs.routes').then(m => m.AUDIT_LOGS_ROUTES)
      },
      {
        path: 'reports',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/reports/reports.routes').then(m => m.REPORTS_ROUTES)
      },
      {
        path: 'expenses',
        loadChildren: () => import('./features/expenses/expenses.routes').then(m => m.EXPENSES_ROUTES)
      },
      {
        path: 'billing',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/billing/billing.routes').then(m => m.BILLING_ROUTES)
      },
      {
        path: 'help',
        loadComponent: () => import('./features/help/help-view/help-view').then(m => m.HelpView)
      },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
