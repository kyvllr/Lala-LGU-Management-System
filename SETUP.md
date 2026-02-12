# LGU Filing System - Complete Setup Guide

## Overview

This is a complete Leave and Travel Order Management System for Local Government Units (LGUs). It consists of:
- **Backend**: Node.js + Express + MongoDB API
- **Frontend**: React + Tailwind CSS web application

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager

## Installation & Setup

### 1. Backend Setup

Navigate to the project root and install backend dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/lgufiling_db
```

Start the backend server:

```bash
node index.js
# or
npm start
```

You should see:
```
Connected to MongoDB
Server running on http://localhost:5001
```

### 2. Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
npm install
```

Install Tailwind CSS (if not already included):

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Start the React development server:

```bash
npm start
```

The application will open at `http://localhost:3000`

## Directory Structure

```
filingSystem/
├── index.js                    # Backend API server
├── package.json               # Backend dependencies
├── README.md                  # Backend documentation
├── API_EXAMPLES.md            # API usage examples
├── .env                       # Environment configuration
│
└── frontend/
    ├── src/
    │   ├── pages/             # Page components
    │   ├── App.js             # Main app component
    │   ├── api.js             # API client
    │   ├── index.js           # React entry
    │   └── index.css          # Styles
    ├── public/
    │   └── index.html         # HTML template
    ├── package.json           # Frontend dependencies
    ├── tailwind.config.js     # Tailwind config
    └── README.md              # Frontend documentation
```

## Quick Start Guide

### For Testing the System

1. **Start Backend**:
```bash
node index.js
```

2. **Start Frontend** (in another terminal):
```bash
cd frontend
npm start
```

3. **Open in Browser**:
Visit `http://localhost:3000`

### Creating Test Data

1. **Add a Staff Member** (Admin Mode):
   - Select "Admin Mode"
   - Click "Add Staff"
   - Fill in details and submit

2. **File a Leave Request** (Staff Mode):
   - Select "Staff Mode"
   - Enter the Staff ID you created
   - Click "File Leave"
   - Fill in leave details and submit

3. **Approve Leave Request** (Admin Mode):
   - Switch back to "Admin Mode"
   - Click "Approve Leaves"
   - Select a pending request
   - Enter approver name and click "Approve Request"

## API Endpoints Summary

### Staff Management
- `POST /staffs` - Create staff
- `GET /staffs` - Get all staff
- `GET /staffs/:id` - Get single staff
- `PUT /staffs/:id` - Update staff
- `DELETE /staffs/:id` - Delete staff

### Leave Management
- `POST /leaves` - File leave request
- `GET /leaves` - Get all leaves (with optional status filter)
- `GET /leaves/staff/:staffId` - Get staff's leaves
- `PATCH /leaves/:leaveId/approve` - Approve leave
- `PATCH /leaves/:leaveId/reject` - Reject leave
- `DELETE /leaves/:leaveId` - Delete leave

### Travel Order Management
- `POST /travel-orders` - Create travel order
- `GET /travel-orders` - Get all travel orders
- `GET /travel-orders/staff/:staffId` - Get staff's travel orders
- `PATCH /travel-orders/:travelOrderId/approve` - Approve travel order
- `PATCH /travel-orders/:travelOrderId/reject` - Reject travel order
- `PATCH /travel-orders/:travelOrderId/complete` - Mark as completed
- `DELETE /travel-orders/:travelOrderId` - Delete travel order

See [API_EXAMPLES.md](API_EXAMPLES.md) for detailed examples.

## Features

### Staff Features
✅ File leave requests (5 types: Vacation, Sick, Emergency, Special, Study)
✅ Track leave request status
✅ Modify pending leave requests
✅ Request travel orders with budget tracking
✅ View travel order approval status
✅ Mark completed travel orders

### Admin Features
✅ Manage staff records
✅ View all leave requests
✅ Approve/reject leave with remarks
✅ View all travel orders
✅ Approve/reject travel orders
✅ Dashboard with statistics
✅ Filter requests by status

## Configuration

### Change Backend Port
Edit `.env`:
```env
PORT=5002
```

### Change Frontend Port
In frontend directory:
```bash
PORT=3001 npm start
```

### Change API URL
Edit `frontend/src/api.js`:
```javascript
const API_BASE_URL = 'http://your-server:port';
```

## Deployment

### Backend Deployment (Node.js)
1. Push code to hosting (Heroku, AWS, DigitalOcean, etc.)
2. Set environment variables
3. Run `npm install && node index.js`

### Frontend Deployment (React)
1. Build production bundle:
```bash
cd frontend
npm run build
```

2. Deploy `build` folder to hosting (Vercel, Netlify, etc.)

## Troubleshooting

### MongoDB Connection Error
- Check if MongoDB is running
- Verify connection string in `.env`

### CORS Error in Frontend
- Ensure backend CORS is enabled
- Check if backend is running on correct port

### Port Already in Use
```bash
# Find process using port
lsof -i :5001  # for backend
lsof -i :3000  # for frontend

# Kill process
kill -9 <PID>
```

### Staff ID Not Found
- Make sure staff is created in admin panel first
- Use exact Staff ID (case-sensitive)

## Support & Documentation

- See [README.md](README.md) for backend API documentation
- See [frontend/README.md](frontend/README.md) for frontend usage
- See [API_EXAMPLES.md](API_EXAMPLES.md) for API request examples

## Technologies

**Backend**:
- Express.js - Web framework
- MongoDB - Database
- Mongoose - ODM
- CORS - Cross-origin requests

**Frontend**:
- React - UI framework
- React Router - Navigation
- Axios - HTTP client
- Tailwind CSS - Styling

## License

This project is created for Local Government Unit (LGU) management systems.
