import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://divyansh070.github.io',
  integrations: [mdx()],
});
