import type { APIRoute } from 'astro';
import { getGalleryData } from '../lib/gallery';

export const prerender = true;

/** Static `/gallery.json` consumed by the gallery React island. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(getGalleryData()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
