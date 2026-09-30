// Builds a single self-contained HTML file of the app (no server, no install for viewers).
// React loads from cdnjs; everything else is inlined.  Usage: npm run preview:build
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "preview", "dist");
mkdirSync(out, { recursive: true });

const shims = {
  react: path.join(root, "preview/shims/react.js"),
  "react-dom/client": path.join(root, "preview/shims/react-dom-client.js"),
  "react/jsx-runtime": path.join(root, "preview/shims/jsx-runtime.js"),
};

const res = await build({
  entryPoints: [path.join(root, "preview/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  jsx: "automatic",
  write: false,
  alias: { "@": root },
  plugins: [
    {
      name: "react-globals",
      setup(b) {
        b.onResolve({ filter: /^(react|react-dom\/client|react\/jsx-runtime)$/ }, (a) => ({ path: shims[a.path] }));
      },
    },
  ],
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

execSync(`npx @tailwindcss/cli -i app/globals.css -o preview/dist/app.css --minify`, { cwd: root, stdio: "inherit" });
const css = readFileSync(path.join(out, "app.css"), "utf8");

const REACT = process.env.REACT_UMD
  ? `<script>${readFileSync(process.env.REACT_UMD, "utf8")}</script><script>${readFileSync(process.env.REACTDOM_UMD, "utf8")}</script>`
  : `<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>`;

const html = `<title>Ahead with Kate</title>
<style>${css}
:root{color-scheme:light}body{background:var(--color-page);color:var(--color-ink)}</style>
<div id="root"></div>
${REACT}
<script>window.__AHEAD_STATIC__=true;</script>
<script>${js}</script>
`;
const file = process.env.OUT || path.join(out, "ahead-preview.html");
writeFileSync(file, html);
console.log("wrote", file, (html.length / 1024).toFixed(0) + " KB");
