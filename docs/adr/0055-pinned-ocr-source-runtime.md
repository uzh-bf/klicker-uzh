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
limitation. Upgrades remain explicit per repository. First publish and qualify
the source, then pin its actual merged revision in consumers. Release, caller
source, hosted offline and live acceptance remain distinct evidence layers.
