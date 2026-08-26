# Fabulari - Phase 1

**Name:** Agampreet Singh  
**sNumber:** 5373377  
**Workshop:** Wednesday - 3PM  
**GitHub Repository:** https://github.com/waskronos/Fabulari

---

## 1. Project Overview

Fabulari is a multi-user group chat application prototype built with Angular, Node.js and Express. The Phase 1 prototype focuses on the administration side of the application: creating users, logging in, creating groups, assigning Group Admins, handling membership requests and creating rooms/channels.

There are three permission levels:

- **Super Admin** - creates groups and assigns an existing user as the Group Admin.
- **Group Admin** - manages membership requests for groups they administer and creates rooms for those groups.
- **User** - registers, logs in, views groups and requests membership.

The prototype stores Users, Groups and Channels persistently in JSON files on the Node server. The actual chat functionality is not implemented in this Phase 1 prototype.

### Implemented in the prototype

- Landing page and navigation between Home, Login, Register and Dashboard.
- User registration and username/password login.
- Password hashing before users are saved.
- First registered user automatically becomes the Super Admin.
- Role-dependent Dashboard views.
- Super Admin group creation and Group Admin assignment.
- Persistent Users, Groups and Channels in server-side JSON files.
- Group title, description and minimum-age validation.
- All existing groups displayed to users.
- Group membership requests with minimum-age checking.
- Group Admin approval of membership requests.
- Group Admin creation of rooms/channels for selected groups.
- Minimum-age values for rooms.
- Logout using browser local storage.

---

## 2. Git Strategy

Git and GitHub were used throughout Phase 1 to record development progress. Because this was an individual prototype, development was kept on the `main` branch and commits were made after meaningful features or fixes.

My general workflow was:

1. Implement a small feature or fix.
2. Run and test the Angular and Node applications.
3. Correct obvious errors before committing.
4. Stage the relevant files.
5. Commit with a message describing the completed change.
6. Push the commit to the private GitHub repository.

The commit history shows the progression from the initial Angular project through registration/login, group management, membership management, channels and UI cleanup.

Repository: https://github.com/waskronos/Fabulari

---

## 3. Functional Requirements and Assumptions

| ID | Requirement | Phase 1 Status |
|---|---|---|
| FR1 | A user can register with username, first name, last name, email, age and password. | Implemented |
| FR2 | Username and email must be unique. | Implemented |
| FR3 | Password must be at least 8 characters and contain at least one uppercase letter. | Implemented |
| FR4 | Passwords should not be stored as plain text. | Implemented using bcrypt |
| FR5 | The first registered user becomes the Super Admin. | Implemented |
| FR6 | Later users begin as normal Users. | Implemented |
| FR7 | Users can log in using username and password. | Implemented |
| FR8 | The UI changes according to Super Admin, Group Admin and User permissions. | Implemented |
| FR9 | Super Admin can create a group. | Implemented |
| FR10 | A group contains a title, description, minimum age and Group Admin. | Implemented |
| FR11 | Group title is limited to 30 characters. | Implemented |
| FR12 | Group description is limited to 250 characters. | Implemented |
| FR13 | Super Admin can assign an existing user as Group Admin. | Implemented |
| FR14 | A Group Admin can administer multiple groups. | Supported by the design |
| FR15 | Users can see all existing groups. | Implemented |
| FR16 | A user must meet the group's minimum age before requesting membership. | Implemented |
| FR17 | Users can request membership of a group. | Implemented |
| FR18 | Duplicate group membership requests are rejected. | Implemented |
| FR19 | Group Admin can approve a membership request. | Implemented |
| FR20 | Group Admin can create rooms/channels within groups they administer. | Implemented |
| FR21 | Rooms can have their own minimum age. | Implemented |
| FR22 | Users must be group members before accessing the group's rooms. | Represented in the prototype UI |
| FR23 | Group Admin can reject requests and remove/ban members. | Identified; not implemented |
| FR24 | Group Admin can edit group description and minimum age, but not the group title. | Identified; not implemented |
| FR25 | Super Admin can delete users. | Identified; not implemented |
| FR26 | Users can request creation of a room. | Identified; not implemented |

