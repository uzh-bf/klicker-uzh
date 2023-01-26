# Cypress testing learnings

- Try to avoid cy.wait(xxx) since it introduces flakiness in the test.
  Use the options Object instead: cy.get('#id', {timeout: 5000}).should('exist');
  I read this somewhere but I don't think this is the same. cy.wait() actually pauses the test
  while timeout just gives cypress more time to interact with the element, but not actually
  halting the code. Nevertheless I think it's true that cy.wait() makes the tests flaky.

- In lecturer Test 9 I want to click a button three times in a row. Originally I did this:
  
  cy.get('#interaction-first-block').click()
  cy.get('#interaction-first-block').click()
  cy.get('#interaction-first-block').click()

  This solution seems simple but proved to be very flaky. I then tried two variants of this solution:

  1. cy.get('#interaction-first-block').click().click().click();

  2. Cypress._.times(3, () => cy.get("#interaction-first-block").click())

  3. for(let n = 0; n < 3; n ++){
      cy.get('#interaction-first-block').click();
    };
  
  Cypress._.times comes from a, in Cypress included, library called lodash. All three variants had the same flakiness so
  in the end I just called each click by the text that was written in the button:

  cy.findByText('Ersten Block starten').click()
  cy.findByText('Block schliessen').click()
  cy.findByText('Nächsten Block starten').click()

  Learnings: There are a few moments in a test where you have to settle for the "ugly" solution. Just accept it.
