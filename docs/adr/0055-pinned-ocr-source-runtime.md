# Distribute the OCR runtime through immutable source releases

Repeated OCR adoption copies controller steps and behavioral tests while already
sharing a pinned engine. Those copies drift across repositories and obscure
whether source verification established equivalent review behavior.

Keep one standalone runtime in the public donor repository and distribute its
GitHub composite action through complete commit pins. Bind its runtime assets,
portable reviewer skill, draft CLI/publisher and separate patched-final installer
in a release manifest. Keep repository context settings narrow and read them at
one trusted frozen policy revision. The run records the enclosing source ref
separately from the manifest digest.

Repository-owned workflows retain events, activation, permissions, runners,
timeouts and concurrency. The action owns repeated draft orchestration and
validated publication. Final-review admission stays with its existing controller.
Native GitLab needs its own trusted execution and publisher qualification against
the shared contracts. Neither a copied workflow nor a CI include establishes
that trust boundary.

This avoids introducing a hosted controller, registry, image release pipeline
or mutable central settings before source distribution has a demonstrated
limitation. Upgrades remain explicit per repository. A donor runtime change and
its caller adoption normally share one PR: commit the complete runtime, then pin
that full commit in a later caller commit. Before merge, verify both releases and
require the final candidate's manifest and runtime assets to match the pin. Any
subsequent runtime change needs a new runtime commit and an updated caller pin.

The pinned commit belongs to the action's repository and must be retrievable by
its exact SHA, including after a squash merge or branch deletion. Ordinary CI
fetches it explicitly before offline qualification; a complete default-branch
checkout alone may not contain it. After merge, verify runtime parity and pin
availability again. A squash hash need not replace the qualified source pin.
Separate adoption PRs remain useful for independent adopter releases, rather
than a requirement for each donor fix. Release, caller source, hosted offline and
live acceptance remain distinct evidence layers.
