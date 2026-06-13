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
    category: req.body.category || 'practice',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  invitations.push(newInvitation);
  writeJSON('invitations.json', invitations);

  const users = readJSON('users.json', []);
  const inviter = users.find(u => u.id === newInvitation.inviterId);
  const category = newInvitation.category || 'practice';
  
  if (newInvitation.inviteeId) {
    const type = category === 'audition' ? 'audition_request' : 'invitation_request';
    const title = category === 'audition' ? '新的试奏预约' : '新的练习邀约';
    const content = category === 'audition'
      ? `${inviter?.username || '用户'} 预约试奏您的乐器`
      : `${inviter?.username || '用户'} 邀请你一起练琴`;
    createNotification({
      userId: newInvitation.inviteeId,
      type,
      title,
      content,
      data: { invitationId: newInvitation.id, inviterId: newInvitation.inviterId, category }
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
  const category = invitations[idx].category || 'practice';

  if (newStatus === 'accepted' && oldStatus !== 'accepted') {
    const type = category === 'audition' ? 'audition_accepted' : 'invitation_accepted';
    const title = category === 'audition' ? '试奏预约已接受' : '邀约已接受';
    const content = category === 'audition'
      ? `${invitee?.username || '用户'} 已接受您的试奏预约`
      : `${invitee?.username || '用户'} 已接受你的练琴邀约`;
    createNotification({
      userId: invitations[idx].inviterId,
      type,
      title,
      content,
      data: { invitationId: invitations[idx].id, inviteeId: invitations[idx].inviteeId, category }
    });
  }

  if (newStatus === 'rejected' && oldStatus !== 'rejected') {
    const type = category === 'audition' ? 'audition_rejected' : 'invitation_rejected';
    const title = category === 'audition' ? '试奏预约被婉拒' : '邀约被婉拒';
    const content = category === 'audition'
      ? `${invitee?.username || '用户'} 婉拒了您的试奏预约`
      : `${invitee?.username || '用户'} 婉拒了你的练琴邀约`;
    createNotification({
      userId: invitations[idx].inviterId,
      type,
      title,
      content,
      data: { invitationId: invitations[idx].id, inviteeId: invitations[idx].inviteeId, category }
    });
  }

  if (newStatus === 'completed' && oldStatus !== 'completed') {
    const type = category === 'audition' ? 'audition_completed' : 'invitation_completed';
    const title = category === 'audition' ? '试奏已完成' : '练琴已完成';
    const content1 = category === 'audition'
      ? `与 ${invitee?.username || '用户'} 的试奏已完成，请互评`
      : `与 ${invitee?.username || '用户'} 的练琴已标记完成，请互评`;
    const content2 = category === 'audition'
      ? `与 ${inviter?.username || '用户'} 的试奏已完成，请互评`
      : `与 ${inviter?.username || '用户'} 的练琴已标记完成，请互评`;
    createNotification({
      userId: invitations[idx].inviterId,
      type,
      title,
      content: content1,
      data: { invitationId: invitations[idx].id, category }
    });
    createNotification({
      userId: invitations[idx].inviteeId,
      type,
      title,
      content: content2,
      data: { invitationId: invitations[idx].id, category }
    });
  }
  
  writeJSON('invitations.json', invitations);
  res.json({ success: true, invitation: invitations[idx] });
});

module.exports = router;
