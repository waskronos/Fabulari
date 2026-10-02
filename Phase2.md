# Fabulari - Phase 2

Name: Agampreet Singh

sNumber: 5373377

Workshop: Wednesday - 3PM

Repository: https://github.com/waskronos/Fabulari

## 1. Overview

Fabulari is a university group-chat project. Angular displays the pages, Express handles HTTP requests, Socket.IO handles live chat, and MongoDB saves the data. The server uses the standard MongoDB Node driver, not Mongoose.

Phase 2 adds database storage, live text and image messages, message history, profile editing, group administration and automated tests to Phase 1.

## 2. Features and permissions

| Feature | Behaviour |
|---|---|
| Registration | Unique username/email, date of birth and password with at least eight characters and an uppercase letter. Passwords are hashed with bcrypt and limited to 72 bytes. |
| First account | The first account registered in an empty database becomes Super Admin. JSON accounts are not automatically imported. |
| Login | The server checks the password and returns a random login token. Protected requests send that token. Logout removes it. |
| Profile | Users change their first name, last name, date of birth and picture after entering their current password. Username/email stay unchanged. Password changes use a separate form. |
| Groups | Users discover groups, request membership and request a new group. Super Admin approves/rejects group creation; approval makes the requester that group's admin. |
| Direct creation | Super Admin can also create a group directly and assign an existing age-eligible user as its admin. |
| Membership | Group Admins approve/reject membership requests and remove/ban/unban ordinary members in their own groups. Only Super Admin promotes/demotes admins or removes/bans an existing Group Admin. Members can leave. The last admin is protected until another is appointed. |
| Group details | Group Admins edit description, minimum age, theme and icon. A higher age cannot exclude an existing admin. |
| Channels | Group Admins create/delete channels directly. Members request new channels; their Group Admin approves/rejects them. |
| Access | The server checks membership, group age and bans. Channels inherit group access and have no separate minimum age. Super Admin does not chat. |
| Chat | Text and/or PNG, JPEG or GIF images. Text is limited to 2,000 characters, images to 2 MB. Group-admin messages have a MOD badge. |
| History | MongoDB stores the latest five messages per channel. Joining users see those messages chronologically. Connected participants still see older messages from their current session. |
| Deletion | Users delete their own messages; connected clients receive the deletion immediately. |
| Notifications | Existing participants see join/leave notices. Errors and confirmations appear in the interface. |
| Moderation | Members report another member for a group ban. Group Admins review ban reports and request account deletion from Super Admin. Requesters see decisions. |
| Administration | Super Admin deletes normal accounts and reviews deletion requests. Last group admins and Super Admin accounts are protected from deletion. |
| Audit | Super Admin filters actions by actor, action and dates. Records do not contain passwords or chat content. |

Group Admin is not a global account role. A normal user administers a group only when their username appears in that group's `admins` array. Admin of Study does not mean admin of Games.

Raising a group's minimum age keeps existing memberships recorded, but disconnects newly under-age chat participants and blocks their channel access. They regain access when their age meets the requirement or the minimum age is lowered; they do not need to request membership again. The age cannot be raised above an existing Group Admin's age. Ban reports target ordinary members; moderation of Group Admins is handled directly by Super Admin.

Deleting groups/channels removes related saved chat data. Banning/removing members or deleting rooms closes affected live chats. There is no automatically created general group.

## 3. Running the application

Install Node.js/npm and MongoDB. Start MongoDB on port 27017. From the repository:

```powershell
npm install
Copy-Item .env.example .env
npm run server
```

Only copy `.env.example` if `.env` does not already exist. In another terminal:

```powershell
npm start
```

Open `http://localhost:4200`. The backend uses port 3000. `.env` sets `MONGO_URL`, `MONGO_DB_NAME` and `HTTP_PORT`. Angular services use localhost:3000, so changing the backend port also requires changing those service URLs.

MongoDB data stays local, not in GitHub. `.env`, dependencies, build output and Cypress recordings are ignored. Docker is not required.

