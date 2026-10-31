interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, src, className = 'h-9 w-9' }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      role="img"
      aria-label={`${name || 'Runner'} profile picture`}
      className={`relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--sr-border)] bg-[var(--sr-surface-3)] font-semibold text-[var(--sr-primary)] ${className}`}
    >
      <span aria-hidden="true">{initial}</span>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => event.currentTarget.remove()}
        />
      )}
    </span>
  );
}

