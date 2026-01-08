# 🔄 Authentication Flow

## How Authentication Works in QuillLearn

---

## 📍 User Journey

### **1. First Visit (Not Authenticated)**

```
User visits http://localhost:5180
         ↓
App checks authentication status
         ↓
User is NOT authenticated
         ↓
ProtectedRoute redirects to /login
         ↓
User sees Login page
```

---

### **2. Registration Flow**

```
User clicks "Create Account" on Login page
         ↓
Navigates to /register
         ↓
User fills out registration form:
  - Email
  - Username
  - Password
  - Confirm Password
         ↓
Form validates:
  ✓ Email format
  ✓ Username (3-20 chars, alphanumeric + underscore)
  ✓ Password strength (8+ chars, uppercase, lowercase, number)
  ✓ Passwords match
         ↓
POST /api/auth/register
         ↓
Server validates and creates user:
  ✓ Email not already registered
  ✓ Username not already taken
  ✓ Password hashed with bcrypt
  ✓ User saved to database
  ✓ JWT token generated
         ↓
Response sent with:
  - User data (without password)
  - JWT token
         ↓
Frontend stores:
  - Token in localStorage
  - User data in localStorage
  - Token in HTTP-only cookie
         ↓
AuthContext updates:
  - user state set
  - isAuthenticated = true
         ↓
User redirected to / (Home - Main Application)
         ↓
User sees their sheets and notes
```

---

### **3. Login Flow**

```
User enters credentials on /login
         ↓
Form submits:
  - Email or Username
  - Password
         ↓
POST /api/auth/login
         ↓
Server validates:
  ✓ User exists (by email or username)
  ✓ Password matches (bcrypt compare)
  ✓ JWT token generated
         ↓
Response sent with:
  - User data (without password)
  - JWT token
         ↓
Frontend stores:
  - Token in localStorage
  - User data in localStorage
  - Token in HTTP-only cookie
         ↓
AuthContext updates:
  - user state set
  - isAuthenticated = true
         ↓
User redirected to / (Home - Main Application)
         ↓
User sees their sheets and notes
```

---

### **4. Already Authenticated**

```
Authenticated user visits /login or /register
         ↓
useEffect checks isAuthenticated
         ↓
isAuthenticated = true
         ↓
Automatically redirects to / (Home)
         ↓
User sees main application
```

---

### **5. Protected Route Access**

```
User tries to access /sheets, /notes, /learn, etc.
         ↓
ProtectedRoute component checks authentication
         ↓
Is user authenticated?
  ├─ YES → Render the requested page
  └─ NO  → Redirect to /login
```

---

### **6. Logout Flow**

```
User clicks logout in UserProfile dropdown
         ↓
POST /api/auth/logout
         ↓
Server clears HTTP-only cookie
         ↓
Frontend clears:
  - Token from localStorage
  - User data from localStorage
         ↓
AuthContext updates:
  - user state = null
  - isAuthenticated = false
         ↓
User redirected to /login
         ↓
User sees login page
```

---

### **7. Page Refresh (Authenticated)**

```
User refreshes page while authenticated
         ↓
App loads
         ↓
AuthProvider checks localStorage for token
         ↓
Token found
         ↓
GET /api/auth/verify (with token)
         ↓
Server verifies JWT token
  ├─ Valid → Returns user data
  └─ Invalid → Returns error
         ↓
If valid:
  - AuthContext sets user state
  - isAuthenticated = true
  - User stays on current page
         ↓
If invalid:
  - Clear localStorage
  - Redirect to /login
```

---

## 🔐 Security Checkpoints

### **Every Protected Route**
1. ProtectedRoute checks `isAuthenticated`
2. If false → Redirect to `/login`
3. If true → Render component

### **Every API Call to Protected Endpoints**
1. Token sent in Authorization header
2. Server middleware verifies JWT
3. If invalid → 401 Unauthorized
4. If valid → Process request

### **Login/Register Pages**
1. Check if already authenticated
2. If yes → Redirect to `/` (main app)
3. If no → Show login/register form

---

## 📱 Main Application Entry Point

**After successful authentication, users are redirected to:**

```
/ (Home Page)
```

**This shows:**
- ✅ List of all sheets and notes
- ✅ Filter buttons (All, Sheets, Notes)
- ✅ Create new sheet/note buttons
- ✅ Header with navigation
- ✅ User profile dropdown

---

## 🎯 Route Protection Summary

| Route | Protected | Redirect If Not Authenticated |
|-------|-----------|-------------------------------|
| `/login` | No | Redirect to `/` if authenticated |
| `/register` | No | Redirect to `/` if authenticated |
| `/` | Yes | Redirect to `/login` |
| `/sheets` | Yes | Redirect to `/login` |
| `/sheets/:id` | Yes | Redirect to `/login` |
| `/notes` | Yes | Redirect to `/login` |
| `/notes/:id` | Yes | Redirect to `/login` |
| `/learn` | Yes | Redirect to `/login` |
| `/learn/:id` | Yes | Redirect to `/login` |

---

## ✅ Current Behavior

1. **Not authenticated** → Redirected to `/login`
2. **Login/Register success** → Redirected to `/` (main app with sheets/notes)
3. **Already authenticated + visit /login** → Redirected to `/` (main app)
4. **Logout** → Redirected to `/login`
5. **Token expires** → Redirected to `/login`
6. **Page refresh while authenticated** → Stay on current page

---

**Your authentication flow is complete and working!** 🎉

