function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

export function resolveActiveNavHref(pathname: string, hrefs: string[]) {
  const normalizedPathname = normalizePath(pathname);

  return hrefs
    .map(normalizePath)
    .filter((href) => normalizedPathname === href || normalizedPathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
