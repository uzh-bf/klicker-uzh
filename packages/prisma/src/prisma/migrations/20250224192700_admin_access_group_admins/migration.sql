-- AlterEnum
ALTER TYPE "AccessLevel" ADD VALUE 'EXECUTE';

-- CreateTable
CREATE TABLE "_UserGroupAdmins" (
    "A" UUID NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_UserGroupAdmins_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserGroupAdmins_B_index" ON "_UserGroupAdmins"("B");

-- AddForeignKey
ALTER TABLE "_UserGroupAdmins" ADD CONSTRAINT "_UserGroupAdmins_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserGroupAdmins" ADD CONSTRAINT "_UserGroupAdmins_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
