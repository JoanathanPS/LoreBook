import styles from "./SimpleMarkdown.module.css";

interface ListLine {
  indent: number;
  ordered: boolean;
  content: string;
}

/** Minimal markdown renderer: headings, nested/ordered lists, bold — enough for AI-generated study text. */
export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: ListLine[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    const [node] = renderListLevel(listBuffer, 0, listBuffer[0].indent);
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
      blocks.push(<h3 key={blocks.length}>{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={blocks.length}>{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      blocks.push(<h1 key={blocks.length}>{renderInline(line.slice(2))}</h1>);
    } else if (line.trim().length > 0) {
      blocks.push(<p key={blocks.length}>{renderInline(line)}</p>);
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
): [React.ReactNode, number] {
  const items: React.ReactNode[] = [];
  const ordered = lines[start]?.ordered ?? false;
  let i = start;

  while (i < lines.length && lines[i].indent === level) {
    const line = lines[i];
    i++;

    let children: React.ReactNode = null;
    if (i < lines.length && lines[i].indent > level) {
      const [childNode, next] = renderListLevel(lines, i, lines[i].indent);
      children = childNode;
      i = next;
    }

    items.push(
      <li key={items.length}>
        {renderInline(line.content)}
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

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
