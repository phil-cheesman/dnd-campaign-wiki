import { getCollection, type CollectionKey } from 'astro:content';

/**
 * getCollection with the build-time exclusion guard applied: never surface an
 * entity flagged `dm_only: true`. (`_`-prefixed files are already dropped by the
 * glob loaders.) Use this everywhere instead of getCollection directly.
 */
export async function getPublic(collection: CollectionKey) {
  return (await getCollection(collection)).filter((e: any) => e.data?.dm_only !== true);
}
