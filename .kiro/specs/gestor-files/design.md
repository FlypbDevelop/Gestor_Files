# Design Document: Sistema de Gerenciamento de Arquivos

## Overview

O Sistema de Gerenciamento de Arquivos é uma aplicação web full-stack que implementa controle de acesso baseado em planos de assinatura, com limites de download e roles de usuário. O sistema permite que administradores façam upload e gerenciem arquivos com regras de acesso granulares, enquanto usuários podem baixar arquivos de acordo com seu plano de assinatura.

### Key Design Goals

- **Segurança**: Validação de downloads sempre via backend, sem exposição de paths reais
- **Escalabilidade**: Streaming de arquivos para evitar sobrecarga de memória
- **Flexibilidade**: Sistema de planos configurável com features em JSON
- **Auditabilidade**: Registro completo de todas as operações de download
- **Responsividade**: Interface mobile-first com suporte a PWA

### Technology Stack

**Backend:**
- Node.js 18+ com Express.js
- SQLite3 para persistência
- JWT para autenticação
- bcrypt para hashing de senhas
- multer para upload de arquivos

**Frontend:**
- React 18+ com TypeScript
- Vite como build tool
- React Router para navegação
- TailwindCSS para estilização
- Axios para comunicação HTTP

**Arquitetura:**
- Monorepo com client e server separados
- API RESTful
- Autenticação stateless via JWT

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Auth UI    │  │  Admin UI    │  │   User UI    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  API Client    │                        │
│                    │   (Axios)      │                        │
│                    └───────┬────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTP/JSON + JWT
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                      Backend (Express)                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Middleware Layer                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │   CORS     │  │    Auth    │  │   Error    │    │   │
│  │  │  Handler   │  │ Middleware │  │  Handler   │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Service Layer                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │   Auth     │  │    File    │  │  Download  │    │   │
│  │  │  Service   │  │  Manager   │  │ Controller │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  │  ┌────────────┐  ┌────────────┐                    │   │
│  │  │   Upload   │  │   Access   │                    │   │
│  │  │  Service   │  │ Validator  │                    │   │
│  │  └────────────┘  └────────────┘                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Data Layer                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │   User     │  │    File    │  │  Download  │    │   │
│  │  │   Model    │  │   Model    │  │   Model    │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  │  ┌────────────┐                                     │   │
│  │  │    Plan    │                                     │   │
│  │  │   Model    │                                     │   │
│  │  └────────────┘                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  SQLite DB     │                        │
│                    └────────────────┘                        │
└───────────────────────────────────────────────────────────────┘
```

### Project Structure

```
gestor-files/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── admin/         # Admin Dashboard, File Upload
│   │   │   ├── user/          # User Dashboard, File List
│   │   │   └── common/        # Shared components
│   │   ├── services/          # API client services
│   │   ├── hooks/             # Custom React hooks
│   │   ├── contexts/          # React contexts (Auth)
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Helper functions
│   │   ├── App.tsx            # Main app component
│   │   └── main.tsx           # Entry point
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   └── icons/             # PWA icons
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                    # Backend Node.js application
│   ├── src/
│   │   ├── controllers/       # Route controllers
│   │   │   ├── authController.js
│   │   │   ├── fileController.js
│   │   │   ├── downloadController.js
│   │   │   └── userController.js
│   │   ├── services/          # Business logic
│   │   │   ├── authService.js
│   │   │   ├── fileManager.js
│   │   │   ├── uploadService.js
│   │   │   ├── accessValidator.js
│   │   │   └── downloadController.js
│   │   ├── models/            # Data models
│   │   │   ├── User.js
│   │   │   ├── File.js
│   │   │   ├── Download.js
│   │   │   └── Plan.js
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.js
│   │   │   ├── roleCheck.js
│   │   │   └── errorHandler.js
│   │   ├── routes/            # API routes
│   │   │   ├── auth.js
│   │   │   ├── files.js
│   │   │   ├── downloads.js
│   │   │   └── users.js
│   │   ├── db/                # Database
│   │   │   ├── database.js    # SQLite connection
│   │   │   ├── migrations/    # Schema migrations
│   │   │   └── seeds/         # Initial data
│   │   ├── utils/             # Utilities
│   │   │   ├── jwt.js
│   │   │   ├── validation.js
│   │   │   └── planParser.js
│   │   ├── config/            # Configuration
│   │   │   └── index.js
│   │   └── server.js          # Entry point
│   ├── uploads/               # File storage directory
│   └── package.json
│
└── README.md
```

### Communication Flow

**Authentication Flow:**
```
Client → POST /api/auth/login → Auth Service → JWT Token → Client
Client stores JWT in localStorage
Client includes JWT in Authorization header for subsequent requests
```

**File Upload Flow (Admin):**
```
Admin Client → POST /api/files/upload (multipart/form-data)
→ Auth Middleware → Role Check (ADMIN)
→ Upload Service → File System + Database
→ Response with file metadata
```

**File Download Flow (User):**
```
User Client → GET /api/downloads/:fileId
→ Auth Middleware → Download Controller
→ Access Validator (plan check, limit check)
→ Download Log creation
→ File Stream → Client
```

## Components and Interfaces

### Backend Components

#### Auth Service

Responsável por autenticação e gerenciamento de usuários.

```javascript
class AuthService {
  /**
   * Registra novo usuário com role USER e plano Free
   * @param {string} name - Nome do usuário
   * @param {string} email - Email único
   * @param {string} password - Senha (min 8 caracteres)
   * @returns {Promise<{id, name, email, role, plan_id}>}
   * @throws {Error} Se email já existe ou validação falha
   */
  async register(name, email, password)

