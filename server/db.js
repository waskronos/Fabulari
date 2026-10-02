import { MongoClient } from 'mongodb';

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const databaseName = process.env.MONGO_DB_NAME || 'fabulari';

const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
let database;

/** Connects to MongoDB once and returns the Fabulari database. */
export async function connectDB() {
  await client.connect();
  database = client.db(databaseName);
  return database;
}

/** Returns the active database connection to route modules. */
export function getDB() {
  if (!database) {
    throw new Error('Database is not connected. Call connectDB() first.');
  }

  return database;
}

export async function ensureGeneralChat() {
  const users = await getDB().collection('users')
    .find({ role: { $ne: 'superAdmin' } })
    .toArray();
  const members = users.map(user => user.username);

  await getDB().collection('groups').updateOne(
    { title: 'Fabulari' },
    {
      $setOnInsert: {
        title: 'Fabulari',
        description: 'The main community for everyone on Fabulari.',
        minimumAge: 0,
        admins: [],
        joinRequests: [],
      },
      $set: { members },
    },
    { upsert: true }
  );

  await getDB().collection('channels').updateOne(
    { groupTitle: 'Fabulari', name: 'general' },
    {
      $setOnInsert: {
        groupTitle: 'Fabulari',
        name: 'general',
        createdBy: 'Fabulari',
      },
    },
    { upsert: true }
  );
}

/** Closes the shared MongoDB connection during shutdown or tests. */
export async function closeDB() {
  await client.close();
  database = undefined;
}
