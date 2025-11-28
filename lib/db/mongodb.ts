import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-distribution'

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongoose: MongooseCache | undefined
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
    }

    // Log connection attempt (without exposing password)
    const maskedUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')
    console.log('🔌 Attempting MongoDB connection...')
    console.log(`📍 URI: ${maskedUri}`)

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('✅ MongoDB Connected Successfully')
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}`)
        return mongoose
      })
      .catch((error) => {
        console.error('❌ MongoDB Connection Failed:')
        console.error(`   Error: ${error.message}`)
        if (error.message.includes('authentication')) {
          console.error('   💡 Check your username and password in MONGODB_URI')
        } else if (error.message.includes('timeout')) {
          console.error('   💡 Check network access in MongoDB Atlas (IP whitelist)')
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          console.error('   💡 Check your MongoDB Atlas cluster URL')
        }
        throw error
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    // Re-throw with more context
    const error = e as Error
    console.error('❌ Failed to establish MongoDB connection')
    console.error(`   ${error.message}`)
    throw error
  }

  return cached.conn
}

export default connectDB




