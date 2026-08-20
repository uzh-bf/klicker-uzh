export type TokenData = {
  email: string
  sub: string
  given_name?: string
  family_name?: string
  role: 'ADMIN' | 'USER' | 'PARTICIPANT'
  scope: 'ACCOUNT_OWNER' | 'EDUID'
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
}