  /**
   * Autentica usuário e gera JWT token
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{token, user}>}
   * @throws {Error} Se credenciais inválidas
   */
  async login(email, password)

  /**
   * Valida JWT token e retorna payload
   * @param {string} token
   * @returns {Promise<{userId, email, role}>}
   * @throws {Error} Se token inválido ou expirado
   */
  async verifyToken(token)

  /**
   * Hash de senha usando bcrypt
   * @param {string} password
   * @returns {Promise<string>} Hash da senha
   */
  async hashPassword(password)

  /**
   * Compara senha com hash
   * @param {string} password
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  async comparePassword(password, hash)
}
```

#### File Manager

Gerencia operações de arquivos e permissões.

```javascript
class FileManager {
  /**
   * Cria registro de arquivo no banco
   * @param {Object} fileData
   * @param {string} fileData.filename
   * @param {string} fileData.path
   * @param {string} fileData.mime_type
   * @param {number} fileData.size
   * @param {number} fileData.uploaded_by
   * @returns {Promise<File>}
   */
  async createFile(fileData)

  /**
   * Atualiza permissões de arquivo
   * @param {number} fileId
   * @param {number[]} allowedPlanIds
   * @param {number|null} maxDownloadsPerUser
   * @returns {Promise<File>}
   */
  async updateFilePermissions(fileId, allowedPlanIds, maxDownloadsPerUser)

  /**
   * Lista arquivos acessíveis para um plano
   * @param {number} planId
   * @param {number} userId - Para calcular downloads restantes
   * @returns {Promise<File[]>}
   */
  async listFilesForPlan(planId, userId)

  /**
   * Busca arquivo por ID
   * @param {number} fileId
   * @returns {Promise<File|null>}
   */
  async getFileById(fileId)

  /**
   * Deleta arquivo (registro e arquivo físico)
   * @param {number} fileId
   * @returns {Promise<void>}
   */
  async deleteFile(fileId)
}
```

#### Upload Service

Processa upload de arquivos.

```javascript
class UploadService {
  /**
   * Processa upload de arquivo
   * @param {Express.Multer.File} file - Arquivo do multer
   * @param {number} uploadedBy - ID do admin
   * @returns {Promise<File>}
   * @throws {Error} Se arquivo excede 100MB ou upload falha
   */
  async processUpload(file, uploadedBy)

  /**
   * Valida arquivo antes do upload
   * @param {Express.Multer.File} file
   * @returns {boolean}
   * @throws {Error} Se validação falha
   */
  validateFile(file)

  /**
   * Gera nome único para arquivo
   * @param {string} originalName
   * @returns {string}
   */
  generateUniqueFilename(originalName)
}
```

#### Access Validator

Valida permissões de acesso a arquivos.

```javascript
class AccessValidator {
  /**
   * Valida se usuário pode baixar arquivo
   * @param {number} userId
   * @param {number} fileId
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  async validateDownloadAccess(userId, fileId)

  /**
   * Verifica se plano do usuário tem acesso ao arquivo
   * @param {number} planId
   * @param {number[]} allowedPlanIds
   * @returns {boolean}
   */
  checkPlanAccess(planId, allowedPlanIds)

