// forme de recherche d'un texte : minuscules, sans accents ni ponctuation ("Dragon Blanc aux Yeux Bleus" et "blue-eyes" se cherchent tels qu'on les tape)
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

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
