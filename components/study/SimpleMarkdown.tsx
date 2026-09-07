import React from "react";
import Link from "next/link";
import { MathTex } from "./MathTex";
import styles from "./SimpleMarkdown.module.css";

interface ListLine {
  indent: number;
  ordered: boolean;
  content: string;
}

type CitationRenderer = (index: number) => React.ReactNode;

function isTableDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false;
  const parts = trimmed.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((p) => /^:?-+:?$/.test(p));
}

function parseTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((s) => s.trim());
}

function parseTableAlignments(delimiterRow: string): Array<"left" | "center" | "right"> {
  const parts = parseTableRow(delimiterRow);
  return parts.map((p) => {
    const left = p.startsWith(":");
    const right = p.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

function sanitizeLatex(tex: string): string {
  if (!tex) return "";
  let t = tex;

  // Clean unicode math characters
  t = t
    .replace(/·/g, " \\cdot ")
    .replace(/ᵀ/g, "^{\\top}")
    .replace(/[∣│]/g, " \\mid ")
    .replace(/√/g, "\\sqrt")
    .replace(/→/g, "\\to ")
    .replace(/μ/g, "\\mu ")
    .replace(/σ/g, "\\sigma ")
    .replace(/θ/g, "\\theta ")
    .replace(/λ/g, "\\lambda ")
    .replace(/α/g, "\\alpha ")
    .replace(/β/g, "\\beta ")
    .replace(/γ/g, "\\gamma ")
    .replace(/∈/g, "\\in ")
    .replace(/∑/g, "\\sum ")
    .replace(/∏/g, "\\prod ")
    .replace(/∇/g, "\\nabla ")
    .replace(/∂/g, "\\partial ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\neq ")
    .replace(/≈/g, "\\approx ")
    .replace(/∞/g, "\\infty ");

  // Fix missing underscore in \sum and \prod: \sumt -> \sum_t, \sumi -> \sum_i, \sumn -> \sum_n, etc.
  t = t.replace(/\\sum([a-zA-Z])(?![a-zA-Z])/g, "\\sum_$1 ");
  t = t.replace(/\\prod([a-zA-Z])(?![a-zA-Z])/g, "\\prod_$1 ");

  // Fix missing underscore in p\theta, q\phi, p\phi, p\theta -> p_\theta
  t = t.replace(/([pqP])\\(theta|phi|psi|lambda|alpha|beta|sigma|mu)/g, "$1_\\$2");

  // Fix \mu,\sigma2 -> \mu, \sigma^2 or \sigma2 -> \sigma^2
  t = t.replace(/\\sigma\s*2\b/g, "\\sigma^2");

  // Fix \log p\theta -> \log p_\theta or \logp -> \log p
  t = t.replace(/\\log\s*([a-zA-Z])/g, "\\log $1");

  // Fix (xt \mid x<t) -> (x_t \mid x_{<t})
  t = t.replace(/\b([xXyYzZ])([tijk0-9])\b/g, "$1_$2");
  t = t.replace(/([xXyYzZ])<([tijk0-9])/g, "$1_{<$2}");

  // Fix \mathsf{T} -> {\top}
  t = t.replace(/\\mathsf\{T\}/g, "{\\top}");

  // Fix QKT or QK^T -> Q K^\top
  t = t.replace(/\bQK\^?T\b/g, "Q K^{\\top}");
  t = t.replace(/QK\^\{\\mathsf\{T\}\}/g, "Q K^{\\top}");

  // Fix 1/dk -> \frac{1}{\sqrt{d_k}} or 1/d_k
  t = t.replace(/\b1\/dk\b/g, "\\frac{1}{\\sqrt{d_k}}");

  // Fix dmodel -> d_{\text{model}}
  t = t.replace(/\bdmodel\b/g, "d_{\\text{model}}");

  // Fix WQ, WK, WV, WO
  t = t.replace(/\bW([QKVOD])\b/g, "W_$1");
  t = t.replace(/\bW([QKVOD])\((\w+)\)/g, "W_$1^{($2)}");

  // Fix Concat(head1,…,headh)
  t = t.replace(/\bhead([0-9a-z])\b/g, "\\text{head}_$1");
  t = t.replace(/\bConcat\(/g, "\\text{Concat}(");

  // Fix softmax -> \operatorname{softmax}
  t = t.replace(/\\text\{softmax\}|softmax/g, "\\operatorname{softmax}");

  return t.trim();
}

function normalizeMathText(text: string): string {
  if (!text) return text;

  // 1. Convert $$ ... $$ to \[ ... \] with sanitized content
  let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => `\\[${sanitizeLatex(math)}\\]`);

  // 2. Normalize existing \[ ... \] with sanitized content
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => `\\[${sanitizeLatex(math)}\\]`);

  // 3. Normalize existing \( ... \) with sanitized content
  out = out.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => `\\(${sanitizeLatex(math)}\\)`);

  // 4. Convert single dollar math $...$
  out = out.replace(/(?<![\w\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?![\w$])/g, (_, math) => {
    if (/^\d+(?:\.\d+)?$/.test(math.trim())) return `$${math}$`;
    return `\\(${sanitizeLatex(math)}\\)`;
  });

  // 5. Replace unicode math characters in text
  out = out
    .replace(/ᵀ/g, "^T")
    .replace(/·/g, " \\cdot ");

  // 6. Split by existing math/code/bold/link tokens so we don't double-wrap math inside existing tokens
  const tokenRegex = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const segments = out.split(tokenRegex);

  return segments
    .map((seg) => {
      if (!seg || seg.startsWith("\\[") || seg.startsWith("\\(") || seg.startsWith("**") || seg.startsWith("`") || seg.startsWith("[")) {
        return seg;
      }

      let s = seg;

      // Wrap Q=XWQ, K=XWK, V=XWV, Qi=XWQ(i), Ki=XWK(i), Vi=XWV(i)
      s = s.replace(/\b([QKV])\s*=\s*X\s*W\s*([QKVOD])(?:\((\w+)\))?/g, (_, lhs, rhs, head) => {
        const sub = head ? `_{${rhs}}^{(${head})}` : `_${rhs}`;
        return `\\(${lhs} = X W${sub}\\)`;
      });
      s = s.replace(/\b([QKV])([0-9a-z])\s*=\s*X\s*W\s*([QKVOD])(?:\((\w+)\))?/g, (_, lhs, idx, rhs, head) => {
        const sub = head ? `_{${rhs}}^{(${head})}` : `_${rhs}`;
        return `\\(${lhs}_${idx} = X W${sub}\\)`;
      });

      // Wrap scores=QKT or scores = QK^T
      s = s.replace(/\bscores\s*=\s*QK\^?[Tᵀ]?\b/gi, `\\(\\text{scores} = Q K^{\\top}\\)`);

      // Wrap 1/dk -> \(1/\sqrt{d_k}\)
      s = s.replace(/\b1\/dk\b/g, `\\(\\frac{1}{\\sqrt{d_k}}\\)`);

      // Wrap Probability expressions: P(y∣x), P(x,y), P(x), q(z∣x), p(z), p(x \mid y)
      s = s.replace(/\b([PpQq])\(([a-zA-Z0-9,\s]+(?:[∣|│\\]+[a-zA-Z0-9,\s]+)?)\)/g, (_, fn, inside) => {
        const cleanedInside = inside.replace(/[∣│|]/g, " \\mid ");
        return `\\(${fn}(${cleanedInside})\\)`;
      });

      // Wrap distribution N(0,I) or N(0, I)
      s = s.replace(/\bN\(0\s*,\s*I\)/g, `\\(\\mathcal{N}(0, I)\\)`);

      // Wrap O(t·dmodel) or O(dmodel) or O(...)
      s = s.replace(/\bO\(([^)]*dmodel[^)]*)\)/g, (_, inside) => {
        const cleaned = inside.replace(/·/g, " \\cdot ").replace(/dmodel/g, "d_{\\text{model}}");
        return `\\(O(${cleaned})\\)`;
      });

      // Wrap Concat(head1,…,headh)
      s = s.replace(/\bConcat\(([^)]+)\)/g, (_, inside) => {
        const cleaned = inside
          .replace(/head([0-9a-z])/g, "\\text{head}_$1")
          .replace(/[…,]/g, ", \\dots, ");
        return `\\(\\text{Concat}(${cleaned})\\)`;
      });

      // Wrap WQ, WK, WV, WO in text (when standalone)
      s = s.replace(/(?<=\s|^|,)(W[QKVOD])(?=\s|[.,;:)]|$)/g, (m) => `\\(W_${m.slice(1)}\\)`);

      // Wrap μ,σ2 or μ, σ^2 or \mu,\sigma2
      s = s.replace(/(\\?mu\s*,\s*\\?sigma\s*2)/g, `\\(\\mu, \\sigma^2\\)`);

      // Auto-wrap bare subscript equations like Score_{i,j}=Q_i \cdot K_j^T or X_{1,2}
      s = s.replace(/([A-Za-z]+_\{[^{}\n]+\}(?:[=+\-*/\s]|\\cdot|[A-Za-z0-9_^{}·+\-*/^()]+)*)/g, (m) => {
        const endPunct = m.match(/[;,.]\s*$/);
        let core = m;
        let suffix = "";
        if (endPunct) {
          suffix = endPunct[0];
          core = m.slice(0, -suffix.length);
        }
        return `\\(${core.trim()}\\)${suffix}`;
      });

      return s;
    })
    .join("");
}

