'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  Copy,
  CircleDollarSign,
  CreditCard,
  HandCoins,
  History,
  Home,
  Landmark,
  Eye,
  EyeOff,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  Pencil,
  Receipt,
  Search,
  Trash2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X
} from 'lucide-react';

const entryTypeLabels = { investment: 'Money invested', spend: 'Business expense', loan: 'Loan', withdrawal: 'Partner withdrawal', loan_withdrawal: 'Loan withdrawal', advance_spend: 'Advance spent', partner_repayment: 'Partner repayment', repayment: 'Loan repayment', return: 'Money returned' };
const displayRole = (role) => role === 'owner' || role === 'partner' ? 'Partner' : role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Partner';

const navItems = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'businesses', label: 'Businesses', icon: Building2 },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'people', label: 'Partners', icon: Users },
  { id: 'loans', label: 'Loans', icon: Landmark },
  { id: 'reports', label: 'Reports', icon: BarChart3 }
];

const money = (amount) => `${amount < 0 ? '-' : ''}₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortMoney = (amount) => `${amount < 0 ? '-' : ''}₹${Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function Avatar({ initials, color = 'blue', small = false }) {
  return <span className={`avatar ${color} ${small ? 'small' : ''}`}>{initials}</span>;
}

function Logo() {
  return <div className="logo"><span className="logo-mark"><span /></span><span>BWallet</span></div>;
}

function EmptyState({ icon: Icon, title, copy, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><span>{copy}</span>{action}</div>;
}

function LoadingState({ copy = 'Loading...' }) {
  return <div className="loading-state" role="status" aria-live="polite"><LoaderCircle className="loading-spinner" size={20} /><span>{copy}</span></div>;
}

function FailureState({ title, copy, onRetry }) {
  return <div className="app-loading failure-state" role="alert"><Logo /><strong>{title}</strong><span>{copy}</span><button className="primary-button" onClick={onRetry}>Try again</button></div>;
}

async function readApiResponse(response, fallback) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || fallback);
  return result;
}

