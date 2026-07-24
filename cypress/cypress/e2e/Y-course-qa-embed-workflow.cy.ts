describe('Course Q&A embed workflow', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('Y-course-qa.json').then((data) => {
      this.data = data
    })
  })

  it('CLEANUP', function () {
    cy.cleanup()
    cy.seed()
    cy.task('setCourseQAFlags', {
      courseName: this.data.course,
      isCourseQARolloutEnabled: true,
      isCourseQAEnabled: true,
      isCourseQAAnonymousEnabled: true,
    }).then((result: boolean) => {
      if (result === false) {
        throw new Error('Could not apply QA flags on Testkurs')
      }
    })
  })

  it('Lecturer generates course and external-block embed links', function () {
    cy.intercept('**/graphql', (request) => {
      const operationName =
        request.body?.operationName ??
        new URL(request.url).searchParams.get('operationName')
      if (operationName === 'GetCourseDiscussionCourseEmbeddingInfo') {
        request.alias = 'courseEmbedInfo'
      }
      if (operationName === 'GetCourseDiscussionEmbeddingInfo') {
        request.alias = 'externalEmbedInfo'
      }
    })

    cy.loginLecturer()
    cy.visit(`${Cypress.env('URL_MANAGE')}/courses/${this.data.courseId}`)
    cy.get('[data-cy="tab-discussions"]').click()
    cy.get('details').find('summary').click()

    cy.get('[data-cy="course-qa-embed-scope-course"]').click()
    cy.get('[data-cy="course-qa-generate-embed"]').should('not.be.disabled')
    cy.get('[data-cy="course-qa-generate-embed"]').click()
    cy.wait('@courseEmbedInfo').its('request.method').should('equal', 'POST')
    cy.get('[data-cy="course-qa-embed-url"]')
      .invoke('text')
      .then((courseEmbedUrl) => {
        const url = new URL(courseEmbedUrl.trim())
        expect(url.searchParams.get('scopeKey')).to.equal(
          `course:${this.data.courseId}`
        )
      })

    cy.get('[data-cy="course-qa-embed-scope-external"]').click()
    cy.get('[data-cy="course-qa-generate-embed"]').should('be.disabled')
    cy.get('[data-cy="course-qa-external-source"]').type(
      this.data.embed.externalSource
    )
    cy.get('[data-cy="course-qa-external-ref"]').type(
      this.data.embed.externalRef
    )
    cy.get('[data-cy="course-qa-allow-anonymous-embed"]')
      .should('be.visible')
      .and('be.enabled')
      .check()
    cy.get('[data-cy="course-qa-generate-embed"]').should('not.be.disabled')
    cy.get('[data-cy="course-qa-generate-embed"]').click()
    cy.wait('@externalEmbedInfo').its('request.method').should('equal', 'POST')

    cy.get('[data-cy="course-qa-embed-url"]')
      .should('exist')
      .invoke('text')
      .then((embedUrl) => {
        const parsedEmbedUrl = new URL(embedUrl.trim())
        expect(parsedEmbedUrl.searchParams.has('embedToken')).to.equal(false)
        expect(
          new URLSearchParams(parsedEmbedUrl.hash.slice(1)).get('embedToken')
        ).not.to.be.empty
        cy.writeFile(
          'cypress/fixtures/_qa-embed-thread-url.txt',
          embedUrl.trim()
        )
      })

    cy.get('[data-cy="course-qa-external-ref"]')
      .clear()
      .type(`${this.data.embed.externalRef}-reply`)
    cy.get('[data-cy="course-qa-generate-embed"]').click()
    cy.get('[data-cy="course-qa-embed-url"]')
      .invoke('text')
      .then((embedUrl) => {
        cy.writeFile(
          'cypress/fixtures/_qa-embed-reply-url.txt',
          embedUrl.trim()
        )
      })
  })

  it('Anonymous embed renders without app chrome and accepts a thread', function () {
    cy.readFile('cypress/fixtures/_qa-embed-thread-url.txt').then(
      (embedUrl) => {
        if (!embedUrl) {
          throw new Error('embed url not set by previous test')
        }
        cy.visit(embedUrl)
      }
    )

    cy.location('search').should('not.contain', 'embedToken')
    cy.location('hash').should('equal', '')
    cy.window()
      .its('history.state')
      .should((historyState) => {
        expect(JSON.stringify(historyState)).not.to.contain('embedToken')
      })
    cy.findByAltText('KlickerUZH Logo').should('not.exist')
    cy.get('footer').should('not.exist')
    cy.get('[data-cy="course-qa-thread-anonymous"]')
      .should('be.visible')
      .and('be.enabled')
      .check()
    cy.get('[data-cy="course-qa-thread-input"]').type(
      this.data.embed.anonymousThread
    )
    cy.get('[data-cy="course-qa-create-thread"]').click()
    cy.findByText(this.data.embed.anonymousThread).should('exist')
    cy.get('[data-cy="course-qa-thread-input"]').should('have.value', '')
    cy.get('[data-cy="course-qa-thread-anonymous"]').should('not.be.checked')
  })

  it('Authenticated student creates the thread used for anonymous reply coverage', function () {
    cy.loginStudent()
    cy.get(`[data-cy="course-button-${this.data.course}"]`).should('exist')
    cy.readFile('cypress/fixtures/_qa-embed-reply-url.txt').then((embedUrl) => {
      if (!embedUrl) {
        throw new Error('embed url not set by previous test')
      }
      cy.visit(embedUrl)
    })

    cy.get('[data-cy="course-qa-thread-input"]').type(
      this.data.embed.identifiedThread
    )
    cy.get('[data-cy="course-qa-create-thread"]').click()
    cy.findByText(this.data.embed.identifiedThread).should('exist')
    cy.get('[data-cy="course-qa-thread-input"]').should('have.value', '')
  })

  it('Fresh anonymous visitor replies to the identified embed thread', function () {
    cy.readFile('cypress/fixtures/_qa-embed-reply-url.txt').then((embedUrl) => {
      if (!embedUrl) {
        throw new Error('embed url not set by previous test')
      }
      cy.visit(embedUrl)
    })

    cy.contains(
      '[data-cy^="course-qa-thread-content-"]',
      this.data.embed.identifiedThread
    )
      .parents('[data-cy^="course-qa-thread-"]')
      .first()
      .within(() => {
        cy.get('[data-cy^="course-qa-reply-input-"]').type(
          this.data.embed.anonymousReply
        )
        cy.get('[data-cy^="course-qa-reply-anonymous-"]').check()
        cy.get('[data-cy^="course-qa-create-reply-"]').click()
        cy.findByText(this.data.embed.anonymousReply).should('exist')
        cy.get('[data-cy^="course-qa-reply-input-"]').should('have.value', '')
        cy.get('[data-cy^="course-qa-reply-anonymous-"]').should(
          'not.be.checked'
        )
      })
  })

  it('Tampered embed token is rejected', function () {
    cy.readFile('cypress/fixtures/_qa-embed-thread-url.txt').then(
      (embedUrl) => {
        if (!embedUrl) {
          throw new Error('embed url not set by previous test')
        }

        const url = new URL(embedUrl)
        const fragmentParams = new URLSearchParams(url.hash.slice(1))
        const token = fragmentParams.get('embedToken') ?? ''
        const [header, payload, signature] = token.split('.')

        if (!header || !payload || !signature) {
          throw new Error('Generated embed token is not a JWT')
        }

        const signatureIndex = Math.floor(signature.length / 2)
        const replacement = signature[signatureIndex] === 'a' ? 'b' : 'a'
        const tamperedSignature =
          signature.slice(0, signatureIndex) +
          replacement +
          signature.slice(signatureIndex + 1)
        fragmentParams.set(
          'embedToken',
          `${header}.${payload}.${tamperedSignature}`
        )
        url.hash = fragmentParams.toString()

        cy.visit(url.toString())
      }
    )

    cy.get('[data-cy="course-qa-access-denied"]').should('exist')
  })
})
