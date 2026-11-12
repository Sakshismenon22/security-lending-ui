export default function BorrowerSidebar({
  orgId, activeTab, setActiveTab, locateSubTab, setLocateSubTab,
  loanSubTab, setLoanSubTab, marginCalls, notifications,
  collapsed, setCollapsed,
}) {
  const openMarginCalls = marginCalls.filter((call) =>
    ["OPEN", "PARTIALLY_FULFILLED", "OVERDUE"].includes(String(call.status || "").toUpperCase())
  ).length;
  const unreadNotifications = notifications.filter((item) => !(item.isRead ?? item.read)).length;

  return (
    <aside className={`wf-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <button type="button" className="wf-sidebar-toggle" onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? "›" : "‹"}
      </button>
      <div className="wf-brand"><span className="wf-brand-mark">B</span><span className="wf-brand-copy"><strong>BorrowDesk</strong><small>SECURITIES FINANCE</small></span></div>
      <div className="wf-sidebar-label">WORKSPACE</div>
      <nav className="wf-side-nav" aria-label="Borrower navigation">
        <div className="wf-nav-group-label">WORKSPACE</div>
        <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")} title="Dashboard"><span className="wf-nav-icon">⌂</span><span>Borrowing blotter</span></button>
        <div className="wf-nav-group-label">MARKETS & PORTFOLIO</div>
        <button className={activeTab === "trading" ? "active" : ""} onClick={() => setActiveTab("trading")} title="Trading"><span className="wf-nav-icon">▥</span><span>Trading</span></button>
        <button className={activeTab === "holdings" ? "active" : ""} onClick={() => setActiveTab("holdings")} title="My Holdings"><span className="wf-nav-icon">▦</span><span>My Holdings</span></button>
        <div className="wf-nav-group-label">SECURITIES FINANCE</div>
        <button className={activeTab === "msla" ? "active" : ""} onClick={() => setActiveTab("msla")} title="Agreements"><span className="wf-nav-icon">▤</span><span>Agreements</span></button>
        <button className={activeTab === "locates" && locateSubTab !== "reservations" ? "active" : ""} onClick={() => { setActiveTab("locates"); setLocateSubTab("register"); }} title="Borrow / Locate"><span className="wf-nav-icon">⇄</span><span>Locate requests</span></button>
        <button className={activeTab === "locates" && locateSubTab === "reservations" ? "active" : ""} onClick={() => { setActiveTab("locates"); setLocateSubTab("reservations"); }} title="Reservations"><span className="wf-nav-icon">▤</span><span>Reservations</span></button>
        <button className={activeTab === "loans" && loanSubTab !== "margin" ? "active" : ""} onClick={() => { setActiveTab("loans"); setLoanSubTab("register"); }} title="Loans"><span className="wf-nav-icon">▣</span><span>Active loans</span></button>
        <button className={activeTab === "loans" && loanSubTab === "margin" ? "active" : ""} onClick={() => { setActiveTab("loans"); setLoanSubTab("margin"); }} title="Margin calls"><span className="wf-nav-icon">◈</span><span>Margin calls <em className="wf-nav-count">{openMarginCalls}</em></span></button>
        <button className={activeTab === "collateral" ? "active" : ""} onClick={() => setActiveTab("collateral")} title="Collateral"><span className="wf-nav-icon">⬡</span><span>Collateral</span></button>
        <button className={activeTab === "recalls" ? "active" : ""} onClick={() => setActiveTab("recalls")} title="Recall Management"><span className="wf-nav-icon">↩</span><span>Returns & recalls</span></button>
        <button className={activeTab === "settlements" ? "active" : ""} onClick={() => setActiveTab("settlements")} title="Settlements & Returns"><span className="wf-nav-icon">⇥</span><span>Settlements</span></button>
        <div className="wf-nav-group-label">OPERATIONS & FINANCE</div>
        <button className={activeTab === "billing" ? "active" : ""} onClick={() => setActiveTab("billing")} title="Billing & Statements"><span className="wf-nav-icon">₹</span><span>Fees & rebates</span></button>
        <button className={activeTab === "notifications" ? "active" : ""} onClick={() => setActiveTab("notifications")} title="Notifications & Alerts"><span className="wf-nav-icon">♢</span><span>Notifications <em className="wf-nav-count">{unreadNotifications}</em></span></button>
      </nav>
      <div className="wf-sidebar-bottom"><div className="wf-sidebar-org-icon">▥</div><div><strong>Borrower Organization</strong><small>Organization #{orgId}</small></div></div>
    </aside>
  );
}
