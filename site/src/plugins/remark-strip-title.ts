/**
 * Every canon markdown file leads with an `# Title` H1 that duplicates the
 * frontmatter `name`/heading — which every page template already renders as the
 * page <h1>. Without this, the title shows up twice (see the doubled heading on
 * dossier pages). Strip the leading top-level heading so it only renders once.
 *
 * Only the *first* child is touched, and only when it's a depth-1 heading, so
 * legitimate in-body content is never removed.
 */
export function remarkStripTitle() {
  return (tree: any) => {
    const first = tree.children?.[0];
    if (first && first.type === 'heading' && first.depth === 1) {
      tree.children.shift();
    }
  };
}
