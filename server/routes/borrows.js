const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/storage');
const { createNotification } = require('./notifications');

const router = express.Router();

router.get('/', (req, res) => {
  const borrows = readJSON('borrows.json', []);
  const instruments = readJSON('instruments.json', []);
  const users = readJSON('users.json', []);
  const reviews = readJSON('reviews.json', []);
  const { borrowerId, ownerId, status, currentUserId } = req.query;
  
  let result = borrows;
  
  if (borrowerId) {
    result = result.filter(b => b.borrowerId === borrowerId);
  }
  if (ownerId) {
    result = result.filter(b => b.ownerId === ownerId);
  }
  if (status) {
    result = result.filter(b => b.status === status);
  }
  
  const enriched = result.map(b => {
    const borrowerReviewed = reviews.some(r => 
      r.targetType === 'borrow' && 
      r.targetId === b.id && 
      r.reviewerId === b.borrowerId
    );
    const ownerReviewed = reviews.some(r => 
      r.targetType === 'borrow' && 
      r.targetId === b.id && 
      r.reviewerId === b.ownerId
    );
    
    let myReviewed = false;
    let canReviewOther = false;
    if (currentUserId) {
      if (currentUserId === b.borrowerId) {
        myReviewed = borrowerReviewed;
        canReviewOther = b.status === 'returned' && !borrowerReviewed;
      } else if (currentUserId === b.ownerId) {
        myReviewed = ownerReviewed;
        canReviewOther = b.status === 'returned' && !ownerReviewed;
      }
    }
    
    return {
      ...b,
      borrowerReviewed,
      ownerReviewed,
      myReviewed,
      canReviewOther,
      instrument: instruments.find(i => i.id === b.instrumentId) || null,
      borrower: users.find(u => u.id === b.borrowerId) || null,
      owner: users.find(u => u.id === b.ownerId) || null
    };
  });
  
  res.json(enriched);
});

router.get('/:id', (req, res) => {
  const borrows = readJSON('borrows.json', []);
  const instruments = readJSON('instruments.json', []);
  const users = readJSON('users.json', []);
  const borrow = borrows.find(b => b.id === req.params.id);
  
  if (!borrow) {
    return res.status(404).json({ error: '借用记录不存在' });
  }
  
  const result = {
    ...borrow,
    instrument: instruments.find(i => i.id === borrow.instrumentId) || null,
    borrower: users.find(u => u.id === borrow.borrowerId) || null,
    owner: users.find(u => u.id === borrow.ownerId) || null
  };
  
  res.json(result);
});

router.post('/', (req, res) => {
  const borrows = readJSON('borrows.json', []);
  
  const newBorrow = {
    id: 'b' + uuidv4().slice(0, 8),
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  borrows.push(newBorrow);
  writeJSON('borrows.json', borrows);

  const instruments = readJSON('instruments.json', []);
  const users = readJSON('users.json', []);
  const inst = instruments.find(i => i.id === newBorrow.instrumentId);
  const borrower = users.find(u => u.id === newBorrow.borrowerId);
  if (newBorrow.ownerId) {
    createNotification({
      userId: newBorrow.ownerId,
      type: 'borrow_request',
      title: '新的借用申请',
      content: `${borrower?.username || '用户'} 申请借用您的「${inst?.name || '乐器'}」`,
      data: { borrowId: newBorrow.id, instrumentId: newBorrow.instrumentId, borrowerId: newBorrow.borrowerId }
    });
  }

  res.json({ success: true, borrow: newBorrow });
});

router.put('/:id', (req, res) => {
  const borrows = readJSON('borrows.json', []);
  const instruments = readJSON('instruments.json', []);
  const idx = borrows.findIndex(b => b.id === req.params.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: '借用记录不存在' });
  }
  
  const newStatus = req.body.status;
  const oldStatus = borrows[idx].status;
  
  borrows[idx] = { ...borrows[idx], ...req.body, id: borrows[idx].id };
  
  if (newStatus === 'confirmed' && oldStatus !== 'confirmed') {
    borrows[idx].confirmedAt = new Date().toISOString();
    borrows[idx].status = 'borrowing';
    const instIdx = instruments.findIndex(i => i.id === borrows[idx].instrumentId);
    if (instIdx !== -1) {
      instruments[instIdx].status = 'borrowed';
      writeJSON('instruments.json', instruments);
    }
    const inst = instruments.find(i => i.id === borrows[idx].instrumentId);
    createNotification({
      userId: borrows[idx].borrowerId,
      type: 'borrow_confirmed',
      title: '借用申请已通过',
      content: `您申请借用「${inst?.name || '乐器'}」已通过，请按时取用`,
      data: { borrowId: borrows[idx].id, instrumentId: borrows[idx].instrumentId }
    });
  }
  
  if (newStatus === 'borrowing' && oldStatus === 'confirmed') {
    borrows[idx].status = 'borrowing';
  }

  if (newStatus === 'rejected' && oldStatus !== 'rejected') {
    const inst = instruments.find(i => i.id === borrows[idx].instrumentId);
    createNotification({
      userId: borrows[idx].borrowerId,
      type: 'borrow_rejected',
      title: '借用申请被拒绝',
      content: `您申请借用「${inst?.name || '乐器'}」被拒绝`,
      data: { borrowId: borrows[idx].id, instrumentId: borrows[idx].instrumentId }
    });
  }
  
  if (newStatus === 'returned' && oldStatus !== 'returned') {
    borrows[idx].returnedAt = new Date().toISOString();
    borrows[idx].status = 'returned';
    const instIdx = instruments.findIndex(i => i.id === borrows[idx].instrumentId);
    if (instIdx !== -1) {
      instruments[instIdx].status = 'available';
      writeJSON('instruments.json', instruments);
    }
    const inst = instruments.find(i => i.id === borrows[idx].instrumentId);
    createNotification({
      userId: borrows[idx].borrowerId,
      type: 'borrow_returned',
      title: '乐器归还确认',
      content: `您借用的「${inst?.name || '乐器'}」已被确认归还，请互评`,
      data: { borrowId: borrows[idx].id, instrumentId: borrows[idx].instrumentId }
    });
    createNotification({
      userId: borrows[idx].ownerId,
      type: 'borrow_returned',
      title: '乐器归还确认',
      content: `您出借的「${inst?.name || '乐器'}」已确认归还，请互评`,
      data: { borrowId: borrows[idx].id, instrumentId: borrows[idx].instrumentId }
    });
  }
  
  writeJSON('borrows.json', borrows);
  res.json({ success: true, borrow: borrows[idx] });
});

module.exports = router;
