import { Fragment, type ReactNode } from 'react';
import { parseYouTubeId } from '@/lib/format';

/**
 * Small, dependency-free formatter for guide sections and forum posts.
 *
 * Supported syntax:
 *   **bold**  *italic*  `code`
 *   [label](https://example.com)
 *   ![alt](https://example.com/picture.png)   (or a bare image URL)
 *   A line that is only a YouTube link renders as an embed.
 *   Lines starting with "- " or "* " render as a list.
 *   Lines starting with "#", "##" or "###" render as headings.
 *
 * Everything is rendered as React nodes: raw HTML is never injected.
 */

const INLINE_PATTERN =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|(https?:\/\/[^\s<>"')\]]+)/g;

function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  return null;
}

function isImageUrl(url: string): boolean {
  return /^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif)(\?[^\s]*)?$/i.test(url);
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;
  INLINE_PATTERN.lastIndex = 0;

  let match = INLINE_PATTERN.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${index++}`;
    const [, linkLabel, linkTarget, bold, italic, code, bareUrl] = match;

    if (linkLabel && linkTarget) {
      const href = safeHref(linkTarget);
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            className="text-[var(--sr-link)] underline underline-offset-2 hover:text-[var(--sr-primary)]"
            {...(/^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {linkLabel}
          </a>
        ) : (
          <Fragment key={key}>{linkLabel}</Fragment>
        ),
      );
    } else if (bold) {
      nodes.push(
        <strong key={key} className="font-semibold text-[var(--sr-text)]">
          {bold}
        </strong>,
      );
    } else if (italic) {
      nodes.push(
        <em key={key} className="italic">
          {italic}
        </em>,
      );
    } else if (code) {
      nodes.push(
        <code
          key={key}
          className="sr-mono rounded-sm border border-[var(--sr-border)] bg-[var(--sr-bg-2)] px-1 py-0.5 text-[0.85em] text-[var(--sr-text)]"
        >
          {code}
        </code>,
      );
    } else if (bareUrl) {
      nodes.push(
        <a
          key={key}
          href={bareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-[var(--sr-link)] underline underline-offset-2 hover:text-[var(--sr-primary)]"
        >
          {bareUrl}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
    match = INLINE_PATTERN.exec(text);
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function ImageBlock({ url, alt }: { url: string; alt: string }) {
  return (
    <figure className="my-3">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className="max-h-[32rem] w-auto max-w-full rounded-sm border border-[var(--sr-border)] object-contain"
      />
      {alt && <figcaption className="mt-1 text-xs text-[var(--sr-text-muted)]">{alt}</figcaption>}
    </figure>
  );
}

function YouTubeBlock({ videoId }: { videoId: string }) {
  return (
    <div className="my-3 aspect-video w-full max-w-2xl overflow-hidden rounded-sm border border-[var(--sr-border)] bg-black">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}

export function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  const source = text.replace(/\r\n/g, '\n').trim();
  if (!source) return null;

  const blocks: ReactNode[] = [];
  const lines = source.split('\n');
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    // Standalone image: markdown image or bare image URL.
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imageMatch) {
      const url = safeHref(imageMatch[2] ?? '');
      if (url) {
        blocks.push(<ImageBlock key={`img-${key++}`} url={url} alt={imageMatch[1] ?? ''} />);
        index += 1;
        continue;
      }
    }
    if (isImageUrl(trimmed) && safeHref(trimmed)) {
      blocks.push(<ImageBlock key={`img-${key++}`} url={trimmed} alt="" />);
      index += 1;
      continue;
    }

    // Standalone YouTube link.
    const videoId = parseYouTubeId(trimmed);
    if (videoId && /youtu\.?be/i.test(trimmed)) {
      blocks.push(<YouTubeBlock key={`yt-${key++}`} videoId={videoId} />);
      index += 1;
      continue;
    }

    // Headings.
    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const content = heading[2] ?? '';
      const classes =
        level === 1
          ? 'mt-5 text-lg font-bold text-[var(--sr-text)]'
          : level === 2
            ? 'mt-4 text-base font-bold text-[var(--sr-text)]'
            : 'mt-3 text-sm font-bold uppercase tracking-wide text-[var(--sr-text-dim)]';
      const Tag = level === 1 ? 'h4' : level === 2 ? 'h5' : 'h6';
      blocks.push(
        <Tag key={`h-${key++}`} className={classes}>
          {renderInline(content, `h-${key}`)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    // Lists.
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test((lines[index] ?? '').trim())) {
        items.push((lines[index] ?? '').trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="my-2 list-disc space-y-1 pl-5 text-sm leading-6">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `li-${key}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph: consume until a blank line or another block type.
    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index] ?? '';
      const nextTrimmed = next.trim();
      if (
        !nextTrimmed ||
        /^(#{1,3})\s+/.test(nextTrimmed) ||
        /^[-*]\s+/.test(nextTrimmed) ||
        /^!\[([^\]]*)\]\(([^)\s]+)\)$/.test(nextTrimmed) ||
        isImageUrl(nextTrimmed)
      ) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    blocks.push(
      <p key={`p-${key++}`} className="my-2 whitespace-pre-line text-sm leading-6 text-[var(--sr-text-dim)]">
        {renderInline(paragraph.join('\n'), `p-${key}`)}
      </p>,
    );
  }

  return <div className={`sr-formatted-text ${className}`.trim()}>{blocks}</div>;
}