// LaTeX delimiters, inline code, bold, italic, citations, markdown links, strikethrough
const INLINE_TOKEN =
  /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[\d+\]|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*|_[^_\n]+_|~~[^~]+~~)/g;

export function renderInline(
  rawText: string,
  renderCitation: CitationRenderer | undefined,
): React.ReactNode[] {
  const text = normalizeMathText(rawText);
  const parts = text.split(INLINE_TOKEN);

  return parts.map((part, i) => {
    if (!part) return null;

    // Display math
    if (part.startsWith("\\[") && part.endsWith("\\]")) {
      return <MathTex key={i} tex={part.slice(2, -2)} display />;
    }
    // Inline math
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      return <MathTex key={i} tex={part.slice(2, -2)} display={false} />;
    }
    // Inline code
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code key={i} className={styles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }
    // Bold
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Citations [n]
    const citationMatch = /^\[(\d+)\]$/.exec(part);
    if (citationMatch) {
      const idx = Number(citationMatch[1]);
      if (renderCitation) {
        return <span key={i} className={styles.citationWrap}>{renderCitation(idx)}</span>;
      }
      return (
        <sup key={i} className={styles.defaultCitation}>
          [{idx}]
        </sup>
      );
    }
    // Markdown link [text](url)
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isExternal = href.startsWith("http");
      return (
        <Link
          key={i}
          href={href}
          className={styles.link}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {label}
        </Link>
      );
    }
    // Strikethrough
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      return <del key={i}>{part.slice(2, -2)}</del>;
    }
    // Italic
    if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
        (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function InlineMath({
  text,
  renderCitation,
}: {
  text: string;
  renderCitation?: CitationRenderer;
}) {
  return <>{renderInline(text, renderCitation)}</>;
}

/** Consumes lines at exactly `level` indent (plus their deeper children) starting at `start`. */
function renderListLevel(
  lines: ListLine[],
  start: number,
  level: number,
  renderCitation: CitationRenderer | undefined,
): [React.ReactNode, number] {
  const items: React.ReactNode[] = [];
  const ordered = lines[start]?.ordered ?? false;
  let i = start;

  while (i < lines.length && lines[i].indent === level) {
    const line = lines[i];
    i++;

    let children: React.ReactNode = null;
    if (i < lines.length && lines[i].indent > level) {
      const [childNode, next] = renderListLevel(lines, i, lines[i].indent, renderCitation);
      children = childNode;
      i = next;
    }

    items.push(
      <li key={items.length}>
        {renderInline(line.content, renderCitation)}
        {children}
      </li>,
    );
  }

  const Tag = ordered ? "ol" : "ul";
  return [
    <Tag key={level} className={styles.list}>
      {items}
    </Tag>,
    i,
  ];
}

/** Universal markdown renderer: Tables, code blocks, blockquotes, headings,
 * lists, bold, italic, inline math (KaTeX), citations, and links. */
export function SimpleMarkdown({
  text,
  renderCitation,
}: {
  text: string;
  renderCitation?: CitationRenderer;
}) {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    // Blank line
    if (line.trim().length === 0) {
      i++;
      continue;
    }

    // 0. Standalone / Multi-line Display Math Blocks: \[ ... \] or $$ ... $$
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("\\[") || trimmedLine.startsWith("$$")) {
      const isBracket = trimmedLine.startsWith("\\[");
      const endTag = isBracket ? "\\]" : "$$";

      // If opening and closing on the same single line
      if (
        trimmedLine.length > 2 &&
        trimmedLine.endsWith(endTag) &&
        trimmedLine !== "\\[" &&
        trimmedLine !== "$$"
      ) {
        const mathContent = sanitizeLatex(trimmedLine.slice(2, -endTag.length));
        blocks.push(
          <div key={`math-${blocks.length}`} className={styles.mathBlock}>
            <MathTex tex={mathContent} display={true} />
          </div>,
        );
        i++;
        continue;
      }

      // Collect multi-line math block
      const mathLines: string[] = [];
      const startLinePart = trimmedLine.slice(2);
      if (startLinePart.trim()) mathLines.push(startLinePart);
      i++;
      while (i < lines.length && !lines[i].includes(endTag)) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        const endLine = lines[i];
        const endIdx = endLine.indexOf(endTag);
        const contentBeforeEnd = endLine.slice(0, endIdx);
        if (contentBeforeEnd.trim()) mathLines.push(contentBeforeEnd);
        i++; // consume line containing endTag
      }
      const fullMath = sanitizeLatex(mathLines.join("\n"));
      blocks.push(
        <div key={`math-${blocks.length}`} className={styles.mathBlock}>
          <MathTex tex={fullMath} display={true} />
        </div>,
      );
      continue;
    }

    // 1. Fenced Code Block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      blocks.push(
        <div key={`code-${blocks.length}`} className={styles.codeBlockWrap}>
          {lang && <div className={styles.codeHeader}>{lang}</div>}
          <pre className={styles.codeBlock}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      );
      continue;
    }

    // 2. Table with Delimiter (Standard GFM)
    if (line.includes("|") && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
      const headers = parseTableRow(line);
      const alignments = parseTableAlignments(lines[i + 1]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().length > 0) {
        if (!isTableDelimiter(lines[i])) {
          rows.push(parseTableRow(lines[i]));
        }
        i++;
      }
      blocks.push(
        <div key={`table-${blocks.length}`} className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} style={{ textAlign: alignments[hIdx] ?? "left" }}>
                    {renderInline(h, renderCitation)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ textAlign: alignments[cIdx] ?? "left" }}>
                      {renderInline(cell, renderCitation)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 3. Consecutive pipe rows without header delimiter (Key-Value or multi-pipe lines)
    if (line.trim().startsWith("|") && line.trim().endsWith("|") && line.includes("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        if (!isTableDelimiter(lines[i])) {
          rows.push(parseTableRow(lines[i]));
        }
        i++;
      }
      if (rows.length > 0) {
        blocks.push(
          <div key={`table-plain-${blocks.length}`} className={styles.tableWrapper}>
            <table className={styles.table}>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className={cIdx === 0 ? styles.tableKeyCell : undefined}>
                        {renderInline(cell, renderCitation)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    // 4. Blockquote
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={`quote-${blocks.length}`} className={styles.blockquote}>
          <SimpleMarkdown text={quoteLines.join("\n")} renderCitation={renderCitation} />
        </blockquote>,
      );
      continue;
    }

    // 5. Lists (Ordered, Unordered, Nested)
    const bulletMatch = /^(\s*)[-*]\s+(.*)/.exec(line);
    const orderedMatch = /^(\s*)\d+[.)]\s+(.*)/.exec(line);
    if (bulletMatch || orderedMatch) {
      const listBuffer: ListLine[] = [];
      while (i < lines.length) {
        const curLine = lines[i].trimEnd();
        const bMatch = /^(\s*)[-*]\s+(.*)/.exec(curLine);
        const oMatch = /^(\s*)\d+[.)]\s+(.*)/.exec(curLine);
        if (!bMatch && !oMatch) break;
        const m = bMatch ?? oMatch!;
        listBuffer.push({
          indent: Math.floor(m[1].length / 2),
          ordered: !!oMatch,
          content: m[2],
        });
        i++;
      }
      if (listBuffer.length > 0) {
        const [node] = renderListLevel(listBuffer, 0, listBuffer[0].indent, renderCitation);
        blocks.push(<div key={`list-${blocks.length}`}>{node}</div>);
      }
      continue;
    }

    // 6. Horizontal Rules
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(<hr key={`rule-${blocks.length}`} className={styles.rule} />);
      i++;
      continue;
    }

    // 7. Headings
    if (line.startsWith("###### ")) {
      blocks.push(<h6 key={`h6-${blocks.length}`}>{renderInline(line.slice(7), renderCitation)}</h6>);
      i++;
      continue;
    }
    if (line.startsWith("##### ")) {
      blocks.push(<h5 key={`h5-${blocks.length}`}>{renderInline(line.slice(6), renderCitation)}</h5>);
      i++;
      continue;
    }
    if (line.startsWith("#### ")) {
      blocks.push(<h4 key={`h4-${blocks.length}`}>{renderInline(line.slice(5), renderCitation)}</h4>);
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={`h3-${blocks.length}`}>{renderInline(line.slice(4), renderCitation)}</h3>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={`h2-${blocks.length}`}>{renderInline(line.slice(3), renderCitation)}</h2>);
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h1 key={`h1-${blocks.length}`}>{renderInline(line.slice(2), renderCitation)}</h1>);
      i++;
      continue;
    }

    // 8. Regular paragraph
    blocks.push(
      <p key={`p-${blocks.length}`} className={styles.paragraph}>
        {renderInline(line, renderCitation)}
      </p>,
    );
    i++;
  }

  return <div className={styles.wrap}>{blocks}</div>;
}
