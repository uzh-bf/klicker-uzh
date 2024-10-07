import messages from '../../../packages/i18n/messages/en'
import { AVATAR_OPTIONS } from '../../../packages/shared-components/src/constants'

describe('Login / Logout workflows for lecturer and students', () => {
  it('signs in into student account', () => {
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('macbook-16')
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')
    cy.wait(1000)
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="logout"]').click()
    cy.get('[data-cy="login-logo"]').should('exist')
  })

  it('signs in into student account on mobile', () => {
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('iphone-x')
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')
    cy.wait(1000)
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="logout"]').click()
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.viewport('macbook-16')
  })

  it('signs in into the student account and tries to modify the profile settings', () => {
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')

    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="edit-profile"]').click()

    cy.get('[data-cy="avatar-hair-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['hair'][0]]
    )
    cy.get('[data-cy="avatar-hair-select"]').click()
    cy.get(`[data-cy="avatar-hair-${AVATAR_OPTIONS['hair'][1]}"]`).click()
    cy.get('[data-cy="avatar-hair-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['hair'][1]]
    )

    cy.get('[data-cy="avatar-hairColor-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['hairColor'][0]]
    )
    cy.get('[data-cy="avatar-hairColor-select"]').click()
    cy.get(
      `[data-cy="avatar-hairColor-${AVATAR_OPTIONS['hairColor'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-hairColor-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['hairColor'][1]]
    )

    cy.get('[data-cy="avatar-eyes-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['eyes'][0]]
    )
    cy.get('[data-cy="avatar-eyes-select"]').click()
    cy.get(`[data-cy="avatar-eyes-${AVATAR_OPTIONS['eyes'][1]}"]`).click()
    cy.get('[data-cy="avatar-eyes-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['eyes'][1]]
    )

    cy.get('[data-cy="avatar-accessory-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['accessory'][0]]
    )
    cy.get('[data-cy="avatar-accessory-select"]').click()
    cy.get(
      `[data-cy="avatar-accessory-${AVATAR_OPTIONS['accessory'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-accessory-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['accessory'][1]]
    )

    cy.get('[data-cy="avatar-mouth-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['mouth'][0]]
    )
    cy.get('[data-cy="avatar-mouth-select"]').click()
    cy.get(`[data-cy="avatar-mouth-${AVATAR_OPTIONS['mouth'][1]}"]`).click()
    cy.get('[data-cy="avatar-mouth-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['mouth'][1]]
    )

    cy.get('[data-cy="avatar-facialHair-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['facialHair'][0]]
    )
    cy.get('[data-cy="avatar-facialHair-select"]').click()
    cy.get(
      `[data-cy="avatar-facialHair-${AVATAR_OPTIONS['facialHair'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-facialHair-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['facialHair'][1]]
    )

    cy.get('[data-cy="avatar-clothing-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['clothing'][0]]
    )
    cy.get('[data-cy="avatar-clothing-select"]').click()
    cy.get(
      `[data-cy="avatar-clothing-${AVATAR_OPTIONS['clothing'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-clothing-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['clothing'][1]]
    )

    cy.get('[data-cy="avatar-clothingColor-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['clothingColor'][0]]
    )
    cy.get('[data-cy="avatar-clothingColor-select"]').click()
    cy.get(
      `[data-cy="avatar-clothingColor-${AVATAR_OPTIONS['clothingColor'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-clothingColor-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['clothingColor'][1]]
    )

    cy.get('[data-cy="avatar-skinTone-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['skinTone'][0]]
    )
    cy.get('[data-cy="avatar-skinTone-select"]').click()
    cy.get(
      `[data-cy="avatar-skinTone-${AVATAR_OPTIONS['skinTone'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-skinTone-select"]').contains(
      messages.pwa.avatar[AVATAR_OPTIONS['skinTone'][1]]
    )
  })

  // it('signs in into student account and modifies the password', () => {
  //   const newPassword = 'NEW PASSWORD'

  //   cy.clearAllCookies()
  //   cy.visit(Cypress.env('URL_STUDENT'))
  //   cy.viewport('macbook-16')
  //   cy.get('[data-cy="login-logo"]').should('exist')
  //   cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get('[data-cy="homepage"]').should('exist')
  //   cy.wait(1000)

  //   // modify password
  //   cy.get('[data-cy="header-avatar"]').click()
  //   cy.get('[data-cy="edit-profile"]').click()
  //   cy.get('[data-cy="update-account-password"]').type(newPassword)
  //   cy.get('[data-cy="update-account-password-repetition"]').type(newPassword)
  //   cy.get('[data-cy="save-account-update"]')

  //   // logout, reload page and log in again with new password
  //   cy.get('[data-cy="header-avatar"]').click()
  //   cy.get('[data-cy="logout"]').click()
  //   cy.get('[data-cy="login-logo"]').should('exist')
  //   cy.reload()
  //   cy.get('[data-cy="login-logo"]').should('exist')
  //   cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]').type(newPassword)
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get('[data-cy="homepage"]').should('exist')

  //   // modify password back to original value
  //   cy.get('[data-cy="header-avatar"]').click()
  //   cy.get('[data-cy="edit-profile"]').click()
  //   cy.get('[data-cy="update-account-password"]').type(
  //     Cypress.env('STUDENT_PASSWORD')
  //   )
  //   cy.get('[data-cy="update-account-password-repetition"]').type(
  //     Cypress.env('STUDENT_PASSWORD')
  //   )
  //   cy.get('[data-cy="save-account-update"]')
  //   cy.wait(1000)

  //   // login again with original credentials
  //   cy.get('[data-cy="header-avatar"]').click()
  //   cy.get('[data-cy="logout"]').click()
  //   cy.get('[data-cy="login-logo"]').should('exist')
  //   cy.reload()
  //   cy.get('[data-cy="login-logo"]').should('exist')
  //   cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
  //   cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
  //   cy.get('[data-cy="submit-login"]').click()
  //   cy.get('[data-cy="homepage"]').should('exist')
  // })

  it('signs in into student account with the students email', () => {
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('macbook-16')
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_EMAIL'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')
    cy.wait(1000)
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="logout"]').click()
    cy.get('[data-cy="login-logo"]').should('exist')
  })

  it('signs in into lecturer account', () => {
    cy.visit(Cypress.env('URL_MANAGE'))
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.get('[data-cy="delegated-login-button"').then((btn) => {
      if (btn.is(':disabled')) {
        cy.get('button[data-cy="tos-checkbox"]').click()
      }
    })

    cy.get('[data-cy="delegated-login-button"').should('be.enabled').click()
    cy.get('[data-cy="identifier-field"]').type(
      Cypress.env('LECTURER_IDENTIFIER')
    )
    cy.get('[data-cy="password-field"]').type(Cypress.env('LECTURER_PASSWORD'))
    cy.get('form > button[type=submit]').click()
    cy.get('[data-cy="homepage"]').should('exist')
    cy.get('[data-cy="user-menu"]').click()
  })
})
