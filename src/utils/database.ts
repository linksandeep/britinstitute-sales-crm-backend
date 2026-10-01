import mongoose from 'mongoose';

const prepareLeadContactIndexes = async (): Promise<void> => {
  const leads = mongoose.connection.collection('leads');
  let indexes: Awaited<ReturnType<typeof leads.indexes>> = [];

  try {
    indexes = await leads.indexes();
  } catch (error: unknown) {
    const mongoError = error as { code?: number };
    if (mongoError.code !== 26) throw error;
  }

  for (const field of ['email', 'phone'] as const) {
    const uniqueContactIndex = indexes.find((index) => {
      const keys = Object.entries(index.key);
      return index.unique === true && keys.length === 1 && keys[0]?.[0] === field;
    });

    if (uniqueContactIndex?.name) {
      try {
        await leads.dropIndex(uniqueContactIndex.name);
        console.log(`🔧 Replaced unique lead ${field} index to allow linked Meta duplicates`);
      } catch (error: unknown) {
        const mongoError = error as { code?: number };
        if (mongoError.code !== 27) throw error;
      }
    }

    await leads.createIndex({ [field]: 1 }, { name: `${field}_1` });
  }
};

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      bufferCommands: false, // Disable mongoose buffering
    };

    // Connect to MongoDB
    await mongoose.connect(mongoUri, options);

    await prepareLeadContactIndexes();

    console.log('🚀 Connected to MongoDB successfully');

    // Handle connection events
    mongoose.connection.on('connected', () => {
      console.log('📡 Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('📴 Mongoose disconnected from MongoDB');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('📴 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log('📴 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
    throw error;
  }
};

export default connectDatabase;
