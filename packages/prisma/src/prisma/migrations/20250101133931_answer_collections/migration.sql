-- CreateEnum
CREATE TYPE "CollectionAccess" AS ENUM ('PUBLIC', 'PRIVATE', 'RESTRICTED');

-- CreateTable
CREATE TABLE "AnswerCollection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "access" "CollectionAccess" NOT NULL DEFAULT 'PRIVATE',
    "ownerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerCollectionEntry" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "collectionId" INTEGER NOT NULL,

    CONSTRAINT "AnswerCollectionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_answerCollectionAccessRequested" (
    "A" INTEGER NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_answerCollectionAccessRequested_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_answerCollectionShared" (
    "A" INTEGER NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_answerCollectionShared_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnswerCollection_ownerId_name_key" ON "AnswerCollection"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerCollectionEntry_collectionId_value_key" ON "AnswerCollectionEntry"("collectionId", "value");

-- CreateIndex
CREATE INDEX "_answerCollectionAccessRequested_B_index" ON "_answerCollectionAccessRequested"("B");

-- CreateIndex
CREATE INDEX "_answerCollectionShared_B_index" ON "_answerCollectionShared"("B");

-- AddForeignKey
ALTER TABLE "AnswerCollection" ADD CONSTRAINT "AnswerCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "AnswerCollectionEntry" ADD CONSTRAINT "AnswerCollectionEntry_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_answerCollectionAccessRequested" ADD CONSTRAINT "_answerCollectionAccessRequested_A_fkey" FOREIGN KEY ("A") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_answerCollectionAccessRequested" ADD CONSTRAINT "_answerCollectionAccessRequested_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_answerCollectionShared" ADD CONSTRAINT "_answerCollectionShared_A_fkey" FOREIGN KEY ("A") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_answerCollectionShared" ADD CONSTRAINT "_answerCollectionShared_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
