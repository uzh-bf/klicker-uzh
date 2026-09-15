import { prisma } from '@klicker-uzh/prisma'
import type { UserRole } from '@klicker-uzh/prisma/client'
import type { CollectedInvitationEmails } from '@klicker-uzh/util'
import {
  collectInvitationEmails,
  extractProviderFromAffiliationId,
  generateRandomString,
  InvitationEmailMode,
  type PrismaTransactionClient,
  parseCsvHosts,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type { Account, Profile } from 'next-auth'
import { sendTeamsNotifications } from '@/lib/util'
import { updateAssessmentParticipantIdentity } from './assessmentIdentity'
import { DEFAULT_LECTURER_HOSTS, DEFAULT_STUDENT_HOSTS } from './constants'

export interface ExtendedProfile extends Profile {
  swissEduPersonUniqueID: string
  given_name?: string
  family_name?: string
  swissEduPersonMatriculationNumber?: string
  swissEduIDLinkedAffiliation?: string[]
  swissEduIDLinkedAffiliationMail?: string[]
  swissEduIDLinkedAffiliationUniqueID?: string[]
}

export interface ExtendedAccount extends Account {
  affiliationIds?: string[]
}

export interface ExtendedUser {
  id: string
  email: string
  role: UserRole
  shortname: string
  scope: string
  catalystInstitutional: boolean
  catalystIndividual: boolean
}

export function getStudentHosts(): string[] {
  const env = parseCsvHosts(process.env.AUTH_STUDENT_ALLOWED_HOSTS)
  return env.length ? env : DEFAULT_STUDENT_HOSTS
}

export function getLecturerHosts(): string[] {
  const env = parseCsvHosts(process.env.AUTH_LECTURER_ALLOWED_HOSTS)
  return env.length ? env : DEFAULT_LECTURER_HOSTS
}

export async function autoAcceptInvitations(
  tx: PrismaTransactionClient,
  emailCollection: CollectedInvitationEmails,
  participantId?: string,
  invitationEmailMode: InvitationEmailMode = InvitationEmailMode.AffiliationsOnly
) {
  let matchingParticipantId: string | undefined = participantId

  const normalizedLookupEmails = Array.from(
    new Set(
      emailCollection.allEmails.map((email) => email.toLowerCase().trim())
    )
  )

  const normalizedInvitationEmails = Array.from(
    new Set(
      (invitationEmailMode === InvitationEmailMode.AffiliationsOnly
        ? emailCollection.affiliationEmails
        : emailCollection.allEmails
      ).map((email) => email.toLowerCase())
    )
  )

  try {
    if (!participantId) {
      if (normalizedLookupEmails.length === 0) {
        console.log('No emails provided for participant lookup')
        return 0
      }

      const participant = await tx.participant.findFirst({
        where: {
          email: {
            in: normalizedLookupEmails,
          },
        },
      })

      if (!participant) {
        console.log('No participant found for emails:', normalizedLookupEmails)
        return 0
      }

      matchingParticipantId = participant.id
    }

    if (normalizedInvitationEmails.length === 0) {
      console.log(
        `Invitation mode ${invitationEmailMode} provided no eligible emails.`,
        {
          profileEmails: emailCollection.profileEmails,
          affiliationEmails: emailCollection.affiliationEmails,
        }
      )
      return 0
    }

    // Find all pending invitations for any of the eligible emails
    const pendingInvitations = await tx.participantInvitation.findMany({
      where: {
        email: { in: normalizedInvitationEmails },
        status: 'PENDING',
      },
    })

    console.log(
      `Found ${pendingInvitations.length} pending invitations for mode ${invitationEmailMode}:`,
      normalizedInvitationEmails
    )

    let acceptedCount = 0
    for (const invitation of pendingInvitations) {
      try {
        // Create or activate participation
        await tx.participation.upsert({
          where: {
            courseId_participantId: {
              courseId: invitation.courseId,
              participantId: matchingParticipantId!,
            },
          },
          create: {
            courseId: invitation.courseId,
            participantId: matchingParticipantId!,
            isActive: false,
          },
          update: {},
        })

        // Mark invitation as accepted
        await tx.participantInvitation.update({
          where: { id: invitation.id },
          data: {
            status: 'ACCEPTED',
            participantId: matchingParticipantId,
            acceptedAt: new Date(),
          },
        })

        acceptedCount++
      } catch (error) {
        console.error(`Error accepting invitation ${invitation.id}:`, error)
      }
    }

    if (acceptedCount > 0) {
      await sendTeamsNotifications(
        'auth/invitationAutoAccept',
        `User with emails [${normalizedLookupEmails.join(', ')}] was automatically enrolled in ${acceptedCount} course(s) via invitations.`
      )
    }

    return acceptedCount
  } catch (error) {
    console.error('Error in autoAcceptInvitations:', error)
    return 0
  }
}

// Helper function to create user affiliations
export async function createUserAffiliations(
  userId: string,
  affiliationIds?: string[]
) {
  // if affiliations are present, add corresponding accounts for the user
  if (affiliationIds && affiliationIds.length > 0) {
    for (const affiliationId of affiliationIds) {
      try {
        const provider = extractProviderFromAffiliationId(affiliationId)
        if (!provider) continue

        // upsert accounts for every affiliation
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId: affiliationId,
            },
          },
          create: {
            provider,
            providerAccountId: affiliationId,
            user: { connect: { id: userId } },
            type: 'affiliation',
            isVerified: true, // SSO affiliations are auto-verified
            isPrimary: false, // New affiliations are never primary by default
          },
          update: {
            isVerified: true, // Update verification status for SSO
          },
        })
      } catch (error) {
        console.error(`Failed to add affiliation ${affiliationId}:`, error)
        // Continue with other affiliations
      }
    }
  }
}

