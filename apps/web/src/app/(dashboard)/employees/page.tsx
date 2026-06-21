'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, branchesApi, departmentsApi, salaryApi } from '@/lib/api';
import Link from 'next/link';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
];

const DOCUMENT_TYPES = ['AADHAAR','PAN','PASSPORT','BANK_PROOF','OFFER_LETTER','EDUCATION','OTHER'];

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', search],
    queryFn: () => employeesApi.list({ search: search || undefined }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">{(employees as any[]).length} employees</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="btn-secondary">Bulk Import</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Employee</button>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <input
            className="input max-w-sm"
            placeholder="Search by name, email, code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading employees...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Employee</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Designation</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Branch</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">CTC / Year</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(employees as any[]).map((emp: any) => (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
                          {emp.firstName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</div>
                          <div className="text-gray-500 text-xs">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.employeeCode}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {emp.designation}
                      {emp.grade && <span className="ml-1 text-xs text-gray-400">({emp.grade})</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.department?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.branch?.name || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{emp.ctc.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={emp.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}>{emp.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/employees/${emp.id}`} className="text-brand-600 hover:underline text-xs font-medium">View</Link>
                    </td>
                  </tr>
                ))}
                {(employees as any[]).length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No employees found. Add your first employee to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddEmployeeModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['employees'] }); }}
        />
      )}

      {showImport && (
        <BulkImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); qc.invalidateQueries({ queryKey: ['employees'] }); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function AddEmployeeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [newEmpId, setNewEmpId] = useState<string | null>(null);

  // Pending document uploads (before employee is created)
  const [pendingDocs, setPendingDocs] = useState<Array<{ type: string; number: string; fileName: string; fileUrl: string }>>([]);
  const [docForm, setDocForm] = useState({ type: 'AADHAAR', number: '', fileName: '', fileUrl: '' });

  const [form, setForm] = useState<any>({
    firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', gender: 'MALE',
    pan: '', aadhaar: '', uan: '', esiNumber: '',
    designation: '', grade: '', departmentId: '', branchId: '', managerId: '',
    employmentType: 'FULL_TIME', dateOfJoining: '', ctc: '', salaryStructureId: '',
    addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
    bankName: '', accountNumber: '', ifscCode: '', accountType: 'SAVINGS',
  });

  const { data: structures = [] } = useQuery({ queryKey: ['structures'], queryFn: () => salaryApi.structures() });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() });

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: any) => employeesApi.create(data),
    onSuccess: async (emp: any) => {
      setNewEmpId(emp.id);
      // Upload any docs added in step 4
      for (const doc of pendingDocs) {
        await employeesApi.addDocument(emp.id, doc);
      }
      qc.invalidateQueries({ queryKey: ['employees'] });
      onSuccess();
    },
    onError: (e: any) => setError(e.message || JSON.stringify(e.errors) || 'Failed to create employee'),
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f: any) => ({ ...f, [key]: e.target.value }));

  const addPendingDoc = () => {
    if (!docForm.fileName || !docForm.fileUrl) { setError('File name and URL are required'); return; }
    setError('');
    setPendingDocs(d => [...d, { ...docForm }]);
    setDocForm({ type: 'AADHAAR', number: '', fileName: '', fileUrl: '' });
  };

  const handleSubmit = () => {
    setError('');
    const payload: any = { ...form, ctc: Number(form.ctc) };
    // strip empty optional strings
    ['aadhaar','uan','esiNumber','grade','branchId','managerId','addressLine2'].forEach(k => {
      if (!payload[k]) delete payload[k];
    });
    mutation.mutate(payload);
  };

  const STEPS = ['Personal & KYC', 'Job & Salary', 'Address & Bank', 'Documents'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Add Employee</h2>
            <div className="flex gap-2 mt-2">
              {STEPS.map((s, i) => (
                <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${i + 1 === step ? 'bg-brand-600 text-white' : i + 1 < step ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {i + 1}. {s}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex-shrink-0">{error}</div>}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">

          {/* Step 1: Personal & KYC */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name *"><input className="input" value={form.firstName} onChange={set('firstName')} /></Field>
                <Field label="Last Name *"><input className="input" value={form.lastName} onChange={set('lastName')} /></Field>
                <Field label="Email *"><input type="email" className="input" value={form.email} onChange={set('email')} /></Field>
                <Field label="Phone *"><input className="input" value={form.phone} onChange={set('phone')} placeholder="9876543210" /></Field>
                <Field label="Date of Birth *"><input type="date" className="input" value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
                <Field label="Gender *">
                  <select className="input" value={form.gender} onChange={set('gender')}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Department *">
                  <select className="input" value={form.departmentId} onChange={set('departmentId')}>
                    <option value="">Select department</option>
                    {(departments as any[]).map((d: any) => (
                      <option key={d.id} value={d.id}>{d.type === 'TEAM' ? '  └ ' : ''}{d.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">KYC / Statutory IDs</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="PAN *"><input className="input uppercase" value={form.pan} onChange={set('pan')} placeholder="ABCDE1234F" maxLength={10} /></Field>
                  <Field label="Aadhaar (optional)"><input className="input" value={form.aadhaar} onChange={set('aadhaar')} placeholder="12-digit number" maxLength={12} /></Field>
                  <Field label="UAN (optional)"><input className="input" value={form.uan} onChange={set('uan')} placeholder="Universal Account No." /></Field>
                  <Field label="ESI Number (optional)"><input className="input" value={form.esiNumber} onChange={set('esiNumber')} /></Field>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Job & Salary */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Designation *"><input className="input" value={form.designation} onChange={set('designation')} /></Field>
                <Field label="Grade (optional)"><input className="input" value={form.grade} onChange={set('grade')} placeholder="e.g. L1, M2, Senior" /></Field>
                <Field label="Employment Type *">
                  <select className="input" value={form.employmentType} onChange={set('employmentType')}>
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACTOR">Contractor</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </Field>
                <Field label="Date of Joining *"><input type="date" className="input" value={form.dateOfJoining} onChange={set('dateOfJoining')} /></Field>
                <Field label="Annual CTC (₹) *"><input type="number" className="input" value={form.ctc} onChange={set('ctc')} placeholder="600000" /></Field>
                <Field label="Salary Structure *">
                  <select className="input" value={form.salaryStructureId} onChange={set('salaryStructureId')}>
                    <option value="">Select structure</option>
                    {(structures as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Branch (optional)">
                  <select className="input" value={form.branchId} onChange={set('branchId')}>
                    <option value="">Select branch</option>
                    {(branches as any[]).map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}{b.isHeadOffice ? ' (HO)' : ''}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* Step 3: Address & Bank */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Residential Address</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Address Line 1 *"><input className="input" value={form.addressLine1} onChange={set('addressLine1')} /></Field>
                </div>
                <div className="col-span-2">
                  <Field label="Address Line 2"><input className="input" value={form.addressLine2} onChange={set('addressLine2')} /></Field>
                </div>
                <Field label="City *"><input className="input" value={form.city} onChange={set('city')} /></Field>
                <Field label="State *">
                  <select className="input" value={form.state} onChange={set('state')}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Pincode *"><input className="input" value={form.pincode} onChange={set('pincode')} placeholder="6-digit PIN" maxLength={6} /></Field>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bank Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bank Name *"><input className="input" value={form.bankName} onChange={set('bankName')} /></Field>
                  <Field label="Account Number *"><input className="input" value={form.accountNumber} onChange={set('accountNumber')} /></Field>
                  <Field label="IFSC Code *"><input className="input uppercase" value={form.ifscCode} onChange={set('ifscCode')} placeholder="HDFC0001234" /></Field>
                  <Field label="Account Type *">
                    <select className="input" value={form.accountType} onChange={set('accountType')}>
                      <option value="SAVINGS">Savings</option>
                      <option value="CURRENT">Current</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Attach KYC and onboarding documents. You can also add them later from the employee profile.</p>

              {/* Add doc form */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Document Type">
                    <select className="input" value={docForm.type} onChange={e => setDocForm(d => ({ ...d, type: e.target.value }))}>
                      {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </Field>
                  <Field label="Document Number (optional)">
                    <input className="input" value={docForm.number} onChange={e => setDocForm(d => ({ ...d, number: e.target.value }))} placeholder="e.g. masked Aadhaar" />
                  </Field>
                  <Field label="File Name *">
                    <input className="input" value={docForm.fileName} onChange={e => setDocForm(d => ({ ...d, fileName: e.target.value }))} placeholder="aadhaar_card.pdf" />
                  </Field>
                  <Field label="File URL / Storage Path *">
                    <input className="input" value={docForm.fileUrl} onChange={e => setDocForm(d => ({ ...d, fileUrl: e.target.value }))} placeholder="https://storage.example.com/..." />
                  </Field>
                </div>
                <button onClick={addPendingDoc} className="btn-secondary text-sm">+ Add Document</button>
              </div>

              {/* Pending docs list */}
              {pendingDocs.length > 0 && (
                <div className="space-y-2">
                  {pendingDocs.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">{doc.type}</span>
                        {doc.number && <span className="text-gray-400 ml-2 font-mono text-xs">{doc.number}</span>}
                        <div className="text-gray-500 text-xs">{doc.fileName}</div>
                      </div>
                      <button onClick={() => setPendingDocs(d => d.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                    </div>
                  ))}
                </div>
              )}

              {pendingDocs.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">No documents added yet — you can skip this step.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between flex-shrink-0">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} className="btn-secondary">
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary">Next</button>
          ) : (
            <button onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Adding...' : 'Add Employee'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      inQuotes = !inQuotes;
    } else if (text[i] === ',' && !inQuotes) {
      let val = text.substring(start, i).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1).trim();
      }
      result.push(val);
      start = i + 1;
    }
  }
  let val = text.substring(start).trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    val = val.substring(1, val.length - 1).trim();
  }
  result.push(val);
  return result;
}

function BulkImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<{ successCount: number; failedCount: number; errors: any[] } | null>(null);

  const [defaultStructureId, setDefaultStructureId] = useState('');
  const [defaultDepartmentId, setDefaultDepartmentId] = useState('');
  const [defaultBranchId, setDefaultBranchId] = useState('');

  const { data: structures = [] } = useQuery({ queryKey: ['structures'], queryFn: () => salaryApi.structures() });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() });

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: any[]) => employeesApi.bulkImport(data),
    onSuccess: (res: any) => {
      setImportResults(res);
      if (res.successCount > 0) {
        qc.invalidateQueries({ queryKey: ['employees'] });
      }
      if (res.failedCount === 0) {
        setSuccessMsg(`Successfully imported all ${res.successCount} employees!`);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    },
    onError: (e: any) => {
      setError(e.message || 'Failed to import employees');
    }
  });

  const handleDownloadTemplate = () => {
    const headers = [
      'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'pan', 'designation', 'department',
      'ctc', 'dateOfJoining', 'addressLine1', 'city', 'state', 'pincode', 'bankName', 'accountNumber', 'ifscCode'
    ];
    const sample = [
      'Priya', 'Sharma', 'priya.sharma@example.com', '9876543210', '1992-08-15', 'FEMALE', 'ABCDE1234F', 'Senior Software Engineer', 'Engineering',
      '1200000', '2024-06-01', 'Flat 402, Sunshine Apts', 'Mumbai', 'Maharashtra', '400001', 'HDFC Bank', '123456789012', 'HDFC0000123'
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), sample.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "employee_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        setError('CSV file is empty or missing data rows.');
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const parsedRecords = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < headers.length) continue; // skip incomplete lines

        const record: any = {};
        headers.forEach((header, index) => {
          record[header.trim()] = values[index]?.trim() || '';
        });

        // Resolve department name to departmentId if present in CSV
        if (record.department) {
          const deptName = record.department.trim().toLowerCase();
          const foundDept = (departments as any[]).find(d => d.name.toLowerCase() === deptName);
          if (foundDept) {
            record.departmentId = foundDept.id;
          }
        }

        // Set default values if not specified in CSV
        if (!record.salaryStructureId && defaultStructureId) {
          record.salaryStructureId = defaultStructureId;
        }
        if (!record.departmentId && defaultDepartmentId) {
          record.departmentId = defaultDepartmentId;
        }
        if (!record.branchId && defaultBranchId) {
          record.branchId = defaultBranchId;
        }

        parsedRecords.push(record);
      }

      setRecords(parsedRecords);
    };

    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (records.length === 0) {
      setError('No records to import.');
      return;
    }

    // Secondary validation: check that structure and department are selected (either in CSV or via defaults)
    const missingFields = records.some(r => !r.salaryStructureId || !r.departmentId);
    if (missingFields) {
      setError('Please select a Default Salary Structure and Department. All imported employees must have these values assigned.');
      return;
    }

    setError('');
    mutation.mutate(records);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Bulk Import Employees</h2>
            <p className="text-sm text-gray-500 mt-1">Upload a CSV file containing employee details</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex-shrink-0">{error}</div>}
        {successMsg && <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex-shrink-0">{successMsg}</div>}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {importResults ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 flex gap-6 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Success Count:</span>{' '}
                  <span className="text-green-600 font-bold">{importResults.successCount}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Failed Count:</span>{' '}
                  <span className="text-red-600 font-bold">{importResults.failedCount}</span>
                </div>
              </div>

              {importResults.failedCount > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-gray-800">Errors Details:</h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[40vh] overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 uppercase font-medium">
                        <tr>
                          <th className="px-4 py-2">Row</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Email</th>
                          <th className="px-4 py-2">Error Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importResults.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-red-50/20">
                            <td className="px-4 py-2 font-mono text-gray-500">{err.row}</td>
                            <td className="px-4 py-2 font-medium text-gray-800">{err.name}</td>
                            <td className="px-4 py-2 text-gray-600">{err.email}</td>
                            <td className="px-4 py-2 text-red-600">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Instructions and Template */}
              <div className="flex items-start justify-between bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">CSV Formatting Rules:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Required columns: <code>firstName, lastName, email, phone, dateOfBirth (YYYY-MM-DD), gender (MALE/FEMALE), pan, designation, department (name), ctc, dateOfJoining (YYYY-MM-DD), addressLine1, city, state, pincode, bankName, accountNumber, ifscCode</code></li>
                    <li>Department (<code>department</code>) name can be provided directly. Referential IDs (<code>salaryStructureId, departmentId, branchId</code>) can be omitted and will default to the selections below.</li>
                  </ul>
                </div>
                <button onClick={handleDownloadTemplate} className="btn-secondary text-xs flex-shrink-0">
                  📥 Template CSV
                </button>
              </div>

              {/* Set Defaults */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Set Default Fallbacks</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Salary Structure *">
                    <select className="input" value={defaultStructureId} onChange={e => {
                      setDefaultStructureId(e.target.value);
                      setRecords(recs => recs.map(r => ({ ...r, salaryStructureId: r.salaryStructureId || e.target.value })));
                    }}>
                      <option value="">Select structure</option>
                      {(structures as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Department *">
                    <select className="input" value={defaultDepartmentId} onChange={e => {
                      setDefaultDepartmentId(e.target.value);
                      setRecords(recs => recs.map(r => ({ ...r, departmentId: r.departmentId || e.target.value })));
                    }}>
                      <option value="">Select department</option>
                      {(departments as any[]).map((d: any) => (
                        <option key={d.id} value={d.id}>{d.type === 'TEAM' ? '  └ ' : ''}{d.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Branch (optional)">
                    <select className="input" value={defaultBranchId} onChange={e => {
                      setDefaultBranchId(e.target.value);
                      setRecords(recs => recs.map(r => ({ ...r, branchId: r.branchId || e.target.value })));
                    }}>
                      <option value="">Select branch</option>
                      {(branches as any[]).map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}{b.isHeadOffice ? ' (HO)' : ''}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
              </div>

              {/* Preview parsed records */}
              {records.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-gray-800">Preview ({records.length} employees parsed):</h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[30vh] overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 uppercase font-medium">
                        <tr>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Email</th>
                          <th className="px-4 py-2">PAN</th>
                          <th className="px-4 py-2">Designation</th>
                          <th className="px-4 py-2 text-right">CTC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {records.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{rec.firstName} {rec.lastName}</td>
                            <td className="px-4 py-2 text-gray-600">{rec.email}</td>
                            <td className="px-4 py-2 font-mono text-gray-500">{rec.pan}</td>
                            <td className="px-4 py-2 text-gray-600">{rec.designation}</td>
                            <td className="px-4 py-2 text-right font-semibold">₹{Number(rec.ctc || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">
            {importResults ? 'Close' : 'Cancel'}
          </button>
          {!importResults && (
            <button
              onClick={handleSubmit}
              disabled={records.length === 0 || mutation.isPending}
              className="btn-primary"
            >
              {mutation.isPending ? 'Importing...' : `Import ${records.length} Employees`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
