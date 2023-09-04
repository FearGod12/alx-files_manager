import fs from 'fs';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });
    const { body } = req;
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) {
      return res.json({ error: 'Unauthorized' });
    }

    if (!body.name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!body.type || !['folder', 'file', 'image'].includes(body.type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (!body.data && body.type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    let { parentId } = body;
    let parentSET;
    if (parentId) {
      parentSET = true;
    } else {
      parentSET = false;
    }

    if (parentSET === true) {
      const parentFile = await dbClient.db.collection('files').findOne({ parentId: ObjectId(parentId) });

      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    } else {
      parentId = 0;
    }

    const dbFile = {
      name: body.name,
      type: body.type,
      parentId,
      isPublic: body.isPublic || false,
      userId: user._id,
    };

    if (dbFile.type === 'folder') {
      await dbClient.db.collection('files').insertOne(dbFile);
      return res.status(201).send({
        id: dbFile._id,
        userId: dbFile.userId,
        name: dbFile.name,
        type: dbFile.type,
        isPublic: dbFile.isPublic,
        parentId: dbFile.parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const filename = uuidv4();
    const data = Buffer.from(body.data, 'base64');

    fs.mkdir(folderPath, { recursive: true }, (err) => {
      if (err) console.log(err.message);
      return true;
    });

    fs.writeFile(`${folderPath}/${filename}`, data, (err) => {
      if (err) console.log(err);
      return true;
    });

    dbFile.localPath = `${folderPath}/${filename}`;
    await dbClient.db.collection('files').insertOne(dbFile);
    return res.status(201).json(dbFile);
  }
}

module.exports = FilesController;