  /**
   * Verifica se usuário excedeu limite de downloads
   * @param {number} userId
   * @param {number} fileId
   * @param {number|null} maxDownloads
   * @returns {Promise<{allowed: boolean, current: number, max: number|null}>}
   */
  async checkDownloadLimit(userId, fileId, maxDownloads)
}
```

#### Download Controller

Controla processo de download com validação e logging.

```javascript
class DownloadController {
  /**
   * Processa requisição de download
   * @param {number} userId
   * @param {number} fileId
   * @param {string} ipAddress
   * @param {Express.Response} res
   * @returns {Promise<void>}
   * @throws {Error} Se validação falha
   */
  async processDownload(userId, fileId, ipAddress, res)

  /**
   * Registra download no banco
   * @param {number} userId
   * @param {number} fileId
   * @param {string} ipAddress
   * @returns {Promise<Download>}
   */
  async logDownload(userId, fileId, ipAddress)

  /**
   * Faz streaming do arquivo para resposta
   * @param {string} filePath
   * @param {string} filename
   * @param {string} mimeType
   * @param {Express.Response} res
   * @returns {Promise<void>}
   */
  async streamFile(filePath, filename, mimeType, res)

  /**
   * Extrai IP real considerando proxies
   * @param {Express.Request} req
   * @returns {string}
   */
  getRealIpAddress(req)
}
```

### Frontend Components

#### Auth Context

Gerencia estado de autenticação global.

```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>();
```

#### API Client Service

```typescript
class ApiClient {
  private baseURL: string;
  private token: string | null;

  setToken(token: string): void;
  
  // Auth endpoints
  login(email: string, password: string): Promise<{token: string, user: User}>;
  register(name: string, email: string, password: string): Promise<{token: string, user: User}>;
  
  // File endpoints
  listFiles(): Promise<File[]>;
  uploadFile(file: File, permissions: FilePermissions): Promise<File>;
  updateFilePermissions(fileId: number, permissions: FilePermissions): Promise<File>;
  deleteFile(fileId: number): Promise<void>;
  
  // Download endpoints
  downloadFile(fileId: number): Promise<Blob>;
  getDownloadHistory(): Promise<Download[]>;
  
  // User endpoints
  getCurrentUser(): Promise<User>;
  updateUserPlan(userId: number, planId: number): Promise<User>;
  
  // Admin endpoints
  getStats(): Promise<AdminStats>;
  listAllUsers(): Promise<User[]>;
}
```

#### Component Structure

**Admin Dashboard:**
```typescript
interface AdminDashboardProps {}

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  // Displays: total users, files, downloads
  // Shows: most downloaded files
  // Shows: user distribution by plan
}
```

**File Upload Component:**
```typescript
interface FileUploadProps {
  onUploadComplete: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  // File selection
  // Plan selection (multiple)
  // Max downloads per user input
  // Upload progress
}
```

**File List Component:**
```typescript
interface FileListProps {
  files: File[];
  onDownload: (fileId: number) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onDownload }) => {
  // Displays files with metadata
  // Shows downloads remaining
  // Download button
}
```

**User Dashboard:**
```typescript
interface UserDashboardProps {}

const UserDashboard: React.FC<UserDashboardProps> = () => {
  // Shows current plan
  // Shows download history
  // Shows total downloads
}
```

### Middleware

#### Auth Middleware

```javascript
/**
 * Valida JWT token e adiciona user ao request
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Express.NextFunction} next
 */
async function authMiddleware(req, res, next) {
  // Extract token from Authorization header
  // Verify token
  // Attach user to req.user
  // Call next() or return 401
}
```

#### Role Check Middleware

```javascript
/**
 * Verifica se usuário tem role necessária
 * @param {string[]} allowedRoles
 * @returns {Express.Middleware}
 */
function roleCheck(allowedRoles) {
  return (req, res, next) => {
    // Check if req.user.role is in allowedRoles
    // Call next() or return 403
  };
}
```

## Data Models

### Database Schema

#### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('USER', 'ADMIN')),
  plan_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan_id ON users(plan_id);
```

#### Plans Table

```sql
CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  features TEXT NOT NULL, -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plans_name ON plans(name);
```

**Features JSON Structure:**
```json
{
  "maxDownloadsPerMonth": 10,
  "maxFileSize": 50,
  "prioritySupport": false,
  "customFeatures": []
}
```