## 4. Architecture

```text
Angular page -> HTTP service -> Express route -> MongoDB
Chat component -> Socket service -> Socket.IO room -> MongoDB + room participants
```

| Area | Responsibility |
|---|---|
| `src/app/app.*` | Navigation, account menu and logout. |
| `pages/landing`, `login`, `register` | Public pages and account entry. |
| `components/dashboard` | `/home` group discovery and `/dashboard` profile/requests. |
| `components/administration` | Role-specific group management, reports, accounts and audit controls. |
| `components/chat` | Channels, messages, images and channel creation/request form. |
| `services/user`, `group`, `admin` | HTTP calls to backend routes. |
| `services/socket` | Socket connection, emit calls and listener callbacks. |
| `services/access` | Login header and simple page guards; server checks remain authoritative. |
| `models` | TypeScript account, request and message shapes. |
| `server/server.js` | Express setup, accounts and group/channel requests. |
| `server/admin.js` | Group/member management, moderation, deletion and audit queries. |
| `server/db.js` | Shared native MongoDB connection. |
| `server/access.js` | Login tokens and age calculation. |
| `server/images.js` | Image type, signature and size validation. |
| `server/sockets.js` | Room access, saved messages, broadcasting, history and deletion. |
| `server/audit.js` | Saving action records. |

HTTP services return Angular HTTP observables. Socket listeners use ordinary callbacks: `new-message` makes the component add a message to its array. Leaving chat removes listeners and disconnects the socket.

Angular routes are `/` (Landing), `/login` (Login), `/register` (Register), `/home` and `/dashboard` (Dashboard), and `/chat/:groupTitle/:channelName` or `/chat/:groupTitle` (Chat). Home/dashboard/chat require the login guard; chat also redirects Super Admin to their dashboard.

| Model file | What its interfaces describe |
|---|---|
| `user.model.ts` | Registration/login input, returned CurrentUser, profile/password updates and API messages. |
| `group.model.ts` | Group/channel request fields, pending request records and approve/reject decisions. |
| `chat.model.ts` | Room selection, text/image input and saved message fields shown in chat. |

Login tokens are stored in a server Map: token -> username. The browser keeps the returned account/token in localStorage. The server gets the current user from the token rather than trusting a submitted username. Tokens disappear on server restart, requiring another login. There are no JWTs or refresh tokens.

## 5. MongoDB data

Every document has MongoDB's `_id`. IDs travel as strings and are converted to ObjectId when querying by ID. Requests have no extra UUID; random UUIDs are used only for login tokens.

| Collection | Main fields |
|---|---|
| `users` | username, firstName, lastName, email, dateOfBirth, password hash, role (`user`/`superAdmin`), optional profileImage. |
| `groups` | title, description, minimumAge, admins, members, joinRequests, bannedMembers, theme, optional icon. |
| `channels` | name, groupTitle, createdBy. No age field. |
| `requests` | type (`group`, `membership`, `channel`, `ban`, `deleteUser`), requestedBy, status, createdAt; relevant group/title/name/target/reason; reviewer and decision date after review. |
| `messages` | groupTitle, channelName, username, text, image, timestamp, isModerator. |
| `auditLogs` | actor, action, target, reason, timestamp. |

Administrative routes use group/channel/request `_id`, and message deletion uses message `_id`. Existing membership arrays still store usernames; channels/messages still link by groupTitle. Username and group title cannot be renamed, keeping those links stable. This is not a complete ObjectId relationship migration.

Images are small data URL strings in MongoDB, not files in Git. `findOne()` fetches particular records; list pages use `find().toArray()`. Only MongoDB's default `_id` indexes exist. Registration checks uniqueness in the route, not with a unique database index.

The socket server keeps message owners in a Map for active rooms so an older visible message can still be deleted after the database trims it. The Map is removed when the room empties. A join counter prevents a slower previous join from replacing a newer channel selection.

## 6. REST API

