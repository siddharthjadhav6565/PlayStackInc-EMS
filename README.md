# PlayStackInc EMS

A full-stack **Employee Management System (EMS)** for managing employee records, role-based access, workforce analytics, bulk imports, and employee lifecycle actions.

## Features

- Secure JWT-based login and logout
- Role-based access control for `SUPERADMIN`, `HRMANAGER`, and `EMPLOYEE`
- Employee directory with pagination
- Create and edit employee records
- Activate or deactivate employees
- Soft-delete and restore employee records
- Search employees by name, email, or employee ID
- Filter employees by department, role, status, and deleted state
- Dashboard statistics: total, active, inactive, HR managers, and employees
- Department distribution and workforce-status charts
- CSV employee import with per-row error reporting
- CSV export and downloadable import template
- Employee profile-image URL support
- Reporting-manager assignment
- Responsive desktop and mobile interface
- Light, dark, and system theme support

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Axios
- Recharts

### Backend

- Node.js
- TypeScript
- Express
- Prisma ORM
- JWT authentication
- PostgreSQL or compatible Prisma database

## Project Structure

```text
PlayStackInc-EMS/
├── backend/
│   ├── prisma/
│   ├── src/
│   ├── uploads/
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    ├── public/
    ├── package.json
    └── vite.config.ts
```

## User Roles

| Role | Permissions |
|---|---|
| `SUPERADMIN` | Full system access, employee management, imports, updates, delete/restore operations |
| `HRMANAGER` | Manage employee records, imports, status changes, and directory operations |
| `EMPLOYEE` | Authenticated user access; employee-management actions are restricted in the UI |

## API Base URL

```text
https://playstackinc-ems.onrender.com/api
```

For local development:

```text
http://localhost:<PORT>/api
```

## Authentication

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

#### Request body

```json
{
  "email": "admin@company.com",
  "password": "your-password"
}
```

