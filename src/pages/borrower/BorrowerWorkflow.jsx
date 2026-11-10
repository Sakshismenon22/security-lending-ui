import { useEffect, useMemo, useState } from "react";
import { getData, getMarketData, postData, putData } from "../../api/borrowerApi";
import "./BorrowerWorkflow.css";

const ORG_ID = "";

const tabs = [

  { id: "msla", label: "MSLA Management", number: "01" },
  { id: "locates", label: "Locate Requests", number: "02" },
  { id: "reservations", label: "Reservations", number: "03" },
  { id: "loans", label: "Loan Creation", number: "04" },
];
 
const emptyAgreement = {
  lenderId: "",
  number: "",
  effectiveDate: "",
  expiryDate: "",
  creditLimit: "",
  feeRate: "",
  rebateRate: "",
  coverageRatio: "1.05",
  billingFrequency: "MONTHLY",
  dayBasis: "360",
  recallAllowed: true,
  marginHours: "24",
  recallHours: "24",
  collateralRules: [
    { assetType: "CASH", securityId: null, haircut: "0" },
  ],
};
 
const emptyLocate = {
  agreementId: "",
  securityId: "",
  quantity: "",
  expiresAt: "",
};
 
const emptyLoan = {
  reservationId: "",
  quantity: "",
  assetType: "CASH",
  securityId: "",
  collateralQuantity: "0",
  cashAmount: "",
};
 
function rowsOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}
 
function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}
 
function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}
 
