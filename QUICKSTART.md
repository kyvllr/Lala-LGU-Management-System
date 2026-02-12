# Quick Start Guide - Role-Based Leave & Travel System

## Installation (5 minutes)

### 1. Install Backend Dependencies
```bash
cd /Users/kayevillar/Documents/filingSystem
npm install
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 3. Create .env File
```bash
cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017/filingSystem
PORT=5001
JWT_SECRET=your_secret_key_here_change_in_production
JWT_EXPIRATION=24h
NODE_ENV=development
EOF
```

## Start the Application (2 terminals)

### Terminal 1: Start Backend
```bash
cd /Users/kayevillar/Documents/filingSystem
npm start
```
Should output:
```
Server running on port 5001
Connected to MongoDB
```

### Terminal 2: Start Frontend
```bash
cd /Users/kayevillar/Documents/filingSystem/frontend
npm start
```
Browser opens at `http://localhost:3000`

## First Time Setup

### Option A: Create Accounts via UI
1. Go to http://localhost:3000 (redirects to /register)
2. Fill registration form:
   - Staff ID: S001
   - Name: John Doe
   - Email: john@example.com
   - Position: Administrative Officer
   - Department: Finance
   - Password: password123

3. Click Register → Redirected to Login
4. Login with created credentials

### Option B: Create via API (Using cURL)

**Register Staff Account:**
```bash
curl -X POST http://localhost:5001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "S001",
    "staffName": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "position": "Officer",
    "department": "Finance"
  }'
```

**Create Admin Account:**
First register as staff, then update role in MongoDB:
```bash
# Connect to MongoDB
mongo

# Use database
use filingSystem

# Update user role to admin
db.staffs.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)
```

**Login:**
```bash
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

Response includes `token` - use this in API calls

## Testing the System

### Staff User Flow

1. **Login as Staff**
   - Email: john@example.com
   - Password: password123

2. **File a Leave**
   - Click "File Leave"
   - Fill form (Casual Leave, dates, reason)
   - Submit
   - Redirected to "My Leaves"

3. **View Your Leaves**
   - Click "My Leaves"
   - See your filed leaves with status "Pending"
   - Can edit/delete if status is "Pending"

4. **File Travel Order**
   - Click "Request Travel"
   - Fill form (destination, dates, transport)
   - Submit
   - View in "My Travel Orders"

### Admin User Flow

1. **Login as Admin**
   - Email: admin@example.com
   - Password: password123

2. **Manage Staff**
   - Click "Manage Staff" → See all staff
   - Click "Add Staff" → Create new staff member

3. **Approve Leaves**
   - Click "Approve Leaves"
   - See all pending leaves
   - Click Approve/Reject with remarks

4. **Approve Travel Orders**
   - Click "Approve Travel Orders"
   - See all pending orders
   - Click Approve/Reject with remarks

## API Testing with Postman

### Setup Postman
1. Download Postman
2. Create new Collection: "Filing System API"
3. Create requests as shown below

### Authentication Requests

**POST - Register**
```
URL: http://localhost:5001/auth/register
Method: POST
Body (JSON):
{
  "staffId": "S002",
  "staffName": "Jane Smith",
  "email": "jane@example.com",
  "password": "password123",
  "position": "Manager",
  "department": "HR"
}
```

**POST - Login**
```
URL: http://localhost:5001/auth/login
Method: POST
Body (JSON):
{
  "email": "john@example.com",
  "password": "password123"
}
Response includes: {"token": "eyJhbGc..."}
```

**GET - Current User (Protected)**
```
URL: http://localhost:5001/auth/me
Method: GET
Headers:
  Authorization: Bearer <paste_token_here>
```

### Staff Management Requests

**GET - All Staff (Admin Only)**
```
URL: http://localhost:5001/staffs
Method: GET
Headers:
  Authorization: Bearer <admin_token>
```

**POST - Add Staff (Admin Only)**
```
URL: http://localhost:5001/staffs
Method: POST
Headers:
  Authorization: Bearer <admin_token>
Body (JSON):
{
  "staffId": "S003",
  "staffName": "Bob Johnson",
  "email": "bob@example.com",
  "position": "Officer",
  "department": "Admin"
}
```

### Leave Management Requests

**POST - File Leave (Staff Own Only)**
```
URL: http://localhost:5001/leaves
Method: POST
Headers:
  Authorization: Bearer <staff_token>
Body (JSON):
{
  "staffId": "S001",
  "staffName": "John Doe",
  "leaveId": "L001",
  "leaveType": "Casual Leave",
  "dateFrom": "2024-02-01",
  "dateTo": "2024-02-03",
  "purpose": "Family matters",
  "numberOfDays": 3
}
```

**GET - My Leaves (Staff)**
```
URL: http://localhost:5001/leaves/staff/S001
Method: GET
Headers:
  Authorization: Bearer <staff_token>
```

**GET - All Leaves (Admin)**
```
URL: http://localhost:5001/leaves
Method: GET
Headers:
  Authorization: Bearer <admin_token>
