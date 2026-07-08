import type { APIRoute } from 'astro';
import { getGraphData } from '../lib/graph';

export const prerender = true;

/** Static `/graph.json` consumed by the force-graph React islands. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(getGraphData()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
