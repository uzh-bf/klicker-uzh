import { cp, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const source = new URL('../dist/', import.meta.url)
const destination = new URL('../../docs/static/office-addin/', import.meta.url)

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? collectFiles(entryPath) : entryPath
    })
  )

  return files.flat()
}

async function listFiles(root) {
  const files = await collectFiles(root)
  return files.map((file) => path.relative(root, file)).sort()
}

async function verify() {
  const sourcePath = fileURLToPath(source)
  const destinationPath = fileURLToPath(destination)
  const sourceFiles = await listFiles(sourcePath)
  const destinationFiles = await listFiles(destinationPath)

  if (sourceFiles.join('\n') !== destinationFiles.join('\n')) {
    const sourceOnly = sourceFiles.filter(
      (file) => !destinationFiles.includes(file)
    )
    const destinationOnly = destinationFiles.filter(
      (file) => !sourceFiles.includes(file)
    )
    throw new Error(
      `The deployed Office Add-in file list differs from dist/. Missing: ${sourceOnly.join(', ') || 'none'}. Extra: ${destinationOnly.join(', ') || 'none'}.`
    )
  }

  for (const file of sourceFiles) {
    const [sourceContents, destinationContents] = await Promise.all([
      readFile(path.join(sourcePath, file)),
      readFile(path.join(destinationPath, file)),
    ])

    if (!sourceContents.equals(destinationContents)) {
      throw new Error(`The deployed Office Add-in differs at ${file}.`)
    }
  }

  console.log(`Verified ${sourceFiles.length} deployed Office Add-in files.`)
}

if (process.argv.includes('--check')) {
  await verify()
} else {
  await rm(destination, { recursive: true, force: true })
  await cp(source, destination, { recursive: true })
  await verify()
}
