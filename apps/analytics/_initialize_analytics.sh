#!/usr/bin/env bash
# Shared analytics-pipeline runner. Pick the target via the first argument:
#   ./_initialize_analytics.sh         -> local dev (pnpm run script)
#   ./_initialize_analytics.sh qa      -> staging   (pnpm run script:qa)
#   ./_initialize_analytics.sh prd     -> prod      (pnpm run script:prod)
#
# The script module list is the single source of truth — keeping it here avoids
# drift between the three historical _initialize_analytics_*.sh files.
set -euo pipefail

TARGET="${1:-dev}"
case "$TARGET" in
  dev)  PNPM_SCRIPT="script" ;;
  qa)   PNPM_SCRIPT="script:qa" ;;
  prd)  PNPM_SCRIPT="script:prod" ;;
  *)    echo "Unknown target: $TARGET (expected: dev | qa | prd)" >&2; exit 64 ;;
esac

SCRIPTS=(
  src.scripts.0_initial_participant_analytics
  src.scripts.1_initial_aggregated_analytics
  src.scripts.2_initial_aggregated_course_analytics
  src.scripts.3_initial_instance_activity_performance
  src.scripts.4_initial_participant_performance
  src.scripts.5_initial_participant_course_analytics
  src.scripts.6_initial_activity_progress
  src.scripts.7_participant_activity_performance
  src.scripts.8_initial_chat_analytics
  src.scripts.9_initial_aggregated_chatbot_analytics
  src.scripts.13_platform_semester_analytics
  src.scripts.14_live_quiz_assessment_analytics
  src.scripts.10_chat_topic_clustering
  src.scripts.11_chat_quiz_correlation
  src.scripts.99_mark_analytics_valid
)

for module in "${SCRIPTS[@]}"; do
  pnpm run "$PNPM_SCRIPT" "$module"
done
