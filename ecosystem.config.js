// Lancé par pm2 : "npm run deploy" à la racine du projet.
// Les secrets (SESSION_SECRET, identifiants Google/Discord) sont dans backend/.env, jamais ici.
module.exports = {
  apps: [
    {
      name: 'yugioh',
      cwd: __dirname + '/backend',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        // seulement en local : Caddy reçoit le trafic https et le relaie ici
        HOST: '127.0.0.1',
        PORT: 4440,
        MONGO_URI: 'mongodb://127.0.0.1:27017/yugioh',
      },
    },
  ],
};
