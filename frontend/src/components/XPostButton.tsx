import { usePosts } from '../hooks/usePosts';
import { cn } from '../lib/utils';

type XPostButtonProps = {
  signalId?: string;
  intelId?: string;
  className?: string;
};

export function XPostButton({ signalId, intelId, className }: XPostButtonProps) {
  const posts = usePosts({
    signalId,
    intelId,
    enabled: Boolean(signalId || intelId),
    refreshIntervalMs: 30_000,
  });
  const publishedUrl = posts.posts.find((post) => post.publishedUrl)?.publishedUrl;

  if (!publishedUrl) {
    return null;
  }

  return (
    <a
      href={publishedUrl}
      target="_blank"
      rel="noreferrer"
      title="Open X post"
      aria-label="Open X post"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-700 bg-black/80 text-gray-300 shadow-lg shadow-black/20 backdrop-blur transition-colors hover:border-cyan-500/50 hover:bg-cyan-950/40 hover:text-cyan-200',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
      </svg>
    </a>
  );
}
