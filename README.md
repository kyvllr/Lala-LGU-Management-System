# LGU Filing System - Leave & Travel Order Management

A comprehensive Node.js and MongoDB-based system for managing leave requests and travel orders in a Local Government Unit (LGU).

## Features

- **Staff Management**: Create and manage staff records with position and department information
- **Leave Management**: File, track, and approve/reject leave requests with multiple leave types
- **Travel Order System**: Request and manage travel orders with approval workflows
- **Approval Workflow**: Manage pending requests with approve/reject functionality
- **Status Tracking**: Track requests through their lifecycle (Pending → Approved/Rejected → Completed)

## Installation

1. Install dependencies:
```bash
npm install express mongoose cors body-parser dotenv
```

2. Create a `.env` file:
```
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/lgufiling_db
```

3. Start the server:
```bash
npm start
# or
node index.js
```

The server will run on `http://localhost:5001`

---

## API Endpoints

### STAFF MANAGEMENT

#### Create Staff
```
POST /staffs
Content-Type: application/json

{
  "id": "STF001",
  "name": "John Doe",
  "position": "Administrative Officer",
  "department": "Finance",
  "email": "john@lgu.gov",
  "phone": "09123456789"
}
```

#### Get All Staffs
```
GET /staffs
```

#### Get Single Staff
```
GET /staffs/:id
```

#### Update Staff
```
PUT /staffs/:id
Content-Type: application/json

{
  "position": "Senior Administrative Officer",
  "department": "Human Resources"
}
```

#### Delete Staff
```
DELETE /staffs/:id
```

---

### LEAVE MANAGEMENT

#### File Leave Request
```
POST /leaves
Content-Type: application/json

{
  "leaveId": "LV001",
  "staffId": "STF001",
  "staffName": "John Doe",
  "leaveType": "Vacation",
  "startDate": "2026-02-01",
  "endDate": "2026-02-05",
  "reason": "Family vacation"
}
```

**Leave Types**: `Vacation`, `Sick Leave`, `Emergency Leave`, `Special Leave`, `Study Leave`

#### Get All Leave Requests
```
GET /leaves
GET /leaves?status=Pending
GET /leaves?status=Approved
GET /leaves?status=Rejected
```

#### Get Staff's Leave Requests
```
GET /leaves/staff/:staffId
```

#### Get Single Leave Request
```
GET /leave/:leaveId
```

#### Update Leave Request (Only Pending)
```
PUT /leaves/:leaveId
Content-Type: application/json

{
  "leaveType": "Sick Leave",
  "startDate": "2026-02-01",
  "endDate": "2026-02-03",
  "reason": "Medical appointment"
}
```

#### Approve Leave Request
```
PATCH /leaves/:leaveId/approve
Content-Type: application/json

{
  "approvedBy": "Jane Smith (Department Head)",
  "remarks": "Approved as requested"
}
```

#### Reject Leave Request
```
PATCH /leaves/:leaveId/reject
Content-Type: application/json

{
  "approvedBy": "Jane Smith (Department Head)",
  "remarks": "Insufficient balance for leave"
}
```

#### Delete Leave Request
```
DELETE /leaves/:leaveId
```

---

### TRAVEL ORDER MANAGEMENT

#### Create Travel Order Request
```
POST /travel-orders
Content-Type: application/json

{
  "travelOrderId": "TO001",
  "staffId": "STF001",
  "staffName": "John Doe",
  "destination": "Metro Manila",
  "purpose": "Attend LGU Summit Conference",
  "dateFrom": "2026-02-10",
  "dateTo": "2026-02-12",
  "transportMode": "Land",
  "estimatedBudget": 5000
}
```

**Transport Modes**: `Land`, `Air`, `Sea`, `Mixed`

#### Get All Travel Orders
```
GET /travel-orders
GET /travel-orders?status=Pending
GET /travel-orders?status=Approved
GET /travel-orders?status=Rejected
GET /travel-orders?status=Completed
```

#### Get Staff's Travel Orders
```
GET /travel-orders/staff/:staffId
```

#### Get Single Travel Order
```
GET /travel-order/:travelOrderId
```

#### Update Travel Order (Only Pending)
```
PUT /travel-orders/:travelOrderId
Content-Type: application/json

{
  "destination": "Quezon City",
  "purpose": "Board meeting",
  "dateFrom": "2026-02-10",
  "dateTo": "2026-02-13",
  "estimatedBudget": 6000
}
```

#### Approve Travel Order
```
PATCH /travel-orders/:travelOrderId/approve
Content-Type: application/json

{
  "approvedBy": "Budget Officer",
  "remarks": "Approved within budget allocation"
}
```

#### Reject Travel Order
```
PATCH /travel-orders/:travelOrderId/reject
Content-Type: application/json

{
  "approvedBy": "Budget Officer",
  "remarks": "Exceeds departmental budget"
}
```

#### Mark Travel Order as Completed
```
PATCH /travel-orders/:travelOrderId/complete
```

#### Delete Travel Order
```
DELETE /travel-orders/:travelOrderId
```

---

## Database Schema

### Staff Collection
```javascript
{
  id: String (unique, required),
  name: String (required),
  position: String,
  department: String,
  email: String,
  phone: String,
  dateHired: Date,
  createdAt: Date
}
```

### Leave Collection
```javascript
{
  leaveId: String (unique, required),
  staffId: String (required),
  staffName: String,
  leaveType: String (Vacation, Sick Leave, Emergency Leave, Special Leave, Study Leave),
  startDate: Date (required),
  endDate: Date (required),
  numberOfDays: Number,
  reason: String (required),
  status: String (Pending, Approved, Rejected),
  approvedBy: String,
  approvalDate: Date,
  remarks: String,
  createdAt: Date,
  updatedAt: Date
}
```

### TravelOrder Collection
```javascript
{
  travelOrderId: String (unique, required),
  staffId: String (required),
  staffName: String,
  destination: String (required),
  purpose: String (required),
  dateFrom: Date (required),
  dateTo: Date (required),
  numberOfDays: Number,
  transportMode: String (Land, Air, Sea, Mixed),
  estimatedBudget: Number,
  status: String (Pending, Approved, Rejected, Completed),
  approvedBy: String,
  approvalDate: Date,
  remarks: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Common Response Format

**Success Response:**
```json
{
  "message": "Operation successful",
  "staff": { ... },
  "leave": { ... },
  "travelOrder": { ... }
}
```

**Error Response:**
```json
{
  "message": "Error description"
}
```

---

## Workflow Example

### Leave Request Workflow
1. Staff files leave request → Status: `Pending`
2. Manager reviews and approves/rejects → Status: `Approved` or `Rejected`
3. System records approval date and approver name

### Travel Order Workflow
1. Staff requests travel order → Status: `Pending`
2. Budget Officer reviews and approves/rejects → Status: `Approved` or `Rejected`
3. After travel, mark as completed → Status: `Completed`

---

## Error Handling

The system returns appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing or invalid data)
- `404` - Not Found
- `409` - Conflict (duplicate ID)
- `500` - Server Error

---

## Notes

- Leave and travel order calculations automatically compute the number of days based on start and end dates
- Once approved or rejected, leave/travel order details cannot be modified
- Staff records must exist before filing related leave or travel requests
- All timestamps are automatically managed by the system
