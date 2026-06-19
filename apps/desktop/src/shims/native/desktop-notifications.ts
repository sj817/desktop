// Native desktop notifications, backed by the Tauri commands in
// src-tauri/src/commands/notifications.rs. The renderer's show-notification.ts
// uses the native path (invokeShowNotification -> id -> notification-event)
// whenever supportsNotifications() is true.
export type DesktopNotificationPermission = 'default' | 'granted' | 'denied'
export type NotificationCallback<T> = (event: T) => void

// We provide a native toast on every desktop platform.
export const supportsNotifications = () => true
// Desktop platforms grant notifications to the installed app, so there is no
// permission prompt to surface in the UI.
export const supportsNotificationsPermissionRequest = () => false
export const getNotificationsPermission =
  async (): Promise<DesktopNotificationPermission> => 'granted'
export const requestNotificationsPermission = async () => true
export const initializeNotifications = () => {}
export const terminateNotifications = () => {}
// Click events arrive over the 'notification-event' IPC channel handled by
// lib/notifications/notification-handler.ts, not through this callback.
export const onNotificationEvent = () => () => {}
export const getNotificationSettingsUrl = () => ''
