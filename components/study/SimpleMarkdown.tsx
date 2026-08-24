import styles from "./SimpleMarkdown.module.css";

/** Minimal markdown renderer: headings, bullet lists, bold — enough for AI-generated study text. */
export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className={styles.list}>
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bullet = /^[-*]\s+(.*)/.exec(line);

    if (bullet) {
      listBuffer.push(bullet[1]);
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
