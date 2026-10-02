# Fabulari

University group-chat project using Angular, Node/Express, Socket.IO and the official MongoDB Node driver. [Phase2.md](Phase2.md) explains features, data, API/socket events and verified tests.

## Run locally

Install Node.js/npm and start MongoDB locally on port 27017. From this folder:

```powershell
npm install
Copy-Item .env.example .env
npm run server
```

Only copy the environment file if `.env` does not already exist. In another terminal:

```powershell
npm start
```

Open `http://localhost:4200`. The backend uses port 3000 and database `fabulari` by default. The first account registered in an empty database becomes Super Admin. Accounts are not automatically seeded. MongoDB collections and `.env` are not committed to Git.

## Test

```powershell
npm test -- --watch=false
npm run test:unit
npm run build
```

Keep MongoDB running and start a separate backend terminal:

```powershell
npm run server:test
```

This uses port 3002 and disposable database `fabulari_test`. Tests reset its collections, so never use it for presentation data. Run these suites sequentially:

```powershell
npm run test:api
npm run test:e2e
```

Cypress needs Angular running on port 4200. Run `npx cypress install` once if its browser binary is missing. `npm run test:e2e:open` opens the interactive runner.

Angular tests use TestBed/Vitest, backend tests use Mocha/assert/Chai/chai-http and browser tests use Cypress. Socket integration tests exercise real rooms against the separate test server.
