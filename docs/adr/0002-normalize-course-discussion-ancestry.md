# Normalize Course Discussion Ancestry

Course discussion rows use one canonical relational path: a space owns scopes, a scope owns threads, and a thread owns replies. Audit events belong to a scope and retain an event-type-specific scalar `subjectId` rather than foreign keys to mutable content, preserving historical identifiers after hard deletion without allowing conflicting space, scope, thread, and reply ancestry.
