import { Fragment, useEffect, useMemo, useState } from "react";
import { getData, getMarketData, postData, putData } from "../../api/borrowerApi";
import "./BorrowerWorkflow.css";
import SecurityPriceChart from "../../components/SecurityPriceChart";
import DataTable from "../../components/common/DataTable";
import MetricStrip from "../../components/common/MetricStrip";

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

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
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
 
export default function BorrowerWorkflow() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loanSubTab, setLoanSubTab] = useState("create");
  const [holdingsSubTab, setHoldingsSubTab] = useState("owned");
  const [billingSubTab, setBillingSubTab] = useState("fees");
  const [movementSubTab, setMovementSubTab] = useState("cash");
  const [expandedMarginLoanId, setExpandedMarginLoanId] = useState(null);
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
    () => reservations.filter((reservation) =>
      ["ACTIVE", "CONFIRMED", "APPROVED", "RESERVED"].includes(
        String(reservation.status ?? reservation.reservationStatus ?? reservation.reservation_status ?? "")
          .trim()
          .toUpperCase()
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
    `${s.symbol ?? s.ticker ?? ""} ${s.name ?? s.description ?? ""} ${s.isin ?? s.ISIN ?? s.isinCode ?? ""} ${s.id ?? s.securityId ?? ""}`
      .toLowerCase().includes(securitySearch.toLowerCase())
  );
 
  const renderOrderTicket = () => (          <section className="wf-panel wf-order-panel">
            <div className="wf-panel-header"><h2>Order ticket</h2><span className="wf-status">Paper execution</span></div>
            {selectedTradeSecurity && <div className="wf-selected-security">
              <div><strong>{selectedTradeSecurity.symbol ?? selectedTradeSecurity.ticker ?? "—"}</strong><span>{selectedTradeSecurity.name ?? selectedTradeSecurity.description ?? "Listed security"}</span></div>
              <dl><div><dt>ISIN</dt><dd>{selectedTradeSecurity.isin ?? selectedTradeSecurity.ISIN ?? selectedTradeSecurity.isinCode ?? "—"}</dd></div><div><dt>Security ID</dt><dd>{selectedTradeSecurity.id ?? selectedTradeSecurity.securityId ?? "—"}</dd></div><div><dt>Exchange</dt><dd>{selectedTradeSecurity.exchange ?? selectedTradeSecurity.market ?? "—"}</dd></div></dl>
            </div>}
            <div className="wf-account-balance"><span>Available cash balance</span><strong>{money(account?.available)}</strong></div>
            <div className="wf-trade-switch"><button type="button" className={tradeSide==="BUY"?"buy active":"buy"} onClick={()=>setTradeSide("BUY")}>Buy</button><button type="button" className={tradeSide==="SELL"?"sell active":"sell"} onClick={()=>setTradeSide("SELL")}>Sell</button></div>
            <form onSubmit={submitTrade}><div className="wf-form-grid">
              <Field label="Security"><input readOnly value={selectedTradeSecurity?.symbol ?? selectedTradeSecurity?.ticker ?? ""} placeholder="Select a security"/></Field>
              <Field label="Current price"><input readOnly value={currentTradePrice > 0 ? money(currentTradePrice) : "Price unavailable"}/></Field>
              <Field label="Order type"><select value={tradeOrderType} onChange={e=>setTradeOrderType(e.target.value)}><option value="MARKET">Market</option><option value="LIMIT">Limit</option></select></Field>
              {tradeOrderType === "LIMIT" && <Field label="Limit price"><input type="number" min="0.000001" step="0.01" required value={tradeLimitPrice} onChange={e=>setTradeLimitPrice(e.target.value)} placeholder="Enter limit price"/></Field>}
              <Field label="Quantity"><input type="number" min="1" step="1" required value={tradeQuantity} onChange={e=>setTradeQuantity(e.target.value)} placeholder="Enter quantity"/></Field>
              <Field label="Position source"><select value={tradeSource} onChange={e=>setTradeSource(e.target.value)}><option value="OWNED">Owned position / cash</option><option value="BORROWED">Borrowed position</option></select></Field>
            </div>
            <div className="wf-order-estimate"><div><span>Estimated order value</span><strong>{money(estimatedOrderTotal)}</strong></div><small>Calculated from the latest available completed-minute price.</small></div>
            <button className="wf-primary wf-submit-order" type="submit" disabled={orderSubmitting || !selectedTradeSecurity || !currentTradePrice}>{orderSubmitting ? "Submitting…" : `Place ${tradeSide.toLowerCase()} order`}</button></form>
          </section>);

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
      <header className="wf-topbar">
        <div className="wf-topbar-brand"><span className="wf-topbar-mark">B</span><strong>BorrowDesk</strong></div>
        <div className="wf-topbar-context"><strong>Borrower Organization #{orgId}</strong><span>Borrower operations</span></div>
        <div className="wf-topbar-search"><span>⌕</span><span>Search securities, loans, counterparties, agreements...</span><kbd>⌘ K</kbd></div>
        <div className="wf-topbar-actions"><span className="wf-demo-chip">DEMO DATA</span><span className="wf-topbar-bell" aria-label="Notifications">♧</span><span className="wf-topbar-avatar">BO</span></div>
      </header>
      <div className="wf-workspace">
        <aside className={`wf-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
          <button type="button" className="wf-sidebar-toggle" onClick={() => setSidebarCollapsed(value => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "›" : "‹"}</button>
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
            <button className={activeTab === "loans" && loanSubTab === "margin" ? "active" : ""} onClick={() => { setActiveTab("loans"); setLoanSubTab("margin"); }} title="Margin calls"><span className="wf-nav-icon">◈</span><span>Margin calls <em className="wf-nav-count">{marginCalls.filter(call => ["OPEN","PARTIALLY_FULFILLED","OVERDUE"].includes(String(call.status || "").toUpperCase())).length}</em></span></button>
            <button className={activeTab === "collateral" ? "active" : ""} onClick={() => setActiveTab("collateral")} title="Collateral"><span className="wf-nav-icon">⬡</span><span>Collateral</span></button>
            <button className={activeTab === "recalls" ? "active" : ""} onClick={() => setActiveTab("recalls")} title="Recall Management"><span className="wf-nav-icon">↩</span><span>Returns & recalls</span></button>
            <button className={activeTab === "settlements" ? "active" : ""} onClick={() => setActiveTab("settlements")} title="Settlements & Returns"><span className="wf-nav-icon">⇥</span><span>Settlements</span></button>
            <div className="wf-nav-group-label">OPERATIONS & FINANCE</div>
            <button className={activeTab === "billing" ? "active" : ""} onClick={() => setActiveTab("billing")} title="Billing & Statements"><span className="wf-nav-icon">₹</span><span>Fees & rebates</span></button>
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
          <section className="wf-panel wf-recent-activity">
            <div className="wf-panel-header"><div><h2>Recent activity</h2><small>Current organization balances and workflow volumes</small></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh data</button></div>
            <MetricStrip className="wf-summary-grid" itemClassName="wf-summary-tile" items={[
              { label: "Available cash", value: account ? money(account.available ?? account.availableCash ?? account.cashAvailable ?? 0) : "Unavailable" },
              { label: "Blocked cash", value: account ? money(account.blocked ?? account.blockedCash ?? 0) : "—" },
              { label: "Agreements", value: agreements.length },
              { label: "Locate requests", value: locates.length },
              { label: "Reservations", value: reservations.length },
              { label: "Loans", value: loans.length },
            ]} />
          </section>
          <div className="wf-dashboard-grid">
            <button className="wf-dashboard-card" onClick={() => setActiveTab("trading")}><span>MARKETS</span><strong>Trading</strong><small>Open your watchlist, view charts and prepare orders</small><b>Open trading →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("trading")}><span>MARKETS</span><strong>Search securities</strong><small>Find instruments and add them to your watchlist</small><b>Open security search →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("locates")}><span>SECURITIES FINANCE</span><strong>Borrow / Locate</strong><small>Submit locate requests to connected lenders</small><b>View requests →</b></button>
            <button className="wf-dashboard-card" onClick={() => setActiveTab("loans")}><span>OPERATIONS</span><strong>Loan requests</strong><small>Create and monitor securities borrowing loans</small><b>View loans →</b></button>
          </div>
        </section>
      )}


      {!loading && activeTab === "holdings" && (
        <section className="wf-content wf-holdings-view">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">PORTFOLIO / POSITIONS</div><h2>My Holdings</h2><p>View owned securities separately from securities borrowed under active loans.</p></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh holdings</button></div>
          <div className="wf-summary-grid wf-holdings-summary">
            <div className="wf-summary-tile"><span>Owned securities</span><strong>{holdings.filter(h=>Number(h.owned_quantity??h.ownedQuantity??0)>0).length}</strong></div>
            <div className="wf-summary-tile"><span>Owned quantity</span><strong>{holdings.reduce((sum,h)=>sum+Number(h.owned_quantity??h.ownedQuantity??0),0).toLocaleString("en-IN")}</strong></div>
            <div className="wf-summary-tile"><span>Borrowed securities</span><strong>{holdings.filter(h=>Number(h.borrowed_quantity??h.borrowedQuantity??0)>0).length}</strong></div>
            <div className="wf-summary-tile"><span>Borrowed quantity</span><strong>{holdings.reduce((sum,h)=>sum+Number(h.borrowed_quantity??h.borrowedQuantity??0),0).toLocaleString("en-IN")}</strong></div>
          </div>
          <section className="wf-panel wf-holdings-workspace">
            <div className="wf-work-tabs" role="tablist" aria-label="Holdings type">
              <button type="button" role="tab" aria-selected={holdingsSubTab==="owned"} className={holdingsSubTab==="owned"?"active":""} onClick={()=>setHoldingsSubTab("owned")}>Owned positions <span>{holdings.filter(h=>Number(h.owned_quantity??h.ownedQuantity??0)>0).length}</span></button>
              <button type="button" role="tab" aria-selected={holdingsSubTab==="borrowed"} className={holdingsSubTab==="borrowed"?"active":""} onClick={()=>setHoldingsSubTab("borrowed")}>Borrowed positions <span>{holdings.filter(h=>Number(h.borrowed_quantity??h.borrowedQuantity??0)>0).length}</span></button>
            </div>
            {holdingsSubTab==="owned" ? <div className="wf-holdings-panel-content">
              <div className="wf-panel-header"><div><h2>Owned positions</h2><small>Unpledged and unblocked owned securities available for sale.</small></div></div>
              <div className="wf-table-wrap wf-holdings-table-wrap"><table className="wf-table">
                <thead><tr><th>Security ID</th><th>Symbol</th><th>Security name</th><th>Price</th><th>Price as of</th><th>Owned qty</th><th>Pledged qty</th><th>Blocked qty</th><th>Available to sell</th><th>Action</th></tr></thead>
                <tbody>{holdings.filter(h=>Number(h.owned_quantity??h.ownedQuantity??0)>0).length ? holdings.filter(h=>Number(h.owned_quantity??h.ownedQuantity??0)>0).map(h=>{
                  const id=h.security_id??h.securityId??h.id, owned=Number(h.owned_quantity??h.ownedQuantity??0), pledged=Number(h.pledged_quantity??h.pledgedQuantity??0), blocked=Number(h.blocked_owned??h.blockedOwned??0), available=Number(h.available_owned_quantity??h.availableOwnedQuantity??Math.max(0,owned-pledged-blocked)), price=Number(h.price??0);
                  const security={id,symbol:h.symbol,name:h.name,exchange:h.exchange,price:h.price};
                  return <tr key={id}><td>{id}</td><td><strong>{h.symbol??"—"}</strong></td><td>{h.name??"—"}</td><td>{price>0?money(price):"—"}</td><td>{formatDateTime(h.price_at??h.priceAt)}</td><td>{owned.toLocaleString("en-IN")}</td><td>{pledged.toLocaleString("en-IN")}</td><td>{blocked.toLocaleString("en-IN")}</td><td><strong className="wf-holding-available">{available.toLocaleString("en-IN")}</strong></td><td><button type="button" className="wf-small-button" disabled={available<=0} onClick={()=>{setSelectedTradeSecurity(security);setSecurityHistory([]);setTradeSide("SELL");setTradeSource("OWNED");setTradeQuantity("");setActiveTab("trading");}}>Sell</button></td></tr>;
                }) : <tr><td colSpan={10} className="wf-empty">No owned positions are recorded.</td></tr>}</tbody>
              </table></div>
            </div> : <div className="wf-holdings-panel-content">
              <div className="wf-panel-header"><div><h2>Borrowed positions</h2><small>Settled borrowed inventory. Locate approvals are not included as borrowed holdings.</small></div></div>
              <div className="wf-table-wrap wf-holdings-table-wrap"><table className="wf-table">
                <thead><tr><th>Security ID</th><th>Symbol</th><th>Security name</th><th>Price</th><th>Price as of</th><th>Borrowed qty</th><th>Pledged qty</th><th>Blocked qty</th><th>Available borrowed</th><th>Action</th></tr></thead>
                <tbody>{holdings.filter(h=>Number(h.borrowed_quantity??h.borrowedQuantity??0)>0).length ? holdings.filter(h=>Number(h.borrowed_quantity??h.borrowedQuantity??0)>0).map(h=>{
                  const id=h.security_id??h.securityId??h.id, borrowed=Number(h.borrowed_quantity??h.borrowedQuantity??0), pledged=Number(h.pledged_borrowed_quantity??h.pledgedBorrowedQuantity??0), blocked=Number(h.blocked_borrowed??h.blockedBorrowed??0), available=Number(h.available_borrowed_quantity??h.availableBorrowedQuantity??Math.max(0,borrowed-blocked)), price=Number(h.price??0);
                  const security={id,symbol:h.symbol,name:h.name,exchange:h.exchange,price:h.price};
                  return <tr key={id}><td>{id}</td><td><strong>{h.symbol??"—"}</strong></td><td>{h.name??"—"}</td><td>{price>0?money(price):"—"}</td><td>{formatDateTime(h.price_at??h.priceAt)}</td><td>{borrowed.toLocaleString("en-IN")}</td><td>{pledged.toLocaleString("en-IN")}</td><td>{blocked.toLocaleString("en-IN")}</td><td><strong className="wf-holding-available">{available.toLocaleString("en-IN")}</strong></td><td><button type="button" className="wf-small-button" disabled={available<=0} onClick={()=>{setSelectedTradeSecurity(security);setSecurityHistory([]);setTradeSide("SELL");setTradeSource("BORROWED");setTradeQuantity("");setActiveTab("trading");}}>Sell</button></td></tr>;
                }) : <tr><td colSpan={10} className="wf-empty">No borrowed positions are recorded.</td></tr>}</tbody>
              </table></div>
            </div>}
          </section>
        </section>
      )}

      {!loading && activeTab === "trading" && (
        <section className="wf-content wf-trading-view">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">MARKETS / ORDER ENTRY</div><h2>Trading</h2><p>Search the security master or select an instrument from your watchlist to prepare an order.</p></div></div>
          <div className="wf-trading-layout wf-watchlist-order-layout">
            <section className="wf-panel wf-market-universe">
              <div className="wf-panel-header wf-market-universe-header">
                <div><h2>{securitySearch.trim() ? "Search results" : "My watchlist"}</h2><small>{securitySearch.trim() ? `${filteredSecurities.length} matching securities` : `${watchlist.length} securities in your watchlist`}</small></div>
                <button className="wf-secondary" type="button" onClick={loadAll} title="Refresh securities">↻</button>
              </div>
              <input className="wf-security-search wf-market-search" value={securitySearch} onChange={(e) => setSecuritySearch(e.target.value)} placeholder="Search symbol, name, ISIN or security ID…" />
              <div className="wf-market-table-wrap">
                <table className="wf-market-table">
                  <thead><tr><th>Security / Symbol</th><th>ISIN</th><th>Security ID</th><th>Actions</th></tr></thead>
                  <tbody>
                    {securitySearch.trim() ? (
                      filteredSecurities.length ? filteredSecurities.map((security) => {
                        const added = isInWatchlist(security);
                        return <tr key={security.id}>
                          <td><button type="button" className="wf-market-security-select" onClick={() => { setSecuritySearch(""); selectTradeSecurity(security); }} title="Select security for order ticket"><strong>{security.symbol ?? security.ticker ?? "—"}</strong><small>{security.name ?? security.description ?? "Listed security"}</small></button></td>
                          <td className="wf-market-isin">{security.isin ?? security.ISIN ?? security.isinCode ?? "—"}</td>
                          <td className="wf-market-id">{security.id ?? security.securityId ?? "—"}</td>
                          <td><button type="button" className={added ? "wf-market-icon added" : "wf-market-icon add"} disabled={added || addingSecurityId === security.id} onClick={() => addToWatchlist(security)} title={added ? "Already in watchlist" : "Add to watchlist"} aria-label={added ? "Already in watchlist" : "Add to watchlist"}>{added ? "✓" : "+"}</button></td>
                        </tr>;
                      }) : <tr><td colSpan={4} className="wf-empty">No securities match your search.</td></tr>
                    ) : (
                      watchlist.length ? watchlist.map((item) => {
                        const security = securities.find((candidate) => String(candidate.id) === String(item.securityId ?? item.security?.id ?? item.id)) ?? item.security ?? item;
                        const selected = String(selectedTradeSecurity?.id) === String(security.id);
                        return <tr key={security.id} className={selected ? "selected" : ""}>
                          <td><button type="button" className="wf-market-security-select" onClick={() => selectTradeSecurity(security)} title="Load security details into order ticket"><strong>{security.symbol ?? security.ticker ?? "—"}</strong><small>{security.name ?? security.description ?? "Listed security"}</small></button></td>
                          <td className="wf-market-isin">{security.isin ?? security.ISIN ?? security.isinCode ?? "—"}</td>
                          <td className="wf-market-id">{security.id ?? security.securityId ?? "—"}</td>
                          <td><button type="button" className="wf-market-icon chart" onClick={async () => { await selectTradeSecurity(security); setActiveTab("security-chart"); }} title="Open full chart" aria-label={`Open chart for ${security.symbol ?? security.name ?? "security"}`}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 16.5V3.5M3 16.5H18M6 13l3-4 3 2 5-6" /></svg></button></td>
                        </tr>;
                      }) : <tr><td colSpan={4} className="wf-empty">Your watchlist is empty. Search for a security above and add it with the + icon.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            {renderOrderTicket()}
          </div>
        </section>
      )}

      {!loading && activeTab === "security-chart" && (
        <section className="wf-content wf-security-chart-page">
          <div className="wf-section-heading">
            <div><div className="wf-eyebrow">MARKETS / CHARTING</div><h2>{selectedTradeSecurity?.symbol ?? selectedTradeSecurity?.ticker ?? "Security"} chart</h2><p>{selectedTradeSecurity?.name ?? selectedTradeSecurity?.description ?? "Instrument price history"}</p></div>
            <button type="button" className="wf-secondary" onClick={() => setActiveTab("trading")}>← Back to trading</button>
          </div>
          <div className="wf-chart-order-layout">
            <section className="wf-panel wf-full-chart-panel">
              {selectedTradeSecurity ? <SecurityPriceChart security={selectedTradeSecurity} candles={tradeCandles} loading={historyLoading} /> : <div className="wf-chart-placeholder"><h3>No security selected</h3><p>Return to Trading and choose a security from your watchlist.</p></div>}
            </section>
            {renderOrderTicket()}
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
                {key:"securityId",label:"Security",render:p=>{const id=p.securityId??p.security_id;const security=securities.find(s=>String(s.id)===String(id));return String(p.assetType??p.asset_type).toUpperCase()==="SECURITY"?(security?security.symbol+" · "+security.name:(id??"—")):"Cash";}},
                {key:"quantity",label:"Quantity",render:p=>String(p.assetType??p.asset_type).toUpperCase()==="SECURITY"?Number(p.quantity??p.securityQuantity??p.security_quantity??0).toLocaleString("en-IN"):"—"},
                {key:"cashAmount",label:"Cash amount",render:p=>String(p.assetType??p.asset_type).toUpperCase()==="CASH"?money(p.cashAmount??p.cash_amount):"—"},
                {key:"haircut",label:"Haircut",render:p=>{const raw=p.haircut??p.haircutRate??p.haircut_rate;return raw==null?"—":(Number(raw)*100).toFixed(2)+"%";}},
                {key:"status",label:"Status",render:p=><span className="wf-status">{p.status||"—"}</span>},
                {key:"action",label:"Action",render:p=><button type="button" className="wf-small-button" disabled={!["POSTED","CONFIRMED","ACTIVE"].includes(String(p.status||"").toUpperCase())} onClick={()=>requestCollateralRelease(p)}>Request release</button>}
              ]} empty="No collateral positions are recorded." />
            </section>}
            {collateralTab==="history" && <section className="wf-panel wf-tab-panel-card">
              <div className="wf-panel-header"><div><h3>Collateral movement history</h3><small>Cash and security movements are separated by asset type.</small></div><span className="wf-status">{collateralHistory.length} movements</span></div>
              <div className="wf-work-tabs" role="tablist" aria-label="Collateral movement asset type">
                <button type="button" role="tab" aria-selected={movementSubTab==="cash"} className={movementSubTab==="cash"?"active":""} onClick={()=>setMovementSubTab("cash")}>Cash movements <span>{collateralHistory.filter(m=>!(m.securityId??m.security_id)).length}</span></button>
                <button type="button" role="tab" aria-selected={movementSubTab==="security"} className={movementSubTab==="security"?"active":""} onClick={()=>setMovementSubTab("security")}>Security movements <span>{collateralHistory.filter(m=>Boolean(m.securityId??m.security_id)).length}</span></button>
              </div>
              {movementSubTab==="cash" ? <DataTable rows={collateralHistory.filter(m=>!(m.securityId??m.security_id))} columns={[
                {key:"id",label:"Movement ID"},{key:"loanId",label:"Loan",render:m=>m.loanId??m.loan_id??"—"},{key:"positionId",label:"Position",render:m=>m.positionId??m.position_id??"—"},{key:"type",label:"Movement"},{key:"amount",label:"Cash amount",render:m=>money(m.amount??m.cashAmount??m.cash_amount)},{key:"createdAt",label:"Date",render:m=>formatDate(m.createdAt??m.created_at)}
              ]} empty="No cash collateral movements are available." /> : <DataTable rows={collateralHistory.filter(m=>Boolean(m.securityId??m.security_id))} columns={[
                {key:"id",label:"Movement ID"},{key:"loanId",label:"Loan",render:m=>m.loanId??m.loan_id??"—"},{key:"positionId",label:"Position",render:m=>m.positionId??m.position_id??"—"},{key:"securityId",label:"Security ID",render:m=>m.securityId??m.security_id??"—"},{key:"securityName",label:"Security",render:m=>securities.find(s=>String(s.id)===String(m.securityId??m.security_id))?.name??"—"},{key:"type",label:"Movement"},{key:"quantity",label:"Quantity",render:m=>Number(m.quantity??0).toLocaleString("en-IN")},{key:"createdAt",label:"Date",render:m=>formatDate(m.createdAt??m.created_at)}
              ]} empty="No security collateral movements are available." />}
            </section>}
          </div>
        </section>
      )}


{!loading && activeTab === "billing" && (
        <section className="wf-content wf-operations-view wf-tabbed-workspace">
          <div className="wf-section-heading"><div><div className="wf-eyebrow">FINANCIAL OPERATIONS</div><h2>Billing & Statements</h2><p>Review borrowing fee bills, daily accruals and cash collateral rebates.</p></div><button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh</button></div>
          <div className="wf-summary-grid"><div className="wf-summary-tile"><span>Fee bills</span><strong>{fees.length}</strong></div><div className="wf-summary-tile"><span>Daily accruals</span><strong>{accruals.length}</strong></div><div className="wf-summary-tile"><span>Cash collateral rebates</span><strong>{rebates.length}</strong></div></div>
          <div className="wf-work-tabs" role="tablist" aria-label="Billing and statement views">
            <button type="button" role="tab" aria-selected={billingSubTab==="fees"} className={billingSubTab==="fees"?"active":""} onClick={()=>setBillingSubTab("fees")}>Borrowing fee bills <span>{fees.length}</span></button>
            <button type="button" role="tab" aria-selected={billingSubTab==="accruals"} className={billingSubTab==="accruals"?"active":""} onClick={()=>setBillingSubTab("accruals")}>Daily accruals <span>{accruals.length}</span></button>
            <button type="button" role="tab" aria-selected={billingSubTab==="rebates"} className={billingSubTab==="rebates"?"active":""} onClick={()=>setBillingSubTab("rebates")}>Cash collateral rebates <span>{rebates.length}</span></button>
          </div>
          <div className="wf-tab-panel">
            {billingSubTab==="fees" && <section className="wf-panel wf-tab-panel-card"><div className="wf-panel-header"><h3>Borrowing fee bills</h3><span className="wf-status">{fees.length} bills</span></div><DataTable rows={fees} columns={[
              {key:"id",label:"Bill ID"},{key:"loanId",label:"Loan",render:f=>f.loanId??f.loan_id??"—"},{key:"periodStart",label:"Period start",render:f=>formatDate(f.periodStart??f.period_start)},{key:"periodEnd",label:"Period end",render:f=>formatDate(f.periodEnd??f.period_end)},{key:"feeRate",label:"Fee rate",render:f=>f.feeRate==null&&f.fee_rate==null?"—":((Number(f.feeRate??f.fee_rate)*100).toFixed(4)+"%")},{key:"feeAmount",label:"Amount",render:f=>money(f.feeAmount??f.fee_amount)},{key:"dueDate",label:"Due date",render:f=>formatDate(f.dueDate??f.due_date)},{key:"status",label:"Status",render:f=><span className="wf-status">{f.status||"—"}</span>}
            ]} empty="No fee bills have been issued." /></section>}
            {billingSubTab==="accruals" && <section className="wf-panel wf-tab-panel-card"><div className="wf-panel-header"><h3>Daily accruals</h3><span className="wf-status">{accruals.length} entries</span></div><DataTable rows={accruals} columns={[
              {key:"id",label:"Accrual ID"},{key:"loanId",label:"Loan",render:a=>a.loanId??a.loan_id??"—"},{key:"accrualDate",label:"Date",render:a=>formatDate(a.accrualDate??a.accrual_date)},{key:"type",label:"Type"},{key:"baseValue",label:"Base value",render:a=>money(a.baseValue??a.base_value)},{key:"rate",label:"Rate",render:a=>a.rate==null?"—":((Number(a.rate)*100).toFixed(4)+"%")},{key:"amount",label:"Accrued amount",render:a=>money(a.amount)}
            ]} empty="No daily accruals have been reported." /></section>}
            {billingSubTab==="rebates" && <section className="wf-panel wf-tab-panel-card"><div className="wf-panel-header"><h3>Cash collateral rebates</h3><span className="wf-status">{rebates.length} accruals</span></div><DataTable rows={rebates} columns={[
              {key:"id",label:"Rebate ID"},{key:"loanId",label:"Loan",render:r=>r.loanId??r.loan_id??"—"},{key:"rebateRate",label:"Rebate rate",render:r=>r.rebateRate==null&&r.rebate_rate==null?"—":((Number(r.rebateRate??r.rebate_rate)*100).toFixed(4)+"%")},{key:"amount",label:"Accrued amount",render:r=>money(r.amount)},{key:"accrualDate",label:"Accrual date",render:r=>formatDate(r.accrualDate??r.accrual_date)},{key:"nextPaymentDate",label:"Next payment",render:r=>formatDate(r.nextPaymentDate??r.next_payment_date)},{key:"status",label:"Status",render:r=><span className="wf-status">{r.status||"—"}</span>}
            ]} empty="No rebate accruals have been reported." /></section>}
          </div>
          <div className="wf-panel wf-statement-panel"><div><h3>Account statement</h3><p>Download the organization statement generated by borrower-service.</p></div><a className="wf-primary wf-statement-link" href={import.meta.env.VITE_BORROWER_API+base+"/statement.csv"} target="_blank" rel="noreferrer">Download CSV statement ↓</a></div>
          <div className="wf-info">Fee bills, daily accruals and rebate calculations are read-only financial records. Their owning services determine amounts and settlement.</div>
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
               <h2>Loans</h2>
               <p>Create loan requests and monitor loan lifecycle, margin calls and collateral.</p>
             </div>
             <button className="wf-secondary" type="button" onClick={loadAll}>↻ Refresh loans</button>
           </div>

           <div className="wf-panel wf-loan-workspace">
             <div className="wf-loan-tabs">
               <div className="wf-tab-actions" role="tablist" aria-label="Loan workspace sections">
               <button type="button" role="tab" aria-selected={loanSubTab === "create"} className={loanSubTab === "create" ? "wf-primary" : "wf-secondary"} onClick={() => setLoanSubTab("create")}>Create Loan</button>
               <button type="button" role="tab" aria-selected={loanSubTab === "register"} className={loanSubTab === "register" ? "wf-primary" : "wf-secondary"} onClick={() => setLoanSubTab("register")}>Loan Register</button>
               <button type="button" role="tab" aria-selected={loanSubTab === "margin"} className={loanSubTab === "margin" ? "wf-primary" : "wf-secondary"} onClick={() => setLoanSubTab("margin")}>Margin Calls & Rebates <span className="wf-status">{marginCalls.length}</span></button>
               </div>
             </div>

           {loanSubTab === "create" && <div className="wf-loan-tab-content">
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

           {loanSubTab === "register" && <div className="wf-loan-tab-content">
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


           {loanSubTab === "margin" && <div className="wf-loan-tab-content">
             <div className="wf-panel-header"><div><h3>Margin calls, rebates & collateral by loan</h3><small>Select a loan to expand its margin calls, cash collateral and security collateral positions.</small></div><span className="wf-status">{loans.length} loans</span></div>
             <div className="wf-summary-grid wf-margin-summary">
               <div className="wf-summary-tile"><span>Open / overdue</span><strong>{marginCalls.filter(call=>["OPEN","PARTIALLY_FULFILLED","OVERDUE"].includes(String(call.status||"").toUpperCase())).length}</strong></div>
               <div className="wf-summary-tile"><span>Fully fulfilled</span><strong>{marginCalls.filter(call=>["FULFILLED","CLOSED","SATISFIED"].includes(String(call.status||"").toUpperCase())).length}</strong></div>
               <div className="wf-summary-tile"><span>Total calls</span><strong>{marginCalls.length}</strong></div>
               <div className="wf-summary-tile"><span>Collateral positions</span><strong>{collateralPositions.length}</strong></div>
             </div>
             {loans.length ? <div className="wf-loan-accordion">{loans.map(loan=>{
               const loanKey=String(loan.id), expanded=String(expandedMarginLoanId)===loanKey;
               const loanCalls=marginCalls.filter(call=>String(call.loanId??call.loan_id)===loanKey);
               const loanCollateral=collateralPositions.filter(position=>String(position.loanId??position.loan_id)===loanKey);
               const cashRows=loanCollateral.filter(position=>String(position.assetType??position.asset_type??"").toUpperCase()==="CASH");
               const securityRows=loanCollateral.filter(position=>String(position.assetType??position.asset_type??"").toUpperCase()==="SECURITY");
               const loanRebates=rebates.filter(rebate=>String(rebate.loanId??rebate.loan_id)===loanKey);
               const cashPosted=cashRows.some(position=>["POSTED","CONFIRMED","ACTIVE"].includes(String(position.status||"").toUpperCase()));
               const agreementId=loan.mslaId??loan.agreementId??loan.msla_id;
               const agreement=agreements.find(item=>String(item.id)===String(agreementId));
               const rebateRecord=loanRebates.find(item=>item.rebateRate!=null||item.rebate_rate!=null||item.rate!=null);
               const rebateRate=rebateRecord?.rebateRate??rebateRecord?.rebate_rate??rebateRecord?.rate??agreement?.rebateRate??agreement?.rebate_rate;
               return <section className="wf-loan-accordion-item" key={loan.id}>
                 <button type="button" className="wf-loan-accordion-trigger" aria-expanded={expanded} onClick={()=>setExpandedMarginLoanId(expanded?null:loanKey)}>
                   <span><strong>Loan #{loan.id}</strong><small>Security {loan.securityId??loan.security_id??"—"} · Quantity {loan.quantity??"—"} · Outstanding {loan.outstandingQuantity??loan.outstanding_quantity??loan.quantity??0}</small></span>
                   <span className="wf-loan-accordion-meta"><em className="wf-status">{loan.status||"—"}</em><small>{loanCalls.length} calls · {loanCollateral.length} collateral</small><b>{expanded?"−":"+"}</b></span>
                 </button>
                 {expanded && <div className="wf-loan-accordion-body">
                   <div className="wf-summary-grid">
                     <div className="wf-summary-tile"><span>Margin calls</span><strong>{loanCalls.length}</strong></div><div className="wf-summary-tile"><span>Cash collateral</span><strong>{cashRows.length}</strong></div><div className="wf-summary-tile"><span>Security collateral</span><strong>{securityRows.length}</strong></div><div className="wf-summary-tile"><span>Cash collateral rebate</span><strong>{cashPosted&&rebateRate!=null?((Number(rebateRate)*100).toFixed(4)+"%"):cashPosted?"Rate pending":"Not applicable"}</strong></div>
                   </div>
                   <h4>Margin calls</h4>
                   <DataTable rows={loanCalls} columns={[
                     {key:"id",label:"Call ID"},{key:"amount",label:"Call amount",render:r=>money(r.amount)},{key:"fulfilledAmount",label:"Fulfilled",render:r=>money(r.fulfilledAmount??r.fulfilled_amount)},{key:"reason",label:"Reason"},{key:"dueAt",label:"Due",render:r=>formatDate(r.dueAt??r.due_at)},{key:"status",label:"Status",render:r=><span className="wf-status">{r.status||"—"}</span>}
                   ]} empty="No margin calls have been raised for this loan." />
                   {loanCalls.filter(call=>["OPEN","PARTIALLY_FULFILLED","OVERDUE"].includes(String(call.status||"").toUpperCase())).map(call=><form className="wf-inline-form" key={call.id} onSubmit={e=>respondToMarginCall(e,call)}>
                     <div className="wf-subheading"><div><h4>Respond to margin call #{call.id}</h4><p>Outstanding call amount: {money(Math.max(0,Number(call.amount||0)-Number(call.fulfilledAmount??call.fulfilled_amount??0)))}</p></div></div>
                     <div className="wf-form-grid">
                       <Field label="Collateral asset type"><select name="assetType" value={marginAssetTypes[call.id]||"CASH"} onChange={e=>setMarginAssetTypes(current=>({...current,[call.id]:e.target.value}))}><option value="CASH">Cash</option><option value="SECURITY">Security</option></select></Field>
                       <Field label="Cash amount (INR)"><input name="cashAmount" type="number" min="0.01" step="0.01" disabled={(marginAssetTypes[call.id]||"CASH")!=="CASH"} required={(marginAssetTypes[call.id]||"CASH")==="CASH"}/></Field>
                       <Field label="Security"><select name="securityId" defaultValue="" disabled={(marginAssetTypes[call.id]||"CASH")!=="SECURITY"} required={(marginAssetTypes[call.id]||"CASH")==="SECURITY"}><option value="">Select security</option>{securities.map(security=><option key={security.id} value={security.id}>{security.symbol} — {security.name}</option>)}</select></Field>
                       <Field label="Security quantity"><input name="quantity" type="number" min="1" step="1" disabled={(marginAssetTypes[call.id]||"CASH")!=="SECURITY"} required={(marginAssetTypes[call.id]||"CASH")==="SECURITY"}/></Field>
                     </div>
                     <div className="wf-actions"><button className="wf-primary" type="submit" disabled={pledgingCallId===call.id}>{pledgingCallId===call.id?"Submitting…":"Submit collateral response"}</button></div>
                   </form>)}
                   <h4>Cash collateral positions</h4>
                   <DataTable rows={cashRows} columns={[
                     {key:"id",label:"Position ID"},{key:"status",label:"Status",render:r=><span className="wf-status">{r.status||"—"}</span>},{key:"cashAmount",label:"Cash amount",render:r=>money(r.cashAmount??r.cash_amount)},{key:"haircut",label:"Haircut",render:r=>((Number(r.haircut??0)*100).toFixed(2)+"%")}
                   ]} empty="No cash collateral positions for this loan." />
                   <h4>Security collateral positions</h4>
                   <DataTable rows={securityRows} columns={[
                     {key:"id",label:"Position ID"},{key:"securityId",label:"Security ID",render:r=>r.securityId??r.security_id??"—"},{key:"securityName",label:"Security",render:r=>securities.find(s=>String(s.id)===String(r.securityId??r.security_id))?.name??"—"},{key:"quantity",label:"Quantity"},{key:"haircut",label:"Haircut",render:r=>((Number(r.haircut??0)*100).toFixed(2)+"%")},{key:"status",label:"Status",render:r=><span className="wf-status">{r.status||"—"}</span>}
                   ]} empty="No security collateral positions for this loan." />
                   {cashPosted && <><h4>Cash collateral rebates</h4><DataTable rows={loanRebates} columns={[
                     {key:"rebateRate",label:"Rebate rate",render:r=>{const rate=r.rebateRate??r.rebate_rate??r.rate;return rate==null?"—":((Number(rate)*100).toFixed(4)+"%");}},{key:"amount",label:"Accrued rebate",render:r=>money(r.amount)},{key:"accrualDate",label:"Accrual date",render:r=>formatDate(r.accrualDate??r.accrual_date)},{key:"nextPaymentDate",label:"Next payment",render:r=>formatDate(r.nextPaymentDate??r.paymentDate??r.payment_date)},{key:"status",label:"Status",render:r=><span className="wf-status">{r.status||"—"}</span>}
                   ]} empty="Cash collateral is posted. Rebate accrual has not been reported yet." /></>}
                 </div>}
               </section>;
             })}</div> : <div className="wf-empty-state">No loans are available yet.</div>}
           </div>}
           </div>
         </section>
      )}
        </div>
      </div>
     </main>
   );
 }