# 🦔 QuillLearn

A full-stack learning platform for creating and studying with flashcards, notes, diagrams, and spreadsheets. Built with React, TypeScript, and Express.js.

![QuillLearn](public/logo.png)

## 🌟 Features

### 📊 Sheets (Spreadsheets)
- Create study sheets with rows and columns
- Add images to cells
- Import/export functionality
- Mobile-friendly with touch support

### 📝 Notes
- Rich text editor powered by Quill.js
- LaTeX math equation support (KaTeX)
- Drawing canvas for sketches
- Code blocks with Monaco Editor
- Convert notes to study sheets

### 🎨 Diagrams
- Interactive diagram editor with SVG canvas
- Add labels to images for anatomy, geography, etc.
- Multiple label shapes (circle, square, polygon)
- OCR-powered PDF import (Tesseract.js)
- Learn mode with fill-in-the-blank exercises

### 🎴 Learn Mode
- Flashcard-style studying
- Spaced repetition feedback (Easy/Medium/Hard)
- Voice mode with text-to-speech
- Multi-language voice support
- Progress tracking

### 🌐 Discover
- Browse and discover public content
- Like and comment on shared content
- Copy content to your library
- Tag-based filtering

### 👤 User Features
- Email verification for registration
- Password reset via email
- Pixel art avatar generation
- Light/dark theme support

---

## 🏗️ Architecture

```
QuillLearn/
├── src/                    # Frontend (React + TypeScript)
│   ├── App.tsx             # Main app with routing
│   ├── main.tsx            # Entry point
│   │
│   ├── auth/               # Authentication
│   │   ├── AuthContext.tsx # Auth state management
│   │   ├── Login.tsx       # Login page
│   │   ├── Register.tsx    # Registration page
│   │   ├── ForgotPassword.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── VerifyEmail.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── UserProfile.tsx # User menu dropdown
│   │
│   ├── home/               # Dashboard
│   │   └── Home.tsx        # Main dashboard with all content
│   │
│   ├── sheets/             # Spreadsheet feature
│   │   ├── Sheets.tsx      # Sheet container
│   │   ├── InputGrid.tsx   # Spreadsheet grid component
│   │   ├── ImageUploadModal.tsx
│   │   └── sheetStorage.ts # Local storage utilities
│   │
│   ├── notes/              # Notes feature
│   │   ├── notes.tsx       # Rich text editor
│   │   ├── ConvertToSheetModal.tsx
│   │   └── noteStorage.ts
│   │
│   ├── diagrams/           # Diagram feature
│   │   ├── DiagramEditor.tsx  # SVG diagram editor
│   │   ├── DiagramLearn.tsx   # Learn mode for diagrams
│   │   ├── ImportModal.tsx    # PDF import with OCR
│   │   └── types.ts
│   │
│   ├── learn/              # Flashcard learning
│   │   └── learn.tsx       # Flashcard study interface
│   │
│   ├── discover/           # Public content browsing
│   │   ├── Discover.tsx    # Content discovery page
│   │   ├── PublicContent.tsx
│   │   ├── Comments.tsx
│   │   ├── SheetViewer.tsx
│   │   ├── NoteViewer.tsx
│   │   └── DiagramViewer.tsx
│   │
│   ├── components/         # Shared components
│   │   ├── DocumentHeader.tsx  # Reusable header
│   │   ├── DrawingModal.tsx    # Drawing canvas
│   │   ├── LoadingScreen.tsx
│   │   ├── MonacoCodeBlock.tsx # Code editor
│   │   ├── PixelAvatar.tsx     # Avatar generator
│   │   ├── PublishModal.tsx    # Publish to Discover
│   │   └── TagInput.tsx        # Tag management
│   │
│   ├── header/             # Navigation header
│   │   └── header.tsx      # Main nav with hamburger menu
│   │
│   ├── theme/              # Theming
│   │   ├── ThemeContext.tsx
│   │   └── ThemeToggle.tsx
│   │
│   ├── styles/             # Global styles
│   │   ├── design-tokens.css  # CSS variables
│   │   ├── base.css           # Base styles
│   │   └── components.css     # Component styles
│   │
│   ├── lib/
│   │   └── supabaseClient.ts  # Supabase client
│   │
│   └── utils/
│       ├── api.ts             # API helper functions
│       └── pixelArtAvatar.ts  # Avatar generation
│
├── server/                 # Backend (Express.js)
│   ├── index.js            # Server entry point
│   │
│   ├── routes/             # API routes
│   │   ├── auth.js         # Authentication endpoints
│   │   ├── sheets.js       # Sheet CRUD operations
│   │   ├── notes.js        # Note CRUD operations
│   │   ├── diagrams.js     # Diagram CRUD operations
│   │   ├── discover.js     # Public content, likes, comments
│   │   ├── published.js    # Published content management
│   │   ├── storage.js      # File storage (images)
│   │   ├── tts.js          # Text-to-speech proxy
│   │   ├── presence.js     # Real-time collaboration
│   │   └── users.js        # User management
│   │
│   ├── models/
│   │   └── User.js         # User model (Supabase)
│   │
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication
│   │   └── permissions.js  # Authorization checks
│   │
│   ├── utils/
│   │   ├── auth.js         # Token generation
│   │   └── email.js        # Email service (Resend)
│   │
│   ├── config/
│   │   └── supabase.js     # Supabase server client
│   │
│   └── migrations/         # SQL migrations
│       ├── create_users_table.sql
│       └── create_pending_registrations_table.sql
│
├── public/                 # Static assets
│   ├── logo.png            # Hedgehog logo
│   └── quill-logo.svg
│
├── tests/                  # Playwright tests
│   ├── diagrams.spec.ts
│   └── sharing.spec.ts
│
└── supabase/               # Supabase migrations
    └── migrations/
```

