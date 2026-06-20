import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  },
);

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  loginMfa: (tempToken: string, totp: string) => api.post('/auth/login/mfa', { tempToken, totp }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) => api.patch('/auth/password', { oldPassword, newPassword }),
  setupMfa: () => api.post('/auth/mfa/setup'),
  enableMfa: (totp: string) => api.post('/auth/mfa/enable', { totp }),
  disableMfa: (password: string) => api.post('/auth/mfa/disable', { password }),
};

// Users
export const usersApi = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) => api.patch(`/users/${id}/reset-password`, { newPassword }),
};

// Audit
export const auditApi = {
  list: (params?: any) => api.get('/audit', { params }),
};

// Company
export const companyApi = {
  get: () => api.get('/company'),
  update: (data: any) => api.patch('/company', data),
  dashboard: () => api.get('/company/dashboard'),
};

// Branches
export const branchesApi = {
  list: () => api.get('/branches'),
  create: (data: any) => api.post('/branches', data),
  update: (id: string, data: any) => api.patch(`/branches/${id}`, data),
  remove: (id: string) => api.delete(`/branches/${id}`),
};

// Departments
export const departmentsApi = {
  list: () => api.get('/departments'),
  tree: () => api.get('/departments/tree'),
  create: (data: any) => api.post('/departments', data),
  update: (id: string, data: any) => api.patch(`/departments/${id}`, data),
  remove: (id: string) => api.delete(`/departments/${id}`),
};

