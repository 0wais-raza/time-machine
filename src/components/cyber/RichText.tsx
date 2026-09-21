import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight inline markdown renderer for J.A.R.V.I.S. output.
 * Supports: **bold**, *italic*, `code`, ~~strike~~, and [text](url).
 * Implemented as a tiny tokenizer — no dangerouslySetInnerHTML.
 */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = "";
  let i = 0;
  let k = 0;
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };
  while (i < text.length) {
    const rest = text.slice(i);
    // **bold**
    const bold = rest.match(/^\*\*([^*]+)\*\*/);
    if (bold) {
      flush();
      out.push(
        <strong key={`${keyBase}-b${k++}`} className="font-bold text-foreground">
          {bold[1]}
        </strong>,
      );
      i += bold[0].length;
      continue;
    }
    // `code`
    const code = rest.match(/^`([^`]+)`/);
    if (code) {
      flush();
      out.push(
        <code
          key={`${keyBase}-c${k++}`}
          className="rounded bg-[oklch(0.85_0.17_200/0.1)] px-1 py-0.5 font-mono text-[0.85em] text-[var(--holo-cyan)]"
        >
          {code[1]}
        </code>,
      );
      i += code[0].length;
      continue;
    }
    // [text](url)
    const link = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/);
    if (link) {
      flush();
      out.push(
        <a
          key={`${keyBase}-l${k++}`}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--holo-cyan)] underline decoration-[oklch(0.85_0.17_200/0.4)] underline-offset-2 hover:decoration-[var(--holo-cyan)]"
        >
          {link[1]}
        </a>,
      );
      i += link[0].length;
      continue;
    }
    // ~~strike~~
    const strike = rest.match(/^~~([^~]+)~~/);
    if (strike) {
      flush();
      out.push(
        <s key={`${keyBase}-s${k++}`} className="text-muted-foreground">
          {strike[1]}
        </s>,
      );
      i += strike[0].length;
      continue;
    }
    // *italic* (only when followed by content + closing asterisk on same line)
    const ital = rest.match(/^\*([^*\n]+)\*/);
    if (ital) {
      flush();
      out.push(
        <em key={`${keyBase}-i${k++}`} className="italic text-foreground/90">
          {ital[1]}
        </em>,
      );
      i += ital[0].length;
      continue;
    }
    buf += text[i];
    i++;
  }
  flush();
  return out;
}

/**
 * Block-level renderer — splits a message into paragraphs, headers (## / ###),
 * bullet lists (- / •), numbered lists, and ─── dividers commonly emitted by
 * the AI, then renders each with HUD-consistent typography.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let k = 0;

  const closeList = () => {
    if (!list) return;
    const L = list;
    const Tag = L.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`bl-${k++}`}
        className={cn(
          "my-1.5 space-y-1 pl-1",
          L.ordered ? "list-none" : "list-none",
        )}
      >
        {L.items.map((item, j) => (
          <li key={j} className="flex gap-2">
            <span
              className={cn(
                "mt-[0.45em] shrink-0 leading-none",
                L.ordered
                  ? "font-mono text-[9px] font-bold text-[var(--holo-violet)] min-w-[14px]"
                  : "size-1 rounded-full bg-[var(--holo-cyan)] mt-[0.5em]",
              )}
            >
              {L.ordered ? `${j + 1}.` : ""}
            </span>
            <span className="min-w-0 flex-1">{renderInline(item, `li-${k}-${j}`)}</span>
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    // Divider: ─── or --- or ***
    if (/^\s*(─{3,}|-{3,}|\*{3,})\s*$/.test(line)) {
      closeList();
      blocks.push(
        <div
          key={`div-${k++}`}
          className="my-2.5 h-px bg-gradient-to-r from-[oklch(0.85_0.17_200/0.35)] via-[oklch(0.66_0.27_295/0.2)] to-transparent"
        />,
      );
      continue;
    }
    // Headers: ## / ###
    const h = line.match(/^(#{2,4})\s+(.+)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      blocks.push(
        <div
          key={`h-${k++}`}
          className={cn(
            "mt-3 mb-1 flex items-center gap-2 font-mono font-bold uppercase tracking-[0.18em]",
            level <= 2
              ? "text-[11px] text-[var(--holo-cyan)]"
              : "text-[10px] text-[var(--holo-violet)]",
          )}
        >
          <span className="size-1 rounded-full bg-current" />
          {renderInline(h[2], `hh-${k}`)}
        </div>,
      );
      continue;
    }
    // Bullets
    const bullet = line.match(/^\s*[-•*]\s+(.+)$/);
    if (bullet) {
      if (!list || list.ordered) {
        closeList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    // Numbered: "1. " or "1) "
    const num = line.match(/^\s*(\d{1,2})[.)]\s+(.+)$/);
    if (num) {
      if (!list || !list.ordered) {
        closeList();
        list = { ordered: true, items: [] };
      }
      list.items.push(num[2]);
      continue;
    }
    // Blank line
    if (!line.trim()) {
      closeList();
      continue;
    }
    // Paragraph line
    closeList();
    blocks.push(
      <p key={`p-${k++}`} className="my-1 leading-relaxed">
        {renderInline(line, `p-${k}`)}
      </p>,
    );
  }
  closeList();

  return <div className={cn("text-[13px]", className)}>{blocks}</div>;
}