export default function HomePage() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);
  const [active, setActive] = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [people, setPeople] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [archivedBusinesses, setArchivedBusinesses] = useState([]);
  const [modal, setModal] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [historyTransaction, setHistoryTransaction] = useState(null);
  const [ledgerPartner, setLedgerPartner] = useState(null);
  const [returnToMovement, setReturnToMovement] = useState(false);
  const [businessToArchive, setBusinessToArchive] = useState(null);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState('');
  const [dataAttempt, setDataAttempt] = useState(0);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [businessActionId, setBusinessActionId] = useState(null);
  const [form, setForm] = useState({ entryType: 'spend', amount: '', description: '', category: 'Business spend', businessId: '', source: 'wallet', allocationType: 'common', allocationUserId: '' });

  useEffect(() => {
    let cancelled = false;
    setAuthLoading(true);
    setAuthError('');
    fetch('/api/auth', { cache: 'no-store' })
      .then((response) => readApiResponse(response, 'Could not verify your session.'))
      .then((result) => { if (!cancelled) setAuthUser(result.user); })
      .catch((error) => { if (!cancelled) setAuthError(error.message || 'Could not verify your session.'); })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, [authAttempt]);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    setDataLoading(true);
    setDataReady(false);
    setDataError('');
    Promise.all([
      fetch('/api/transactions', { cache: 'no-store' }).then((response) => readApiResponse(response, 'Could not load transactions.')),
      fetch('/api/workspace', { cache: 'no-store' }).then((response) => readApiResponse(response, 'Could not load partnership data.'))
    ]).then(([transactionResult, workspaceResult]) => {
      if (!Array.isArray(transactionResult.transactions) || !Array.isArray(workspaceResult.members) || !Array.isArray(workspaceResult.businesses)) throw new Error('Partnership data is incomplete.');
      if (cancelled) return;
      setTransactions(transactionResult.transactions.map((item) => ({ id: item.id, userId: item.userId, name: item.description, note: `${item.businessName || 'Partner wallet'} · ${item.source}${item.takenByName ? ` · taken by ${item.takenByName}` : ''}`, category: item.category, type: item.type, entryType: item.entryType, source: item.source, allocationType: item.allocationType || 'common', allocationUserId: item.allocationUserId || '', allocationUserName: item.allocationUserName, businessId: item.businessId, businessName: item.businessName, takenById: item.takenById, takenByName: item.takenByName, amount: item.amount / 100, date: item.occurredOn, color: item.entryType === 'loan' ? 'purple' : item.entryType === 'investment' ? 'blue' : item.entryType === 'return' ? 'green' : 'orange', letter: item.description.slice(0, 1).toUpperCase() })));
      setPeople(workspaceResult.members.map((member, index) => ({ id: member.id, name: member.name, initials: member.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), role: displayRole(member.role), color: index % 2 ? 'coral' : 'blue', balance: member.balance / 100, detail: member.balance < 0 ? 'Taken out' : member.balance > 0 ? 'Added to wallet' : 'No money added or taken yet' })));
      setBusinesses(workspaceResult.businesses.filter((business) => !business.archivedAt));
      setArchivedBusinesses(workspaceResult.businesses.filter((business) => business.archivedAt));
      setDataReady(true);
    }).catch((error) => { if (!cancelled) setDataError(error.message || 'Could not load partnership data.'); }).finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [authUser, dataAttempt]);

  const totals = useMemo(() => {
    const cash = transactions.filter((item) => item.entryType !== 'advance_spend').reduce((sum, item) => sum + item.amount, 0);
    const invested = transactions.filter((item) => item.entryType === 'investment').reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const spent = transactions.filter((item) => ['spend', 'advance_spend'].includes(item.entryType)).reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const returns = transactions.filter((item) => item.entryType === 'return').reduce((sum, item) => sum + item.amount, 0);
    const loans = transactions.filter((item) => item.entryType === 'loan').reduce((sum, item) => sum + item.amount, 0);
    return { cash, invested, spent, returns, loans, profit: returns - spent };
  }, [transactions]);

  if (authLoading) return <div className="app-loading"><Logo /><LoadingState copy="Loading your partnership hub..." /></div>;
  if (authError) return <FailureState title="Could not connect to BWallet" copy={authError} onRetry={() => setAuthAttempt((attempt) => attempt + 1)} />;
  if (!authUser) return <AuthScreen onAuthenticated={setAuthUser} />;
  if (dataLoading && !dataReady) return <div className="app-loading"><Logo /><LoadingState copy="Loading your partnership data..." /></div>;
  if (dataError && !dataReady) return <FailureState title="Could not load your partnership hub" copy={dataError} onRetry={() => setDataAttempt((attempt) => attempt + 1)} />;

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const selectNav = (id) => {
    setActive(id);
    setMenuOpen(false);
  };

  const submitTransaction = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!amount || !form.description.trim()) {
      notify('Enter an amount and description');
      return;
    }
    const isInflow = ['loan', 'return'].includes(form.entryType);
    const business = businesses.find((item) => String(item.id) === String(form.businessId));
    const created = {
      id: editingTransaction?.id || Date.now(),
      userId: authUser.id,
      name: form.description.trim(),
      note: `${form.category} · ${business?.name || 'Partner wallet'}`,
      category: form.category,
      type: form.entryType === 'loan' ? 'loan' : isInflow ? 'income' : 'expense',
      entryType: form.entryType,
      source: form.source,
      allocationType: form.allocationType || 'common',
      allocationUserId: form.allocationUserId || (form.allocationType === 'individual' ? authUser.id : null),
      businessId: form.businessId || null,
      businessName: business?.name,
      takenById: ['withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment'].includes(form.entryType) ? form.takenById || authUser.id : null,
      takenByName: ['withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment'].includes(form.entryType) ? people.find((person) => String(person.id) === String(form.takenById || authUser.id))?.name || authUser.name : null,
      amount: isInflow ? amount : -amount,
      date: editingTransaction?.date || 'Just now',
      color: form.entryType === 'loan' ? 'purple' : form.entryType === 'investment' ? 'blue' : form.entryType === 'return' ? 'green' : 'orange',
      letter: form.description.trim().slice(0, 1).toUpperCase()
    };
    const body = { entryType: form.entryType, source: form.source, allocationType: form.allocationType || 'common', allocationUserId: form.allocationUserId || (form.allocationType === 'individual' ? authUser.id : null), businessId: form.businessId || null, takenById: form.takenById || authUser.id, amount, description: form.description.trim(), category: form.category };
    const endpoint = editingTransaction ? `/api/transactions/${editingTransaction.id}` : '/api/transactions';
    setSavingTransaction(true);
    try {
      const response = await fetch(endpoint, { method: editingTransaction ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await readApiResponse(response, 'Could not save transaction.');
      setTransactions((current) => editingTransaction ? current.map((item) => item.id === editingTransaction.id ? created : item) : [created, ...current]);
      setForm({ entryType: 'spend', amount: '', description: '', category: 'Business spend', businessId: '', source: 'wallet', allocationType: 'common', allocationUserId: '', takenById: '' });
      setEditingTransaction(null);
      setModal(null);
      notify(editingTransaction ? 'Transaction updated and change recorded' : 'Transaction added to your ledger');
    } catch (error) {
      notify(error.message || 'Could not save transaction');
    } finally {
      setSavingTransaction(false);
    }
  };

  const editTransaction = (item) => {
    setEditingTransaction(item);
    setForm({ entryType: item.entryType || 'spend', amount: Math.abs(item.amount), description: item.name, category: item.category, businessId: item.businessId || '', source: item.source || 'wallet', allocationType: item.allocationType || 'common', allocationUserId: item.allocationUserId || '', takenById: item.takenById || '' });
    setModal('transaction');
  };

  const viewHistory = (item) => { setHistoryTransaction(item); setModal('history'); };
  const archiveBusiness = (business) => setBusinessToArchive(business);
  const confirmArchiveBusiness = async () => {
    const business = businessToArchive;
    if (!business) return;
    setBusinessActionId(business.id);
    try {
      const response = await fetch(`/api/businesses/${business.id}`, { method: 'DELETE' });
      await readApiResponse(response, 'Could not archive business.');
      setBusinesses((current) => current.filter((item) => item.id !== business.id));
      setArchivedBusinesses((current) => [...current, { ...business, archivedAt: new Date().toISOString() }]);
      setBusinessToArchive(null);
      notify('Business archived; transactions were kept');
    } catch (error) {
      notify(error.message || 'Could not archive business');
    } finally {
      setBusinessActionId(null);
    }
  };
  const restoreBusiness = async (business) => {
    setBusinessActionId(business.id);
    try {
      const response = await fetch(`/api/businesses/${business.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore' }) });
      const result = await readApiResponse(response, 'Could not restore business.');
      setArchivedBusinesses((current) => current.filter((item) => item.id !== business.id));
      setBusinesses((current) => [...current, result.business]);
      notify('Business restored');
    } catch (error) {
      notify(error.message || 'Could not restore business');
    } finally {
      setBusinessActionId(null);
    }
  };
  const openLoan = () => { setEditingTransaction(null); setForm({ entryType: 'loan', amount: '', description: '', category: 'Loan received', businessId: '', source: 'loan', allocationType: 'common', allocationUserId: '', takenById: '' }); setModal('transaction'); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-top"><Logo /><button className="close-menu" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        <div className="workspace-select"><div className="workspace-icon"><Building2 size={16} /></div><div><b>{authUser.organization}</b><span>Partnership hub</span></div><ChevronDown size={15} /></div>
        <div className="nav-label">Partnership hub</div>
        <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => selectNav(id)}><Icon size={19} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-bottom">
          <button onClick={() => setModal('invite')}><UserPlus size={18} /><span>Invite a partner</span></button>
          <div className="sidebar-user"><Avatar initials={authUser.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()} /><div><b>{authUser.name}</b><span>{displayRole(authUser.role)}</span></div><ChevronRight size={16} /></div>
        </div>
      </aside>
      {menuOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
          <div className="mobile-logo"><Logo /></div>
          <div className="breadcrumbs"><span>{authUser.organization}</span><ChevronRight size={14} /><b>{navItems.find((item) => item.id === active)?.label}</b></div>
          <div className="top-actions"><button className="icon-button search-button" aria-label="Search transactions" onClick={() => { setActive('transactions'); notify('Search your transactions below'); }}><Search size={19} /></button><button className="icon-button notification" aria-label="Notifications" onClick={() => notify('You are all caught up')}><Bell size={19} /><i /></button><button className="top-avatar" aria-label="Open account menu" onClick={() => setModal('profile')}>{authUser.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</button></div>
        </header>

        <div className="page-wrap">
          <div className="page-heading"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><h1>{active === 'overview' ? `Good morning, ${authUser.name.split(' ')[0]}` : navItems.find((item) => item.id === active)?.label}</h1><p className="heading-copy">A simple view of your money, businesses, partners, and loans.</p></div>{active !== 'overview' && <button className="primary-button desktop-add" onClick={() => setModal('transaction')}><Plus size={18} /> Add a transaction</button>}</div>

          {active === 'overview' && <Overview totals={totals} transactions={transactions} people={people} businesses={businesses} setActive={setActive} openTransaction={() => setModal('transaction')} openBusiness={() => setModal('business')} notify={notify} onArchiveBusiness={archiveBusiness} />}
          {active === 'businesses' && <Businesses businesses={businesses} archivedBusinesses={archivedBusinesses} transactions={transactions} openBusiness={() => setModal('business')} openTransaction={() => setModal('transaction')} onArchiveBusiness={archiveBusiness} onRestoreBusiness={restoreBusiness} businessActionId={businessActionId} />}
          {active === 'transactions' && <Transactions transactions={transactions} openTransaction={() => { setEditingTransaction(null); setModal('transaction'); }} onEdit={editTransaction} onHistory={viewHistory} />}
          {active === 'people' && <People people={people} transactions={transactions} openInvite={() => setModal('invite')} onViewLedger={(person) => { setLedgerPartner(person); setModal('ledger'); }} />}
          {active === 'loans' && <Loans transactions={transactions} notify={notify} openLoan={openLoan} />}
          {active === 'reports' && <Reports totals={totals} transactions={transactions} />}
        </div>
      </main>

      <button className="mobile-add" onClick={() => setModal('transaction')}><Plus size={22} /></button>
      <nav className="bottom-nav">{navItems.slice(0, 4).map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => selectNav(id)}><Icon size={19} /><span>{id === 'loans' ? 'Debts' : label}</span></button>)}</nav>

      {modal === 'transaction' && <TransactionModal form={form} setForm={setForm} businesses={businesses} people={people} currentUserId={authUser.id} currentUserName={authUser.name} editing={editingTransaction} submitting={savingTransaction} onAddBusiness={() => { setReturnToMovement(true); setModal('business'); }} onClose={() => { setModal(null); setEditingTransaction(null); }} onSubmit={submitTransaction} />}
      {modal === 'history' && <HistoryModal transaction={historyTransaction} onClose={() => { setModal(null); setHistoryTransaction(null); }} />}
      {modal === 'ledger' && <PartnerLedgerModal partner={ledgerPartner} transactions={transactions} onClose={() => { setModal(null); setLedgerPartner(null); }} />}
      {modal === 'business' && <BusinessModal onClose={() => { setReturnToMovement(false); setModal(null); }} onCreated={(business) => { setBusinesses((current) => [...current, business]); if (returnToMovement) { setForm((current) => ({ ...current, businessId: business.id })); setReturnToMovement(false); setModal('transaction'); } else setModal(null); }} />}
      {businessToArchive && <ConfirmArchiveModal business={businessToArchive} busy={Boolean(businessActionId)} onClose={() => setBusinessToArchive(null)} onConfirm={confirmArchiveBusiness} />}
      {modal === 'invite' && <InviteModal user={authUser} onClose={() => setModal(null)} notify={notify} />}
      {modal === 'profile' && <ProfileModal user={authUser} onClose={() => setModal(null)} notify={notify} openAuth={() => setModal('auth')} onSignedOut={() => setAuthUser(null)} />} 
      {modal === 'auth' && <AuthModal onClose={() => setModal(null)} notify={notify} onAuthenticated={setAuthUser} />}
      {toast && <div className="toast" role="status" aria-live="polite"><ShieldCheck size={17} />{toast}</div>}
    </div>
  );
}

function Overview({ totals, transactions, people, businesses, setActive, openTransaction, openBusiness, notify, onArchiveBusiness }) {
  const commonSpend = transactions.filter((item) => item.entryType === 'spend' && item.allocationType === 'common').reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const commonInvested = transactions.filter((item) => item.entryType === 'investment' && item.allocationType === 'common').reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const commonReturned = transactions.filter((item) => item.entryType === 'return' && item.allocationType === 'common').reduce((sum, item) => sum + item.amount, 0);
  return <><section className="overview-welcome"><div><p className="eyebrow">Partnership hub snapshot</p><h2>Your money, at a glance.</h2><p>Track wallet balance, business activity, partner money, and loans from one clear view.</p></div><div className="overview-actions"><button className="primary-button" onClick={openTransaction}><Plus size={17} /> Add transaction</button><button className="outline-button" onClick={openBusiness}><Building2 size={16} /> Add business</button></div></section>
    <section className="overview-summary-grid">
      <div className="summary-card summary-card-primary"><div className="stat-top"><span>Wallet balance</span><span className="stat-icon"><Wallet size={17} /></span></div><strong>{money(totals.cash)}</strong><div className="stat-foot"><span className="positive"><ArrowUpRight size={14} /> Money currently available</span></div><div className="sparkline"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></div>
      <div className="summary-card"><div className="stat-top"><span>Profit after costs</span><span className="stat-icon mint"><CircleDollarSign size={17} /></span></div><strong>{money(totals.profit)}</strong><div className="stat-foot"><span>Returns minus business spend</span></div></div>
      <div className="summary-card"><div className="stat-top"><span>Business investments</span><span className="stat-icon lilac"><Building2 size={17} /></span></div><strong>{money(totals.invested)}</strong><div className="stat-foot"><span>Money put into {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'}</span><button onClick={() => setActive('businesses')}>View <ChevronRight size={13} /></button></div></div>
      <div className="summary-card"><div className="stat-top"><span>Outstanding loans</span><span className="stat-icon peach"><CreditCard size={17} /></span></div><strong>{money(transactions.filter((item) => ['loan', 'repayment', 'loan_withdrawal'].includes(item.entryType)).reduce((sum, item) => sum + item.amount, 0))}</strong><div className="stat-foot"><span>{transactions.filter((item) => item.entryType === 'loan').length} {transactions.filter((item) => item.entryType === 'loan').length === 1 ? 'loan' : 'loans'} recorded</span><button onClick={() => setActive('loans')}>Manage <ChevronRight size={13} /></button></div></div>
    </section>
    <section className="shared-wallet-panel"><div className="shared-wallet-heading"><div><p className="eyebrow">Shared wallet</p><h2>Common money</h2><p>Money not assigned to one partner.</p></div><button className="outline-button" onClick={() => setActive('transactions')}>View shared transactions <ChevronRight size={14} /></button></div><div className="shared-wallet-metrics"><div><span>Common spent</span><strong>{money(commonSpend)}</strong><small>Shared business expenses</small></div><div><span>Shared invested</span><strong>{money(commonInvested)}</strong><small>Money put into businesses</small></div><div><span>Money returned</span><strong>{money(commonReturned)}</strong><small>Returned to shared wallet</small></div></div></section>
    <div className="overview-content-grid">
      <CashflowChart transactions={transactions} />
      <section className="panel balance-panel"><div className="panel-heading"><div><h2>Partner balances</h2><p>Individual wallet activity only</p></div><button className="more-button" onClick={() => setActive('people')}>View all <ChevronRight size={15} /></button></div><div className="balance-list">{people.map((person) => <div className="balance-row" key={person.name}><Avatar initials={person.initials} color={person.color} /><div className="balance-person"><b>{person.name}</b><span>{person.role}</span></div><div className="balance-amount"><strong className={person.balance < 0 ? 'negative' : ''}>{person.balance > 0 ? '+' : ''}{shortMoney(person.balance)}</strong><span>{person.detail}</span></div></div>)}</div><button className="outline-button full" onClick={() => setActive('people')}><Users size={16} /> Manage partners</button></section>
    </div>
    <BusinessPortfolio businesses={businesses} transactions={transactions} openBusiness={openBusiness} openTransaction={openTransaction} onArchiveBusiness={onArchiveBusiness} compact onViewAll={() => setActive('businesses')} />
    <div className="overview-bottom-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest business transactions</p></div><button className="more-button" onClick={() => setActive('transactions')}>See all <ChevronRight size={15} /></button></div><div className="activity-list">{transactions.length ? transactions.slice(0, 4).map((item) => <TransactionRow item={item} key={item.id} />) : <EmptyState icon={Receipt} title="No transactions yet" copy="Add your first investment, expense, loan, or partner withdrawal." action={<button className="text-button" onClick={openTransaction}>Add a transaction <ArrowUpRight size={15} /></button>} />}</div></section><section className="panel getting-started"><div className="getting-icon"><Sparkles size={19} /></div><h2>Make your money make sense</h2><p>Keep every contribution, expense and partner draw in one clear place.</p><button className="text-button" onClick={openTransaction}>Add your first entry <ArrowUpRight size={15} /></button><small>{transactions.length ? `${transactions.length} recorded ${transactions.length === 1 ? 'entry' : 'entries'}` : 'Ready for your first entry'}</small></section></div>
  </>;
}

function BusinessPortfolio({ businesses, transactions, openBusiness, openTransaction, onArchiveBusiness, compact = false, onViewAll }) {
  const visibleBusinesses = compact ? businesses.slice(0, 3) : businesses;
  return <section className="panel portfolio-panel"><div className="panel-heading"><div><h2>Your businesses</h2><p>See investments, spend, and money returned by business</p></div><div className="portfolio-actions">{compact && <button className="more-button" onClick={onViewAll}>View all <ChevronRight size={14} /></button>}<button className="more-button" onClick={openBusiness}><Plus size={14} /> Add business</button></div></div>{businesses.length ? <div className="business-grid">{visibleBusinesses.map((business) => <BusinessCard key={business.id} business={business} transactions={transactions.filter((item) => item.businessId === business.id)} openTransaction={openTransaction} onArchive={() => onArchiveBusiness?.(business)} />)}</div> : <EmptyState icon={Building2} title="No businesses yet" copy="Add a business before recording an investment or spend." action={<button className="text-button" onClick={openBusiness}>Add business <Plus size={14} /></button>} />}</section>;
}

function BusinessCard({ business, transactions, openTransaction, onArchive }) {
  const invested = transactions.filter((item) => item.entryType === 'investment').reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const spent = transactions.filter((item) => ['spend', 'advance_spend'].includes(item.entryType)).reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const returned = transactions.filter((item) => item.entryType === 'return').reduce((sum, item) => sum + item.amount, 0);
  return <div className="business-card"><div className="business-card-top"><span className="business-icon"><Building2 size={17} /></span><div className="business-card-actions"><span className="role-pill">Active</span>{onArchive && <button className="business-delete" aria-label={`Archive ${business.name}`} onClick={onArchive}><Trash2 size={14} /></button>}</div></div><h3>{business.name}</h3>{business.description && <p>{business.description}</p>}<div className="business-metrics"><span><small>Invested</small><b>{money(invested)}</b></span><span><small>Spent</small><b>{money(spent)}</b></span><span><small>Money back</small><b>{money(returned)}</b></span></div><button className="card-link" onClick={openTransaction}>Add transaction <ChevronRight size={14} /></button></div>;
}

function Businesses({ businesses, archivedBusinesses, transactions, openBusiness, openTransaction, onArchiveBusiness, onRestoreBusiness, businessActionId }) {
  return <><section className="people-hero business-hero"><div><p className="eyebrow">Partner wallet</p><h2>Every business, clearly separated.</h2><p>See what you invested, spent and got back in each venture.</p></div><button className="primary-button" onClick={openBusiness}><Plus size={17} /> Add business</button></section><BusinessPortfolio businesses={businesses} transactions={transactions} openBusiness={openBusiness} openTransaction={openTransaction} onArchiveBusiness={onArchiveBusiness} />{archivedBusinesses.length > 0 && <ArchivedBusinesses businesses={archivedBusinesses} onRestore={onRestoreBusiness} restoringId={businessActionId} />}</>;
}

function ArchivedBusinesses({ businesses, onRestore, restoringId }) {
  return <section className="panel archived-businesses"><div className="panel-heading"><div><h2>Archived businesses</h2><p>Transactions are preserved. Restore a business to use it again.</p></div><span className="count-pill">{businesses.length} archived</span></div><div className="archived-list">{businesses.map((business) => { const restoring = restoringId !== null; return <div className="archived-row" key={business.id}><div><b>{business.name}</b>{business.description && <span>{business.description}</span>}</div><button className="outline-button" disabled={restoring} onClick={() => onRestore(business)}>{restoring ? 'Restoring...' : 'Restore'}</button></div>; })}</div></section>;
}

function ConfirmArchiveModal({ business, busy, onClose, onConfirm }) {
  return <ModalShell title="Archive business?" subtitle="This keeps every transaction and removes business from active lists." onClose={onClose}><div className="confirm-copy"><Trash2 size={20} /><p><b>{business.name}</b> will be archived. Its ledger history will remain available.</p></div><div className="confirm-actions"><button className="movement-cancel" disabled={busy} onClick={onClose}>Cancel</button><button className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? 'Archiving...' : 'Archive business'}</button></div></ModalShell>;
}

function BusinessModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await readApiResponse(response, 'Could not add business.');
      onCreated(result.business);
    } catch (requestError) {
      setError(requestError.message || 'Could not add business.');
    } finally {
      setSaving(false);
    }
  };
  return <ModalShell title="Add a business" subtitle="Create a place to track investments and spend." onClose={onClose}><form onSubmit={submit}><label>Business name<input autoFocus required disabled={saving} placeholder="e.g. Sunrise Foods" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Description <span className="optional">Optional</span><input disabled={saving} placeholder="What does this business do?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button modal-submit" disabled={saving} type="submit"><Plus size={17} /> {saving ? 'Adding...' : 'Add business'}</button></form></ModalShell>;
}

function CashflowChart({ transactions }) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthItems = transactions.filter((item) => {
      const occurred = new Date(`${item.date}T00:00:00`);
      return occurred.getFullYear() === year && occurred.getMonth() === month;
    });
    return { label: date.toLocaleDateString('en-US', { month: 'short' }), income: monthItems.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0), expense: Math.abs(monthItems.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0)) };
  });
  const max = Math.max(...months.flatMap((month) => [month.income, month.expense]), 1);
  const totalIn = transactions.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const totalOut = Math.abs(transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
  return <section className="panel cashflow-panel"><div className="panel-heading"><div><h2>Money in and out</h2><p>See how money moved over the last six months</p></div><span className="count-pill">6 months</span></div><div className="chart-legend"><span><i className="legend-in" />Money in</span><span><i className="legend-out" />Money out</span></div><div className="chart"><div className="y-labels"><span>{shortMoney(max)}</span><span>{shortMoney(max * .75)}</span><span>{shortMoney(max * .5)}</span><span>{shortMoney(max * .25)}</span><span>₹0</span></div><div className="chart-area"><div className="grid-line one" /><div className="grid-line two" /><div className="grid-line three" /><div className="grid-line four" /><div className="bars">{months.map((month) => <div className="bar-group" key={month.label}><div className="bar-pair"><span className="bar in" style={{ height: `${month.income / max * 100}%` }} /><span className="bar out" style={{ height: `${month.expense / max * 100}%` }} /></div><small>{month.label}</small></div>)}</div></div></div><div className="chart-total"><span><b>{money(totalIn)}</b> total in</span><span><b>{money(totalOut)}</b> total out</span><span className="chart-profit"><ArrowUpRight size={14} /> {money(totalIn - totalOut)} net</span></div></section>;
}

function TransactionRow({ item }) {
  return <div className="transaction-row"><span className={`transaction-icon ${item.color}`}>{item.entryType === 'loan' ? <Landmark size={16} /> : item.entryType === 'investment' ? <ArrowDownLeft size={16} /> : item.entryType === 'withdrawal' || item.entryType === 'loan_withdrawal' ? <HandCoins size={16} /> : <ArrowUpRight size={16} />}</span><div className="transaction-info"><b>{item.name}</b><span>{item.note}</span></div><div className="transaction-value"><strong className={item.amount < 0 ? '' : 'income'}>{item.amount < 0 ? '-' : '+'}{money(Math.abs(item.amount))}</strong><span>{item.date}</span></div></div>;
}

function Transactions({ transactions, openTransaction, onEdit, onHistory }) {
  const [query, setQuery] = useState('');
  const [entryFilter, setEntryFilter] = useState('all');
  const [walletFilter, setWalletFilter] = useState('all');
  const filtered = transactions.filter((item) => {
    const matchesType = entryFilter === 'all' || item.entryType === entryFilter;
    const matchesWallet = walletFilter === 'all' || item.allocationType === walletFilter;
    const searchText = `${item.name} ${item.category} ${item.businessName || ''} ${item.entryType}`.toLowerCase();
    return matchesType && matchesWallet && (!query.trim() || searchText.includes(query.trim().toLowerCase()));
  });
  return <section className="panel full-panel"><div className="panel-heading transactions-heading"><div><h2>All transactions</h2><p>{transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'} in your partnership hub</p></div><div className="heading-actions"><label className="filter-button transaction-search"><Search size={15} /><input aria-label="Search transactions" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter transaction type" className="filter-button" value={entryFilter} onChange={(event) => setEntryFilter(event.target.value)}><option value="all">All types</option>{['investment', 'spend', 'loan', 'withdrawal', 'return', 'repayment'].map((type) => <option key={type} value={type}>{entryTypeLabels[type]}</option>)}</select><select aria-label="Filter wallet" className="filter-button" value={walletFilter} onChange={(event) => setWalletFilter(event.target.value)}><option value="all">All wallets</option><option value="common">Shared wallet</option><option value="individual">Individual wallets</option></select><button className="primary-button" onClick={openTransaction}><Plus size={17} /> Add transaction</button></div></div>{transactions.length ? filtered.length ? <div className="transaction-table"><div className="table-header"><span>Entry</span><span>Category</span><span>Date</span><span>Amount</span><span /></div>{filtered.map((item) => <div className="table-row" key={item.id}><div className="table-name"><span className={`transaction-icon ${item.color}`}>{item.letter}</span><div><b>{item.name}</b><small>{item.businessName || 'Partner wallet'} · {entryTypeLabels[item.entryType] || item.entryType} · {item.allocationType === 'common' ? 'Shared wallet' : 'Individual wallet'}</small></div></div><span className="category-pill">{item.category}</span><span className="date-text">{item.date}</span><strong className={item.amount < 0 ? '' : 'income'}>{item.amount < 0 ? '-' : '+'}{money(Math.abs(item.amount))}</strong><div className="table-actions"><button aria-label="Edit transaction" onClick={() => onEdit(item)}><Pencil size={14} /></button><button aria-label="View transaction history" onClick={() => onHistory(item)}><History size={14} /></button></div></div>)}</div> : <EmptyState icon={Search} title="No matching transactions" copy="Try another search or transaction type." /> : <EmptyState icon={Receipt} title="No transactions yet" copy="Add an investment, expense, loan, or withdrawal." action={<button className="text-button" onClick={openTransaction}>Add transaction <Plus size={14} /></button>} />}</section>;
}

function People({ people, openInvite, onViewLedger }) {
  return <><section className="people-hero"><div><p className="eyebrow">Shared ownership</p><h2>Everyone on the same page.</h2><p>Track contributions and partner draws without awkward math.</p></div><button className="primary-button" onClick={openInvite}><UserPlus size={17} /> Invite partner</button></section><section className="people-cards">{people.map((person) => <div className="person-card" key={person.name}><div className="person-card-top"><Avatar initials={person.initials} color={person.color} /><span className="role-pill">{person.role}</span></div><h3>{person.name}</h3><p>{person.role} account</p><div className="person-balance"><span>{person.balance < 0 ? 'Taken this month' : 'Balance owed'}</span><strong className={person.balance < 0 ? 'negative' : ''}>{person.balance > 0 ? '+' : ''}{money(person.balance)}</strong></div><button className="card-link" onClick={() => onViewLedger(person)}>View ledger <ChevronRight size={14} /></button></div>)}</section><section className="panel split-panel"><div><h2>Profit distribution</h2><p>Ownership shares are not configured yet.</p></div><span className="role-pill">Not configured</span></section></>;
}

function Loans({ transactions, notify, openLoan }) {
  const loans = transactions.filter((item) => ['loan', 'repayment'].includes(item.entryType));
  const total = loans.reduce((sum, item) => sum + item.amount, 0);
  return <><section className="debt-summary"><div><p className="eyebrow">Borrowed money</p><h2>Loans</h2><p>Keep borrowed money separate from business profit.</p></div><button className="primary-button" onClick={openLoan}><Plus size={17} /> Add loan</button><div className="debt-total"><span>Total borrowed</span><strong>{money(total)}</strong><small>{loans.length} {loans.length === 1 ? 'entry' : 'entries'}</small></div></section><section className="panel loans-list"><div className="panel-heading"><div><h2>Recorded loans</h2><p>Money your business needs to track and repay</p></div><span className="count-pill">{loans.length} active</span></div>{loans.length ? loans.map((loan) => <LoanRow key={loan.id} name={loan.name} type={loan.category} balance={money(loan.amount)} paid="Recorded in ledger" color="purple" />) : <EmptyState icon={Landmark} title="No loans recorded" copy="Add a loan to keep borrowed money separate from profit." />}</section></>;
}

function LoanRow({ name, type, balance, paid, color }) { return <div className="loan-row"><span className={`loan-icon ${color}`}><Landmark size={19} /></span><div className="loan-info"><b>{name}</b><span>{type}</span><small>{paid}</small></div><div className="loan-amount"><strong>{balance}</strong></div></div>; }

function Reports({ totals, transactions }) {
  const margin = totals.returns ? ((totals.profit / totals.returns) * 100).toFixed(1) : '0.0';
  const exportReport = () => {
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [['Date', 'Description', 'Business', 'Type', 'Category', 'Amount'], ...transactions.map((item) => [item.date, item.name, item.businessName || 'Partner wallet', item.entryType, item.category, item.amount.toFixed(2)])];
    const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bwallet-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <><section className="report-hero"><div><p className="eyebrow">Current partnership hub report</p><h2>Your business at a glance.</h2><p>Simple numbers for better partner decisions.</p></div><button className="outline-button" onClick={exportReport}><ArrowDownLeft size={16} /> Export CSV</button></section><section className="report-grid"><div className="report-stat"><span>Returns</span><strong>{money(totals.returns)}</strong><small>Money returned from businesses</small></div><div className="report-stat"><span>Business spend</span><strong>{money(totals.spent)}</strong><small>Money spent across businesses</small></div><div className="report-stat"><span>Profit margin</span><strong>{margin}%</strong><small>Profit after costs</small></div><div className="report-stat"><span>Cash position</span><strong>{money(totals.cash)}</strong><small>After recorded movements</small></div></section><section className="panel report-note"><div className="getting-icon"><BarChart3 size={19} /></div><div><h2>Profit vs. loan money</h2><p>Loan entries stay separate from revenue, so your profit report reflects money the business actually earned.</p></div><ChevronRight size={18} /></section></>;
}

function ModalShell({ children, title, subtitle, onClose, wide = false }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="modal-close" onClick={onClose}><X size={19} /></button></div>{children}</div></div>; }

function TransactionModal({ form, setForm, businesses, people, currentUserId, currentUserName, editing, submitting, onAddBusiness, onClose, onSubmit }) {
  const entryTypes = [
    ['investment', 'Invest in business', 'Put wallet money to work'],
    ['spend', 'Business spend', 'Pay a business cost'],
    ['loan', 'Loan received', 'Add borrowed money'],
    ['withdrawal', 'Partner took money', 'Take from wallet'],
    ['loan_withdrawal', 'Take from loan', 'Use borrowed cash'],
    ['advance_spend', 'Spend taken money', 'Log where advance went'],
    ['partner_repayment', 'Repay partner wallet', 'Money comes back'],
    ['repayment', 'Repay loan', 'Reduce loan balance'],
    ['return', 'Business returned money', 'Money came back']
  ];
  const commonEntryTypes = ['investment', 'spend', 'loan', 'withdrawal', 'return'];
  const [showMoreTypes, setShowMoreTypes] = useState(Boolean(editing && !commonEntryTypes.includes(editing.entryType)));
  const tracksPerson = ['withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment'].includes(form.entryType);
  const setEntryType = (value) => setForm({ ...form, entryType: value, source: value === 'loan' || value === 'loan_withdrawal' ? 'loan' : value === 'advance_spend' ? 'partner_advance' : value === 'partner_repayment' ? 'partner' : value === 'investment' ? 'wallet' : form.source, allocationType: ['investment', 'spend', 'loan', 'loan_withdrawal'].includes(value) ? form.allocationType || 'common' : 'common', allocationUserId: ['investment', 'spend', 'loan', 'loan_withdrawal'].includes(value) ? form.allocationUserId || '' : '', takenById: ['withdrawal', 'loan_withdrawal', 'advance_spend', 'partner_repayment'].includes(value) ? form.takenById || currentUserId : form.takenById });
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="movement-dialog" onMouseDown={(event) => event.stopPropagation()}><header className="movement-header"><div className="movement-brand"><span className="movement-brand-icon">₹</span><div><span className="movement-kicker">BWallet · partner wallet</span><h2>{editing ? 'Edit transaction' : 'Add a transaction'}</h2></div></div><button className="movement-close" onClick={onClose} aria-label="Close"><X size={20} /></button></header><p className="movement-subtitle">Tell BWallet what happened to your shared money.</p><form onSubmit={onSubmit}><section className="movement-section"><div className="movement-section-title"><span>01</span><div><b>Choose a transaction</b><small>What happened?</small></div></div><div className="movement-types">{entryTypes.filter(([value]) => showMoreTypes || commonEntryTypes.includes(value)).map(([value, label, description]) => <button type="button" key={value} className={form.entryType === value ? 'selected' : ''} onClick={() => setEntryType(value)}><span className="movement-type-mark">{value === 'loan' || value === 'loan_withdrawal' ? 'L' : value === 'return' || value === 'partner_repayment' ? '↩' : value === 'spend' || value === 'advance_spend' ? '−' : '↗'}</span><span><b>{label}</b><small>{description}</small></span></button>)}</div>{<button type="button" className="movement-more" onClick={() => setShowMoreTypes((current) => !current)}>{showMoreTypes ? 'Show common transactions' : 'More transaction types'} <ChevronDown size={14} /></button>}</section><section className="movement-section"><div className="movement-section-title"><span>02</span><div><b>Add the details</b><small>Give your partners enough context</small></div></div><div className="movement-fields"><label className="movement-amount-field">Amount<div className="movement-amount"><span>₹</span><input autoFocus required type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div></label><label>Business <em>Optional for wallet or loan-only entries</em><select value={form.businessId} onChange={(e) => e.target.value === '__new_business__' ? onAddBusiness() : setForm({ ...form, businessId: e.target.value })}><option value="">Partner wallet / no business</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}<option value="__new_business__">＋ Add new business</option></select></label>{['investment', 'spend', 'loan', 'loan_withdrawal'].includes(form.entryType) && <label className="movement-full">Whose money is this? <em>Choose the wallet this belongs to</em><div className="allocation-options"><button type="button" className={form.allocationType === 'common' ? 'selected' : ''} onClick={() => setForm({ ...form, allocationType: 'common', allocationUserId: '' })}><b>Shared wallet</b><small>Common partnership money</small></button><button type="button" className={form.allocationType === 'individual' ? 'selected' : ''} onClick={() => setForm({ ...form, allocationType: 'individual', allocationUserId: form.allocationUserId || currentUserId })}><b>Individual wallet</b><small>One partner&apos;s money</small></button></div></label>}{['investment', 'spend', 'loan', 'loan_withdrawal'].includes(form.entryType) && form.allocationType === 'individual' && <label className="movement-full">Wallet owner <em>Select the partner whose wallet pays or receives this</em><select required value={form.allocationUserId || currentUserId} onChange={(e) => setForm({ ...form, allocationUserId: e.target.value })}>{people.length ? people.map((person) => <option key={person.id} value={person.id}>{person.name}{String(person.id) === String(currentUserId) ? ' (me)' : ''}</option>) : <option value={currentUserId}>{currentUserName} (me)</option>}</select></label>}<label className="movement-full">Description<input required placeholder="e.g. First stock purchase" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>{tracksPerson && <label>Partner involved <em>{form.entryType === 'partner_repayment' ? 'Who is repaying?' : 'Who received or spent the money?'}</em><select required value={form.takenById || currentUserId} onChange={(e) => setForm({ ...form, takenById: e.target.value })}>{people.length ? people.map((person) => <option key={person.id} value={person.id}>{person.name}{String(person.id) === String(currentUserId) ? ' (me)' : ''}</option>) : <option value={currentUserId}>{currentUserName} (me)</option>}</select></label>}<label>Source of money<select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value, entryType: form.entryType === 'withdrawal' && e.target.value === 'loan' ? 'loan_withdrawal' : form.entryType === 'loan_withdrawal' && e.target.value !== 'loan' ? 'withdrawal' : form.entryType })}><option value="wallet">Partner wallet</option><option value="loan">Loan money</option><option value="profit">Business profit</option><option value="partner">Partner funds</option><option value="partner_advance">Previously taken money</option></select></label><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Business investment</option><option>Business spend</option><option>Loan received</option><option>Loan repayment</option><option>Partner withdrawal</option><option>Advance spent</option><option>Partner repayment</option><option>Money returned</option></select></label></div><p className="movement-note"><ShieldCheck size={15} /><span>For money taken by a partner: record who received it, what it was used for, and when it was repaid.</span></p></section><footer className="movement-footer"><button type="button" className="movement-cancel" disabled={submitting} onClick={onClose}>Cancel</button><button className="primary-button movement-submit" disabled={submitting} type="submit">{submitting ? 'Saving...' : editing ? 'Save transaction' : 'Add transaction'}</button></footer></form></div></div>;
}

function PartnerLedgerModal({ partner, transactions, onClose }) {
  const ledger = transactions.filter((item) => item.takenById === partner.id || (item.userId === partner.id && item.allocationType === 'individual' && item.allocationUserId === partner.id));
  const taken = ledger.filter((item) => ['withdrawal', 'loan_withdrawal'].includes(item.entryType)).reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const repaid = ledger.filter((item) => item.entryType === 'partner_repayment').reduce((sum, item) => sum + item.amount, 0);
  return <ModalShell title={`${partner.name}'s ledger`} subtitle="Money taken, spent, and repaid by this partner." onClose={onClose} wide><div className="ledger-summary"><div><span>Taken</span><strong>{money(taken)}</strong></div><div><span>Repaid</span><strong>{money(repaid)}</strong></div><div><span>Outstanding</span><strong className={partner.balance < 0 ? 'negative' : ''}>{money(Math.abs(partner.balance))}</strong></div></div><div className="ledger-entries">{ledger.length ? ledger.map((item) => <TransactionRow item={item} key={item.id} />) : <EmptyState icon={Receipt} title="No ledger entries" copy="This partner has no recorded movements yet." />}</div></ModalShell>;
}

function HistoryModal({ transaction, onClose }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setError('');
    fetch(`/api/transactions/${transaction.id}`, { cache: 'no-store' })
      .then((response) => readApiResponse(response, 'Could not load entry history.'))
      .then((result) => { if (!cancelled) setHistory(result.history || []); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || 'Could not load entry history.'); });
    return () => { cancelled = true; };
  }, [transaction.id, attempt]);
  return <ModalShell title="Entry history" subtitle={transaction.name} onClose={onClose}><div className="audit-list">{history === null && !error ? <LoadingState copy="Loading history..." /> : error ? <div className="inline-failure"><span>{error}</span><button className="text-button" onClick={() => setAttempt((current) => current + 1)}>Try again</button></div> : history.length ? history.map((item) => <div className="audit-row" key={item.id}><span className="audit-dot" /><div><b>{item.action === 'created' ? 'Entry created' : 'Entry edited'}</b><span>{item.userName} · {item.createdAt}</span></div></div>) : <p className="history-loading">No history available.</p>}</div></ModalShell>;
}

