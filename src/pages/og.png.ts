// The English Open Graph image; the design is in src/lib/og.ts.
import type { APIRoute } from 'astro';
import { ogImage } from '../lib/og';

export const prerender = true;
export const GET: APIRoute = () => ogImage('en');
