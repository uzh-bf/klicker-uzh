-- Competence-tree ownership transfers are operational account-closure events.
-- Keep the value internal until generic sharing supports competence trees.
ALTER TYPE "ObjectType" ADD VALUE IF NOT EXISTS 'COMPETENCE_TREE';
