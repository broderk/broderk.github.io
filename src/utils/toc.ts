/** 使用 Markdown/MDX 渲染后的标题层级，不升降级或重新编号。 */
export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocNode extends Heading {
  children: TocNode[];
}

export function buildToc(headings: Heading[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];
  for (const heading of headings) {
    const node: TocNode = { ...heading, children: [] };
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}
