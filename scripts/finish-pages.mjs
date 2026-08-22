import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "dist/client");
let html = readFileSync(join(dir, "_shell.html"), "utf8");

const styles = readdirSync(join(dir, "assets")).find((f) =>
  /^styles-.*\.css$/.test(f),
);
if (styles) {
  html = html.replace(/assets\/styles-[^"']+\.css/g, `assets/${styles}`);
}

writeFileSync(join(dir, "index.html"), html);
writeFileSync(join(dir, "404.html"), html);
mkdirSync(join(dir, "display"), { recursive: true });
writeFileSync(join(dir, "display/index.html"), html);
writeFileSync(join(dir, ".nojekyll"), "");

const manifest = join(dir, "__grok/manifest.webmanifest");
if (!existsSync(manifest)) {
  writeFileSync(
    manifest,
    JSON.stringify({
      name: "SW-OpenC64",
      short_name: "OpenC64",
      start_url: "/SW-OpenC64/",
      display: "standalone",
      background_color: "#0C1018",
      theme_color: "#0C1018",
    }),
  );
}

console.log("pages: wrote index.html, display/index.html, 404.html, .nojekyll");