function InviteModal({ user, onClose, notify }) {
  const [copying, setCopying] = useState(false);
  const copyCode = async () => {
    const code = user.inviteCode || '';
    setCopying(true);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
      else {
        const input = document.createElement('textarea');
        input.value = code;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      notify('Invite code copied');
    } catch {
      notify('Could not copy invite code');
    } finally {
      setCopying(false);
    }
  };
  return <ModalShell title="Invite a partner" subtitle="Share this code with a partner so they can join the partnership hub." onClose={onClose}><div className="invite-code"><span>Partnership invite code</span><strong>{user.inviteCode || 'Unavailable'}</strong><button type="button" disabled={copying || !user.inviteCode} onClick={copyCode}><Copy size={15} /> {copying ? 'Copying...' : 'Copy code'}</button></div><p className="form-hint"><ShieldCheck size={14} /><span>Partners can choose <b>Join</b> on the sign-in screen and enter this code. Only partnership members can access your business data.</span></p></ModalShell>;
}

function ProfileModal({ user, onClose, notify, openAuth, onSignedOut }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const logout = async () => {
    setLoggingOut(true);
    setError('');
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      await readApiResponse(response, 'Could not sign out.');
      onClose();
      onSignedOut();
    } catch (requestError) {
      setError(requestError.message || 'Could not sign out.');
      notify(requestError.message || 'Could not sign out');
    } finally {
      setLoggingOut(false);
    }
  };
  const initials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <ModalShell title="Your account" subtitle={`${user.name} · ${displayRole(user.role)}`} onClose={onClose}><div className="profile-card"><Avatar initials={initials} color="blue" /><div><b>{user.name}</b><span>{user.email}</span></div><span className="verified">Verified</span></div>{error && <p className="form-error">{error}</p>}<button className="account-action" disabled={loggingOut} onClick={openAuth}><Users size={17} /> Switch or join partnership hub <ChevronRight size={16} /></button><button className="logout-button" disabled={loggingOut} onClick={logout}><LogOut size={16} /> {loggingOut ? 'Signing out...' : 'Sign out'}</button></ModalShell>;
}