Paths start with `/api`. Only registration/login are public; other routes require `Authorization: Bearer <token>`. Errors return `{message}`: usually 400 invalid input, 401 invalid login, 403 missing permission, 404 missing record or 500 server failure.

| Method/path | Input and permission | Success |
|---|---|---|
| POST `/users` | Registration fields | 200 message. |
| POST `/login` | username, password | 200 message + user/token, no password hash. |
| POST `/logout` | Current token | 200 message. |
| PATCH `/users/:username` | Own profile fields + currentPassword | 200 message + updated user. |
| PATCH `/users/:username/password` | Own currentPassword, newPassword, confirmPassword | 200 message. |
| GET `/groups` | Logged-in account | 200 group array for discovery. |
| POST `/groups` | Super Admin; title, description, minimumAge, adminUsername | 201 message. |
| PATCH `/groups/:groupId` | This Group Admin; description, minimumAge, optional theme/icon | 200 message. |
| DELETE `/groups/:groupId` | This Group Admin | 200 message; cascade deletion. |
| POST `/groups/join` | User; title, username | 200 message; pending membership. |
| POST `/groups/approve` | This Group Admin; title, applicant username | 200 message. |
| POST `/groups/reject` | This Group Admin; groupId, applicant username | 200 message. |
| PATCH `/groups/:groupId/members` | action, username, optional reason | 200 message. Group Admin: remove/ban/unban ordinary members. Member: leave self. Super Admin: promote/demote/remove/ban; last admin remains protected. |
| POST `/group-requests` | User; title, description, minimumAge, requestedBy | 201 message. |
| GET `/group-requests` | User or Super Admin | 200 own requests, or pending requests for Super Admin. |
| PATCH `/group-requests/:requestId` | Super Admin; action approve/reject | 200 message. |
| GET `/channels` | Logged-in account | 200 accessible channels; Super Admin lists all for administration. |
| POST `/channels` | This Group Admin; name, groupTitle, createdBy | 201 message. |
| DELETE `/channels/:channelId` | This Group Admin | 200 message. |
| POST `/channel-requests` | Member; name, groupTitle, requestedBy | 201 message. |
| GET `/channel-requests` | Group Admin | 200 pending requests in administered groups. |
| PATCH `/channel-requests/:requestId` | This Group Admin; action approve/reject | 200 message. |
| POST `/moderation-requests` | groupId, type, targetUsername, reason; members report bans, admins request deletion | 201 message. |
| GET `/moderation-requests` | Logged-in account | 200 own/reviewable requests, latest 100. |
| PATCH `/moderation-requests/:requestId` | action approve/reject; Group Admin for bans, Super Admin for deletion | 200 message. |
| GET `/admin/users` | Super Admin | 200 user summaries, no passwords. |
| DELETE `/users/:username` | Super Admin | 200 message; removes account/memberships/messages. |
| GET `/audit-logs` | Super Admin; optional actor, action, from/to dates | 200 latest 200 matching logs. |

Approving membership checks the current user's group-admin permission, removes the applicant from joinRequests, adds them to members, records the request decision and logs the action. Hiding a button alone does not enforce permission.

## 7. Socket.IO events

Connections send `auth: {token}`. Rooms use lower-case `groupTitle:channelName` names.

| Direction/event | Data and action |
|---|---|
| Client -> `join-channel` | `{groupTitle, channelName}`; checks login/membership/ban/group age. |
| Server -> `chat-history` | Latest five saved messages, oldest first. |
| Server -> `channel-joined` | `{theme}`; confirms room access. |
| Client -> `send-message` | `{text, image}`; validates, saves, trims and broadcasts. Callback receives true/false. |
| Server -> `new-message` | Saved message with `_id` and profileImage; this room only. |
| Client -> `delete-message` | Message ID; checks access and authorship. |
| Server -> `message-deleted` | ID for clients to remove. |
| Server -> `room-notification` | Join/leave text to other participants. |
| Server -> `chat-error` | User-facing error text. |
| Server -> `channel-left` | Access lost; stops sending. |
| Server -> `theme-updated` | New theme. |
| Server -> `user-deleted` | Username; removes that user's visible messages. |
| Connection events | connect, connect_error and disconnect update the interface. |

