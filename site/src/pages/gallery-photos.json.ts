import type { APIRoute } from 'astro';
import { getPhotoGalleryData } from '../lib/gallery-photos';

export const prerender = true;

/** Static `/gallery-photos.json` consumed by the gallery island's Photos source. */
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await getPhotoGalleryData()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
