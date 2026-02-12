# System Architecture & Implementation Summary

## Project Overview
A comprehensive Leave and Travel Order Management System for Local Government Units (LGUs) with role-based authentication and authorization.

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js (v5.2.1)
- **Database**: MongoDB + Mongoose (v9.1.5)
- **Authentication**: JWT (jsonwebtoken v9.1.2)
- **Password Security**: bcryptjs (v2.4.3)
- **CORS**: Enabled for cross-origin requests
- **Middleware**: body-parser for JSON parsing

### Frontend
- **Framework**: React 18.2
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS
- **Authentication**: JWT tokens in localStorage
- **State Management**: React Hooks (useState, useEffect)

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Pages: Login, Register, Dashboard, Manage Staff,    │  │
│  │ File Leave, My Leaves, Approve Leaves, etc.         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PrivateRoute Component (Route Protection)           │  │
│  │ API Module with JWT Interceptors                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js Backend (Port 5001)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Authentication Routes                               │  │
│  │ - POST /auth/register (public)                      │  │
│  │ - POST /auth/login (public)                         │  │
│  │ - GET /auth/me (protected)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Protected Routes (verifyToken middleware)           │  │
│  │ ├─ Staff Management Routes                          │  │
│  │ │  └─ requireRole('admin') middleware               │  │
│  │ ├─ Leave Management Routes                          │  │
│  │ │  └─ Role-based access control                     │  │
│  │ └─ Travel Order Routes                              │  │
│  │    └─ Role-based access control                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Middleware Pipeline                                 │  │
│  │ 1. CORS Handler                                     │  │
│  │ 2. Body Parser (JSON)                               │  │
│  │ 3. verifyToken (for protected routes)               │  │
│  │ 4. requireRole (for role-specific routes)           │  │
│  │ 5. Route Handler                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ Mongoose
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    MongoDB Database                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ filingSystem Database                               │  │
│  │ ├─ staffs collection                                │  │
│  │ │  ├─ staffId (unique)                              │  │
│  │ │  ├─ staffName                                     │  │
│  │ │  ├─ email (unique, for authentication)            │  │
│  │ │  ├─ password (bcrypt hashed)                      │  │
│  │ │  ├─ role (enum: 'staff'|'admin')                  │  │
│  │ │  ├─ position                                      │  │
│  │ │  └─ department                                    │  │
│  │ ├─ leaves collection                                │  │
│  │ │  ├─ leaveId (unique)                              │  │
│  │ │  ├─ staffId (foreign key)                         │  │
│  │ │  ├─ staffName                                     │  │
│  │ │  ├─ leaveType                                     │  │
│  │ │  ├─ dateFrom, dateTo                              │  │
│  │ │  ├─ status (Pending|Approved|Rejected)            │  │
│  │ │  ├─ purpose                                       │  │
│  │ │  └─ timestamps                                    │  │
│  │ └─ travelorders collection                          │  │
│  │    ├─ travelOrderId (unique)                        │  │
│  │    ├─ staffId (foreign key)                         │  │
│  │    ├─ staffName                                     │  │
│  │    ├─ destination                                   │  │
│  │    ├─ dateFrom, dateTo                              │  │
│  │    ├─ status (Pending|Approved|Rejected|Completed)  │  │
│  │    ├─ transportMode                                 │  │
│  │    ├─ estimatedBudget                               │  │
│  │    └─ timestamps                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### Registration Flow
```
User registers (Frontend)
         ↓
POST /auth/register with credentials
         ↓
Backend validates input
         ↓
Check if email already exists
         ↓
Hash password with bcryptjs
         ↓
Create staff document with role='staff'
         ↓
Return success message
         ↓
User redirected to login
```

### Login Flow
```
User enters credentials (Frontend)
         ↓
POST /auth/login with email & password
         ↓
Backend finds staff by email
         ↓
Compare submitted password with hashed password
         ↓
Generate JWT token (24h expiration)
         ↓
Return token + staff data
         ↓
Frontend stores token in localStorage
         ↓
Add "Authorization: Bearer <token>" to API headers
         ↓
Redirect to dashboard
```

### Protected Request Flow
```
Frontend makes API request
         ↓
Axios interceptor adds JWT token
         ↓
Request sent with Authorization header
         ↓
Backend verifyToken middleware extracts token
         ↓
JWT.verify() validates token signature & expiration
         ↓
req.user populated with decoded token data
         ↓
If role required: requireRole middleware checks
         ↓
Route handler processes request with user context
         ↓
Send response back to Frontend
         ↓
If 401: Frontend interceptor clears auth & redirects to login
```

## Role-Based Access Control (RBAC)

### Staff Role Permissions
```
Authentication:
├─ ✅ Register new account
├─ ✅ Login with email/password
├─ ✅ View own profile
└─ ❌ View/manage other staff

Leave Management:
├─ ✅ File leave requests
├─ ✅ View own leaves
├─ ✅ Edit own pending leaves
├─ ✅ Delete own pending leaves
├─ ❌ View other staff leaves
└─ ❌ Approve/reject leaves

Travel Orders:
├─ ✅ File travel order requests
├─ ✅ View own travel orders
├─ ✅ Edit own pending orders
├─ ✅ Mark own approved orders as completed
├─ ✅ Delete own pending orders
├─ ❌ View other staff orders
└─ ❌ Approve/reject orders
```

