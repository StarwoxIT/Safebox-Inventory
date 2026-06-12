import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { KpiCard, Card, CardHeader, Alert, fmt, fmtN, Badge, Progress } from '../components/ui';
import api from '../utils/api';

const COLORS = ['#0F6E56','#185FA5','#BA7517','#A32D2D','#534AB7','#117a65','#b7950b'];

export default function Dashboard() {
  const { user, isSA } = useAuth();
  const [stats, setStats] = useState(null);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/products/stock')]).then(([s, stock]) => {
      setStats(s);
      setStockAlerts(stock.filter(p => p.current_stock <= p.min_threshold * 1.2));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding:32,textAlign:'center',color:'var(--color-text-secondary)' }}>Loading dashboard…</div>;
  if (!stats) return <div style={{ padding:32,textAlign:'center',color:'#A32D2D' }}>Failed to load dashboard.</div>;

  const catData = Object.entries(stats.catSummary || {}).map(([k, v]) => ({ name: k, stock: Math.round(v.totalStock) }));
  const projStatusData = [
    { name: 'Active', value: stats.activeProjects },
    { name: 'Planning', value: 1 },
    { name: 'Completed', value: 2 },
  ];

  return <>
    <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16 }}>
      <div><div style={{ fontSize:16,fontWeight:500 }}>Dashboard</div><div style={{ fontSize:11,color:'var(--color-text-secondary)',marginTop:2 }}>Good day, {user?.name}</div></div>
    </div>

    <div style={{ display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:10,marginBottom:16 }}>
      <KpiCard label="Approved products" value={stats.totalProducts} sub={`${stats.pendingApprovals} pending approval`} />
      <KpiCard label="Inventory value" value={fmt(stats.totalValue)} sub="Approved stock only" />
      <KpiCard label="Below threshold" value={stats.below} sub={`${stats.low} running low`} valueColor={stats.below > 0 ? '#A32D2D' : undefined} />
      <KpiCard label="Active projects" value={stats.activeProjects} sub={`${stats.totalEngineers} engineers deployed`} valueColor="#0F6E56" />
      <KpiCard label="Completed projects" value={stats.completedProjects ?? 0} sub="Total delivered" valueColor="#0F3D26" />
    </div>

    {stats.below > 0 && <Alert type="danger"><i className="ti ti-alert-triangle" aria-hidden="true" /><strong>{stats.below} item{stats.below > 1 ? 's' : ''} below threshold</strong> — reorder required</Alert>}
    {stats.low > 0 && <Alert type="warning"><i className="ti ti-alert-circle" aria-hidden="true" />{stats.low} item{stats.low > 1 ? 's' : ''} approaching minimum threshold</Alert>}
    {isSA() && stats.pendingApprovals > 0 && <Alert type="warning"><i className="ti ti-circle-check" aria-hidden="true" /><strong>{stats.pendingApprovals} pending approval{stats.pendingApprovals > 1 ? 's' : ''}</strong> — review in the Approvals section</Alert>}
    {stats.openOemReturns > 0 && <Alert type="warning"><i className="ti ti-arrow-back-up" aria-hidden="true" />{stats.openOemReturns} open OEM return{stats.openOemReturns > 1 ? 's' : ''} awaiting reconciliation</Alert>}

    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12 }}>
      <Card>
        <CardHeader title="Stock by category" icon="chart-bar" />
        <div style={{ padding:16,height:220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={catData} margin={{ top:4,right:8,left:0,bottom:20 }}>
              <XAxis dataKey="name" tick={{ fontSize:9 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize:10 }} />
              <Tooltip formatter={v=>[fmtN(v),'Units']} contentStyle={{ fontSize:11 }} />
              <Bar dataKey="stock" fill="#0F6E56" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardHeader title="Category value split" icon="chart-pie" />
        <div style={{ padding:16,height:220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={catData.map((c,i)=>({...c,value:stats.catSummary[c.name]?.totalValue||0}))} dataKey="value" nameKey="name" cx="45%" cy="50%" outerRadius={70} labelLine={false}>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend iconSize={10} wrapperStyle={{ fontSize:10 }} />
              <Tooltip formatter={v=>[fmt(v),'Value']} contentStyle={{ fontSize:11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>

    <Card>
      <CardHeader title="Stock alerts — items at or below threshold" icon="alert-triangle" />
      {stockAlerts.length === 0
        ? <div style={{ textAlign:'center',padding:20,color:'var(--color-text-secondary)',fontSize:12 }}><i className="ti ti-check" aria-hidden="true" /> All products above threshold</div>
        : <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12,tableLayout:'fixed' }}>
            <thead><tr style={{ background:'var(--color-background-secondary)' }}>
              {['ID','Product','Category','Stock','Min','Level','Status'].map(h=><th key={h} style={{ padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',borderBottom:'0.5px solid var(--color-border-tertiary)',letterSpacing:'.04em' }}>{h}</th>)}
            </tr></thead>
            <tbody>{stockAlerts.map(p=>{
              const st = p.current_stock <= p.min_threshold ? 'below' : 'low';
              return <tr key={p.id} style={{ borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                <td style={{ padding:'9px 12px' }}><strong>{p.id}</strong></td>
                <td style={{ padding:'9px 12px' }}>{p.model}</td>
                <td style={{ padding:'9px 12px' }}>{p.category}</td>
                <td style={{ padding:'9px 12px',textAlign:'right' }}><strong style={{ color:st==='below'?'#A32D2D':'#BA7517' }}>{fmtN(p.current_stock)}</strong></td>
                <td style={{ padding:'9px 12px',textAlign:'right' }}>{fmtN(p.min_threshold)}</td>
                <td style={{ padding:'9px 12px',minWidth:80 }}><Progress value={p.current_stock} max={p.max_threshold} color={st==='below'?'#A32D2D':'#BA7517'} /></td>
                <td style={{ padding:'9px 12px' }}><Badge color={st==='below'?'red':'amber'}>{st==='below'?'Below threshold':'Low stock'}</Badge></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
    </Card>
  </>;
}
