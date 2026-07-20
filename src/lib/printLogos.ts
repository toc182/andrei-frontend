// printLogos.ts — logo plumbing shared by the print dialogs (cronograma PrintDialog,
// DesglosePrintDialog). A LogoChoice is either a named bundled asset or an uploaded
// image already held as a data URL; resolveLogo() turns a choice into the data URL
// the print builders embed (bundled assets are fetched and re-encoded, since an
// <image href> inside the print popup cannot reach Vite's asset URLs).

import logoPinellas from '@/assets/logo.png';
import logoCocp from '@/assets/LogoCOCPfondoblanco.png';
import type { LogoChoice } from './cronogramaApi';

export const isLogoEntry = (c: unknown): c is LogoChoice =>
  c === 'pinellas' || c === 'cocp' ||
  (typeof c === 'object' && c !== null && typeof (c as { dataUrl?: unknown }).dataUrl === 'string');

export async function toDataUrl(url: string): Promise<string> {
  // fetch() on a Vite-bundled same-origin asset — NOT an API call; the axios instance
  // (baseURL /api + auth header) cannot load static assets, so the repo's no-fetch rule
  // doesn't apply here.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`logo asset ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('logo read failed'));
    r.readAsDataURL(blob);
  });
}

// Bundled assets resolve once per session — the live print preview re-resolves
// on every settings change and must not refetch the same PNG each time. The
// cached value is the PROMISE (concurrent callers share one fetch); a failed
// fetch evicts itself so a retry is possible.
const assetCache = new Map<string, Promise<string>>();

export async function resolveLogo(choice: LogoChoice): Promise<string | null> {
  if (!choice || choice === 'none') return null;
  if (typeof choice === 'object') return choice.dataUrl;
  let p = assetCache.get(choice);
  if (!p) {
    p = toDataUrl(choice === 'pinellas' ? logoPinellas : logoCocp);
    assetCache.set(choice, p);
    p.catch(() => assetCache.delete(choice));
  }
  return p;
}

/** Resolve one side's logo list; a single broken image drops only itself. */
export async function resolveLogoSide(arr: LogoChoice[]): Promise<{ urls: string[]; failed: boolean }> {
  const settled = await Promise.allSettled(arr.map(resolveLogo));
  return {
    urls: settled.flatMap((s) => (s.status === 'fulfilled' && s.value ? [s.value] : [])),
    failed: settled.some((s) => s.status === 'rejected'),
  };
}
