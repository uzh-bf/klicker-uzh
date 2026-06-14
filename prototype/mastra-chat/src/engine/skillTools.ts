// S2 (model-time) — skill discovery + activation tools over the DB-backed source.
// Mastra's native createSkillTools needs a WorkspaceSkills, and WorkspaceSkillsImpl
// is NOT exported in 1.41 — so a DB-backed (non-filesystem) source can't use the
// native wiring directly. These two thin tools reproduce the same progressive-
// disclosure contract (skill_search = cheap catalog of name/description; skill =
// load full body on demand) over DbSkillSource, proving the agent can discover and
// apply a lecturer-authored skill at runtime.
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { DbSkillSource, parseSkillFrontmatter } from './skills.js'

const source = new DbSkillSource()

export function buildSkillTools() {
  const skill_search = createTool({
    id: 'skill_search',
    description:
      'List the available course skills (name + description only) to decide whether one ' +
      'applies to the current request. Call this first before answering a how-to/coaching request.',
    inputSchema: z.object({ query: z.string().optional() }),
    execute: async () => {
      const dirs = (await source.readdir('/')).filter((e) => e.type === 'directory')
      const catalog = []
      for (const d of dirs) {
        const md = await source.readFile(`/${d.name}/SKILL.md`)
        catalog.push({ skillName: d.name, ...parseSkillFrontmatter(md) })
      }
      return { skills: catalog }
    },
  })

  const skill = createTool({
    id: 'skill',
    description:
      'Load the full instructions of a named course skill and apply them to your answer. ' +
      'Call after skill_search identifies a relevant skill.',
    inputSchema: z.object({ skillName: z.string() }),
    execute: async (input: { skillName: string }) => {
      const md = await source.readFile(`/${input.skillName}/SKILL.md`)
      return { skillName: input.skillName, instructions: md }
    },
  })

  return { skill_search, skill }
}
