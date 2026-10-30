import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const chat = createRequire(path.join(root, 'apps/chat/package.json'))
const prisma = createRequire(path.join(root, 'packages/prisma/package.json'))
const graphql = createRequire(path.join(root, 'packages/graphql/package.json'))
const typescript = prisma('typescript')
const { nodeFileTrace, resolve } = chat('next/dist/compiled/@vercel/nft')

function javascript(source, filename) {
  if (!filename.endsWith('.ts')) return source
  if (filename.endsWith('.d.ts')) return ''
  const text = typescript.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: typescript.ScriptTarget.ES2022,
      module: typescript.ModuleKind.ESNext,
      verbatimModuleSyntax: true,
      rewriteRelativeImportExtensions: true,
    },
  }).outputText
  return filename.endsWith('/packages/prisma/scripts/disposable-prisma.ts')
    ? text.replace("'../prisma.config.ts'", "'../prisma.config.js'")
    : text
}

export async function prepareFixtures(output) {
  assert.ok(path.isAbsolute(output), 'Expected an absolute output path')
  await fs.mkdir(output)
  const cli = prisma.resolve('prisma/build/index.js')
  const dynamic = {
    '@azure/storage-blob': graphql.resolve('@azure/storage-blob'),
  }
  const entries = [
    'deploy/preview/configure-fixtures.mjs',
    'packages/prisma/scripts/previewBootstrap.ts',
    'packages/prisma/scripts/disposable-prisma.ts',
    'packages/prisma/prisma.config.ts',
    'packages/prisma-data/src/data/seedTEST.ts',
    'packages/prisma-data/src/data/seedAssessmentCourse.ts',
    'apps/chat/scripts/local-mcp-server.mjs',
    cli,
    chat.resolve('@klicker-uzh/prisma'),
    chat.resolve('@klicker-uzh/util'),
    dynamic['@azure/storage-blob'],
  ].map((entry) => path.resolve(root, entry))
  const trace = await nodeFileTrace(entries, {
    base: root,
    processCwd: root,
    readFile: async (filename) => {
      try {
        const source = await fs.readFile(filename, 'utf8')
        return /\.[cm]?[jt]s$/.test(filename)
          ? javascript(source, filename)
          : source
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') return null
        throw error
      }
    },
    resolve: (id, parent, job, isCjs) =>
      id in dynamic && parent.endsWith('/deploy/preview/configure-fixtures.mjs')
        ? dynamic[id]
        : resolve(id, parent, job, isCjs),
  })
  // Prisma supports SQLite runtimes and ships non-JavaScript assets that the
  // tracer also attempts to parse. Neither is executed by PostgreSQL deploy.
  const rejectedWarnings = []
  for (const warning of trace.warnings) {
    const optionalSqlite =
      /^Failed to resolve dependency "(?:better-sqlite3|bun:sqlite|jsr:@db\/sqlite@0\.13\.0)":/.test(
        warning.message
      ) &&
      /\/node_modules\/(?:prisma\/build\/index\.js|@prisma\/streams-local\/dist\/touch\/interpreter_worker\.js)/.test(
        warning.message
      )
    const asset =
      /^Failed to parse .+\/node_modules\/(?:prisma\/build\/xdg-open|@prisma\/dev\/dist\/runtime-assets\/[^\n]+\.(?:wasm|tar\.gz|data)) as (?:script|module):/.test(
        warning.message
      )
    const optionalPgNative =
      warning.message.startsWith('Failed to resolve dependency "pg-native":') &&
      /\/node_modules\/(?:pg\/lib\/native\/|@prisma\/query-plan-executor\/dist\/index\.js)/.test(
        warning.message
      )
    const optionalPlatform =
      (warning.message.startsWith(
        'Failed to resolve dependency "cloudflare:sockets":'
      ) &&
        warning.message.includes(
          '/node_modules/pg-cloudflare/dist/index.js'
        )) ||
      (warning.message.startsWith(
        'Failed to resolve dependency "cloudflare:workers":'
      ) &&
        warning.message.includes('/node_modules/hono/dist/utils/color.js')) ||
      (warning.message.startsWith('Failed to resolve dependency "cardinal":') &&
        warning.message.includes('/node_modules/mysql2/lib/helpers.js'))
    const moduleSyntax =
      /^Failed to parse .+\/node_modules\/(?:std-env\/dist\/index\.mjs|@electric-sql\/pglite-tools\/dist\/chunk-[A-Za-z0-9]+\.js) as script:\nCannot use 'import.meta' outside a module/.test(
        warning.message
      )
    if (
      !optionalSqlite &&
      !asset &&
      !optionalPgNative &&
      !optionalPlatform &&
      !moduleSyntax
    )
      rejectedWarnings.push(warning.message)
  }
  assert.equal(rejectedWarnings.length, 0, rejectedWarnings.join('\n'))
  const files = trace.fileList
  for (const relative of [
    'apps/chat/package.json',
    'packages/graphql/package.json',
    'packages/prisma/package.json',
    'packages/prisma-data/package.json',
    'apps/chat/node_modules/@klicker-uzh/prisma',
    'apps/chat/node_modules/@klicker-uzh/util',
    'packages/graphql/node_modules/@azure/storage-blob',
    'packages/prisma/node_modules/prisma',
    'deploy/preview/mcp-fixture.json',
    'deploy/preview/mcp-documents.json',
    'deploy/preview/bootstrap.mjs',
    'deploy/preview/runtime.mjs',
  ])
    files.add(relative)
  async function includeTree(directory) {
    for (const item of await fs.readdir(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const relative = path.join(directory, item.name)
      if (item.isDirectory()) await includeTree(relative)
      else files.add(relative)
    }
  }
  await includeTree('packages/prisma/src/prisma/schema')
  await includeTree('packages/transactional/out')
  files.add('packages/prisma-data/src/data/data/FC_Modul_1.xml')
  const engines = path.dirname(
    createRequire(cli).resolve('@prisma/engines/package.json')
  )
  await includeTree(path.relative(root, engines))
  for (const relative of files) {
    assert.ok(!path.isAbsolute(relative) && !relative.startsWith('../'))
    assert.ok(
      !relative
        .split(path.sep)
        .some((part) => part === '_local' || part.startsWith('.env')),
      'Local data and environment files cannot enter the helper image'
    )
    const source = path.join(root, relative)
    const target = path.join(output, relative.replace(/\.ts$/, '.js'))
    await fs.mkdir(path.dirname(target), { recursive: true })
    const stat = await fs.lstat(source)
    if (stat.isSymbolicLink()) {
      const link = await fs.readlink(source)
      const destination = path.resolve(path.dirname(source), link)
      assert.ok(
        destination.startsWith(root + path.sep),
        'Dependency link escapes the build tree'
      )
      await fs.symlink(path.relative(path.dirname(source), destination), target)
    } else if (/\.[cm]?[jt]s$/.test(relative)) {
      await fs.writeFile(
        target,
        javascript(await fs.readFile(source, 'utf8'), source),
        {
          mode: stat.mode,
        }
      )
    } else await fs.copyFile(source, target)
  }
  return { files: files.size, allowedTraceWarnings: trace.warnings.size }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  assert.equal(process.argv.length, 3, 'Expected one new output directory')
  try {
    console.log(JSON.stringify(await prepareFixtures(process.argv[2])))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