### Admin Role Permissions
```
Authentication:
├─ ✅ Register new account
├─ ✅ Login with email/password
├─ ✅ View own profile
└─ ✅ View all staff profiles

Staff Management:
├─ ✅ Create staff members
├─ ✅ Update staff details
├─ ✅ Delete staff accounts
└─ ✅ View all staff

Leave Management:
├─ ✅ File own leave requests
├─ ✅ View all leaves
├─ ✅ Approve pending leaves
├─ ✅ Reject pending leaves
├─ ✅ Delete any leave
└─ ✅ Edit/view all leaves

Travel Orders:
├─ ✅ File own travel orders
├─ ✅ View all travel orders
├─ ✅ Approve pending orders
├─ ✅ Reject pending orders
├─ ✅ Mark any order as completed
└─ ✅ Edit/delete any order
```

## Key Implementation Details

### 1. Password Security
```javascript
// Registration: Hash password before storage
const hashedPassword = await bcrypt.hash(password, 10);
staff.password = hashedPassword;
await staff.save();

// Login: Compare submitted password with stored hash
const isValidPassword = await bcrypt.compare(password, staff.password);
```

### 2. JWT Token Generation
```javascript
// Generate token with 24-hour expiration
const token = jwt.sign(
  {
    staffId: staff.staffId,
    email: staff.email,
    role: staff.role
  },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

### 3. Token Verification Middleware
```javascript
// Verify token and extract user data
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};
```

### 4. Role-Based Middleware
```javascript
// Check if user has required role (or is admin)
const requireRole = (role) => (req, res, next) => {
  if (req.user.role === role || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden' });
  }
};
```

### 5. Route Protection Example
```javascript
// Staff can only file leaves for themselves
app.post('/leaves', verifyToken, async (req, res) => {
  // Staff role check
  if (req.user.role === 'staff' && req.user.staffId !== req.body.staffId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  
  // Process leave request...
});

// Admin-only endpoint
app.patch('/leaves/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  // Only admin reach here
  // Approve leave...
});
```

## Frontend Components

### Authentication Components
```
Login.js
├─ Email input
├─ Password input
├─ Login button
├─ API call to /auth/login
├─ Token storage in localStorage
└─ Redirect to dashboard

Register.js
├─ Staff ID, name, email inputs
├─ Password confirmation
├─ Optional position & department
├─ API call to /auth/register
└─ Redirect to login
```

### Protected Components
```
PrivateRoute.js
├─ Check if token exists in localStorage
├─ Check if user role matches required role
├─ Render children if authorized
└─ Redirect to login/unauthorized otherwise

App.js (AppContent)
├─ Load user from localStorage on mount
├─ Display login/register if not authenticated
├─ Display dashboard with navigation if authenticated
├─ Show user info in navbar
├─ Handle logout (clear localStorage)
└─ Conditional menu based on role
```

## API Interceptors

### Request Interceptor
```javascript
// Automatically adds JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Response Interceptor
```javascript
// Handles 401 responses (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Security Best Practices Implemented

✅ **Password Security**
- Bcryptjs hashing with salt rounds
- Never store plain text passwords
- Passwords never logged or exposed

✅ **Token Security**
- JWT tokens signed with secret key
- 24-hour expiration time
- Token stored in localStorage (frontend)
- Token removed on logout

✅ **Access Control**
- verifyToken middleware on all protected routes
- requireRole middleware for admin routes
- User context available in req.user
- Cross-origin access controlled with CORS

✅ **Input Validation**
- Required field checks
- Email format validation
- Type checking on all inputs

✅ **Error Handling**
- 401 Unauthorized for invalid/expired tokens
- 403 Forbidden for insufficient permissions
- 404 Not Found for missing resources
- 400 Bad Request for invalid input

## Data Flow Example: File Leave Request

```
User (Staff) navigates to File Leave page
         ↓
Form filled: date range, leave type, purpose
         ↓
Form submitted (POST /leaves)
         ↓
Axios interceptor adds JWT token header
         ↓
Backend verifyToken middleware validates token
         ↓
Route handler receives staffId from req.user
         ↓
Check: req.user.staffId === form.staffId (must match)
         ↓
Create leave document in MongoDB
         ↓
Return 201 Created + leave data
         ↓
Frontend displays success message
         ↓
User redirected to My Leaves page
         ↓
Fetch /leaves/staff/:staffId shows new leave
         ↓
User sees leave with status "Pending"
```

## Deployment Checklist

- [ ] Update MongoDB connection string for production
- [ ] Set JWT_SECRET to strong, random string
- [ ] Enable HTTPS
- [ ] Set CORS allowed origins to production domain only
- [ ] Configure environment variables properly
- [ ] Enable rate limiting on auth endpoints
- [ ] Set up database backups
- [ ] Configure log aggregation
- [ ] Test all authentication flows
- [ ] Test role-based access control
- [ ] Load test the system

## Performance Considerations

- JWT tokens eliminate database lookups on every request
- Indexed email field for fast login lookups
- Indexed staffId for quick staff queries
- Password hashing uses bcryptjs (slow hash by design)
- Token validation is fast (JWT verification only)

## Future Enhancements

1. **Multi-factor Authentication (MFA)**
   - SMS/email OTP verification
   - Authenticator app support

2. **Password Management**
   - Password reset via email
   - Password history tracking
   - Forced password change for first login

3. **Session Management**
   - Multiple device login tracking
   - Session timeout
   - Concurrent session limits

4. **Audit Logging**
   - Log all admin actions
   - Track leave/travel order changes
   - User activity history

5. **Advanced Features**
   - OAuth2 integration (Google, Microsoft)
   - LDAP/Active Directory integration
   - API key authentication for integrations

## Support & Troubleshooting

See AUTHENTICATION.md for detailed setup and troubleshooting guide.
