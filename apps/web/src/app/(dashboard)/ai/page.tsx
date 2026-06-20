'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { aiApi, employeesApi } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const now = new Date();

function NotConfigured() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
      <p className="font-semibold mb-1">⚠️ AI not configured</p>
      <p>Set <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> in the API environment to enable natural-language queries and the chatbot. Anomaly detection and tax tips work without it.</p>
    </div>
  );
}

// ── Ask Tab (NL query) ─────────────────────────────────────────────────────────
function AskTab({ configured }: { configured: boolean }) {
  const [question, setQuestion] = useState('');
  const askMut = useMutation({ mutationFn: () => aiApi.query(question) });
  const result = askMut.data as any;

  const samples = [
    'Which department has the highest payroll cost?',
    'What was our total net payout last month?',
    'How many employees are active and how is headcount split by department?',
    'Compare gross pay across the last 3 payruns.',
  ];

  return (
    <div>
      {!configured && <NotConfigured />}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-2">Ask about your payroll data</p>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && configured && question.trim()) askMut.mutate(); }}
            placeholder="e.g. Which department has the highest cost?"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={() => askMut.mutate()} disabled={!configured || askMut.isPending || !question.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {askMut.isPending ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {samples.map(s => (
            <button key={s} onClick={() => setQuestion(s)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200">{s}</button>
          ))}
        </div>

        {askMut.isError && <p className="mt-4 text-sm text-red-600">{(askMut.error as any)?.message || 'Query failed'}</p>}
        {result && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-xl">
            <p className="text-xs text-indigo-400 mb-1">🤖 {result.model}</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.answer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Anomalies Tab ──────────────────────────────────────────────────────────────
function AnomaliesTab({ configured }: { configured: boolean }) {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const { data, isLoading, refetch } = useQuery({ queryKey: ['ai-anomalies', month, year], queryFn: () => aiApi.anomalies(month, year) as any });
  const explainMut = useMutation({ mutationFn: () => aiApi.explainAnomalies(month, year) });
  const d = data as any;

  const sevColor: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', info: 'bg-blue-100 text-blue-700' };
  const typeIcon: Record<string, string> = { SALARY_SPIKE: '📈', SALARY_DROP: '📉', DEDUCTION_CHANGE: '⚖️', NEW_PAYEE: '🆕' };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24" />
        <button onClick={() => refetch()} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Scan</button>
        {configured && d?.found && d.count > 0 && (
          <button onClick={() => explainMut.mutate()} disabled={explainMut.isPending} className="ml-auto px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {explainMut.isPending ? 'Summarising…' : '🤖 AI Summary'}
          </button>
        )}
      </div>

      {(explainMut.data as any)?.narrative && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-xl text-sm text-gray-800">
          <p className="text-xs text-indigo-400 mb-1">🤖 AI risk summary</p>
          {(explainMut.data as any).narrative}
        </div>
      )}

      {isLoading ? <div className="text-center py-12 text-gray-400">Scanning…</div> :
       !d?.found ? <div className="text-center py-12 text-gray-400">No regular payrun found for {MONTHS[month - 1]} {year}</div> : (
        <>
          <div className={`mb-4 p-3 rounded-xl text-sm ${d.count === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
            {d.count === 0 ? '✓ ' : '⚠️ '}{d.summary}
          </div>
          <div className="space-y-2">
            {d.anomalies.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{typeIcon[a.type] || '•'}</span>
                  <div>
                    <p className="font-medium text-gray-900">{a.name} <span className="text-xs text-gray-400">{a.employeeCode}</span></p>
                    <p className="text-xs text-gray-500">{a.detail}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sevColor[a.severity] || ''}`}>{a.severity}</span>
                  {a.changePct != null && <p className={`text-sm font-bold mt-1 ${a.changePct > 0 ? 'text-red-600' : 'text-blue-600'}`}>{a.changePct > 0 ? '+' : ''}{a.changePct}%</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tax Tips Tab ───────────────────────────────────────────────────────────────
function TaxTipsTab() {
  const [employeeId, setEmployeeId] = useState('');
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ai-tax', employeeId],
    queryFn: () => aiApi.taxOptimization(employeeId) as any,
    enabled: !!employeeId,
  });
  const d = data as any;

  return (
    <div>
      <div className="mb-4">
        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72">
          <option value="">Select employee…</option>
          {(employees as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
        </select>
      </div>

      {!employeeId ? <div className="text-center py-12 text-gray-400">Select an employee to see tax-saving suggestions</div> :
       isLoading ? <div className="text-center py-12 text-gray-400">Analysing…</div> :
       isError ? <div className="text-center py-12 text-red-500">{(error as any)?.message || 'Failed'}</div> : d && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Annual Gross', val: fmt(d.annualGross) },
              { label: 'Regime', val: d.currentRegime },
              { label: 'Marginal Rate', val: d.estimatedMarginalRate },
              { label: 'Potential Saving', val: fmt(d.totalPotentialSaving), color: 'text-green-700' },
            ].map(c => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-lg font-bold ${c.color || 'text-gray-900'}`}>{c.val}</p>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-800 mb-4">💡 {d.regimeNote}</div>

          {!d.hasDeclaration && <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-800 mb-4">No IT declaration on file — suggestions assume zero current investments.</div>}

          <div className="space-y-2">
            {d.suggestions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No further deductions available — limits appear fully utilised.</div>
            ) : d.suggestions.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-1 bg-indigo-100 text-indigo-700 rounded">{s.section}</span>
                  <div>
                    <p className="font-medium text-gray-900">{s.title}</p>
                    <p className="text-xs text-gray-500">{s.detail}</p>
                  </div>
                </div>
                {s.potentialSaving > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">saves ~</p>
                    <p className="text-sm font-bold text-green-700">{fmt(s.potentialSaving)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Chat Tab ────────────────────────────────────────────────────────────────────
function ChatTab({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hi! I can help with questions about payslips, PF/ESI, TDS, tax regimes, leave, and reimbursements. What would you like to know?' },
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const chatMut = useMutation({
    mutationFn: (msgs: any[]) => aiApi.chat(msgs),
    onSuccess: (r: any) => setMessages(m => [...m, { role: 'assistant', content: r.reply }]),
    onError: (e: any) => setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${e?.message || 'Something went wrong.'}` }]),
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, chatMut.isPending]);

  function send() {
    if (!input.trim()) return;
    const next = [...messages, { role: 'user' as const, content: input.trim() }];
    setMessages(next);
    setInput('');
    chatMut.mutate(next.filter(m => m.role === 'user' || m.role === 'assistant').slice(-10));
  }

  const faqs = ['How is my PF calculated?', 'Old vs new tax regime — which is better?', 'How do I claim HRA?', 'When will I get my payslip?'];

  return (
    <div>
      {!configured && <NotConfigured />}
      <div className="bg-white border border-gray-200 rounded-2xl flex flex-col h-[28rem]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {chatMut.isPending && <div className="flex justify-start"><div className="bg-gray-100 text-gray-400 px-3 py-2 rounded-2xl text-sm">typing…</div></div>}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {faqs.map(q => (
              <button key={q} onClick={() => setInput(q)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200">{q}</button>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 p-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && configured) send(); }}
            disabled={!configured}
            placeholder={configured ? 'Type your question…' : 'AI not configured'}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
          />
          <button onClick={send} disabled={!configured || chatMut.isPending || !input.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Send</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['Ask', 'Anomaly Detection', 'Tax Tips', 'Employee Chat'];

export default function AiPage() {
  const [tab, setTab] = useState(0);
  const { data: status } = useQuery({ queryKey: ['ai-status'], queryFn: () => aiApi.status() as any });
  const configured = !!(status as any)?.configured;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Assistant 🤖</h1>
          <p className="text-sm text-gray-500 mt-1">Natural-language queries, anomaly detection, tax tips, and an employee chatbot</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {configured ? `● ${(status as any)?.model || 'Claude'}` : '○ AI offline'}
        </span>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t}</button>
        ))}
      </div>

      <div>
        {tab === 0 && <AskTab configured={configured} />}
        {tab === 1 && <AnomaliesTab configured={configured} />}
        {tab === 2 && <TaxTipsTab />}
        {tab === 3 && <ChatTab configured={configured} />}
      </div>
    </div>
  );
}
