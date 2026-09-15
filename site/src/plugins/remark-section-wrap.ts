/**
 * Wrap each `## ` section of an EPISODE page in its own element so the page
 * template can reorder and collapse them (spec: docs/specs/episode-route.md).
 *
 * Episode pages are authored in a fixed narrative order — Summary first, then
 * Key events, Loot, Combat, Open threads — but that is the opposite of how they
 * get read. 99% of visits want the skimmable parts; the dense Summary is a
 * search target, not something anyone reads top to bottom. Wrapping each section
 * lets `[slug].astro` put the skim content first and sink the prose, using CSS
 * `order` rather than rewriting 170 canon files.
 *
 * Sections listed in COLLAPSIBLE become `<details>`; everything else becomes a
 * plain `<section>`. Both carry `data-sec="<slug>"`, which is the only contract
 * the stylesheet depends on — an unrecognised heading still wraps cleanly and
 * lands in the default order bucket, so a new section type can never break a page.
 *
 * Runs AFTER remarkStripTitle and alongside the autolinker, so section content
 * keeps its wiki-links and SRD hovercards.
 */

/** Canonical slug per known heading. Variants (`Loot` vs `Loot & rewards`) collapse
 *  to one slug so the stylesheet doesn't need to know about the drift. */
const SLUGS: Record<string, string> = {
  summary: 'summary',
  'key events': 'key-events',
  loot: 'loot',
  'loot & rewards': 'loot',
  'loot and rewards': 'loot',
  combat: 'combat',
  'combat & deaths': 'combat',
  'combat and deaths': 'combat',
  'pc deaths recorded': 'combat',
  'open threads': 'open-threads',
  'milestones recorded': 'milestones',
  'attribution notes': 'notes',
};

/** Sections rendered as collapsed-by-default `<details>`. */
const COLLAPSIBLE = new Set(['key-events', 'loot', 'combat', 'open-threads', 'notes']);

/** Plain-text of a heading node, for the `<summary>` label. */
function headingText(node: any): string {
  const parts: string[] = [];
  const walk = (n: any) => {
    if (typeof n.value === 'string') parts.push(n.value);
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return parts.join('').trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function remarkSectionWrap() {
  return (tree: any, file: any) => {
    const path: string = file?.path ?? file?.history?.[0] ?? '';
    // Episode pages only. Dossiers, arcs and singletons keep their natural flow.
    if (!/canon[\\/]episodes[\\/]/.test(path)) return;

    const children: any[] = tree.children ?? [];
    if (!children.some((n) => n.type === 'heading' && n.depth === 2)) return;

    const out: any[] = [];
    let open: string | null = null; // closing tag for the section currently open

    const closeOpen = () => {
      if (open) {
        out.push({ type: 'html', value: open });
        open = null;
      }
    };

    for (const node of children) {
      if (node.type === 'heading' && node.depth === 2) {
        closeOpen();
        const text = headingText(node);
        const slug = SLUGS[text.toLowerCase()] ?? slugify(text);

        if (COLLAPSIBLE.has(slug)) {
          out.push({
            type: 'html',
            value:
              `<details class="epsec is-collapsible" data-sec="${slug}">` +
              `<summary><span class="epsec-title">${escapeHtml(text)}</span></summary>` +
              `<div class="epsec-body">`,
          });
          open = '</div></details>';
          // The heading itself is replaced by the <summary> — don't emit it twice.
          continue;
        }

        out.push({ type: 'html', value: `<section class="epsec" data-sec="${slug}">` });
        open = '</section>';
        out.push(node);
        continue;
      }

      // Content before the first `##` (rare) rides along outside any section.
      out.push(node);
    }

    closeOpen();
    tree.children = out;
  };
}
