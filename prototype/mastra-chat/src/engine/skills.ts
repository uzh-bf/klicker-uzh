// S2 — DB-backed Mastra SkillSource + lecturer authoring.
// Implements Mastra's filesystem-like SkillSource over `mastra_proto.skill_file`,
// so lecturer-authored, versioned skill packages live in our DB instead of on
// disk. At model-time the agent's skill-search processor reads each SKILL.md
// frontmatter (name/description) for progressive disclosure, then loads the full
// body only for the skill it selects.
import type { SkillSource, SkillSourceStat, SkillSourceEntry } from '@mastra/core/workspace'
import { pool } from '../pool.js'

// One authored skill = a set of files under `/<skill-name>/...`. We keep it to a
// single SKILL.md per skill for the prototype (the unit the search processor reads).
export class DbSkillSource implements SkillSource {
  async exists(path: string): Promise<boolean> {
    const p = norm(path)
    if (p === '/') return true
    const { rows } = await pool.query(
      `SELECT 1 FROM mastra_proto.skill_file WHERE path = $1
       UNION SELECT 1 FROM mastra_proto.skill_file WHERE path LIKE $2 LIMIT 1`,
      [p, `${p === '/' ? '' : p}/%`]
    )
    return rows.length > 0
  }

  async stat(path: string): Promise<SkillSourceStat> {
    const p = norm(path)
    const { rows } = await pool.query(
      `SELECT content, updated_at FROM mastra_proto.skill_file WHERE path = $1`,
      [p]
    )
    if (rows[0]) {
      return {
        name: base(p),
        type: 'file',
        size: Buffer.byteLength(rows[0].content),
        createdAt: rows[0].updated_at,
        modifiedAt: rows[0].updated_at,
        mimeType: 'text/markdown',
      }
    }
    // Treat any path that is a prefix of existing files as a directory.
    return {
      name: base(p),
      type: 'directory',
      size: 0,
      createdAt: new Date(0),
      modifiedAt: new Date(0),
    }
  }

  async readFile(path: string): Promise<string> {
    const { rows } = await pool.query(
      `SELECT content FROM mastra_proto.skill_file WHERE path = $1`,
      [norm(path)]
    )
    if (!rows[0]) throw new Error(`skill file not found: ${path}`)
    return rows[0].content as string
  }

  async readdir(path: string): Promise<SkillSourceEntry[]> {
    const p = norm(path)
    const prefix = p === '/' ? '/' : `${p}/`
    const { rows } = await pool.query(
      `SELECT path FROM mastra_proto.skill_file WHERE path LIKE $1`,
      [`${prefix}%`]
    )
    // Collapse to the immediate child segment (file or directory) under `path`.
    const children = new Map<string, 'file' | 'directory'>()
    for (const r of rows) {
      const rest = (r.path as string).slice(prefix.length)
      const seg = rest.split('/')[0]
      const isDir = rest.includes('/')
      children.set(seg, isDir ? 'directory' : 'file')
    }
    return [...children].map(([name, type]) => ({ name, type }))
  }

  async realpath(path: string): Promise<string> {
    return norm(path)
  }
}

function norm(path: string): string {
  if (!path || path === '.') return '/'
  const p = path.startsWith('/') ? path : `/${path}`
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}
function base(path: string): string {
  const parts = norm(path).split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

// --- authoring helpers (lecturer side) -------------------------------------
export async function upsertSkillFile(skillName: string, path: string, content: string): Promise<void> {
  await pool.query(
    `INSERT INTO mastra_proto.skill_file (skill_name, path, content, version, updated_at)
     VALUES ($1, $2, $3, 1, now())
     ON CONFLICT (path) DO UPDATE
       SET content = EXCLUDED.content, version = mastra_proto.skill_file.version + 1, updated_at = now()`,
    [skillName, path, content]
  )
}

// Parse the `name`/`description` frontmatter the skill-search processor surfaces.
export function parseSkillFrontmatter(md: string): { name?: string; description?: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out: { name?: string; description?: string } = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(name|description):\s*(.+)$/)
    if (kv) out[kv[1] as 'name' | 'description'] = kv[2].trim()
  }
  return out
}
