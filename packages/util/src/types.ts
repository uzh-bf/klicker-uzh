import * as DB from '@klicker-uzh/prisma/dist/client.js'

// ! do not modify - required for the import of objects not assigned to any catalogue
// ! NEEDS TO BE CONSISTENT WITH SAME ID IN SHARING SERVICE
export const MISSING_CATALOG_COLLECTION_ID =
  'fde06b3c-d515-4907-99cf-c2ba67583155'

export type PrismaTransactionClient = Omit<
  DB.PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>