---

## 🔧 Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **React Router** | Client-side routing |
| **Quill.js** | Rich text editor |
| **Monaco Editor** | Code blocks |
| **KaTeX** | LaTeX math rendering |
| **Tesseract.js** | OCR for PDF import |
| **PDF.js** | PDF rendering |

### Backend
| Technology | Purpose |
|------------|---------|
| **Express.js** | API server |
| **Supabase** | Database & storage |
| **JWT** | Authentication tokens |
| **bcrypt** | Password hashing |
| **Resend** | Email service |
| **Multer** | File uploads |

### Database (Supabase)
| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `pending_registrations` | Unverified registrations |
| `sheets` | Spreadsheet data |
| `notes` | Note content |
| `diagrams` | Diagram data |
| `published_content` | Public content |
| `likes` | Content likes |
| `comments` | Content comments |

### Deployment
| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend hosting |
| **Railway** | Backend hosting |
| **Supabase** | Database & file storage |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Environment Variables

Create `.env` in the root directory:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Server
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
JWT_SECRET=your_jwt_secret
RESEND_API_KEY=your_resend_api_key
```

### Installation

```bash
# Install dependencies
npm install

# Run frontend dev server
npm run dev

# Run backend server
npm run server:dev

# Run both concurrently
npm run dev:all
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run specific test file
npm run test:diagrams
```

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/verify-email` | Verify email token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### Sheets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sheets/:sessionId` | Get sheet by ID |
| POST | `/api/sheets` | Create/update sheet |
| GET | `/api/sheets/user/:userId` | Get user's sheets |
| DELETE | `/api/sheets/:sessionId` | Delete sheet |

### Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes/:sessionId` | Get note by ID |
| POST | `/api/notes` | Create/update note |
| GET | `/api/notes/user/:userId` | Get user's notes |
| DELETE | `/api/notes/:sessionId` | Delete note |

### Diagrams
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/diagrams/:sessionId` | Get diagram by ID |
| POST | `/api/diagrams` | Create/update diagram |
| GET | `/api/diagrams/user/:userId` | Get user's diagrams |
| DELETE | `/api/diagrams/:sessionId` | Delete diagram |

### Discover
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/discover` | Get public content |
| GET | `/api/discover/:id` | Get specific content |
| POST | `/api/discover/:id/like` | Like content |
| DELETE | `/api/discover/:id/like` | Unlike content |
| GET | `/api/discover/:id/comments` | Get comments |
| POST | `/api/discover/:id/comments` | Add comment |

---

## 🎨 Design System

### CSS Variables (Design Tokens)

```css
/* Colors */
--color-accent-500: #00ff88;     /* Primary accent (neon green) */
--color-warning-500: #fbbf24;    /* Notes (amber) */
--color-purple-500: #a855f7;     /* Diagrams (purple) */
--color-error-500: #ef4444;      /* Errors (red) */
--color-success-500: #22c55e;    /* Success (green) */

/* Spacing */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */

/* Typography */
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;

/* Borders */
--radius-sm: 0.25rem;
--radius-md: 0.375rem;
--radius-lg: 0.5rem;
--radius-xl: 0.75rem;
```

### Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 767px) { }

/* Small mobile */
@media (max-width: 374px) { }
```

---

## 📱 Mobile Support

The application is fully responsive with:
- Hamburger navigation menu
- Touch-friendly controls (44px minimum touch targets)
- Horizontal scrolling toolbars
- Bottom sheet modals
- iOS zoom prevention on inputs

---

## 🔐 Security

- JWT tokens stored in HTTP-only cookies
- Password hashing with bcrypt
- Email verification required for registration
- Protected routes with authentication middleware
- CORS configuration for allowed origins

---

## 📄 License

MIT License - feel free to use this project for learning or building your own applications.
