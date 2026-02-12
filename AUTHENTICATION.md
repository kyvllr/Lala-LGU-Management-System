# Role-Based Authentication Setup Complete

## Overview
The Leave and Travel Order Management System now includes complete role-based authentication with JWT tokens and bcrypt password hashing. The system supports two user roles: **staff** and **admin**.

## Features Implemented

### Backend (Node.js/Express)
✅ **Authentication System**
- User registration (`POST /auth/register`)
- User login (`POST /auth/login`)
- Get current user info (`GET /auth/me`)
- JWT token generation with 24-hour expiration
- Bcrypt password hashing

✅ **Role-Based Access Control (RBAC)**
- `verifyToken` middleware: Checks JWT token validity
- `requireRole(role)` middleware: Enforces role-based access
- All routes protected with authentication

✅ **Staff Management (Protected)**
- Admin-only endpoints for CRUD operations
- Password field added to Staff schema
- Unique email field validation

✅ **Leave Management (Protected)**
- Staff can only file/view/modify their own leaves
- Admin can view and approve/reject all leaves
- Role-based access control on all operations

✅ **Travel Order Management (Protected)**
- Staff can only file/view/modify their own travel orders
- Admin can view and approve/reject all travel orders
- Role-based access control on all operations

### Frontend (React)
✅ **Authentication Pages**
- Login page with email/password authentication
- Registration page for new staff accounts
- Automatic token storage in localStorage

✅ **Route Protection**
- `PrivateRoute` component: Protects routes from unauthenticated access
- Role-based route access: Restricts admin routes to admin users only
- Automatic redirection to login for unauthenticated users

✅ **API Integration**
- JWT token automatically included in all API requests
- Automatic logout on 401 (Unauthorized) response
- Token refresh on page reload using localStorage

✅ **UI Updates**
- Updated navigation bar with user info display
- Logout button in navigation
- Loading state during authentication check
- Conditional menu items based on user role

## Installation & Setup

### 1. Install Backend Dependencies
```bash
cd /Users/kayevillar/Documents/filingSystem
npm install
```

**New packages added:**
- `jsonwebtoken` (^9.1.2) - JWT token generation and verification
- `bcryptjs` (^2.4.3) - Password hashing

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb://localhost:27017/filingSystem
PORT=5001
JWT_SECRET=your_secret_key_here_change_in_production
JWT_EXPIRATION=24h
```

### 4. Start the Application

**Backend:**
```bash
npm start
# Server runs on http://localhost:5001
```

**Frontend (in another terminal):**
```bash
cd frontend
npm start
# App runs on http://localhost:3000
```

## API Endpoints

### Authentication Routes
```
POST   /auth/register    - Register new staff account
POST   /auth/login       - Login and get JWT token
GET    /auth/me          - Get current user info (requires token)
```

### Staff Management (Admin Only)
```
GET    /staffs           - Get all staff members
POST   /staffs           - Add new staff
GET    /staffs/:id       - Get specific staff (or own profile)
PUT    /staffs/:id       - Update staff
DELETE /staffs/:id       - Delete staff
```

### Leave Management
```
POST   /leaves           - File new leave (staff own only)
GET    /leaves           - Get all leaves (admin only)
GET    /leaves/staff/:id - Get staff's leaves (self or admin)
GET    /leave/:id        - Get specific leave (with access control)
PUT    /leaves/:id       - Update pending leave (staff own only)
PATCH  /leaves/:id/approve    - Approve leave (admin only)
PATCH  /leaves/:id/reject     - Reject leave (admin only)
DELETE /leaves/:id       - Delete leave (staff own pending, admin any)
```

### Travel Order Management
```
POST   /travel-orders              - File new travel order (staff own only)
GET    /travel-orders              - Get all orders (admin only)
GET    /travel-orders/staff/:id    - Get staff's orders (self or admin)
GET    /travel-order/:id           - Get specific order (with access control)
PUT    /travel-orders/:id          - Update pending order (staff own only)
PATCH  /travel-orders/:id/approve  - Approve order (admin only)
PATCH  /travel-orders/:id/reject   - Reject order (admin only)
PATCH  /travel-orders/:id/complete - Mark as completed (staff own approved, admin any)
DELETE /travel-orders/:id          - Delete order (staff own pending, admin any)
```

## User Roles & Permissions

### Staff Role
- Can register and login
- Can file leave requests for themselves only
- Can view/edit/delete their own pending leave requests
- Cannot approve or reject leaves
- Can file travel order requests for themselves only
- Can view/edit/delete their own pending travel orders
- Cannot approve or reject travel orders
- Cannot access staff management

### Admin Role
- Can do everything staff can do
- Can view all staff members
- Can add/edit/delete staff members
- Can view all leave requests
- Can approve/reject any leave requests
- Can view all travel orders
- Can approve/reject any travel orders
- Can mark any travel order as completed
- Full access to all routes

## Testing the System

### Demo Credentials (Must be created first)

**Register new staff:**
1. Go to http://localhost:3000/register
2. Fill in the registration form
3. Use any email/password combination

**Admin Account Setup:**
To create an admin account, use MongoDB or the API:
```javascript
// Register as staff first, then manually update role in database
db.staffs.updateOne(
  { email: "admin@lgu.gov" },
  { $set: { role: "admin" } }
)
```

### API Testing with cURL

**Register:**
```bash
curl -X POST http://localhost:5001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "S001",
    "staffName": "John Doe",
    "email": "john@lgu.gov",
    "password": "password123",
    "position": "Officer",
    "department": "Finance"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@lgu.gov",
    "password": "password123"
  }'
```

**Use JWT Token in Requests:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5001/staffs
```

## Security Considerations

1. **Password Security**: All passwords are hashed using bcryptjs before storage
2. **JWT Tokens**: Signed and verified on the server
3. **Token Expiration**: Tokens expire after 24 hours
4. **HTTPS**: Use HTTPS in production
5. **Environment Variables**: Store JWT_SECRET in environment variables
6. **CORS**: Configured to accept requests from frontend

## Troubleshooting

### Cannot connect to MongoDB
- Ensure MongoDB is running: `mongod`
- Check MONGODB_URI in .env file
- Verify MongoDB port (default: 27017)

### Token expired or invalid
- Clear localStorage and login again
- Check JWT_SECRET matches between backend and frontend
- Verify token format in Authorization header: `Bearer <token>`

### Unauthorized (401) errors
- Ensure you're logged in
- Check if token is in localStorage
- Verify token hasn't expired (24 hours)

### Forbidden (403) errors
- Check user role has permission for that action
- Admin actions require admin role
- Staff can only access their own records

## Next Steps

1. Add password reset functionality
2. Add two-factor authentication
3. Add audit logging for admin actions
4. Add role-based dashboard customization
5. Add email notifications for approvals
6. Implement activity history tracking

## File Changes Summary

**Backend Files Modified:**
- `index.js` - Added JWT authentication, bcrypt, role-based middleware, and protected routes
- `package.json` - Added jsonwebtoken and bcryptjs dependencies

**Frontend Files Created:**
- `src/pages/Login.js` - Login page component
- `src/pages/Register.js` - Registration page component
- `src/components/PrivateRoute.js` - Protected route wrapper

**Frontend Files Modified:**
- `src/App.js` - Integrated authentication flow and protected routes
- `src/api.js` - Added JWT token interceptors

## Database Schema Updates

**Staff Collection - Added Fields:**
```javascript
{
  ...existing fields,
  email: String (unique, required),
  password: String (hashed, required),
  role: String (enum: ['staff', 'admin'], default: 'staff')
}
```
