process.env.MONGO_URL = 'mongodb://127.0.0.1:27017';
process.env.MONGO_DB_NAME = 'fabulari_test';
process.env.HTTP_PORT = '3002';
await import('../server/server.js');
