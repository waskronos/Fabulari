import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

export const testUrl = 'http://localhost:3002';
export const testPassword = 'TestPassword8';
export const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=';
const client = new MongoClient('mongodb://127.0.0.1:27017');
const passwordHash = await bcrypt.hash(testPassword, 10);

export async function testDB() {
  await client.connect();
  return client.db('fabulari_test');
}

// Only reset the named testing database, never the presentation database.
export async function clearTestData() {
  const db = await testDB();
  for (const name of ['users', 'groups', 'channels', 'requests', 'messages', 'auditLogs']) {
    await db.collection(name).deleteMany({});
  }
}

export async function seedTestData() {
  await clearTestData();
  const db = await testDB();
  await db.collection('users').insertMany(['admin', 'alice', 'bob', 'outsider', 'young'].map(username => ({
    username, firstName: username, lastName: 'Test', email: `${username}@test.local`,
    dateOfBirth: username === 'young' ? '2020-01-01' : '2000-01-01',
    password: passwordHash, role: username === 'admin' ? 'superAdmin' : 'user',
  })));
  await db.collection('groups').insertMany([
    {title: 'Study', description: 'Study together', minimumAge: 18, admins: ['alice'], members: ['alice', 'bob'], joinRequests: [], bannedMembers: [], theme: 'default'},
    {title: 'Games', description: 'Play together', minimumAge: 0, admins: ['bob'], members: ['bob'], joinRequests: [], bannedMembers: [], theme: 'navy'},
  ]);
  await db.collection('channels').insertMany([
    {groupTitle: 'Study', name: 'chat', createdBy: 'alice'},
    {groupTitle: 'Study', name: 'help', createdBy: 'alice'},
    {groupTitle: 'Games', name: 'chat', createdBy: 'bob'},
  ]);
  return null;
}

export async function closeTestDB() {
  await client.close();
}
