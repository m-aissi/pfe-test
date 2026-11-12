import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
}

// petits messages temporaires en bas de l'écran (remplacent les alert() de l'ancien site)
@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly list = signal<Toast[]>([]);
  private nextId = 1;

  show(text: string, kind: Toast['kind'] = 'info', durationMs = 3500) {
    const id = this.nextId++;
    this.list.update((list) => [...list, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(text: string) {
    this.show(text, 'success');
  }

  error(text: string) {
    this.show(text, 'error', 5000);
  }

  dismiss(id: number) {
    this.list.update((list) => list.filter((toast) => toast.id != id));
  }
}
