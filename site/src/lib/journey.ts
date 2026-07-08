import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { CANON_DIR } from './paths.ts';

/**
 * Build-time loader for the interactive Journey map (Phase 3).
 *
 * Joins two canon-owned source files:
 *   canon/map/places.yaml   — normalised coordinates + dossier links per place
 *   canon/journey.yaml      — the ordered narrative stops + arc bands
 *
 * Emits a flat, render-ready payload the /map island serializes to JSON. Keeping
 * the join here (not in the .astro page) means the timeline scrubber (3b) and any
 * future consumer read the exact same shape.
 */

export type Plane = 'world' | 'avernus' | 'shadowfell';

interface RawPlace {
  x: number;
  y: number;
  plane?: Plane;
  dossier?: string | null;
  city_map?: string | null;
}

interface PlacesFile {
  maps: Record<string, { image: string; width: number; height: number }>;
  places: Record<string, RawPlace>;
}

interface RawArc {
  n: string;
  title: string;
  start: number;
  end: number;
  color: string;
  dossier?: string | null;
}

interface RawStop {
  title: string;
  arc: number;
  place: string;
  episodes: [number, number];
  blurb: string;
  beats: string[];
}

interface JourneyFile {
  max_episode: number;
  arcs: RawArc[];
  stops: RawStop[];
}

export interface MapMeta {
  image: string;
  width: number;
  height: number;
}

export interface Arc extends RawArc {
  dossier: string | null;
}

/** A fully-resolved stop: narrative data joined with its place's coordinates. */
export interface Stop {
  title: string;
  arc: number;
  episodes: [number, number];
  blurb: string;
  beats: string[];
  // joined from places.yaml:
  place: string;
  x: number;
  y: number;
  plane: Plane;
  dossier: string | null;
  cityMap: string | null;
}

export interface JourneyData {
  maxEpisode: number;
  map: MapMeta;
  arcs: Arc[];
  stops: Stop[];
}

function read<T>(rel: string): T {
  return yaml.load(readFileSync(join(CANON_DIR, rel), 'utf8')) as T;
}

let cache: JourneyData | null = null;

export function getJourney(): JourneyData {
  if (cache) return cache;

  const placesFile = read<PlacesFile>('map/places.yaml');
  const journeyFile = read<JourneyFile>('journey.yaml');

  const worldMap = placesFile.maps.world;
  if (!worldMap) throw new Error('journey: places.yaml is missing the `maps.world` entry');

  const stops: Stop[] = journeyFile.stops.map((s, i) => {
    const place = placesFile.places[s.place];
    if (!place) {
      throw new Error(
        `journey: stop ${i} ("${s.title}") references unknown place "${s.place}" — add it to canon/map/places.yaml`,
      );
    }
    return {
      title: s.title,
      arc: s.arc,
      episodes: s.episodes,
      blurb: s.blurb,
      beats: s.beats,
      place: s.place,
      x: place.x,
      y: place.y,
      plane: place.plane ?? 'world',
      dossier: place.dossier ?? null,
      cityMap: place.city_map ?? null,
    };
  });

  cache = {
    maxEpisode: journeyFile.max_episode,
    map: worldMap,
    arcs: journeyFile.arcs.map((a) => ({ ...a, dossier: a.dossier ?? null })),
    stops,
  };
  return cache;
}
