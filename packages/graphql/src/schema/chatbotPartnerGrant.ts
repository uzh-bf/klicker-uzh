import builder from '../builder.js'

// Owner-visible projection of a partner service grant. The grant authorizes
// server-to-server Doc Query scope issuance for one chatbot; it never grants
// participant chat access and the partner never sees participant data.
export type PartnerChatbotGrantShape = {
  partnerId: string
  grantedAt: Date
  revokedAt: Date | null
  lastUsedAt: Date | null
}

const PartnerChatbotGrantRef = builder.objectRef<PartnerChatbotGrantShape>(
  'PartnerChatbotGrant'
)

export const PartnerChatbotGrant = PartnerChatbotGrantRef.implement({
  fields: (t) => ({
    partnerId: t.exposeString('partnerId'),
    grantedAt: t.expose('grantedAt', { type: 'Date' }),
    revokedAt: t.expose('revokedAt', { type: 'Date', nullable: true }),
    lastUsedAt: t.expose('lastUsedAt', { type: 'Date', nullable: true }),
  }),
})
