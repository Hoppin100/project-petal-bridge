import logoAsset from '@/assets/splitrush-logo.png.asset.json';
import { linkHref } from '@/lib/router';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function Logo({ size = 'md', onClick }: LogoProps) {
  const text =
    size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-xl';
  const imageSize =
    size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';

  return (
    <a
      href={linkHref('/')}
      onClick={onClick}
      aria-label="SplitRush home"
      className="group flex items-center gap-2.5 font-bold tracking-tight"
    >
      <img src={logoAsset.url} alt="" aria-hidden="true" className={`${imageSize} flex-shrink-0 object-contain`} />
      <span className={`${text} font-extrabold uppercase text-[var(--sr-header-text)]`}>
        SplitRush
      </span>
    </a>
  );
}
