# Fabulari - Phase 2

**Name:** Agampreet Singh  
**sNumber:** 5373377  
**Workshop:** Wednesday - 3PM  
**GitHub Repository:** https://github.com/waskronos/Fabulari

## 1. Project Overview

Phase 2 extends the Fabulari prototype into a complete MEAN-stack group chat application. The application uses Angular for the client, Express and Node.js for the server, the official MongoDB Node.js driver for persistent storage, and Socket.IO for real-time chat.

This document will be expanded alongside the implementation so that the documented architecture and tests continue to match the code in the repository.

## 2. Requirements

| ID | Requirement | Status |
|---|---|---|
| FR1 | A user can register using a unique username and email address. | Planned |
| FR2 | Registration records a date of birth and passwords are hashed with bcrypt. | Planned |
| FR3 | The first registered account becomes the Super Admin. | Planned |
| FR4 | A user can request creation of a group from the Super Admin. | Planned |
| FR5 | Approving a group request creates the group and makes the requester a Group Admin. | Planned |
| FR6 | A user can request membership of an existing group. | Planned |
| FR7 | A Group Admin can approve or reject membership requests for their group. | Planned |
| FR8 | A group member can request a new channel from a Group Admin. | Planned |
| FR9 | A Group Admin can approve or reject channel requests for their group. | Planned |
| FR10 | Group membership and channel access enforce calculated minimum-age rules. | Planned |
| FR11 | Group members can exchange text and supported images in real time. | Planned |
| FR12 | Entering and leaving a channel notifies the connected channel members. | Planned |
| FR13 | A new channel participant receives the five most recent messages. | Planned |
| FR14 | A user can delete their own message and the deletion updates connected clients. | Planned |
| FR15 | Administrative actions are recorded in filterable audit logs. | Planned |
| FR16 | Errors and successful actions are shown using accessible user-facing notifications. | Planned |

## 3. Permission Summary

### Super Admin

- Approves or rejects group creation requests.
- Deletes users after reviewing Group Admin requests.
- Reviews audit logs.
- Does not participate in chat.

### Group Admin

- Is a normal user with additional permissions for specific groups.
- Approves or rejects membership and channel requests for those groups.
- Updates permitted group metadata and moderates group membership.
- Can participate in chat and receives a moderator badge in administered groups.

### User

- Views existing groups and requests membership.
- Requests creation of groups and channels.
- Participates in channels belonging to joined groups when age requirements are met.

## 4. Proposed Data Collections

| Collection | Purpose |
|---|---|
| `users` | Account details, password hash, date of birth, profile image and system role. |
| `groups` | Group metadata, minimum age, theme, administrator IDs and member IDs. |
| `channels` | Channel metadata, parent group ID and minimum age. |
| `requests` | Pending, approved and rejected administrative requests. |
| `messages` | The five most recent messages for each channel. |
| `auditLogs` | Administrative actions available to the Super Admin. |

MongoDB document IDs will be used for relationships instead of mutable usernames or titles. Collection indexes and final document structures will be documented after implementation.

## 5. Angular Architecture

The Phase 2 interface will continue using standalone Angular components, services, routes, signals and RxJS observables. Large role-dependent views will be divided into focused sections rather than remaining in one dashboard component.

Detailed component, service, model and guard tables will be added as each feature is implemented.

## 6. REST API Documentation

The complete REST endpoint table will be maintained here during implementation.

## 7. Socket.IO Documentation

The complete Socket.IO event table will be maintained here during implementation.

## 8. Design and Accessibility

The revised design will provide clear navigation, keyboard-accessible controls, labelled form fields, visible focus states, readable contrast and user-facing status messages. Group themes will be constrained so that text remains readable.

## 9. Testing Methodology

Testing will follow the course technologies:

- Angular component and service tests using the Angular test runner and Vitest.
- Node.js API and integration tests using Mocha, Chai and Supertest.
- End-to-end browser tests using Cypress.

The final document will contain a test table, results and exact commands for running every suite.
