// Research essays: one Markdown file per essay in src/content/research/<slug>.md.
// The file name is the slug and the URL: /research/<slug>/.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const research = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string().min(1).max(70),
    description: z.string().min(1).max(155),
    summary: z.string().min(1),
    abstract: z
      .string()
      .refine((s) => words(s) >= 90 && words(s) <= 160, { message: 'abstract must be 90–160 words' }),
    date: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, { message: "date must be 'YYYY' or 'YYYY-MM'" }),
    context: z.string().min(1),
    group: z.enum(['agents', 'academic']),
    order: z.number(),
    repo: z.string().url(),
    links: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })).default([]),
  }),
});

export const collections = { research };
