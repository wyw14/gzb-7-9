<template>
  <div class="notifications-page">
    <div class="page-header">
      <div class="container">
        <h1>🔔 通知中心</h1>
        <p>查看你的借用申请、试奏预约、练习邀约、归还确认和互评通知</p>
      </div>
    </div>

    <div class="container">
      <div class="notifications-toolbar">
        <div class="toolbar-left">
          <el-tag v-if="notifStore.unreadCount > 0" type="danger" size="large" round>
            {{ notifStore.unreadCount }} 条未读
          </el-tag>
          <el-tag v-else type="success" size="large" round>全部已读</el-tag>
        </div>
        <div class="toolbar-right">
          <el-button
            v-if="notifStore.unreadCount > 0"
            type="primary"
            size="small"
            @click="markAllRead"
          >
            <el-icon><CircleCheck /></el-icon>
            全部标记已读
          </el-button>
        </div>
      </div>

      <div v-if="notifStore.notifications.length" class="notif-list">
        <div
          v-for="n in notifStore.notifications"
          :key="n.id"
          class="notif-item card"
          :class="{ unread: !n.read }"
        >
          <div class="notif-icon" :class="typeClass(n.type)">
            <el-icon size="22"><component :is="typeIcon(n.type)" /></el-icon>
          </div>
          <div class="notif-body">
            <div class="notif-title-row">
              <span class="notif-title">{{ n.title }}</span>
              <span class="notif-type-badge" :class="typeClass(n.type)">{{ typeLabel(n.type) }}</span>
            </div>
            <p class="notif-content">{{ n.content }}</p>
            <div class="notif-meta">
              <span class="notif-time">{{ formatTime(n.createdAt) }}</span>
              <span v-if="n.read && n.readAt" class="notif-read-time">已读于 {{ formatTime(n.readAt) }}</span>
            </div>
          </div>
          <div class="notif-actions">
            <el-button
              v-if="!n.read"
              type="primary"
              size="small"
              text
              @click="markRead(n)"
            >
              标记已读
            </el-button>
            <router-link
              v-if="getLink(n)"
              :to="getLink(n)"
              class="notif-link-btn"
            >
              <el-button type="primary" size="small" text>查看详情</el-button>
            </router-link>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <el-icon><Bell /></el-icon>
        <p>暂无通知</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useNotificationStore } from '../stores/notifications'
import { ElMessage } from 'element-plus'

const notifStore = useNotificationStore()

const typeConfig = {
  borrow_request: { label: '借用申请', icon: 'Goods', cls: 'type-borrow' },
  borrow_confirmed: { label: '借用通过', icon: 'CircleCheck', cls: 'type-borrow' },
  borrow_rejected: { label: '借用拒绝', icon: 'CircleClose', cls: 'type-borrow' },
  borrow_returned: { label: '归还确认', icon: 'RefreshRight', cls: 'type-return' },
  invitation_request: { label: '练习邀约', icon: 'User', cls: 'type-invite' },
  invitation_accepted: { label: '邀约接受', icon: 'CircleCheck', cls: 'type-invite' },
  invitation_rejected: { label: '邀约拒绝', icon: 'CircleClose', cls: 'type-invite' },
  invitation_completed: { label: '邀约完成', icon: 'CircleCheck', cls: 'type-invite' },
  audition_request: { label: '试奏预约', icon: 'MagicStick', cls: 'type-audition' },
  audition_accepted: { label: '试奏接受', icon: 'CircleCheck', cls: 'type-audition' },
  audition_rejected: { label: '试奏拒绝', icon: 'CircleClose', cls: 'type-audition' },
  audition_completed: { label: '试奏完成', icon: 'CircleCheck', cls: 'type-audition' },
  review_received: { label: '互评完成', icon: 'Star', cls: 'type-review' }
}

const typeLabel = (type) => typeConfig[type]?.label || '通知'
const typeIcon = (type) => typeConfig[type]?.icon || 'Bell'
const typeClass = (type) => typeConfig[type]?.cls || 'type-default'

const getLink = (n) => {
  if (!n.data) return null
  if (n.data.borrowId) return '/messages'
  if (n.data.invitationId) return '/messages'
  return null
}

const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const markRead = async (n) => {
  await notifStore.markRead(n.id)
}

const markAllRead = async () => {
  await notifStore.markAllRead()
  ElMessage.success('已全部标记为已读')
}

onMounted(() => {
  notifStore.fetchNotifications()
})
</script>

<style scoped>
.notifications-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 0 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notif-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  transition: all 0.2s;
}

.notif-item.unread {
  background: #f0f4ff;
  border-left: 3px solid var(--primary-color);
}

.notif-item.unread:hover {
  background: #e8edff;
}

.notif-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.type-borrow {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
}

.type-return {
  background: linear-gradient(135deg, #10b981, #059669);
}

.type-invite {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.type-review {
  background: linear-gradient(135deg, #ec4899, #db2777);
}

.type-audition {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.type-default {
  background: linear-gradient(135deg, #6b7280, #4b5563);
}

.notif-body {
  flex: 1;
  min-width: 0;
}

.notif-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.notif-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.notif-type-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: white;
}

.notif-type-badge.type-borrow {
  background: #6366f1;
}

.notif-type-badge.type-return {
  background: #10b981;
}

.notif-type-badge.type-invite {
  background: #f59e0b;
}

.notif-type-badge.type-review {
  background: #ec4899;
}

.notif-type-badge.type-audition {
  background: #8b5cf6;
}

.notif-type-badge.type-default {
  background: #6b7280;
}

.notif-content {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.5;
}

.notif-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #9ca3af;
}

.notif-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.notif-link-btn {
  display: inline-block;
}
</style>
