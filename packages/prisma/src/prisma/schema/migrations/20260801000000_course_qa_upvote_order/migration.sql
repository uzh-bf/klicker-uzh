-- Support deterministic upvote-ordered discussion thread pages.
CREATE INDEX "DiscussionThread_scopeId_upvotes_lastActivityAt_id_idx"
ON "DiscussionThread"("scopeId", "upvotes", "lastActivityAt", "id");