#### Success response — `200 OK`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "employeeId": "EMP-1001",
    "name": "Admin User",
    "email": "admin@company.com",
    "role": "SUPERADMIN"
  }
}
```

#### Failure response — `401 Unauthorized`

```json
{
  "message": "Invalid email or password"
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <JWT_TOKEN>
```

#### Success response — `200 OK`

```json
{
  "message": "Logged out successfully"
}
```

> The frontend clears the JWT and current-user data from browser storage after logout.

## JWT Security

Protected routes require an `Authorization` header:

```http
Authorization: Bearer <JWT_TOKEN>
```

Example:

```http
GET /api/employees
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Security measures included:

- Passwords should be stored as secure hashes, never plaintext
- JWT is required for protected employee routes
- Authorization is role-aware for management actions
- Invalid, expired, or missing tokens should return `401 Unauthorized`
- Insufficient permissions should return `403 Forbidden`
- Frontend API URL is configured using `VITE_API_URL`
- Secrets such as `JWT_SECRET` and `DATABASE_URL` must remain backend-only

## Employee API

### Get employees

```http
GET /api/employees
Authorization: Bearer <JWT_TOKEN>
```

#### Query parameters

| Parameter | Example | Purpose |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `10` | Records per page |
| `search` | `aarav` | Search by name, email, or employee ID |
| `department` | `Engineering` | Filter by department |
| `role` | `EMPLOYEE` | Filter by role |
| `status` | `ACTIVE` | Filter by status |
| `includeDeleted` | `true` | Include soft-deleted employees |

Example:

```http
GET /api/employees?page=1&limit=10&department=Engineering&status=ACTIVE
```

#### Success response — `200 OK`

```json
{
  "data": [
    {
      "id": "employee-uuid",
      "employeeId": "EMP-1001",
      "name": "Aarav Sharma",
      "email": "aarav@company.com",
      "phone": "919876543210",
      "department": "Engineering",
      "designation": "Software Engineer",
      "salary": 65000,
      "joiningDate": "2026-07-17T00:00:00.000Z",
      "profileImage": null,
      "role": "EMPLOYEE",
      "status": "ACTIVE",
      "managerId": "manager-uuid",
      "deletedAt": null,
      "createdAt": "2026-07-17T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### Dashboard statistics

```http
GET /api/employees/stats
Authorization: Bearer <JWT_TOKEN>
```

#### Success response — `200 OK`

```json
{
  "data": {
    "total": 25,
    "active": 21,
    "inactive": 4,
    "hrManagers": 2,
    "employees": 22
  }
}
```

### Create employee

```http
POST /api/employees
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request body

```json
{
  "employeeId": "EMP-1002",
  "name": "Priya Patel",
  "email": "priya@company.com",
  "password": "TempPass123",
  "phone": "919876543210",
  "department": "Human Resources",
  "designation": "HR Executive",
  "salary": 55000,
  "joiningDate": "2026-07-17",
  "profileImage": "https://example.com/profile.jpg",
  "role": "EMPLOYEE",
  "status": "ACTIVE",
  "managerId": null
}
```

#### Success response — `201 Created`

```json
{
  "message": "Employee created successfully",
  "data": {
    "id": "employee-uuid",
    "employeeId": "EMP-1002",
    "name": "Priya Patel",
    "email": "priya@company.com",
    "role": "EMPLOYEE",
    "status": "ACTIVE"
  }
}
```

### Update employee

```http
PUT /api/employees/:id
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request body

```json
{
  "employeeId": "EMP-1002",
  "name": "Priya Patel",
  "email": "priya@company.com",
  "password": "",
  "phone": "919876543210",
  "department": "Human Resources",
  "designation": "Senior HR Executive",
  "salary": 65000,
  "joiningDate": "2026-07-17",
  "profileImage": null,
  "role": "HRMANAGER",
  "status": "ACTIVE",
  "managerId": null
}
```

> Send an empty password to retain the existing password during an update.

#### Success response — `200 OK`

```json
{
  "message": "Employee updated successfully",
  "data": {
    "id": "employee-uuid",
    "employeeId": "EMP-1002",
    "name": "Priya Patel",
    "role": "HRMANAGER",
    "status": "ACTIVE"
  }
}
```

### Change employee status

```http
PATCH /api/employees/:id/status
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request body

```json
{
  "status": "INACTIVE"
}
```

#### Success response — `200 OK`

```json
{
  "message": "Employee status updated successfully",
  "data": {
    "id": "employee-uuid",
    "status": "INACTIVE"
  }
}
```

### Soft delete employee

```http
DELETE /api/employees/:id
Authorization: Bearer <JWT_TOKEN>
```

#### Success response — `200 OK`

```json
{
  "message": "Employee moved to deleted records"
}
```

Soft deletion preserves the database record and stores a `deletedAt` timestamp instead of permanently deleting the employee.

### Restore employee

```http
PATCH /api/employees/:id/restore
Authorization: Bearer <JWT_TOKEN>
```

#### Success response — `200 OK`

```json
{
  "message": "Employee restored successfully",
  "data": {
    "id": "employee-uuid",
    "deletedAt": null
  }
}
```

## CSV Import

### Import employees

```http
POST /api/employees/import
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

#### Form-data field

| Key | Type | Description |
|---|---|---|
| `file` | File | Employee CSV file |

Required CSV columns:

```text
employeeId,name,email,password,phone,department,designation,salary,joiningDate,role,status,managerId,profileImage
```

Example row:

```csv
EMP-1001,Aarav Sharma,aarav@company.com,TempPass123,919876543210,Engineering,Software Engineer,65000,2026-07-17,EMPLOYEE,ACTIVE,,
```

#### Success response — `200 OK`

```json
{
  "data": {
    "created": 8,
    "failed": 2,
    "errors": [
      {
        "row": 4,
        "message": "Email already exists"
      },
      {
        "row": 7,
        "message": "Invalid employee role"
      }
    ]
  }
}
```

## Error Responses

### Validation error — `400 Bad Request`

```json
{
  "message": "Validation failed",
  "errors": [
    {
      "path": ["email"],
      "message": "Invalid email address"
    }
  ]
}
```

### Missing token — `401 Unauthorized`

```json
{
  "message": "Authentication token is required"
}
```

### Invalid token — `401 Unauthorized`

```json
{
  "message": "Invalid or expired token"
}
```

### Forbidden action — `403 Forbidden`

```json
{
  "message": "You do not have permission to perform this action"
}
```

### Not found — `404 Not Found`

```json
{
  "message": "Employee not found"
}
```

### Server error — `500 Internal Server Error`

```json
{
  "message": "Internal server error"
}
```

## Local Setup

### Clone the repository

```bash
git clone https://github.com/siddharthjadhav6565/PlayStackInc-EMS.git
cd PlayStackInc-EMS
```

### Backend setup

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npx tsx src/server.ts
```

### Frontend setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Backend `.env`

```env
DATABASE_URL="your-database-connection-string"
JWT_SECRET="use-a-long-random-secret"
PORT=5000
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:5000/api
```

For production:

```env
VITE_API_URL=https://playstackinc-ems.onrender.com/api
```

## Deployment

### Backend: Render

Configure the backend as a Render Web Service.

```text
Root Directory: backend
Build Command: npm install && npx prisma generate
Start Command: npx tsx src/server.ts
```

Required Render environment variables:

```text
DATABASE_URL
JWT_SECRET
PORT
```

The server must use the platform-provided port:

```ts
const port = Number(process.env.PORT) || 5000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
```

### Frontend: Vercel

Configure the frontend as a Vercel project.

```text
Framework Preset: Vite
Root Directory: frontend
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

## Production Notes

- Never commit `.env` files, database URLs, or JWT secrets
- Use a strong and unique `JWT_SECRET`
- Configure CORS to allow only the deployed frontend URL
- Use HTTPS for deployed frontend and backend services
- Keep Prisma migrations and schema changes under version control
- Use `npm run build` to verify that the frontend compiles before deployment

## Author

**Siddharth Jadhav**  
Full-Stack Developer
