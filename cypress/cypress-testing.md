# Testing documentation

## Tests for commit "Tests 1 to 5 work now"

### With cypress desktop app

- Test 1: 5 of 5
- Test 2: 5 of 5
- Test 3: 4 of 5 -> 2 did not work
- Test 4: 5 of 5
- Test 5: 4 of 5 -> 2 did not work
- Test 6: 5 of 5
- Test 7: 3 of 5 -> 2, 5 did not work
- Test 8: 5 of 5
- Test 9: 5 of 5
- Test 10: 4 of 5 -> 2 did not work

#### Explanation for desktop app testing

Only test 2 seems flaky, while I don't understand the one time issue with test 5.
The issue with test 2 is that cypress doesn't find the name of the session on the new page.
Sometimes it doesn't even load the page properly. At first I would ignore this and revisit
the problem, once every test resets the database before running. That way, no other sessions
could hinder cypress from finding the one created in test 2.

### With headless mode

- Test 1: 5 of 5
- Test 2: 5 of 5
- Test 3: 5 of 5
- Test 4: 5 of 5
- Test 5: 5 of 5
- Test 6: 5 of 5
- Test 7: 5 of 5
- Test 8: 5 of 5
- Test 9: 4 of 5 -> 2 did not work
- Test 10: 5 of 5

#### Explanation headless mode testing

This seems much more promising. Again 2 failed once, but I would handle that still in the same
way as described above. Since headless mode will be the one ultimately used in the pipeline, this
looks good.
