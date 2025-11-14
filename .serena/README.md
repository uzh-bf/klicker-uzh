# Serena Memory Files - AI Agent Context

Curated documentation for AI agents working on KlickerUZH. Provides principles, patterns, and architectural context without implementation details that change frequently.

## Structure (6 Files)

### 1. START_HERE.md
**Read this first.**
- Project purpose and quick context
- Technology stack overview
- Architecture at a glance
- Critical facts for AI agents

### 2. CONVENTIONS.md
**Code style rules.**
- TypeScript, React, Next.js conventions
- Naming patterns and file organization
- GraphQL operation conventions
- Testing conventions
- Git workflow standards

### 3. PATTERNS.md
**Common workflows.**
- GraphQL operation patterns (queries, mutations, subscriptions, fragments)
- Database modification workflow
- Permission system patterns
- State management patterns
- Component architecture patterns
- Error handling patterns

### 4. ARCHITECTURE.md
**System design decisions.**
- Why GraphQL? Why Hatchet? Why microservices?
- Service architecture and data flow
- Real-time communication patterns
- State management approach
- Technology selection rationale

### 5. DEVELOPMENT.md
**Setup and daily workflow.**
- Prerequisites and first-time setup
- Development modes (offline, full stack, single app)
- Database management (migrations, seeding, studio)
- Testing (unit, E2E)
- Troubleshooting common issues
- Environment variables reference

### 6. REFERENCE.md
**Deep-dive topics.**
- Authentication methods (5 types)
- Permission system (roles, levels, scopes)
- Database architecture (schema organization)
- Redis architecture (3 instances)
- Workflow orchestration (Hatchet)
- Deployment (Docker, Kubernetes, Helm)
- CI/CD pipelines
- Chat/AI integration
- Test data and default accounts

## Design Philosophy

**Consolidated from 16 files to 6 files (84% size reduction):**
- **Prescriptive not descriptive**: Tell AI what to do, not why choices were made historically
- **Bullets not prose**: Faster parsing, lower token usage
- **Facts not philosophy**: Remove educational evangelism
- **Assume AI knowledge**: Don't explain TypeScript basics
- **Actionable only**: If it doesn't change AI behavior, remove it

**What these files contain:**
- Conventions and patterns AI agents must follow
- Architectural decisions that constrain implementation
- Workflows for common development tasks
- Critical system knowledge (auth, permissions, deployment)

**What these files do NOT contain:**
- Code snippets (become outdated)
- Directory trees (change frequently)
- Specific commands (vary by environment)
- URLs/ports (configuration-specific)
- Technology justifications (assume AI competence)

## Usage for AI Agents

**Before starting work:**
1. Read START_HERE.md for context
2. Scan CONVENTIONS.md for code rules
3. Reference PATTERNS.md for common workflows

**During development:**
- Follow CONVENTIONS.md strictly
- Apply patterns from PATTERNS.md
- Check ARCHITECTURE.md for design constraints
- Use DEVELOPMENT.md for setup/troubleshooting
- Reference REFERENCE.md for deep topics

**When uncertain:**
- These provide principles, not commands
- Check actual codebase (package.json, turbo.json) for current specifics
- Memories are intentionally high-level to remain stable

## Maintenance

**Update memories when:**
- Major architectural changes occur
- New conventions are established
- Development workflows change significantly
- New domains are added (e.g., new authentication method)

**Never include:**
- Code snippets or examples
- Directory structures or file paths
- Specific commands (pnpm scripts)
- Configuration values
- Implementation details that change

**Always focus on:**
- Principles that guide decisions
- Patterns that repeat across features
- Constraints that shape implementation
- System knowledge that's stable over time

---

**Last Updated:** November 2025
**Structure:** 6 consolidated files (~14KB total, down from 90KB)
**Purpose:** Efficient, actionable context for AI agents
