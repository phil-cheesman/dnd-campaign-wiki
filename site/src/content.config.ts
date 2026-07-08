import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const CANON = '../canon';

/** glob loader for a canon tier, skipping `_`-prefixed files. */
const tier = (dir: string) =>
  glob({ pattern: '**/[!_]*.md', base: `${CANON}/${dir}` });

// Option C — shared base every entity tier extends.
const baseEntity = z.object({
  name: z.string(),
  short_name: z.string().nullish(), // sidebar label override; characters default to first name
  first_episode: z.number().nullish(), // episode of first appearance — orders the character sidebar
  aliases: z.array(z.string()).default([]),
  episodes: z.array(z.string()).default([]),
  dm_only: z.boolean().default(false),
  sources: z.array(z.string()).nullish(),
  parent: z.string().nullish(),
  kingdom: z.string().nullish(),
  // Phase-2 badge fields — all optional, additive, degrade gracefully:
  status: z.string().nullish(), // status badge (living/deceased/active/destroyed/unknown…)
  role: z.string().nullish(), // type-badge detail (e.g. "Pirate Captain", "Trade Empire")
  relation: z.enum(['ally', 'enemy', 'neutral']).nullish(), // relation badge (npcs/factions)
  art: z
    .object({
      has_visual_source: z.boolean().optional(),
      visual: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
      // Phase-2 generation provenance (content-addressed; regen when prompt_hash changes):
      type: z.enum(['portrait', 'landscape', 'crest', 'object', 'scene']).optional(),
      eligibility: z.enum(['ok', 'symbolic-only', 'skip']).optional(),
      ref_images: z.array(z.string()).optional(),
      prompt_hash: z.string().optional(),
      seed: z.number().optional(),
      model: z.string().optional(),
      style_version: z.string().optional(),
      status: z.enum(['pending', 'generated', 'approved', 'failed']).optional(),
      generated_at: z.string().optional(),
      // Episode scene plates only — caption + the entities composed into the image:
      scene_title: z.string().nullish(),
      key_entities: z.array(z.string()).optional(),
    })
    .optional(),
});

const entity = (dir: string, extend: z.ZodRawShape = {}) =>
  defineCollection({ loader: tier(dir), schema: baseEntity.extend(extend) });

export const collections = {
  characters: entity('characters', {
    player: z.string().nullish(),
    // Phase-2 PC sheet highlights — all optional, degrade gracefully when absent.
    alignment: z.string().nullish(), // e.g. "Lawful Good"; drives the 3×3 grid
    alignment_inferred: z.boolean().default(false), // true = derived from canon, not a sheet
    sheet: z
      .object({
        species: z.string().nullish(),
        class: z.string().nullish(), // multiclass written as "Rogue 9 / Monk 6"
        level: z.number().nullish(),
        ac: z.number().nullish(),
        hp: z.number().nullish(),
        speed: z.number().nullish(),
        abilities: z
          .object({
            str: z.number(),
            dex: z.number(),
            con: z.number(),
            int: z.number(),
            wis: z.number(),
            cha: z.number(),
          })
          .nullish(),
        signatures: z.array(z.string()).default([]), // a few headline features/spells
        // Phase-B comparison data: skill/save modifiers off the D&D Beyond sheet.
        skills: z.record(z.string(), z.number()).nullish(), // 18 skill mods, kebab keys
        skills_expert: z.array(z.string()).default([]), // skills with expertise (marked)
        saves: z.record(z.string(), z.number()).nullish(), // 6 save mods, str/dex/…
        saves_prof: z.array(z.string()).default([]), // proficient saves
        // Phase-C spellbook & feats badge wall (cantrip = level 0).
        spells: z.array(z.object({ name: z.string(), level: z.number() })).default([]),
        feats: z.array(z.string()).default([]),
      })
      .nullish(),
  }),
  npcs: entity('npcs'),
  locations: entity('locations', {
    primary_location: z.string().nullish(),
  }),
  kingdoms: entity('kingdoms'),
  factions: entity('factions'),
  items: entity('items'),
  worldbuilding: entity('worldbuilding', { kind: z.string().nullish() }),

  episodes: defineCollection({
    loader: tier('episodes'),
    schema: z.object({
      episode: z.number(),
      date: z.coerce.date(),
      title: z.string().nullish(),
      locations: z.array(z.string()).default([]),
      npcs: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      primary_location: z.string().optional(),
      dm_only: z.boolean().default(false),
      // Phase-3 badge fields (already written to all 163 files; typed here so the
      // Episodes page can read them — zod was silently stripping them before).
      characters: z.array(z.string()).default([]), // PC slugs present/acting this episode
      combat: z.boolean().optional(), // a real party fight occurred
      milestone: z.string().optional(), // arc finale / major accomplishment (short phrase)
      media: z.boolean().optional(), // future: has mini/session photos (📷 reserved)
      deaths: z
        .array(
          z.object({
            pc: z.string(),
            kind: z.enum(['permanent', 'revived']),
          }),
        )
        .default([]),
      // Phase-2 episode scene plate (reference/header art) — same block as entities.
      art: baseEntity.shape.art,
    }),
  }),

  arcs: defineCollection({
    loader: tier('arcs'),
    schema: z
      .object({
        campaign: z.string().optional(),
        episodes: z.string().optional(),
        sessions: z.string().optional(),
        title: z.string().optional(),
        dm_only: z.boolean().default(false),
        // Phase-2 arc scene plate (reference/header art) — same block as entities/episodes.
        art: baseEntity.shape.art,
      })
      .passthrough(),
  }),

  // Top-level singletons rendered through the same markdown pipeline (autolinked).
  pages: defineCollection({
    loader: glob({ pattern: '{timeline,glossary}.md', base: CANON }),
    schema: z.object({}).passthrough(),
  }),
};
