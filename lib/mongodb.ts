import mongoose from 'mongoose';

declare global {
  var _mongooseConn: Promise<typeof mongoose> | undefined;
}

let warned = false;

async function connect(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    if (!warned) { warned = true; console.warn('[mongodb] MONGODB_URI not set — skipping connection'); }
    return mongoose;
  }
  if (global._mongooseConn) return global._mongooseConn;
  global._mongooseConn = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  return global._mongooseConn;
}

export default connect;
