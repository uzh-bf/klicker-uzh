import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

const source = readFileSync(namespacePath, 'utf8')
let patched = source

for (const [generated, replacement] of replacements) {
  if (patched.includes(replacement)) {
    continue
  }

  if (!patched.includes(generated)) {
    throw new Error(`Expected Prisma generated code not found: ${generated}`)
  }

  patched = patched.replace(generated, replacement)
}

if (patched !== source) {
  writeFileSync(namespacePath, patched)
}
