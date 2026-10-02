import { defineConfig } from 'cypress';
import { seedTestData, clearTestData, closeTestDB } from './tests/data.js';

export default defineConfig({
  video: false,
  e2e: {
    baseUrl: 'http://localhost:4200',
    supportFile: false,
    setupNodeEvents(on) {
      on('task', {resetDatabase: seedTestData});
      on('after:run', async () => {
        await clearTestData();
        await closeTestDB();
      });
    },
  },
});
