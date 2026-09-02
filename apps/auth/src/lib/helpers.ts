import { sendTeamsNotifications } from '@/lib/util'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { toSafeError } from '@klicker-uzh/logging/node'
import { prisma } from '@klicker-uzh/prisma'
import { UserRole } from '@klicker-uzh/prisma/client'
import type { CollectedInvitationEmails, JWTPayload } from '@klicker-uzh/util'
import {
  collectInvitationEmails,
  extractProviderFromAffiliationId,
  generateRandomString,
  InvitationEmailMode,
  PrismaTransactionClient,
  parseCookiesHeader,
  parseCsvHosts,
  signJWT,
  verifyJWT,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { NextApiRequest } from 'next'
import type { Profile } from 'next-auth'
import { Account } from 'next-auth'
import { DefaultJWT, JWTDecodeParams, JWTEncodeParams } from 'next-auth/jwt'
import { updateAssessmentParticipantIdentity } from './assessmentIdentity'
import {
  DEFAULT_LECTURER_HOSTS,
  DEFAULT_STUDENT_HOSTS,
  LECTURER_REDIRECT_COOKIE_NAME,
  STUDENT_REDIRECT_COOKIE_NAME,
} from './constants'

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

export async function decode({ token, secret }: JWTDecodeParams) {
  if (!token) return null
  const secretString = typeof secret === 'string' ? secret : secret.toString()
  return (await verifyJWT(token, secretString, {
    issuer: process.env.APP_ORIGIN_AUTH,
  })) as DefaultJWT
}

export async function encode({ token, secret }: JWTEncodeParams) {
  const secretString = typeof secret === 'string' ? secret : secret.toString()

  return signJWT((token as JWTPayload) ?? {}, secretString, {
    issuer: process.env.APP_ORIGIN_AUTH,
  })
}

// Context detection: prefer explicit URL params and paths; fall back to
// referer and an ephemeral redirect cookie set by the proxy on signin.

export function getStudentHosts(): string[] {
  const env = parseCsvHosts(process.env.AUTH_STUDENT_ALLOWED_HOSTS)
  return env.length ? env : DEFAULT_STUDENT_HOSTS
}

export function getLecturerHosts(): string[] {
  const env = parseCsvHosts(process.env.AUTH_LECTURER_ALLOWED_HOSTS)
  return env.length ? env : DEFAULT_LECTURER_HOSTS
}

function isAssessmentHost(host: string): boolean {
  return getStudentHosts().includes(host)
}

function isManageHost(host: string): boolean {
  return getLecturerHosts().includes(host)
}

export function getAuthContext(
  req: NextApiRequest,
  log: AppLogger
): 'lecturer' | 'participant' {
  const { participant, callbackUrl } = req.query as {
    participant?: string
    callbackUrl?: string
  }
  const cookies = parseCookiesHeader(req.headers.cookie)
  const studentRedirect = cookies[STUDENT_REDIRECT_COOKIE_NAME]
  const lecturerRedirect = cookies[LECTURER_REDIRECT_COOKIE_NAME]

  const hostFrom = (val?: string) => {
    if (!val) return null
    try {
      return new URL(val).host
    } catch {
      return null
    }
  }

  const hosts = {
    student: hostFrom(studentRedirect),
    lecturer: hostFrom(lecturerRedirect),
    callback: hostFrom(callbackUrl),
  }

  // 1) Explicit participant flag wins
  if (participant === 'true') {
    log.info(
      {
        event: 'auth.audience.selected',
        audience: 'participant',
        decisionSource: 'explicit_param',
      },
      'Selected authentication audience'
    )
    return 'participant'
  }

  // 2) callbackUrl host is authoritative when present
  if (hosts.callback) {
    if (isAssessmentHost(hosts.callback)) {
      log.info(
        {
          event: 'auth.audience.selected',
          audience: 'participant',
          decisionSource: 'callback_host',
        },
        'Selected authentication audience'
      )
      return 'participant'
    }
    if (isManageHost(hosts.callback)) {
      log.info(
        {
          event: 'auth.audience.selected',
          audience: 'lecturer',
          decisionSource: 'callback_host',
        },
        'Selected authentication audience'
      )
      return 'lecturer'
    }
  }

  // 3) Specific cookies (student first)
  if (hosts.student && isAssessmentHost(hosts.student)) {
    log.info(
      {
        event: 'auth.audience.selected',
        audience: 'participant',
        decisionSource: 'redirect_cookie',
      },
      'Selected authentication audience'
    )
    return 'participant'
  }
  if (hosts.lecturer && isManageHost(hosts.lecturer)) {
    log.info(
      {
        event: 'auth.audience.selected',
        audience: 'lecturer',
        decisionSource: 'redirect_cookie',
      },
      'Selected authentication audience'
    )
    return 'lecturer'
  }

  // 4) Default to lecturer
  log.info(
    {
      event: 'auth.audience.selected',
      audience: 'lecturer',
      decisionSource: 'default',
    },
    'Selected authentication audience'
  )
  return 'lecturer'
}

export async function autoAcceptInvitations(
  tx: PrismaTransactionClient,
  emailCollection: CollectedInvitationEmails,
  participantId?: string,
  invitationEmailMode: InvitationEmailMode = InvitationEmailMode.AffiliationsOnly,
  log?: AppLogger
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
        log?.info(
          { event: 'auth.invitation.lookup_skipped', outcome: 'no_emails' },
          'Skipped invitation lookup'
        )
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
        log?.info(
          { event: 'auth.invitation.lookup_completed', outcome: 'no_match' },
          'Completed invitation lookup'
        )
        return 0
      }

      matchingParticipantId = participant.id
    }

    if (normalizedInvitationEmails.length === 0) {
      log?.info(
        {
          event: 'auth.invitation.lookup_skipped',
          outcome: 'no_eligible_emails',
          invitationEmailMode,
        },
        'Skipped invitation lookup'
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

    log?.info(
      {
        event: 'auth.invitation.lookup_completed',
        outcome: 'success',
        invitationEmailMode,
        invitationCount: pendingInvitations.length,
      },
      'Completed invitation lookup'
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
      } catch {
        log?.warn(
          {
            event: 'auth.invitation.accept_failed',
            err: toSafeError('Failed to accept invitation'),
          },
          'Failed to accept invitation'
        )
      }
    }

    if (acceptedCount > 0) {
      await sendTeamsNotifications(
        'auth/invitationAutoAccept',
        `User with emails [${normalizedLookupEmails.join(', ')}] was automatically enrolled in ${acceptedCount} course(s) via invitations.`,
        log
      )
      log?.info(
        {
          event: 'auth.invitation.accepted',
          outcome: 'success',
          invitationCount: acceptedCount,
        },
        'Accepted invitations'
      )
    }

    return acceptedCount
  } catch {
    log?.warn(
      {
        event: 'auth.invitation.accept_failed',
        err: toSafeError('Invitation auto-accept failed'),
      },
      'Invitation auto-accept failed'
    )
    return 0
  }
}