function AuthScreen({ onAuthenticated }) {
  const [accessMode, setAccessMode] = useState('login');
  const openAccess = (mode) => (event) => {
    event.preventDefault();
    setAccessMode(mode);
    const access = document.getElementById('access');
    if (access) window.scrollTo({ top: Math.max(0, access.getBoundingClientRect().top + window.scrollY - 122), behavior: 'smooth' });
  };
  return <div className="auth-page landing-page">
    <header className="landing-nav"><Logo /><nav><a href="#features">Why BWallet</a><a href="#how-it-works">How it works</a><a href="#faq">FAQ</a><a href="#contact">Contact</a><a className="landing-nav-cta" href="#access" onClick={openAccess('signup')}>Get started <ArrowUpRight size={14} /></a></nav></header>
    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy"><p className="eyebrow">Partnership finance, clarified</p><h1>Keep your business money in common.</h1><p>Contributions, shared costs, partner draws and loans — tracked together, without spreadsheets.</p><div className="landing-actions"><a className="landing-cta" href="#access" onClick={openAccess('signup')}>Start your partnership hub <ArrowUpRight size={15} /></a><span>No spreadsheets. No awkward math.</span></div><div className="landing-proof"><ShieldCheck size={17} /><span><b>Private partnership hub access</b><small>Every partner sees the same clear ledger.</small></span></div></div>
        <div id="access" className="auth-card landing-access"><div className="auth-card-head"><h2>Welcome to BWallet</h2><p>Sign in or create your partnership hub.</p></div><AuthFields key={accessMode} initialMode={accessMode} onAuthenticated={onAuthenticated} /></div>
      </section>
      <section className="landing-section" id="features"><div className="landing-section-intro"><p className="eyebrow">One source of truth</p><h2>Make shared money easier to understand.</h2><p>BWallet gives partners a simple place to record every contribution, cost, draw, and return.</p></div><div className="landing-feature-grid"><article><span className="landing-feature-icon"><Wallet size={19} /></span><h3>Partner wallets</h3><p>See who put money in, who took money out, and what is still owed.</p></article><article><span className="landing-feature-icon"><Building2 size={19} /></span><h3>Business portfolio</h3><p>Keep investments and expenses separated across every business you run.</p></article><article><span className="landing-feature-icon"><Landmark size={19} /></span><h3>Loans stay clear</h3><p>Keep borrowed money separate from business profit and everyday spending.</p></article></div></section>
      <section className="landing-section landing-detail"><div className="landing-section-intro"><p className="eyebrow">Designed for the real work</p><h2>Less explaining. More knowing.</h2><p>When money moves, everyone gets the same context — not another message buried in a group chat.</p></div><div className="landing-detail-list"><article><span>01</span><div><h3>Know where money went</h3><p>Attach every movement to a business, category, partner, and source.</p></div><Receipt size={20} /></article><article><span>02</span><div><h3>Keep partner balances visible</h3><p>Contributions, withdrawals, advances, and repayments stay easy to follow.</p></div><Users size={20} /></article><article><span>03</span><div><h3>Make decisions from one view</h3><p>Use cash flow, returns, spend, and loan totals to plan the next move.</p></div><BarChart3 size={20} /></article><article><span>04</span><div><h3>Keep a history of changes</h3><p>Edits stay recorded, so your team can trust the ledger over time.</p></div><History size={20} /></article></div></section>
      <section className="landing-usecases"><p className="eyebrow">Made for partnerships</p><div><span>CO-FOUNDERS</span><i>✳</i><span>FAMILY BUSINESSES</span><i>✳</i><span>SMALL TEAMS</span><i>✳</i><span>SIDE VENTURES</span></div></section>
      <section className="landing-section landing-process" id="how-it-works"><div className="landing-section-intro"><p className="eyebrow">How it works</p><h2>From scattered updates to shared clarity.</h2><p>Start with the money you already move. BWallet turns each update into a shared record your partners can understand.</p></div><div className="landing-steps"><div><b>01</b><h3>Create a partnership hub</h3><p>Set up one private space for your partnership.</p><small>Hub name · Owner access</small></div><div><b>02</b><h3>Invite your partners</h3><p>Share your partnership code and get everyone aligned.</p><small>One code · Every partner</small></div><div><b>03</b><h3>Record every movement</h3><p>Track investments, spending, withdrawals, loans, and returns.</p><small>Clear entries · Shared history</small></div></div></section>
      <section className="landing-section landing-faq" id="faq"><div className="landing-section-intro"><p className="eyebrow">Good to know</p><h2>Questions partners usually ask.</h2><p>Clear expectations before you start keeping your money in one place.</p></div><div className="landing-faq-list"><details open><summary>Is BWallet a replacement for accounting software?</summary><p>No. BWallet is a simple shared operating ledger for partners. It helps your team understand money movement; accountants can still use dedicated tax and compliance software.</p></details><details><summary>How do partners join a partnership hub?</summary><p>The hub owner shares an invite code. A partner chooses Join, enters the code, and gets access to the same private hub.</p></details><details><summary>Can we track more than one business?</summary><p>Yes. Add each business to the partnership hub and connect investments, spending, and returns to the right business.</p></details><details><summary>Are loans counted as business profit?</summary><p>No. Loan entries stay separate, so borrowed money does not get mixed into your operating returns.</p></details></div></section>
      <section className="landing-cta"><div><p className="eyebrow">A clearer partnership starts here</p><h2>Keep every money decision in the open.</h2><p>Start with your first partnership hub and build a ledger your whole team can trust.</p></div><a className="landing-cta light" href="#access" onClick={openAccess('signup')}>Create partnership hub <ArrowUpRight size={15} /></a></section>
      <section className="landing-section landing-contact" id="contact"><div><p className="eyebrow">Contact us</p><h2>Have a question about shared business money?</h2><p>Tell us what you are building, and we will help you find a clearer way to manage it.</p></div><div className="landing-contact-action"><span>Say hello</span><a href="mailto:hello@bwallet.app">hello@bwallet.app <ArrowUpRight size={18} /></a><small>Product questions, feedback, or help getting your partners started.</small><a className="landing-contact-secondary" href="#access" onClick={openAccess('login')}>Already have an account? Sign in <ArrowUpRight size={14} /></a></div></section>
    </main>
    <footer className="landing-footer"><Logo /><span>Partnership finances, clarified.</span><div className="landing-footer-links"><a href="#contact">Contact</a><a href="#access" onClick={openAccess('login')}>Sign in</a></div><small>© 2026 BWallet. All rights reserved.</small></footer>
  </div>;
}

