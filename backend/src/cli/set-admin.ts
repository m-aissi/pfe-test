// Donne (ou retire) le rôle admin à un compte : gestion des archétypes du site, communs à tous.
// Usage, depuis backend/ après un build : npm run set-admin -- <pseudo> [off]
import 'dotenv/config';
import mongoose from 'mongoose';
import { usernameKey } from '../auth/auth.service';
import { env } from '../config';

async function main() {
  const [username, flag] = process.argv.slice(2);
  if (!username) {
    console.error('Usage : npm run set-admin -- <pseudo> [off]');
    process.exit(1);
  }
  const admin = flag != 'off';
  await mongoose.connect(env().mongoUri);
  const result = await mongoose.connection.collection('users').updateOne({ usernameLower: usernameKey(username) }, { $set: { admin } });
  await mongoose.disconnect();
  if (result.matchedCount == 0) {
    console.error(`Aucun compte avec le pseudo "${username}"`);
    process.exit(1);
  }
  console.log(`"${username}" ${admin ? 'est maintenant admin' : "n'est plus admin"}`);
}

main();
