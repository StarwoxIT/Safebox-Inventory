import { useState, useEffect } from 'react';

export const fmt = (n) => isNaN(n) || n === null ? '—' : '₦' + Math.round(Number(n)).toLocaleString();
export const fmtN = (n) => isNaN(n) || n === null ? '—' : Number(n).toLocaleString();
export const initials = (s) => (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export function Badge({ children, color = 'gray' }) {
  const map = {
    green: { bg: '#EAF3DE', color: '#3B6D11' },
    red: { bg: '#FCEBEB', color: '#A32D2D' },
    amber: { bg: '#FAEEDA', color: '#854F0B' },
    blue: { bg: '#E6F1FB', color: '#185FA5' },
    purple: { bg: '#EEEDFE', color: '#534AB7' },
    teal: { bg: '#E8F5EE', color: '#1B5E3B' },
    gray: { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
  };
  const s = map[color] || map.gray;
  return <span style={{ display:'inline-flex',alignItems:'center',gap:3,padding:'2px 8px',borderRadius:8,fontSize:11,fontWeight:500,background:s.bg,color:s.color,whiteSpace:'nowrap' }}>{children}</span>;
}

export function StatusBadge({ status }) {
  const map = { Completed:'green', Active:'teal', Planning:'amber', 'On Hold':'gray', Cancelled:'red', Approved:'green', Pending:'amber', Rejected:'red', Invited:'amber', Inactive:'gray' };
  return <Badge color={map[status]||'gray'}>{status}</Badge>;
}

export function Avatar({ name, role }) {
  const bg = role === 'Super Admin' ? { bg:'#EEEDFE', color:'#534AB7' } : { bg:'#E6F1FB', color:'#185FA5' };
  return <div style={{ width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:500,flexShrink:0,...bg }}>{initials(name)}</div>;
}

export function Card({ children, style }) {
  return <div style={{ background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden',marginBottom:12,...style }}>{children}</div>;
}

export function CardHeader({ title, icon, action }) {
  return <div style={{ padding:'11px 14px',borderBottom:'0.5px solid var(--color-border-tertiary)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
    <div style={{ fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:7 }}>{icon && <i className={`ti ti-${icon}`} aria-hidden="true" />}{title}</div>
    {action}
  </div>;
}

export function Btn({ children, onClick, variant='default', size='md', disabled=false, style={} }) {
  const vars = {
    default:{ background:'#fff',color:'#0F3D26',border:'1px solid #0F3D26' },
    primary:{ background:'#0F3D26',color:'#fff',border:'none' },
    danger:{ background:'#A32D2D',color:'#fff',border:'none' },
    warning:{ background:'#BA7517',color:'#fff',border:'none' },
    ghost:{ background:'transparent',color:'#0F3D26',border:'none',padding:'4px 6px' },
  };
  const sz = size==='sm'?{ padding:'4px 10px',fontSize:11 }:{ padding:'7px 13px',fontSize:12 };
  const v = vars[variant]||vars.default;
  return <button onClick={onClick} disabled={disabled} style={{ display:'inline-flex',alignItems:'center',gap:5,borderRadius:'var(--border-radius-md)',fontWeight:500,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.6:1,...v,...sz,...style }}>{children}</button>;
}

export function Alert({ children, type='info', style={} }) {
  const map = { info:{ bg:'#E6F1FB',color:'#185FA5',border:'#B5D4F4' }, warning:{ bg:'#FAEEDA',color:'#854F0B',border:'#FAC775' }, success:{ bg:'#EAF3DE',color:'#3B6D11',border:'#C0DD97' }, danger:{ bg:'#FCEBEB',color:'#A32D2D',border:'#F7C1C1' } };
  const s = map[type]||map.info;
  return <div style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:'var(--border-radius-md)',marginBottom:10,fontSize:12,border:'0.5px solid',background:s.bg,color:s.color,borderColor:s.border,...style }}>{children}</div>;
}

export function KpiCard({ label, value, sub, valueColor }) {
  return <div style={{ background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'12px 14px' }}>
    <div style={{ fontSize:10,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3 }}>{label}</div>
    <div style={{ fontSize:20,fontWeight:500,color:valueColor||'var(--color-text-primary)' }}>{value}</div>
    {sub && <div style={{ fontSize:10,color:'var(--color-text-secondary)',marginTop:2 }}>{sub}</div>}
  </div>;
}

export function Modal({ open, title, onClose, onSave, saveLabel='Save', children, saveVariant='primary' }) {
  if (!open) return null;
  return <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.35)',zIndex:100,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'48px 16px',overflowY:'auto' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{ background:'var(--color-background-primary)',borderRadius:'var(--border-radius-lg)',border:'0.5px solid var(--color-border-tertiary)',width:520,maxWidth:'100%' }}>
      <div style={{ padding:'14px 16px',borderBottom:'0.5px solid var(--color-border-tertiary)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <span style={{ fontSize:14,fontWeight:500 }}>{title}</span>
        <Btn variant='ghost' onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></Btn>
      </div>
      <div style={{ padding:16 }}>{children}</div>
      {onSave && <div style={{ padding:'12px 16px',borderTop:'0.5px solid var(--color-border-tertiary)',display:'flex',gap:8,justifyContent:'flex-end' }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant={saveVariant} onClick={onSave}>{saveLabel}</Btn>
      </div>}
    </div>
  </div>;
}

export function FormRow({ label, children }) {
  return <div style={{ marginBottom:12 }}>
    <label style={{ display:'block',fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',marginBottom:4 }}>{label}</label>
    {children}
  </div>;
}

export function Input({ value, onChange, type='text', placeholder='', readOnly=false, style={} }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
    style={{ width:'100%',padding:'7px 9px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:12,background:readOnly?'var(--color-background-secondary)':'var(--color-background-primary)',color:readOnly?'var(--color-text-secondary)':'var(--color-text-primary)',...style }} />;
}

export function PasswordInput({ value, onChange, placeholder='' }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width:'100%',padding:'7px 34px 7px 9px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:12,background:'var(--color-background-primary)',color:'var(--color-text-primary)' }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ position:'absolute',right:4,top:'50%',transform:'translateY(-50%)',background:'#0F3D26',border:'none',borderRadius:4,cursor:'pointer',color:'#ffffff',width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}
      >
        <i className={`ti ti-eye${show ? '-off' : ''}`} style={{ fontSize:14,lineHeight:1 }} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Select({ value, onChange, children, style={} }) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{ width:'100%',padding:'7px 9px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:12,background:'var(--color-background-primary)',color:'var(--color-text-primary)',...style }}>{children}</select>;
}

export function Grid2({ children }) {
  return <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>{children}</div>;
}

export function DataTable({ cols, rows, empty='No data', pageSize=20 }) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the dataset changes (e.g. after filtering)
  useEffect(() => { setPage(1); }, [rows.length]);

  if (!rows.length) return <div style={{ textAlign:'center',padding:24,color:'var(--color-text-secondary)',fontSize:12 }}>{empty}</div>;

  const totalPages = Math.ceil(rows.length / pageSize);
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  // Build the list of page tokens to render, inserting '…' where needed
  const pageTokens = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)        return [1, 2, 3, 4, 5, '…', totalPages];
    if (page >= totalPages - 3) return [1, '…', totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
    return [1, '…', page - 1, page, page + 1, '…', totalPages];
  };

  const btnBase = { display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:28,height:28,borderRadius:'var(--border-radius-md)',border:'0.5px solid var(--color-border-secondary)',background:'var(--color-background-primary)',color:'var(--color-text-primary)',fontSize:12,cursor:'pointer',padding:'0 6px',fontWeight:400 };
  const btnActive = { ...btnBase, background:'#0F3D26',color:'#fff',border:'none',fontWeight:600 };
  const btnDisabled = { ...btnBase, opacity:.4,cursor:'not-allowed' };

  return <div>
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12,tableLayout:'fixed' }}>
        <thead>
          <tr>{cols.map(c=><th key={c.key} style={{ background:'var(--color-background-secondary)',padding:'8px 12px',textAlign:c.align||'left',fontSize:10,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.04em',borderBottom:'0.5px solid var(--color-border-tertiary)',width:c.width,whiteSpace:'nowrap' }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>{pageRows.map((r,i)=><tr key={i} style={{ borderBottom:'0.5px solid var(--color-border-tertiary)' }} onMouseEnter={e=>e.currentTarget.style.background='var(--color-background-secondary)'} onMouseLeave={e=>e.currentTarget.style.background=''}>{cols.map(c=><td key={c.key} style={{ padding:'9px 12px',textAlign:c.align||'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:c.wrap?'normal':'nowrap' }}>{c.render?c.render(r):r[c.key]}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {totalPages > 1 && (
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderTop:'0.5px solid var(--color-border-tertiary)',gap:8,flexWrap:'wrap' }}>
        <span style={{ fontSize:11,color:'var(--color-text-secondary)' }}>
          Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length}
        </span>
        <div style={{ display:'flex',gap:4,alignItems:'center' }}>
          <button style={page===1?btnDisabled:btnBase} disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button>
          {pageTokens().map((t,i) =>
            t === '…'
              ? <span key={`e${i}`} style={{ fontSize:12,color:'var(--color-text-secondary)',padding:'0 2px' }}>…</span>
              : <button key={t} style={t===page?btnActive:btnBase} onClick={()=>setPage(t)}>{t}</button>
          )}
          <button style={page===totalPages?btnDisabled:btnBase} disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
        </div>
      </div>
    )}
  </div>;
}

export function Progress({ value, max, color='#1B5E3B' }) {
  const pct = Math.min(100, Math.round((value/Math.max(max,1))*100));
  return <div style={{ height:5,background:'var(--color-background-secondary)',borderRadius:3,overflow:'hidden',minWidth:50 }}>
    <div style={{ height:'100%',width:`${pct}%`,background:color,borderRadius:3 }} />
  </div>;
}
