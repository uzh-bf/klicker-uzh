import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AzureTableTestHelper } from './utils/azure-table-helper.js'

const BASE_URL = 'http://localhost:7080'
const AUTH_TOKEN = process.env.AUDIT_TOKEN || 'test-secret-token-123'

// Test helper instance
const tableHelper = new AzureTableTestHelper()

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Internal-Token': AUTH_TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return response
}

interface AuditEvent {
  subject: string
  action: string
  eventId: string
  sessionId?: string
  userId?: string
  resourceId?: string
  attributes?: Record<string, any>
}

// Helper to submit events with verification
async function submitAndVerifyEvents(events: AuditEvent[]) {
  const results = []
  const eventIds = new Set(events.map((event) => event.eventId))

  for (const event of events) {
    const response = await makeAuthenticatedRequest('/audit', {
      method: 'POST',
      body: JSON.stringify(event),
    })

    expect(response.status).toBe(200)
    const responseData = await response.json()

    results.push({
      submitted: event,
      response: responseData,
    })
  }

  // Wait for persistence
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Verify all events are persisted
  const persistedEntities = (await tableHelper.getAllEntities()).filter(
    (entity) => (entity.rowKey ? eventIds.has(entity.rowKey) : false)
  )
  expect(persistedEntities.length).toBe(events.length)

  return { results, persistedEntities }
}

