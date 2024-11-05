import messages from '../../../packages/i18n/messages/en'
import { AvatarOptions } from '../../../packages/shared-components/src/constants'

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
      messages.pwa.avatar[AvatarOptions['hair'][0]]
    )
    cy.get('[data-cy="avatar-hair-select"]').click()
    cy.get(`[data-cy="avatar-hair-${AvatarOptions['hair'][1]}"]`).click()
    cy.get('[data-cy="avatar-hair-select"]').contains(
      messages.pwa.avatar[AvatarOptions['hair'][1]]
    )

    cy.get('[data-cy="avatar-hairColor-select"]').contains(
      messages.pwa.avatar[AvatarOptions['hairColor'][0]]
    )
    cy.get('[data-cy="avatar-hairColor-select"]').click()
    cy.get(
      `[data-cy="avatar-hairColor-${AvatarOptions['hairColor'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-hairColor-select"]').contains(
      messages.pwa.avatar[AvatarOptions['hairColor'][1]]
    )

    cy.get('[data-cy="avatar-eyes-select"]').contains(
      messages.pwa.avatar[AvatarOptions['eyes'][0]]
    )
    cy.get('[data-cy="avatar-eyes-select"]').click()
    cy.get(`[data-cy="avatar-eyes-${AvatarOptions['eyes'][1]}"]`).click()
    cy.get('[data-cy="avatar-eyes-select"]').contains(
      messages.pwa.avatar[AvatarOptions['eyes'][1]]
    )

    cy.get('[data-cy="avatar-accessory-select"]').contains(
      messages.pwa.avatar[AvatarOptions['accessory'][0]]
    )
    cy.get('[data-cy="avatar-accessory-select"]').click()
    cy.get(
      `[data-cy="avatar-accessory-${AvatarOptions['accessory'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-accessory-select"]').contains(
      messages.pwa.avatar[AvatarOptions['accessory'][1]]
    )

    cy.get('[data-cy="avatar-mouth-select"]').contains(
      messages.pwa.avatar[AvatarOptions['mouth'][0]]
    )
    cy.get('[data-cy="avatar-mouth-select"]').click()
    cy.get(`[data-cy="avatar-mouth-${AvatarOptions['mouth'][1]}"]`).click()
    cy.get('[data-cy="avatar-mouth-select"]').contains(
      messages.pwa.avatar[AvatarOptions['mouth'][1]]
    )

    cy.get('[data-cy="avatar-facialHair-select"]').contains(
      messages.pwa.avatar[AvatarOptions['facialHair'][0]]
    )
    cy.get('[data-cy="avatar-facialHair-select"]').click()
    cy.get(
      `[data-cy="avatar-facialHair-${AvatarOptions['facialHair'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-facialHair-select"]').contains(
      messages.pwa.avatar[AvatarOptions['facialHair'][1]]
    )

    cy.get('[data-cy="avatar-clothing-select"]').contains(
      messages.pwa.avatar[AvatarOptions['clothing'][0]]
    )
    cy.get('[data-cy="avatar-clothing-select"]').click()
    cy.get(
      `[data-cy="avatar-clothing-${AvatarOptions['clothing'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-clothing-select"]').contains(
      messages.pwa.avatar[AvatarOptions['clothing'][1]]
    )

    cy.get('[data-cy="avatar-clothingColor-select"]').contains(
      messages.pwa.avatar[AvatarOptions['clothingColor'][0]]
    )
    cy.get('[data-cy="avatar-clothingColor-select"]').click()
    cy.get(
      `[data-cy="avatar-clothingColor-${AvatarOptions['clothingColor'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-clothingColor-select"]').contains(
      messages.pwa.avatar[AvatarOptions['clothingColor'][1]]
    )

    cy.get('[data-cy="avatar-skinTone-select"]').contains(
      messages.pwa.avatar[AvatarOptions['skinTone'][0]]
    )
    cy.get('[data-cy="avatar-skinTone-select"]').click()
    cy.get(
      `[data-cy="avatar-skinTone-${AvatarOptions['skinTone'][1]}"]`
    ).click()
    cy.get('[data-cy="avatar-skinTone-select"]').contains(
      messages.pwa.avatar[AvatarOptions['skinTone'][1]]
    )
  })

  it('signs in into student account and modifies the password', () => {
    const newPassword = 'NEW PASSWORD'

    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'))
    cy.viewport('macbook-16')
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')
    cy.wait(1000)

    // modify password
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="edit-profile"]').click()
    cy.get('[data-cy="update-account-password"]').type(newPassword)
    cy.get('[data-cy="update-account-password-repetition"]').type(newPassword)
    cy.get('[data-cy="save-account-update"]').click()
    cy.wait(1000)

    // logout, reload page and log in again with new password
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="logout"]').click()
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.reload()
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(newPassword)
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')

    // modify password back to original value
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="edit-profile"]').click()
    cy.get('[data-cy="update-account-password"]').type(
      Cypress.env('STUDENT_PASSWORD')
    )
    cy.get('[data-cy="update-account-password-repetition"]').type(
      Cypress.env('STUDENT_PASSWORD')
    )
    cy.get('[data-cy="save-account-update"]').click()
    cy.wait(1000)

    // login again with original credentials
    cy.get('[data-cy="header-avatar"]').click()
    cy.get('[data-cy="logout"]').click()
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.reload()
    cy.get('[data-cy="login-logo"]').should('exist')
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'))
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'))
    cy.get('[data-cy="submit-login"]').click()
    cy.get('[data-cy="homepage"]').should('exist')
  })

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
