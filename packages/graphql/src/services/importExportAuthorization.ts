import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import { ImportExportErrorCode } from '../lib/importExportErrors.js'
import { getImportExportRuntimeConfig } from '../lib/importExportRuntimeConfig.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'

export const IMPORT_EXPORT_DISABLED_ERROR_CODE = ImportExportErrorCode.DISABLED

type ImportExportAuthorizationContext = Pick<ContextWithUser, 'prisma' | 'user'>

function hasImportExportLoginScope(scope: DB.UserLoginScope) {
  return (
    scope === DB.UserLoginScope.ACCOUNT_OWNER ||
    scope === DB.UserLoginScope.FULL_ACCESS
  )
}

export async function canUseElementImportExport(
  ctx: ImportExportAuthorizationContext | PrismaTransactionContextWithUser
) {
  const config = getImportExportRuntimeConfig()
  if (!config.enabled) return false
  if (
    ctx.user.role !== DB.UserRole.USER &&
    ctx.user.role !== DB.UserRole.ADMIN
  ) {
    return false
  }
  if (!hasImportExportLoginScope(ctx.user.scope)) return false
  if (!config.privatePreviewOnly) return true

  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    select: { privatePreview: true },
  })

  return user?.privatePreview === true
}

export async function getElementImportExportCapability(ctx: ContextWithUser) {
  try {
    return await canUseElementImportExport(ctx)
  } catch {
    // This capability is loaded with the global user profile. Fail closed
    // without letting a feature-specific lookup break or disclose details in
    // the surrounding application shell.
    emitImportExportTelemetry({
      operation: 'capability',
      outcome: 'failure',
      code: 'CAPABILITY_LOOKUP_FAILED',
    })
    return false
  }
}

export async function assertCanUseElementImportExport(
  ctx: ImportExportAuthorizationContext
) {
  if (await canUseElementImportExport(ctx)) return

  throw new GraphQLError('Import/export is not available.', {
    extensions: { code: IMPORT_EXPORT_DISABLED_ERROR_CODE },
  })
}
