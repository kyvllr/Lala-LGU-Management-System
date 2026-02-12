# API Test Examples

Use these examples to test the LGU Filing System. You can use tools like Postman, curl, or VS Code REST Client.

---

## Setup: Create Staff Members

### Staff 1 - John Doe
```bash
curl -X POST http://localhost:5001/staffs \
  -H "Content-Type: application/json" \
  -d '{
    "id": "STF001",
    "name": "John Doe",
    "position": "Administrative Officer",
    "department": "Finance",
    "email": "john.doe@lgu.gov",
    "phone": "09123456789"
  }'
```

### Staff 2 - Maria Santos
```bash
curl -X POST http://localhost:5001/staffs \
  -H "Content-Type: application/json" \
  -d '{
    "id": "STF002",
    "name": "Maria Santos",
    "position": "Department Head",
    "department": "Human Resources",
    "email": "maria.santos@lgu.gov",
    "phone": "09198765432"
  }'
```

---

## Leave Management Examples

### 1. File a Vacation Leave Request
```bash
curl -X POST http://localhost:5001/leaves \
  -H "Content-Type: application/json" \
  -d '{
    "leaveId": "LV001",
    "staffId": "STF001",
    "staffName": "John Doe",
    "leaveType": "Vacation",
    "startDate": "2026-02-01",
    "endDate": "2026-02-05",
    "reason": "Family vacation during school break"
  }'
```

### 2. File a Sick Leave Request
```bash
curl -X POST http://localhost:5001/leaves \
  -H "Content-Type: application/json" \
  -d '{
    "leaveId": "LV002",
    "staffId": "STF002",
    "staffName": "Maria Santos",
    "leaveType": "Sick Leave",
    "startDate": "2026-02-08",
    "endDate": "2026-02-10",
    "reason": "Medical treatment and recovery"
  }'
```

### 3. Get All Leave Requests
```bash
curl -X GET http://localhost:5001/leaves
```

### 4. Get Pending Leave Requests
```bash
curl -X GET http://localhost:5001/leaves?status=Pending
```

### 5. Get Staff's Leave History
```bash
curl -X GET http://localhost:5001/leaves/staff/STF001
```

### 6. Get Single Leave Request
```bash
curl -X GET http://localhost:5001/leave/LV001
```

### 7. Approve Leave Request
```bash
curl -X PATCH http://localhost:5001/leaves/LV001/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "Jane Smith - Finance Department Head",
    "remarks": "Approved as requested. Enjoy your vacation."
  }'
```

### 8. Reject Leave Request
```bash
curl -X PATCH http://localhost:5001/leaves/LV002/reject \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "Admin Officer",
    "remarks": "Insufficient leave balance for the requested dates"
  }'
```

### 9. Update Pending Leave Request
```bash
curl -X PUT http://localhost:5001/leaves/LV002 \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-02-09",
    "endDate": "2026-02-11",
    "reason": "Medical appointment and treatment"
  }'
```

### 10. Delete Leave Request
```bash
curl -X DELETE http://localhost:5001/leaves/LV002
```

---

## Travel Order Management Examples

### 1. Request a Travel Order
```bash
curl -X POST http://localhost:5001/travel-orders \
  -H "Content-Type: application/json" \
  -d '{
    "travelOrderId": "TO001",
    "staffId": "STF001",
    "staffName": "John Doe",
    "destination": "Manila - Department of Interior and Local Government Office",
    "purpose": "Attend LGU Development Conference 2026",
    "dateFrom": "2026-02-15",
    "dateTo": "2026-02-17",
    "transportMode": "Land",
    "estimatedBudget": 8500
  }'
```

### 2. Request Air Travel
```bash
curl -X POST http://localhost:5001/travel-orders \
  -H "Content-Type: application/json" \
  -d '{
    "travelOrderId": "TO002",
    "staffId": "STF002",
    "staffName": "Maria Santos",
    "destination": "Cebu City - Regional Training Center",
    "purpose": "HR Management Seminar and Training",
    "dateFrom": "2026-03-01",
    "dateTo": "2026-03-05",
    "transportMode": "Air",
    "estimatedBudget": 25000
  }'
```

### 3. Get All Travel Orders
```bash
curl -X GET http://localhost:5001/travel-orders
```

### 4. Get Pending Travel Orders
```bash
curl -X GET http://localhost:5001/travel-orders?status=Pending
```

### 5. Get Approved Travel Orders
```bash
curl -X GET http://localhost:5001/travel-orders?status=Approved
```

