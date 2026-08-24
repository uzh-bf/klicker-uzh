-- Guard: ChatbotMode rows may only disappear through their owning chatbot
-- cascade. Direct deletion would erase immutable version lineage while the
-- chatbot (and its other modes) remain, so it is rejected. The guard allows
-- the delete when the owning chatbot row is itself being removed, matching
-- the version-delete guard pattern above (chatbot existence check).
CREATE FUNCTION "chatbot_mode_block_delete"() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Chatbot" c WHERE c."id" = OLD."chatbotId"
  ) THEN
    RAISE EXCEPTION 'direct ChatbotMode deletion is unsupported';
  END IF;
  RETURN OLD;
END;
$fn$;
CREATE TRIGGER "trg_chatbot_mode_no_direct_delete"
  BEFORE DELETE ON "ChatbotMode"
  FOR EACH ROW EXECUTE FUNCTION "chatbot_mode_block_delete"();