#### Files Table

```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL, -- bytes
  uploaded_by INTEGER NOT NULL,
  allowed_plan_ids TEXT NOT NULL, -- JSON array: "[1,2,3]"
  max_downloads_per_user INTEGER, -- NULL = unlimited
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX idx_files_created_at ON files(created_at DESC);
```

#### Downloads Table

```sql
CREATE TABLE downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE INDEX idx_downloads_user_file ON downloads(user_id, file_id);
CREATE INDEX idx_downloads_file_id ON downloads(file_id);
CREATE INDEX idx_downloads_downloaded_at ON downloads(downloaded_at DESC);
```

### Entity Relationships

```
┌─────────────┐
│    Plans    │
│             │
│ id (PK)     │
│ name        │
│ price       │
│ features    │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────┐
│    Users    │
│             │
│ id (PK)     │
│ email       │
│ role        │
│ plan_id(FK) │
└──────┬──────┘
       │
       │ 1:N (uploaded_by)
       │
┌──────▼──────┐         ┌─────────────┐
│    Files    │         │  Downloads  │
│             │         │             │
│ id (PK)     │◄────────┤ file_id(FK) │
│ filename    │  1:N    │ user_id(FK) │
│ path        │         │ ip_address  │
│ allowed_... │         │ downloaded..│
└─────────────┘         └──────▲──────┘
                               │
                               │ N:1
                               │
                        ┌──────┴──────┐
                        │    Users    │
                        └─────────────┘
```

### Migration Strategy

**Migration Files Structure:**
```
server/src/db/migrations/
├── 001_create_plans_table.sql
├── 002_create_users_table.sql
├── 003_create_files_table.sql
├── 004_create_downloads_table.sql
└── 005_seed_default_plans.sql
```

**Migration Runner:**
```javascript
class MigrationRunner {
  /**
   * Executa todas as migrations pendentes
   * @returns {Promise<void>}
   */
  async runMigrations()

  /**
   * Verifica quais migrations já foram executadas
   * @returns {Promise<string[]>}
   */
  async getExecutedMigrations()

  /**
   * Marca migration como executada
   * @param {string} migrationName
   * @returns {Promise<void>}
   */
  async markMigrationExecuted(migrationName)
}
```

### Data Access Patterns

**Query Optimization:**

1. **List files for user plan:**
```sql
SELECT f.*, 
  (SELECT COUNT(*) FROM downloads WHERE user_id = ? AND file_id = f.id) as downloads_count,
  f.max_downloads_per_user
FROM files f
WHERE json_extract(f.allowed_plan_ids, '$') LIKE '%' || ? || '%'
ORDER BY f.created_at DESC;
```

2. **Check download limit:**
```sql
SELECT COUNT(*) as download_count
FROM downloads
WHERE user_id = ? AND file_id = ?;
```

