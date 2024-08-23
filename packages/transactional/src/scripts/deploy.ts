import { PrismaClient } from '@klicker-uzh/prisma'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function upsertEmailTemplates() {
  const outDir = path.join(__dirname, '../../out')
  const entries = await fs.readdir(outDir, { withFileTypes: true })

  const htmlFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith('.html')
  )

  for (const file of htmlFiles) {
    const filePath = path.join(outDir, file.name)
    const content = await fs.readFile(filePath, 'utf-8')

    await prisma.emailTemplate.upsert({
      where: { name: file.name },
      update: { html: content },
      create: { name: file.name, html: content },
    })
  }
}

async function main() {
  await prisma.$connect()
  try {
    await upsertEmailTemplates()
    console.log('Email templates upserted successfully')
  } catch (err) {
    console.error('Error upserting email templates:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
main()
