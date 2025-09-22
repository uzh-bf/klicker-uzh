# Chatbot Disclaimer System Enhancement Plan

## Executive Summary

This plan outlines the implementation of a comprehensive disclaimer system for KlickerUZH chatbots. The system ensures students understand AI limitations, data protection requirements, and usage responsibilities before accessing chatbot functionality. It introduces server-side, versioned consent tracking that is enforced by the chat APIs, while providing flexibility for different courses and departments.

## Problem Statement

### Current State
- Students can immediately access chatbot functionality without understanding limitations
- No mechanism to inform users about data protection and AI accuracy concerns
- Lecturers cannot customize introductory content for their specific course context
- No way to track informed consent for chatbot usage
- A prototype disclaimer dialog exists client-side only (local storage/cookies) and is not enforced or persisted server-side; there is no version awareness

### Risks Without Disclaimer System
- Students may over-rely on AI-generated content without understanding limitations
- Compliance issues with data protection regulations
- Lack of transparency about data processing and storage
- No mechanism to update users when policies or capabilities change


## Proposed Solution

### Core Components

1. **Reusable, Versioned Disclaimer Templates**
   - Shared templates usable across multiple chatbots (institution/department/course scopes)
   - Immutable versions with content hash and publishing workflow
   - Assign a current version per chatbot; changes trigger re-acceptance

2. **Mandatory Acceptance Flow (Server-Enforced)**
   - Students must accept the currently assigned version before first chatbot use
   - Acceptance tracked per participant per chatbot and per disclaimer version
   - API guard blocks chat/threads/credits until acceptance (returns 428 Precondition Required)

3. **Flexible Content Management**
   - Fixed core content (AI limitations, data protection)
   - Customizable introduction and media content per disclaimer
   - Support for videos, images, and rich text



## User Stories

### As a Student
- I want to understand what the chatbot can and cannot do before using it
- I want to know how my data will be used and protected
- I want to make an informed decision about whether to use the chatbot
- I want the disclaimer process to be quick and clear

### As a Lecturer
- I want to provide course-specific context and instructions in the disclaimer
- I want to include relevant videos or images to explain the chatbot's purpose
- I want to ensure students understand the academic integrity expectations
- I want to reuse disclaimers across multiple chatbots in my course

### As a Department Administrator
- I want to create standard disclaimers that lecturers can use
- I want to ensure compliance with university data protection policies
- I want to track disclaimer acceptance rates and user engagement
- I want to update disclaimers when policies change and require re-acceptance

### As a System Administrator
- I want to ensure the system scales efficiently across the platform
- I want to prevent unauthorized chatbot access
- I want minimal impact on existing system performance

## Functional Requirements

### Disclaimer Management
- Create, edit, and delete disclaimer templates
- Publish immutable versions; assign current version to specific chatbots
- Support rich text formatting, images, and embedded videos
- Version control with content hashing; change tracking and re-acceptance flags
- Role-based access (department admins vs. lecturers) for template reuse

### Student Experience
- Blocking modal presentation after server indicates acceptance required
- Clear accept/decline options with consequences explained
- Responsive design for mobile and desktop
- Accessibility compliance (screen readers, keyboard navigation)
- Decline path shows a non-interactive information page and disables chat
- Server-side acceptance persists across devices/browsers

### Access Control
- Block chat functionality until disclaimer acceptance (server-side)
- API-level validation of disclaimer status across chat, threads, and credits endpoints
- Graceful handling of declined disclaimers
- Session persistence of acceptance status, with revalidation against server on load
- When acceptance missing/outdated, APIs return 428 Precondition Required with remediation hint

### API Endpoints
- `GET /api/chatbots/[chatbotId]/disclaimer` returns current version, content, and participant acceptance state
- `POST /api/chatbots/[chatbotId]/disclaimer` records accept/decline decision for the current version
- Shared API guard utility enforces acceptance on chat-related endpoints

### Content Structure
- Fixed core content covering AI limitations and data protection
- Customizable introduction section with course-specific context
- Optional media content (videos, images)
- Clear visual hierarchy and readability

## Acceptance Criteria

