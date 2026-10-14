// /llms.txt: a plain-text version of the page for AI assistants, built from the same content
// so it can never drift from what visitors see.
import type { APIRoute } from 'astro';
import { profile, sections } from '../data/content';

export const GET: APIRoute = () => {
  const out: string[] = [`# ${profile.name}`, '', `> ${profile.summary}`, ''];
  for (const s of sections) {
    out.push(`## ${s.label}`, '');
    for (const a of s.about ?? []) out.push(a.text, '');
    for (const e of s.entries) {
      out.push(`### ${e.title}${e.date ? ` (${e.date})` : ''}`);
      for (const line of [e.meta, e.lead, e.text]) if (line) out.push(line);
      for (const p of e.points ?? []) out.push(`- ${p}`);
      if (e.paper) out.push(`Paper: ${e.paper}`);
      if (e.href) out.push(`Code: ${e.href}`);
      out.push('');
    }
    if (s.note) out.push(s.note, '');
  }
  out.push('## Links', '', ...profile.links.map((l) => `- ${l.label}: ${l.href}`), '');
  return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
