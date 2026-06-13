const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/storage');

const router = express.Router();

function createNotification({ userId, type, title, content, data }) {
  const notifications = readJSON('notifications.json', []);
  const n = {
    id: 'n' + uuidv4().slice(0, 8),
    userId,
    type,
    title,
    content,
    data: data || {},
    read: false,
    createdAt: new Date().toISOString()
  };
  notifications.push(n);
  writeJSON('notifications.json', notifications);
  return n;
}

router.get('/', (req, res) => {
  const notifications = readJSON('notifications.json', []);
  const { userId, type, read } = req.query;

  let result = notifications;
  if (userId) result = result.filter(n => n.userId === userId);
  if (type) result = result.filter(n => n.type === type);
  if (read !== undefined) result = result.filter(n => n.read === (read === 'true'));

  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(result);
});

router.get('/unread-count', (req, res) => {
  const notifications = readJSON('notifications.json', []);
  const { userId } = req.query;
  if (!userId) return res.json({ count: 0 });
  const count = notifications.filter(n => n.userId === userId && !n.read).length;
  res.json({ count });
});

router.put('/read-all', (req, res) => {
  const notifications = readJSON('notifications.json', []);
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: '缺少 userId' });
  const now = new Date().toISOString();
  let count = 0;
  notifications.forEach(n => {
    if (n.userId === userId && !n.read) {
      n.read = true;
      n.readAt = now;
      count++;
    }
  });
  writeJSON('notifications.json', notifications);
  res.json({ success: true, count });
});

router.put('/:id/read', (req, res) => {
  const notifications = readJSON('notifications.json', []);
  const idx = notifications.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '通知不存在' });
  notifications[idx].read = true;
  notifications[idx].readAt = new Date().toISOString();
  writeJSON('notifications.json', notifications);
  res.json({ success: true, notification: notifications[idx] });
});

module.exports = { router, createNotification };