### Disclaimer Display
- [ ] Disclaimer appears when server reports acceptance required
- [ ] Modal cannot be bypassed without accept/decline decision
- [ ] All disclaimer content displays correctly across devices
- [ ] Media content (videos/images) loads and displays properly
- [ ] Text is readable and properly formatted

### Acceptance Tracking
- [ ] Student acceptance/decline is recorded in database with version id/hash and timestamp
- [ ] Acceptance status persists across browser sessions (server-side)
- [ ] Chat functionality is blocked for declined disclaimers
- [ ] API endpoints validate disclaimer status and return 428 when missing/outdated
- [ ] Re-acceptance is required and enforced on version change

### Content Management
- [ ] Lecturers can create custom disclaimer content (with department templates)
- [ ] Multiple chatbots can share the same template; current version assigned per chatbot
- [ ] Publishing a new version requires student re-acceptance
- [ ] System tracks which version of disclaimer was accepted (immutable)

### User Experience
- [ ] Disclaimer process takes less than 2 minutes to complete
- [ ] Students understand consequences of accepting/declining
- [ ] Error messages are clear and actionable
- [ ] Process works consistently across different browsers
- [ ] Decline path provides clear next steps and disables chat features

### System Integration
- [ ] No impact on existing chatbot performance
- [ ] Database changes maintain data integrity
- [ ] API responses handle disclaimer status appropriately (428 with remediation)
- [ ] System remains secure against bypass attempts (server-side guard on all chat endpoints)

## Data Model Overview

### Disclaimer Templates (Definition)
- Template with unique identifier, scope (institution/department/course), ownership metadata
- Title and core content sections (AI limitations, data protection), optional intro/media slots

### Disclaimer Versions (Immutable)
- Immutable snapshot of a template at publish time
- Version id and content hash; createdAt/createdBy
- Assigned as current per chatbot; previous acceptances remain linked to prior versions

### Chatbot Configuration
- Link each chatbot to a current disclaimer version (optional for transition)
- Changing the assigned version marks acceptances as outdated and triggers re-acceptance

### Acceptance Tracking
- Participant decision per chatbot and version (accept/decline)
- Timestamps
- Integration with existing usage credit system (guard before credit usage)


## User Flows

### First-Time Access Flow
1. Student navigates to chatbot page
2. Client requests `/api/chatbots/[chatbotId]/disclaimer` to check requirement
3. If required, blocking disclaimer modal appears
4. Student reviews content and media
5. Student chooses to accept or decline
6. Client posts decision; server records the decision
7. On accept, chat features load; on decline, show blocked message/redirect

### Disclaimer Update Flow
1. Lecturer publishes a new disclaimer version from a template
2. System assigns new version to chatbot and marks existing acceptances as outdated
3. Students who previously accepted see disclaimer again on next visit
4. New acceptance required to continue using chatbot

### Lecturer Configuration Flow
1. Lecturer accesses chatbot settings
2. Lecturer selects an existing template or creates a new one
3. Lecturer customizes introduction text and adds media
4. Lecturer publishes a version and assigns it as current to the chatbot
5. All future student access requires acceptance of this version; updates require re-acceptance

## Success Metrics

### User Adoption
- Disclaimer acceptance rate > 85%
- Time to complete disclaimer process < 2 minutes
- Student satisfaction with clarity of information

### Compliance
- 100% of chatbot access preceded by disclaimer acceptance
- Records of accept/decline decisions per chatbot/version
- Zero incidents of unauthorized chatbot access

### System Performance
- No measurable impact on chatbot response times
- Disclaimer loading time < 3 seconds
- 99.9% system availability during disclaimer process
 - API guard adds < 5ms overhead per request (p99) in steady state

## Benefits and Impact

### For Students
- Clear understanding of AI capabilities and limitations
- Informed consent for data processing
- Transparency about academic integrity expectations
- Reduced confusion about chatbot purpose and scope

### For Lecturers
- Flexibility to customize chatbot introduction
- Assurance that students understand usage guidelines
- Ability to include course-specific instructions
- Reduced support requests about chatbot functionality

### For the University
- Compliance with data protection regulations
- Risk mitigation around AI system usage
- Consistent messaging about AI limitations
- Professional presentation of cutting-edge technology

This disclaimer system enhancement represents a significant step forward in responsible AI deployment, ensuring that innovative educational technology is introduced with appropriate safeguards and transparency.
