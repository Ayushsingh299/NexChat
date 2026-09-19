class NotificationService {
  private hasPermission: boolean = false;
  
  // A generic short base64 beep sound for notifications
  private audio: HTMLAudioElement;

  constructor() {
    this.audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + Array(100).join('A'));
    if ('Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    }

    return false;
  }

  public playSound() {
    try {
      this.audio.play().catch(e => console.log('Audio playback prevented by browser:', e));
    } catch (e) {
      console.error('Failed to play sound', e);
    }
  }

  public showPushNotification(title: string, options?: NotificationOptions) {
    if (this.hasPermission) {
      try {
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          ...options
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      } catch (e) {
        console.error('Push notification failed', e);
      }
    }
  }
}

export const notificationService = new NotificationService();