### 6. Get Staff's Travel Orders
```bash
curl -X GET http://localhost:5001/travel-orders/staff/STF001
```

### 7. Get Single Travel Order
```bash
curl -X GET http://localhost:5001/travel-order/TO001
```

### 8. Approve Travel Order
```bash
curl -X PATCH http://localhost:5001/travel-orders/TO001/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "Budget Officer - Approved by Finance Department",
    "remarks": "Approved within departmental budget allocation. Safe travels!"
  }'
```

### 9. Reject Travel Order
```bash
curl -X PATCH http://localhost:5001/travel-orders/TO002/reject \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "Budget Officer",
    "remarks": "Request exceeds quarterly travel budget allocation"
  }'
```

### 10. Update Pending Travel Order
```bash
curl -X PUT http://localhost:5001/travel-orders/TO001 \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Tagaytay - LGU Planning Office",
    "dateFrom": "2026-02-16",
    "dateTo": "2026-02-18",
    "estimatedBudget": 7500
  }'
```

### 11. Mark Travel Order as Completed
```bash
curl -X PATCH http://localhost:5001/travel-orders/TO001/complete
```

### 12. Delete Travel Order
```bash
curl -X DELETE http://localhost:5001/travel-orders/TO002
```

---

## Staff Management Examples

### 1. Get All Staff
```bash
curl -X GET http://localhost:5001/staffs
```

### 2. Get Single Staff
```bash
curl -X GET http://localhost:5001/staffs/STF001
```

### 3. Update Staff Information
```bash
curl -X PUT http://localhost:5001/staffs/STF001 \
  -H "Content-Type: application/json" \
  -d '{
    "position": "Senior Administrative Officer",
    "department": "Finance and Audit"
  }'
```

### 4. Delete Staff
```bash
curl -X DELETE http://localhost:5001/staffs/STF001
```

---

## Advanced Scenarios

### Scenario 1: Complete Leave Request Workflow
```bash
# 1. Create staff
curl -X POST http://localhost:5001/staffs \
  -H "Content-Type: application/json" \
  -d '{"id": "STF003", "name": "Pedro Garcia", "position": "Engineer", "department": "Public Works"}'

# 2. File leave
curl -X POST http://localhost:5001/leaves \
  -H "Content-Type: application/json" \
  -d '{"leaveId": "LV003", "staffId": "STF003", "staffName": "Pedro Garcia", "leaveType": "Vacation", "startDate": "2026-04-01", "endDate": "2026-04-05", "reason": "Annual vacation"}'

# 3. Approve leave
curl -X PATCH http://localhost:5001/leaves/LV003/approve \
  -H "Content-Type: application/json" \
  -d '{"approvedBy": "Supervisor", "remarks": "Approved"}'

# 4. Verify approval
curl -X GET http://localhost:5001/leave/LV003
```

### Scenario 2: Multiple Travel Requests from Same Staff
```bash
# Get all travel orders for STF001
curl -X GET http://localhost:5001/travel-orders/staff/STF001

# Get approved ones only
curl -X GET "http://localhost:5001/travel-orders?status=Approved" | grep STF001
```

### Scenario 3: Department Leave Statistics
```bash
# Get all pending leaves
curl -X GET http://localhost:5001/leaves?status=Pending

# Get all approved leaves
curl -X GET http://localhost:5001/leaves?status=Approved
```

---

## Testing with JavaScript (Node.js)

Save as `test.js` and run with `node test.js`:

```javascript
const http = require('http');

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        resolve(JSON.parse(responseData));
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  try {
    console.log('1. Creating staff...');
    await makeRequest('POST', '/staffs', {
      id: 'STF001',
      name: 'Test User',
      position: 'Officer',
      department: 'Test Department'
    });

    console.log('2. Filing leave...');
    await makeRequest('POST', '/leaves', {
      leaveId: 'LV001',
      staffId: 'STF001',
      staffName: 'Test User',
      leaveType: 'Vacation',
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      reason: 'Test leave'
    });

    console.log('3. Getting all leaves...');
    const leaves = await makeRequest('GET', '/leaves');
    console.log('Leaves:', leaves);

  } catch (error) {
    console.error('Error:', error);
  }
}

runTests();
```

---

## Notes

- Replace `http://localhost:5001` with your actual server URL if deployed elsewhere
- All timestamps are in ISO 8601 format
- Dates should be formatted as `YYYY-MM-DD`
- Staff ID must exist before filing leave or travel requests
- Leave and travel orders cannot be modified after approval or rejection
