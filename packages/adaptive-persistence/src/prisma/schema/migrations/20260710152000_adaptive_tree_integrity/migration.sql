-- Composite keys support same-tree foreign keys for hierarchical references.
-- The original single-column foreign keys intentionally remain because Prisma
-- models those relations for client navigation. These composite constraints add
-- tree identity at the database boundary; integration tests cover the layering.
CREATE UNIQUE INDEX "ctl_tree_id_key"
ON "CompetenceTreeLevel" ("treeId", "id");

CREATE UNIQUE INDEX "ctn_tree_id_key"
ON "CompetenceTreeNode" ("treeId", "id");

ALTER TABLE "CompetenceTreeNode"
ADD CONSTRAINT "ctn_parent_same_tree_fkey"
FOREIGN KEY ("treeId", "parentId")
REFERENCES "CompetenceTreeNode" ("treeId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompetenceTreeLeafLevelCoverage"
ADD CONSTRAINT "ctlc_leaf_same_tree_fkey"
FOREIGN KEY ("treeId", "leafNodeId")
REFERENCES "CompetenceTreeNode" ("treeId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompetenceTreeLeafLevelCoverage"
ADD CONSTRAINT "ctlc_level_same_tree_fkey"
FOREIGN KEY ("treeId", "levelId")
REFERENCES "CompetenceTreeLevel" ("treeId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompetenceTreeElementAssignment"
ADD CONSTRAINT "ctea_leaf_same_tree_fkey"
FOREIGN KEY ("treeId", "leafNodeId")
REFERENCES "CompetenceTreeNode" ("treeId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompetenceTreeElementAssignment"
ADD CONSTRAINT "ctea_level_same_tree_fkey"
FOREIGN KEY ("treeId", "levelId")
REFERENCES "CompetenceTreeLevel" ("treeId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- The original migration already enforces one NULL-node estimate per kind.
-- Constrain which kinds may use a NULL node.
ALTER TABLE "AdaptivePracticeQuizEstimate"
ADD CONSTRAINT "apqe_node_kind_node_check"
CHECK (
  ("nodeKind" = 'OVERALL' AND "nodeId" IS NULL)
  OR
  ("nodeKind" IN ('COMPETENCE', 'SUBCOMPETENCE') AND "nodeId" IS NOT NULL)
);