### Assumptions used

- Group titles are treated as unique, case-insensitively, in the JSON prototype.
- Channels are assigned to a group using the group's title.
- A channel name only needs to be unique within its parent group.
- The logged-in user is stored in browser `localStorage` under `currentUser` so the Dashboard can restore the user's basic information during navigation.
- `localStorage` is only used as prototype client state and is not treated as strong authentication security.
- Authentication is intentionally basic username/password authentication for this prototype.

---

## 4. Data Structures

Phase 1 uses JSON files on the Node server instead of a database. The structures are deliberately small so they are easy to read and modify during the prototype.

### 4.1 User

A user record contains the information collected during registration plus the assigned role. The stored password value is a bcrypt hash rather than the original password.

```js
{
  username: "agam",
  firstName: "Agam",
  lastName: "Singh",
  email: "user@example.com",
  age: 20,
  password: "<bcrypt hash>",
  role: "user"
}
```

The `role` value is used by the Angular Dashboard to decide which controls should be displayed.

### 4.2 Group

A group stores its basic metadata, its Group Admin, approved members and pending join requests.

```json
{
  "title": "valorant",
  "description": "aaha",
  "minimumAge": 20,
  "admin": "hello1",
  "members": ["hello1"],
  "joinRequests": []
}
```

`members` and `joinRequests` are arrays because more than one username can belong to each list. When a request is approved, the username is removed from `joinRequests` and added to `members`.

### 4.3 Channel / Room

A room is stored separately and linked back to its parent group using `groupTitle`.

```json
{
  "name": "general",
  "groupTitle": "valorant",
  "minimumAge": 15,
  "createdBy": "hello1"
}
```

This keeps room data simple while still allowing one group to have multiple rooms.

### 4.4 Browser Local Storage

After a successful login, the safe user object returned by the server is stored in the browser:

```ts
localStorage.setItem('currentUser', JSON.stringify(response.user));
```

The Dashboard reads this value in `ngOnInit()`. The password and password hash are not included in this browser object.

---

## 5. Angular Architecture

Fabulari uses standalone Angular components, routing and services. The structure is intentionally simple for the Phase 1 prototype.

### Components

- **App** - root component containing the shared navigation and `router-outlet`.
- **Landing** - Fabulari home page.
- **Login** - username/password login form.
- **Register** - registration form.
- **Dashboard** - role-dependent user, group and room interface.

### Routes

- `/` - Landing page
- `/login` - Login page
- `/register` - Registration page
- `/dashboard` - Role-dependent Dashboard

### Service example

HTTP calls are kept in an Angular service rather than written directly into the HTML template. For example, the group service retrieves groups and sends membership requests using `HttpClient`:

```ts
getGroup(){
    return this.http.get<any[]>('http://localhost:3000/api/groups');
}

requestJoin(title: string, username: string) {
    return this.http.post('http://localhost:3000/api/groups/join', { title, username });
}
```

The Dashboard subscribes to these requests and updates the values displayed in the template. This follows the same service and HTTP request pattern used throughout the prototype.

### Angular concepts used

- Standalone components
- Angular routing and `routerLink`
- `Router.navigate()`
- `FormsModule` and `[(ngModel)]`
- `@if` and `@for`
- `HttpClient`
- Observables and `.subscribe()`
- Signals for asynchronously loaded Dashboard collections
- `ngOnInit()`
- `localStorage`

---

## 6. Server Endpoints

The Node/Express server exposes a small set of endpoints used by the Angular application.

### Implemented endpoints

- `POST /api/users` - register and persist a new user.
- `POST /api/login` - check username/password and return safe user data.
- `POST /api/groups` - create a group and assign a Group Admin.
- `GET /api/groups` - retrieve all groups.
- `POST /api/groups/join` - submit a group membership request.
- `POST /api/groups/approve` - approve a pending membership request.
- `POST /api/channels` - create and persist a room/channel.
- `GET /api/channels` - retrieve persisted rooms/channels.

