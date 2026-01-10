# Integration Guide: Adding Collaboration to Sheets and Notes

This guide shows how to integrate the sharing and collaboration features into your existing sheet and note components.

## For Sheets (InputGrid.tsx)

### 1. Import Required Components

```tsx
import { PresenceService, UserPresence } from '../collaboration/PresenceService';
import { ActiveUsers } from '../collaboration/ActiveUsers';
import { CursorOverlay } from '../collaboration/CursorOverlay';
import { ShareModal } from '../components/ShareModal';
```

### 2. Add State Variables

```tsx
const [presenceService, setPresenceService] = useState<PresenceService | null>(null);
const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
const [shareModalOpen, setShareModalOpen] = useState(false);
const [userPermission, setUserPermission] = useState<'owner' | 'edit' | 'view'>('owner');
```

### 3. Initialize Presence Service

```tsx
useEffect(() => {
  if (!sessionId || !user) return;

  const service = new PresenceService(
    sessionId,
    'sheet',
    user.id,
    user.name,
    user.email
  );

  service.start();
  
  const unsubscribe = service.subscribe((users) => {
    setActiveUsers(users);
  });

  setPresenceService(service);

  return () => {
    unsubscribe();
    service.stop();
  };
}, [sessionId, user]);
```

### 4. Track Cursor Position

```tsx
const handleCellClick = (row: number, col: number) => {
  setSelectedCell({ row, col });
  
  // Update cursor position for other users
  if (presenceService) {
    const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cellElement) {
      const rect = cellElement.getBoundingClientRect();
      presenceService.updateCursor({
        row,
        col,
        x: rect.left,
        y: rect.top
      });
    }
  }
};
```

### 5. Add UI Components

```tsx
return (
  <div className="sheet-container">
    {/* Active Users Display */}
    <ActiveUsers users={activeUsers} />
    
    {/* Share Button in Header */}
    <button onClick={() => setShareModalOpen(true)}>
      Share
    </button>
    
    {/* Grid Container with Cursor Overlay */}
    <div style={{ position: 'relative' }}>
      <CursorOverlay users={activeUsers} />
      {/* Your existing grid */}
    </div>
    
    {/* Share Modal */}
    {shareModalOpen && (
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        sessionId={sessionId}
        documentType="sheet"
        currentUserId={user.id}
        currentUserPermission={userPermission}
        onShareUpdate={() => {
          // Refresh sheet data if needed
        }}
      />
    )}
  </div>
);
```

### 6. Disable Editing for View-Only Users

```tsx
const handleCellEdit = (row: number, col: number, value: string) => {
  if (userPermission === 'view') {
    alert('You only have view access to this sheet');
    return;
  }
  
  // Continue with edit logic
  updateCell(row, col, value);
};
```

## For Notes (notes.tsx)

### 1. Import Required Components

```tsx
import { PresenceService, UserPresence } from '../collaboration/PresenceService';
import { ActiveUsers } from '../collaboration/ActiveUsers';
import { CursorOverlay } from '../collaboration/CursorOverlay';
import { ShareModal } from '../components/ShareModal';
```

### 2. Add State Variables

```tsx
const [presenceService, setPresenceService] = useState<PresenceService | null>(null);
const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
const [shareModalOpen, setShareModalOpen] = useState(false);
const [userPermission, setUserPermission] = useState<'owner' | 'edit' | 'view'>('owner');
```

### 3. Initialize Presence Service

```tsx
useEffect(() => {
  if (!sessionId || !user) return;

  const service = new PresenceService(
    sessionId,
    'note',
    user.id,
    user.name,
    user.email
  );

  service.start();
  
  const unsubscribe = service.subscribe((users) => {
    setActiveUsers(users);
  });

  setPresenceService(service);

  return () => {
    unsubscribe();
    service.stop();
  };
}, [sessionId, user]);
```

### 4. Track Cursor Position in Editor

```tsx
const handleSelectionChange = (range: any) => {
  if (!presenceService || !range) return;
  
  const bounds = quillRef.current?.getBounds(range.index);
  if (bounds) {
    presenceService.updateCursor({
      x: bounds.left,
      y: bounds.top
    });
  }
};

// Add to Quill initialization
quillRef.current?.on('selection-change', handleSelectionChange);
```

### 5. Make Editor Read-Only for View Users

```tsx
useEffect(() => {
  if (quillRef.current) {
    quillRef.current.enable(userPermission !== 'view');
  }
}, [userPermission]);
```

### 6. Add UI Components

```tsx
return (
  <div className="note-container">
    {/* Active Users Display */}
    <ActiveUsers users={activeUsers} />
    
    {/* Share Button in Header */}
    <button onClick={() => setShareModalOpen(true)}>
      Share
    </button>
    
    {/* Editor Container with Cursor Overlay */}
    <div style={{ position: 'relative' }}>
      <CursorOverlay users={activeUsers} />
      {/* Your Quill editor */}
    </div>
    
    {/* Share Modal */}
    {shareModalOpen && (
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        sessionId={sessionId}
        documentType="note"
        currentUserId={user.id}
        currentUserPermission={userPermission}
      />
    )}
  </div>
);
```

## Fetching User Permission

Add this to both components to fetch the user's permission level:

```tsx
useEffect(() => {
  const fetchPermission = async () => {
    try {
      const endpoint = documentType === 'sheet' 
        ? `/api/sheets/${sessionId}`
        : `/api/notes/${sessionId}`;
      
      const response = await fetch(endpoint);
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        
        if (data.user_id === user.id) {
          setUserPermission('owner');
        } else if (data.edit_users?.includes(user.id)) {
          setUserPermission('edit');
        } else if (data.view_users?.includes(user.id)) {
          setUserPermission('view');
        }
      }
    } catch (error) {
      console.error('Error fetching permission:', error);
    }
  };
  
  if (sessionId && user) {
    fetchPermission();
  }
}, [sessionId, user]);
```

## Testing Your Integration

1. Open the document in two different browser windows
2. Verify active users appear in both windows
3. Move cursor in one window, verify it appears in the other
4. Test editing permissions (view users shouldn't be able to edit)
5. Test the share modal functionality

## Troubleshooting

- **Cursors not appearing**: Check that presence service is initialized and cursor positions are being updated
- **Active users not showing**: Verify the presence API endpoints are working
- **Permission errors**: Ensure the database migration was run successfully
- **Share modal not opening**: Check that the ShareModal component is imported correctly

