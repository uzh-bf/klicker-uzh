# 2. Message feedback is a nullable field on `ChatMessage`, mirrored to Langfuse

Thumbs up/down on an assistant answer is stored as a single nullable `rating` column on `ChatMessage` (`ChatMessageRating`), not as a separate feedback table, and the same vote is mirrored to Langfuse as a score.

A table would buy a vote history and room for free-text comments; a column buys an additive migration, no join on the read path that renders a thread, and an obvious representation for "no vote" and "vote retracted" (null). Only the current opinion is actually useful for the product question this feature exists to answer — is this chatbot's answer quality acceptable — and Langfuse already owns the analytical view, so the history argument does not pay for the extra table.

The consequence to accept: we cannot tell later that a student changed their mind, and adding comments means a migration to a table after all.
