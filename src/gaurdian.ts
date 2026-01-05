/**
 * SessionInfo - Generic type for session information
 * @property title - Session/document title
 * @property storageKey - localStorage key for this session
 * @property sessionId - Unique session identifier
 * @property lastTimeSaved - Timestamp of last save (optional)
 */
export type SessionInfo = {
  title: string
  storageKey: string
  sessionId: string
  lastTimeSaved?: number
}
