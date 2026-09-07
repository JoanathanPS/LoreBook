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

function normalizeMathText(text: string): string {
  if (!text) return text;

  // 1. Replace $$ ... $$ display math -> \[ ... \]
  let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => `\\[${math.trim()}\\]`);

  // 2. Clean unicode math characters
  out = out.replace(/·/g, " \\cdot ").replace(/ᵀ/g, "^T");

  // 3. Match single dollar inline math: $...$ where not a price
  out = out.replace(/(?<![\w\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?![\w$])/g, (_, math) => {
    if (/^\d+(?:\.\d+)?$/.test(math.trim())) return `$${math}$`;
    return `\\(${math.trim()}\\)`;
  });

  // 4. Auto-wrap bare subscript equations like Score_{i,j}=Q_i \cdot K_j^T or X_{1,2}
  const segments = out.split(/(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return segments
    .map((seg) => {
      if (!seg || seg.startsWith("\\[") || seg.startsWith("\\(") || seg.startsWith("**") || seg.startsWith("*")) {
        return seg;
      }
      return seg.replace(/([A-Za-z]+_\{[^{}\n]+\}(?:[=+\-*/\s]|\\cdot|[A-Za-z0-9_^{}·+\-*/^()]+)*)/g, (m) => {
        const endPunct = m.match(/[;,.]\s*$/);
        let core = m;
        let suffix = "";
        if (endPunct) {
          suffix = endPunct[0];
          core = m.slice(0, -suffix.length);
        }
        return `\\(${core.trim()}\\)${suffix}`;
      });
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