```

**PATCH - Approve Leave (Admin Only)**
```
URL: http://localhost:5001/leaves/L001/approve
Method: PATCH
Headers:
  Authorization: Bearer <admin_token>
Body (JSON):
{
  "approvedBy": "Manager Name",
  "remarks": "Approved"
}
```

**PATCH - Reject Leave (Admin Only)**
```
URL: http://localhost:5001/leaves/L001/reject
Method: PATCH
Headers:
  Authorization: Bearer <admin_token>
Body (JSON):
{
  "approvedBy": "Manager Name",
  "remarks": "Insufficient balance"
}
```

### Travel Order Requests

**POST - File Travel Order**
```
URL: http://localhost:5001/travel-orders
Method: POST
Headers:
  Authorization: Bearer <staff_token>
Body (JSON):
{
  "staffId": "S001",
  "staffName": "John Doe",
  "travelOrderId": "T001",
  "destination": "Manila",
  "purpose": "Conference",
  "dateFrom": "2024-02-15",
  "dateTo": "2024-02-17",
  "transportMode": "Van",
  "estimatedBudget": 5000
}
```

**GET - My Travel Orders**
```
URL: http://localhost:5001/travel-orders/staff/S001
Method: GET
Headers:
  Authorization: Bearer <staff_token>
```

**PATCH - Approve Travel Order (Admin)**
```
URL: http://localhost:5001/travel-orders/T001/approve
Method: PATCH
Headers:
  Authorization: Bearer <admin_token>
Body (JSON):
{
  "approvedBy": "Director",
  "remarks": "Approved"
}
```

**PATCH - Mark as Completed**
```
URL: http://localhost:5001/travel-orders/T001/complete
Method: PATCH
Headers:
  Authorization: Bearer <staff_token>
```

## Common Errors & Solutions

### Error: "Unauthorized" (401)
- Token missing or invalid
- Token expired (24 hours)
- Solution: Login again

### Error: "Forbidden" (403)
- Your role doesn't have permission
- Trying to access other staff's records
- Solution: Use correct user role or your own data

### Error: "Cannot connect to MongoDB"
- MongoDB not running
- Wrong connection string
- Solution: Start MongoDB or check .env MONGODB_URI

### Error: "CORS error"
- Frontend port doesn't match
- Backend not configured for cross-origin
- Solution: Ensure backend running on 5001, frontend on 3000

## File Structure

```
filingSystem/
├── index.js                          # Backend server & API
├── package.json                      # Backend dependencies
├── .env                              # Environment variables
├── AUTHENTICATION.md                 # Auth setup guide
├── SYSTEM_ARCHITECTURE.md            # System design
├── frontend/
│   ├── src/
│   │   ├── App.js                   # Main app component
│   │   ├── api.js                   # API client with JWT
│   │   ├── index.js                 # Entry point
│   │   ├── pages/
│   │   │   ├── Login.js             # Login page
│   │   │   ├── Register.js          # Registration page
│   │   │   ├── Dashboard.js         # Main dashboard
│   │   │   ├── FileLeave.js         # File leave form
│   │   │   ├── MyLeaves.js          # View own leaves
│   │   │   ├── ApproveLeavesAdmin.js # Approve leaves
│   │   │   ├── FileTravelOrder.js   # File travel order
│   │   │   ├── MyTravelOrders.js    # View own orders
│   │   │   ├── ApproveTravelOrdersAdmin.js # Approve orders
│   │   │   ├── StaffList.js         # View staff (admin)
│   │   │   └── AddStaff.js          # Add staff (admin)
│   │   ├── components/
│   │   │   └── PrivateRoute.js      # Protected route wrapper
│   │   └── index.css                # Tailwind styles
│   └── package.json                 # Frontend dependencies
└── node_modules/                    # Dependencies
```

## Key Features Checklist

- [x] User registration with email & password
- [x] User login with JWT authentication
- [x] Role-based access control (Staff/Admin)
- [x] Staff management (Admin only)
- [x] File leave requests (Staff)
- [x] Approve/reject leaves (Admin)
- [x] File travel orders (Staff)
- [x] Approve/reject travel orders (Admin)
- [x] View own records (Staff)
- [x] View all records (Admin)
- [x] Edit/delete pending requests (Staff)
- [x] Protected routes with PrivateRoute component
- [x] Automatic JWT token management
- [x] Automatic logout on token expiration
- [x] Responsive UI with Tailwind CSS

## Next Steps

1. Create some test accounts (1 staff, 1 admin)
2. File a leave request as staff
3. Approve as admin
4. Test role-based restrictions (try accessing admin pages as staff)
5. Check database in MongoDB to see records

## Support

For detailed setup, troubleshooting, and API documentation:
- See `AUTHENTICATION.md` for authentication details
- See `SYSTEM_ARCHITECTURE.md` for technical architecture
- See `API_EXAMPLES.md` for complete API reference