// Employees
export const employeesApi = {
  list: (params?: any) => api.get('/employees', { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  create: (data: any) => api.post('/employees', data),
  update: (id: string, data: any) => api.patch(`/employees/${id}`, data),
  terminate: (id: string, dateOfLeaving: string) => api.patch(`/employees/${id}/terminate`, { dateOfLeaving }),
  salaryBreakdown: (id: string) => api.get(`/employees/${id}/salary-breakdown`),
  listDocuments: (id: string) => api.get(`/employees/${id}/documents`),
  addDocument: (id: string, data: any) => api.post(`/employees/${id}/documents`, data),
  removeDocument: (id: string, docId: string) => api.delete(`/employees/${id}/documents/${docId}`),
  bulkImport: (records: any[]) => api.post('/employees/bulk-import', { records }),
};

// Salary
export const salaryApi = {
  components: () => api.get('/salary/components'),
  createComponent: (data: any) => api.post('/salary/components', data),
  updateComponent: (id: string, data: any) => api.patch(`/salary/components/${id}`, data),
  deleteComponent: (id: string) => api.delete(`/salary/components/${id}`),
  seedDefaults: () => api.post('/salary/components/seed'),
  structures: () => api.get('/salary/structures'),
  createStructure: (data: any) => api.post('/salary/structures', data),
  updateStructure: (id: string, data: any) => api.patch(`/salary/structures/${id}`, data),
  deleteStructure: (id: string) => api.delete(`/salary/structures/${id}`),
  simulate: (data: { structureId: string; ctc: number }) => api.post('/salary/simulate', data),
};

// Payrun
export const payrunApi = {
  list: (params?: any) => api.get('/payrun', { params }),
  get: (id: string) => api.get(`/payrun/${id}`),
  create: (data: any) => api.post('/payrun', data),
  preview: (id: string) => api.get(`/payrun/${id}/preview`),
  process: (id: string) => api.post(`/payrun/${id}/process`),
  review: (id: string, notes?: string) => api.patch(`/payrun/${id}/review`, { notes }),
  approve: (id: string) => api.patch(`/payrun/${id}/approve`),
  markPaid: (id: string) => api.patch(`/payrun/${id}/mark-paid`),
  cancel: (id: string, reason?: string) => api.patch(`/payrun/${id}/cancel`, { reason }),
  overridePayslip: (id: string, payslipId: string, data: any) =>
    api.patch(`/payrun/${id}/payslips/${payslipId}/override`, data),
  createFnF: (data: any) => api.post('/payrun/fnf', data),
};

// Payslips
export const payslipsApi = {
  mine: (year?: number) => api.get('/payslips/my', { params: year ? { year } : {} }),
  byEmployee: (id: string, year?: number) => api.get(`/payslips/employee/${id}`, { params: year ? { year } : {} }),
  get: (id: string) => api.get(`/payslips/${id}`),
};

// Leave
export const leaveApi = {
  policies:          ()                                          => api.get('/leave/policies'),
  createPolicy:      (data: any)                                => api.post('/leave/policies', data),
  updatePolicy:      (id: string, data: any)                   => api.patch(`/leave/policies/${id}`, data),
  deletePolicy:      (id: string)                              => api.delete(`/leave/policies/${id}`),
  seedPolicies:      ()                                         => api.post('/leave/policies/seed-defaults'),
  allBalances:       (fy?: string)                             => api.get('/leave/balances', { params: { fy } }),
  balances:          (employeeId: string, fy?: string)         => api.get(`/leave/balances/${employeeId}`, { params: { fy } }),
  initBalances:      (fy?: string)                             => api.post('/leave/balances/initialize', {}, { params: { fy } }),
  carryForward:      (fromFY: string, toFY: string)            => api.post('/leave/balances/carry-forward', { fromFY, toFY }),
  encash:            (employeeId: string, data: any)           => api.post(`/leave/balances/${employeeId}/encash`, data),
  apply:             (data: any)                               => api.post('/leave/apply', data),
  applications:      (params?: any)                            => api.get('/leave/applications', { params }),
  review:            (id: string, data: any)                   => api.patch(`/leave/applications/${id}/review`, data),
  cancel:            (id: string, reason?: string)             => api.patch(`/leave/applications/${id}/cancel`, { reason }),
  calendar:          (month: number, year: number)             => api.get('/leave/calendar', { params: { month, year } }),
  holidays:          (year: number)                            => api.get('/leave/holidays', { params: { year } }),
  createHoliday:     (data: any)                               => api.post('/leave/holidays', data),
  deleteHoliday:     (id: string)                              => api.delete(`/leave/holidays/${id}`),
  seedHolidays:      (year: number, state?: string)            => api.post('/leave/holidays/seed', {}, { params: { year, state } }),
};

// Attendance
export const attendanceApi = {
  // Shifts
  shifts:             ()                                         => api.get('/attendance/shifts'),
  createShift:        (data: any)                               => api.post('/attendance/shifts', data),
  updateShift:        (id: string, data: any)                  => api.patch(`/attendance/shifts/${id}`, data),
  deleteShift:        (id: string)                             => api.delete(`/attendance/shifts/${id}`),
  // Roster
  roster:             (month: number, year: number)            => api.get('/attendance/roster', { params: { month, year } }),
  assignShift:        (data: any)                               => api.post('/attendance/roster/assign', data),
  deleteRosterEntry:  (id: string)                             => api.delete(`/attendance/roster/${id}`),
  // Mark / Import
  mark:               (data: any)                               => api.post('/attendance/mark', data),
  bulkImport:         (records: any[])                         => api.post('/attendance/bulk-import', { records }),
  biometricImport:    (csv: string)                            => api.post('/attendance/biometric-import', { csv }),
  autoSeed:           (month: number, year: number)            => api.post('/attendance/auto-seed', {}, { params: { month, year } }),
  // Query
  get:                (employeeId: string, month: number, year: number) => api.get(`/attendance/${employeeId}`, { params: { month, year } }),
  monthlyReport:      (month: number, year: number)            => api.get('/attendance/report/monthly', { params: { month, year } }),
  // Regularization
  applyRegularization: (data: any)                             => api.post('/attendance/regularization', data),
  regularizations:     (params?: any)                          => api.get('/attendance/regularizations/list', { params }),
  reviewRegularization:(id: string, data: any)                => api.patch(`/attendance/regularizations/${id}/review`, data),
};

// Reports
export const reportsApi = {
  salaryRegister: (month: number, year: number) => api.get('/reports/salary-register', { params: { month, year } }),
  cost:           (params: any)                  => api.get('/reports/cost', { params }),
  departmentCost: (month: number, year: number) => api.get('/reports/department-cost', { params: { month, year } }),
  headcount:      ()                             => api.get('/reports/headcount'),
  pfChallan:      (month: number, year: number) => api.get('/reports/challan/pf',  { params: { month, year } }),
  esiChallan:     (month: number, year: number) => api.get('/reports/challan/esi', { params: { month, year } }),
  ptChallan:      (month: number, year: number) => api.get('/reports/challan/pt',  { params: { month, year } }),
  yearEndTax:     (fy: string)                   => api.get('/reports/year-end-tax', { params: { fy } }),
  fields:         ()                             => api.get('/reports/fields'),
  custom:         (body: any)                    => api.post('/reports/custom', body),
  templates:      ()                             => api.get('/reports/templates'),
  saveTemplate:   (body: any)                    => api.post('/reports/templates', body),
  deleteTemplate: (id: string)                   => api.delete(`/reports/templates/${id}`),
  pf:             (month: number, year: number) => api.get('/reports/pf', { params: { month, year } }),
};

// Bank Payments
export const bankApi = {
  generateAdvice:   (data: any)                          => api.post('/bank/advice', data),
  listAdvices:      (params?: any)                       => api.get('/bank/advice', { params }),
  getAdvice:        (id: string)                         => api.get(`/bank/advice/${id}`),
  downloadAdvice:   (id: string)                         => api.get(`/bank/advice/${id}/download`, { responseType: 'blob' }),
  markUploaded:     (id: string)                         => api.patch(`/bank/advice/${id}/upload`),
  bankSummary:      (id: string)                         => api.get(`/bank/advice/${id}/bank-summary`),
  updateTx:         (id: string, txId: string, data: any) => api.patch(`/bank/advice/${id}/transactions/${txId}`, data),
  bulkUTR:          (id: string, csv: string)            => api.post(`/bank/advice/${id}/bulk-utr`, { csv }),
  payrunSummary:    (payrunId: string)                   => api.get(`/bank/payrun/${payrunId}/summary`),
};

// TDS
export const tdsApi = {
  listDeclarations: (fy?: string)                     => api.get('/tds/declarations', { params: { fy } }),
  getDeclaration:   (eid: string, fy?: string)        => api.get(`/tds/declarations/${eid}`, { params: { fy } }),
  saveDeclaration:  (eid: string, data: any)          => api.post(`/tds/declarations/${eid}`, data),
  approveDeclaration: (id: string)                    => api.patch(`/tds/declarations/${id}/approve`),
  computeTDS:       (eid: string, fy?: string)        => api.get(`/tds/compute/${eid}`, { params: { fy } }),
  list24Q:          (fy?: string)                     => api.get('/tds/24q', { params: { fy } }),
  compute24Q:       (quarter: number, fy?: string)    => api.get(`/tds/24q/${quarter}`, { params: { fy } }),
  mark24QFiled:     (quarter: number, fy?: string)    => api.patch(`/tds/24q/${quarter}/file`, {}, { params: { fy } }),
  listForm16:       (fy?: string)                     => api.get('/tds/form16', { params: { fy } }),
  generateForm16:   (eid: string, fy?: string)        => api.post(`/tds/form16/${eid}`, {}, { params: { fy } }),
  getForm16:        (id: string)                      => api.get(`/tds/form16/${id}`),
  markEsigned:      (id: string)                      => api.patch(`/tds/form16/${id}/esign`),
};

// AI Assistant
export const aiApi = {
  status:           ()                              => api.get('/ai/status'),
  query:            (question: string)              => api.post('/ai/query', { question }),
  anomalies:        (month: number, year: number, threshold?: number) => api.get('/ai/anomalies', { params: { month, year, ...(threshold ? { threshold } : {}) } }),
  explainAnomalies: (month: number, year: number)   => api.post('/ai/anomalies/explain', { month, year }),
  taxOptimization:  (employeeId?: string)           => api.get(employeeId ? `/ai/tax-optimization/${employeeId}` : '/ai/tax-optimization'),
  chat:             (messages: any[])               => api.post('/ai/chat', { messages }),
};

// Integrations
export const integrationsApi = {
  catalog:     ()                                       => api.get('/integrations/catalog'),
  list:        ()                                        => api.get('/integrations'),
  connect:     (provider: string, data: any)            => api.post(`/integrations/${provider}/connect`, data),
  disconnect:  (provider: string)                        => api.patch(`/integrations/${provider}/disconnect`),
  test:        (provider: string)                        => api.post(`/integrations/${provider}/test`),
  sync:        (provider: string, operation: string)     => api.post(`/integrations/${provider}/sync`, { operation }),
  logs:        (provider?: string)                       => api.get('/integrations/logs', { params: provider ? { provider } : {} }),
};

// Contractor Payroll
export const contractorApi = {
  list:           (status?: string)                  => api.get('/contractor/list', { params: status ? { status } : {} }),
  get:            (id: string)                        => api.get(`/contractor/profile/${id}`),
  create:         (data: any)                         => api.post('/contractor/profile', data),
  update:         (id: string, data: any)            => api.patch(`/contractor/profile/${id}`, data),
  deactivate:     (id: string)                        => api.delete(`/contractor/profile/${id}`),
  tdsPreview:     (data: any)                         => api.post('/contractor/tds-preview', data),
  payruns:        ()                                  => api.get('/contractor/payruns'),
  payrun:         (id: string)                        => api.get(`/contractor/payruns/${id}`),
  createPayrun:   (data: any)                         => api.post('/contractor/payruns', data),
  approvePayrun:  (id: string)                        => api.patch(`/contractor/payruns/${id}/approve`),
  markPayrunPaid: (id: string, payDate?: string)      => api.patch(`/contractor/payruns/${id}/mark-paid`, { payDate }),
  cancelPayrun:   (id: string)                        => api.patch(`/contractor/payruns/${id}/cancel`),
  form16aSummary: (fy: string, quarter: number)       => api.get('/contractor/form16a', { params: { fy, quarter } }),
  generateForm16a:(contractorId: string, fy: string, quarter: number) => api.post(`/contractor/form16a/${contractorId}`, {}, { params: { fy, quarter } }),
  esignForm16a:   (id: string)                        => api.patch(`/contractor/form16a/${id}/esign`),
  tdsRegister:    (fy: string, quarter?: number)      => api.get('/contractor/tds-register', { params: { fy, ...(quarter ? { quarter } : {}) } }),
};

// ESS (Employee Self-Service)
export const essApi = {
  dashboard:       ()                                      => api.get('/ess/dashboard'),
  // Payslips
  payslips:        (year?: number)                        => api.get('/ess/payslips', { params: year ? { year } : {} }),
  payslip:         (id: string)                           => api.get(`/ess/payslips/${id}`),
  payslipPdfUrl:   (id: string)                           => `${api.defaults.baseURL}/ess/payslips/${id}/pdf`,
  sendWhatsApp:    (id: string)                           => api.post(`/ess/payslips/${id}/whatsapp`),
  whatsappLogs:    (employeeId?: string)                  => api.get('/ess/whatsapp-logs', { params: employeeId ? { employeeId } : {} }),
  // IT Declaration
  declaration:     ()                                     => api.get('/ess/tax/declaration'),
  saveDeclaration: (data: any)                            => api.post('/ess/tax/declaration', data),
  taxWorksheet:    ()                                     => api.get('/ess/tax/worksheet'),
  // Reimbursements
  myClaims:        ()                                     => api.get('/ess/reimbursements'),
  submitClaim:     (data: any)                            => api.post('/ess/reimbursements', data),
  cancelClaim:     (id: string)                           => api.patch(`/ess/reimbursements/${id}/cancel`),
  allClaims:       (status?: string)                      => api.get('/ess/reimbursements/all', { params: status ? { status } : {} }),
  reviewClaim:     (id: string, data: any)               => api.patch(`/ess/reimbursements/${id}/review`, data),
  markClaimPaid:   (id: string)                           => api.patch(`/ess/reimbursements/${id}/mark-paid`),
};

// Compliance
export const complianceApi = {
  pf:       (month: number, year: number) => api.get('/compliance/pf',       { params: { month, year } }),
  esi:      (month: number, year: number) => api.get('/compliance/esi',      { params: { month, year } }),
  pt:       (month: number, year: number) => api.get('/compliance/pt',       { params: { month, year } }),
  lwf:      (month: number, year: number) => api.get('/compliance/lwf',      { params: { month, year } }),
  gratuity: ()                            => api.get('/compliance/gratuity'),
  bonus:    (fy: string)                  => api.get('/compliance/bonus',     { params: { fy } }),
};
