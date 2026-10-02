import { MongoClient } from 'mongodb';

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const databaseName = process.env.MONGO_DB_NAME || 'fabulari';

const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
let database;

export async function connectDB() {
  await client.connect();
  database = client.db(databaseName);
  return database;
}

export function getDB() {
  if (!database) {
    throw new Error('Database is not connected. Call connectDB() first.');
  }

  return database;
}