// Helper function to create user affiliations
export async function createUserAffiliations(
  userId: string,
  affiliationIds?: string[],
  log?: AppLogger
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
      } catch {
        log?.warn(
          {
            event: 'auth.affiliation.upsert_failed',
            err: toSafeError('Failed to upsert user affiliation'),
          },
          'Failed to upsert user affiliation'
        )
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
  affiliationEmails?: string[], // Make emails optional
  log?: AppLogger
) {
  let processedAffiliations = new Set<string>()

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
    } catch {
      log?.warn(
        {
          event: 'auth.affiliation.upsert_failed',
          err: toSafeError('Failed to upsert participant affiliation'),
        },
        'Failed to upsert participant affiliation'
      )
    }
  }
  return [...processedAffiliations]
}

// Enhanced participant authentication helper function
export async function createOrLinkParticipant(
  profile: ExtendedProfile,
  log: AppLogger
) {
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
          profile.swissEduIDLinkedAffiliationMail, // Pass undefined if not available
          log
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
          existing.participantId,
          InvitationEmailMode.AffiliationsOnly,
          log
        )
        log.info(
          {
            event: 'auth.invitation.auto_accept_completed',
            outcome: 'existing_participant',
            invitationCount: acceptedCount,
          },
          'Completed invitation auto-accept'
        )
      } catch {
        log.warn(
          {
            event: 'auth.invitation.auto_accept_failed',
            err: toSafeError('Invitation auto-accept failed'),
          },
          'Invitation auto-accept failed'
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
        profile.swissEduIDLinkedAffiliationMail,
        log
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
        participant.id,
        InvitationEmailMode.AffiliationsOnly,
        log
      )
      log.info(
        {
          event: 'auth.invitation.auto_accept_completed',
          outcome: 'new_participant',
          invitationCount: acceptedCount,
        },
        'Completed invitation auto-accept'
      )
    } catch {
      log.warn(
        {
          event: 'auth.invitation.auto_accept_failed',
          err: toSafeError('Invitation auto-accept failed'),
        },
        'Invitation auto-accept failed'
      )
    }

    await updateAssessmentParticipantIdentity(tx, participant.id, profile)

    // Ensure the transaction returns the participant for the caller
    return participant
  })

  return participant
}
