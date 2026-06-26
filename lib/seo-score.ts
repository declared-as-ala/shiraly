/**
 * Dynamic product SEO scoring — pure function, usable on server and client.
 * Score is the weighted sum of passed checks, normalized to 0-100.
 */

export type SeoInput = {
  name?: string;
  slug?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  description?: string;
  hasImage?: boolean;
  imageAlt?: string | null;
};

export type SeoCheck = {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
};

export type SeoStatus = 'poor' | 'fair' | 'good' | 'excellent';

export type SeoResult = {
  score: number;
  status: SeoStatus;
  checks: SeoCheck[];
};

const stripHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s = '') => s.toLowerCase().trim();
const includesKw = (haystack: string, kw: string) =>
  kw.length > 0 && norm(haystack).includes(norm(kw));

export function statusFromScore(score: number): SeoStatus {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export const STATUS_LABEL: Record<SeoStatus, string> = {
  poor: 'Faible',
  fair: 'À améliorer',
  good: 'Bon',
  excellent: 'Excellent',
};

export function scoreProductSeo(input: SeoInput): SeoResult {
  const name = (input.name ?? '').trim();
  const slug = (input.slug ?? '').trim();
  const metaTitle = (input.metaTitle ?? '').trim();
  const metaDescription = (input.metaDescription ?? '').trim();
  const focusKeyword = (input.focusKeyword ?? '').trim();
  const descText = stripHtml(input.description ?? '');
  const imageAlt = (input.imageAlt ?? '').trim();

  const defs: { id: string; label: string; weight: number; passed: boolean; hint: string }[] = [
    {
      id: 'title', label: 'Titre produit (10–70 car.)', weight: 10,
      passed: name.length >= 10 && name.length <= 70,
      hint: 'Le nom du produit doit faire entre 10 et 70 caractères.',
    },
    {
      id: 'metaTitle', label: 'Méta-titre (15–60 car.)', weight: 10,
      passed: metaTitle.length >= 15 && metaTitle.length <= 60,
      hint: 'Ajoutez un méta-titre SEO de 15 à 60 caractères.',
    },
    {
      id: 'metaDescription', label: 'Méta-description (50–160 car.)', weight: 12,
      passed: metaDescription.length >= 50 && metaDescription.length <= 160,
      hint: 'Rédigez une méta-description de 50 à 160 caractères.',
    },
    {
      id: 'slug', label: 'Slug propre et lisible', weight: 8,
      passed: slug.length > 0 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
      hint: 'Le slug doit être en minuscules, mots séparés par des tirets.',
    },
    {
      id: 'focusKeyword', label: 'Mot-clé cible défini', weight: 8,
      passed: focusKeyword.length > 0,
      hint: 'Définissez un mot-clé cible pour ce produit.',
    },
    {
      id: 'kwInTitle', label: 'Mot-clé dans le titre', weight: 12,
      passed: includesKw(name, focusKeyword),
      hint: 'Intégrez le mot-clé cible dans le nom du produit.',
    },
    {
      id: 'kwInMetaTitle', label: 'Mot-clé dans le méta-titre', weight: 8,
      passed: includesKw(metaTitle, focusKeyword),
      hint: 'Intégrez le mot-clé cible dans le méta-titre.',
    },
    {
      id: 'kwInMetaDesc', label: 'Mot-clé dans la méta-description', weight: 8,
      passed: includesKw(metaDescription, focusKeyword),
      hint: 'Intégrez le mot-clé cible dans la méta-description.',
    },
    {
      id: 'kwInDesc', label: 'Mot-clé dans la description', weight: 8,
      passed: includesKw(descText, focusKeyword),
      hint: 'Mentionnez le mot-clé cible dans la description du produit.',
    },
    {
      id: 'descLength', label: 'Description détaillée (≥ 120 car.)', weight: 8,
      passed: descText.length >= 120,
      hint: 'Rédigez une description d’au moins 120 caractères.',
    },
    {
      id: 'image', label: 'Image principale présente', weight: 4,
      passed: Boolean(input.hasImage),
      hint: 'Ajoutez au moins une image au produit.',
    },
    {
      id: 'imageAlt', label: 'Texte alternatif d’image', weight: 4,
      passed: imageAlt.length > 0,
      hint: 'Ajoutez un texte alternatif décrivant l’image principale.',
    },
  ];

  const totalWeight = defs.reduce((s, d) => s + d.weight, 0);
  const earned = defs.reduce((s, d) => s + (d.passed ? d.weight : 0), 0);
  const score = Math.round((earned / totalWeight) * 100);

  return {
    score,
    status: statusFromScore(score),
    checks: defs.map(({ id, label, passed, hint }) => ({ id, label, passed, hint })),
  };
}
