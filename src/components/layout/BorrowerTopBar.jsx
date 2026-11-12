export default function BorrowerTopBar({ orgId }) {
  return (
    <header className="wf-topbar">
      <div className="wf-topbar-brand"><span className="wf-topbar-mark">B</span><strong>BorrowDesk</strong></div>
      <div className="wf-topbar-context"><strong>Borrower Organization #{orgId}</strong><span>Borrower operations</span></div>
      <div className="wf-topbar-search"><span>⌕</span><span>Search securities, loans, counterparties, agreements...</span><kbd>⌘ K</kbd></div>
      <div className="wf-topbar-actions"><span className="wf-demo-chip">DEMO DATA</span><span className="wf-topbar-bell" aria-label="Notifications">♧</span><span className="wf-topbar-avatar">BO</span></div>
    </header>
  );
}
