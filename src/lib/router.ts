// Path-based links (previously hash-based). Plain <a href> links are
// intercepted in the root layout and handled by TanStack Router.
let pushFn: ((to: string) => void) | null = null;

export function registerNavigator(fn: (to: string) => void) {
  pushFn = fn;
}

export function linkHref(to: string): string {
  const path = to.replace(/^#/, '');
  return path.startsWith('/') ? path : `/${path}`;
}

export function goTo(to: string) {
  const href = linkHref(to);
  if (pushFn) pushFn(href);
  else window.location.assign(href);
  window.scrollTo({ top: 0 });
}
