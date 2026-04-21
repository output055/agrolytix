import { Routes } from '@angular/router';

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./expenses-view/expenses-view').then(m => m.ExpensesView)
  }
];