3. **Admin statistics:**
```sql
-- Total users
SELECT COUNT(*) FROM users;

-- Total files
SELECT COUNT(*) FROM files;

-- Total downloads
SELECT COUNT(*) FROM downloads;

-- Most downloaded files
SELECT f.filename, COUNT(d.id) as download_count
FROM files f
LEFT JOIN downloads d ON f.id = d.file_id
GROUP BY f.id
ORDER BY download_count DESC
LIMIT 10;

-- Users by plan
SELECT p.name, COUNT(u.id) as user_count
FROM plans p
LEFT JOIN users u ON p.id = u.plan_id
GROUP BY p.id;
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid credentials generate valid 24-hour tokens

*For any* valid email and password combination, when authenticated through the Auth Service, the system should generate a JWT token that is valid and expires exactly 24 hours from creation.

**Validates: Requirements 1.1**

### Property 2: Invalid credentials return 401

*For any* invalid email or password combination, when authentication is attempted, the Auth Service should return a 401 error.

**Validates: Requirements 1.2**

### Property 3: Expired tokens are rejected

*For any* JWT token with an expiration date in the past, when used for authentication, the system should return a 401 error.

**Validates: Requirements 1.4**

### Property 4: New users get default role and plan

*For any* valid registration data (name, email, password), when a new user is created, the Auth Service should assign role USER and the Free plan.

**Validates: Requirements 2.1**

### Property 5: Duplicate emails are rejected

*For any* email that already exists in the system, when registration is attempted with that email, the Auth Service should return a 409 error.

**Validates: Requirements 2.2**

### Property 6: Short passwords are rejected

*For any* password with fewer than 8 characters, when registration or password change is attempted, the Auth Service should reject it with a validation error.

**Validates: Requirements 2.3**

### Property 7: Invalid email formats are rejected

*For any* string that does not match valid email format, when registration is attempted, the Auth Service should reject it with a validation error.

**Validates: Requirements 2.4**

### Property 8: USER role cannot access admin endpoints

*For any* authenticated user with role USER, when attempting to access administrative endpoints, the system should return a 403 error.

**Validates: Requirements 3.1**

### Property 9: ADMIN role can access admin endpoints

*For any* authenticated user with role ADMIN, when accessing administrative endpoints, the system should allow the operation to proceed.

**Validates: Requirements 3.2**

### Property 10: File upload creates both file and database record

*For any* valid file uploaded by an admin, the Upload Service should store the file on disk and create a database record containing filename, path, mime_type, size, and timestamp.

**Validates: Requirements 4.1, 4.2**

### Property 11: Failed uploads don't create database records

*For any* file upload that fails (due to size, permissions, or disk errors), the Upload Service should not create a database record and should return a descriptive error.

**Validates: Requirements 4.4**

### Property 12: Multiple plans can be assigned to files

*For any* set of valid plan IDs, when an admin configures file permissions, the File Manager should accept and store all plan IDs in the allowed_plan_ids array.

**Validates: Requirements 5.1**

### Property 13: Download limits accept positive integers

*For any* positive integer, when set as max_downloads_per_user for a file, the File Manager should accept and store the value.

**Validates: Requirements 5.2**

### Property 14: Plan IDs round-trip correctly

*For any* array of plan IDs, when stored in allowed_plan_ids and then retrieved, the system should return an equivalent array.

**Validates: Requirements 5.3**

### Property 15: Negative download limits are rejected

*For any* negative number or non-integer value, when set as max_downloads_per_user, the File Manager should reject it with a validation error.

**Validates: Requirements 5.4**

### Property 16: Users only see files for their plan

*For any* user with a specific plan, when requesting the file list, the system should return only files where allowed_plan_ids includes the user's plan_id.

**Validates: Requirements 6.1**

### Property 17: File listings include remaining downloads

*For any* file in a user's file list, the system should include the correct count of remaining downloads based on max_downloads_per_user minus downloads already made by that user.

**Validates: Requirements 6.2**

### Property 18: Files are ordered by creation date descending

*For any* file list request, the system should return files ordered by created_at in descending order (newest first).

**Validates: Requirements 6.3**

### Property 19: File listings include required metadata

*For any* file in a file list response, the system should include filename, size, mime_type, and downloads_remaining.

**Validates: Requirements 6.4**

### Property 20: Unauthenticated download requests fail

*For any* download request without a valid authentication token, the Download Controller should reject the request with a 401 error.

**Validates: Requirements 7.1**

### Property 21: Unauthorized plan access is denied

*For any* user whose plan is not in a file's allowed_plan_ids, when attempting to download that file, the Download Controller should reject the request with a 403 error.

**Validates: Requirements 7.2**

### Property 22: Over-limit downloads are denied

*For any* user who has already downloaded a file the maximum allowed times, when attempting another download, the Download Controller should reject the request with a 429 error.

**Validates: Requirements 7.3**

### Property 23: Successful downloads create log entries

*For any* successful file download, the system should create a record in the downloads table with user_id, file_id, timestamp, and ip_address.

**Validates: Requirements 8.1**

### Property 24: Failed downloads don't create log entries

*For any* download request that fails validation (authentication, authorization, or limits), the system should not create a record in the downloads table.

**Validates: Requirements 8.2**

### Property 25: Real IP address is extracted correctly

*For any* HTTP request with proxy headers (X-Forwarded-For, X-Real-IP), the system should extract and log the real client IP address, not the proxy IP.

**Validates: Requirements 8.3**

### Property 26: Download limit enforcement with count

*For any* file with max_downloads_per_user set, when a user's download count for that file reaches or exceeds the limit, the Download Controller should return a 429 error including the current download count.

**Validates: Requirements 9.1, 9.2, 9.4**

### Property 27: NULL limits allow unlimited downloads

*For any* file with max_downloads_per_user set to NULL, users should be able to download the file regardless of how many times they have already downloaded it.

**Validates: Requirements 9.3**

### Property 28: Plans can be created with all required fields

*For any* valid plan data with unique name, price, and features JSON, the system should successfully create the plan.

**Validates: Requirements 10.1**

### Property 29: Duplicate plan names are rejected

*For any* plan name that already exists, when attempting to create a new plan with that name, the system should return an error.

**Validates: Requirements 10.2**

### Property 30: Plan features round-trip correctly

*For any* valid features object, when parsed to JSON, stored in a plan, retrieved, and parsed again, the system should produce an equivalent object.

**Validates: Requirements 10.3, 16.1, 16.2, 16.4**

### Property 31: Plan changes update user immediately

*For any* user and valid target plan, when the user's plan is changed (upgrade or downgrade), the system should update the user's plan_id and immediately apply new file access permissions.

**Validates: Requirements 11.1, 11.2, 11.4**

### Property 32: Invalid plan IDs are rejected

*For any* plan ID that does not exist in the system, when attempting to assign it to a user, the system should reject the operation with an error.

**Validates: Requirements 11.3**

### Property 33: Admin dashboard shows accurate counts

*For any* system state, when an admin requests dashboard statistics, the system should return accurate counts of total users, total files, and total downloads.

**Validates: Requirements 12.1**

### Property 34: Most downloaded files are ranked correctly

*For any* system state with download history, when an admin requests dashboard statistics, the system should return files ranked by download count in descending order.

**Validates: Requirements 12.2**

### Property 35: User distribution by plan is accurate

*For any* system state, when an admin requests dashboard statistics, the system should return accurate counts of users grouped by plan.

**Validates: Requirements 12.3**

### Property 36: User download history is ordered by date

*For any* user with download history, when requesting their dashboard, the system should return downloads ordered by downloaded_at in descending order (most recent first).

**Validates: Requirements 13.1**

### Property 37: User dashboard shows current plan info

*For any* user, when requesting their dashboard, the system should display their current plan information.

**Validates: Requirements 13.2**

### Property 38: User dashboard shows accurate download count

*For any* user with download history, when requesting their dashboard, the system should display the correct total count of downloads made by that user.

**Validates: Requirements 13.3**

### Property 39: Download history includes required fields

*For any* download in a user's history, the system should include filename, download date, and download time.

**Validates: Requirements 13.4**

### Property 40: Download responses include required headers

*For any* successful file download, the HTTP response should include Content-Type, Content-Disposition, and Content-Length headers with correct values.

**Validates: Requirements 15.3**

### Property 41: Filesystem paths are never exposed

*For any* API response containing file information, the response should not include the actual filesystem path where the file is stored.

**Validates: Requirements 15.4**

## Error Handling

### Error Response Format

All API errors follow a consistent JSON format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Error Categories

**Authentication Errors (401):**
- `INVALID_CREDENTIALS`: Email or password incorrect
- `TOKEN_EXPIRED`: JWT token has expired
- `TOKEN_INVALID`: JWT token is malformed or invalid
- `TOKEN_MISSING`: No authentication token provided

**Authorization Errors (403):**
- `INSUFFICIENT_PERMISSIONS`: User role does not have access
- `PLAN_ACCESS_DENIED`: User's plan does not allow access to resource

**Validation Errors (400):**
- `INVALID_EMAIL`: Email format is invalid
- `PASSWORD_TOO_SHORT`: Password has fewer than 8 characters
- `INVALID_FILE_SIZE`: File exceeds maximum size
- `INVALID_PLAN_ID`: Plan ID does not exist
- `INVALID_DOWNLOAD_LIMIT`: Download limit is not a positive integer

**Conflict Errors (409):**
- `EMAIL_EXISTS`: Email is already registered
- `PLAN_NAME_EXISTS`: Plan name is already in use

**Rate Limit Errors (429):**
- `DOWNLOAD_LIMIT_EXCEEDED`: User has exceeded download limit for file
  - Includes: `current` (downloads made), `max` (limit)

**Not Found Errors (404):**
- `USER_NOT_FOUND`: User ID does not exist
- `FILE_NOT_FOUND`: File ID does not exist
- `PLAN_NOT_FOUND`: Plan ID does not exist

**Server Errors (500):**
- `UPLOAD_FAILED`: File upload failed
- `DATABASE_ERROR`: Database operation failed
- `FILE_SYSTEM_ERROR`: File system operation failed

### Error Handling Strategy

**Backend:**
- Centralized error handler middleware
- Automatic error logging with stack traces
- Sanitized error messages for production (no stack traces to client)
- Transaction rollback on database errors
- Cleanup of partial uploads on failure

**Frontend:**
- Global error boundary for React errors
- Toast notifications for user-facing errors
- Retry logic for network errors
- Graceful degradation for offline scenarios
- Error logging to console in development

### Validation Strategy

**Input Validation:**
- Email format: RFC 5322 compliant regex
- Password: Minimum 8 characters, no maximum
- File size: Maximum 100MB (104,857,600 bytes)
- File types: No restrictions (mime_type stored as-is)
- Plan IDs: Must exist in plans table
- Download limits: Positive integers or NULL

**Sanitization:**
- SQL injection: Use parameterized queries
- XSS: React automatically escapes output
- Path traversal: Validate file paths don't escape uploads directory
- File names: Sanitize to prevent directory traversal

## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests:**
- Specific examples demonstrating correct behavior
- Edge cases (file size limits, boundary conditions)
- Error conditions and error messages
- Integration points between components
- Mock external dependencies (database, file system)

**Property-Based Tests:**
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Minimum 100 iterations per property test
- Each test references its design document property

### Property-Based Testing Configuration

**Library Selection:**
- **JavaScript/Node.js**: fast-check
- **TypeScript/Frontend**: fast-check with TypeScript types

**Test Configuration:**
```javascript
import fc from 'fast-check';

