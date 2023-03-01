-- CreateTable
CREATE TABLE "Level" (
    "id" SERIAL NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT,
    "requiredXp" INTEGER NOT NULL,
    "avatar" TEXT,
    "nextLevelIx" INTEGER,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Level_index_key" ON "Level"("index");

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_nextLevelIx_fkey" FOREIGN KEY ("nextLevelIx") REFERENCES "Level"("index") ON DELETE SET NULL ON UPDATE CASCADE;
