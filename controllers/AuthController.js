import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const { v4: uuidv4 } = require('uuid');

class AuthController {
  static async getConnect(req, res) {
    const auth = req.headers.authorization;
    const token = auth.split(' ')[1];
    const [email, password] = Buffer.from(token, 'base64').toString().split(':');
    const hashedpassword = sha1(password);

    const user = await dbClient.db.collection('users').findOne({ email, password: hashedpassword });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const newToken = uuidv4();
    await redisClient.set(`auth_${newToken}`, user._id.toString(), 24 * 60 * 60);
    return res.status(200).json({ token: newToken });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    try {
      const userId = await redisClient.get(`auth_${token}`);
      console.log(token);
      if (userId) {
        await redisClient.del(`auth_${token}`);
        return res.status(204).send();
      }
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = AuthController;
