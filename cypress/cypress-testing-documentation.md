# Testing documentation

## Tests for commit "Tests 1 to 5 work now"

All run in npm run dev and cypress v11

### With cypress desktop app

- Run 1: 5 of 5
- Run 2: 5 of 5
- Run 3: 4 of 5 -> 2 did not work
- Run 4: 5 of 5
- Run 5: 4 of 5 -> 2 did not work
- Run 6: 5 of 5
- Run 7: 3 of 5 -> 2, 5 did not work
- Run 8: 5 of 5
- Run 9: 5 of 5
- Run 10: 4 of 5 -> 2 did not work

#### Explanation for desktop app testing

Only test 2 seems flaky, while I don't understand the one time issue with test 5.
The issue with test 2 is that cypress doesn't find the name of the session on the new page.
Sometimes it doesn't even load the page properly. At first I would ignore this and revisit
the problem, once every test resets the database before running. That way, no other sessions
could hinder cypress from finding the one created in test 2.

### With headless mode

- Run 1: 5 of 5
- Run 2: 5 of 5
- Run 3: 5 of 5
- Run 4: 5 of 5
- Run 5: 5 of 5
- Run 6: 5 of 5
- Run 7: 5 of 5
- Run 8: 5 of 5
- Run 9: 4 of 5 -> 2 did not work
- Run 10: 5 of 5

#### Explanation headless mode testing

This seems much more promising. Again 2 failed once, but I would handle that still in the same
way as described above. Since headless mode will be the one ultimately used in the pipeline, this
looks good. The tests were run in chrome, except the first one which was run on Electron.
It only doesn't work on Firefox because of a pointer issue regarding the dropdown menu.

## Tests for commit "Tests 1 to 8 work now"

All run in npm run dev and cypress v11

### With cypress desktop app

I did not even bother to test this extensively, since every second or third run during the writing
of the test failed, since cypress didn't write the title of the question in the title field, which then
lead to writing the question itself into the title field. I don't know why this happens, but it only
seems to happen in the desktop app.

### With headless mode, running tests 6-8

- Run 1: 3 of 3 (17 sec, Electron)
- Run 2: 3 of 3 (42 sec)
- Run 3: 3 of 3 (44 sec)
- Run 4: 3 of 3 (42 sec)
- Run 5: 3 of 3 (42 sec)
- Run 6: 3 of 3 (42 sec)
- Run 7: 3 of 3 (44 sec)
- Run 8: 3 of 3 (42 sec)
- Run 9: 3 of 3 (19 sec, Electron)
- Run 10: 3 of 3 (17 sec, Electron)

#### Explanation headless mode testing, running tests 6-8

Again tests were run on Chrome, but Electron seems to work as well. The difference in speed is
immense.

### With headless mode, running tests 1-8 for speed comparison

- Run 1: 7 of 8 (44 sec, Electron, Test 5 failed)
- Run 2: 7 of 8 (44 sec Electron, Test 5 failed)
- Run 3: 7 of 8 (1 min 29 sec, Test 5 failed)

At this point I was not happy about Test 5 (Multiple Choice), because it worked the day before.
Headless mode provides you with a video of the tests that have been run which helped me to fix the issue
with the test (I had removed some answer options to make the test smaller but forgot to delete one
line). So props to the video feature! Now here we go again:

- Run 1: 8 of 8 (37 sec, Electron)
- Run 2: 8 of 8 (37 sec Electron)
- Run 3: 8 of 8 (1 min 15 sec, Chrome)
- Run 4: 8 of 8 (1 min 16 sec, Chrome)

#### Conclusion

All tests run consistently in headless mode, with Electron running the tests much faster than Chrome.
Firefox still doesn't work, problem for later. Videos provided by Cypress for every test suite are
very useful and a huge plus.

## Update to Cypress version 12

Originally this broke the tests, but in order to be able to visit multiple websites in one test
version 12 is necessary (cy.origin() command). After updating and running all tests multiple times
the issue with this version could not be recreated. Everything runs smoothly (not a single test failed in all runs)
in headless mode on Chrome and Electron as well as in the Desktop app.

## TODO:Test 9 needs to be validated and extensively checked. Also all tests should be run with npm start for speed comparison.
