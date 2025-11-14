# Serena Memory Files - AI Agent Context

This directory contains curated documentation for AI agents working on the KlickerUZH codebase. These files provide high-level guidelines, architectural principles, and development patterns without implementation details that change frequently.

## Philosophy

These memory files are designed to:
- **Focus on principles** rather than specific implementation details
- **Provide context** about architectural decisions and their rationale
- **Guide development** with established patterns and conventions
- **Remain stable** over time by avoiding code snippets and file paths
- **Enable AI agents** to work effectively with minimal up-to-date information

## Memory File Organization

### Core Architecture & Overview

**project_overview.md**
- High-level project purpose and architecture
- Core applications and their roles
- Shared packages organization
- Technology foundation overview
- Local development environment philosophy

**project_structure.md**
- Architectural philosophy and domain-driven design
- Domain separation principles
- Modularity patterns and integration strategies
- Quality and consistency patterns
- Educational platform considerations

**tech_stack.md**
- Technology selection principles and rationale
- Frontend, backend, and AI technology strategies
- Development tooling philosophy
- Deployment and operations strategy
- Security and privacy considerations

### Development Guidelines

**development_patterns.md**
- GraphQL-first API design patterns
- Database-first development approach
- Component architecture patterns
- Testing patterns and strategies
- Permission and security patterns
- Error handling and state management

**code_style_conventions.md**
- TypeScript and React conventions
- Styling and design system usage
- Code formatting standards
- Documentation requirements
- Git workflow conventions
- Quality standards and enforcement

**task_completion_guidelines.md**
- Task completion philosophy
- Code quality validation principles
- Testing requirements
- Database change protocol
- Documentation requirements
- Quality standards

### Infrastructure & Operations

**local_development_setup.md**
- Development architecture and production parity
- Service architecture and domain strategy
- Platform support and certificate management
- Configuration management approach
- Development modes and workflows

**command_patterns.md**
- Command structure and discovery strategy
- Development workflow patterns
- Database management principles
- Package operations and targeting
- Release management and versioning
- Platform considerations

**deployment_infrastructure.md**
- Deployment philosophy for educational platforms
- Containerization and orchestration strategy
- Environment management and scaling
- Security and compliance patterns
- Monitoring and disaster recovery

**ci_cd_pipelines.md**
- Pipeline architecture and workflow categories
- Quality assurance and testing workflows
- Deployment strategies by environment
- Container registry and tagging strategy
- Quality gates and monitoring

**workflow_orchestration.md**
- Hatchet platform integration and architecture
- Workflow patterns for async processing
- Deployment architecture by environment
- Configuration management and monitoring
- Migration strategy and future roadmap

### Domain-Specific Guidance

**graphql_patterns.md**
- Operation naming conventions and organization
- Query, mutation, and subscription patterns
- Fragment strategy and reuse
- Schema organization and type system
- Client integration and type safety
- Performance and security considerations

**authentication_security.md**
- Authentication methods (Edu-ID, Magic Link, LTI, etc.)
- User roles and permission levels
- Permission system architecture
- Catalog sharing and access control
- Security patterns and best practices

**testing_strategy.md**
- Testing philosophy and layers (E2E, unit, integration)
- Test environment philosophy
- Test data strategy and coverage goals
- Quality gates and execution patterns
- Test maintenance and reliability

**chat_application.md**
- AI integration architecture and design decisions
- System integration patterns
- Security and control mechanisms
- Architectural boundaries and scalability
- Future evolution pathways

## Using These Memories

### For AI Agents

**Before starting work:**
1. Read **project_overview.md** for context
2. Review **tech_stack.md** to understand technology choices
3. Check **development_patterns.md** for coding patterns
4. Reference domain-specific files as needed

**When making changes:**
1. Follow **code_style_conventions.md**
2. Apply patterns from **development_patterns.md**
3. Complete tasks according to **task_completion_guidelines.md**
4. Test following **testing_strategy.md**

**When uncertain:**
- These files provide **principles and patterns**, not specific commands
- Refer to actual codebase files (package.json, turbo.json, etc.) for current specifics
- Documentation files are intentionally high-level to remain stable

### Maintenance Guidelines

**When updating memories:**
- Focus on **why** and **principles**, not **how** and **specifics**
- Avoid code snippets (they become outdated quickly)
- Avoid directory trees (structure changes frequently)
- Avoid specific commands (they vary by environment)
- Avoid exact URLs or paths (they change)
- Include **rationale** for architectural decisions
- Document **patterns**, not implementations

**What belongs in memories:**
- Architectural principles and philosophy
- Technology selection rationale
- Development patterns and conventions
- Testing strategy and quality standards
- Deployment principles and strategies
- Security and permission models (concepts)

**What does NOT belong in memories:**
- Specific commands or scripts
- Code snippets or examples
- Directory structures or file listings
- Exact configuration values
- Specific URLs or ports
- Implementation details that change

## Memory File Status

### Current Files (16 total)

✅ **Stable principle-based files:**
- authentication_security.md
- chat_application.md
- ci_cd_pipelines.md
- code_style_conventions.md *(updated: removed code snippets)*
- command_patterns.md *(new: replaced suggested_commands.md)*
- deployment_infrastructure.md
- development_patterns.md
- graphql_patterns.md *(new: replaced graphql_operations.md)*
- local_development_setup.md
- project_overview.md
- project_structure.md
- task_completion_guidelines.md *(new: replaced task_completion_checklist.md)*
- tech_stack.md
- testing_strategy.md *(new: replaced testing_infrastructure.md)*
- workflow_orchestration.md

### Changes Made (November 2025)

**Removed (contained implementation details):**
- ❌ task_completion_checklist.md → replaced with task_completion_guidelines.md
- ❌ suggested_commands.md → replaced with command_patterns.md
- ❌ graphql_operations.md → replaced with graphql_patterns.md
- ❌ testing_infrastructure.md → replaced with testing_strategy.md

**Updated:**
- ✏️ code_style_conventions.md - removed code snippet example

**Created:**
- ✨ task_completion_guidelines.md - principle-based completion guidelines
- ✨ command_patterns.md - command discovery and patterns
- ✨ graphql_patterns.md - GraphQL conventions without code
- ✨ testing_strategy.md - testing approach without specific commands
- ✨ README.md (this file) - memory file organization and usage

## Consistency Checklist

When reviewing or updating memory files, ensure:

- [ ] No code snippets or implementation examples
- [ ] No directory trees or file listings
- [ ] No specific commands or scripts
- [ ] No hardcoded URLs, ports, or paths
- [ ] Focus on principles and rationale
- [ ] Explain "why" decisions were made
- [ ] Document patterns, not specifics
- [ ] Remain relevant as code evolves
- [ ] Consistent tone and structure
- [ ] Cross-references to other memory files where appropriate

## Future Considerations

**Potential additions:**
- Performance optimization principles
- Accessibility guidelines and patterns
- Internationalization strategy
- API versioning and evolution strategy
- Database optimization patterns
- Error handling and logging strategy

**Continuous improvement:**
- Review memories quarterly for relevance
- Update based on significant architectural changes
- Consolidate overlapping information
- Remove truly obsolete information
- Maintain focus on stable principles

---

**Last Updated:** November 2025
**Purpose:** Provide stable, principle-based context for AI agents working on KlickerUZH
