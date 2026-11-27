import katex from "katex";
// Loaded here rather than in globals.css so only routes that render math
// pay for the stylesheet (and its font-face rules).
import "katex/dist/katex.min.css";

/** Renders a LaTeX string via KaTeX — runs isomorphically (server or
 * client), no API/network call. throwOnError is off so malformed TeX from
 * a model degrades to KaTeX's own inline error markup instead of crashing
 * the page. */
export function MathTex({ tex, display }: { tex: string; display: boolean }) {
  const html = katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    output: "html",
  });
  // html is KaTeX's own generated markup, not raw model/user input
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
