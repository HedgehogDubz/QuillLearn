# 🔐 QuillLearn Authentication System

Complete authentication system with login, registration, and secure password encryption.

---

## 🎯 Features

✅ **User Registration** - Create new accounts with email and username  
✅ **User Login** - Sign in with email/username and password  
✅ **Password Encryption** - Bcrypt hashing with salt rounds  
✅ **JWT Tokens** - Secure token-based authentication  
✅ **HTTP-Only Cookies** - Secure token storage  
✅ **Protected Routes** - Automatic redirect for unauthenticated users  
✅ **Password Validation** - Enforces strong password requirements  
✅ **Email Validation** - Validates email format  
✅ **Username Validation** - Enforces username rules  
✅ **Auth Context** - Global authentication state management  
✅ **Logout Functionality** - Secure session termination  

---

## 📁 File Structure

```
server/
├── models/
│   └── User.js              # User data model (JSON file storage)
├── routes/
│   └── auth.js              # Authentication API routes
├── middleware/
│   └── auth.js              # JWT verification middleware
├── utils/
│   └── auth.js              # Password hashing & JWT utilities
└── data/
    └── users.json           # User data storage (auto-created)

src/
└── auth/
    ├── Login.tsx            # Login page component
    ├── Register.tsx         # Registration page component
    ├── AuthContext.tsx      # Authentication state management
    ├── ProtectedRoute.tsx   # Route protection component
    ├── UserProfile.tsx      # User profile dropdown
    ├── Auth.css             # Auth pages styling
    └── UserProfile.css      # User profile styling
```

---

## 🚀 API Endpoints

### **POST /api/auth/register**
Create a new user account

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2026-01-07T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### **POST /api/auth/login**
Login with email/username and password

**Request Body:**
```json
{
  "emailOrUsername": "johndoe",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "username": "johndoe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### **POST /api/auth/logout**
Logout and clear authentication cookie

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### **GET /api/auth/me**
Get current user information (requires authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

---

### **GET /api/auth/verify**
Verify if token is valid (requires authentication)

**Response:**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

---

## 🔒 Security Features

### **Password Requirements**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### **Username Requirements**
- 3-20 characters
- Letters, numbers, and underscores only

### **Encryption**
- Passwords hashed with **bcrypt** (10 salt rounds)
- JWT tokens signed with secret key
- HTTP-only cookies prevent XSS attacks
- Secure cookies in production (HTTPS only)

---

## 💻 Usage Examples

### **Using Authentication in React**

```tsx
import { useAuth } from './auth/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.username}!</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### **Protecting Routes**

```tsx
import ProtectedRoute from './auth/ProtectedRoute';

<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } 
/>
```

### **Making Authenticated API Calls**

```tsx
const token = localStorage.getItem('token');

const response = await fetch('/api/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  },
  credentials: 'include'
});
```

---

## 🎨 Adding User Profile to Header

Add the UserProfile component to your header:

```tsx
import UserProfile from './auth/UserProfile';

function Header() {
  return (
    <header>
      <nav>
        {/* Your navigation */}
      </nav>
      <UserProfile />
    </header>
  );
}
```

---

## 🔧 Environment Variables

Create a `.env` file in the server directory:

```env
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=development
PORT=3001
```

⚠️ **Important:** Change the JWT_SECRET in production!

---

## 🗄️ Database Migration

Currently using JSON file storage. To migrate to a database:

1. **Install database driver** (e.g., `npm install mongodb` or `npm install pg`)
2. **Update `server/models/User.js`** to use database queries
3. **Keep the same interface** - no changes needed in routes!

---

## ✅ Testing

### **Test Registration**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"Test1234"}'
```

### **Test Login**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"testuser","password":"Test1234"}'
```

---

## 🚀 Next Steps

1. ✅ Authentication system is complete
2. 🔄 Add user profile to your header component
3. 🔄 Migrate from JSON to database (MongoDB, PostgreSQL, etc.)
4. 🔄 Add password reset functionality
5. 🔄 Add email verification
6. 🔄 Add OAuth (Google, GitHub, etc.)

---

**Your authentication system is ready to use!** 🎉

