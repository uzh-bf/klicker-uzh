-- Minimum questions per subcompetence may be 0: on large trees a minimum of 1
-- or more cannot be met within the question cap (subcompetences × minimum
-- exceeds the questions per competence), so attempts never stop early. With 0
-- the quiz asks where the estimate needs evidence. The other bounds are
-- unchanged.

-- AlterCheckConstraint
ALTER TABLE "PracticeQuizAdaptiveConfig" DROP CONSTRAINT pqac_numeric_bounds_check;
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD CONSTRAINT pqac_numeric_bounds_check CHECK (((("totalQuestionCap" >= 1) AND ("totalQuestionCap" <= 1000)) AND (("perLeafQuestionCap" IS NULL) OR (("perLeafQuestionCap" >= 1) AND ("perLeafQuestionCap" <= "totalQuestionCap"))) AND (("minQuestionsPerLeaf" >= 0) AND ("minQuestionsPerLeaf" <= "totalQuestionCap")) AND ("classificationZ" > (0)::double precision) AND ("classificationZ" <= (5)::double precision) AND ("topInformationRatio" > (0)::double precision) AND ("topInformationRatio" <= (1)::double precision) AND ("defaultDiscrimination" > (0)::double precision) AND ("defaultDiscrimination" <= (10)::double precision)));
