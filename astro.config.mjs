import { defineConfig } from "astro/config";

// A project site is served under the repository name, not the domain root.
export default defineConfig({
  site: "https://nuvious.github.io",
  base: "/linkpage",
  output: "static",
});
