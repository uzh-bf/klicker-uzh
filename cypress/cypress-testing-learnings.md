# Cypress testing learnings

- Try to avoid cy.wait(xxx) since it introduces flakiness in the test.
  Use the options Object instead: cy.get('#id', {timeout: 5000}).should('exist');
