-- CreateTable
CREATE TABLE "permission_grants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resource_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "principal_user_id" TEXT,
    "principal_group_id" TEXT,
    "level" TEXT NOT NULL,
    "granted_by_user_id" TEXT NOT NULL,
    "granted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derived_from_grant_id" TEXT,
    "scope" TEXT,
    "propagate_to_object" BOOLEAN,
    "propagate_object_level" TEXT,
    CONSTRAINT "permission_grants_derived_from_grant_id_fkey" FOREIGN KEY ("derived_from_grant_id") REFERENCES "permission_grants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "permission_grants_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "permission_grants_principal_user_id_fkey" FOREIGN KEY ("principal_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "permission_grants_principal_group_id_fkey" FOREIGN KEY ("principal_group_id") REFERENCES "user_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "user_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "group_memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_by_user_id" TEXT NOT NULL,
    "added_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "group_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "group_memberships_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action_type" TEXT NOT NULL,
    "performed_by_user_id" TEXT NOT NULL,
    "resource_id" TEXT,
    "resource_type" TEXT,
    "details" TEXT,
    CONSTRAINT "audit_logs_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "elements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "explanation" TEXT,
    "owner_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "elements_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "activity_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ActivityToElement" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ActivityToElement_A_fkey" FOREIGN KEY ("A") REFERENCES "activities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ActivityToElement_B_fkey" FOREIGN KEY ("B") REFERENCES "elements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "group_memberships_group_id_idx" ON "group_memberships"("group_id");

-- CreateIndex
CREATE INDEX "group_memberships_user_id_idx" ON "group_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_memberships_group_id_user_id_key" ON "group_memberships"("group_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "_ActivityToElement_AB_unique" ON "_ActivityToElement"("A", "B");

-- CreateIndex
CREATE INDEX "_ActivityToElement_B_index" ON "_ActivityToElement"("B");
