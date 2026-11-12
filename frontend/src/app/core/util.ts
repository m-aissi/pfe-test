// adresse d'une image de carte servie (et mise en cache) par notre backend
// cards : carte entière en grand, small : carte entière en vignette, cropped : illustration seule
export function imgUrl(kind: 'cards' | 'small' | 'cropped', imageId: number): string {
  return `/api/img/${kind}/${imageId}.jpg`;
}

// même forme de recherche que le backend : minuscules, sans accents ni ponctuation
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function formatPrice(value: number): string {
  return value.toFixed(2).replace('.', ',') + ' €';
}

export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ligne de type d'une carte, façon texte imprimé : "Dragon / Effect Monster"
export function typeLine(card: { race?: string; type?: string }): string {
  return [card.race, card.type].filter(Boolean).join(' / ');
}
