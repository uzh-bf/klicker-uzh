# Improving Gamification in KlickerUZH

## Context

KlickerUZH has a multi-layered gamification system (points, XP, levels, leaderboards, achievements, groups), but students are rarely motivated by it. This document analyzes the current system, identifies structural weaknesses based on research evidence, and proposes concrete improvements both inside the platform and in how lecturers deploy gamification pedagogically.

---

## Part 1: Current Gamification System Overview

### What Exists Today

| Element | Description | Key Files |
|---------|-------------|-----------|
| **Points** | Earned per response. Live quizzes: base + correctness + time-bonus. Async: simple percentage-based. Multipliers 1-4x per activity. | `packages/grading/src/index.ts:258-401` |
| **XP** | Binary: 10 XP if 100% correct, 0 otherwise. Feeds level progression. | `packages/grading/src/index.ts:392-401` |
| **Levels** | 11 levels, quadratic XP curve. Avatar unlocked per level. | `packages/util/src/levels.ts`, `packages/prisma/src/prisma/schema/gamification.prisma:153-169` |
| **Leaderboard** | Course-wide and session-level. Multiple time windows (rolling, weekly, custom). Opt-in. Top 10 + self shown. | `packages/graphql/src/services/courses.ts`, `packages/shared-components/src/Leaderboard.tsx` |
| **Achievements** | ~11 predefined badges (Explorer, Busy Bee, Champion, etc.). Awarded for placement, completion, group work. | `packages/prisma/src/prisma/schema/gamification.prisma:1-117`, `packages/graphql/src/services/liveQuizzes.ts` |
| **Groups** | Group leaderboard based on groupActivityScore + averageMemberScore. Group achievements for activity completion. | `packages/graphql/src/services/groups.ts` |
| **Timeline** | Daily/weekly aggregation of points/XP per course for trend views. | `packages/graphql/src/services/participants.ts:859-959` |
| **Podium** | Visual top-3 display during live quizzes with rank images. | `packages/shared-components/src/Podium.tsx` |

### How Students Experience It

1. **During live quizzes**: Real-time leaderboard with score deltas per block. Podium for top 3. Points visible immediately.
2. **Profile page**: XP bar, level badge, earned achievements (colored) and possible achievements (greyed out).
3. **Course page**: Leaderboard tab (locked for non-participants). Group leaderboard if groups enabled.
4. **Between sessions**: No push notifications, no streaks, no reminders, no progress nudges.

### Technical Details

**XP Calculation** (`packages/grading/src/index.ts`):
- `computeAwardedXp()`: Awards exactly 10 XP if `pointsPercentage === 1` (100% correct), otherwise 0.

**Level Progression** (`packages/util/src/levels.ts`):
- Quadratic formula: `xpForLevel(level) = (3000/2) * level^2 + 3000 * 1.5 * level - 3000 * 2`
- 11 levels total, each with a unique avatar SVG.

**Points Calculation** (`packages/grading/src/index.ts`):
- Live quizzes: `basePoints + correctnessPoints + bonusPoints` where bonus decays linearly from `maxBonus` to 0 over `timeToZeroBonus` seconds.
- Async activities: `points * pointsPercentage * pointsMultiplier`.

**Achievement Awards**: Triggered during live quiz finalization (top 3 placement) and at specific lifecycle events (course completion, group activity submission).

---

## Part 2: Why Students Are Rarely Motivated — Root Cause Analysis

### Problem 1: XP System Is Too Binary and Unrewarding
- XP is all-or-nothing: **10 XP for 100% correct, 0 otherwise** (`computeAwardedXp()` at `packages/grading/src/index.ts:392-401`).
- Partial credit gives zero XP. A student who gets 90% correct on a hard MC question earns the same XP (0) as someone who didn't try.
- This violates Self-Determination Theory's (SDT) **competence** need — students don't feel progress from near-misses.
- The level curve is quadratic, so early levels come fast but later ones feel impossible without mass participation.

