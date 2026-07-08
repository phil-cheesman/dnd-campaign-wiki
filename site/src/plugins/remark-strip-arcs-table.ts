/**
 * The campaign overview (`canon/arcs/00-overview.md`) ends with a `## Arcs`
 * table that is the in-repo table of contents for the nine arc files. On the
 * site that table is redundant with the arc card grid AND its links point at
 * raw `.md` files (which 404 under the site router), so we drop everything from
 * the `## Arcs` heading onward when rendering the overview. The canon file keeps
 * the table intact for in-repo navigation; this strip is render-time only and
 * scoped to the overview file by path.
 */
export function remarkStripArcsTable() {
  return (tree: any, file: any) => {
    const path = file?.path ?? file?.history?.[0] ?? '';
    if (!path.includes('00-overview')) return;
    const idx = tree.children?.findIndex(
      (n: any) =>
        n.type === 'heading' &&
        n.depth === 2 &&
        n.children?.[0]?.value?.trim() === 'Arcs',
    );
    if (idx !== undefined && idx !== -1) tree.children.length = idx;
  };
}
