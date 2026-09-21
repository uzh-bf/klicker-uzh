import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  type JWTPayload,
  PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
} from '@klicker-uzh/util'
import {
  admitParticipantToken,
  admitRegisteredParticipant,
  type ParticipantDataUseState,
} from './participantAdmission.js'

const acknowledgedAt = new Date('2026-09-08T08:00:00.000Z')

// Synthetic account states. The disclosure version is the server-owned
// constant, so a test asserting the gate accepts a completed account keeps
// following the version the application actually requires.
const completedAccount: NonNullable<ParticipantDataUseState> = {
  dataUseAcknowledgedAt: acknowledgedAt,
  dataUseAcknowledgedVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  researchConsentChoiceAt: acknowledgedAt,
  researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  learningAnalyticsChoiceAt: acknowledgedAt,
  learningAnalyticsDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
}

const pendingChoiceAccount: NonNullable<ParticipantDataUseState> = {
  ...completedAccount,
  researchConsentChoiceAt: null,
  researchConsentDisclosureVersion: null,
}

const supersededDisclosureAccount: NonNullable<ParticipantDataUseState> = {
  ...completedAccount,
  dataUseAcknowledgedVersion: '2026-08-01',
}

const registeredParticipant: JWTPayload = {
  sub: 'participant-1',
  role: 'PARTICIPANT',
}

describe('admitRegisteredParticipant', () => {
  it('admits an account that acknowledged the current disclosure and both choices', async () => {
    assert.deepEqual(
      await admitRegisteredParticipant(
        'participant-1',
        async () => completedAccount
      ),
      { admitted: true }
    )
  })

  it('rejects an account without a data-use state', async () => {
    assert.deepEqual(
      await admitRegisteredParticipant('participant-1', async () => null),
      {
        admitted: false,
        status: 403,
        error: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED',
      }
    )
  })

  it('rejects an account that has not recorded both optional choices', async () => {
    const admission = await admitRegisteredParticipant(
      'participant-1',
      async () => pendingChoiceAccount
    )

    assert.equal(admission.admitted, false)
  })

  it('rejects an account that acknowledged a superseded disclosure', async () => {
    const admission = await admitRegisteredParticipant(
      'participant-1',
      async () => supersededDisclosureAccount
    )

    assert.equal(admission.admitted, false)
  })
})

describe('admitParticipantToken', () => {
  it('leaves requests without a registered participant cookie ungated', async () => {
    const admission = await admitParticipantToken(undefined, {
      verifyParticipantToken: async () => {
        throw new Error('must not verify without a token')
      },
      loadDataUseState: async () => {
        throw new Error('must not load state without a token')
      },
    })

    assert.deepEqual(admission, { admitted: true })
  })

  it('admits a registered participant with a completed account', async () => {
    const loadedFor: string[] = []
    const admission = await admitParticipantToken('registered-token', {
      verifyParticipantToken: async () => registeredParticipant,
      loadDataUseState: async (participantId) => {
        loadedFor.push(participantId)
        return completedAccount
      },
    })

    assert.deepEqual(admission, { admitted: true })
    assert.deepEqual(loadedFor, ['participant-1'])
  })

  it('rejects a registered participant whose account is incomplete', async () => {
    const admission = await admitParticipantToken('registered-token', {
      verifyParticipantToken: async () => registeredParticipant,
      loadDataUseState: async () => pendingChoiceAccount,
    })

    assert.deepEqual(admission, {
      admitted: false,
      status: 403,
      error: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED',
    })
  })

  it('leaves temporary participants ungated', async () => {
    const admission = await admitParticipantToken('temporary-token', {
      verifyParticipantToken: async () => ({
        sub: 'temporary-1',
        role: 'TEMPORARY_PARTICIPANT',
      }),
      loadDataUseState: async () => {
        throw new Error('temporary participants carry no account state')
      },
    })

    assert.deepEqual(admission, { admitted: true })
  })

  it('leaves an unverifiable cookie to the existing anonymous handling', async () => {
    const admission = await admitParticipantToken('stale-token', {
      verifyParticipantToken: async () => {
        throw new Error('Invalid token')
      },
      loadDataUseState: async () => {
        throw new Error('must not load state for an unverified identity')
      },
    })

    assert.deepEqual(admission, { admitted: true })
  })

  it('leaves a token without a participant subject ungated', async () => {
    const admission = await admitParticipantToken('partial-token', {
      verifyParticipantToken: async () => ({
        sub: '',
        role: 'PARTICIPANT',
      }),
      loadDataUseState: async () => {
        throw new Error('must not load state without a subject')
      },
    })

    assert.deepEqual(admission, { admitted: true })
  })
})
