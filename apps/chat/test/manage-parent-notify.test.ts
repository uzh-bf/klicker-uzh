import { afterEach, describe, expect, test } from 'vitest'
import {
  buildManageElementCreatedMessage,
  notifyManageParent,
} from '../src/services/manageParentNotify'
import { useManageParentStore } from '../src/stores/manageParentStore'

afterEach(() => {
  useManageParentStore.setState({ manageParentOrigin: null })
})

describe('Manage parent notify', () => {
  test('builds a typed element-created message envelope', () => {
    expect(
      buildManageElementCreatedMessage({ id: 42, name: 'Draft question' })
    ).toEqual({
      type: 'klicker:manage-element-created',
      payload: { id: 42, name: 'Draft question' },
    })
  })

  test('does nothing when no manage parent origin is cached', () => {
    useManageParentStore.setState({ manageParentOrigin: null })

    // The vitest environment for this suite is `node`, so `window` is
    // undefined. If notifyManageParent tried to reach window.parent it would
    // throw a ReferenceError, so a non-throwing call here proves the guard
    // short-circuits before touching the DOM - i.e. before a non-embedded
    // chat session (no verified parent origin) ever posts a message.
    expect(() =>
      notifyManageParent({ id: 1, name: 'Draft question' })
    ).not.toThrow()
  })
})
