import { Routes } from '@angular/router';

export const COMMUNICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./communications-view/communications-view').then(m => m.CommunicationsView)
  }
];

