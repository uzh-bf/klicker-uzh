-- AlterTable
ALTER TABLE "Chatbot" ADD COLUMN     "knowledgeGraphRetrievalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "knowledgeGraphVisible" BOOLEAN NOT NULL DEFAULT true;