Messages are saved before broadcasting. Sending/deleting recheck access so an old connection cannot bypass a membership change.

## 8. Screens and user flow

| Screen | Layout and flow |
|---|---|
| Landing/login/register | Public account entry. Normal login opens Home; Super Admin opens Dashboard. |
| Home | Fabulari heading; Your Groups with accessible channels; Discover Groups with search/join; Create a Group request form. |
| Profile dashboard | Account summary, collapsed profile/password forms, memberships with member/admin badges, requests and role-specific administration. |
| Chat | Left: group name/icon/channels. Main: heading, notices, message list, image preview and composer. Members request channels; admins create them. |
| Administration | Group management/reports for Group Admin; direct creation, accounts and audit for Super Admin. Members see their requests, not admin review controls. |

Navigation is dark purple with a pink brand and hamburger account menu. Profile forms use native expandable details sections. Moderation uses red styling. Forms have labels, images have alternative text and alerts display status/errors. Layouts wrap on smaller screens. These measures are not a complete accessibility audit.

Updated screen sketches (the hamburger menu opens over the page):

```text
HOME                     PROFILE DASHBOARD           CHAT
Navigation               Navigation                  Navigation
Fabulari heading         Account summary             Group/icon | Channel heading
Group counts             > Edit profile               Channels   | Messages
Your groups/channels     > Change password            Create or  | Notices
Discover/search/join     Memberships and requests     request    | Image preview
Create group request     > Administrative sections    channel    | Composer
```

On narrow screens, group cards and form grids stack vertically; the chat channel panel and messages also stack rather than needing a wide desktop layout.

## 9. Testing

Tests follow course patterns: Angular TestBed/Vitest, Mocha with assert/Chai/chai-http, and Cypress.

Verified on 2 October 2026:

| Suite | Coverage | Result |
|---|---|---|
| Angular | Nine files: navigation, account pages, dashboard, chat routing, administration and HTTP services. Services use HTTP testing providers; components use mocks. | 22 passed |
| Node unit | Age calculation, image validation and token generation. | 9 passed |
| API integration | Accounts, requests, group permissions, moderation, deletion and audit filtering, including Group Admin protection. | 45 passed |
| Socket integration | Access/age, rooms, images, history, deletion, notifications, raised-age behaviour and live moderation/session cleanup. | 15 passed |
| Cypress | Login/registration, redirects/menu, groups, profile, role-specific controls and first-account bootstrap. | 14 passed |
| Production build | Angular compilation. | Passed; dashboard CSS exceeds the 4 KB warning budget by 863 bytes. |

These results cover the named tests, not every possible input or browser.

### Method and evidence

Tests follow arrange -> act -> assert: prepare known input, perform the action and compare the actual result with the expected result. Angular component tests supply mock services; service tests use HttpTestingController to inspect and answer HTTP requests without calling a real server. Mocha integration tests make real HTTP/socket requests and inspect the resulting MongoDB records. Cypress performs visible browser actions and checks page content and navigation.

Fixtures create five test accounts, two groups and three channels. Each integration/browser test resets the disposable database, so results do not depend on previous tests or presentation data. The first-user tests deliberately clear those fixtures before registration. The following table lists the tested scenarios and expected outcomes; all passed in the final run (105 named tests in total).

