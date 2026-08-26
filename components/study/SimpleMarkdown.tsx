import styles from "./SimpleMarkdown.module.css";

interface ListLine {
  indent: number;
  ordered: boolean;
  content: string;
}

type CitationRenderer = (index: number) => React.ReactNode;

/** Minimal markdown renderer: headings, nested/ordered lists, bold, italic,
 * and (optionally) inline [n] citation markers — enough for AI-generated
 * study text and chat replies. */
export function SimpleMarkdown({
  text,
  renderCitation,
}: {
  text: string;
  renderCitation?: CitationRenderer;
}) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: ListLine[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    const [node] = renderListLevel(listBuffer, 0, listBuffer[0].indent, renderCitation);
    blocks.push(<div key={`list-${blocks.length}`}>{node}</div>);
    listBuffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bulletMatch = /^(\s*)[-*]\s+(.*)/.exec(line);
    const orderedMatch = /^(\s*)\d+[.)]\s+(.*)/.exec(line);

    if (bulletMatch || orderedMatch) {
      const match = bulletMatch ?? orderedMatch!;
      listBuffer.push({
        indent: Math.floor(match[1].length / 2),
        ordered: !!orderedMatch,
        content: match[2],
      });
      continue;
    }
    flushList();

    if (line.startsWith("### ")) {
      blocks.push(<h3 key={blocks.length}>{renderInline(line.slice(4), renderCitation)}</h3>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={blocks.length}>{renderInline(line.slice(3), renderCitation)}</h2>);
    } else if (line.startsWith("# ")) {
      blocks.push(<h1 key={blocks.length}>{renderInline(line.slice(2), renderCitation)}</h1>);
    } else if (line.trim().length > 0) {
      blocks.push(<p key={blocks.length}>{renderInline(line, renderCitation)}</p>);
    }
  }
  flushList();

  return <div className={styles.wrap}>{blocks}</div>;
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

const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|\[\d+\])/g;

function renderInline(text: string, renderCitation: CitationRenderer | undefined): React.ReactNode[] {
  const parts = text.split(INLINE_TOKEN);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const citationMatch = /^\[(\d+)\]$/.exec(part);
    if (citationMatch && renderCitation) {
      return <span key={i}>{renderCitation(Number(citationMatch[1]))}</span>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}
