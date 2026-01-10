/**
 * Real-time Presence Service
 * Tracks who is currently viewing/editing a document
 */

export interface UserPresence {
  userId: string;
  userName?: string;
  userEmail?: string;
  cursorPosition?: {
    row?: number;
    col?: number;
    x?: number;
    y?: number;
  };
  color: string;
  lastSeen: number;
}

export class PresenceService {
  private sessionId: string;
  private documentType: 'sheet' | 'note';
  private currentUserId: string;
  private currentUserName?: string;
  private currentUserEmail?: string;
  private presenceMap: Map<string, UserPresence> = new Map();
  private updateInterval: number | null = null;
  private listeners: Set<(users: UserPresence[]) => void> = new Set();
  private userColor: string;

  // Predefined colors for different users
  private static COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
  ];

  constructor(
    sessionId: string,
    documentType: 'sheet' | 'note',
    userId: string,
    userName?: string,
    userEmail?: string
  ) {
    this.sessionId = sessionId;
    this.documentType = documentType;
    this.currentUserId = userId;
    this.currentUserName = userName;
    this.currentUserEmail = userEmail;
    
    // Assign a color based on user ID hash
    this.userColor = this.getUserColor(userId);
  }

  private getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PresenceService.COLORS[Math.abs(hash) % PresenceService.COLORS.length];
  }

  /**
   * Start tracking presence
   */
  async start() {
    // Update presence immediately
    await this.updatePresence();

    // Update presence every 30 seconds
    this.updateInterval = window.setInterval(() => {
      this.updatePresence();
    }, 30000);

    // Fetch other users' presence
    this.fetchPresence();

    // Poll for presence updates every 5 seconds
    setInterval(() => {
      this.fetchPresence();
    }, 5000);
  }

  /**
   * Stop tracking presence
   */
  async stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Remove our presence
    try {
      await fetch(`/api/presence/${this.sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.currentUserId
        },
        body: JSON.stringify({
          documentType: this.documentType,
          userId: this.currentUserId
        })
      });
    } catch (error) {
      console.error('Error removing presence:', error);
    }
  }

  /**
   * Update cursor position
   */
  async updateCursor(position: { row?: number; col?: number; x?: number; y?: number }) {
    await this.updatePresence(position);
  }

  /**
   * Update presence in database
   */
  private async updatePresence(cursorPosition?: any) {
    try {
      await fetch(`/api/presence/${this.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.currentUserId
        },
        body: JSON.stringify({
          documentType: this.documentType,
          userId: this.currentUserId,
          userName: this.currentUserName,
          userEmail: this.currentUserEmail,
          cursorPosition
        })
      });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }

  /**
   * Fetch presence of other users
   */
  private async fetchPresence() {
    try {
      const response = await fetch(
        `/api/presence/${this.sessionId}?documentType=${this.documentType}`
      );
      const result = await response.json();

      if (result.success && result.data) {
        this.presenceMap.clear();
        
        result.data.forEach((presence: any) => {
          // Skip our own presence
          if (presence.user_id === this.currentUserId) return;

          this.presenceMap.set(presence.user_id, {
            userId: presence.user_id,
            userName: presence.user_name,
            userEmail: presence.user_email,
            cursorPosition: presence.cursor_position,
            color: this.getUserColor(presence.user_id),
            lastSeen: new Date(presence.last_seen).getTime()
          });
        });

        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error fetching presence:', error);
    }
  }

  /**
   * Subscribe to presence updates
   */
  subscribe(callback: (users: UserPresence[]) => void) {
    this.listeners.add(callback);
    // Immediately notify with current state
    callback(Array.from(this.presenceMap.values()));

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of presence changes
   */
  private notifyListeners() {
    const users = Array.from(this.presenceMap.values());
    this.listeners.forEach(callback => callback(users));
  }

  /**
   * Get current active users
   */
  getActiveUsers(): UserPresence[] {
    return Array.from(this.presenceMap.values());
  }

  /**
   * Get user's assigned color
   */
  getMyColor(): string {
    return this.userColor;
  }
}

