import { describe, expect, it } from 'vitest'
import { createKnowledgeGraphAdmission } from '../src/services/knowledgeGraphAdmission'

describe('graph admission', () => {
  it('rejects concurrent reads without queueing and releases exactly once', () => {
    const admission = createKnowledgeGraphAdmission()
    const first = admission.acquire('student', 0)
    const second = admission.acquire('student', 0)
    expect(admission.acquire('student', 0).allowed).toBe(false)
    if (!first.allowed || !second.allowed) throw new Error('Expected slots')
    first.release()
    first.release()
    expect(admission.acquire('student', 0).allowed).toBe(true)
    expect(admission.acquire('student', 0).allowed).toBe(false)
  })

  it('bounds aggregate concurrency across participants', () => {
    const admission = createKnowledgeGraphAdmission()
    for (let i = 0; i < 8; i++) {
      expect(admission.acquire(`student-${i}`, 0).allowed).toBe(true)
    }
    expect(admission.acquire('another', 0)).toMatchObject({ allowed: false })
  })

  it('bounds request rate and recovers after the window', () => {
    const admission = createKnowledgeGraphAdmission()
    for (let i = 0; i < 60; i++) {
      const slot = admission.acquire('student', 0)
      if (!slot.allowed) throw new Error('Expected slot')
      slot.release()
    }
    expect(admission.acquire('student', 1000)).toEqual({
      allowed: false,
      retryAfterSeconds: 59,
    })
    expect(admission.acquire('student', 60_000).allowed).toBe(true)
  })

  it('bounds identity storage and expires only inactive identities', () => {
    const admission = createKnowledgeGraphAdmission()
    for (let i = 0; i < 2000; i++) {
      const slot = admission.acquire(`student-${i}`, 0)
      if (!slot.allowed) throw new Error('Expected slot')
      slot.release()
    }
    expect(admission.acquire('overflow', 0).allowed).toBe(false)
    const active = admission.acquire('student-0', 0)
    expect(active.allowed).toBe(true)
    expect(admission.acquire('overflow', 60_000).allowed).toBe(true)
    expect(admission.acquire('student-0', 60_000).allowed).toBe(true)
    expect(admission.acquire('student-0', 60_000).allowed).toBe(false)
  })
})
