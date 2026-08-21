/** Prefix a public path with the Vite base (needed on GitHub Pages). */
export function asset(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const rel = path.replace(/^\//, "");
  return base.endsWith("/") ? `${base}${rel}` : `${base}/${rel}`;
}