| Area / test files | Scenarios checked | Expected outcome |
|---|---|---|
| Angular `app.spec.ts`, `landing.spec.ts` | Component creation, brand, opening/closing account menu. | Correct elements and menu state. |
| Angular `login.spec.ts`, `register.spec.ts` | Login storage/redirects/errors, registration and future birthday validation. | Role-appropriate navigation; invalid input does not submit. |
| Angular `dashboard.spec.ts`, `administration.spec.ts` | Per-group admin access, review permissions, success refresh and permission errors. | Only authorised controls/actions; errors are shown, not treated as success. |
| Angular `chat.spec.ts` | Channel route changes, draft reset and member request vs admin creation. | Correct room/form action for the selected group. |
| Angular `group.spec.ts`, `user.spec.ts` | Service creation, HTTP methods/bodies and login header. | Correct requests and returned data. |
| Unit `helpers.test.js` | Birthday today/before/after; empty/valid/fake/SVG/oversized images; separate login tokens. | Correct age, supported small images only, distinct tokens. |
| API `routes.test.js`: accounts | Registration/hash, first-account Super Admin, duplicate username, over-72-byte password, valid/invalid login, profile/email and password change. | Password hashes saved; invalid requests rejected; email unchanged. |
| API: session and permissions | Missing token, logout token reuse, impersonation and admin-of-another-group access. | Unauthorised requests rejected. |
| API: groups | List/direct creation, ordinary-user restrictions, request creation/approval/rejection and metadata editing. | Correct records and assigned admin. |
| API: membership | Request/approve/reject, under-age join, leave/remove, ban/rejoin/unban and last-admin protection. | Correct membership/request status and protected last admin. |
| API: admin authority | Super Admin promotion/demotion; Group Admin cannot promote/demote/remove/ban another admin; reports cannot bypass this after promotion. | Roles stay unchanged on forbidden actions; Super Admin actions succeed. |
| API: channels | Accessible list, direct creation permissions, request approval/rejection and deletion. | Only eligible channels returned; correct creation/deletion. |
| API: moderation/accounts/audit | Reports/reasons/decisions, account list permission/hash exclusion, deletion/last-admin protection and audit filters. | Correct restricted records, cleanup and action logs. |
| Socket `sockets.test.js`: rooms/messages | Missing login, nonmember/Super Admin/under-age access, room isolation, real/fake image, five-message order, own/older-visible deletion and join/leave notices. | Access enforced; saved messages broadcast only to the right room. |
| Socket: changing access | Raised/lowered age, ban in one group, account deletion, logout, group/channel deletion. | Correct disconnections, preserved age-blocked membership, unrelated chat unaffected and invalid tokens rejected. |
| Cypress `fabulari.cy.js` | Anonymous redirect, bad/good login, menu, search, registration validation/success, group/membership requests, profile collapse, direct creation and role controls. | Browser follows the intended user workflows with visible feedback. |
| Cypress: bootstrap | First and second registrations in a freshly emptied test database. | First sees Super Admin dashboard; second opens normal Home. |

Verified environment: Windows, Node.js 24.18.1, local MongoDB 6.0, Angular/Vitest and Cypress 16.1.1 using its bundled Electron browser. Terminal/browser runner output provides the pass/fail results; no test recording or screenshots are required to execute the suites. The full named cases remain in the test files.

```powershell
npm test -- --watch=false
npm run test:unit
npm run build
```

For integration/browser tests, keep MongoDB running and start a separate terminal:

```powershell
npm run server:test
```

This runs on port 3002 using only `fabulari_test`. Tests reset that database before each test and clear its test collections after a completed suite. Never use it for presentation data. Then run:

```powershell
npm run test:api
npm run test:e2e
```

Run these suites sequentially because they share test fixtures. Cypress also needs Angular on port 4200. If needed, run `npx cypress install` once for its browser binary. Cypress redirects HTTP requests to the test server; live sockets are tested by Mocha. `npm run test:e2e:open` opens the interactive runner.

## 10. Limitations

This is local coursework, not a production service. Tokens are in memory, images are small database strings and uniqueness checks do not handle simultaneous competing registrations. Message ownership survives only while a room is active. Automated coverage is not exhaustive.

Dependency auditing reports advisories, including Angular Router and Express/qs dependencies. Dependencies were not blindly upgraded with `npm audit fix --force`. Passing tests do not establish production security.