describe('Real-World Scenario Tests', () => {
  beforeAll(async () => {
    console.log('Setting up scenario tests...')
    await tableHelper.setup()
    await tableHelper.cleanup()
  })

  beforeEach(async () => {
    await tableHelper.cleanup()
  })

  afterAll(async () => {
    console.log('Cleaning up scenario tests...')
    await tableHelper.cleanup()
  })

  describe('User Authentication and Session Management', () => {
    it('should track complete user login session with audit trail', async () => {
      const testId = Date.now()

      const userId = 'user-auth-test'
      const sessionId = `session-${testId}`

      // Complete authentication flow
      const authFlow: AuditEvent[] = [
        {
          subject: `user:${userId}@company.com`,
          action: 'auth.login.attempt',
          eventId: `auth-${testId}-01`,
          sessionId,
          attributes: {
            ipAddress: '192.168.1.100',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            method: 'username_password',
            deviceFingerprint: 'fp-abc123',
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'auth.mfa.challenge',
          eventId: `auth-${testId}-02`,
          sessionId,
          attributes: {
            mfaMethod: 'totp',
            challengeId: 'challenge-xyz789',
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'auth.mfa.success',
          eventId: `auth-${testId}-03`,
          sessionId,
          attributes: {
            mfaMethod: 'totp',
            challengeId: 'challenge-xyz789',
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'auth.login.success',
          eventId: `auth-${testId}-04`,
          sessionId,
          userId,
          attributes: {
            sessionDuration: 3600,
            permissions: ['read', 'write', 'admin'],
            lastLoginDate: '2024-01-14T10:30:00Z',
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(authFlow)

      // Verify complete audit trail
      const authEvents = persistedEntities.sort(
        (a, b) => extractEntityTimestamp(a) - extractEntityTimestamp(b)
      )

      // Check sequence
      expect(authEvents[0]!.action).toBe('auth.login.attempt')
      expect(authEvents[1]!.action).toBe('auth.mfa.challenge')
      expect(authEvents[2]!.action).toBe('auth.mfa.success')
      expect(authEvents[3]!.action).toBe('auth.login.success')

      // Verify session consistency
      authEvents.forEach((event) => {
        expect(event.sessionId).toBe(sessionId)
        expect(event.subject).toContain(userId)
      })

      // Verify MFA challenge/response correlation
      const challengeEvent = authEvents.find(
        (e) => e.action === 'auth.mfa.challenge'
      )!
      const successEvent = authEvents.find(
        (e) => e.action === 'auth.mfa.success'
      )!
      const challengeAttrs = JSON.parse(challengeEvent.attributes!)
      const successAttrs = JSON.parse(successEvent.attributes!)
      expect(challengeAttrs.challengeId).toBe(successAttrs.challengeId)

      console.log(
        `  ✓ Complete authentication flow tracked: ${authEvents.length} events`
      )
    })

    it('should track failed authentication attempts and account lockout', async () => {
      const testId = Date.now()

      const userId = 'user-failure-test'
      const sessionId = `session-fail-${testId}`

      const failureFlow: AuditEvent[] = [
        {
          subject: `user:${userId}@company.com`,
          action: 'auth.login.attempt',
          eventId: `fail-${testId}-01`,
          sessionId: `${sessionId}-1`,
          attributes: { ipAddress: '203.0.113.42', attemptNumber: 1 },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'auth.login.failed',
          eventId: `fail-${testId}-02`,
          sessionId: `${sessionId}-1`,
          attributes: { reason: 'invalid_password', attemptNumber: 1 },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'auth.login.attempt',
          eventId: `fail-${testId}-03`,
          sessionId: `${sessionId}-2`,
          attributes: { ipAddress: '203.0.113.42', attemptNumber: 2 },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'auth.login.failed',
          eventId: `fail-${testId}-04`,
          sessionId: `${sessionId}-2`,
          attributes: { reason: 'invalid_password', attemptNumber: 2 },
        },
        {
          subject: 'system:auth-service',
          action: 'auth.account.locked',
          eventId: `fail-${testId}-05`,
          resourceId: userId,
          attributes: {
            reason: 'too_many_failed_attempts',
            lockDuration: 1800,
            failedAttempts: 2,
            suspiciousIp: '203.0.113.42',
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(failureFlow)

      // Verify failure tracking
      const failureEvents = persistedEntities.filter((e) =>
        e.action.includes('failed')
      )
      expect(failureEvents.length).toBe(2)

      const lockEvent = persistedEntities.find(
        (e) => e.action === 'auth.account.locked'
      )!
      expect(lockEvent).toBeTruthy()
      expect(lockEvent.resourceId).toBe(userId)

      const lockAttrs = JSON.parse(lockEvent.attributes!)
      expect(lockAttrs.failedAttempts).toBe(2)

      console.log('  ✓ Failed authentication and lockout flow tracked')
    })
  })

  describe('Document and Resource Management', () => {
    it('should track complete document lifecycle', async () => {
      const testId = Date.now()

      const userId = 'user-doc-test'
      const documentId = `doc-${testId}`

      const documentFlow: AuditEvent[] = [
        {
          subject: `user:${userId}@company.com`,
          action: 'document.created',
          eventId: `doc-${testId}-01`,
          resourceId: documentId,
          userId,
          attributes: {
            documentType: 'contract',
            classification: 'confidential',
            size: 1024000,
            format: 'pdf',
            metadata: {
              title: 'Service Agreement 2024',
              author: userId,
              department: 'Legal',
              version: '1.0',
            },
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'document.viewed',
          eventId: `doc-${testId}-02`,
          resourceId: documentId,
          userId,
          attributes: {
            viewDuration: 300,
            pageCount: 12,
            accessMethod: 'web_ui',
          },
        },
        {
          subject: `user:reviewer@company.com`,
          action: 'document.viewed',
          eventId: `doc-${testId}-03`,
          resourceId: documentId,
          userId: 'reviewer',
          attributes: {
            viewDuration: 850,
            pageCount: 12,
            accessMethod: 'mobile_app',
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'document.edited',
          eventId: `doc-${testId}-04`,
          resourceId: documentId,
          userId,
          attributes: {
            changeType: 'content_modification',
            sectionModified: 'terms_and_conditions',
            previousVersion: '1.0',
            newVersion: '1.1',
            changeDescription: 'Updated payment terms',
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'document.shared',
          eventId: `doc-${testId}-05`,
          resourceId: documentId,
          userId,
          attributes: {
            sharedWith: ['legal-team@company.com', 'finance@company.com'],
            permissions: ['read', 'comment'],
            expirationDate: '2024-02-15T00:00:00Z',
            shareMethod: 'secure_link',
          },
        },
        {
          subject: `user:approver@company.com`,
          action: 'document.approved',
          eventId: `doc-${testId}-06`,
          resourceId: documentId,
          userId: 'approver',
          attributes: {
            approvalLevel: 'manager',
            approvalDate: new Date().toISOString(),
            comments: 'Approved pending minor revisions',
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(documentFlow)

      // Verify document lifecycle tracking
      const docEvents = persistedEntities.sort(
        (a, b) => extractEntityTimestamp(a) - extractEntityTimestamp(b)
      )

      // All events should reference the same document
      docEvents.forEach((event) => {
        expect(event.resourceId).toBe(documentId)
      })

      // Verify lifecycle stages
      const actions = docEvents.map((e) => e.action)
      const expectedActions = [
        'document.created',
        'document.viewed',
        'document.viewed',
        'document.edited',
        'document.shared',
        'document.approved',
      ]
      expect(actions).toEqual(expectedActions)

      // Verify version tracking
      const createEvent = docEvents.find(
        (e) => e.action === 'document.created'
      )!
      const editEvent = docEvents.find((e) => e.action === 'document.edited')!

      const createAttrs = JSON.parse(createEvent.attributes!)
      const editAttrs = JSON.parse(editEvent.attributes!)

      expect(createAttrs.metadata.version).toBe('1.0')
      expect(editAttrs.previousVersion).toBe('1.0')
      expect(editAttrs.newVersion).toBe('1.1')

      // Verify sharing details
      const shareEvent = docEvents.find((e) => e.action === 'document.shared')!
      const shareAttrs = JSON.parse(shareEvent.attributes!)
      expect(Array.isArray(shareAttrs.sharedWith)).toBe(true)
      expect(shareAttrs.sharedWith.length).toBe(2)

      console.log(
        `  ✓ Document lifecycle tracked: ${docEvents.length} events across multiple users`
      )
    })

    it('should track compliance-sensitive file operations', async () => {
      const testId = Date.now()

      const userId = 'user-compliance'
      const fileId = `file-${testId}`

      const complianceFlow: AuditEvent[] = [
        {
          subject: `user:${userId}@company.com`,
          action: 'file.uploaded',
          eventId: `comp-${testId}-01`,
          resourceId: fileId,
          userId,
          attributes: {
            fileName: 'customer_data_export.csv',
            fileSize: 5242880,
            mimeType: 'text/csv',
            containsPII: true,
            dataClassification: 'restricted',
            uploadSource: 'web_interface',
            checksums: {
              md5: 'd41d8cd98f00b204e9800998ecf8427e',
              sha256:
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            },
          },
        },
        {
          subject: 'system:dlp-scanner',
          action: 'file.scanned',
          eventId: `comp-${testId}-02`,
          resourceId: fileId,
          attributes: {
            scanType: 'data_loss_prevention',
            piiDetected: ['email_addresses', 'phone_numbers', 'ssn'],
            riskLevel: 'high',
            scanDuration: 2.5,
            quarantined: true,
          },
        },
        {
          subject: `user:compliance-officer@company.com`,
          action: 'file.reviewed',
          eventId: `comp-${testId}-03`,
          resourceId: fileId,
          userId: 'compliance-officer',
          attributes: {
            reviewType: 'manual_compliance_check',
            findings: ['contains_customer_pii', 'requires_encryption'],
            disposition: 'approved_with_conditions',
            requiredActions: ['encrypt_at_rest', 'limit_access'],
          },
        },
        {
          subject: 'system:encryption-service',
          action: 'file.encrypted',
          eventId: `comp-${testId}-04`,
          resourceId: fileId,
          attributes: {
            encryptionMethod: 'AES-256-GCM',
            keyId: 'key-compliance-2024-001',
            encryptionDate: new Date().toISOString(),
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'file.accessed',
          eventId: `comp-${testId}-05`,
          resourceId: fileId,
          userId,
          attributes: {
            accessType: 'download',
            decryptionRequired: true,
            purpose: 'customer_service_inquiry',
            approvedBy: 'compliance-officer',
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(complianceFlow)

      // Verify compliance audit trail
      const compEvents = persistedEntities.sort(
        (a, b) => extractEntityTimestamp(a) - extractEntityTimestamp(b)
      )

      // Check PII detection and handling
      const scanEvent = compEvents.find((e) => e.action === 'file.scanned')!
      const scanAttrs = JSON.parse(scanEvent.attributes!)
      expect(scanAttrs.piiDetected).toContain('email_addresses')
      expect(scanAttrs.riskLevel).toBe('high')
      expect(scanAttrs.quarantined).toBe(true)

      // Check compliance review
      const reviewEvent = compEvents.find((e) => e.action === 'file.reviewed')!
      const reviewAttrs = JSON.parse(reviewEvent.attributes!)
      expect(reviewAttrs.disposition).toBe('approved_with_conditions')
      expect(reviewAttrs.requiredActions).toContain('encrypt_at_rest')

      // Check encryption compliance
      const encryptEvent = compEvents.find(
        (e) => e.action === 'file.encrypted'
      )!
      const encryptAttrs = JSON.parse(encryptEvent.attributes!)
      expect(encryptAttrs.encryptionMethod).toBe('AES-256-GCM')

      // Check controlled access
      const accessEvent = compEvents.find((e) => e.action === 'file.accessed')!
      const accessAttrs = JSON.parse(accessEvent.attributes!)
      expect(accessAttrs.decryptionRequired).toBe(true)
      expect(accessAttrs.approvedBy).toBe('compliance-officer')

      console.log(
        '  ✓ Compliance-sensitive file operations tracked with full audit trail'
      )
    })
  })

  describe('System Operations and Security', () => {
    it('should track security incident response workflow', async () => {
      const testId = Date.now()

      const incidentId = `inc-${testId}`

      const securityFlow: AuditEvent[] = [
        {
          subject: 'system:intrusion-detection',
          action: 'security.threat.detected',
          eventId: `sec-${testId}-01`,
          resourceId: incidentId,
          attributes: {
            threatType: 'brute_force_attack',
            severity: 'high',
            sourceIP: '203.0.113.100',
            targetResource: 'auth_service',
            detectionMethod: 'ml_anomaly_detection',
            confidence: 0.95,
          },
        },
        {
          subject: 'system:incident-response',
          action: 'security.incident.created',
          eventId: `sec-${testId}-02`,
          resourceId: incidentId,
          attributes: {
            incidentType: 'security_breach_attempt',
            priority: 'high',
            assignedTo: 'security-team',
            escalationLevel: 2,
            responseTeam: ['security-analyst-1', 'security-manager'],
          },
        },
        {
          subject: 'system:firewall',
          action: 'security.ip.blocked',
          eventId: `sec-${testId}-03`,
          resourceId: incidentId,
          attributes: {
            blockedIP: '203.0.113.100',
            blockDuration: 3600,
            blockReason: 'automated_incident_response',
            relatedIncident: incidentId,
          },
        },
        {
          subject: 'user:security-analyst@company.com',
          action: 'security.incident.investigated',
          eventId: `sec-${testId}-04`,
          resourceId: incidentId,
          userId: 'security-analyst',
          attributes: {
            investigationFindings: [
              'confirmed_brute_force_attack',
              'no_successful_authentication',
              'attack_origin_tor_exit_node',
            ],
            affectedSystems: ['auth_service'],
            dataImpact: 'none',
            investigationTime: 45,
          },
        },
        {
          subject: 'user:security-manager@company.com',
          action: 'security.incident.resolved',
          eventId: `sec-${testId}-05`,
          resourceId: incidentId,
          userId: 'security-manager',
          attributes: {
            resolutionType: 'threat_mitigated',
            resolution: 'IP blocked, no data compromise, monitoring enhanced',
            lessonsLearned: ['enhance_rate_limiting', 'improve_tor_detection'],
            followUpActions: ['update_security_policies', 'staff_training'],
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(securityFlow)

      // Verify security incident workflow
      const secEvents = persistedEntities.sort(
        (a, b) => extractEntityTimestamp(a) - extractEntityTimestamp(b)
      )

      // All events should reference the same incident
      secEvents.forEach((event) => {
        expect(event.resourceId).toBe(incidentId)
      })

      // Verify incident progression
      const threatEvent = secEvents.find(
        (e) => e.action === 'security.threat.detected'
      )!
      const threatAttrs = JSON.parse(threatEvent.attributes!)
      expect(threatAttrs.threatType).toBe('brute_force_attack')
      expect(threatAttrs.severity).toBe('high')

      const blockEvent = secEvents.find(
        (e) => e.action === 'security.ip.blocked'
      )!
      const blockAttrs = JSON.parse(blockEvent.attributes!)
      expect(blockAttrs.blockedIP).toBe(threatAttrs.sourceIP)

      const investigationEvent = secEvents.find(
        (e) => e.action === 'security.incident.investigated'
      )!
      const invAttrs = JSON.parse(investigationEvent.attributes!)
      expect(invAttrs.investigationFindings).toContain(
        'confirmed_brute_force_attack'
      )
      expect(invAttrs.dataImpact).toBe('none')

      const resolutionEvent = secEvents.find(
        (e) => e.action === 'security.incident.resolved'
      )!
      const resAttrs = JSON.parse(resolutionEvent.attributes!)
      expect(resAttrs.resolutionType).toBe('threat_mitigated')
      expect(Array.isArray(resAttrs.followUpActions)).toBe(true)

      console.log('  ✓ Security incident response workflow tracked end-to-end')
    })

    it('should track privileged access and administrative operations', async () => {
      const testId = Date.now()

      const userId = 'admin-user'
      const sessionId = `admin-session-${testId}`

      const adminFlow: AuditEvent[] = [
        {
          subject: `user:${userId}@company.com`,
          action: 'admin.privilege.escalated',
          eventId: `admin-${testId}-01`,
          sessionId,
          userId,
          attributes: {
            fromRole: 'user',
            toRole: 'system_administrator',
            escalationReason: 'emergency_system_maintenance',
            approvedBy: 'security-manager',
            maxDuration: 3600,
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'system.database.accessed',
          eventId: `admin-${testId}-02`,
          sessionId,
          userId,
          resourceId: 'production-database',
          attributes: {
            databaseName: 'customer_data',
            accessType: 'read_write',
            connectionMethod: 'encrypted_tunnel',
            purpose: 'performance_optimization',
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'system.configuration.changed',
          eventId: `admin-${testId}-03`,
          sessionId,
          userId,
          attributes: {
            configType: 'database_settings',
            parameter: 'max_connections',
            oldValue: '100',
            newValue: '200',
            changeReason: 'handle_increased_load',
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'system.backup.initiated',
          eventId: `admin-${testId}-04`,
          sessionId,
          userId,
          attributes: {
            backupType: 'full_database_backup',
            backupLocation: 'secure_offsite_storage',
            estimatedSize: '50GB',
            retentionPeriod: '90_days',
          },
        },
        {
          subject: `user:${userId}@company.com`,
          action: 'admin.privilege.revoked',
          eventId: `admin-${testId}-05`,
          sessionId,
          userId,
          attributes: {
            fromRole: 'system_administrator',
            toRole: 'user',
            revocationReason: 'task_completed',
            actualDuration: 1800,
            tasksPerformed: [
              'database_optimization',
              'configuration_update',
              'backup_creation',
            ],
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(adminFlow)

      // Verify privileged access tracking
      const adminEvents = persistedEntities.sort(
        (a, b) => extractEntityTimestamp(a) - extractEntityTimestamp(b)
      )

      // All events should be in same session
      adminEvents.forEach((event) => {
        expect(event.sessionId).toBe(sessionId)
        expect(event.userId).toBe(userId)
      })

      // Verify privilege escalation/revocation
      const escalationEvent = adminEvents.find(
        (e) => e.action === 'admin.privilege.escalated'
      )!
      const revocationEvent = adminEvents.find(
        (e) => e.action === 'admin.privilege.revoked'
      )!

      const escalationAttrs = JSON.parse(escalationEvent.attributes!)
      const revocationAttrs = JSON.parse(revocationEvent.attributes!)

      expect(escalationAttrs.toRole).toBe('system_administrator')
      expect(revocationAttrs.fromRole).toBe('system_administrator')
      expect(revocationAttrs.actualDuration).toBeLessThan(
        escalationAttrs.maxDuration
      )

      // Verify administrative actions tracking
      const dbAccessEvent = adminEvents.find(
        (e) => e.action === 'system.database.accessed'
      )
      const configEvent = adminEvents.find(
        (e) => e.action === 'system.configuration.changed'
      )
      const backupEvent = adminEvents.find(
        (e) => e.action === 'system.backup.initiated'
      )

      expect(dbAccessEvent).toBeTruthy()
      expect(configEvent).toBeTruthy()
      expect(backupEvent).toBeTruthy()

      const configAttrs = JSON.parse(configEvent!.attributes!)
      expect(configAttrs.parameter).toBe('max_connections')
      expect(configAttrs.oldValue).toBe('100')
      expect(configAttrs.newValue).toBe('200')

      console.log(
        '  ✓ Privileged access and administrative operations fully audited'
      )
    })
  })

  describe('Business Process Workflows', () => {
    it('should track financial transaction approval workflow', async () => {
      const testId = Date.now()

      const transactionId = `txn-${testId}`
      const amount = 25000.0

      const financialFlow: AuditEvent[] = [
        {
          subject: 'user:employee@company.com',
          action: 'finance.expense.submitted',
          eventId: `fin-${testId}-01`,
          resourceId: transactionId,
          userId: 'employee',
          attributes: {
            expenseType: 'equipment_purchase',
            amount,
            currency: 'USD',
            vendor: 'TechSupplier Inc',
            category: 'computer_hardware',
            businessJustification: 'Replace aging development servers',
            receiptCount: 3,
          },
        },
        {
          subject: 'user:manager@company.com',
          action: 'finance.expense.reviewed',
          eventId: `fin-${testId}-02`,
          resourceId: transactionId,
          userId: 'manager',
          attributes: {
            reviewLevel: 'department_manager',
            reviewResult: 'approved',
            reviewNotes: 'Justified for team productivity',
            reviewDuration: 15,
          },
        },
        {
          subject: 'system:finance-system',
          action: 'finance.expense.budget_checked',
          eventId: `fin-${testId}-03`,
          resourceId: transactionId,
          attributes: {
            budgetCategory: 'it_equipment',
            availableBudget: 75000.0,
            requestedAmount: amount,
            remainingAfterApproval: 50000.0,
            budgetYear: '2024',
            budgetStatus: 'sufficient_funds',
          },
        },
        {
          subject: 'user:finance-director@company.com',
          action: 'finance.expense.approved',
          eventId: `fin-${testId}-04`,
          resourceId: transactionId,
          userId: 'finance-director',
          attributes: {
            approvalLevel: 'executive',
            approvalAuthority: 'up_to_50000',
            approvalDate: new Date().toISOString(),
            expectedPaymentDate: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            paymentMethod: 'wire_transfer',
          },
        },
        {
          subject: 'system:payment-processor',
          action: 'finance.payment.processed',
          eventId: `fin-${testId}-05`,
          resourceId: transactionId,
          attributes: {
            paymentId: `pay-${testId}`,
            amount,
            currency: 'USD',
            recipientAccount: 'techsupplier-bank-account',
            processingTime: 2.3,
            confirmationCode: 'CONF123ABC',
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(financialFlow)

      // Verify financial workflow tracking
      const finEvents = persistedEntities.sort(
        (a, b) => extractEntityTimestamp(a) - extractEntityTimestamp(b)
      )

      // All events should reference the same transaction
      finEvents.forEach((event) => {
        expect(event.resourceId).toBe(transactionId)
      })

      // Verify approval workflow
      const submitEvent = finEvents.find(
        (e) => e.action === 'finance.expense.submitted'
      )!
      const reviewEvent = finEvents.find(
        (e) => e.action === 'finance.expense.reviewed'
      )!
      const budgetEvent = finEvents.find(
        (e) => e.action === 'finance.expense.budget_checked'
      )!
      const approvalEvent = finEvents.find(
        (e) => e.action === 'finance.expense.approved'
      )!
      const paymentEvent = finEvents.find(
        (e) => e.action === 'finance.payment.processed'
      )!

      // Verify amount consistency
      const submitAttrs = JSON.parse(submitEvent.attributes!)
      const budgetAttrs = JSON.parse(budgetEvent.attributes!)
      const paymentAttrs = JSON.parse(paymentEvent.attributes!)

      expect(submitAttrs.amount).toBe(amount)
      expect(budgetAttrs.requestedAmount).toBe(amount)
      expect(paymentAttrs.amount).toBe(amount)

      // Verify approval chain
      const reviewAttrs = JSON.parse(reviewEvent.attributes!)
      const approvalAttrs = JSON.parse(approvalEvent.attributes!)

      expect(reviewAttrs.reviewResult).toBe('approved')
      expect(approvalAttrs.approvalLevel).toBe('executive')

      // Verify budget compliance
      expect(budgetAttrs.budgetStatus).toBe('sufficient_funds')
      expect(budgetAttrs.availableBudget).toBeGreaterThanOrEqual(
        budgetAttrs.requestedAmount
      )

      console.log(
        `  ✓ Financial transaction workflow tracked: $${amount} approval and payment`
      )
    })

    it('should track customer data request fulfillment (GDPR compliance)', async () => {
      const testId = Date.now()

      const requestId = `req-${testId}`
      const customerId = 'customer-12345'

      const gdprFlow: AuditEvent[] = [
        {
          subject: `customer:${customerId}@example.com`,
          action: 'privacy.data_request.submitted',
          eventId: `gdpr-${testId}-01`,
          resourceId: requestId,
          userId: customerId,
          attributes: {
            requestType: 'data_export',
            requestSource: 'customer_portal',
            verificationMethod: 'email_confirmation',
            dataCategories: [
              'profile_data',
              'transaction_history',
              'preferences',
            ],
            legalBasis: 'gdpr_article_15',
          },
        },
        {
          subject: 'system:privacy-system',
          action: 'privacy.request.validated',
          eventId: `gdpr-${testId}-02`,
          resourceId: requestId,
          attributes: {
            validationType: 'identity_verification',
            validationResult: 'verified',
            verificationMethod: 'multi_factor_authentication',
            processingDeadline: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        },
        {
          subject: 'system:data-discovery',
          action: 'privacy.data.located',
          eventId: `gdpr-${testId}-03`,
          resourceId: requestId,
          attributes: {
            dataSources: [
              'user_profiles',
              'transaction_db',
              'analytics_db',
              'backup_storage',
            ],
            recordsFound: 847,
            dataSize: '2.3MB',
            sensitiveDataDetected: true,
            discoveryTime: 15.7,
          },
        },
        {
          subject: 'user:privacy-officer@company.com',
          action: 'privacy.data.reviewed',
          eventId: `gdpr-${testId}-04`,
          resourceId: requestId,
          userId: 'privacy-officer',
          attributes: {
            reviewType: 'manual_data_review',
            sensitiveDataHandling: 'anonymized_references',
            thirdPartyDataIdentified: false,
            reviewDuration: 25,
            approvalStatus: 'approved_for_export',
          },
        },
        {
          subject: 'system:data-export',
          action: 'privacy.data.exported',
          eventId: `gdpr-${testId}-05`,
          resourceId: requestId,
          attributes: {
            exportFormat: 'json',
            exportSize: '2.3MB',
            encryptionUsed: true,
            downloadLink:
              'https://secure.company.com/privacy/exports/encrypted-file',
            linkExpiration: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            checksums: {
              sha256: 'a1b2c3d4e5f6...',
              md5: '1a2b3c4d5e6f...',
            },
          },
        },
        {
          subject: `customer:${customerId}@example.com`,
          action: 'privacy.data.downloaded',
          eventId: `gdpr-${testId}-06`,
          resourceId: requestId,
          userId: customerId,
          attributes: {
            downloadDate: new Date().toISOString(),
            downloadIP: '192.168.1.100',
            requestCompletionTime: 2.5, // days
          },
        },
      ]

      const { persistedEntities } = await submitAndVerifyEvents(gdprFlow)

      // Verify GDPR compliance workflow
      const gdprEvents = persistedEntities.sort(
        (a, b) => extractEntityTimestamp(a) - extractEntityTimestamp(b)
      )

      // All events should reference the same request
      gdprEvents.forEach((event) => {
        expect(event.resourceId).toBe(requestId)
      })

      // Verify request progression
      const submitEvent = gdprEvents.find(
        (e) => e.action === 'privacy.data_request.submitted'
      )!
      const validateEvent = gdprEvents.find(
        (e) => e.action === 'privacy.request.validated'
      )!
      const locateEvent = gdprEvents.find(
        (e) => e.action === 'privacy.data.located'
      )!
      const reviewEvent = gdprEvents.find(
        (e) => e.action === 'privacy.data.reviewed'
      )!
      const exportEvent = gdprEvents.find(
        (e) => e.action === 'privacy.data.exported'
      )!
      const downloadEvent = gdprEvents.find(
        (e) => e.action === 'privacy.data.downloaded'
      )!

      // Verify GDPR compliance elements
      const submitAttrs = JSON.parse(submitEvent.attributes!)
      expect(submitAttrs.legalBasis).toBe('gdpr_article_15')
      expect(submitAttrs.dataCategories).toContain('profile_data')

      const locateAttrs = JSON.parse(locateEvent.attributes!)
      expect(locateAttrs.recordsFound).toBeGreaterThan(0)
      expect(locateAttrs.dataSources).toContain('user_profiles')

      const reviewAttrs = JSON.parse(reviewEvent.attributes!)
      expect(reviewAttrs.approvalStatus).toBe('approved_for_export')

      const exportAttrs = JSON.parse(exportEvent.attributes!)
      expect(exportAttrs.encryptionUsed).toBe(true)
      expect(exportAttrs.checksums.sha256).toBeTruthy()

      console.log(
        `  ✓ GDPR data request fulfilled: ${locateAttrs.recordsFound} records, ${locateAttrs.dataSize}`
      )
    })
  })
})
function extractEntityTimestamp(entity: any): number {
  const raw = (entity as any).eventTimestamp ?? (entity as any).timestamp
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw)
    if (Number.isNaN(parsed)) throw new Error(`Invalid timestamp: ${raw}`)
    return parsed
  }
  throw new Error('Timestamp not found on entity')
}
