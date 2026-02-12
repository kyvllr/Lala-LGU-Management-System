# Staff Registration Approval Workflow - Implementation Summary

## Overview
Implemented a staff registration approval system where new staff members must wait for admin approval before they can login and use their credentials.

## Backend Changes (index.js)

### 1. Staff Schema Updates
- Added `isApproved` field (Boolean, default: false)
- Added `approvedAt` field (Date) - tracks when approval was given
- Added `approvedBy` field (String) - tracks which admin approved the staff

### 2. Authentication Routes

#### Modified `/auth/register` Endpoint
- New staff registrations now set `isApproved: false` by default
- Returns message: "Registration submitted successfully. Please wait for admin approval."

#### Modified `/auth/login` Endpoint
- Added check to verify `staff.isApproved` status before allowing login
- Returns 403 status with message: "Your account is pending admin approval. Please wait for approval to login."

### 3. New Admin Routes

#### `GET /staffs-pending` (Admin only)
- Retrieves all pending (unapproved) staff registrations
- Sorted by creation date (newest first)
- Excludes passwords from response

#### `PATCH /staffs/:id/approve` (Admin only)
- Approves a pending staff registration
- Sets `isApproved: true`
- Records `approvedAt` timestamp
- Records `approvedBy` (admin name from JWT token)

#### `PATCH /staffs/:id/reject` (Admin only)
- Rejects a pending registration
- Deletes the staff account from the database
- Requires admin confirmation (in frontend)

## Frontend Changes

### 1. Updated Register.js
- Modified success message to indicate pending approval
- Increased redirect timeout to 3 seconds

### 2. Updated api.js (API Service)
- Added three new staffAPI methods:
  - `getPending()` - fetch pending staff
  - `approve(id)` - approve a staff
  - `reject(id)` - reject a staff

### 3. New Component: ApprovePendingStaff.js
- Admin page to manage pending staff registrations
- Displays pending staff in a table with:
  - Staff ID, Name, Email, Position, Department
  - Registration date
  - Approve and Reject buttons
- Features:
  - Auto-refresh after approval/rejection
  - Confirmation dialog before rejecting
  - Loading and error states

### 4. Updated App.js
- Imported `ApprovePendingStaff` component
- Added new route: `/approve-pending-staff`
- Added navigation link in admin sidebar: "Approve Pending Staff"

## User Flow

### For New Staff:
1. Fill out registration form
2. Submit registration
3. See message: "Registration submitted successfully! Please wait for admin approval."
4. Redirected to login page
5. If they try to login before approval, see: "Your account is pending admin approval. Please wait for approval to login."

### For Admin:
1. Navigate to "Approve Pending Staff" page in sidebar
2. View all pending staff registrations
3. Click "Approve" to activate the account
4. Click "Reject" to delete the pending account
5. Once approved, staff can login with their credentials

## Database Changes
Existing staff records should be updated manually or through migration:
- Existing approved staff: set `isApproved: true`
- New registrations: automatically set to `isApproved: false`

## API Response Examples

### Registration Response
```json
{
  "message": "Registration submitted successfully. Please wait for admin approval."
}
```

### Login Attempt (Not Approved)
```json
{
  "message": "Your account is pending admin approval. Please wait for approval to login."
}
```

### Approve Staff Response
```json
{
  "message": "Staff registration approved",
  "staff": { /* staff object with isApproved: true */ }
}
```
