-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_level_fkey" FOREIGN KEY ("level") REFERENCES "Level"("index") ON DELETE RESTRICT ON UPDATE CASCADE;