// Example property test
describe('Property Tests', () => {
  it('Property 1: Valid credentials generate valid 24-hour tokens', () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.string({ minLength: 8 }),
        async (email, password) => {
          // Feature: gestor-files, Property 1: Valid credentials generate valid 24-hour tokens
          const user = await createUser(email, password);
          const token = await authService.login(email, password);
          
          const decoded = jwt.verify(token);
          const expiresIn = decoded.exp - decoded.iat;
          
          expect(expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Tagging Convention:**
Each property test must include a comment tag:
```javascript
// Feature: gestor-files, Property {number}: {property_text}
```

### Test Organization

```
server/
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── authService.test.js
│   │   │   ├── fileManager.test.js
│   │   │   └── uploadService.test.js
│   │   ├── controllers/
│   │   └── utils/
│   ├── property/
│   │   ├── auth.property.test.js
│   │   ├── files.property.test.js
│   │   ├── downloads.property.test.js
│   │   └── plans.property.test.js
│   └── integration/
│       ├── api.test.js
│       └── database.test.js

client/
├── tests/
│   ├── unit/
│   │   ├── components/
│   │   └── services/
│   ├── property/
│   │   └── api.property.test.js
│   └── e2e/
│       └── flows.test.js
```

### Test Coverage Goals

- Unit test coverage: Minimum 80% line coverage
- Property tests: All 41 properties implemented
- Integration tests: All API endpoints
- E2E tests: Critical user flows (login, upload, download)

### Testing Tools

**Backend:**
- Jest: Test runner and assertions
- fast-check: Property-based testing
- supertest: HTTP endpoint testing
- sqlite3 :memory:: In-memory database for tests

**Frontend:**
- Vitest: Test runner (Vite-native)
- React Testing Library: Component testing
- fast-check: Property-based testing
- MSW (Mock Service Worker): API mocking

### Continuous Integration

- Run all tests on every commit
- Fail build if any test fails
- Generate coverage reports
- Run property tests with increased iterations (1000) in CI

### Test Data Generation

**Generators for Property Tests:**
```javascript
// Custom generators for domain objects
const userGenerator = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: fc.emailAddress(),
  password: fc.string({ minLength: 8, maxLength: 50 }),
  role: fc.constantFrom('USER', 'ADMIN'),
  plan_id: fc.integer({ min: 1, max: 3 })
});

const fileGenerator = fc.record({
  filename: fc.string({ minLength: 1, maxLength: 255 }),
  size: fc.integer({ min: 1, max: 104857600 }), // Up to 100MB
  mime_type: fc.constantFrom('image/jpeg', 'application/pdf', 'text/plain'),
  allowed_plan_ids: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1 }),
  max_downloads_per_user: fc.option(fc.integer({ min: 1, max: 1000 }))
});

const planFeaturesGenerator = fc.record({
  maxDownloadsPerMonth: fc.integer({ min: 0, max: 1000 }),
  maxFileSize: fc.integer({ min: 1, max: 100 }),
  prioritySupport: fc.boolean(),
  customFeatures: fc.array(fc.string())
});
```

## Security Considerations

### Authentication Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with 24-hour expiration
- Tokens stored in localStorage (consider httpOnly cookies for production)
- No password reset functionality in v1 (future enhancement)

### Authorization Security

- Role-based access control (RBAC)
- Middleware validates role on every protected endpoint
- Plan-based file access control
- Download limits enforced server-side

### File Security

- Files stored outside web root
- No direct file access via URL
- All downloads go through validation endpoint
- Filename sanitization to prevent path traversal
- File size limits enforced (100MB)

### API Security

- CORS configured for specific origins
- Rate limiting on authentication endpoints
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- XSS prevention via React's automatic escaping

### Security Headers

```javascript
// Helmet.js configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

### Data Privacy

- User passwords never logged
- IP addresses logged for audit purposes
- No PII in error messages
- Database backups encrypted at rest

## Performance Considerations

### File Streaming

- Use Node.js streams for file downloads
- Avoid loading entire file into memory
- Chunk size: 64KB for optimal performance

### Database Optimization

- Indexes on frequently queried columns
- Connection pooling for SQLite
- Prepared statements for repeated queries
- Pagination for large result sets

### Caching Strategy

- No caching in v1 (future enhancement)
- Consider Redis for session storage in production
- Consider CDN for static assets

### Frontend Optimization

- Code splitting by route
- Lazy loading of components
- Image optimization
- Service worker for asset caching (PWA)

## Deployment Considerations

### Environment Configuration

```javascript
// server/src/config/index.js
module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiration: '24h',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: 104857600, // 100MB
  bcryptRounds: 10,
  database: {
    filename: process.env.DB_PATH || './database.sqlite'
  }
};
```

### Database Migrations

- Run migrations on application startup
- Track executed migrations in database
- Rollback strategy for failed migrations

### File Storage

- Local filesystem for v1
- Consider S3/cloud storage for production
- Backup strategy for uploaded files

### Monitoring

- Log all errors with timestamps
- Track download statistics
- Monitor disk space usage
- Alert on authentication failures

## Future Enhancements

### Phase 2 Features

- Password reset via email
- Email verification on registration
- Two-factor authentication
- File versioning
- Bulk file operations
- Advanced search and filtering
- File preview functionality

### Scalability Improvements

- Move to cloud storage (S3, GCS)
- Implement caching layer (Redis)
- Database migration to PostgreSQL
- Horizontal scaling with load balancer
- CDN for file delivery

### Analytics

- Download analytics dashboard
- User behavior tracking
- Popular files trending
- Usage reports by plan

## Appendix

### API Endpoints Summary

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

**Files (Admin):**
- `POST /api/files/upload` - Upload file
- `PUT /api/files/:id/permissions` - Update file permissions
- `DELETE /api/files/:id` - Delete file
- `GET /api/files` - List all files (admin view)

**Files (User):**
- `GET /api/files` - List accessible files

**Downloads:**
- `GET /api/downloads/:fileId` - Download file
- `GET /api/downloads/history` - Get user's download history

**Users:**
- `GET /api/users` - List all users (admin)
- `PUT /api/users/:id/plan` - Update user plan (admin)

**Plans:**
- `GET /api/plans` - List all plans
- `POST /api/plans` - Create plan (admin)
- `PUT /api/plans/:id` - Update plan (admin)

**Dashboard:**
- `GET /api/dashboard/admin` - Admin statistics
- `GET /api/dashboard/user` - User dashboard data

### Database Seed Data

**Default Plans:**
```sql
INSERT INTO plans (name, price, features) VALUES
  ('Free', 0.00, '{"maxDownloadsPerMonth": 10, "maxFileSize": 10, "prioritySupport": false}'),
  ('Basic', 9.99, '{"maxDownloadsPerMonth": 100, "maxFileSize": 50, "prioritySupport": false}'),
  ('Premium', 29.99, '{"maxDownloadsPerMonth": -1, "maxFileSize": 100, "prioritySupport": true}');
```

**Default Admin User:**
```sql
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (name, email, password_hash, role, plan_id) VALUES
  ('Admin', 'admin@example.com', '$2b$10$...', 'ADMIN', 3);
```

### Technology Versions

- Node.js: 18.x or higher
- React: 18.x
- TypeScript: 5.x
- Express: 4.x
- SQLite: 3.x
- Vite: 5.x
- TailwindCSS: 3.x
