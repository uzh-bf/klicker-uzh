import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '../../dist/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function seedEmailTemplates(prisma: PrismaClient) {
  const outDir = path.join(__dirname, '../../../transactional/out')
  const entries = await fs.readdir(outDir, { withFileTypes: true })

  const htmlFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith('.html')
  )

  for (const file of htmlFiles) {
    const filePath = path.join(outDir, file.name)
    const content = await fs.readFile(filePath, 'utf-8')

    await prisma.emailTemplate.upsert({
      where: { name: file.name.replace('.html', '') },
      update: { html: content },
      create: { name: file.name.replace('.html', ''), html: content },
    })
  }
}

// const prisma = new PrismaClient()

// await seedEmailTemplates(prisma)
