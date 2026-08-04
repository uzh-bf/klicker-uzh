import { prisma } from '@klicker-uzh/prisma'

import {
  CHATBOT_EXPORT_USAGE,
  CliHelpError,
  parseExportChatbotArgs,
} from '../chatbotCli.js'
import { exportChatbotData } from '../chatbotExport.js'
import { CliUsageError } from '../cli.js'
import '../prismaTypes.js'
import { createReadonlyClient } from '../readonlyPrisma.js'

const readonlyPrisma = createReadonlyClient(prisma)

try {
  const { chatbotIds, outputDir } = parseExportChatbotArgs(
    process.argv.slice(2)
  )
  const result = await exportChatbotData(readonlyPrisma, chatbotIds, outputDir)

  console.log(`Export complete: ${result.outputPath}`)
  console.log(
    `Exported ${result.counts.chatbots} chatbot(s), ${result.counts.threads} thread(s), ` +
      `${result.counts.messages} message(s), and ${result.counts.attachments} attachment description(s).`
  )
} catch (error) {
  if (error instanceof CliHelpError) {
    console.log(error.message)
  } else if (error instanceof CliUsageError) {
    console.error(error.message)
    console.error(CHATBOT_EXPORT_USAGE)
    process.exitCode = 1
  } else {
    throw error
  }
} finally {
  await prisma.$disconnect()
}
