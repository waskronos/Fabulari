import { MongoClient } from 'mongodb';
import { promises as fs } from 'fs';

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

/** Confirms that the MongoDB server is responding. */
export async function checkDatabaseHealth() {
  return getDB().command({ ping: 1 });
}

export async function seedDatabase() {
  const collections = ['users', 'groups', 'channels', 'requests'];

  for (const collectionName of collections) {
    const collection = getDB().collection(collectionName);
    const documentCount = await collection.countDocuments();

    if (documentCount === 0) {
      const file = await fs.readFile(`./server/data/${collectionName}.json`, 'utf8');
      const documents = JSON.parse(file);

      if (documents.length > 0) {
        await collection.insertMany(documents);
      }
    }
  }
}

/** Closes the shared MongoDB connection during shutdown or tests. */
export async function closeDB() {
  await client.close();
  database = undefined;
}
