import { remark } from "remark";
import remarkHtml from "remark-html";

/**
 * Converts a markdown string to an HTML string.
 * Used server-side only for static legal pages.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkHtml, { sanitize: false })
    .process(markdown);
  return result.toString();
}
