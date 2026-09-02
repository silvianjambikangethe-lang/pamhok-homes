import type { ReactNode } from "react";

// Renders a TermsSection's plain-text body (see TermsContent in
// supabase/types.ts) into paragraphs/bullet lists with bold support —
// lightweight enough to write and edit in a plain textarea, but enough
// to reproduce the original hardcoded Terms page's formatting.
export function renderTermsBody(body: string): ReactNode[] {
  const lines = body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const blocks: ReactNode[] = [];
  let currentList: string[] = [];

  function flushList() {
    if (currentList.length === 0) return;
    blocks.push(
      <ul key={blocks.length} className="list-disc space-y-1.5 pl-5">
        {currentList.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    currentList = [];
  }

  for (const line of lines) {
    if (line.startsWith("- ")) {
      currentList.push(line.slice(2));
    } else {
      flushList();
      blocks.push(<p key={blocks.length}>{renderInline(line)}</p>);
    }
  }
  flushList();

  return blocks;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-ink">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
