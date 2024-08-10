import fs from 'fs'

for (const file of fs.readdirSync('../packages/prisma/src/prisma/schema/')) {
  if (file.endsWith('.prisma') && file !== 'js.prisma') {
    fs.copyFileSync(
      `../packages/prisma/src/prisma/schema/${file}`,
      `../apps/analytics/prisma/schema/${file}`
    )
  }
}
