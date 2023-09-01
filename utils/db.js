const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    // constructor for the class
    const host = process.env.DB_HOST || 'localhost ';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const client = new MongoClient(`mongodb://${host}:${port}/${database}`, { useUnifiedTopology: true });

    // connect to mongodb;

    client.connect((err, client) => {
      if (err) {
        this.client = false;
      }
      this.client = client.db(database);
    });
  }

  isAlive() {
    if (this.client) return true;
    return false;
  }

  async nbUsers() {
    const users = this.client.collection('users');
    const count = await users.countDocuments();
    return count;
  }

  async nbFiles() {
    const files = this.client.collection('files');
    const count = await files.countDocuments();
    return count;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
