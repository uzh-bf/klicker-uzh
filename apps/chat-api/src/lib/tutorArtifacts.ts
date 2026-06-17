import type { PrismaClient } from '@klicker-uzh/prisma/client'

type TutorArtifactContextOptions = {
  prisma: PrismaClient
  chatbotId: string
  courseId: string
  selectedMode: string
}

type LoadedTutorArtifactContext = {
  summary: string
  skillPackVersion?: string
  misconceptionLabels: string[]
}

function compactList(values: string[], max = 4) {
  const compacted = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  return compacted.slice(0, max).join('; ')
}

export async function loadTutorArtifactContext({
  prisma,
  chatbotId,
  courseId,
  selectedMode,
}: TutorArtifactContextOptions): Promise<LoadedTutorArtifactContext | null> {
  const [skillPack, components] = await Promise.all([
    prisma.tutorSkillPack.findFirst({
      where: {
        chatbotId,
        courseId,
        status: 'published',
        OR: [{ version: selectedMode }, { baseMode: selectedMode }],
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      select: { version: true, name: true },
    }),
    prisma.tutorKnowledgeComponent.findMany({
      where: { courseId },
      orderBy: { slug: 'asc' },
      take: 12,
      select: {
        slug: true,
        title: true,
        prerequisites: true,
        misconceptions: {
          where: { status: 'lecturer_validated' },
          orderBy: { label: 'asc' },
          take: 3,
          select: {
            label: true,
            symptoms: true,
            diagnosticQuestion: true,
            correctiveMove: true,
            hintLadders: {
              take: 1,
              select: { maxDepth: true, levels: true },
            },
          },
        },
      },
    }),
  ])

  if (!skillPack && components.length === 0) return null

  const lines = [
    skillPack
      ? `skill_pack: ${skillPack.version} (${skillPack.name})`
      : `skill_pack: ${selectedMode}`,
  ]
  const misconceptionLabels: string[] = []

  for (const component of components) {
    lines.push(
      `skill ${component.slug}: ${component.title}; prerequisites=${component.prerequisites.join(', ') || 'none'}`
    )

    for (const misconception of component.misconceptions) {
      misconceptionLabels.push(misconception.label)
      const patterns = Array.isArray(
        (misconception.symptoms as { patterns?: unknown })?.patterns
      )
        ? ((misconception.symptoms as { patterns: string[] }).patterns ?? [])
        : []
      const ladder = misconception.hintLadders[0]
      lines.push(
        [
          `- misconception ${misconception.label}`,
          patterns.length ? `symptoms=${compactList(patterns, 2)}` : null,
          misconception.diagnosticQuestion
            ? `diagnostic=${misconception.diagnosticQuestion}`
            : null,
          misconception.correctiveMove
            ? `move=${misconception.correctiveMove}`
            : null,
          ladder ? `max_hint_depth=${ladder.maxDepth}` : null,
        ]
          .filter(Boolean)
          .join('; ')
      )
    }
  }

  return {
    summary: lines.join('\n'),
    skillPackVersion: skillPack?.version,
    misconceptionLabels,
  }
}