// Helper function to create participant affiliations
async function createParticipantAffiliations(
  tx: PrismaTransactionClient,
  participantId: string,
  affiliationIds: string[],
  affiliationEmails?: string[] // Make emails optional
) {
  const processedAffiliations = new Set<string>()

  for (let i = 0; i < affiliationIds.length; i++) {
    const affiliationId = affiliationIds[i]
    const affiliationEmail = affiliationEmails?.[i]?.toLowerCase() || null

    if (!affiliationId) continue // Only skip if ID is missing

    try {
      const provider = extractProviderFromAffiliationId(affiliationId)
      if (!provider) continue

      // upsert participant accounts for every affiliation
      await tx.participantAccount.upsert({
        where: {
          participantId_ssoType: {
            participantId,
            ssoType: provider,
          },
        },
        create: {
          ssoType: provider,
          ssoId: affiliationId,
          ssoEmail: affiliationEmail, // Store email if available
          participant: { connect: { id: participantId } },
          type: 'affiliation',
          isVerified: true, // SSO affiliations are auto-verified
          isPrimary: false, // New affiliations are never primary by default
        },
        update: {
          ssoEmail: affiliationEmail, // Update email if changed (can be null)
          isVerified: true, // Update verification status for SSO
        },
      })

      processedAffiliations.add(affiliationId)
    } catch (error) {
      console.error(
        `Failed to add participant affiliation ${affiliationId}:`,
        error
      )
    }
  }
  return [...processedAffiliations]
}

// Enhanced participant authentication helper function
export async function createOrLinkParticipant(profile: ExtendedProfile) {
  const randomUsername = generateRandomString(10)

  const participant = await prisma.$transaction(async (tx) => {
    // Lookup existing account via ssoId (Edu-ID sub)
    const existing = await tx.participantAccount.findUnique({
      where: { ssoId: profile.sub },
      include: { participant: true },
    })

    if (existing) {
      // Update affiliations for existing participant
      if (profile.swissEduIDLinkedAffiliationUniqueID) {
        const participantAffiliations = await createParticipantAffiliations(
          tx,
          existing.participantId,
          profile.swissEduIDLinkedAffiliationUniqueID,
          profile.swissEduIDLinkedAffiliationMail // Pass undefined if not available
        )
      }

      // auto-accept invitations for existing users
      try {
        // Extract all relevant emails for invitation checking
        const emailCollection = collectInvitationEmails(
          profile.email,
          profile.swissEduIDLinkedAffiliationMail
        )

        const acceptedCount = await autoAcceptInvitations(
          tx,
          emailCollection,
          existing.participantId
        )
        console.log(
          `Auto-accepted ${acceptedCount} invitations for existing user with emails:`,
          emailCollection.allEmails
        )
      } catch (error) {
        console.error(
          'Error auto-accepting invitations for existing user:',
          error
        )
      }

      await updateAssessmentParticipantIdentity(
        tx,
        existing.participantId,
        profile
      )

      await tx.participant.update({
        where: { id: existing.participantId },
        data: { lastLoginAt: new Date(), email: profile.email?.toLowerCase() },
      })

      return existing.participant
    }

    // Check for existing participant by any affiliation (including primary email)
    let participant: any = null
    if (profile.email) {
      // Try to find by primary email first
      participant = await tx.participant.findUnique({
        where: {
          email_isSSOAccount: {
            email: profile.email.toLowerCase(),
            isSSOAccount: true,
          },
        },
      })

      // If not found by primary email, check affiliations
      if (!participant) {
        const affiliatedAccount = await tx.participantAccount.findFirst({
          where: {
            type: 'affiliation',
            ssoEmail: profile.email.toLowerCase(),
            isVerified: true,
          },
          include: { participant: true },
        })

        if (affiliatedAccount) {
          participant = affiliatedAccount.participant
        }
      }
    }

    // Create new participant if none exists
    if (!participant) {
      participant = await tx.participant.create({
        data: {
          username: randomUsername,
          email: profile.email?.toLowerCase(),
          password: await bcrypt.hash(
            crypto.randomBytes(32).toString('hex'),
            10
          ),
          isEmailValid: true, // Edu-ID emails are pre-validated
          isSSOAccount: true,
          lastLoginAt: new Date(),
        },
      })
    }

    // Create enhanced ParticipantAccount link
    await tx.participantAccount.create({
      data: {
        ssoType: 'EDUID',
        ssoId: profile.sub as string,
        ssoEmail: profile.email?.toLowerCase(), // Store primary email
        participant: { connect: { id: participant.id } },
        type: 'sso',
        isVerified: true, // SSO accounts are pre-verified
        isPrimary: true, // SSO accounts are not necessarily primary
      },
    })

    // Add affiliations for participant
    if (profile.swissEduIDLinkedAffiliationUniqueID) {
      await createParticipantAffiliations(
        tx,
        participant.id,
        profile.swissEduIDLinkedAffiliationUniqueID,
        profile.swissEduIDLinkedAffiliationMail
      )
    }

    // auto-accept invitations for newly created participants
    try {
      // Extract all relevant emails for invitation checking
      const emailCollection = collectInvitationEmails(
        profile.email,
        profile.swissEduIDLinkedAffiliationMail
      )

      const acceptedCount = await autoAcceptInvitations(
        tx,
        emailCollection,
        participant.id
      )
      console.log(
        `Auto-accepted ${acceptedCount} invitations for new participant with emails:`,
        emailCollection.allEmails
      )
    } catch (error) {
      console.error(
        'Error auto-accepting invitations for new participant:',
        error
      )
    }

    await updateAssessmentParticipantIdentity(tx, participant.id, profile)

    // Ensure the transaction returns the participant for the caller
    return participant
  })

  return participant
}
