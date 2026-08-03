import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { schema } from '../src/index.js'
import type { Context } from '../src/lib/context.js'

describe('competence tree GraphQL authorization', () => {
  it('rejects competence-tree mutations for read-only user logins', async () => {
    const resolver = schema.getMutationType()!.getFields().deleteCompetenceTree!
      .resolve!
    const context = {
      user: {
        sub: '00000000-0000-0000-0000-000000000001',
        role: UserRole.USER,
        scope: UserLoginScope.READ_ONLY,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    } as Context

    await expect(
      resolver({}, { id: '00000000-0000-0000-0000-000000000000' }, context, {
        fieldName: 'deleteCompetenceTree',
      } as never)
    ).rejects.toMatchObject({ message: 'Unauthorized' })
  })
})
