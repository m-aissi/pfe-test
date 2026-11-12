import { Routes } from '@angular/router';
import { authGuard } from './core/auth';

// chaque écran est chargé à la demande ; ceux qui enregistrent des données demandent un compte
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
  { path: 'archetype', loadComponent: () => import('./pages/archetype/archetype').then((m) => m.Archetype) },
  {
    path: 'archetypes/nouveau',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/archetype-editor/archetype-editor').then((m) => m.ArchetypeEditor),
  },
  {
    path: 'archetypes/modifier',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/archetype-editor/archetype-editor').then((m) => m.ArchetypeEditor),
  },
  {
    path: 'archetypes/fusion',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/merge/merge').then((m) => m.Merge),
  },
  { path: 'faux', canActivate: [authGuard], loadComponent: () => import('./pages/scythe/scythe').then((m) => m.Scythe) },
  { path: 'classeurs', canActivate: [authGuard], loadComponent: () => import('./pages/binders/binders').then((m) => m.Binders) },
  {
    path: 'classeurs/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/binder/binder').then((m) => m.BinderEditor),
  },
  { path: 'connexion', data: { mode: 'login' }, loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  { path: 'inscription', data: { mode: 'register' }, loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  { path: 'compte', canActivate: [authGuard], loadComponent: () => import('./pages/account/account').then((m) => m.Account) },
  { path: '**', redirectTo: '' },
];
