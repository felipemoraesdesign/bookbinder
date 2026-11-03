import { defineConfig } from 'vite';
import version from 'vite-plugin-package-version';
import injectHTML from 'vite-plugin-html-inject';

export default defineConfig({
  // this fork's GitHub Pages path; the upstream default made plain builds load the upstream site's assets
  base: process.env.BASE || '/bookbinder/',
  test: {
    environment: 'jsdom',
  },
  plugins: [version(), injectHTML()],
});
