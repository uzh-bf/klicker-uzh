import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const namespacePath = join(
  scriptDir,
  '..',
  'src',
  'prisma',
  'client',
  'internal',
  'prismaNamespace.ts'
)

const replacements = [
  [
    'export const DbNull = runtime.objectEnumValues.instances.DbNull',
    'export const DbNull: runtime.ObjectEnumValue = runtime.objectEnumValues.instances.DbNull',
  ],
  [
    'export const JsonNull = runtime.objectEnumValues.instances.JsonNull',
    'export const JsonNull: runtime.ObjectEnumValue = runtime.objectEnumValues.instances.JsonNull',
  ],
  [
    'export const AnyNull = runtime.objectEnumValues.instances.AnyNull',
    'export const AnyNull: runtime.ObjectEnumValue = runtime.objectEnumValues.instances.AnyNull',
  ],
]

function countOccurrences(source, value) {
  return source.split(value).length - 1
}

export function patchPrismaNamespaceSource(source) {
  let patched = source

  for (const [generated, replacement] of replacements) {
    const generatedCount = countOccurrences(patched, generated)
    const replacementCount = countOccurrences(patched, replacement)

    if (generatedCount === 0 && replacementCount === 1) {
      continue
    }

    if (generatedCount !== 1 || replacementCount !== 0) {
      throw new Error(
        `Unexpected Prisma generated code cardinality for ${generated}: ` +
          `generated=${generatedCount}, patched=${replacementCount}`
      )
    }

    patched = patched.replace(generated, replacement)
  }

  return patched
}

function patchPrismaNamespaceFile() {
  const source = readFileSync(namespacePath, 'utf8')
  const patched = patchPrismaNamespaceSource(source)

  if (patched !== source) {
    writeFileSync(namespacePath, patched)
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  patchPrismaNamespaceFile()
}
