// Catalog of supported third-party integrations and their config schema.
// `fields` drive the connect form in the UI; `secretFields` are masked on read.

export interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string;
  options?: string[];
  required?: boolean;
  help?: string;
}

export interface ProviderDef {
  provider: string;
  category: 'HRMS' | 'ACCOUNTING' | 'BIOMETRIC' | 'TAX' | 'ESIGN';
  displayName: string;
  description: string;
  icon: string;
  // operations this provider supports
  operations: { key: string; label: string; direction: 'INBOUND' | 'OUTBOUND' }[];
  fields: ProviderField[];
  secretFields: string[];
}

export const PROVIDER_CATALOG: ProviderDef[] = [
  // ── HRMS / ATS ──────────────────────────────────────────────
  {
    provider: 'ZOHO_PEOPLE',
    category: 'HRMS',
    displayName: 'Zoho People',
    description: 'Sync employees, departments and leave from Zoho People HRMS.',
    icon: '🟠',
    operations: [
      { key: 'EMPLOYEE_PULL', label: 'Import Employees', direction: 'INBOUND' },
      { key: 'LEAVE_PULL', label: 'Import Leave', direction: 'INBOUND' },
    ],
    fields: [
      { key: 'dataCenter', label: 'Data Center', type: 'select', options: ['.com', '.in', '.eu', '.com.au'], required: true, help: 'Your Zoho domain region' },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
    ],
    secretFields: ['clientSecret', 'refreshToken'],
  },
  {
    provider: 'DARWINBOX',
    category: 'HRMS',
    displayName: 'Darwinbox',
    description: 'Pull employee master and attendance from Darwinbox.',
    icon: '🔵',
    operations: [
      { key: 'EMPLOYEE_PULL', label: 'Import Employees', direction: 'INBOUND' },
      { key: 'ATTENDANCE_PULL', label: 'Import Attendance', direction: 'INBOUND' },
    ],
    fields: [
      { key: 'baseUrl', label: 'API Base URL', type: 'url', placeholder: 'https://<tenant>.darwinbox.in', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'datasetKey', label: 'Dataset Key', type: 'password', required: true },
      { key: 'username', label: 'API Username', type: 'text', required: true },
    ],
    secretFields: ['apiKey', 'datasetKey'],
  },
  // ── Accounting ──────────────────────────────────────────────
  {
    provider: 'TALLY',
    category: 'ACCOUNTING',
    displayName: 'Tally Prime',
    description: 'Push payroll salary journal vouchers to Tally via XML/HTTP gateway.',
    icon: '📒',
    operations: [{ key: 'JOURNAL_PUSH', label: 'Export Salary Journal', direction: 'OUTBOUND' }],
    fields: [
      { key: 'gatewayUrl', label: 'Tally Gateway URL', type: 'url', placeholder: 'http://localhost:9000', required: true, help: 'Tally running with HTTP server enabled' },
      { key: 'companyName', label: 'Tally Company Name', type: 'text', required: true },
      { key: 'salaryLedger', label: 'Salary Expense Ledger', type: 'text', placeholder: 'Salaries', required: true },
      { key: 'payableLedger', label: 'Salary Payable Ledger', type: 'text', placeholder: 'Salary Payable' },
    ],
    secretFields: [],
  },
  {
    provider: 'QUICKBOOKS',
    category: 'ACCOUNTING',
    displayName: 'QuickBooks Online',
    description: 'Post payroll journal entries to QuickBooks Online.',
    icon: '💚',
    operations: [{ key: 'JOURNAL_PUSH', label: 'Export Journal Entry', direction: 'OUTBOUND' }],
    fields: [
      { key: 'realmId', label: 'Company (Realm) ID', type: 'text', required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
      { key: 'environment', label: 'Environment', type: 'select', options: ['sandbox', 'production'], required: true },
    ],
    secretFields: ['clientSecret', 'refreshToken'],
  },
  {
    provider: 'ZOHO_BOOKS',
    category: 'ACCOUNTING',
    displayName: 'Zoho Books',
    description: 'Create payroll journal entries in Zoho Books.',
    icon: '🟠',
    operations: [{ key: 'JOURNAL_PUSH', label: 'Export Journal Entry', direction: 'OUTBOUND' }],
    fields: [
      { key: 'organizationId', label: 'Organization ID', type: 'text', required: true },
      { key: 'dataCenter', label: 'Data Center', type: 'select', options: ['.com', '.in', '.eu'], required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
    ],
    secretFields: ['clientSecret', 'refreshToken'],
  },
  // ── Biometric devices ───────────────────────────────────────
  {
    provider: 'ZKTECO',
    category: 'BIOMETRIC',
    displayName: 'ZKTeco Devices',
    description: 'Pull punch logs from ZKTeco biometric terminals (push SDK / ADMS).',
    icon: '🟢',
    operations: [{ key: 'ATTENDANCE_PULL', label: 'Import Punch Logs', direction: 'INBOUND' }],
    fields: [
      { key: 'deviceIp', label: 'Device IP', type: 'text', placeholder: '192.168.1.201', required: true },
      { key: 'port', label: 'Port', type: 'text', placeholder: '4370', required: true },
      { key: 'serialNumber', label: 'Device Serial', type: 'text' },
      { key: 'commKey', label: 'Comm Key', type: 'password' },
    ],
    secretFields: ['commKey'],
  },
  {
    provider: 'ESSL',
    category: 'BIOMETRIC',
    displayName: 'eSSL Devices',
    description: 'Import attendance from eSSL Etimetrack / biometric terminals.',
    icon: '🟢',
    operations: [{ key: 'ATTENDANCE_PULL', label: 'Import Punch Logs', direction: 'INBOUND' }],
    fields: [
      { key: 'serverUrl', label: 'eTimeTrack Server URL', type: 'url', placeholder: 'http://localhost:8080', required: true },
      { key: 'deviceIp', label: 'Device IP', type: 'text', placeholder: '192.168.1.100', required: true },
      { key: 'port', label: 'Port', type: 'text', placeholder: '4370', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password' },
    ],
    secretFields: ['apiKey'],
  },
  // ── TDS / TRACES ────────────────────────────────────────────
  {
    provider: 'TRACES',
    category: 'TAX',
    displayName: 'TRACES (TDS)',
    description: 'Fetch Form 16 / 16A and challan status from the TRACES portal.',
    icon: '🧾',
    operations: [
      { key: 'FORM16_FETCH', label: 'Fetch Form 16/16A', direction: 'INBOUND' },
      { key: 'CHALLAN_STATUS', label: 'Verify Challan Status', direction: 'INBOUND' },
    ],
    fields: [
      { key: 'tan', label: 'TAN', type: 'text', required: true, help: 'Deductor TAN registered on TRACES' },
      { key: 'userId', label: 'TRACES User ID', type: 'text', required: true },
      { key: 'password', label: 'TRACES Password', type: 'password', required: true },
    ],
    secretFields: ['password'],
  },
  // ── DigiLocker / eSign ──────────────────────────────────────
  {
    provider: 'DIGILOCKER',
    category: 'ESIGN',
    displayName: 'DigiLocker',
    description: 'Verify employee KYC documents (Aadhaar, PAN) via DigiLocker.',
    icon: '📁',
    operations: [{ key: 'KYC_VERIFY', label: 'Verify KYC Documents', direction: 'INBOUND' }],
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'redirectUri', label: 'Redirect URI', type: 'url', required: true },
    ],
    secretFields: ['clientSecret'],
  },
  {
    provider: 'ESIGN',
    category: 'ESIGN',
    displayName: 'Aadhaar eSign',
    description: 'Digitally sign Form 16, offer letters and documents via an eSign / ASP provider.',
    icon: '✍️',
    operations: [{ key: 'ESIGN_REQUEST', label: 'Send for eSign', direction: 'OUTBOUND' }],
    fields: [
      { key: 'provider', label: 'eSign Provider', type: 'select', options: ['Digio', 'Leegality', 'NSDL', 'eMudhra'], required: true },
      { key: 'apiBaseUrl', label: 'API Base URL', type: 'url', required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
    secretFields: ['clientSecret'],
  },
];

export const CATALOG_MAP: Record<string, ProviderDef> = Object.fromEntries(
  PROVIDER_CATALOG.map(p => [p.provider, p]),
);