function Field({ label, children, hint }) {
  return (
    <label className="wf-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
 
function DataTable({ columns, rows, empty = "No records found" }) {
  return (
    <div className="wf-table-wrap">
      <table className="wf-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id ?? row.locateId ?? row.reservationId ?? index}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="wf-empty">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
 
export default function BorrowerWorkflow() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loanSubTab, setLoanSubTab] = useState("create");
  const [orgId, setOrgId] = useState(ORG_ID);
  const [agreements, setAgreements] = useState([]);
  const [selectedAgreementId, setSelectedAgreementId] = useState(null);
  const [detailView, setDetailView] = useState(null);
  const [locates, setLocates] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loans, setLoans] = useState([]);
  const [marginCalls, setMarginCalls] = useState([]);
  const [rebates, setRebates] = useState([]);
  const [collateralPositions, setCollateralPositions] = useState([]);
  const [pledgingCallId, setPledgingCallId] = useState(null);
  const [lenders, setLenders] = useState([]);
  const [securities, setSecurities] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [addingSecurityId, setAddingSecurityId] = useState(null);
  const [selectedTradeSecurity, setSelectedTradeSecurity] = useState(null);
  const [securityHistory, setSecurityHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tradeSide, setTradeSide] = useState("BUY");
  const [tradeQuantity, setTradeQuantity] = useState("");
  const [tradeOrderType, setTradeOrderType] = useState("MARKET");
  const [tradeLimitPrice, setTradeLimitPrice] = useState("");
  const [tradeSource, setTradeSource] = useState("OWNED");
  const [account, setAccount] = useState(null);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
 
  const [agreementForm, setAgreementForm] = useState(emptyAgreement);
  const [isCreatingAgreement, setIsCreatingAgreement] = useState(false);
  const [locateForm, setLocateForm] = useState(emptyLocate);
  const [loanForm, setLoanForm] = useState(emptyLoan);
 
  const [securitySearch, setSecuritySearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const base = `/organizations/${orgId}`;
 
  const approvedLocates = useMemo(
    () => locates.filter((x) =>
      ["APPROVED", "PARTIALLY_APPROVED"].includes(
        String(x.status || "").toUpperCase()
      )
    ),
    [locates]
  );
 
  const confirmedReservations = useMemo(
    () => reservations.filter((x) =>
      ["CONFIRMED", "APPROVED", "RESERVED"].includes(
        String(x.status || "").toUpperCase()
      )
    ),
    [reservations]
  );
 
  async function loadAll() {
    if (!orgId) return;
    setLoading(true);
    try {
      const requests = [
        { key: "agreements", call: getData(`${base}/agreements`) },
        { key: "locates", call: getData(`${base}/locates`) },
        { key: "reservations", call: getData(`${base}/reservations`) },
        { key: "loans", call: getData(`${base}/loans`) },
        { key: "marginCalls", call: getData(`${base}/margin-calls`) },
        { key: "rebates", call: getData(`${base}/rebates`) },
        { key: "collateralPositions", call: getData(`${base}/collateral`) },
        { key: "lenders", call: getData(`${base}/lenders`) },
        { key: "securities", call: getData("/securities") },
        { key: "watchlist", call: getData(`${base}/watchlist`) },
        { key: "holdings", call: getData(`${base}/holdings`) },
        { key: "account", call: getData(`${base}/account`) },
      ];

      const results = await Promise.allSettled(requests.map((request) => request.call));
      const nextState = {
        agreements: [],
        locates: [],
        reservations: [],
        loans: [],
        marginCalls: [],
        rebates: [],
        collateralPositions: [],
        lenders: [],
        securities: [],
        watchlist: [],
        holdings: [],
      };

      results.forEach((result, index) => {
        const key = requests[index].key;
        if (result.status === "fulfilled") {
          nextState[key] = key === "account" ? result.value : rowsOf(result.value);
        } else {
          console.warn(`Unable to load ${key}:`, result.reason);
        }
      });

      nextState.locates = nextState.locates.map((locate) => ({
        ...locate,
        agreementId: locate.agreementId ?? locate.mslaId ?? locate.msla_id ?? null,
      }));
      nextState.reservations = nextState.reservations.map((reservation) => ({
        ...reservation,
        locateId: reservation.locateId ?? reservation.locate_id ?? reservation.locateRequestId ?? null,
        requestedQuantity: reservation.requestedQuantity ?? reservation.quantity ?? null,
      }));

      setAgreements(nextState.agreements);
      setLocates(nextState.locates);
      setReservations(nextState.reservations);
      setLoans(nextState.loans);
      setMarginCalls(nextState.marginCalls);
      setRebates(nextState.rebates);
      setCollateralPositions(nextState.collateralPositions);
      setLenders(nextState.lenders);
      setSecurities(nextState.securities);
      setWatchlist(nextState.watchlist);
      setHoldings(nextState.holdings);
      setAccount(nextState.account && typeof nextState.account === "object"
        ? (nextState.account.account ?? nextState.account)
        : null);
      if (!nextState.account) {
        showNotice("error", "Unable to load the account balance. Check GET /api/v1/organizations/" + orgId + "/account in borrower-service.");
      }
    } catch (error) {
      showNotice("error", error.response?.data?.detail ||
        error.response?.data?.message || "Unable to load borrower data.");
    } finally {
      setLoading(false);
    }
  }
 
  useEffect(() => {
    loadAll();
  }, [orgId]);

  const selectedAgreement = useMemo(
    () => agreements.find(
      (agreement) => String(agreement.id) === String(selectedAgreementId)
    ) ?? agreements[0] ?? null,
    [agreements, selectedAgreementId]
  );

  const agreementRows = useMemo(
    () =>
      Array.isArray(agreements)
        ? agreements.map((agreement) => ({
            ...agreement,
            lenderName:
              lenders.find((l) => String(l.id) === String(agreement.lenderId))?.name ??
              `Lender ${agreement.lenderId ?? "—"}`,
            displayNumber: agreement.number || `MSLA-${agreement.id}`,
            displayCreditLimit: money(agreement.creditLimit),
            displayExpiry: formatDate(agreement.expiryDate),
          }))
        : [],
    [agreements, lenders]
  );

  const selectedAgreementLoans = useMemo(() => {
    if (!selectedAgreement) return [];

    return loans.filter((loan) => {
      const mslaId = loan.mslaId ?? loan.agreementId ?? loan.msla_id;
      return String(mslaId) === String(selectedAgreement.id);
    });
  }, [loans, selectedAgreement]);
 
  function isInWatchlist(security) {
    return watchlist.some((item) =>
      String(item.securityId ?? item.security?.id ?? item.id) === String(security.id)
    );
  }

  async function addToWatchlist(security) {
    if (!security?.id || isInWatchlist(security)) return;
    setAddingSecurityId(security.id);
    try {
      await putData(`${base}/watchlist/${security.id}`);
      const updated = await getData(`${base}/watchlist`);
      setWatchlist(rowsOf(updated));
      showNotice("success", `${security.symbol ?? security.name ?? "Security"} added to your watchlist.`);
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Unable to add security to watchlist.");
    } finally {
      setAddingSecurityId(null);
    }
  }

  async function selectTradeSecurity(security) {
    setSelectedTradeSecurity(security);
    setSecurityHistory([]);
    setHistoryLoading(true);
    try {
      // Refresh obtains the latest completed one-minute close from market-data-service
      // and stores the authoritative quote in the borrower's security master.
      const refreshed = await postData(`/securities/${security.id}/refresh`, {});
      const detail = await getData(`/securities/${security.id}`);
      setSelectedTradeSecurity({ ...security, ...(refreshed || {}), ...(detail || {}) });
      const history = await getMarketData("/api/v1/security-data/history", {
        symbol: security.symbol ?? security.ticker,
        exchange: security.exchange,
      });
      setSecurityHistory(rowsOf(history));
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Unable to load current price or candlestick history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  const tradeCandles = securityHistory.map((point) => ({
    date: point.tradedDateTimestamp ?? point.date ?? point.timestamp ?? point.tradingDate ?? point.time,
    open: Number(point.open ?? point.openPrice ?? 0),
    high: Number(point.high ?? point.highPrice ?? 0),
    low: Number(point.low ?? point.lowPrice ?? 0),
    close: Number(point.close ?? point.closePrice ?? 0),
  })).filter((point) => point.open > 0 && point.high > 0 && point.low > 0 && point.close > 0);

  const currentTradePrice = Number(selectedTradeSecurity?.price ?? selectedTradeSecurity?.close ?? 0);
  const estimatedOrderTotal = currentTradePrice * Number(tradeQuantity || 0);

  async function submitTrade(e) {
    e.preventDefault();
    if (!selectedTradeSecurity || !currentTradePrice || Number(tradeQuantity) <= 0) return;
    setOrderSubmitting(true);
    try {
      const payload = {
        securityId: Number(selectedTradeSecurity.id),
        side: tradeSide,
        type: tradeOrderType,
        source: tradeSource,
        quantity: Number(tradeQuantity),
        ...(tradeOrderType === "LIMIT" ? { limitPrice: Number(tradeLimitPrice) } : {}),
      };
      const order = await postData(`${base}/orders`, payload);
      const [refreshedAccount, refreshedHoldings] = await Promise.all([
        getData(`${base}/account`),
        getData(`${base}/holdings`),
      ]);
      setAccount(refreshedAccount && typeof refreshedAccount === "object"
        ? (refreshedAccount.account ?? refreshedAccount)
        : null);
      setHoldings(rowsOf(refreshedHoldings));
      const status = String(order?.status ?? "").toUpperCase();
      if (status === "FILLED") {
        showNotice("success", `${tradeSide} order filled at ${money(order.averagePrice ?? order.executionPrice ?? currentTradePrice)}. Available balance refreshed.`);
      } else {
        showNotice("success", `Order #${order?.id ?? "submitted"} submitted. Status: ${order?.status ?? "PENDING"}. Balance reflects backend processing.`);
      }
      setTradeQuantity("");
      setTradeLimitPrice("");
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Order could not be submitted.");
    } finally {
      setOrderSubmitting(false);
    }
  }

  function showNotice(type, message) {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 4500);
  }
 
  function updateAgreement(key, value) {
    setAgreementForm((old) => ({ ...old, [key]: value }));
  }
 
  function updateRule(index, key, value) {
    setAgreementForm((old) => ({
      ...old,
      collateralRules: old.collateralRules.map((rule, i) =>
        i === index ? {
          ...rule,
          [key]: key === "securityId" ? (value ? Number(value) : null) : value,
        } : rule
      ),
    }));
  }
 
  function addRule() {
    setAgreementForm((old) => ({
      ...old,
      collateralRules: [
        ...old.collateralRules,
        { assetType: "CASH", securityId: null, haircut: "0" },
      ],
    }));
  }
 
  function removeRule(index) {
    setAgreementForm((old) => ({
      ...old,
      collateralRules: old.collateralRules.filter((_, i) => i !== index),
    }));
  }
 
  async function submitAgreement(e) {
    e.preventDefault();
    const payload = {
      ...agreementForm,
      lenderId: Number(agreementForm.lenderId),
      creditLimit: Number(agreementForm.creditLimit),
      feeRate: Number(agreementForm.feeRate),
      rebateRate: Number(agreementForm.rebateRate),
      coverageRatio: Number(agreementForm.coverageRatio),
      dayBasis: Number(agreementForm.dayBasis),
      marginHours: Number(agreementForm.marginHours),
      recallHours: Number(agreementForm.recallHours),
      collateralRules: agreementForm.collateralRules.map((r) => ({
        assetType: r.assetType,
        securityId: r.assetType === "SECURITY" ? Number(r.securityId) : null,
        haircut: Number(r.haircut),
      })),
    };
 
    try {
      await postData(`${base}/agreements`, payload);
      showNotice("success", "MSLA proposal submitted successfully.");
      setAgreementForm(emptyAgreement);
      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail ||
        error.response?.data?.message || "MSLA submission failed.");
    }
  }
 
  async function submitLocate(e) {
    e.preventDefault();
    const payload = {
      agreementId: Number(locateForm.agreementId),
      securityId: Number(locateForm.securityId),
      quantity: Number(locateForm.quantity),
      expiresAt: new Date(locateForm.expiresAt).toISOString(),
    };
 
    try {
      await postData(`${base}/locates`, payload);
      showNotice("success", "Locate request submitted.");
      setLocateForm(emptyLocate);
      await loadAll();
    } catch (error) {      showNotice("error", error.response?.data?.detail ||
        error.response?.data?.message || "Locate request failed.");
    }
  }
 
  async function reserveLocate(locate) {
    const quantity = Number(window.prompt(
      `Enter reservation quantity (requested: ${locate.quantity})`,
      locate.quantity
    ));
    if (!quantity || quantity <= 0) return;
 
    try {
      await postData(
        `${base}/locates/${locate.id}/reserve`,
        { quantity }
      );
      showNotice("success", "Reservation request submitted.");
      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail ||
        error.response?.data?.message || "Reservation request failed.");
    }
  }
 
  async function respondToMarginCall(e, call) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const assetType = String(form.get("assetType") || "CASH").toUpperCase();
    const payload = {
      assetType,
      securityId: assetType === "SECURITY" && form.get("securityId") ? Number(form.get("securityId")) : null,
      quantity: assetType === "SECURITY" ? Number(form.get("quantity") || 0) : 0,
      cashAmount: assetType === "CASH" ? Number(form.get("cashAmount") || 0) : 0,
      marginCallId: call.id,
    };
    if ((assetType === "CASH" && payload.cashAmount <= 0) ||        (assetType === "SECURITY" && (!payload.securityId || payload.quantity <= 0))) {      showNotice("error", "Enter a valid cash amount or security and quantity.");      return;    }
    setPledgingCallId(call.id);
    try {
      await postData(`${base}/margin-calls/${call.id}/collateral`, payload);
      showNotice("success", `Collateral response submitted for margin call #${call.id}.`);
      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Unable to submit collateral for this margin call.");
    } finally {
      setPledgingCallId(null);
    }
  }

  async function submitLoan(e) {
    e.preventDefault();
 
    const collateral = loanForm.assetType === "CASH"
      ? [{
          assetType: "CASH",
          securityId: null,
          quantity: 0,
          cashAmount: Number(loanForm.cashAmount),
        }]
      : [{
          assetType: "SECURITY",
          securityId: Number(loanForm.securityId),
          quantity: Number(loanForm.collateralQuantity),
          cashAmount: 0,
        }];
 
    const payload = {
      reservationId: Number(loanForm.reservationId),
      quantity: Number(loanForm.quantity),
      collateral,
    };
 
    try {
      await postData(`${base}/loans`, payload);
      showNotice("success", "Loan request submitted successfully.");
      setLoanForm(emptyLoan);
      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail ||
        error.response?.data?.message || "Loan request failed.");
    }
  }
 
  const filteredSecurities = securities.filter((s) =>
    `${s.symbol || ""} ${s.name || ""}`
      .toLowerCase().includes(securitySearch.toLowerCase())
  );
 
  if (!orgId) {
    return (
      <main className="wf-shell">
        <section className="wf-org-prompt">
          <div className="wf-eyebrow">BORROWER WORKSPACE</div>
          <h1>Connect your organization</h1>
          <p>Enter your existing Borrower organization ID to load its records.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (orgId.trim()) loadAll();
          }}>
            <Field label="Borrower organization ID">
              <input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="e.g. 1"
                required
              />
            </Field>
            <button className="wf-primary">Continue</button>
          </form>
        </section>
      </main>
    );
  }
 
  return (
    <main className="wf-shell">
      <header className="wf-header">
        <div>
          <div className="wf-eyebrow">SECURITIES LENDING / BORROWER</div>
          <h1>Borrower Operations</h1>
          <p>Manage agreements, locate requests, reservations and loans.</p>
        </div>
        <div className="wf-header-right">
          <span className="wf-org-chip">Organization #{orgId}</span>
          <button className="wf-secondary" onClick={loadAll}>
            ↻ Refresh
          </button>
        </div>
      </header>

      <div className="wf-workspace">
        <aside className="wf-sidebar">
          <div className="wf-brand"><span className="wf-brand-mark">M</span><span className="wf-brand-copy"><strong>MERIDIAN</strong><small>SECURITIES FINANCE</small></span></div>
          <div className="wf-sidebar-label">BORROWER WORKSPACE</div>
          <nav className="wf-side-nav" aria-label="Borrower navigation">
            <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}><span className="wf-nav-icon">⌂</span><span>Dashboard</span></button>
            <button className={activeTab === "trading" ? "active" : ""} onClick={() => setActiveTab("trading")}><span className="wf-nav-icon">▥</span><span>Trading</span></button>
            <button className={activeTab === "holdings" ? "active" : ""} onClick={() => setActiveTab("holdings")}><span className="wf-nav-icon">▦</span><span>My Holdings</span></button>
            <button className={activeTab === "securities" ? "active" : ""} onClick={() => setActiveTab("securities")}><span className="wf-nav-icon">⌕</span><span>Securities</span></button>
            <button className={activeTab === "locates" ? "active" : ""} onClick={() => setActiveTab("locates")}><span className="wf-nav-icon">⇄</span><span>Borrow</span></button>
            <button className={activeTab === "loans" ? "active" : ""} onClick={() => setActiveTab("loans")}><span className="wf-nav-icon">▣</span><span>Loans</span></button>
            <button className={activeTab === "msla" ? "active" : ""} onClick={() => setActiveTab("msla")}><span className="wf-nav-icon">▤</span><span>Agreements</span></button>
          </nav>
          <div className="wf-sidebar-bottom"><div className="wf-sidebar-org-icon">▥</div><div><strong>Borrower Organization</strong><small>Organization #{orgId}</small></div></div>
        </aside>
        <div className="wf-main-content">
      <section className="wf-metrics">
        <div className="wf-metric">
          <span>Active agreements</span>
          <strong>{agreements.length}</strong>
          <small>MSLA records</small>
        </div>
        <div className="wf-metric">
          <span>Locate requests</span>
          <strong>{locates.length}</strong>
          <small>All submitted requests</small>
        </div>
        <div className="wf-metric">
          <span>Reservations</span>
          <strong>{reservations.length}</strong>
          <small>All reservation records</small>
        </div>
        <div className="wf-metric">
          <span>Loan requests</span>
          <strong>{loans.length}</strong>
          <small>All loan records</small>
        </div>
      </section>
 
      {notice && (
        <div className={`wf-notice ${notice.type}`}>{notice.message}</div>
      )}
 
      {!loading && activeTab === "dashboard" && (
        <section className="wf-content wf-dashboard-view">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">OVERVIEW</div><h2>Borrower dashboard</h2><p>Monitor your securities lending activity and access key workflows.</p></div></div>
          <div className="wf-dashboard-grid">
            <button className="wf-dashboard-card" onClick={() => setActiveTab("trading")}><span>MARKETS</span><strong>Trading</strong><small>Open your watchlist, view charts and prepare orders</small><b>Open trading →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("securities")}><span>INSTRUMENT DIRECTORY</span><strong>Securities</strong><small>Browse instruments and add them to your watchlist</small><b>Browse securities →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("locates")}><span>SECURITIES FINANCE</span><strong>Borrow / Locate</strong><small>Submit locate requests to connected lenders</small><b>View requests →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("loans")}><span>OPERATIONS</span><strong>Loan requests</strong><small>Create and monitor securities borrowing loans</small><b>View loans →</b></button>
          </div>
          <div className="wf-panel"><div className="wf-panel-header"><h2>Recent activity</h2><button className="wf-secondary" onClick={loadAll}>Refresh data</button></div><div className="wf-summary-grid">
            <div className="wf-summary-tile"><span>Available cash</span><strong>{account ? money(account.available ?? account.availableCash ?? account.cashAvailable ?? 0) : "Unavailable"}</strong></div>
            <div className="wf-summary-tile"><span>Blocked cash</span><strong>{account ? money(account.blocked ?? account.blockedCash ?? 0) : "—"}</strong></div>
            <div className="wf-summary-tile"><span>Agreements</span><strong>{agreements.length}</strong></div>
            <div className="wf-summary-tile"><span>Locate requests</span><strong>{locates.length}</strong></div>
            <div className="wf-summary-tile"><span>Reservations</span><strong>{reservations.length}</strong></div>
            <div className="wf-summary-tile"><span>Loans</span><strong>{loans.length}</strong></div>
          </div></div></div></div>
        </section>
      )}

      {!loading && activeTab === "holdings" && (
        <section className="wf-content wf-holdings-view">
          <div className="wf-section-heading">
            <div>
              <div className="wf-eyebrow">PORTFOLIO / POSITIONS</div>
              <h2>My Holdings</h2>
              <p>Review owned securities, encumbrances and quantities currently available to sell.</p>
            </div>
            <button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh holdings</button>
          </div>
          <div className="wf-summary-grid wf-holdings-summary">
            <div className="wf-summary-tile"><span>Securities held</span><strong>{holdings.length}</strong></div>
            <div className="wf-summary-tile"><span>Total owned units</span><strong>{holdings.reduce((sum, row) => sum + Number(row.owned_quantity ?? row.ownedQuantity ?? 0), 0).toLocaleString("en-IN")}</strong></div>
            <div className="wf-summary-tile"><span>Available to sell</span><strong>{holdings.reduce((sum, row) => sum + Number(row.available_owned_quantity ?? row.availableOwnedQuantity ?? Math.max(0, Number(row.owned_quantity ?? row.ownedQuantity ?? 0) - Number(row.pledged_quantity ?? row.pledgedQuantity ?? 0) - Number(row.blocked_owned ?? row.blockedOwned ?? 0))), 0).toLocaleString("en-IN")}</strong></div>
            <div className="wf-summary-tile"><span>Portfolio market value</span><strong>{money(holdings.reduce((sum, row) => sum + Number(row.owned_quantity ?? row.ownedQuantity ?? 0) * Number(row.price ?? 0), 0))}</strong></div>
          </div>
          <section className="wf-panel wf-holdings-panel">
            <div className="wf-panel-header">
              <div><h2>Owned positions</h2><small>Sellable quantity excludes pledged and order-blocked units.</small></div>
              <span className="wf-status">{holdings.length} positions</span>
            </div>
            <div className="wf-table-wrap wf-holdings-table-wrap">
              <table className="wf-table">
                <thead><tr>
                  <th>Security</th><th>Owned</th><th>Pledged</th><th>Blocked</th>
                  <th>Available to sell</th><th>Average cost</th><th>Market price</th><th>Unrealized P&amp;L</th><th>Action</th>
                </tr></thead>
                <tbody>
                  {holdings.length ? holdings.map((holding) => {
                    const owned = Number(holding.owned_quantity ?? holding.ownedQuantity ?? 0);
                    const pledged = Number(holding.pledged_quantity ?? holding.pledgedQuantity ?? 0);
                    const blocked = Number(holding.blocked_owned ?? holding.blockedOwned ?? 0);
                    const available = Number(holding.available_owned_quantity ?? holding.availableOwnedQuantity ?? Math.max(0, owned - pledged - blocked));
                    const price = Number(holding.price ?? 0);
                    const averageCost = Number(holding.average_cost ?? holding.averageCost ?? 0);
                    const pnl = Number(holding.unrealized_pnl ?? holding.unrealizedPnl ?? ((price - averageCost) * owned));
                    const security = {
                      id: holding.security_id ?? holding.securityId ?? holding.id,
                      symbol: holding.symbol,
                      name: holding.name,
                      exchange: holding.exchange,
                      price: holding.price,
                    };
                    return <tr key={security.id}>
                      <td><strong>{holding.symbol ?? "—"}</strong><small className="wf-holding-name">{holding.name ?? "—"}</small></td>
                      <td>{owned.toLocaleString("en-IN")}</td>
                      <td>{pledged.toLocaleString("en-IN")}</td>
                      <td>{blocked.toLocaleString("en-IN")}</td>
                      <td><strong className="wf-holding-available">{available.toLocaleString("en-IN")}</strong></td>
                      <td>{money(averageCost)}</td>
                      <td>{price > 0 ? money(price) : "—"}</td>
                      <td className={pnl >= 0 ? "wf-pnl-positive" : "wf-pnl-negative"}>{money(pnl)}</td>
                      <td><button type="button" className="wf-small-button" disabled={available <= 0} onClick={() => {
                        setSelectedTradeSecurity(security);
                        setSecurityHistory([]);
                        setTradeSide("SELL");
                        setTradeSource("OWNED");
                        setTradeQuantity("");
                        setActiveTab("trading");
                      }}>Sell</button></td>
                    </tr>;
                  }) : <tr><td colSpan={9} className="wf-empty">No owned holdings found for this organization.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="wf-info">Only unpledged, unblocked owned securities can be sold from this screen. Borrowed securities and locate approvals are handled separately through the securities-lending workflow.</div>
          </section>
        </section>
      )}

      {!loading && activeTab === "securities" && (
        <section className="wf-content wf-securities-view">
          <div className="wf-section-heading">
            <div>
              <div className="wf-eyebrow">INSTRUMENT DIRECTORY</div>
              <h2>Securities</h2>
              <p>Browse available instruments and add selected securities to your watchlist.</p>
            </div>
          </div>
          <section className="wf-panel wf-securities-panel">
            <div className="wf-panel-header wf-securities-toolbar">
              <div><h2>Available securities</h2><small>{filteredSecurities.length} instruments</small></div>
              <input className="wf-security-search" value={securitySearch} onChange={(e) => setSecuritySearch(e.target.value)} placeholder="Search symbol or security name…" />
            </div>
            <div className="wf-table-wrap wf-securities-table-wrap">
              <table className="wf-table">
                <thead><tr><th>Symbol</th><th>Security name</th><th>Asset class</th><th>Exchange</th><th>Watchlist</th></tr></thead>
                <tbody>
                  {filteredSecurities.length ? filteredSecurities.map((security) => {
                    const added = isInWatchlist(security);
                    return <tr key={security.id}>
                      <td><strong>{security.symbol ?? security.ticker ?? `SEC-${security.id}`}</strong></td>
                      <td>{security.name ?? security.description ?? "—"}</td>
                      <td>{security.assetClass ?? security.assetType ?? "—"}</td>
                      <td>{security.exchange ?? security.market ?? "—"}</td>
                      <td>
                        <button type="button" className={added ? "wf-watch-added" : "wf-add-watch"} disabled={added || addingSecurityId === security.id} onClick={() => addToWatchlist(security)} aria-label={added ? "Already in watchlist" : "Add to watchlist"}>
                          {added ? "✓ Added" : addingSecurityId === security.id ? "Adding…" : "+ Add"}
                        </button>
                      </td>
                    </tr>;
                  }) : <tr><td colSpan={5} className="wf-empty">No securities match your search.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {!loading && activeTab === "trading" && (
        <section className="wf-content wf-trading-view">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">MARKETS / ORDER ENTRY</div><h2>Trading</h2><p>Select a watchlist security to inspect its price history and prepare a buy or sell ticket.</p></div></div>
          <div className="wf-trading-layout">
            <section className="wf-panel wf-watchlist-panel">
              <div className="wf-panel-header"><div><h2>Watchlist</h2><small>{watchlist.length} securities</small></div><button className="wf-secondary" onClick={loadAll}>↻</button></div>
              <div className="wf-watchlist-items">
                {watchlist.length ? watchlist.map((item) => {
                  const security = securities.find((s) => String(s.id) === String(item.securityId ?? item.id)) ?? item;
                  return <button key={security.id} className={String(selectedTradeSecurity?.id) === String(security.id) ? "selected" : ""} onClick={() => selectTradeSecurity(security)}>
                    <span><strong>{security.symbol ?? security.ticker ?? `Security ${security.id}`}</strong><small>{security.name ?? security.description ?? "Listed security"}</small></span>
                    <span className="wf-watch-chevron">›</span>
                  </button>;
                }) : <div className="wf-empty-state">Your watchlist is empty. Add securities to your watchlist to see them here.</div>}
              </div>
            </section>
            <div className="wf-trading-main">
              <section className="wf-panel wf-chart-panel">
                {selectedTradeSecurity ? <>
                  <div className="wf-chart-heading"><div><div className="wf-eyebrow">SECURITY PRICE</div><h2>{selectedTradeSecurity.symbol ?? selectedTradeSecurity.ticker ?? `Security #${selectedTradeSecurity.id}`}</h2><p>{selectedTradeSecurity.name ?? selectedTradeSecurity.description ?? "Price history"}</p></div><span className="wf-status">Selected</span></div>
                  {historyLoading ? <div className="wf-loading">Loading candlestick data…</div> : tradeCandles.length ? <div className="wf-candle-chart">
                    <div className="wf-chart-y-labels"><span>{Math.max(...tradeCandles.map(x=>x.high)).toFixed(2)}</span><span>{((Math.max(...tradeCandles.map(x=>x.high))+Math.min(...tradeCandles.map(x=>x.low)))/2).toFixed(2)}</span><span>{Math.min(...tradeCandles.map(x=>x.low)).toFixed(2)}</span></div>
                    <div className="wf-candle-area">{tradeCandles.slice(-40).map((candle,index)=>{const min=Math.min(...tradeCandles.map(x=>x.low));const max=Math.max(...tradeCandles.map(x=>x.high));const range=max-min||1;const top=(max-candle.high)/range*100;const bottom=(max-candle.low)/range*100;const bodyTop=(max-Math.max(candle.open,candle.close))/range*100;const bodyHeight=Math.max(1,Math.abs(candle.open-candle.close)/range*100);const up=candle.close>=candle.open;return <div className="wf-candle" key={index} title={`${candle.date ?? ""} O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`}><i style={{top:`${top}%`,height:`${Math.max(1,bottom-top)}%`}}/><b className={up?"up":"down"} style={{top:`${bodyTop}%`,height:`${bodyHeight}%`}}/></div>;})}</div>
                  </div> : <div className="wf-empty-state">No candlestick history is available for this security.</div>}
                </> : <div className="wf-chart-placeholder"><span>◫</span><h3>Select a security</h3><p>Choose an instrument from your watchlist to display its candlestick chart.</p></div>}
              </section>
              <section className="wf-panel wf-order-panel">
                <div className="wf-panel-header"><h2>Order ticket</h2><span className="wf-status">Paper execution</span></div>
                <div className="wf-account-balance"><span>Available cash balance</span><strong>{money(account?.available)}</strong></div>
                <div className="wf-trade-switch"><button type="button" className={tradeSide==="BUY"?"buy active":"buy"} onClick={()=>setTradeSide("BUY")}>Buy</button><button type="button" className={tradeSide==="SELL"?"sell active":"sell"} onClick={()=>setTradeSide("SELL")}>Sell</button></div>
                <form onSubmit={submitTrade}><div className="wf-form-grid">
                  <Field label="Security"><input readOnly value={selectedTradeSecurity?.symbol ?? selectedTradeSecurity?.ticker ?? ""} placeholder="Select from watchlist"/></Field>
                  <Field label="Current price"><input readOnly value={currentTradePrice > 0 ? money(currentTradePrice) : "Price unavailable"}/></Field>
                  <Field label="Order type"><select value={tradeOrderType} onChange={e=>setTradeOrderType(e.target.value)}><option value="MARKET">Market</option><option value="LIMIT">Limit</option></select></Field>
                  {tradeOrderType === "LIMIT" && <Field label="Limit price"><input type="number" min="0.000001" step="0.01" required value={tradeLimitPrice} onChange={e=>setTradeLimitPrice(e.target.value)} placeholder="Enter limit price"/></Field>}
                  <Field label="Quantity"><input type="number" min="1" step="1" required value={tradeQuantity} onChange={e=>setTradeQuantity(e.target.value)} placeholder="Enter quantity"/></Field>
                  <Field label="Position source"><select value={tradeSource} onChange={e=>setTradeSource(e.target.value)}><option value="OWNED">Owned position / cash</option><option value="BORROWED">Borrowed position / short cover</option></select></Field>
                </div>
                <div className="wf-order-estimate"><div><span>Estimated total</span><strong>{money(estimatedOrderTotal)}</strong></div><small>{money(currentTradePrice)} × {Number(tradeQuantity || 0).toLocaleString("en-IN")} units</small></div>
                <div className="wf-info">Market orders are paper-executed against the latest completed one-minute close. Limit orders remain pending until the market price reaches the limit. The backend validates cash or sellable quantity and records balance transactions.</div>
                <div className="wf-actions"><button className="wf-primary" type="submit" disabled={!selectedTradeSecurity || !currentTradePrice || !tradeQuantity || orderSubmitting || (tradeOrderType === "LIMIT" && !tradeLimitPrice)}>{orderSubmitting ? "Submitting…" : `${tradeSide} ${tradeOrderType} order`}</button></div></form>
              </section>
            </div>
          </div>
        </section>
      )}

      {loading && <div className="wf-loading">Loading workspace...</div>}

      {!loading && activeTab === "msla" && (
        <section className="wf-content wf-msla-dashboard">
          <div className="wf-panel wf-msla-grid-panel">
            <div className="wf-msla-toolbar">
              <div>
                <div className="wf-eyebrow">CONTRACT PORTFOLIO</div>
                <h2>Existing MSLAs</h2>
              </div>
              <button
                type="button"
                className="wf-primary"
                onClick={() => {
                  setAgreementForm(emptyAgreement);
                  setIsCreatingAgreement((value) => !value);
                }}
              >
                {isCreatingAgreement ? "Close form" : "Create MSLA"}
              </button>
            </div>

            {isCreatingAgreement && (
              <form className="wf-msla-create-form" onSubmit={submitAgreement}>
                <div className="wf-form-grid">
                  <Field label="Lender">
                    <select required value={agreementForm.lenderId}
                      onChange={(e) => updateAgreement("lenderId", e.target.value)}>
                      <option value="">Select lender</option>
                      {lenders.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} · #{l.id}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Agreement reference">
                    <input required maxLength="100"
                      value={agreementForm.number}
                      onChange={(e) => updateAgreement("number", e.target.value)}
                      placeholder="e.g. MSLA-2026-001" />
                  </Field>
                  <Field label="Effective date">
                    <input type="date" required value={agreementForm.effectiveDate}
                      onChange={(e) => updateAgreement("effectiveDate", e.target.value)} />
                  </Field>
                  <Field label="Expiry date">
                    <input type="date" required value={agreementForm.expiryDate}
                      onChange={(e) => updateAgreement("expiryDate", e.target.value)} />
                  </Field>
                  <Field label="Credit limit (INR)">
                    <input type="number" min="0.000001" step="0.01" required
                      value={agreementForm.creditLimit}
                      onChange={(e) => updateAgreement("creditLimit", e.target.value)} />
                  </Field>
                  <Field label="Fee rate (decimal)">
                    <input type="number" min="0" max="1" step="0.0001" required
                      value={agreementForm.feeRate}
                      onChange={(e) => updateAgreement("feeRate", e.target.value)} />
                  </Field>
                  <Field label="Rebate rate (decimal)">
                    <input type="number" min="0" max="1" step="0.0001" required
                      value={agreementForm.rebateRate}
                      onChange={(e) => updateAgreement("rebateRate", e.target.value)} />
                  </Field>
                  <Field label="Coverage ratio">
                    <input type="number" min="1" max="5" step="0.01" required
                      value={agreementForm.coverageRatio}
                      onChange={(e) => updateAgreement("coverageRatio", e.target.value)} />
                  </Field>
                  <Field label="Billing frequency">
                    <select value={agreementForm.billingFrequency}
                      onChange={(e) => updateAgreement("billingFrequency", e.target.value)}>
                      <option value="MONTHLY">MONTHLY</option>
                      <option value="AT_CLOSE">AT_CLOSE</option>
                    </select>
                  </Field>
                  <Field label="Day basis">
                    <select value={agreementForm.dayBasis}
                      onChange={(e) => updateAgreement("dayBasis", e.target.value)}>
                      <option value="360">360</option>
                      <option value="365">365</option>
                    </select>
                  </Field>
                  <Field label="Margin hours">
                    <input type="number" min="1" value={agreementForm.marginHours}
                      onChange={(e) => updateAgreement("marginHours", e.target.value)} />
                  </Field>
                  <Field label="Recall hours">
                    <input type="number" min="1" value={agreementForm.recallHours}
                      onChange={(e) => updateAgreement("recallHours", e.target.value)} />
                  </Field>
                </div>

                <label className="wf-check">
                  <input type="checkbox" checked={agreementForm.recallAllowed}
                    onChange={(e) => updateAgreement("recallAllowed", e.target.checked)} />
                  Recall allowed under this agreement
                </label>

                <div className="wf-subheading">
                  <h4>Collateral rules</h4>
                  <button type="button" className="wf-small-button" onClick={addRule}>Add rule</button>
                </div>

                {agreementForm.collateralRules.map((rule, index) => (
                  <div key={index} className="wf-rule-row">
                    <Field label="Asset type">
                      <select value={rule.assetType}
                        onChange={(e) => updateRule(index, "assetType", e.target.value)}>
                        <option value="CASH">Cash</option>
                        <option value="SECURITY">Security</option>
                      </select>
                    </Field>
                    <Field label={rule.assetType === "SECURITY" ? "Security ID" : "Cash rule"}>
                      {rule.assetType === "SECURITY" ? (
                        <select value={rule.securityId ?? ""}
                          onChange={(e) => updateRule(index, "securityId", e.target.value)}>
                          <option value="">Select security</option>
                          {securities.map((s) => (
                            <option key={s.id} value={s.id}>{s.symbol || s.name || `Security #${s.id}`}</option>
                          ))}
                        </select>
                      ) : (
                        <input value="Cash collateral" readOnly />                      )}
                    </Field>
                    <Field label="Haircut">
                      <input type="number" min="0" max="100" step="0.01"
                        value={rule.haircut}
                        onChange={(e) => updateRule(index, "haircut", e.target.value)} />
                     </Field>
                     <button type="button" className="wf-remove" disabled={agreementForm.collateralRules.length === 1}
                       onClick={() => removeRule(index)}>Remove</button>
                   </div>
                 ))}

                 <div className="wf-actions">
                   <button className="wf-primary" type="submit">Submit MSLA</button>
                 </div>
               </form>
             )}

            <div className="wf-table-wrap">
              <table className="wf-table">
                <thead><tr><th>MSLA</th><th>Lender</th><th>Credit limit</th><th>Fee rate</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {agreementRows.length ? agreementRows.map((agreement) => {
                    const expanded = String(selectedAgreementId) === String(agreement.id);
                    const agreementLoans = loans.filter((loan) => String(loan.mslaId ?? loan.agreementId ?? loan.msla_id) === String(agreement.id));
                    return (
                      <>
                        <tr key={agreement.id} className={expanded ? "wf-selected-row" : ""}>
                          <td><button type="button" className="wf-expand-link" onClick={() => setSelectedAgreementId(expanded ? null : String(agreement.id))}>{expanded ? "▾" : "▸"} {agreement.displayNumber}</button></td>
                          <td>{agreement.lenderName}</td><td>{agreement.displayCreditLimit}</td><td>{Number(agreement.feeRate || 0).toFixed(4)}</td><td>{agreement.displayExpiry}</td>
                          <td><span className="wf-status">{agreement.status || "—"}</span></td>
                          <td><button type="button" className="wf-icon-button" title="View MSLA details" aria-label={`View MSLA ${agreement.displayNumber} details`} onClick={() => setDetailView({type:"MSLA",record:agreement})}>◉</button></td>
                        </tr>
                        {expanded && <tr key={`loans-${agreement.id}`} className="wf-expanded-row"><td colSpan={7}>
                          <div className="wf-expanded-content">
                            <div className="wf-child-header"><h3>Loans under {agreement.displayNumber}</h3><span>{agreementLoans.length} loans</span></div>
                            {agreementLoans.length ? <div className="wf-table-wrap"><table className="wf-table">
                              <thead><tr><th>Loan ID</th><th>Reservation</th><th>Security</th><th>Quantity</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                              <tbody>{agreementLoans.map(loan => <tr key={loan.id}>
                                <td>{loan.id}</td><td>{loan.reservationId ?? loan.reservation_id ?? "—"}</td><td>{loan.securityId ?? loan.security_id ?? "—"}</td><td>{loan.quantity ?? "—"}</td><td><span className="wf-status">{loan.status || "—"}</span></td><td>{formatDate(loan.createdAt ?? loan.created_at)}</td>
                                <td><button type="button" className="wf-icon-button" title="View loan details" aria-label={`View loan ${loan.id} details`} onClick={() => setDetailView({type:"LOAN",record:loan})}>◉</button></td>
                              </tr>)}</tbody>
                            </table></div> : <div className="wf-empty-state compact">No loans are associated with this MSLA.</div>}
                          </div>
                        </td></tr>}
                      </>
                    );
                  }) : <tr><td colSpan={7} className="wf-empty">No MSLA records available.</td></tr>}
                </tbody>
              </table>
            </div>
 
           </div>
         </section>
       )}
       {detailView && (
        <div className="wf-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailView(null); }}>
          <section className="wf-detail-modal" role="dialog" aria-modal="true" aria-labelledby="wf-detail-title">
            <div className="wf-panel-header"><div><div className="wf-eyebrow">{detailView.type === "MSLA" ? "AGREEMENT RECORD" : "LOAN RECORD"}</div><h2 id="wf-detail-title">{detailView.type === "MSLA" ? (detailView.record.number || `MSLA-${detailView.record.id}`) : `Loan #${detailView.record.id}`}</h2></div><button type="button" className="wf-icon-button" aria-label="Close details" onClick={() => setDetailView(null)}>✕</button></div>
            <div className="wf-detail-grid">
              {Object.entries(detailView.record).map(([key,value]) => (
                <div className="wf-detail-field" key={key}><span>{key.replace(/([A-Z])/g," $1").replace(/_/g," ")}</span><strong>{value == null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</strong></div>
              ))}
            </div>
          </section>
        </div>
      )}

      {!loading && false && activeTab === "msla" && (
         <section className="wf-content">
           <div className="wf-section-heading">
             <div>
               <div className="wf-eyebrow">CONTRACT MANAGEMENT</div>
               <h2>Master Securities Lending Agreement</h2>
              <p>Propose lending terms to a registered lender.</p>
             </div>
           </div>
 
           <div className="wf-panel">
             <h3>New MSLA proposal</h3>
  <form onSubmit={submitAgreement}>
               <div className="wf-form-grid">
                 <Field label="Lender">
                   <select required value={agreementForm.lenderId}
                     onChange={(e) => updateAgreement("lenderId", e.target.value)}>
                     <option value="">Select lender</option>
                     {lenders.map((l) => (
                      <option key={l.id} value={l.id}>
                         {l.name} · #{l.id}
                       </option>
                    ))}
                   </select>
                </Field>
                 <Field label="Agreement reference">
                   <input required maxLength="100"
                     value={agreementForm.number}
                     onChange={(e) => updateAgreement("number", e.target.value)}
                     placeholder="e.g. MSLA-2026-001" />
                 </Field>
                 <Field label="Effective date">
                  <input type="date" required value={agreementForm.effectiveDate}
                    onChange={(e) => updateAgreement("effectiveDate", e.target.value)} />
                </Field>
                 <Field label="Expiry date">
                   <input type="date" required value={agreementForm.expiryDate}
                     onChange={(e) => updateAgreement("expiryDate", e.target.value)} />
                 </Field>
                 <Field label="Credit limit (INR)">
                   <input type="number" min="0.000001" step="0.01" required
                     value={agreementForm.creditLimit}
                    onChange={(e) => updateAgreement("creditLimit", e.target.value)} />
                </Field>
                 <Field label="Fee rate (decimal)">
                   <input type="number" min="0" max="1" step="0.0001" required
                     value={agreementForm.feeRate}
                     onChange={(e) => updateAgreement("feeRate", e.target.value)} />
                 </Field>
                 <Field label="Rebate rate (decimal)">
                   <input type="number" min="0" max="1" step="0.0001" required
                     value={agreementForm.rebateRate}
                    onChange={(e) => updateAgreement("rebateRate", e.target.value)} />
                 </Field>
                 <Field label="Collateral coverage ratio">
                   <input type="number" min="1" max="5" step="0.01" required
                     value={agreementForm.coverageRatio}
                     onChange={(e) => updateAgreement("coverageRatio", e.target.value)} />
                </Field>
                <Field label="Billing frequency">
                   <select value={agreementForm.billingFrequency}
                     onChange={(e) => updateAgreement("billingFrequency", e.target.value)}>
                     <option value="MONTHLY">Monthly</option>
                     <option value="AT_CLOSE">At close</option>
                  </select>
                </Field>
                 <Field label="Day basis">
                  <select value={agreementForm.dayBasis}
                     onChange={(e) => updateAgreement("dayBasis", e.target.value)}>
                     <option value="360">360</option>
                     <option value="365">365</option>
                  </select>
                 </Field>
                 <Field label="Margin response (hours)">
                   <input type="number" min="1" value={agreementForm.marginHours}
                     onChange={(e) => updateAgreement("marginHours", e.target.value)} />
                 </Field>
                 <Field label="Recall response (hours)">
                  <input type="number" min="1" value={agreementForm.recallHours}
                     onChange={(e) => updateAgreement("recallHours", e.target.value)} />
                 </Field>
               </div>
 
               <label className="wf-check">
                 <input type="checkbox" checked={agreementForm.recallAllowed}
                   onChange={(e) => updateAgreement("recallAllowed", e.target.checked)} />
                 Recall allowed under this agreement
               </label>
               <div className="wf-subheading">
                 <div>
                   <h4>Collateral rules</h4>
                   <p>Define eligible collateral and its haircut.</p>
                 </div>
                 <button type="button" className="wf-secondary" onClick={addRule}>
                   + Add rule
                 </button>
               </div>
 
               {agreementForm.collateralRules.map((rule, index) => (
                 <div className="wf-rule-row" key={index}>
                   <Field label="Asset type">
                     <select value={rule.assetType}
                       onChange={(e) => updateRule(index, "assetType", e.target.value)}>
                       <option value="CASH">Cash</option>
                       <option value="SECURITY">Security</option>
                     </select>
                   </Field>
                   {rule.assetType === "SECURITY" && (
                     <Field label="Security ID">
                       <select required value={rule.securityId || ""}
                         onChange={(e) => updateRule(index, "securityId", e.target.value)}>
                         <option value="">Select security</option>
                         {securities.map((s) => (
                          <option key={s.id} value={s.id}>
                             {s.symbol} — {s.name}
                           </option>
                         ))}
                       </select>
                     </Field>
                   )}
                   <Field label="Haircut (0–0.99999999)">
                     <input type="number" min="0" max="0.99999999"
                       step="0.0001" required value={rule.haircut}
                       onChange={(e) => updateRule(index, "haircut", e.target.value)} />
                   </Field>
                  <button type="button" className="wf-remove"
                    disabled={agreementForm.collateralRules.length === 1}
                     onClick={() => removeRule(index)}>Remove</button>
                 </div>
               ))}
 
               <div className="wf-actions">
                 <button className="wf-primary" type="submit">Submit MSLA proposal</button>
               </div>
             </form>
           </div>
  <div className="wf-panel">
             <h3>Agreement register</h3>
             <DataTable rows={agreements} columns={[
               { key: "id", label: "ID" },
               { key: "number", label: "Reference" },
              { key: "lenderId", label: "Lender ID" },
               { key: "creditLimit", label: "Credit limit", render: r => money(r.creditLimit) },
               { key: "status", label: "Locate status", render: r => <span className="wf-status">{r.status || "—"}</span> },
               { key: "reservation", label: "Reservation", render: r => { const x = reservations.find(v => String(v.locateId ?? v.locate_id ?? v.locateRequestId) === String(r.id)); return x ? <span className="wf-status">{x.status || "—"}</span> : ["APPROVED", "PARTIALLY_APPROVED"].includes(String(r.status || "").toUpperCase()) ? "Creating automatically…" : "—"; } },
               { key: "effectiveDate", label: "Effective", render: r => formatDate(r.effectiveDate) },
               { key: "expiryDate", label: "Expiry", render: r => formatDate(r.expiryDate) },
             ]} />
           </div>
         </section>
       )}
 
       {!loading && activeTab === "locates" && (
         <section className="wf-content">
           <div className="wf-section-heading">
             <div>
               <div className="wf-eyebrow">AVAILABILITY DISCOVERY</div>
               <h2>Locate requests</h2>
               <p>Ask a lender to locate a security. Availability is not displayed in this portal.</p>
             </div>
           </div>
           <div className="wf-panel">
             <h3>Create locate request</h3>
             <form onSubmit={submitLocate}>
               <div className="wf-form-grid">
                 <Field label="MSLA agreement">
                   <select required value={locateForm.agreementId}
                    onChange={(e) => setLocateForm({ ...locateForm, agreementId: e.target.value })}>
                     <option value="">Select agreement</option>
                    {agreements.map((a) => (
                       <option key={a.id} value={a.id}>
                        {a.number || `Agreement #${a.id}`} · {a.status}
                       </option>
                     ))}
                  </select>
                 </Field>
                 <Field label="Security">
                   <select required value={locateForm.securityId}
                     onChange={(e) => setLocateForm({ ...locateForm, securityId: e.target.value })}>
                     <option value="">Select security</option>
                     {securities.map((s) => (
                       <option key={s.id} value={s.id}>
                         {s.symbol} — {s.name}
                       </option>
                     ))}
                   </select>
                 </Field>
                 <Field label="Requested quantity">
                   <input type="number" min="1" step="1" required
                     value={locateForm.quantity}
                     onChange={(e) => setLocateForm({ ...locateForm, quantity: e.target.value })} />
                 </Field>
                 <Field label="Request expiry">
                   <input type="datetime-local" required
                     value={locateForm.expiresAt}
                     onChange={(e) => setLocateForm({ ...locateForm, expiresAt: e.target.value })} />
                 </Field>
               </div>
               <div className="wf-actions">
                 <button className="wf-primary">Submit locate request</button>
               </div>
             </form>
           </div>
 
           <div className="wf-panel">
             <h3>Locate request register</h3>
             <DataTable rows={locates} columns={[
               { key: "id", label: "Request ID" },
               {
                 key: "agreementId",
                 label: "Agreement",
                 render: (r) => (
                   r.agreementId ?? r.mslaId ?? r.msla_id ?? "—"
                 ),
               },
               { key: "securityId", label: "Security ID" },
               { key: "quantity", label: "Quantity" },
               { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
               { key: "expiresAt", label: "Expires", render: r => formatDate(r.expiresAt) },
             ]} />
           <div className="wf-panel wf-inline-reservations">
             <div className="wf-panel-header"><h3>Automatic reservation register</h3><span className="wf-status">{reservations.length} records</span></div>
             <p className="wf-help">Lender-approved locate quantities are automatically submitted for reservation and confirmed against lender inventory. No separate reservation action is required.</p>
             <DataTable rows={reservations} columns={[
               { key: "id", label: "Reservation ID" },
               { key: "locateId", label: "Locate ID", render: r => r.locateId ?? r.locate_id ?? "—" },
               { key: "quantity", label: "Approved quantity" },
               { key: "remainingQuantity", label: "Remaining quantity", render: r => r.remainingQuantity ?? r.remaining_quantity ?? "—" },
               { key: "status", label: "Reservation status", render: r => <span className="wf-status">{r.status || "—"}</span> },
               { key: "expiresAt", label: "Expires", render: r => formatDate(r.expiresAt) },
             ]} />
           </div>
           </div>
         </section>
       )}
 
       {!loading && activeTab === "loans" && (
         <section className="wf-content">
           <div className="wf-section-heading">
             <div>
               <div className="wf-eyebrow">BORROWING OPERATIONS</div>
               <h2>Create loan request</h2>
              <p>Submit a loan request against confirmed reserved securities.</p>
             </div>
           </div>

           <div className="wf-panel wf-loan-tabs">
             <div className="wf-tab-actions" role="tablist" aria-label="Loan workspace sections">
               <button type="button" role="tab" aria-selected={loanSubTab === "create"} className={loanSubTab === "create" ? "wf-primary" : "wf-secondary"} onClick={() => setLoanSubTab("create")}>Create Loan</button>
               <button type="button" role="tab" aria-selected={loanSubTab === "register"} className={loanSubTab === "register" ? "wf-primary" : "wf-secondary"} onClick={() => setLoanSubTab("register")}>Loan Register</button>
               <button type="button" role="tab" aria-selected={loanSubTab === "margin"} className={loanSubTab === "margin" ? "wf-primary" : "wf-secondary"} onClick={() => setLoanSubTab("margin")}>Margin Calls & Rebates <span className="wf-status">{marginCalls.length}</span></button>
             </div>
           </div>

           {loanSubTab === "create" && <div className="wf-panel">
             <h3>Loan request details</h3>
             <form onSubmit={submitLoan}>
               <div className="wf-form-grid">
                 <Field label="Confirmed reservation">
                   <select required value={loanForm.reservationId}
                     onChange={(e) => setLoanForm({ ...loanForm, reservationId: e.target.value })}>
                     <option value="">Select reservation</option>
                     {confirmedReservations.map((r) => (
                       <option key={r.id} value={r.id}>
                         Reservation #{r.id} · Qty {r.quantity} · {r.status}
                       </option>
                     ))}
                   </select>
                 </Field>
                 <Field label="Loan quantity">
                   <input type="number" min="1" required value={loanForm.quantity}
                     onChange={(e) => setLoanForm({ ...loanForm, quantity: e.target.value })} />
                 </Field>
                 <Field label="Collateral type">
                   <select value={loanForm.assetType}
                     onChange={(e) => setLoanForm({ ...loanForm, assetType: e.target.value })}>
                         <option value = "CASH">Cash</option>
                         <option value = "SECURITY">Security</option>
                     </select>
                     </Field>{loanForm.assetType === "CASH" ? (
                   <Field label="Cash collateral amount (INR)">
                     <input type="number" min="0.01" step="0.01" required
                       value={loanForm.cashAmount}
                       onChange={(e) => setLoanForm({ ...loanForm, cashAmount: e.target.value })} />
                   </Field>
                 ) : (
                   <>
                     <Field label="Collateral security">
                       <select required value={loanForm.securityId}
                         onChange={(e) => setLoanForm({ ...loanForm, securityId: e.target.value })}>
                         <option value="">Select security</option>
                         {securities.map((s) => (
                           <option key={s.id} value={s.id}>
                             {s.symbol} — {s.name}
                           </option>
                        ))}
                       </select>
                     </Field>
                     <Field label="Collateral quantity">
                       <input type="number" min="1" required
                         value={loanForm.collateralQuantity}
                         onChange={(e) => setLoanForm({ ...loanForm, collateralQuantity: e.target.value })} />
                     </Field>
                   </>
                 )}
               </div>
 
               <div className="wf-info">
                 Collateral is submitted as part of the loan request. The backend validates the
                proposed allocation and creates the request; final settlement requires a separate
                 confirmation.
               </div>
              <div className="wf-actions">
                 <button className="wf-primary">Submit loan request</button>
               </div>
             </form>
           </div>}

           {loanSubTab === "register" && <div className="wf-panel">
             <div className="wf-panel-header"><h3>Loan register</h3><span className="wf-status">{loans.length} loans</span></div>
             <DataTable rows={loans} columns={[
               { key: "id", label: "Loan ID" },
               { key: "reservationId", label: "Reservation", render: r => r.reservationId ?? r.reservation_id ?? "—" },
               { key: "securityId", label: "Security ID", render: r => r.securityId ?? r.security_id ?? "—" },
               { key: "quantity", label: "Quantity" },
               { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
               { key: "createdAt", label: "Created", render: r => formatDate(r.createdAt ?? r.created_at) },
               { key: "actions", label: "Action", render: r => <button type="button" className="wf-icon-button" title="View loan details" aria-label={`View loan ${r.id} details`} onClick={() => setDetailView({type:"LOAN",record:r})}>◉</button> },
             ]} />
           </div>}

           {loanSubTab === "margin" && <div className="wf-panel">
             <div className="wf-panel-header"><h3>Loan margin calls & collateral</h3><span className="wf-status">{marginCalls.length} margin calls</span></div>
             <p className="wf-help">Margin calls are raised by the lender's valuation process. Respond against the specific loan by pledging eligible cash or securities.</p>
             {loans.length ? loans.map((loan) => {
               const loanKey = String(loan.id);
               const loanCalls = marginCalls.filter(call => String(call.loanId ?? call.loan_id) === loanKey);
               const loanCollateral = collateralPositions.filter(position => String(position.loanId ?? position.loan_id) === loanKey);
               const loanRebates = rebates.filter(rebate => String(rebate.loanId ?? rebate.loan_id) === loanKey);
               const cashPosted = loanCollateral.some(position =>
                 String(position.assetType ?? position.asset_type ?? "").toUpperCase() === "CASH" &&
                 ["POSTED", "CONFIRMED", "ACTIVE"].includes(String(position.status || "").toUpperCase())
               );
               const agreementId = loan.mslaId ?? loan.agreementId ?? loan.msla_id;
               const agreement = agreements.find(item => String(item.id) === String(agreementId));
               const rebateRecord = loanRebates.find(item => item.rebateRate != null || item.rebate_rate != null || item.rate != null);
               const rebateRate = rebateRecord?.rebateRate ?? rebateRecord?.rebate_rate ?? rebateRecord?.rate ?? agreement?.rebateRate;
               return (
                 <div className="wf-selected-panel" key={loan.id}>
                   <div className="wf-selected-header"><h3>Loan #{loan.id}</h3><span className="wf-status">{loan.status || "—"}</span></div>
                   <div className="wf-form-grid">
                     <div><small>Margin calls</small><strong>{loanCalls.length}</strong></div>
                     <div><small>Collateral positions</small><strong>{loanCollateral.length}</strong></div>
                     <div><small>Cash collateral rebate</small><strong>{cashPosted && rebateRate != null ? `${(Number(rebateRate) * 100).toFixed(4)}%` : cashPosted ? "Rate pending" : "Not applicable"}</strong></div>
                   </div>
                   <h4>Margin calls for this loan</h4>
                   <DataTable rows={loanCalls} columns={[
                     { key: "id", label: "Call ID" },
                     { key: "amount", label: "Call amount", render: r => money(r.amount) },
                     { key: "fulfilledAmount", label: "Fulfilled", render: r => money(r.fulfilledAmount ?? r.fulfilled_amount) },
                     { key: "reason", label: "Reason" },
                     { key: "dueAt", label: "Due", render: r => formatDate(r.dueAt ?? r.due_at) },
                     { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
                   ]} empty="No margin calls have been raised for this loan." />
                   {loanCalls.filter(call => ["OPEN", "PARTIALLY_FULFILLED", "OVERDUE"].includes(String(call.status || "").toUpperCase())).map(call => (
                     <form className="wf-inline-form" key={call.id} onSubmit={e => respondToMarginCall(e, call)}>
                       <div className="wf-subheading"><div><h4>Respond to margin call #{call.id}</h4><p>Outstanding call amount: {money(Math.max(0, Number(call.amount || 0) - Number(call.fulfilledAmount ?? call.fulfilled_amount ?? 0)))}</p></div></div>
                       <div className="wf-form-grid">
                         <Field label="Collateral asset type"><select name="assetType" defaultValue="CASH"><option value="CASH">Cash</option><option value="SECURITY">Security</option></select></Field>
                         <Field label="Cash amount (INR)"><input name="cashAmount" type="number" min="0.01" step="0.01" placeholder="Enter cash amount" /></Field>
                         <Field label="Security"><select name="securityId" defaultValue=""><option value="">Select security</option>{securities.map(security => <option key={security.id} value={security.id}>{security.symbol} — {security.name}</option>)}</select></Field>
                         <Field label="Security quantity"><input name="quantity" type="number" min="1" step="1" /></Field>
                       </div>
                       <div className="wf-actions"><button className="wf-primary" type="submit" disabled={pledgingCallId === call.id}>{pledgingCallId === call.id ? "Submitting…" : "Submit collateral response"}</button></div>
                     </form>
                   ))}
                   <h4>Collateral positions</h4>
                   <DataTable rows={loanCollateral} columns={[
                     { key: "id", label: "Position ID" },
                     { key: "assetType", label: "Type", render: r => r.assetType ?? r.asset_type ?? "—" },
                     { key: "securityId", label: "Security", render: r => r.securityId ?? r.security_id ?? "Cash" },
                     { key: "quantity", label: "Quantity" },
                     { key: "cashAmount", label: "Cash amount", render: r => r.cashAmount != null ? money(r.cashAmount) : "—" },
                     { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
                   ]} empty="No collateral positions recorded for this loan." />
                   {cashPosted && <>
                     <h4>Cash collateral rebate</h4>
                     <DataTable rows={loanRebates} columns={[
                       { key: "rebateRate", label: "Rebate rate", render: r => { const rate = r.rebateRate ?? r.rebate_rate ?? r.rate; return rate == null ? "—" : `${(Number(rate) * 100).toFixed(4)}%`; } },
                       { key: "amount", label: "Accrued rebate", render: r => money(r.amount) },
                       { key: "accrualDate", label: "Accrual date", render: r => formatDate(r.accrualDate ?? r.accrual_date) },
                       { key: "nextPaymentDate", label: "Next payment", render: r => formatDate(r.nextPaymentDate ?? r.paymentDate ?? r.payment_date) },
                       { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
                     ]} empty="Cash collateral is posted. Rebate accrual has not been reported yet." />
                   </>}
                 </div>
               );
             }) : <div className="wf-empty-state">Margin calls and collateral will appear here once loans are created.</div>}
           </div>}
         </section>
      )}
        </div>
      </div>
     </main>
   );
 }