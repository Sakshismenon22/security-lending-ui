import { Fragment, useEffect, useMemo, useState } from "react";
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
  const [locateSubTab, setLocateSubTab] = useState("create");
  const [expandedLocateId, setExpandedLocateId] = useState(null);
  const [marginAssetTypes, setMarginAssetTypes] = useState({});
  const [orgId, setOrgId] = useState(ORG_ID);
  const [agreements, setAgreements] = useState([]);
  const [selectedAgreementId, setSelectedAgreementId] = useState(null);
  const [detailView, setDetailView] = useState(null);
  const [locates, setLocates] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loans, setLoans] = useState([]);
  const [recalls, setRecalls] = useState([]);
  const [loanReturns, setLoanReturns] = useState([]);
  const [returnSubmitting, setReturnSubmitting] = useState(null);
  const [expandedLoanId, setExpandedLoanId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [collateralHistory, setCollateralHistory] = useState([]);
  const [fees, setFees] = useState([]);
  const [accruals, setAccruals] = useState([]);
  const [rebatePayments, setRebatePayments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [collateralSubmitting, setCollateralSubmitting] = useState(false);
  const [collateralAssetType, setCollateralAssetType] = useState("CASH");
  const [collateralTab, setCollateralTab] = useState("pledge");
  const [recallTab, setRecallTab] = useState("register");
  const [settlementTab, setSettlementTab] = useState("register");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        { key: "recalls", call: getData(`${base}/recalls`) },
        { key: "loanReturns", call: getData(`${base}/returns`) },
        { key: "notifications", call: getData(`${base}/notifications`) },
        { key: "collateralHistory", call: getData(`${base}/collateral/history`) },
        { key: "fees", call: getData(`${base}/fees`) },
        { key: "accruals", call: getData(`${base}/accruals`) },
        { key: "rebatePayments", call: getData(`${base}/rebate-payments`) },
        { key: "payments", call: getData(`${base}/payments`) },
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
        recalls: [],
        loanReturns: [],
        notifications: [],
        collateralHistory: [],
        fees: [],
        accruals: [],
        rebatePayments: [],
        payments: [],
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
      setRecalls(nextState.recalls);
      setLoanReturns(nextState.loanReturns);
      setNotifications(nextState.notifications);
      setCollateralHistory(nextState.collateralHistory);
      setFees(nextState.fees);
      setAccruals(nextState.accruals);
      setRebatePayments(nextState.rebatePayments);
      setPayments(nextState.payments);
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
      dayBasis: Number(agreementForm.dayBasis),      marginHours: Number(agreementForm.marginHours),      recallHours: Number(agreementForm.recallHours),
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
      securityId: Number(locateForm.securityId),      quantity: Number(locateForm.quantity),
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
    const approvedQuantity = Number(locate.approvedQuantity ?? locate.approved_quantity ?? 0);
    if (!approvedQuantity) {
      showNotice("error", "This locate has no approved quantity available for reservation.");
      return;
    }
    const quantityInput = window.prompt(
      `Enter quantity to request from the lender (maximum approved: ${approvedQuantity})`,
      String(approvedQuantity)
    );
    if (quantityInput === null) return;
    const quantity = Number(quantityInput);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > approvedQuantity) {
      showNotice("error", `Enter a whole number between 1 and ${approvedQuantity}.`);
      return;
    }
    try {
      await postData(`${base}/locates/${locate.id}/reserve`, { quantity });
      showNotice("success", "Reservation request sent to the lender. It will remain pending until the lender responds.");
      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail ||
        error.response?.data?.message || "Unable to send reservation request to the lender.");
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
      showNotice("success", `Collateral response submitted for margin call #${call.id}.`);      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Unable to submit collateral for this margin call.");
    } finally {
      setPledgingCallId(null);
    }
  }

  async function markNotificationRead(notification) {
    if (notification.isRead ?? notification.read) return;
    try {
      await postData(`${base}/notifications/${notification.id}/read`, {});
      setNotifications(current => current.map(item => String(item.id) === String(notification.id)
        ? { ...item, isRead: true, read: true } : item));
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Unable to mark notification as read.");
    }
  }

  async function submitCollateralAllocation(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const loanId = Number(form.get("loanId"));
    const assetType = String(form.get("assetType") || "CASH").toUpperCase();
    const payload = {
      assetType,
      securityId: assetType === "SECURITY" ? Number(form.get("securityId")) : null,
      quantity: assetType === "SECURITY" ? Number(form.get("quantity") || 0) : 0,
      cashAmount: assetType === "CASH" ? Number(form.get("cashAmount") || 0) : 0,
    };
    if (!loanId || (assetType === "CASH" && payload.cashAmount <= 0) ||
      (assetType === "SECURITY" && (!payload.securityId || payload.quantity <= 0))) {
      showNotice("error", "Select a loan and enter a valid cash or security collateral allocation.");
      return;
    }
    setCollateralSubmitting(true);
    try {
      await postData(`${base}/loans/${loanId}/collateral`, payload);
      showNotice("success", "Collateral pledge request submitted. The position remains pending until confirmed.");
      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Unable to submit collateral.");
    } finally {
      setCollateralSubmitting(false);
    }
  }

  async function requestCollateralRelease(position) {
    if (!window.confirm(`Request release of collateral position #${position.id}? The position remains blocked until release confirmation.`)) return;
    try {
      await postData(`${base}/collateral/${position.id}/release`, {});
      showNotice("success", `Release request submitted for collateral position #${position.id}.`);
      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Unable to request collateral release.");
    }
  }

  async function submitLoanReturn(e, loan, recall = null) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const quantity = Number(form.get("quantity"));
    const outstanding = Number(loan.outstandingQuantity ?? loan.outstanding_quantity ?? loan.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > outstanding) {
      showNotice("error", `Enter a whole-number return quantity up to the outstanding quantity (${outstanding}).`);
      return;
    }
    const key = recall ? `recall-${recall.id}` : `loan-${loan.id}`;
    setReturnSubmitting(key);
    try {
      if (recall) {
        await postData(`${base}/recalls/${recall.id}/returns`, { quantity, recallId: Number(recall.id) });
        showNotice("success", `Return request submitted against recall #${recall.id}. Fulfilment will update after external confirmation.`);
      } else {
        await postData(`${base}/loans/${loan.id}/returns`, { quantity });
        showNotice("success", `Return request submitted for loan #${loan.id}. Outstanding quantity changes only after settlement confirmation.`);
      }
      await loadAll();
    } catch (error) {
      showNotice("error", error.response?.data?.detail || error.response?.data?.message || "Unable to submit the return request.");
    } finally {
      setReturnSubmitting(null);
    }
  }

  async function submitLoan(e) {
    e.preventDefault();     const collateral = loanForm.assetType === "CASH"
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
      <div className="wf-workspace">
        <aside className={`wf-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
          <button type="button" className="wf-sidebar-toggle" onClick={() => setSidebarCollapsed(value => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "›" : "‹"}</button>
          <div className="wf-brand"><span className="wf-brand-mark">M</span><span className="wf-brand-copy"><strong>MERIDIAN</strong><small>SECURITIES FINANCE</small></span></div>
          <div className="wf-sidebar-label">WORKSPACE</div>
          <nav className="wf-side-nav" aria-label="Borrower navigation">
            <div className="wf-nav-group-label">OVERVIEW</div>
            <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")} title="Dashboard"><span className="wf-nav-icon">⌂</span><span>Dashboard</span></button>
            <div className="wf-nav-group-label">MARKETS & PORTFOLIO</div>
            <button className={activeTab === "trading" ? "active" : ""} onClick={() => setActiveTab("trading")} title="Trading"><span className="wf-nav-icon">▥</span><span>Trading</span></button>
            <button className={activeTab === "holdings" ? "active" : ""} onClick={() => setActiveTab("holdings")} title="My Holdings"><span className="wf-nav-icon">▦</span><span>My Holdings</span></button>
            <button className={activeTab === "securities" ? "active" : ""} onClick={() => setActiveTab("securities")} title="Securities"><span className="wf-nav-icon">⌕</span><span>Securities</span></button>
            <div className="wf-nav-group-label">SECURITIES FINANCE</div>
            <button className={activeTab === "msla" ? "active" : ""} onClick={() => setActiveTab("msla")} title="Agreements"><span className="wf-nav-icon">▤</span><span>Agreements</span></button>
            <button className={activeTab === "locates" ? "active" : ""} onClick={() => setActiveTab("locates")} title="Borrow / Locate"><span className="wf-nav-icon">⇄</span><span>Borrow / Locate</span></button>
            <button className={activeTab === "loans" ? "active" : ""} onClick={() => setActiveTab("loans")} title="Loans"><span className="wf-nav-icon">▣</span><span>Loans</span></button>
            <button className={activeTab === "collateral" ? "active" : ""} onClick={() => setActiveTab("collateral")} title="Collateral"><span className="wf-nav-icon">⬡</span><span>Collateral</span></button>
            <button className={activeTab === "recalls" ? "active" : ""} onClick={() => setActiveTab("recalls")} title="Recall Management"><span className="wf-nav-icon">↩</span><span>Recall Management</span></button>
            <button className={activeTab === "settlements" ? "active" : ""} onClick={() => setActiveTab("settlements")} title="Settlements & Returns"><span className="wf-nav-icon">⇥</span><span>Settlements & Returns</span></button>
            <div className="wf-nav-group-label">OPERATIONS & FINANCE</div>
            <button className={activeTab === "billing" ? "active" : ""} onClick={() => setActiveTab("billing")} title="Billing & Statements"><span className="wf-nav-icon">₹</span><span>Billing & Statements</span></button>
            <button className={activeTab === "notifications" ? "active" : ""} onClick={() => setActiveTab("notifications")} title="Notifications & Alerts"><span className="wf-nav-icon">♢</span><span>Notifications <em className="wf-nav-count">{notifications.filter(n => !(n.isRead ?? n.read)).length}</em></span></button>
          </nav>
          <div className="wf-sidebar-bottom"><div className="wf-sidebar-org-icon">▥</div><div><strong>Borrower Organization</strong><small>Organization #{orgId}</small></div></div>
        </aside>
        <div className="wf-main-content">
 
      {notice && (
        <div className={`wf-notice ${notice.type}`}>{notice.message}</div>
      )}
 
      {!loading && activeTab === "dashboard" && (
        <section className="wf-content wf-dashboard-view">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">OVERVIEW</div><h2>Borrower dashboard</h2><p>Monitor your securities lending activity and access key workflows.</p></div></div>
          <div className="wf-inline-metrics" aria-label="Borrower activity summary">
            <span><strong>Active agreements:</strong> {agreements.length}</span>
            <span><strong>Locate requests:</strong> {locates.length}</span>
            <span><strong>Reservations:</strong> {reservations.length}</span>
            <span><strong>Loan requests:</strong> {loans.length}</span>
          </div>
          <section className="wf-panel wf-recent-activity">
            <div className="wf-panel-header"><div><h2>Recent activity</h2><small>Current organization balances and workflow volumes</small></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh data</button></div>
            <div className="wf-summary-grid">
              <div className="wf-summary-tile"><span>Available cash</span><strong>{account ? money(account.available ?? account.availableCash ?? account.cashAvailable ?? 0) : "Unavailable"}</strong></div>
              <div className="wf-summary-tile"><span>Blocked cash</span><strong>{account ? money(account.blocked ?? account.blockedCash ?? 0) : "—"}</strong></div>
              <div className="wf-summary-tile"><span>Agreements</span><strong>{agreements.length}</strong></div>
              <div className="wf-summary-tile"><span>Locate requests</span><strong>{locates.length}</strong></div>
              <div className="wf-summary-tile"><span>Reservations</span><strong>{reservations.length}</strong></div>
              <div className="wf-summary-tile"><span>Loans</span><strong>{loans.length}</strong></div>
            </div>
          </section>
          <div className="wf-dashboard-grid">
            <button className="wf-dashboard-card" onClick={() => setActiveTab("trading")}><span>MARKETS</span><strong>Trading</strong><small>Open your watchlist, view charts and prepare orders</small><b>Open trading →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("securities")}><span>INSTRUMENT DIRECTORY</span><strong>Securities</strong><small>Browse instruments and add them to your watchlist</small><b>Browse securities →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("locates")}><span>SECURITIES FINANCE</span><strong>Borrow / Locate</strong><small>Submit locate requests to connected lenders</small><b>View requests →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("loans")}><span>OPERATIONS</span><strong>Loan requests</strong><small>Create and monitor securities borrowing loans</small><b>View loans →</b></button>
          </div>
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
                  <Field label="Security"><input readOnly value={selectedTradeSecurity?.symbol ?? selectedTradeSecurity?.ticker ?? ""} placeholder="Select from watchlist"/></Field>                  <Field label="Current price"><input readOnly value={currentTradePrice > 0 ? money(currentTradePrice) : "Price unavailable"}/></Field>                  <Field label="Order type"><select value={tradeOrderType} onChange={e=>setTradeOrderType(e.target.value)}><option value="MARKET">Market</option><option value="LIMIT">Limit</option></select></Field>
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

      {!loading && activeTab === "notifications" && (
        <section className="wf-content wf-operations-view">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">OPERATIONS / EVENT CENTRE</div><h2>Notifications & Alerts</h2><p>Operational events and action reminders issued for this borrower organization.</p></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh</button></div>
          <div className="wf-summary-grid">
            <div className="wf-summary-tile"><span>Total notifications</span><strong>{notifications.length}</strong></div>
            <div className="wf-summary-tile"><span>Unread</span><strong>{notifications.filter(n=>!(n.isRead??n.read)).length}</strong></div>
            <div className="wf-summary-tile"><span>Open margin calls</span><strong>{marginCalls.filter(m=>!["FULFILLED","CANCELLED"].includes(String(m.status||"").toUpperCase())).length}</strong></div>
            <div className="wf-summary-tile"><span>Open recalls</span><strong>{recalls.filter(r=>!["FULFILLED","CANCELLED"].includes(String(r.status||"").toUpperCase())).length}</strong></div>
          </div>
          <div className="wf-panel">
            <div className="wf-panel-header"><h3>Organization event feed</h3><span className="wf-status">{notifications.length} events</span></div>
            <div className="wf-notification-list">
              {notifications.length ? [...notifications].sort((a,b)=>new Date(b.createdAt??b.created_at??0)-new Date(a.createdAt??a.created_at??0)).map(n=>{
                const read=Boolean(n.isRead??n.read);
                return <article className={read?"wf-notification read":"wf-notification unread"} key={n.id}>
                  <div className="wf-notification-marker">{read?"✓":"!"}</div>
                  <div className="wf-notification-copy"><div className="wf-notification-meta"><strong>{String(n.type||"EVENT").replaceAll("_"," ")}</strong><span>{formatDate(n.createdAt??n.created_at)}</span></div><p>{n.message||"An event was recorded for this organization."}</p><small>Reference: {n.reference??"—"}</small></div>
                  {!read && <button type="button" className="wf-small-button" onClick={()=>markNotificationRead(n)}>Mark read</button>}
                </article>;
              }) : <div className="wf-empty-state">No notifications have been recorded for this organization.</div>}
            </div>
          </div>
        </section>
      )}

      {!loading && activeTab === "collateral" && (
        <section className="wf-content wf-operations-view wf-tabbed-workspace">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">SECURITIES FINANCE / RISK</div><h2>Collateral Management</h2><p>Manage collateral instructions, positions and movement records.</p></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh</button></div>
          <div className="wf-summary-grid">
            <div className="wf-summary-tile"><span>Collateral positions</span><strong>{collateralPositions.length}</strong></div>
            <div className="wf-summary-tile"><span>Cash collateral</span><strong>{money(collateralPositions.filter(p=>String(p.assetType??p.asset_type).toUpperCase()==="CASH").reduce((sum,p)=>sum+Number(p.cashAmount??p.cash_amount??0),0))}</strong></div>
            <div className="wf-summary-tile"><span>Security collateral units</span><strong>{collateralPositions.filter(p=>String(p.assetType??p.asset_type).toUpperCase()==="SECURITY").reduce((sum,p)=>sum+Number(p.quantity||0),0).toLocaleString("en-IN")}</strong></div>
            <div className="wf-summary-tile"><span>Pending positions</span><strong>{collateralPositions.filter(p=>["PENDING","REQUESTED","PLEDGE_PENDING"].includes(String(p.status||"").toUpperCase())).length}</strong></div>
          </div>
          <div className="wf-work-tabs" role="tablist" aria-label="Collateral management views">
            <button type="button" className={collateralTab==="pledge"?"active":""} onClick={()=>setCollateralTab("pledge")}>Submit additional collateral</button>
            <button type="button" className={collateralTab==="positions"?"active":""} onClick={()=>setCollateralTab("positions")}>Collateral position register <span>{collateralPositions.length}</span></button>
            <button type="button" className={collateralTab==="history"?"active":""} onClick={()=>setCollateralTab("history")}>Movement history <span>{collateralHistory.length}</span></button>
          </div>
          <div className="wf-tab-panel">
            {collateralTab==="pledge" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Submit additional collateral</h3><small>Submit a pledge instruction against an active loan.</small></div><span className="wf-status">Borrower instruction</span></div>
              <form className="wf-inline-form" onSubmit={submitCollateralAllocation}>
                <div className="wf-form-grid">
                  <Field label="Loan"><select name="loanId" required defaultValue=""><option value="">Select loan</option>{loans.filter(l=>Number(l.outstandingQuantity??l.outstanding_quantity??l.quantity??0)>0).map(l=><option key={l.id} value={l.id}>Loan #{l.id} · {l.status}</option>)}</select></Field>
                  <Field label="Collateral type"><select name="assetType" value={collateralAssetType} onChange={e=>setCollateralAssetType(e.target.value)}><option value="CASH">Cash</option><option value="SECURITY">Security</option></select></Field>
                  <Field label="Cash amount (INR)"><input name="cashAmount" type="number" min="0.01" step="0.01" placeholder="Enter cash amount" disabled={collateralAssetType!=="CASH"} required={collateralAssetType==="CASH"}/></Field>
                  <Field label="Security ID"><select name="securityId" defaultValue="" disabled={collateralAssetType!=="SECURITY"} required={collateralAssetType==="SECURITY"}><option value="">Select security</option>{securities.map(s=><option key={s.id} value={s.id}>{s.symbol??s.ticker??s.id} — {s.name??"Security"}</option>)}</select></Field>
                  <Field label="Security quantity"><input name="quantity" type="number" min="1" step="1" placeholder="Enter units" disabled={collateralAssetType!=="SECURITY"} required={collateralAssetType==="SECURITY"}/></Field>
                </div>
                <div className="wf-info">Only the fields relevant to the selected collateral type are enabled. Valuation, eligibility, haircut and final pledge status are confirmed by the collateral owner.</div>
                <div className="wf-actions"><button className="wf-primary" type="submit" disabled={collateralSubmitting}>{collateralSubmitting?"Submitting…":"Submit collateral pledge"}</button></div>
              </form>
            </section>}
            {collateralTab==="positions" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Collateral position register</h3><small>Current collateral positions and release eligibility.</small></div><span className="wf-status">{collateralPositions.length} positions</span></div>
              <DataTable rows={collateralPositions} columns={[
                {key:"id",label:"Position ID"},{key:"loanId",label:"Loan",render:p=>p.loanId??p.loan_id??"—"},
                {key:"assetType",label:"Asset",render:p=>p.assetType??p.asset_type??"—"},
                {key:"securityId",label:"Security",render:p=>p.securityId??p.security_id??"—"},
                {key:"quantity",label:"Quantity",render:p=>String(p.assetType??p.asset_type).toUpperCase()==="SECURITY"?(p.quantity??"—"):"—"},
                {key:"cashAmount",label:"Cash amount",render:p=>String(p.assetType??p.asset_type).toUpperCase()==="CASH"?money(p.cashAmount??p.cash_amount):"—"},
                {key:"haircut",label:"Haircut",render:p=>p.haircut==null?"—":`${(Number(p.haircut)*100).toFixed(2)}%`},
                {key:"status",label:"Status",render:p=><span className="wf-status">{p.status||"—"}</span>},
                {key:"action",label:"Action",render:p=><button type="button" className="wf-small-button" disabled={!["POSTED","CONFIRMED","ACTIVE"].includes(String(p.status||"").toUpperCase())} onClick={()=>requestCollateralRelease(p)}>Request release</button>}
              ]} empty="No collateral positions are recorded." />
            </section>}
            {collateralTab==="history" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Collateral movement history</h3><small>Recorded pledge, adjustment and release movements.</small></div><span className="wf-status">{collateralHistory.length} movements</span></div>
              <DataTable rows={collateralHistory} columns={[
                {key:"id",label:"Movement ID"},{key:"loanId",label:"Loan",render:p=>p.loanId??p.loan_id??"—"},
                {key:"positionId",label:"Position",render:p=>p.positionId??p.position_id??"—"},
                {key:"type",label:"Movement"},{key:"amount",label:"Amount",render:p=>money(p.amount)},
                {key:"quantity",label:"Quantity"},{key:"createdAt",label:"Date",render:p=>formatDate(p.createdAt??p.created_at)}
              ]} empty="No collateral movements are available." />
            </section>}
          </div>
        </section>
      )}

{!loading && activeTab === "billing" && (
        <section className="wf-content wf-operations-view">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">FINANCIAL OPERATIONS</div><h2>Billing & Statements</h2><p>Review lender-issued borrowing fees, rebate accruals, payment records and account statements.</p></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh</button></div>
          <div className="wf-summary-grid">
            <div className="wf-summary-tile"><span>Fee bills</span><strong>{fees.length}</strong></div>
            <div className="wf-summary-tile"><span>Fee amount</span><strong>{money(fees.reduce((sum,f)=>sum+Number(f.feeAmount??f.fee_amount??0),0))}</strong></div>
            <div className="wf-summary-tile"><span>Rebate accruals</span><strong>{money(rebates.reduce((sum,r)=>sum+Number(r.amount||0),0))}</strong></div>
            <div className="wf-summary-tile"><span>Payments</span><strong>{payments.length+rebatePayments.length}</strong></div>
          </div>
          <div className="wf-panel"><div className="wf-panel-header"><h3>Borrowing fee bills</h3><span className="wf-status">{fees.length} bills</span></div>
            <DataTable rows={fees} columns={[
              {key:"id",label:"Bill ID"},{key:"loanId",label:"Loan",render:f=>f.loanId??f.loan_id??"—"},
              {key:"periodStart",label:"Period start",render:f=>formatDate(f.periodStart??f.period_start)},
              {key:"periodEnd",label:"Period end",render:f=>formatDate(f.periodEnd??f.period_end)},
              {key:"feeRate",label:"Fee rate",render:f=>f.feeRate==null&&f.fee_rate==null?"—":`${(Number(f.feeRate??f.fee_rate)*100).toFixed(4)}%`},
              {key:"feeAmount",label:"Amount",render:f=>money(f.feeAmount??f.fee_amount)},
              {key:"dueDate",label:"Due date",render:f=>formatDate(f.dueDate??f.due_date)},
              {key:"status",label:"Status",render:f=><span className="wf-status">{f.status||"—"}</span>}
            ]} empty="No fee bills have been issued." />
          </div>
          <div className="wf-panel"><div className="wf-panel-header"><h3>Daily accruals</h3><span className="wf-status">{accruals.length} entries</span></div>
            <DataTable rows={accruals} columns={[
              {key:"id",label:"Accrual ID"},{key:"loanId",label:"Loan",render:a=>a.loanId??a.loan_id??"—"},
              {key:"accrualDate",label:"Date",render:a=>formatDate(a.accrualDate??a.accrual_date)},
              {key:"type",label:"Type"},{key:"baseValue",label:"Base value",render:a=>money(a.baseValue??a.base_value)},
              {key:"rate",label:"Rate",render:a=>a.rate==null?"—":`${(Number(a.rate)*100).toFixed(4)}%`},
              {key:"amount",label:"Accrued amount",render:a=>money(a.amount)}
            ]} empty="No daily accruals have been reported." />
          </div>
          <div className="wf-panel"><div className="wf-panel-header"><h3>Cash collateral rebates</h3><span className="wf-status">{rebates.length} accruals</span></div>
            <DataTable rows={rebates} columns={[
              {key:"id",label:"Rebate ID"},{key:"loanId",label:"Loan",render:r=>r.loanId??r.loan_id??"—"},
              {key:"rebateRate",label:"Rebate rate",render:r=>r.rebateRate==null&&r.rebate_rate==null?"—":`${(Number(r.rebateRate??r.rebate_rate)*100).toFixed(4)}%`},
              {key:"amount",label:"Accrued amount",render:r=>money(r.amount)},
              {key:"accrualDate",label:"Accrual date",render:r=>formatDate(r.accrualDate??r.accrual_date)},
              {key:"nextPaymentDate",label:"Next payment",render:r=>formatDate(r.nextPaymentDate??r.next_payment_date)},
              {key:"status",label:"Status",render:r=><span className="wf-status">{r.status||"—"}</span>}
            ]} empty="No rebate accruals have been reported." />
          </div>
          <div className="wf-panel"><div className="wf-panel-header"><h3>Payments & rebate payments</h3><span className="wf-status">{payments.length+rebatePayments.length} records</span></div>
            <DataTable rows={[...payments.map(p=>({...p,recordType:p.type??"PAYMENT"})),...rebatePayments.map(p=>({...p,recordType:"REBATE"}))]} columns={[
              {key:"id",label:"Payment ID"},{key:"recordType",label:"Type"},{key:"feeId",label:"Fee",render:p=>p.feeId??p.fee_id??"—"},
              {key:"amount",label:"Amount",render:p=>money(p.amount)},{key:"status",label:"Status",render:p=><span className="wf-status">{p.status||"—"}</span>},
              {key:"createdAt",label:"Created",render:p=>formatDate(p.createdAt??p.created_at)},
              {key:"confirmedAt",label:"Confirmed",render:p=>formatDate(p.confirmedAt??p.confirmed_at)}
            ]} empty="No payment records are available." />
          </div>
          <div className="wf-panel wf-statement-panel"><div><h3>Account statement</h3><p>Download the organization statement generated by borrower-service.</p></div>
            <a className="wf-primary wf-statement-link" href={`${import.meta.env.VITE_BORROWER_API}${base}/statement.csv`} target="_blank" rel="noreferrer">Download CSV statement ↓</a>
          </div>
          <div className="wf-info">Fee bills, daily accruals, rebate calculations and payment confirmations are read-only financial projections. Their owning services determine amounts and settlement; the borrower workspace does not recalculate them.</div>
        </section>
      )}

      {!loading && activeTab === "settlements" && (
        <section className="wf-content wf-operations-view wf-tabbed-workspace">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">POST-TRADE OPERATIONS</div><h2>Settlements & Returns</h2><p>Monitor return instructions, settlement confirmations and outstanding borrowed quantities.</p></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh</button></div>
          <div className="wf-summary-grid">
            <div className="wf-summary-tile"><span>Total return instructions</span><strong>{loanReturns.length}</strong></div>
            <div className="wf-summary-tile"><span>Awaiting confirmation</span><strong>{loanReturns.filter(r=>["REQUESTED","PENDING","IN_PROGRESS"].includes(String(r.status||"").toUpperCase())).length}</strong></div>
            <div className="wf-summary-tile"><span>Settled returns</span><strong>{loanReturns.filter(r=>String(r.status||"").toUpperCase()==="SETTLED").length}</strong></div>
            <div className="wf-summary-tile"><span>Outstanding borrowed units</span><strong>{loans.reduce((sum,l)=>sum+Number(l.outstandingQuantity??l.outstanding_quantity??0),0).toLocaleString("en-IN")}</strong></div>
          </div>
          <div className="wf-work-tabs" role="tablist" aria-label="Settlement and return views">
            <button type="button" className={settlementTab==="register"?"active":""} onClick={()=>setSettlementTab("register")}>Return settlement register <span>{loanReturns.length}</span></button>
            <button type="button" className={settlementTab==="initiate"?"active":""} onClick={()=>setSettlementTab("initiate")}>Initiate a loan return</button>
          </div>
          <div className="wf-tab-panel">
            {settlementTab==="register" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Return settlement register</h3><small>Track each return instruction through external confirmation.</small></div><span className="wf-status">{loanReturns.length} instructions</span></div>
              <DataTable rows={loanReturns} columns={[
                {key:"id",label:"Return ID"},{key:"loanId",label:"Loan",render:r=>r.loanId??r.loan_id??"—"},
                {key:"recallId",label:"Recall",render:r=>r.recallId??r.recall_id??"—"},
                {key:"quantity",label:"Quantity"},{key:"status",label:"Settlement status",render:r=><span className="wf-status">{r.status||"—"}</span>},
                {key:"requestedAt",label:"Requested",render:r=>formatDate(r.requestedAt??r.requested_at)},
                {key:"settledAt",label:"Settled",render:r=>formatDate(r.settledAt??r.settled_at)}
              ]} empty="No return instructions have been submitted." />
            </section>}
            {settlementTab==="initiate" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Initiate a loan return</h3><small>Submit a partial or full return against an eligible loan.</small></div><span className="wf-status">Borrower instruction</span></div>
              <div className="wf-return-loan-grid">{loans.filter(l=>Number(l.outstandingQuantity??l.outstanding_quantity??l.quantity??0)>0&&!["PENDING","REQUESTED","REJECTED","CLOSED","CANCELLED"].includes(String(l.status||"").toUpperCase())).map(loan=>{
                const outstanding=Number(loan.outstandingQuantity??loan.outstanding_quantity??loan.quantity??0);
                return <form className="wf-return-loan-card" key={loan.id} onSubmit={e=>submitLoanReturn(e,loan)}>
                  <div><strong>Loan #{loan.id}</strong><span className="wf-status">{loan.status||"—"}</span></div>
                  <p>Security #{loan.securityId??loan.security_id??"—"} · {outstanding.toLocaleString("en-IN")} units outstanding</p>
                  <Field label="Return quantity"><input name="quantity" type="number" min="1" max={outstanding} step="1" required placeholder={`Maximum ${outstanding}`}/></Field>
                  <button className="wf-primary" type="submit" disabled={returnSubmitting===`loan-${loan.id}`}>{returnSubmitting===`loan-${loan.id}`?"Submitting…":"Submit return instruction"}</button>
                </form>;
              })}{!loans.some(l=>Number(l.outstandingQuantity??l.outstanding_quantity??l.quantity??0)>0&&!["PENDING","REQUESTED","REJECTED","CLOSED","CANCELLED"].includes(String(l.status||"").toUpperCase()))&&<div className="wf-empty-state">There are no settled loans with outstanding quantities eligible for return.</div>}</div>
            </section>}
          </div>
          <div className="wf-info">Return instructions are not proof of settlement. Borrowed quantities are reduced only when the external settlement owner publishes a return confirmation.</div>
        </section>
      )}

{!loading && activeTab === "recalls" && (
        <section className="wf-content wf-recalls-view wf-tabbed-workspace">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">LOAN OBLIGATIONS</div><h2>Recall Management</h2><p>Review lender-issued recall notices and track submitted return instructions.</p></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh</button></div>
          <div className="wf-summary-grid">
            <div className="wf-summary-tile"><span>Total recalls</span><strong>{recalls.length}</strong></div>
            <div className="wf-summary-tile"><span>Open recalls</span><strong>{recalls.filter(r=>!["FULFILLED","CANCELLED"].includes(String(r.status||"").toUpperCase())).length}</strong></div>
            <div className="wf-summary-tile"><span>Outstanding recall units</span><strong>{recalls.reduce((sum,r)=>sum+Math.max(0,Number(r.quantity||0)-Number(r.fulfilledQuantity??r.fulfilled_quantity??0)),0).toLocaleString("en-IN")}</strong></div>
            <div className="wf-summary-tile"><span>Return requests</span><strong>{loanReturns.length}</strong></div>
          </div>
          <div className="wf-work-tabs" role="tablist" aria-label="Recall management views">
            <button type="button" className={recallTab==="register"?"active":""} onClick={()=>setRecallTab("register")}>Incoming recall register <span>{recalls.length}</span></button>
            <button type="button" className={recallTab==="history"?"active":""} onClick={()=>setRecallTab("history")}>Return instruction history <span>{loanReturns.length}</span></button>
          </div>
          <div className="wf-tab-panel">
            {recallTab==="register" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Incoming recall register</h3><small>Respond to open recalls by submitting return quantities.</small></div><span className="wf-status">{recalls.length} records</span></div>
              <p className="wf-help">Recall records are read-only projections from the lender/lifecycle owner. A submitted return does not itself mark a recall fulfilled.</p>
              <div className="wf-table-wrap"><table className="wf-table">
                <thead><tr><th>Recall ID</th><th>Loan</th><th>Reason</th><th>Recall quantity</th><th>Fulfilled</th><th>Outstanding</th><th>Due</th><th>Status / Action</th></tr></thead>
                <tbody>{recalls.length ? recalls.map(recall=>{
                  const loan=loans.find(item=>String(item.id)===String(recall.loanId??recall.loan_id));
                  const fulfilled=Number(recall.fulfilledQuantity??recall.fulfilled_quantity??0);
                  const outstanding=Math.max(0,Number(recall.quantity||0)-fulfilled);
                  const canRespond=outstanding>0&&!["FULFILLED","CANCELLED"].includes(String(recall.status||"").toUpperCase());
                  return <Fragment key={recall.id}>
                    <tr><td><strong>{recall.externalId??recall.external_id??recall.id}</strong></td><td>#{recall.loanId??recall.loan_id??"—"}</td><td>{recall.reason||"—"}</td><td>{recall.quantity??"—"}</td><td>{fulfilled}</td><td><strong>{outstanding}</strong></td><td>{formatDate(recall.dueAt??recall.due_at)}</td><td><span className="wf-status">{recall.status||"—"}</span></td></tr>
                    {canRespond && <tr className="wf-expanded-row"><td colSpan={8}><form className="wf-expanded-content wf-inline-form" onSubmit={e=>submitLoanReturn(e,loan,recall)}>
                      <div className="wf-subheading"><div><h4>Return against recall #{recall.id}</h4><p>Loan #{recall.loanId??recall.loan_id} · {outstanding} units remain to be fulfilled.</p></div></div>
                      <div className="wf-form-grid"><Field label={`Return quantity (max ${outstanding})`}><input name="quantity" type="number" min="1" max={outstanding} step="1" required /></Field></div>
                      <div className="wf-actions"><button className="wf-primary" type="submit" disabled={!loan||returnSubmitting===`recall-${recall.id}`}>{returnSubmitting===`recall-${recall.id}`?"Submitting…":"Submit recall return"}</button></div>
                      {!loan&&<small className="wf-help">Associated loan record unavailable. Refresh before responding.</small>}
                    </form></td></tr>}
                  </Fragment>;
                }) : <tr><td colSpan={8} className="wf-empty">No recall notices have been received.</td></tr>}</tbody>
              </table></div>
            </section>}
            {recallTab==="history" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Return instruction history</h3><small>Submitted instructions and external settlement status.</small></div><span className="wf-status">{loanReturns.length} requests</span></div>
              <DataTable rows={loanReturns} columns={[
                {key:"id",label:"Return ID"},{key:"loanId",label:"Loan",render:r=>r.loanId??r.loan_id??"—"},
                {key:"recallId",label:"Recall",render:r=>r.recallId??r.recall_id??"—"},{key:"quantity",label:"Quantity"},
                {key:"status",label:"Status",render:r=><span className="wf-status">{r.status||"—"}</span>},
                {key:"requestedAt",label:"Requested",render:r=>formatDate(r.requestedAt??r.requested_at)},
                {key:"settledAt",label:"Settled",render:r=>formatDate(r.settledAt??r.settled_at)}
              ]} empty="No return instructions have been submitted." />
            </section>}
          </div>
        </section>
      )}

{!loading && activeTab === "msla" && (
        <section className="wf-content wf-msla-dashboard">
          <div className="wf-section-heading">
            <div>
              <div className="wf-eyebrow">SECURITIES FINANCE / CONTRACTS</div>
              <h2>Agreements</h2>
              <p>Manage master securities lending agreements and proposed terms.</p>
            </div>
          </div>
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

            {isCreatingAgreement && (              <form className="wf-msla-create-form" onSubmit={submitAgreement}>
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
                      onChange={(e) => updateAgreement("marginHours", e.target.value)} />                  </Field>
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
                            <option key={s.id} value={s.id}>{s.symbol || s.name || `Security #${s.id}`}</option>                          ))}
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
                      <Fragment key={agreement.id}>
                        <tr className={expanded ? "wf-selected-row" : ""}>
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
                      </Fragment>
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
             <h3>New MSLA proposal</h3>  <form onSubmit={submitAgreement}>
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
                 <Field label="Fee rate (decimal)">                   <input type="number" min="0" max="1" step="0.0001" required
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
                 </Field>                 <Field label="Recall response (hours)">
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
        <section className="wf-content wf-operations-view wf-tabbed-workspace">
          <div className="wf-section-heading">
            <div>
              <div className="wf-eyebrow">AVAILABILITY DISCOVERY</div>
              <h2>Borrow / Locate</h2>
              <p>Submit locate requests, monitor lender responses and review automatically generated reservations. Security availability is not exposed in this portal.</p>
            </div>
            <button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh</button>
          </div>

          <div className="wf-summary-grid">
            <div className="wf-summary-tile"><span>Locate requests</span><strong>{locates.length}</strong></div>
            <div className="wf-summary-tile"><span>Awaiting response</span><strong>{locates.filter(item => ["PENDING", "SUBMITTED", "REQUESTED"].includes(String(item.status || "").toUpperCase())).length}</strong></div>
            <div className="wf-summary-tile"><span>Approved locates</span><strong>{approvedLocates.length}</strong></div>
            <div className="wf-summary-tile"><span>Reservations</span><strong>{reservations.length}</strong></div>
          </div>

          <div className="wf-work-tabs" role="tablist" aria-label="Borrow and locate workspace views">
            <button type="button" role="tab" aria-selected={locateSubTab === "create"} className={locateSubTab === "create" ? "active" : ""} onClick={() => setLocateSubTab("create")}>Create Locate Request</button>
            <button type="button" role="tab" aria-selected={locateSubTab === "register"} className={locateSubTab === "register" ? "active" : ""} onClick={() => setLocateSubTab("register")}>Locate Request Register <span>{locates.length}</span></button>
            <button type="button" role="tab" aria-selected={locateSubTab === "reservations"} className={locateSubTab === "reservations" ? "active" : ""} onClick={() => setLocateSubTab("reservations")}>Automatic Reservation Register <span>{reservations.length}</span></button>
          </div>

          <div className="wf-tab-panel">
            {locateSubTab === "create" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Create locate request</h3><small>Ask a lender to locate a security under an active MSLA.</small></div><span className="wf-status">Borrower instruction</span></div>
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
                <div className="wf-info">Submitting a locate request does not reveal lender inventory. The lender reviews availability and responds through the locate workflow.</div>
                <div className="wf-actions">
                  <button className="wf-primary" type="submit">Submit locate request</button>
                </div>
              </form>
            </section>}

            {locateSubTab === "register" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Locate request register</h3><small>Track submitted requests and lender responses.</small></div><span className="wf-status">{locates.length} requests</span></div>
              <div className="wf-table-wrap"><table className="wf-table">
                <thead><tr><th>Request ID</th><th>Agreement</th><th>Security</th><th>Requested quantity</th><th>Locate status</th><th>Expires</th><th>Lifecycle</th></tr></thead>
                <tbody>{locates.length ? locates.map(locate => {
                  const status = String(locate.status || "SUBMITTED").toUpperCase();
                  const locateExpanded = String(expandedLocateId) === String(locate.id);
                  const steps = [
                    { label: "Submitted", done: true },
                    { label: "Under review", done: ["UNDER_REVIEW","IN_REVIEW","APPROVED","PARTIALLY_APPROVED","REJECTED"].includes(status) },
                    { label: status === "REJECTED" ? "Rejected" : "Decision", done: ["APPROVED","PARTIALLY_APPROVED","REJECTED"].includes(status) },
                    { label: "Reservation", done: reservations.some(item => String(item.locateId ?? item.locate_id ?? item.locateRequestId) === String(locate.id)) },
                  ];
                  const relatedReservation = reservations.find(item => String(item.locateId ?? item.locate_id ?? item.locateRequestId) === String(locate.id));
                  return <Fragment key={locate.id}>
                    <tr className={locateExpanded ? "wf-selected-row" : ""}>
                      <td><strong>#{locate.id}</strong></td><td>{locate.agreementId ?? locate.mslaId ?? locate.msla_id ?? "—"}</td>
                      <td>{locate.securityId ?? locate.security_id ?? "—"}</td><td>{locate.quantity ?? "—"}</td>
                      <td><span className="wf-status">{status.replaceAll("_"," ")}</span></td><td>{formatDate(locate.expiresAt ?? locate.expires_at)}</td>
                      <td><button type="button" className="wf-small-button" onClick={() => setExpandedLocateId(locateExpanded ? null : String(locate.id))}>{locateExpanded ? "Hide" : "Track status"}</button></td>
                    </tr>
                    {locateExpanded && <tr className="wf-expanded-row"><td colSpan={7}><div className="wf-expanded-content">
                      <div className="wf-child-header"><h3>Locate request #{locate.id}</h3><span>{locate.quantity ?? "—"} units requested</span></div>
                      <div className="wf-lifecycle-track">{steps.map((step,index) => <div key={step.label} className={step.done ? "wf-lifecycle-step complete" : "wf-lifecycle-step"}><span>{step.done ? "✓" : index+1}</span><strong>{step.label}</strong></div>)}</div>
                      <div className="wf-summary-grid">
                        <div className="wf-summary-tile"><span>Requested quantity</span><strong>{Number(locate.quantity || 0).toLocaleString("en-IN")}</strong></div>
                        <div className="wf-summary-tile"><span>Approved quantity</span><strong>{locate.approvedQuantity ?? locate.approved_quantity ?? relatedReservation?.quantity ?? "—"}</strong></div>
                        <div className="wf-summary-tile"><span>Reservation</span><strong>{relatedReservation ? `#${relatedReservation.id} · ${relatedReservation.status || "Pending"}` : "Awaiting lender decision"}</strong></div>
                        <div className="wf-summary-tile"><span>Decision note</span><strong>{locate.reason ?? locate.rejectionReason ?? locate.rejection_reason ?? "—"}</strong></div>
                      </div>
                      <p className="wf-help">Lender inventory and available quantities remain confidential. This timeline shows only the response and reservation outcome for your request.</p>
                    </div></td></tr>}
                  </Fragment>;
                }) : <tr><td colSpan={7} className="wf-empty">No locate requests have been submitted.</td></tr>}</tbody>
              </table></div>
            </section>}

            {locateSubTab === "reservations" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Reservation request register</h3><small>Submit reservation instructions to the lender for approved locate requests.</small></div><span className="wf-status">{reservations.length} requests</span></div>
              <p className="wf-help">An approved locate does not reserve securities automatically. Select an approved locate below and send a reservation request. The lender must review and confirm it before the quantity becomes available for loan creation.</p>
              <h3 className="wf-child-title">Approved locates awaiting reservation request</h3>
              <div className="wf-table-wrap">
                <table className="wf-table">
                  <thead><tr><th>Locate ID</th><th>Security</th><th>Requested</th><th>Approved</th><th>Expiry</th><th>Action</th></tr></thead>
                  <tbody>
                    {approvedLocates.filter(locate => !reservations.some(r => String(r.locateId ?? r.locate_id ?? r.locateRequestId) === String(locate.id))).length
                      ? approvedLocates.filter(locate => !reservations.some(r => String(r.locateId ?? r.locate_id ?? r.locateRequestId) === String(locate.id))).map(locate => (
                        <tr key={locate.id}>
                          <td><strong>#{locate.id}</strong></td>
                          <td>{securities.find(s => String(s.id) === String(locate.securityId ?? locate.security_id))?.symbol ?? (locate.securityId ?? locate.security_id ?? "—")}</td>
                          <td>{Number(locate.quantity ?? 0).toLocaleString("en-IN")}</td>
                          <td><strong>{Number(locate.approvedQuantity ?? locate.approved_quantity ?? 0).toLocaleString("en-IN")}</strong></td>
                          <td>{formatDate(locate.expiresAt ?? locate.expires_at)}</td>
                          <td><button type="button" className="wf-small-button" onClick={() => reserveLocate(locate)}>Send to lender</button></td>
                        </tr>
                      )) : <tr><td colSpan={6} className="wf-empty">No approved locate requests are awaiting a reservation instruction.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="wf-panel-header wf-reservation-list-heading"><div><h3>Reservation requests sent</h3><small>Track lender decisions and remaining quantities.</small></div></div>
              <DataTable rows={reservations} columns={[
                { key: "id", label: "Request ID" },
                { key: "locateId", label: "Locate ID", render: r => r.locateId ?? r.locate_id ?? "—" },
                { key: "quantity", label: "Requested quantity" },
                { key: "remainingQuantity", label: "Remaining quantity", render: r => r.remainingQuantity ?? r.remaining_quantity ?? "—" },
                { key: "status", label: "Lender decision", render: r => <span className="wf-status">{String(r.status || "PENDING").replaceAll("_"," ")}</span> },
                { key: "expiresAt", label: "Expires", render: r => formatDate(r.expiresAt ?? r.expires_at) },
              ]} empty="No reservation requests have been sent to lenders." />
            </section>}
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
                       onChange={(e) => setLoanForm({ ...loanForm, cashAmount: e.target.value })} />                   </Field>
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
             <div className="wf-panel-header"><h3>Loan register & lifecycle</h3><span className="wf-status">{loans.length} loans</span></div>
             <p className="wf-help">Track each loan from request through settlement, partial returns and closure. Returns remain pending until the lifecycle owner confirms settlement.</p>
             <div className="wf-table-wrap"><table className="wf-table">
               <thead><tr><th>Loan ID</th><th>Security</th><th>Requested</th><th>Outstanding</th><th>Status</th><th>Settled</th><th>Closed</th><th>Details</th></tr></thead>
               <tbody>{loans.length ? loans.map(loan => {
                 const outstanding = Number(loan.outstandingQuantity ?? loan.outstanding_quantity ?? loan.quantity ?? 0);
                 const loanExpanded = String(expandedLoanId) === String(loan.id);
                 const history = loanReturns.filter(item => String(item.loanId ?? item.loan_id) === String(loan.id));
                 const loanRecalls = recalls.filter(item => String(item.loanId ?? item.loan_id) === String(loan.id));
                 const status = String(loan.status || "PENDING").toUpperCase();
                 const canReturn = outstanding > 0 && !["PENDING", "REQUESTED", "REJECTED", "CLOSED", "CANCELLED"].includes(status);
                 return <Fragment key={loan.id}>
                   <tr className={loanExpanded ? "wf-selected-row" : ""}>
                     <td><strong>#{loan.id}</strong></td><td>{loan.securityId ?? loan.security_id ?? "—"}</td><td>{loan.quantity ?? "—"}</td><td><strong>{outstanding}</strong></td>
                     <td><span className="wf-status">{status}</span></td><td>{formatDate(loan.settledAt ?? loan.settled_at ?? loan.settledOn ?? loan.settled_on)}</td><td>{formatDate(loan.closedAt ?? loan.closed_at)}</td>
                     <td><div className="wf-row-actions"><button type="button" className="wf-icon-button" title="View lifecycle" aria-label={`View lifecycle for loan ${loan.id}`} onClick={() => setExpandedLoanId(loanExpanded ? null : String(loan.id))}>{loanExpanded ? "▾" : "▸"}</button><button type="button" className="wf-icon-button" title="View loan details" aria-label={`View loan ${loan.id} details`} onClick={() => setDetailView({type:"LOAN",record:loan})}>◉</button></div></td>
                   </tr>
                   {loanExpanded && <tr className="wf-expanded-row"><td colSpan={8}><div className="wf-expanded-content">
                     <div className="wf-child-header"><h3>Loan #{loan.id} lifecycle</h3><span>{outstanding} units outstanding</span></div>
                     <div className="wf-lifecycle-track">
                       {[
                         ["REQUESTED", ["REQUESTED","PENDING","SETTLED","ACTIVE","RETURN_IN_PROGRESS","PARTIALLY_RETURNED","CLOSED","FULLY_RETURNED"].includes(status)],
                         ["SETTLED", Boolean(loan.settledAt ?? loan.settled_at ?? ["SETTLED","ACTIVE","RETURN_IN_PROGRESS","PARTIALLY_RETURNED","CLOSED","FULLY_RETURNED"].includes(status))],
                         ["RETURN IN PROGRESS", ["RETURN_IN_PROGRESS","PARTIALLY_RETURNED"].includes(status) || history.some(item => ["REQUESTED","PENDING","IN_PROGRESS","SUBMITTED"].includes(String(item.status || "").toUpperCase()))],
                         ["CLOSED", ["CLOSED","FULLY_RETURNED"].includes(status) || outstanding === 0],
                       ].map(([label,done],index) => <div className={done ? "wf-lifecycle-step complete" : "wf-lifecycle-step"} key={label}><span>{done ? "✓" : index+1}</span><strong>{label}</strong></div>)}
                     </div>
                     <div className="wf-summary-grid">
                       <div className="wf-summary-tile"><span>Original quantity</span><strong>{Number(loan.quantity || 0).toLocaleString("en-IN")}</strong></div>
                       <div className="wf-summary-tile"><span>Outstanding</span><strong>{outstanding.toLocaleString("en-IN")}</strong></div>
                       <div className="wf-summary-tile"><span>Return requests</span><strong>{history.length}</strong></div>
                       <div className="wf-summary-tile"><span>Open recalls</span><strong>{loanRecalls.filter(item => !["FULFILLED","CANCELLED"].includes(String(item.status || "").toUpperCase())).length}</strong></div>
                     </div>
                     <h4>Return history</h4>
                     <DataTable rows={history} columns={[
                       {key:"id",label:"Return ID"},{key:"quantity",label:"Quantity"},{key:"recallId",label:"Recall",render:r=>r.recallId ?? r.recall_id ?? "—"},
                       {key:"status",label:"Status",render:r=><span className="wf-status">{r.status || "—"}</span>},
                       {key:"requestedAt",label:"Requested",render:r=>formatDate(r.requestedAt ?? r.requested_at)},
                       {key:"settledAt",label:"Settled",render:r=>formatDate(r.settledAt ?? r.settled_at)}
                     ]} empty="No return requests have been submitted for this loan." />
                     {canReturn && <form className="wf-inline-form" onSubmit={e => submitLoanReturn(e,loan)}>
                       <div className="wf-subheading"><div><h4>Initiate partial or full return</h4><p>Submit a return instruction. The outstanding quantity is updated only after confirmation.</p></div></div>
                       <div className="wf-form-grid"><Field label={`Return quantity (max ${outstanding})`}><input name="quantity" type="number" min="1" max={outstanding} step="1" required /></Field></div>
                       <div className="wf-actions"><button className="wf-primary" type="submit" disabled={returnSubmitting === `loan-${loan.id}`}>{returnSubmitting === `loan-${loan.id}` ? "Submitting…" : "Submit return request"}</button></div>
                     </form>}
                   </div></td></tr>}
                 </Fragment>;
               }) : <tr><td colSpan={8} className="wf-empty">No loan records available.</td></tr>}</tbody>
             </table></div>
           </div>}

           {loanSubTab === "margin" && <div className="wf-panel">
             <div className="wf-panel-header"><h3>Loan margin calls & collateral</h3><span className="wf-status">{marginCalls.length} margin calls</span></div>
             <p className="wf-help">Margin calls are raised by the lender's valuation process. Respond against the specific loan by pledging eligible cash or securities.</p>
             <div className="wf-summary-grid wf-margin-summary">
               <div className="wf-summary-tile"><span>Open / overdue</span><strong>{marginCalls.filter(call => ["OPEN","PARTIALLY_FULFILLED","OVERDUE"].includes(String(call.status || "").toUpperCase())).length}</strong></div>
               <div className="wf-summary-tile"><span>Fully fulfilled</span><strong>{marginCalls.filter(call => ["FULFILLED","CLOSED","SATISFIED"].includes(String(call.status || "").toUpperCase())).length}</strong></div>
               <div className="wf-summary-tile"><span>Total calls</span><strong>{marginCalls.length}</strong></div>
               <div className="wf-summary-tile"><span>Responses pending</span><strong>{collateralPositions.filter(position => ["PENDING","SUBMITTED","PENDING_CONFIRMATION"].includes(String(position.status || "").toUpperCase())).length}</strong></div>
             </div>
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
                         <Field label="Collateral asset type"><select name="assetType" value={marginAssetTypes[call.id] || "CASH"} onChange={e => setMarginAssetTypes(current => ({ ...current, [call.id]: e.target.value }))}><option value="CASH">Cash</option><option value="SECURITY">Security</option></select></Field>
                         <Field label="Cash amount (INR)"><input name="cashAmount" type="number" min="0.01" step="0.01" disabled={(marginAssetTypes[call.id] || "CASH") !== "CASH"} required={(marginAssetTypes[call.id] || "CASH") === "CASH"} placeholder="Enter cash amount" /></Field>
                         <Field label="Security"><select name="securityId" defaultValue="" disabled={(marginAssetTypes[call.id] || "CASH") !== "SECURITY"} required={(marginAssetTypes[call.id] || "CASH") === "SECURITY"}><option value="">Select security</option>{securities.map(security => <option key={security.id} value={security.id}>{security.symbol} — {security.name}</option>)}</select></Field>
                         <Field label="Security quantity"><input name="quantity" type="number" min="1" step="1" disabled={(marginAssetTypes[call.id] || "CASH") !== "SECURITY"} required={(marginAssetTypes[call.id] || "CASH") === "SECURITY"} /></Field>
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
                       { key: "nextPaymentDate", label: "Next payment", render: r => formatDate(r.nextPaymentDate ?? r.paymentDate ?? r.payment_date) },                       { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
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