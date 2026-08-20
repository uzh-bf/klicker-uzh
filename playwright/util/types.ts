export type TokenData = {
  email: string
  sub: string
  role: 'ADMIN' | 'USER' | 'PARTICIPANT'
  scope: 'ACCOUNT_OWNER' | 'EDUID'
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
}
