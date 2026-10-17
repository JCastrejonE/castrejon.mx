// The Spanish Open Graph image, with the lines from site.es.ts; the design is in src/lib/og.ts.
import type { APIRoute } from 'astro';
import { ogImage } from '../../lib/og';

export const prerender = true;
export const GET: APIRoute = () => ogImage('es');