### Problem 2: Achievements Are Static and Few
- Only ~11 achievements, most tied to placement (top 3) or completion (all microlearnings done).
- No progressive/repeatable achievements (e.g., "answered 10 questions", "answered 50 questions").
- No course-specific or topic-specific achievements.
- Some achievements have placeholder descriptions, suggesting the system is underutilized.
- No visual ceremony or notification when an achievement is earned — they just appear on the profile.

### Problem 3: Leaderboard Primarily Motivates Top Performers
- Research consistently shows leaderboards demotivate students at the bottom ([PMC/JMIR 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8097522/)).
- KlickerUZH shows top 10 + self position, which is better than showing everyone, but students in the middle/bottom see a large gap to the top with no clear path to close it.
- No "top movers" or "most improved" mechanic — only absolute score matters.
- Leaderboard creates a disconnect between effort and visible result for most students.

### Problem 4: No Engagement Loop Between Sessions
- No streaks, daily challenges, or push notifications.
- Students have no reason to open the app between live lectures.
- Practice quizzes and microlearnings exist but have no gamified pull (no streak bonus, no daily XP goals).
- The timeline tracking (daily/weekly aggregation) exists in the DB but is barely surfaced to students.

### Problem 5: No Autonomy or Personalization
- Students cannot choose goals, customize challenges, or select which achievements to pursue.
- The avatar system (level-based avatars) offers only level-unlocked variants — no player agency.
- No choice of learning path or difficulty — everyone gets the same point structure.
- SDT research shows **autonomy** is critical for sustained intrinsic motivation ([Springer 2024](https://link.springer.com/article/10.1007/s11423-023-10337-7)).

### Problem 6: Novelty Effect Wears Off
- Research warns that gamification's motivational effects decline with prolonged exposure ([PMC 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10448467/)).
- KlickerUZH's gamification is static — the same elements throughout the semester.
- No seasonal events, time-limited challenges, or evolving content to refresh engagement.

### Problem 7: Weak Social/Relatedness Features
- Groups exist but are limited to group activities.
- No peer challenges, friend systems, or social recognition beyond the leaderboard.
- SDT's **relatedness** need is underserved — gamification feels like a solo competition against a board.

---

## Part 3: Proposed Improvements Inside KlickerUZH

### 3.1 Fix the XP System (High Impact, Low Effort)

**Current**: 10 XP if 100% correct, else 0.
**Proposed**: Graduated XP based on correctness percentage.

```
XP = floor(10 * pointsPercentage)  // 0-10 XP per question
+ bonus 5 XP for 100% correct      // reward mastery
```

- A student with 70% correctness earns 7 XP instead of 0.
- A perfect answer earns 15 XP (10 base + 5 bonus).
- This single change makes every answer feel meaningful.

**Files to modify:**
- `packages/grading/src/index.ts` — `computeAwardedXp()` function
- Tests in `packages/grading/src/__tests__/`

### 3.2 Add Streak Mechanics (High Impact, Moderate Effort)

Add a daily activity streak system modeled on [Duolingo's proven approach](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo):

- **Daily streak**: Consecutive days with at least one answered question (any activity type).
- **Streak multiplier**: After 3-day streak -> 1.5x XP; 7-day -> 2x XP; 14-day -> 2.5x XP.
- **Streak freeze**: Allow 1 "day off" per week without breaking the streak (reduces anxiety, per [Mind the Product guidance](https://www.mindtheproduct.com/designing-streaks-for-long-term-user-growth/)).
- **Visual streak counter**: Prominent display on profile and course page.

**Database changes:**
- Add to `Participation` model: `currentStreak`, `longestStreak`, `lastActiveDate`, `streakFreezeAvailable`

**Files to modify:**
- `packages/prisma/src/prisma/schema/participant.prisma` — add streak fields
- `packages/grading/src/index.ts` — apply streak multiplier
- `apps/frontend-pwa/` — display streak on profile and course views

### 3.3 Expand the Achievement System (High Impact, High Effort)

Add progressive, repeatable, and varied achievements:

- **Participation milestones**: "Answer 10/25/50/100/250 questions" (bronze/silver/gold tiers).
- **Streak achievements**: "Maintain a 7/14/30-day streak".
- **Improvement achievements**: "Improve your score by 20% over 2 weeks".
- **Subject mastery**: "Get 100% on 5 questions in a row" (per topic if tags exist).
- **Social achievements**: "Be in the top 10 for a week", "Help your group rank up".
- **Consistency awards**: "Participate in every live quiz this month".

Introduce achievement **tiers** (Bronze/Silver/Gold) so students always have the next goal in sight.

**Files to modify:**
- `packages/prisma/src/prisma/schema/gamification.prisma` — add tier field to Achievement model
- `packages/prisma-data/src/data/` — seed new achievements
- `packages/graphql/src/services/participants.ts` — achievement check logic
- `apps/frontend-pwa/` — tiered achievement display

### 3.4 Improve Leaderboard Design (Medium Impact, Moderate Effort)

Based on [leaderboard design research](https://pmc.ncbi.nlm.nih.gov/articles/PMC8097522/):

- **Add "Top Movers" view**: Show who gained the most points this week, not just who has the most total. Rewards recent effort over cumulative advantage.
- **Add relative leaderboard**: Show +/-2 positions around the student, not just top 10. Gives everyone a "rival" to chase.
- **Add percentile display**: "You're in the top 30% of the class" — motivating without revealing exact low ranks.
- **Course leaderboard periodic reset option**: Periodic resets give everyone a fresh start and reduce the "I'm too far behind" effect.

**Files to modify:**
- `packages/shared-components/src/Leaderboard.tsx` — add relative/percentile mode
- `packages/graphql/src/services/courses.ts` — add "top movers" query logic
- `apps/frontend-pwa/` — leaderboard mode selector

### 3.5 Surface Progress and Feedback Between Sessions (Medium Impact, Moderate Effort)

- **Weekly progress summary**: Show students their weekly stats (questions answered, XP earned, rank change, streak status) on the course page. Data already exists in `TimelineEntry`.
- **Progress visualization**: Chart or sparkline showing XP over time (the timeline data is already collected but not shown to students).
- **Next-level preview**: Show "You need X more XP for Level N" with a progress bar.

**Files to modify:**
- `apps/frontend-pwa/` — add progress summary section to profile and course views
- `packages/graphql/src/graphql/ops/` — new query for timeline data

### 3.6 Add Micro-Challenges / Daily Quests (High Impact, High Effort)

- **Daily challenge**: "Answer 3 questions today" -> bonus XP.
- **Weekly challenge**: "Complete all microlearnings this week" -> bonus points + achievement.
- **Flash challenges**: Lecturer-triggered limited-time bonus opportunities.

This creates the engagement loop between sessions that is currently missing. Works synergistically with the streak system.

**Database changes:**
- New `Challenge` model with deadline, reward, and completion tracking.

### 3.7 Achievement Notification / Celebration (Low Effort, Medium Impact)

- Show a toast/modal when an achievement is earned (during live quiz or upon opening the app).
- Currently achievements appear silently on the profile — no dopamine hit.

**Files to modify:**
- `apps/frontend-pwa/` — add achievement notification component
- `packages/graphql/src/graphql/ops/` — subscription or polling for new achievements

---

## Part 4: Improvements Outside KlickerUZH (Pedagogical Recommendations)

These recommendations are for lecturers deploying gamification in their courses:

### 4.1 Frame Gamification Intentionally
- Introduce gamification at the start of the semester with clear explanations of what students earn, why it exists, and how it connects to learning.
- Research shows gamification works best when students understand its purpose ([TechTrends 2025](https://link.springer.com/article/10.1007/s11528-025-01056-2)).

### 4.2 Use Multipliers Strategically
- The 1-4x multiplier system already exists — lecturers should use higher multipliers for harder/more important content, not uniformly.
- This signals to students which material is high-priority and creates varied reward density.

### 4.3 Vary the Gamification Elements Over the Semester
- Start the semester with individual points/XP (low social pressure).
- Introduce the leaderboard after 2-3 weeks once students have a baseline.
- Add group challenges mid-semester to refresh engagement and add social mechanics.
- Run a "final sprint" with higher multipliers in the last weeks.
- This combats the novelty effect identified in research.

### 4.4 Connect Gamification to Real Outcomes
- Award small exam bonuses (0.25-0.5 grade points) for top leaderboard performers or achievement completers.
- Research shows gamification has stronger effects when tied to tangible outcomes ([MDPI 2025](https://www.mdpi.com/2227-7102/15/8/1054)).

### 4.5 Mix Competition and Collaboration
- Use individual leaderboards for live quizzes but group challenges for practice activities.
- [University of Waterloo guidance](https://uwaterloo.ca/centre-for-teaching-excellence/catalogs/tip-sheets/gamification-and-game-based-learning) recommends balancing both to avoid alienating competition-averse students.

### 4.6 Provide Narrative / Theming
- Lecturers could frame the course as a "quest" or "journey" with thematic milestones.
- Even simple narrative framing ("You are exploring the fundamentals of statistics") increases engagement according to gamification research.

### 4.7 Acknowledge Progress Publicly (Not Just Rankings)
- Mention top movers or streaks in lectures, not just "who has the most points."
- Celebrate class-wide milestones ("The class answered 1,000 questions this week!").

---

## Part 5: Priority Ranking for Implementation

| Priority | Change | Impact | Effort | Rationale |
|----------|--------|--------|--------|-----------|
| **P0** | Fix XP system (graduated XP) | High | Low | Single function change, removes biggest demotivator |
| **P1** | Achievement notifications/celebration | Medium | Low | Tiny UX addition, big psychological impact |
| **P1** | Surface weekly progress/timeline to students | Medium | Medium | Data already collected, just needs frontend |
| **P2** | Streak system | High | Medium | Proven engagement mechanic (Duolingo model) |
| **P2** | Expand achievements (tiers + milestones) | High | High | More goals = more sustained motivation |
| **P2** | Leaderboard improvements (relative, top movers, percentile) | Medium | Medium | Reduces demotivation for non-top students |
| **P3** | Daily/weekly challenges | High | High | Full feature build, but highest long-term value |

---

## Part 6: Research Sources

- [Gamification of e-learning in higher education: systematic review (PMC 2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9887250/)
- [Gamification effectiveness meta-analysis (Frontiers in Psychology 2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10591086/)
- [Gamification and academic success in HE (MDPI 2025)](https://www.mdpi.com/2227-7102/15/8/1054)
- [Gamification in STEM higher education (IJ STEM 2025)](https://stemeducationjournal.springeropen.com/articles/10.1186/s40594-024-00521-3)
- [Gamification case study in Educational Sciences (TechTrends 2025)](https://link.springer.com/article/10.1007/s11528-025-01056-2)
- [SDT and gamification: intrinsic motivation meta-analysis (Springer 2024)](https://link.springer.com/article/10.1007/s11423-023-10337-7)
- [Leaderboard design principles (JMIR 2021)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8097522/)
- [Gamification and game-based learning (University of Waterloo)](https://uwaterloo.ca/centre-for-teaching-excellence/catalogs/tip-sheets/gamification-and-game-based-learning)
- [Duolingo gamification case study (StriveCloud 2025)](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo)
- [Designing streaks for long-term user growth (Mind the Product)](https://www.mindtheproduct.com/designing-streaks-for-long-term-user-growth/)
- [Gamified learning motivation decline (PMC 2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10448467/)
- [Personality traits and gamification (Smart Learning Environments)](https://link.springer.com/article/10.1186/s40561-019-0098-x)
- [Unlocking student engagement via leaderboards (Springer 2024)](https://link.springer.com/article/10.1007/s10639-024-12845-2)
- [Streaks and milestones for gamification in mobile apps (Plotline)](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps)
