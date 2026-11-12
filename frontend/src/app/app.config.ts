import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { NavigationError, provideRouter, withInMemoryScrolling, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { Auth } from './core/auth';

// après une mise à jour du site, un onglet resté ouvert réclame des fichiers JS qui n'existent plus :
// on recharge la page vers la destination demandée (une seule fois par minute pour éviter une boucle)
function reloadOnStaleChunk(error: NavigationError) {
  if (!/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(String(error.error))) return;
  try {
    const last = Number(sessionStorage.getItem('chunk-reload') ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('chunk-reload', String(Date.now()));
  } catch {
    // stockage indisponible : on recharge quand même
  }
  location.assign(error.url);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }), withNavigationErrorHandler(reloadOnStaleChunk)),
    provideHttpClient(withFetch()),
    // la session est relue avant le premier affichage : pas de bouton "Connexion" qui clignote quand on est déjà connecté
    provideAppInitializer(() => inject(Auth).ready),
  ],
};