A simple example is the route used to retrieve groups:

```js
app.get('/api/groups', (req, res) => {
    fs.readFile('./server/data/groups.json', 'utf8', (err, data) => {
        if(err){
            return res.status(500).json({message: 'Internal server error'});
        }

        const groups = JSON.parse(data);
        return res.status(200).json(groups);
    });
});
```

This is representative of the server approach used in Phase 1: Express receives the request, Node reads the JSON file, the data is parsed and a JSON response is returned.

### Identified but not implemented in this prototype

- Rejecting a pending membership request.
- Removing/banning a group member.
- Updating group description or minimum age.
- Super Admin user deletion.
- User requests for creation of a room.

---

## 7. Design Documents and Responsive Storyboards

### 7.1 Navigation flow

```text
Fabulari Home
    |
    +---- Login ----+
    |               |
    +---- Register -+
                    |
               Dashboard
                    |
          Role-dependent view
       /          |          \
 Super Admin  Group Admin    User
```

### 7.2 Landing page

```text
+------------------------------------------------------------+
| FABULARI                     Home Login Register Dashboard |
+------------------------------------------------------------+
|                                                            |
|                       WELCOME TO                           |
|                                                            |
|                         FABULARI                           |
|                Find your birds of a feather.               |
|                                                            |
|                      [ Get started ]                        |
|                                                            |
+------------------------------------------------------------+
```

### 7.3 Login / Register

```text
+------------------------------------------------------------+
| FABULARI                     Home Login Register Dashboard |
+------------------------------------------------------------+
| Login                                                      |
|                                                            |
| Username                                                   |
| [........................................]                 |
| Password                                                   |
| [........................................]                 |
| [ Login ]                                                  |
+------------------------------------------------------------+
```

Registration follows the same vertical layout with username, first name, last name, email, age and password fields.

### 7.4 Dashboard

```text
+------------------------------------------------------------+
| FABULARI                     Home Login Register Dashboard |
+------------------------------------------------------------+
| Welcome, User                                  [ Logout ]   |
| Role: groupAdmin                                           |
|                                                            |
| Create Room                                                |
| Group [group v] Room [........] Age [..] [Create Room]    |
|                                                            |
| Groups                                                     |
| +--------------------------------------------------------+ |
| | Group title                                            | |
| | Description                                            | |
| | Minimum Age / Group Admin                              | |
| | Join Requests                        [Approve]          | |
| | Rooms                                                  | |
| +--------------------------------------------------------+ |
+------------------------------------------------------------+
```

### 7.5 Responsive design approach

- A consistent dark Fabulari theme is used across the application.
- Main Dashboard content is constrained to a readable maximum width.
- Groups are displayed as cards instead of a wide data table.
- Login and registration forms use a vertical layout that can fit narrow screens.
- Form controls can wrap or stack as screen width becomes smaller.
- The same information hierarchy is kept on smaller screens.

---

## 8. Testing Summary

The prototype was manually tested using the browser, Developer Tools and Node terminal output.

Testing included:

- valid and invalid registration
- duplicate username/email rejection
- password validation and hashing
- first-user Super Admin bootstrap
- successful and failed login
- role-dependent Dashboard views
- group creation and Group Admin validation
- duplicate group title rejection
- loading all groups
- minimum-age group membership rejection
- valid and duplicate membership requests
- Group Admin membership approval
- room/channel creation
- channel assignment to the selected group
- JSON persistence after page refresh
- logout and clearing the current browser user

---

## 9. Current Prototype Limitations

The current submission is an early prototype. The main Users, Groups and Channels workflow is implemented, while some administrative actions identified from the client requirements are still represented as future work, including membership rejection/removal, group metadata editing, Super Admin user deletion and user room requests. The actual chat interface is not part of this Phase 1 implementation.
