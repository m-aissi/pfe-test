import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { env, USER_AGENT } from '../config';
import { Card, Meta } from './card.schema';
import { CardsIndex } from './cards.index';
import { normalize } from './normalize';

const API = 'https://db.ygoprodeck.com/api/v7';
// même sans nouvelle version de leur base, on recharge tout chaque nuit pour rafraîchir les prix ;
// 20 h plutôt que 24 : la synchro de la veille compte comme périmée à 4 h 30, mais pas un redémarrage dans la journée
const FULL_RESYNC_HOURS = 20;
const OPTIONAL_FIELDS = ['attribute', 'atk', 'def', 'level', 'scale', 'linkval', 'archetype'];

interface DbVersion {
  database_version: string;
  last_update: string;
}

// recopie la base ygoprodeck dans Mongo : 3 requêtes par synchro (version, cartes EN, cartes FR),
// au lieu d'interroger leur API à chaque visite comme le faisait l'ancien site
@Injectable()
export class CardsSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CardsSyncService.name);
  private running = false;

  constructor(
    @InjectModel(Card.name) private readonly cardModel: Model<Card>,
    @InjectModel(Meta.name) private readonly metaModel: Model<Meta>,
    private readonly index: CardsIndex,
  ) {}

  async onApplicationBootstrap() {
    const mode = env().cardsSync;
    if (mode == 'force' || (mode == 'on' && (await this.cardModel.estimatedDocumentCount()) == 0)) {
      this.logger.log('Synchro de la base de cartes avec ygoprodeck...');
      await this.sync().catch(error => this.logger.error(`Synchro impossible : ${error.message}`));
    }
    await this.index.rebuild();
  }

  @Cron('30 4 * * *')
  async nightly() {
    if (env().cardsSync == 'off') return;
    try {
      await this.checkAndSync();
    } catch (error: any) {
      this.logger.error(`Synchro nocturne impossible : ${error.message}`);
    }
  }

  status() {
    return this.metaModel.findById('cards').lean();
  }

  // ne resynchronise que si ygoprodeck a publié une nouvelle version ou si la dernière synchro est trop vieille
  async checkAndSync(): Promise<boolean> {
    const [remote]: DbVersion[] = await this.fetchJson(`${API}/checkDBVer.php`);
    const meta = await this.metaModel.findById('cards').lean();
    const fresh = meta && Date.now() - new Date(meta.syncedAt).getTime() < FULL_RESYNC_HOURS * 3_600_000;
    if (meta && fresh && meta.databaseVersion === remote.database_version && meta.lastUpdate === remote.last_update) {
      this.logger.log(`Base de cartes à jour (version ${meta.databaseVersion})`);
      return false;
    }
    await this.sync(remote);
    await this.index.rebuild();
    return true;
  }

  async sync(version?: DbVersion) {
    if (this.running) return;
    this.running = true;
    try {
      const started = Date.now();
      version ??= (await this.fetchJson(`${API}/checkDBVer.php`))[0] as DbVersion;
      const en: any[] = (await this.fetchJson(`${API}/cardinfo.php?misc=yes`)).data;
      const fr: any[] = (await this.fetchJson(`${API}/cardinfo.php?language=fr`)).data;
      // garde-fou : une réponse tronquée ne doit pas vider la base
      if (!Array.isArray(en) || en.length < 10_000 || !Array.isArray(fr)) throw new Error('réponse ygoprodeck incomplète');

      // rattachement par le nom anglais : pour quelques cartes à plusieurs illustrations,
      // l'identifiant principal n'est pas le même dans la version française et dans la version anglaise
      const frByName = new Map<string, any>(fr.map(card => [card.name_en, card]));
      const syncedAt = new Date();
      // date d'apparition conservée d'une synchro à l'autre ; base vide (première installation) : rien n'est "nouveau"
      const known = new Map((await this.cardModel.find({}, { addedAt: 1 }).lean()).map(doc => [doc._id, doc.addedAt ?? new Date(0)]));
      const firstSync = known.size == 0;
      const operations = en.map(card => ({
        replaceOne: {
          filter: { _id: card.id },
          replacement: { ...this.toDocument(card, frByName.get(card.name), syncedAt), addedAt: known.get(card.id) ?? (firstSync ? new Date(0) : syncedAt) },
          upsert: true,
        },
      }));
      // pilote natif : le bulkWrite de Mongoose écarte sans erreur les opérations qu'il juge invalides
      for (let i = 0; i < operations.length; i += 1000) {
        await this.cardModel.collection.bulkWrite(operations.slice(i, i + 1000) as any, { ordered: false });
      }
      const written = await this.cardModel.countDocuments({ syncedAt });
      if (written != en.length) throw new Error(`${written} cartes écrites sur ${en.length}, synchro abandonnée`);
      // les cartes retirées de ygoprodeck n'ont pas été réécrites par cette synchro
      const removed = await this.cardModel.deleteMany({ syncedAt: { $ne: syncedAt } });
      await this.metaModel.findByIdAndUpdate(
        'cards',
        { databaseVersion: version.database_version, lastUpdate: version.last_update, syncedAt, cardCount: en.length },
        { upsert: true },
      );
      this.logger.log(
        `Synchro terminée en ${Date.now() - started} ms : ${en.length} cartes (${fr.length} avec nom français), ` +
          `${removed.deletedCount} supprimées, version ${version.database_version}`,
      );
    } finally {
      this.running = false;
    }
  }

  private toDocument(card: any, fr: any | undefined, syncedAt: Date): Record<string, any> {
    const doc: Record<string, any> = {
      name: card.name,
      nameSearch: normalize(card.name),
      desc: card.desc ?? '',
      type: card.type,
      frameType: card.frameType,
      race: card.race,
      images: card.card_images.map((image: any) => image.id),
      price: parseFloat(card.card_prices?.[0]?.cardmarket_price) || 0,
      syncedAt,
    };
    if (fr) {
      doc.nameFr = fr.name;
      doc.nameFrSearch = normalize(fr.name);
      doc.descFr = fr.desc;
    }
    for (const field of OPTIONAL_FIELDS) {
      if (card[field] !== undefined && card[field] !== null) doc[field] = card[field];
    }
    const tcgDate = card.misc_info?.[0]?.tcg_date;
    if (tcgDate) doc.tcgDate = tcgDate;
    return doc;
  }

  private async fetchJson(url: string): Promise<any> {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`ygoprodeck a répondu ${response.status} pour ${url}`);
    return response.json();
  }
}
