// Réinitialise le mot de passe d'un compte (il n'y a pas d'email, donc pas de "mot de passe oublié").
// Usage, depuis backend/ après un build : npm run set-password -- <pseudo> <nouveau mot de passe>
import 'dotenv/config';
import * as argon2 from 'argon2';
import mongoose from 'mongoose';
import { usernameKey } from '../auth/auth.service';
import { env } from '../config';

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 4) {
    console.error('Usage : npm run set-password -- <pseudo> <nouveau mot de passe (4 caractères minimum)>');
    process.exit(1);
  }

  await mongoose.connect(env().mongoUri);
  // tokenVersion : déconnecte toutes les sessions ouvertes avec l'ancien mot de passe
  const result = await mongoose.connection
    .collection('users')
    .updateOne({ usernameLower: usernameKey(username) }, { $set: { passwordHash: await argon2.hash(password) }, $inc: { tokenVersion: 1 } });
  await mongoose.disconnect();

  if (result.matchedCount == 0) {
    console.error(`Aucun compte avec le pseudo "${username}"`);
    process.exit(1);
  }
  console.log(`Mot de passe de "${username}" modifié`);
}

main();