function AuthFields({ onAuthenticated, notify = () => {}, close = () => {}, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '', organization: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mode, ...form }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.requiresEmailConfirmation) {
        setNotice(result.message);
        return;
      }
      const sessionResponse = await fetch('/api/auth', { cache: 'no-store' });
      const session = await readApiResponse(sessionResponse, 'Could not establish your session.');
      if (!session.user) throw new Error('Could not establish your session.');
      onAuthenticated(session.user);
      close();
      notify(mode === 'login' ? 'Signed in securely' : mode === 'join' ? 'Joined partnership hub' : 'Partnership hub created');
    } catch (requestError) { setError(requestError.message || 'Could not sign in'); } finally { setSubmitting(false); }
  };
  return <><div className="auth-tabs"><button type="button" disabled={submitting} className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>Sign in</button><button type="button" disabled={submitting} className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')}>New partnership hub</button><button type="button" disabled={submitting} className={mode === 'join' ? 'selected' : ''} onClick={() => setMode('join')}>Join</button></div><form onSubmit={submit} autoComplete="on">{mode !== 'login' && <label>Your name<input required name="name" autoComplete="name" placeholder="Jordan Davis" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}{mode === 'signup' && <label>Partnership hub name<input required name="organization" placeholder="Northstar Studio" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></label>}{mode === 'join' && <label>Invite code<input required name="inviteCode" autoComplete="off" placeholder="NS-7K4P-21" value={form.inviteCode} onChange={(e) => setForm({ ...form, inviteCode: e.target.value })} /></label>}<label>Email<input required name="email" type="email" inputMode="email" autoComplete={mode === 'login' ? 'username' : 'email'} placeholder="you@business.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Password<div className="password-field"><input required name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" placeholder="8+ characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>{error && <p className="form-error">{error}</p>}{notice && <p className="form-success">{notice}</p>}<button className="primary-button modal-submit" disabled={submitting} type="submit">{submitting ? 'Working...' : mode === 'login' ? 'Sign in' : mode === 'join' ? 'Join partnership hub' : 'Create partnership hub'}</button></form><p className="modal-footnote"><ShieldCheck size={14} /> Encrypted sign-in for every partner.</p></>;
}

function AuthModal({ onClose, notify, onAuthenticated }) {
  return <ModalShell title="Partnership hub access" subtitle="Your business data stays private to your team." onClose={onClose}><AuthFields onAuthenticated={onAuthenticated} notify={notify} close={onClose} /></ModalShell>;
}
