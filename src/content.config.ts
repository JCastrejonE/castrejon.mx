// Research essays: one Markdown file per essay in src/content/research/<slug>.md, published at /research/<slug>/.
// Spanish translations: src/content/research-es/<slug>.md (same slug), published at /es/research/<slug>/.
// Both use the same frontmatter keys; Spanish runs longer, so its length limits are a little looser.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const essay = (limits: { title: number; description: number; abstract: [number, number] }) =>
  z.object({
    title: z.string().min(1).max(limits.title),
    description: z.string().min(1).max(limits.description),
    summary: z.string().min(1),
    abstract: z.string().refine((s) => words(s) >= limits.abstract[0] && words(s) <= limits.abstract[1], {
      message: `abstract must be ${limits.abstract[0]}–${limits.abstract[1]} words`,
    }),
    date: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, { message: "date must be 'YYYY' or 'YYYY-MM'" }),
    context: z.string().min(1),
    group: z.enum(['agents', 'academic']),
    order: z.number(),
    repo: z.string().url(),
    links: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })).default([]),
  });

const research = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/research' }),
  schema: essay({ title: 70, description: 155, abstract: [90, 160] }),
});

const researchEs = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/research-es' }),
  schema: essay({ title: 80, description: 160, abstract: [90, 200] }),
});

export const collections = { research, researchEs };
