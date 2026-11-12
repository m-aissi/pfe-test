import { join } from 'path';

// configuration lue dans les variables d'environnement (backend/.env ou ecosystem.config.js), voir .env.example
// Valeurs par défaut pensées pour le développement sur le serveur lui-même, à côté de la prod
// (que ecosystem.config.js lance sur le port 4440 avec la base "yugioh") : port et base distincts.
export function env() {
  const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:4200').replace(/\/+$/, '');
  return {
    port: Number(process.env.PORT) || 4441,
    host: process.env.HOST || '127.0.0.1',
    production: process.env.NODE_ENV === 'production',
    mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/yugioh_dev',
    // adresse publique du site : sert aux redirections Google/Discord et à marquer les cookies "Secure" en https
    publicUrl,
    secureCookies: publicUrl.startsWith('https://'),
    sessionSecret: process.env.SESSION_SECRET || '',
    google: { clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '' },
    discord: { clientId: process.env.DISCORD_CLIENT_ID || '', clientSecret: process.env.DISCORD_CLIENT_SECRET || '' },
    imageCacheDir: process.env.IMAGE_CACHE_DIR || join(__dirname, '..', '..', 'data', 'images'),
    // synchro avec ygoprodeck : "on" (par défaut : au premier démarrage puis chaque nuit), "off" (jamais, pour les tests)
    // ou "force" (resynchronise aussi à ce démarrage)
    cardsSync: (process.env.CARDS_SYNC || 'on') as 'on' | 'off' | 'force',
  };
}

export const USER_AGENT = 'KuribOhrganizer (yugioh.miroirdesreves.com)';
