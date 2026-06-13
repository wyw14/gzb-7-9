const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/storage');
const { createNotification } = require('./notifications');

const router = express.Router();

router.get('/', (req, res) => {
  const invitations = readJSON('invitations.json', []);
  const users = readJSON('users.json', []);
  const reviews = readJSON('reviews.json', []);
  const { inviterId, inviteeId, status, currentUserId } = req.query;
  
  let result = invitations;
  
  if (inviterId) {
    result = result.filter(i => i.inviterId === inviterId);
  }
  if (inviteeId) {
    result = result.filter(i => i.inviteeId === inviteeId);
  }
  if (status) {
    result = result.filter(i => i.status === status);
  }
  
  const enriched = result.map(inv => {
    const inviterReviewed = reviews.some(r => 
      r.targetType === 'invitation' && 
      r.targetId === inv.id && 
      r.reviewerId === inv.inviterId
    );
    const inviteeReviewed = reviews.some(r => 
      r.targetType === 'invitation' && 
      r.targetId === inv.id && 
      r.reviewerId === inv.inviteeId
    );
    
    let myReviewed = false;
    let canReviewOther = false;
    if (currentUserId) {
      if (currentUserId === inv.inviterId) {
        myReviewed = inviterReviewed;
        canReviewOther = inv.status === 'completed' && !inviterReviewed;
      } else if (currentUserId === inv.inviteeId) {
        myReviewed = inviteeReviewed;
        canReviewOther = inv.status === 'completed' && !inviteeReviewed;
      }
    }
    
    return {
      ...inv,
      inviterReviewed,
      inviteeReviewed,
      myReviewed,
      canReviewOther,
      inviter: users.find(u => u.id === inv.inviterId) || null,
      invitee: users.find(u => u.id === inv.inviteeId) || null
    };
  });
  
  res.json(enriched);
});

router.get('/user/:userId', (req, res) => {
  const invitations = readJSON('invitations.json', []);
  const users = readJSON('users.json', []);
  const reviews = readJSON('reviews.json', []);
  const { userId } = req.params;
  
  const result = invitations.filter(i => 
    i.inviterId === userId || i.inviteeId === userId
  );
  
  const enriched = result.map(inv => {
    const inviterReviewed = reviews.some(r => 
      r.targetType === 'invitation' && 
      r.targetId === inv.id && 
      r.reviewerId === inv.inviterId
    );
    const inviteeReviewed = reviews.some(r => 
      r.targetType === 'invitation' && 
      r.targetId === inv.id && 
      r.reviewerId === inv.inviteeId
    );
    
    let myReviewed = false;
    let canReviewOther = false;
    if (userId) {
      if (userId === inv.inviterId) {
        myReviewed = inviterReviewed;
        canReviewOther = inv.status === 'completed' && !inviterReviewed;
      } else if (userId === inv.inviteeId) {
        myReviewed = inviteeReviewed;
        canReviewOther = inv.status === 'completed' && !inviteeReviewed;
      }
    }
    
    return {
      ...inv,
      inviterReviewed,
      inviteeReviewed,
      myReviewed,
      canReviewOther,
      inviter: users.find(u => u.id === inv.inviterId) || null,
      invitee: users.find(u => u.id === inv.inviteeId) || null
    };
  });
  
  res.json(enriched);
});

router.post('/', (req, res) => {
  const invitations = readJSON('invitations.json', []);
  
  const newInvitation = {
    id: 'inv' + uuidv4().slice(0, 8),
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  invitations.push(newInvitation);
  writeJSON('invitations.json', invitations);

  const users = readJSON('users.json', []);
  const inviter = users.find(u => u.id === newInvitation.inviterId);
  if (newInvitation.inviteeId) {
    createNotification({
      userId: newInvitation.inviteeId,
      type: 'invitation_request',
      title: '新的练习邀约',
      content: `${inviter?.username || '用户'} 邀请你一起练琴`,
      data: { invitationId: newInvitation.id, inviterId: newInvitation.inviterId }
    });
  }

  res.json({ success: true, invitation: newInvitation });
});

router.put('/:id', (req, res) => {
  const invitations = readJSON('invitations.json', []);
  const idx = invitations.findIndex(i => i.id === req.params.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: '邀约不存在' });
  }
  
  const newStatus = req.body.status;
  const oldStatus = invitations[idx].status;
  
  invitations[idx] = { 
    ...invitations[idx], 
    ...req.body, 
    id: invitations[idx].id,
    repliedAt: (newStatus && newStatus !== 'pending' && newStatus !== 'completed')
      ? (invitations[idx].repliedAt || new Date().toISOString())
      : invitations[idx].repliedAt,
    completedAt: newStatus === 'completed' && oldStatus !== 'completed'
      ? new Date().toISOString()
      : invitations[idx].completedAt
  };

  const users = readJSON('users.json', []);
  const invitee = users.find(u => u.id === invitations[idx].inviteeId);
  const inviter = users.find(u => u.id === invitations[idx].inviterId);

  if (newStatus === 'accepted' && oldStatus !== 'accepted') {
    createNotification({
      userId: invitations[idx].inviterId,
      type: 'invitation_accepted',
      title: '邀约已接受',
      content: `${invitee?.username || '用户'} 已接受你的练琴邀约`,
      data: { invitationId: invitations[idx].id, inviteeId: invitations[idx].inviteeId }
    });
  }

  if (newStatus === 'rejected' && oldStatus !== 'rejected') {
    createNotification({
      userId: invitations[idx].inviterId,
      type: 'invitation_rejected',
      title: '邀约被婉拒',
      content: `${invitee?.username || '用户'} 婉拒了你的练琴邀约`,
      data: { invitationId: invitations[idx].id, inviteeId: invitations[idx].inviteeId }
    });
  }

  if (newStatus === 'completed' && oldStatus !== 'completed') {
    createNotification({
      userId: invitations[idx].inviterId,
      type: 'invitation_completed',
      title: '练琴已完成',
      content: `与 ${invitee?.username || '用户'} 的练琴已标记完成，请互评`,
      data: { invitationId: invitations[idx].id }
    });
    createNotification({
      userId: invitations[idx].inviteeId,
      type: 'invitation_completed',
      title: '练琴已完成',
      content: `与 ${inviter?.username || '用户'} 的练琴已标记完成，请互评`,
      data: { invitationId: invitations[idx].id }
    });
  }
  
  writeJSON('invitations.json', invitations);
  res.json({ success: true, invitation: invitations[idx] });
});

module.exports = router;
