import { defineStore } from 'pinia'
import { notificationApi } from '../api'

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [],
    unreadCount: 0,
    loaded: false
  }),

  actions: {
    async fetchNotifications() {
      try {
        const userId = localStorage.getItem('userId')
        if (!userId) return
        this.notifications = await notificationApi.list({ userId })
        this.unreadCount = this.notifications.filter(n => !n.read).length
        this.loaded = true
      } catch (e) {
        console.error('获取通知失败', e)
      }
    },

    async fetchUnreadCount() {
      try {
        const userId = localStorage.getItem('userId')
        if (!userId) return
        const result = await notificationApi.unreadCount(userId)
        this.unreadCount = result.count
      } catch (e) {
        console.error('获取未读数失败', e)
      }
    },

    async markRead(id) {
      try {
        await notificationApi.markRead(id)
        const n = this.notifications.find(item => item.id === id)
        if (n && !n.read) {
          n.read = true
          n.readAt = new Date().toISOString()
          this.unreadCount = Math.max(0, this.unreadCount - 1)
        }
      } catch (e) {
        console.error('标记已读失败', e)
      }
    },

    async markAllRead() {
      try {
        const userId = localStorage.getItem('userId')
        if (!userId) return
        await notificationApi.markAllRead(userId)
        this.notifications.forEach(n => {
          if (!n.read) {
            n.read = true
            n.readAt = new Date().toISOString()
          }
        })
        this.unreadCount = 0
      } catch (e) {
        console.error('全部标记已读失败', e)
      }
    }
  }
})
