import 'dotenv/config';

export function getMongoUri(): string {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required to run this script.');
  }

  return mongoUri;
}
