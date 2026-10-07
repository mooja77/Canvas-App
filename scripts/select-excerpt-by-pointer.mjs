/** Select actual rendered text with browser pointer input, not injected events. */
export async function selectExcerptByPointer(page, startText, characterCount) {
  const text = page.locator('.select-text').filter({ hasText: startText }).first();
  await text.waitFor({ state: 'visible', timeout: 20_000 });
  await text.scrollIntoViewIfNeeded();
  const positions = await text.evaluate(
    (element, excerpt) => {
      const content = element.textContent ?? '';
      const offset = content.indexOf(excerpt.startText);
      if (offset < 0 || excerpt.characterCount < 1 || offset + excerpt.characterCount > content.length) {
        throw new Error('Requested excerpt is not present in the rendered transcript');
      }
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      const pointAt = (absolute) => {
        let consumed = 0;
        for (const textNode of nodes) {
          const length = textNode.textContent?.length ?? 0;
          if (absolute < consumed + length) return { node: textNode, offset: absolute - consumed };
          consumed += length;
        }
        const last = nodes.at(-1);
        if (!last) throw new Error('Rendered text has no character nodes');
        return { node: last, offset: last.textContent?.length ?? 0 };
      };
      const rectangleAt = (absolute) => {
        const start = pointAt(absolute);
        const end = pointAt(absolute + 1);
        const range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        const rect = range.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) throw new Error('Excerpt character has no visible rectangle');
        return { left: rect.left, width: rect.width, y: rect.top + rect.height / 2 };
      };
      const start = rectangleAt(offset);
      const end = rectangleAt(offset + excerpt.characterCount - 1);
      return {
        start: { x: start.left + start.width * 0.25, y: start.y },
        end: { x: end.left + end.width * 0.75, y: end.y },
        expected: content.slice(offset, offset + excerpt.characterCount),
      };
    },
    { startText, characterCount },
  );
  await page.mouse.move(positions.start.x, positions.start.y);
  await page.mouse.down();
  try {
    await page.mouse.move(positions.end.x, positions.end.y, { steps: 12 });
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '');
    if (selected !== positions.expected) throw new Error('Real pointer selection differs from the requested excerpt');
  } finally {
    await page.mouse.up();
  }
}
