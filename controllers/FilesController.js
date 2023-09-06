import fs from 'fs';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const mime = require('mime-types');

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

  static async getShow(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) {
      return res.json({ error: 'Unauthorized' });
    }

    const { id } = req.params || '';
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(user._id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.send(file);
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) {
      return res.json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || 0; // Default to root
    const page = req.query.page || 0; // Default to the first page
    const pageSize = 20;
    try {
      const files = await dbClient.db.collection('files').aggregate([
        { $match: { $and: [{ parentId }] } },
        { $skip: page * pageSize },
        { $limit: pageSize }]).toArray();
      if (files) {
        return res.send(files);
      }
    } catch (err) {
      console.log(err);
    }
    return res.json([]);
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) {
      return res.json({ error: 'Unauthorized' });
    }

    const { id } = req.params || '';
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(user._id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    try {
      await dbClient.db.collection('files').updateOne({ _id: ObjectId(id), userId: ObjectId(user._id) },
        { $set: { isPublic: true } });
      file.isPublic = true;
      return res.status(200).send(file);
    } catch (err) {
      console.log(err);
    }
    return res.status(500).send('error while updateing');
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) {
      return res.json({ error: 'Unauthorized' });
    }

    const { id } = req.params || '';
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(user._id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    try {
      await dbClient.db.collection('files').updateOne({ _id: ObjectId(id), userId: ObjectId(user._id) },
        { $set: { isPublic: false } });
      file.isPublic = false;
      return res.status(200).send(file);
    } catch (err) {
      console.log(err);
    }
    return res.status(500).send('error while updateing');
  }

  static async getFile(req, res) {
    const { id } = req.params || '';
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.isPublic === false) {
      const token = req.header('X-Token') || null;
      if (!token) return res.status(404).send({ error: 'Not found' });

      const redisToken = await redisClient.get(`auth_${token}`);
      if (!redisToken) return res.status(404).send({ error: 'Not found' });
      console.log('redistoken !== userid');
      console.log(redisToken, file.userId);
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
      if (!user) {
        return res.json({ error: 'Not found' });
      }
      if (file.userId === user._id) return res.status(404).send({ error: 'Not found' });
    }

    if (file.type === 'folder') return res.status(400).send({ error: "A folder doesn't have content " });
    console.log('fs.exists');
    if (!fs.existsSync(file.localPath)) return res.status(404).send({ error: 'Not found' });

    res.setHeader('Content-Type', mime.lookup(file.name));
    fs.readFile(file.localPath, (err, content) => {
      if (err) {
        console.log(err);
      }
      return res.send(content);
    });
    return res.send('could not read data');
  }
}

module.exports = FilesController;
