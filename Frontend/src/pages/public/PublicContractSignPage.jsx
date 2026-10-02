import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileSignature, Loader2, LockKeyhole, MailCheck, PenLine, ShieldCheck, X } from 'lucide-react';
import { useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error(body?.message || 'Không thể thực hiện yêu cầu.');
  return body.data;
}

const formatTime = value => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

export default function PublicContractSignPage() {
  const { token } = useParams();
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [proof, setProof] = useState('');
  const [method, setMethod] = useState('DRAWN');
  const [signerName, setSignerName] = useState('');
  const [typedSignature, setTypedSignature] = useState('');
  const [uploadedSignature, setUploadedSignature] = useState('');
  const [consent, setConsent] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    request(`/public/contracts/sign/${encodeURIComponent(token)}`)
      .then(data => { setContract(data); setSignerName(data.candidateName || ''); setTypedSignature(data.candidateName || ''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const sendOtp = async () => {
    setBusy(true); setError('');
    try { await request(`/public/contracts/sign/${encodeURIComponent(token)}/otp`, { method: 'POST' }); setOtpSent(true); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setBusy(true); setError('');
    try {
      const data = await request(`/public/contracts/sign/${encodeURIComponent(token)}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp }),
      });
      setProof(data.verificationProof);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const point = event => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  const startDraw = event => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext('2d'); const p = point(event);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); event.currentTarget.setPointerCapture(event.pointerId);
  };
  const draw = event => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext('2d'); const p = point(event);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#172554'; ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const stopDraw = () => { drawingRef.current = false; };
  const clearCanvas = () => canvasRef.current?.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

  const uploadSignature = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 1024 * 1024) return setError('Ảnh chữ ký phải nhỏ hơn 1MB.');
    const reader = new FileReader(); reader.onload = () => setUploadedSignature(String(reader.result)); reader.readAsDataURL(file);
  };

  const complete = async () => {
    let signatureData = typedSignature.trim();
    if (method === 'DRAWN') signatureData = canvasRef.current?.toDataURL('image/png') || '';
    if (method === 'UPLOADED') signatureData = uploadedSignature;
    if (!signatureData) return setError('Vui lòng tạo chữ ký trước khi xác nhận.');
    setBusy(true); setError('');
    try {
      const data = await request(`/public/contracts/sign/${encodeURIComponent(token)}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationProof: proof, signerName, method, signatureData, consentAccepted: consent }),
      });
      setContract(data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const decline = async () => {
    if (!declineReason.trim()) return setError('Vui lòng nhập lý do từ chối ký.');
    setBusy(true); setError('');
    try {
      const data = await request(`/public/contracts/sign/${encodeURIComponent(token)}/decline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationProof: proof, reason: declineReason }),
      });
      setContract(data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" /></main>;
  if (!contract) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><X className="mx-auto text-rose-500" /><h1 className="mt-4 text-xl font-bold">Không thể mở hợp đồng</h1><p className="mt-2 text-sm text-slate-600">{error}</p></div></main>;

  const completed = contract.signingStatus === 'SIGNED' || ['CANDIDATE_SIGNED', 'ACTIVE'].includes(contract.contractStatus);
  const declined = contract.signingStatus === 'DECLINED' || contract.contractStatus === 'DECLINED';
  if (completed || declined) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-9 text-center shadow-sm">{completed ? <CheckCircle2 className="mx-auto text-emerald-600" size={48} /> : <X className="mx-auto text-rose-600" size={48} />}<h1 className="mt-5 text-2xl font-bold">{completed ? 'Bạn đã ký hợp đồng thành công' : 'Bạn đã từ chối ký hợp đồng'}</h1><p className="mt-2 text-sm text-slate-600">Hợp đồng {contract.contractNumber}. {completed ? 'Bộ phận Nhân sự sẽ tiếp tục hướng dẫn quy trình nhận việc.' : 'Bộ phận Nhân sự đã nhận được phản hồi của bạn.'}</p>{completed && <a href={`${API_URL}/public/contracts/sign/${encodeURIComponent(token)}/document`} className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Tải hợp đồng hoàn tất</a>}</section></main>;

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-blue-800 bg-blue-700 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white text-blue-700"><FileSignature /></div><div><b>HRM AI</b><p className="text-xs text-blue-100">Ký hợp đồng điện tử</p></div></div><span className="flex items-center gap-2 text-xs"><ShieldCheck size={16} />OTP bảo mật</span></div></header>
    <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_390px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-5"><p className="text-xs font-bold uppercase tracking-wider text-blue-600">{contract.contractNumber}</p><h1 className="mt-1 text-2xl font-bold">Hợp đồng lao động</h1><p className="mt-1 text-sm text-slate-500">{contract.candidateName} · {contract.jobTitle}</p></div><iframe title="Hợp đồng" srcDoc={contract.generatedHtml} className="h-[760px] w-full" /></section>
      <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold"><LockKeyhole className="text-blue-600" size={20} />Xác thực người ký</h2><p className="mt-2 text-sm text-slate-600">OTP sẽ được gửi tới {contract.candidateEmailMasked}. Link hết hạn {formatTime(contract.expiresAt)}.</p>{!proof && <>{!otpSent ? <button disabled={busy} onClick={sendOtp} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Đang gửi...' : 'Gửi mã OTP'}</button> : <div className="mt-4 space-y-3"><input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Nhập 6 số OTP" className="w-full rounded-xl border p-3 text-center text-xl font-bold tracking-[0.3em]" /><button disabled={busy || otp.length !== 6} onClick={verifyOtp} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50">Xác thực OTP</button><button onClick={sendOtp} className="w-full text-sm font-semibold text-blue-600">Gửi lại OTP</button></div>}</>}{proof && <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"><MailCheck size={18} />Email đã được xác thực</div>}</section>
        {proof && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold"><PenLine className="text-blue-600" size={20} />Tạo chữ ký</h2><label className="mt-4 block text-sm font-semibold">Họ tên người ký<input value={signerName} onChange={e => setSignerName(e.target.value)} className="mt-1.5 w-full rounded-xl border p-3" /></label><div className="mt-4 grid grid-cols-3 gap-2">{[['DRAWN','Vẽ'],['TYPED','Gõ tên'],['UPLOADED','Tải ảnh']].map(([value,label]) => <button key={value} onClick={() => setMethod(value)} className={`rounded-lg border px-2 py-2 text-xs font-bold ${method === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200'}`}>{label}</button>)}</div>{method === 'DRAWN' && <div className="mt-3"><canvas ref={canvasRef} width="640" height="220" onPointerDown={startDraw} onPointerMove={draw} onPointerUp={stopDraw} onPointerCancel={stopDraw} className="h-32 w-full touch-none rounded-xl border border-dashed border-blue-300 bg-blue-50/30" /><button onClick={clearCanvas} className="mt-1 text-xs font-semibold text-slate-500">Xóa và vẽ lại</button></div>}{method === 'TYPED' && <input value={typedSignature} onChange={e => setTypedSignature(e.target.value)} className="mt-3 w-full rounded-xl border p-4 text-center text-2xl italic" />}{method === 'UPLOADED' && <div className="mt-3"><input type="file" accept="image/png,image/jpeg" onChange={uploadSignature} className="w-full text-sm" />{uploadedSignature && <img src={uploadedSignature} alt="Chữ ký" className="mt-2 h-24 max-w-full object-contain" />}</div>}<label className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" /><span>{contract.consentText}</span></label><button disabled={busy || !consent || !signerName.trim()} onClick={complete} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50">Ký và hoàn tất hợp đồng</button><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-rose-600">Tôi không đồng ý ký</summary><textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="Lý do từ chối" className="mt-2 min-h-20 w-full rounded-xl border p-3 text-sm" /><button disabled={busy || !declineReason.trim()} onClick={decline} className="mt-2 w-full rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700">Xác nhận từ chối ký</button></details></section>}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      </aside>
    </div>
  </main>;
}
