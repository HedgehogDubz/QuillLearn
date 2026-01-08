# 🔑 How to Get User ID in React Components

## Quick Answer

Use the `useAuth()` hook from `AuthContext`:

```typescript
import { useAuth } from './auth/AuthContext';

function MyComponent() {
    const { user } = useAuth();
    
    // Access user ID
    const userId = user?.id;
    
    // Access other user properties
    const email = user?.email;
    const username = user?.username;
    
    return <div>User ID: {userId}</div>;
}
```

---

## 📚 Complete Guide

### **1. In React Components**

<augment_code_snippet path="src/sheets/InputGrid.tsx" mode="EXCERPT">
````typescript
import { useAuth } from '../auth/AuthContext';

function InputGrid({ sessionId }: InputGridProps) {
    // Get user from auth context
    const { user } = useAuth();
    
    // Now you can access:
    const userId = user?.id;        // User ID
    const email = user?.email;      // User email
    const username = user?.username; // Username
    
    // Use it in your logic
    console.log('Current user ID:', userId);
}
````
</augment_code_snippet>

---

### **2. Passing userId to Utility Functions**

When you need to pass `userId` to non-React utility functions (like `sheetStorage.ts`):

<augment_code_snippet path="src/sheets/InputGrid.tsx" mode="EXCERPT">
````typescript
const saveToLocalStorage = useCallback(() => {
    const result = saveSheetData(
        sessionId, 
        title, 
        grid, 
        columnWidths, 
        lastSavedDataRef.current, 
        user?.id || null  // ✅ Pass userId here
    );
    
    if (result.success && result.serializedData) {
        lastSavedDataRef.current = result.serializedData;
        setIsSaved(true);
    }
}, [sessionId, title, grid, columnWidths, user?.id]);
````
</augment_code_snippet>

**Important:** Add `user?.id` to the dependency array!

---

### **3. Available User Properties**

The `user` object from `useAuth()` contains:

```typescript
interface User {
    id: string;        // Unique user ID
    email: string;     // User's email
    username: string;  // User's username
}
```

**Example:**
```typescript
const { user } = useAuth();

console.log(user?.id);       // "1767823816309e9lq2r5xc"
console.log(user?.email);    // "test@example.com"
console.log(user?.username); // "testuser"
```

---

### **4. Checking if User is Authenticated**

```typescript
import { useAuth } from './auth/AuthContext';

function MyComponent() {
    const { user, isAuthenticated } = useAuth();
    
    if (!isAuthenticated) {
        return <div>Please log in</div>;
    }
    
    // User is authenticated, safe to access user properties
    return <div>Welcome, {user.username}!</div>;
}
```

---

### **5. Using userId in API Calls**

```typescript
import { useAuth } from './auth/AuthContext';

function MyComponent() {
    const { user } = useAuth();
    
    const saveData = async () => {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                userId: user?.id,
                data: myData
            })
        });
    };
}
```

---

### **6. Using userId in useEffect**

```typescript
import { useAuth } from './auth/AuthContext';

function MyComponent() {
    const { user } = useAuth();
    
    useEffect(() => {
        if (user?.id) {
            console.log('User logged in:', user.id);
            // Fetch user-specific data
            fetchUserData(user.id);
        }
    }, [user?.id]); // ✅ Add to dependency array
}
```

---

### **7. Conditional Rendering Based on User**

```typescript
import { useAuth } from './auth/AuthContext';

function MyComponent() {
    const { user, isAuthenticated } = useAuth();
    
    return (
        <div>
            {isAuthenticated ? (
                <div>
                    <h1>Welcome, {user.username}!</h1>
                    <p>Your ID: {user.id}</p>
                    <p>Email: {user.email}</p>
                </div>
            ) : (
                <div>Please log in to continue</div>
            )}
        </div>
    );
}
```

---

### **8. Using All Auth Context Properties**

```typescript
import { useAuth } from './auth/AuthContext';

function MyComponent() {
    const { 
        user,           // User object (id, email, username)
        loading,        // Boolean - true while checking auth
        isAuthenticated, // Boolean - true if logged in
        login,          // Function - login(user, token)
        logout          // Function - logout()
    } = useAuth();
    
    if (loading) {
        return <div>Loading...</div>;
    }
    
    if (!isAuthenticated) {
        return <div>Not logged in</div>;
    }
    
    return (
        <div>
            <p>User ID: {user.id}</p>
            <button onClick={logout}>Logout</button>
        </div>
    );
}
```

---

### **9. Example: Save Data with User ID**

Here's a complete example of saving data with the user ID:

```typescript
import { useAuth } from '../auth/AuthContext';
import { saveSheetData } from './sheetStorage';

function MySheet() {
    const { user } = useAuth();
    const [title, setTitle] = useState('My Sheet');
    const [grid, setGrid] = useState([]);
    
    const handleSave = () => {
        // Pass userId to save function
        const result = saveSheetData(
            sessionId,
            title,
            grid,
            columnWidths,
            lastSavedData,
            user?.id || null  // ✅ Pass userId
        );
        
        if (result.success) {
            console.log('Saved with user ID:', user?.id);
        }
    };
    
    return (
        <div>
            <button onClick={handleSave}>Save</button>
        </div>
    );
}
```

---

## ⚠️ Important Notes

### **Always Use Optional Chaining**
```typescript
// ✅ Good - handles null/undefined
const userId = user?.id;

// ❌ Bad - will crash if user is null
const userId = user.id;
```

### **Handle Null/Undefined**
```typescript
// ✅ Good - provides fallback
const userId = user?.id || null;
const userId = user?.id ?? 'anonymous';

// ✅ Good - check before using
if (user?.id) {
    doSomething(user.id);
}
```

### **Add to Dependency Arrays**
```typescript
// ✅ Good - includes user?.id in dependencies
useEffect(() => {
    fetchData(user?.id);
}, [user?.id]);

// ❌ Bad - missing dependency
useEffect(() => {
    fetchData(user?.id);
}, []); // ESLint warning!
```

---

## 🎯 Summary

**To get the user ID in any React component:**

1. Import `useAuth` hook
2. Call `const { user } = useAuth()`
3. Access `user?.id` (with optional chaining)
4. Handle null/undefined cases
5. Add to dependency arrays when needed

**Example:**
```typescript
import { useAuth } from './auth/AuthContext';

function MyComponent() {
    const { user } = useAuth();
    const userId = user?.id;
    
    return <div>User ID: {userId}</div>;
}
```

That's it! 🎉

