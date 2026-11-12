import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { mkdir, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { env, USER_AGENT } from '../config';

// type d'image demandé par le front -> dossier correspondant chez ygoprodeck
export const IMAGE_KINDS: Record<string, string> = {
  cards: 'cards', // carte entière, 813x1185
  small: 'cards_small', // carte entière, 268x391
  cropped: 'cards_cropped', // illustration seule
};

const UPSTREAM = 'https://images.ygoprodeck.com/images';
const MAX_CONCURRENT_DOWNLOADS = 6;
const MISSING_TTL_MS = 3_600_000;

// ygoprodeck demande de ré-héberger ses images plutôt que de les afficher depuis chez eux :
// chaque image est téléchargée une seule fois, à sa première demande, puis servie depuis le disque
@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);
  private readonly dir = env().imageCacheDir;
  private readonly pending = new Map<string, Promise<string | null>>();
  private readonly missing = new Map<string, number>();
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  // chemin du fichier en cache, ou null si l'image n'existe pas chez ygoprodeck
  async getFile(kind: string, imageId: number): Promise<string | null> {
    const key = `${kind}/${imageId}`;
    const file = join(this.dir, kind, `${imageId}.jpg`);
    if (existsSync(file)) return file;
    if ((this.missing.get(key) ?? 0) > Date.now()) return null;

    // plusieurs demandes simultanées de la même image ne déclenchent qu'un téléchargement
    let download = this.pending.get(key);
    if (!download) {
      download = this.download(key, kind, imageId, file).finally(() => this.pending.delete(key));
      this.pending.set(key, download);
    }
    return download;
  }

  private async download(key: string, kind: string, imageId: number, file: string): Promise<string | null> {
    await this.acquire();
    try {
      const response = await fetch(`${UPSTREAM}/${IMAGE_KINDS[kind]}/${imageId}.jpg`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status == 404) {
        this.missing.set(key, Date.now() + MISSING_TTL_MS);
        return null;
      }
      if (!response.ok) throw new Error(`ygoprodeck a répondu ${response.status} pour l'image ${key}`);

      await mkdir(join(this.dir, kind), { recursive: true });
      // écriture dans un fichier temporaire puis renommage : un fichier à moitié écrit n'est jamais servi
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, Buffer.from(await response.arrayBuffer()));
      await rename(temp, file);
      return file;
    } catch (error: any) {
      this.logger.warn(error.message);
      throw error;
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < MAX_CONCURRENT_DOWNLOADS) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise(resolve => this.waiting.push(resolve));
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
}
