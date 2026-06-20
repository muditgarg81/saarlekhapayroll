'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '@/lib/api';

const DOCUMENT_TYPES = ['AADHAAR','PAN','PASSPORT','BANK_PROOF','OFFER_LETTER','EDUCATION','OTHER'];

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: emp, isLoading, isError } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.get(id),
  });

  const { data: breakdown } = useQuery({
    queryKey: ['salary-breakdown', id],
    queryFn: () => employeesApi.salaryBreakdown(id),
    enabled: !!emp,
  });

  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({ type: 'AADHAAR', number: '', fileName: '', fileUrl: '' });
  const [docError, setDocError] = useState('');

  const addDocMutation = useMutation({
    mutationFn: (data: any) => employeesApi.addDocument(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setShowDocForm(false);
      setDocForm({ type: 'AADHAAR', number: '', fileName: '', fileUrl: '' });
    },
    onError: (e: any) => setDocError(e.message || 'Failed to add document'),
  });

  const removeDocMutation = useMutation({
    mutationFn: (docId: string) => employeesApi.removeDocument(id, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee', id] }),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading employee...</div>;
  if (isError || !emp) return <div className="p-8 text-center text-red-500">Employee not found.</div>;

  const e = emp as any;
  const bd = breakdown as any;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
          ← Back to Employees
        </button>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-2xl">
            {e.firstName[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{e.firstName} {e.lastName}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {e.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm">{e.designation}{e.grade ? ` · Grade ${e.grade}` : ''} · {e.employmentType.replace('_',' ')}</p>
            <p className="text-gray-400 text-xs font-mono mt-0.5">{e.employeeCode}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-2 space-y-6">

          {/* Personal & KYC */}
          <Section title="Personal & KYC Details">
            <Grid2>
              <InfoItem label="Email" value={e.email} />
              <InfoItem label="Phone" value={e.phone} />
              <InfoItem label="Date of Birth" value={fmtDate(e.dateOfBirth)} />
              <InfoItem label="Gender" value={e.gender} />
              <InfoItem label="PAN" value={e.pan} mono />
              <InfoItem label="Aadhaar" value={e.aadhaar ? `XXXX XXXX ${e.aadhaar.slice(-4)}` : '—'} mono />
              <InfoItem label="UAN" value={e.uan || '—'} />
              <InfoItem label="ESI No." value={e.esiNumber || '—'} />
            </Grid2>
          </Section>

          {/* Employment */}
          <Section title="Employment Details">
            <Grid2>
              <InfoItem label="Department" value={e.department?.name || '—'} />
              <InfoItem label="Branch" value={e.branch ? `${e.branch.name}${e.branch.isHeadOffice ? ' (HO)' : ''}` : '—'} />
              <InfoItem label="Date of Joining" value={fmtDate(e.dateOfJoining)} />
              <InfoItem label="Employment Type" value={e.employmentType.replace('_',' ')} />
              <InfoItem label="Annual CTC" value={`₹${e.ctc.toLocaleString('en-IN')}`} />
              <InfoItem label="Monthly CTC" value={`₹${(e.ctc / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
            </Grid2>
          </Section>

          {/* Salary Breakdown */}
          {bd && (
            <Section title="Salary Breakdown">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Earnings</p>
                  {bd.earnings.map((item: any) => (
                    <div key={item.code} className="flex justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-medium">₹{item.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm py-1 font-semibold text-green-700 mt-1">
                    <span>Gross Earnings</span>
                    <span>₹{bd.grossEarnings.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Deductions</p>
                  {bd.deductions.map((item: any) => (
                    <div key={item.code} className="flex justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-medium text-red-600">₹{item.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm py-1 font-semibold text-red-700 mt-1">
                    <span>Total Deductions</span>
                    <span>₹{bd.totalDeductions.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-brand-50 rounded-xl flex justify-between font-semibold text-brand-800">
                <span>Net Monthly Pay</span>
                <span>₹{(bd.grossEarnings - bd.totalDeductions).toLocaleString('en-IN')}</span>
              </div>
            </Section>
          )}

          {/* Address */}
          <Section title="Address">
            <p className="text-gray-700 text-sm">{e.addressLine1}{e.addressLine2 ? `, ${e.addressLine2}` : ''}</p>
            <p className="text-gray-700 text-sm">{e.city}, {e.state} — {e.pincode}</p>
          </Section>

          {/* Bank */}
          <Section title="Bank Details">
            <Grid2>
              <InfoItem label="Bank Name" value={e.bankName} />
              <InfoItem label="Account Type" value={e.accountType} />
              <InfoItem label="Account No." value={`XXXXXX${e.accountNumber.slice(-4)}`} mono />
              <InfoItem label="IFSC" value={e.ifscCode} mono />
            </Grid2>
          </Section>
        </div>

        {/* Right column: Documents */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Documents</h3>
              <button onClick={() => setShowDocForm(v => !v)} className="text-xs text-brand-600 hover:underline font-medium">
                {showDocForm ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {showDocForm && (
              <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
                {docError && <p className="text-xs text-red-600">{docError}</p>}
                <select className="input text-sm" value={docForm.type} onChange={e => setDocForm(d => ({ ...d, type: e.target.value }))}>
                  {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
                <input className="input text-sm" placeholder="Document number (optional)" value={docForm.number} onChange={e => setDocForm(d => ({ ...d, number: e.target.value }))} />
                <input className="input text-sm" placeholder="File name *" value={docForm.fileName} onChange={e => setDocForm(d => ({ ...d, fileName: e.target.value }))} />
                <input className="input text-sm" placeholder="File URL / storage path *" value={docForm.fileUrl} onChange={e => setDocForm(d => ({ ...d, fileUrl: e.target.value }))} />
                <button onClick={() => { setDocError(''); addDocMutation.mutate(docForm); }} disabled={addDocMutation.isPending} className="btn-primary w-full text-sm">
                  {addDocMutation.isPending ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            )}

            {(e.documents || []).length === 0 && !showDocForm && (
              <p className="text-xs text-gray-400 text-center py-4">No documents uploaded.</p>
            )}

            <div className="space-y-2">
              {(e.documents || []).map((doc: any) => (
                <div key={doc.id} className="flex items-start justify-between bg-gray-50 rounded-lg p-2 text-xs">
                  <div>
                    <span className="font-semibold text-gray-700">{doc.type.replace('_',' ')}</span>
                    {doc.number && <span className="ml-1 text-gray-400 font-mono">{doc.number}</span>}
                    <div className="text-gray-500 truncate max-w-[140px]">{doc.fileName}</div>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">View</a>
                  </div>
                  <button
                    onClick={() => removeDocMutation.mutate(doc.id)}
                    className="text-red-400 hover:text-red-600 text-base leading-none ml-1"
                    title="Remove"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="card p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">Quick Info</h3>
            <InfoItem label="Joined" value={fmtDate(e.dateOfJoining)} />
            {e.dateOfLeaving && <InfoItem label="Left" value={fmtDate(e.dateOfLeaving)} />}
            <InfoItem label="Employment" value={e.employmentType.replace('_',' ')} />
            {e.grade && <InfoItem label="Grade" value={e.grade} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>;
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm text-gray-800 font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
