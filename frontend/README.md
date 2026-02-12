# LGU Filing System - Frontend

A modern React frontend for the LGU Leave and Travel Order Management System.

## Features

- **Staff Mode**: File leave requests and travel orders, track status
- **Admin Mode**: Manage staff, approve/reject requests, view analytics
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Status Updates**: Immediate feedback on request actions

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

1. Make sure the backend is running on `http://localhost:5001`

2. Start the React development server:
```bash
npm start
```

3. Open your browser and visit `http://localhost:3000`

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── pages/
│   │   ├── Dashboard.js           # Home page with statistics
│   │   ├── AddStaff.js            # Admin: Add new staff
│   │   ├── StaffList.js           # Admin: View and manage staff
│   │   ├── FileLeave.js           # Staff: File leave request
│   │   ├── MyLeaves.js            # Staff: View leave requests
│   │   ├── ApproveLeavesAdmin.js  # Admin: Approve/reject leaves
│   │   ├── FileTravelOrder.js     # Staff: Request travel order
│   │   ├── MyTravelOrders.js      # Staff: View travel orders
│   │   └── ApproveTravelOrdersAdmin.js  # Admin: Approve/reject travel
│   ├── App.js                      # Main app component
│   ├── api.js                      # API client configuration
│   ├── index.js                    # React entry point
│   └── index.css                   # Global styles
├── package.json
└── tailwind.config.js
```

## How to Use

### For Staff Users

1. **Select Staff Mode** from the dropdown in the navigation
2. **Enter Your Staff ID** in the input field
3. **File Leave Request**:
   - Click "File Leave" from the menu
   - Fill in the form with leave details
   - Submit to send for approval

4. **View My Leaves**:
   - Click "My Leaves" to see all your leave requests
   - Filter by status (Pending, Approved, Rejected)
   - Delete pending requests if needed

5. **Request Travel Order**:
   - Click "Request Travel" from the menu
   - Fill in travel details (destination, dates, budget)
   - Submit for approval

6. **View My Travel Orders**:
   - Click "My Travel Orders" to track all requests
   - Mark approved orders as complete when trip ends

### For Admin Users

1. **Select Admin Mode** from the dropdown
2. **Manage Staff**:
   - Click "Manage Staff" to view all staff members
   - Click "Add Staff" to create new staff records

3. **Approve Leave Requests**:
   - Click "Approve Leaves"
   - Select a pending request to review
   - Enter your name and remarks
   - Choose to approve or reject

4. **Approve Travel Orders**:
   - Click "Approve Travel Orders"
   - Review pending travel requests
   - Approve/reject with remarks

## API Configuration

The frontend communicates with the backend API at `http://localhost:5001`.

If your backend is running on a different URL, update the `API_BASE_URL` in [src/api.js](src/api.js):

```javascript
const API_BASE_URL = 'http://your-api-url:port';
```

## Available Scripts

### `npm start`
Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm build`
Builds the app for production to the `build` folder.

### `npm test`
Launches the test runner in interactive watch mode.

## Technologies Used

- **React 18.2** - UI framework
- **React Router 6** - Navigation and routing
- **Axios** - HTTP client for API calls
- **Tailwind CSS** - Utility-first CSS framework
- **React Scripts** - Build and development tools

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Backend Connection Error
- Ensure the backend server is running on `http://localhost:5001`
- Check CORS settings in the backend (should be enabled)

### Staff ID Not Found
- Make sure the staff member has been created in the system by an admin
- Use the exact Staff ID as it appears in the backend

### Port 3000 Already in Use
```bash
# Use a different port
PORT=3001 npm start
```

## Notes

- Leave and travel order IDs are auto-generated
- Automatic calculation of duration between start and end dates
- Status tracking: Pending → Approved/Rejected → Completed
- Pending requests can be modified or deleted
- Approved/rejected requests cannot be edited

## Support

For issues or questions, contact your system administrator.
