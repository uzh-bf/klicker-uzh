import { afterEach, describe, expect, test, vi } from 'vitest'
import { notifyManageParent } from '../src/services/manageParentNotify'
import { useManageParentStore } from '../src/stores/manageParentStore'

afterEach(() => {
  useManageParentStore.setState({ manageParentOrigin: null })
  vi.unstubAllGlobals()
})

describe('Manage parent notify', () => {
  test('posts the element-created message to the cached parent origin', () => {
    const postMessage = vi.fn()
    vi.stubGlobal('window', { parent: { postMessage } })
    useManageParentStore.setState({
      manageParentOrigin: 'https://manage.example.com',
    })

    notifyManageParent({ id: 42, name: 'Draft question' })

    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'klicker:manage-element-created',
        payload: { id: 42, name: 'Draft question' },
      },
      'https://manage.example.com'
    )
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
