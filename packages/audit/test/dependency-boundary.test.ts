import { glob, readFile } from 'node:fs/promises'

describe('provider-neutral contract boundary', () => {
  it('imports neither Azure nor Hatchet SDK modules', async () => {
    const sourceRoot = new URL('../src/', import.meta.url)
    const files: string[] = []
    for (const boundary of ['canonical', 'contract', 'outbox', 'ports']) {
      for await (const file of glob(`${boundary}/**/*.ts`, {
        cwd: sourceRoot,
      })) {
        files.push(file)
      }
    }

    for (const file of files) {
      const source = await readFile(new URL(file, sourceRoot), 'utf8')
      expect(source).not.toMatch(/from\s+['"]@azure\//)
      expect(source).not.toMatch(/from\s+['"][^'"]*hatchet/i)
    }
  })
})
