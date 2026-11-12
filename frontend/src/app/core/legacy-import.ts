import { inject, Injectable } from '@angular/core';
import { Api, ImportSummary } from './api';

// clés utilisées par l'ancien site dans le stockage du navigateur
const BINDERS_KEY = 'ygotools-binders';
const SCYTHE_KEY = 'scytheReview';
const DONE_KEY = 'ygotools-migrated';

export interface LegacyData {
  binders: number;
  binderCards: number;
  scytheSeen: number;
  scytheFound: number;
}

interface ImportPayload {
  archetypes?: { name: string; favorite: boolean; cards: { id: number; owned: boolean; wanted: boolean }[] }[];
  binders?: { name: string; firstPageAlone: boolean; pages: ({ imageId: number; owned: boolean } | null)[][] }[];
  scythe?: { seen: number[]; found: number[] };
}

// reprise des données de l'ancien site : celles restées dans ce navigateur (classeurs, tri des faux)
// et les fichiers JSON exportés (profil, classeurs)
@Injectable({ providedIn: 'root' })
export class LegacyImport {
  private readonly api = inject(Api);

  // ce que l'ancien site a laissé dans ce navigateur et qui n'a pas encore été importé, sinon null
  detect(): LegacyData | null {
    if (this.read(DONE_KEY)) return null;
    const payload = this.localPayload();
    const slots = (payload.binders ?? []).flatMap((binder) => binder.pages.flat()).filter(Boolean);
    const data: LegacyData = {
      binders: (payload.binders ?? []).filter((binder) => binder.pages.flat().some(Boolean)).length,
      binderCards: slots.length,
      scytheSeen: payload.scythe?.seen.length ?? 0,
      scytheFound: payload.scythe?.found.length ?? 0,
    };
    return data.binderCards || data.scytheSeen ? data : null;
  }

  async importLocal(): Promise<ImportSummary> {
    const payload = this.localPayload();
    // un classeur vide créé par défaut par l'ancien site ne vaut pas la peine d'être repris
    payload.binders = payload.binders?.filter((binder) => binder.pages.flat().some(Boolean));
    const summary = await this.api.post<ImportSummary>('/me/import', payload);
    this.markDone();
    return summary;
  }

  // ne plus proposer l'import dans ce navigateur (les anciennes données n'y sont pas effacées)
  markDone() {
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch {
      // stockage indisponible : la proposition reviendra, sans conséquence
    }
  }

  // fichier exporté par l'ancien site : YGOToolsProfile.json ou YGOToolsBinders.json
  async importFile(file: File): Promise<ImportSummary> {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      throw new Error("Ce fichier n'est pas un fichier JSON valide");
    }
    if (!Array.isArray(json) || json.length == 0) throw new Error("Ce fichier n'est pas un export de l'ancien site");
    if (json.some((item) => Array.isArray(item?.cardList))) {
      return this.api.post<ImportSummary>('/me/import', { archetypes: this.convertProfile(json) });
    }
    if (json.some((item) => Array.isArray(item?.pages))) {
      return this.api.post<ImportSummary>('/me/import', { binders: this.convertBinders(json) });
    }
    throw new Error("Ce fichier n'est pas un export de l'ancien site");
  }

  private localPayload(): ImportPayload {
    const payload: ImportPayload = {};
    const binders = this.readJson(BINDERS_KEY);
    if (Array.isArray(binders)) payload.binders = this.convertBinders(binders);
    const scythe = this.readJson(SCYTHE_KEY) as { seen?: unknown; found?: unknown } | null;
    if (scythe && Array.isArray(scythe.seen)) {
      payload.scythe = {
        seen: scythe.seen.filter((id: unknown): id is number => Number.isInteger(id)),
        found: (Array.isArray(scythe.found) ? scythe.found : [])
          .map((card: { imageId?: unknown }) => card?.imageId)
          .filter((id: unknown): id is number => Number.isInteger(id)),
      };
    }
    return payload;
  }

  private convertProfile(json: any[]): ImportPayload['archetypes'] {
    return json
      .filter((archetype) => archetype && Array.isArray(archetype.cardList))
      .map((archetype) => ({
        name: String(archetype.archetypeName ?? ''),
        favorite: !!archetype.favorite,
        cards: archetype.cardList
          .filter((card: any) => Number.isInteger(card?.cardId))
          .map((card: any) => ({ id: card.cardId, owned: !!card.isOwned, wanted: !!card.isFavorite })),
      }));
  }

  // dans les classeurs de l'ancien site, "cardId" contenait en réalité l'identifiant de l'illustration
  private convertBinders(json: any[]): NonNullable<ImportPayload['binders']> {
    return json
      .filter((binder) => binder && Array.isArray(binder.pages))
      .map((binder) => ({
        name: String(binder.name ?? 'Classeur'),
        firstPageAlone: binder.firstPageAlone !== false,
        pages: binder.pages.map((page: any) =>
          (Array.isArray(page) ? page : []).map((slot: any) =>
            slot && Number.isInteger(slot.cardId) ? { imageId: slot.cardId, owned: !!slot.isOwned } : null,
          ),
        ),
      }));
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private readJson(key: string): unknown {
    try {
      return JSON.parse(this.read(key) ?? 'null');
    } catch {
      return null;
    }
  }
}
