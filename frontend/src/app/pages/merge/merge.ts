import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, ArchetypeEntry, ArchetypeList } from '../../core/api';
import { Auth } from '../../core/auth';
import { Toasts } from '../../core/toast';
import { normalize } from '../../core/util';

const MAX_SHOWN = 100;

// regroupe plusieurs archétypes en un seul archétype perso
@Component({
  selector: 'app-merge',
  imports: [FormsModule, RouterLink],
  templateUrl: './merge.html',
})
export class Merge {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(Auth);

  readonly archetypes = signal<ArchetypeEntry[]>([]);
  readonly filter = signal('');
  readonly selected = signal<ArchetypeEntry[]>([]);
  readonly name = signal('');
  readonly saving = signal(false);
  // admin : le résultat devient un archétype du site, pour tous (et peut alors absorber d'autres archétypes du site)
  readonly forEveryone = signal(!!this.auth.user()?.admin);

  // "Faux" se nourrit de la chasse aux faux, il ne peut pas être fusionné
  readonly available = computed(() => {
    const query = normalize(this.filter());
    const chosen = new Set(this.selected().map((archetype) => archetype.key));
    return this.archetypes()
      .filter((archetype) => archetype.kind != 'scythe' && (archetype.kind != 'site' || this.forEveryone()) && !chosen.has(archetype.key))
      .filter((archetype) => !query || normalize(archetype.name).includes(query))
      .slice(0, MAX_SHOWN);
  });

  readonly cardCount = computed(() => this.selected().reduce((sum, archetype) => sum + archetype.cardCount, 0));

  constructor() {
    // ?with=<clé> : ouvert depuis la page d'un archétype, qui est déjà sélectionné
    const start = this.route.snapshot.queryParamMap.get('with');
    this.api.get<ArchetypeList>('/archetypes').then((list) => {
      this.archetypes.set(list.archetypes);
      const archetype = list.archetypes.find((item) => item.key == start);
      if (archetype && (archetype.kind != 'site' || this.forEveryone())) this.add(archetype);
    });
  }

  add(archetype: ArchetypeEntry) {
    this.selected.update((selected) => [...selected, archetype]);
    if (!this.name()) this.name.set(archetype.name);
  }

  setForEveryone(value: boolean) {
    this.forEveryone.set(value);
    // un archétype perso ne peut pas absorber un archétype du site
    if (!value) this.selected.update((selected) => selected.filter((item) => item.kind != 'site'));
  }

  remove(archetype: ArchetypeEntry) {
    this.selected.update((selected) => selected.filter((item) => item.key != archetype.key));
  }

  async merge() {
    const name = this.name().trim();
    if (this.selected().length < 2) return this.toasts.error('Choisis au moins deux archétypes');
    if (!name) return this.toasts.error('Donne un nom au nouvel archétype');
    this.saving.set(true);
    try {
      const { key } = await this.api.post<{ key: string }>(this.forEveryone() ? '/admin/site-archetypes/merge' : '/me/custom-archetypes/merge', {
        name,
        keys: this.selected().map((archetype) => archetype.key),
      });
      this.toasts.success('Archétypes fusionnés');
      this.router.navigate(['/archetype'], { queryParams: { key } });
    } catch {
      this.saving.set(false);
    }
  }
}
