import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { getData, postData } from "../../api/borrowerApi";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./BorrowerWorkflow.css";

ModuleRegistry.registerModules([AllCommunityModule]);

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
  const [activeTab, setActiveTab] = useState("msla");
  const [orgId, setOrgId] = useState(ORG_ID);
  const [agreements, setAgreements] = useState([]);
  const [selectedAgreementId, setSelectedAgreementId] = useState(null);
  const [locates, setLocates] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loans, setLoans] = useState([]);
  const [lenders, setLenders] = useState([]);
  const [securities, setSecurities] = useState([]);
 
  const [agreementForm, setAgreementForm] = useState(emptyAgreement);
  const [isCreatingAgreement, setIsCreatingAgreement] = useState(false);
  const [locateForm, setLocateForm] = useState(emptyLocate);
  const [loanForm, setLoanForm] = useState(emptyLoan);
 
  const [securitySearch, setSecuritySearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const gridRef = useRef(null);
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
        { key: "lenders", call: getData(`${base}/lenders`) },
        { key: "securities", call: getData("/securities") },
      ];

      const results = await Promise.allSettled(requests.map((request) => request.call));
      const nextState = {
        agreements: [],
        locates: [],
        reservations: [],
        loans: [],
        lenders: [],
        securities: [],
      };

      results.forEach((result, index) => {
        const key = requests[index].key;
        if (result.status === "fulfilled") {
          nextState[key] = rowsOf(result.value);
        } else {
          console.warn(`Unable to load ${key}:`, result.reason);
        }
      });

      setAgreements(nextState.agreements);
      useEffect(() => {
        console.log("Updated Agreements:", agreements);
      console.log("Updated Agreement rows:", agreementRows);
      }, [agreements, agreementRows]);
      
      setLocates(nextState.locates);
      setReservations(nextState.reservations);
      setLoans(nextState.loans);
      setLenders(nextState.lenders);
      setSecurities(nextState.securities);
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

  useEffect(() => {
    if (!agreements.length) {
      setSelectedAgreementId(null);
      return;
    }

    const hasSelectedAgreement = agreements.some(
      (agreement) => String(agreement.id) === String(selectedAgreementId)
    );

    if (!hasSelectedAgreement) {
      setSelectedAgreementId(String(agreements[0].id));
    }
  }, [agreements, selectedAgreementId]);

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
    } catch (error) {
      showNotice("error", error.response?.data?.detail ||
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
 
      <nav className="wf-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.number}</span>
            {tab.label}
          </button>
        ))}
      </nav>
 
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
                        <input value="Cash collateral" readOnly />
                      )}
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

           {/* <div className="wf-ag  -grid-wrap">
               <AgGridReact
                 className="ag-theme-alpine"
                 ref={gridRef}
                rowData={agreementRows}
                 columnDefs={[
                  { field: "displayNumber", headerName: "MSLA", flex: 1.4, minWidth: 170 },
                   { field: "lenderName", headerName: "Lender", flex: 1.2, minWidth: 150 },
                   { field: "creditLimit", headerName: "Credit limit", flex: 1, minWidth: 150, valueFormatter: (params) => money(params.value) },
                   { field: "feeRate", headerName: "Fee rate", flex: 0.8, minWidth: 120, valueFormatter: (params) => Number(params.value || 0).toFixed(4) },
                   { field: "expiryDate", headerName: "Expiry", flex: 1, minWidth: 140, valueFormatter: (params) => formatDate(params.value) },
                   { field: "status", headerName: "Status", flex: 0.8, minWidth: 120, cellClass: "wf-grid-status-cell" },
                 ]}
                 defaultColDef={{ sortable: true, resizable: true, filter: true, flex: 1 }}
                 rowSelection="single"
                 rowMultiSelectWithClick={false}
                 animateRows={true}
                 rowHeight={42}
                headerHeight={34}
                 onGridReady={(params) => params.api.sizeColumnsToFit()}
                onFirstDataRendered={(params) => params.api.sizeColumnsToFit()}
                onRowClicked={(event) => setSelectedAgreementId(String(event.data.id))}
                 getRowId={(params) => String(params.data.id)}
                 noRowsOverlayComponent={() => <div className="wf-empty-state compact">No MSLA records available.</div>}
                 style={{ width: "100%", height: "100%" }}
               />
             </div> */}
             <div className="wf-ag-grid-wrap">
  <AgGridReact
    ref={gridRef}
    theme="legacy"
    className="ag-theme-alpine"
    rowData={agreementRows}
    columnDefs={[
      {
        field: "displayNumber",
        headerName: "MSLA",
        flex: 1.4,
        minWidth: 170,
      },
      {
        field: "lenderName",
        headerName: "Lender",
        flex: 1.2,
        minWidth: 150,
      },
      {
        field: "creditLimit",
        headerName: "Credit limit",
        flex: 1,
        minWidth: 150,
        valueFormatter: (params) => money(params.value),
      },
      {
        field: "feeRate",
        headerName: "Fee rate",
        flex: 0.8,
        minWidth: 120,
        valueFormatter: (params) =>
          Number(params.value || 0).toFixed(4),
      },
      {
        field: "expiryDate",
        headerName: "Expiry",
        flex: 1,
        minWidth: 140,
        valueFormatter: (params) => formatDate(params.value),
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.8,
        minWidth: 120,
        cellClass: "wf-grid-status-cell",
      },
    ]}
    defaultColDef={{
      sortable: true,
      resizable: true,
      filter: true,
      flex: 1,
    }}
    rowSelection={{ mode: "singleRow" }}
    animateRows={true}
    rowHeight={42}
    headerHeight={34}
    onGridReady={(params) => params.api.sizeColumnsToFit()}
    onFirstDataRendered={(params) => params.api.sizeColumnsToFit()}
    onRowClicked={(event) =>
      setSelectedAgreementId(String(event.data.id))
    }
    getRowId={(params) => String(params.data.id)}
    noRowsOverlayComponent={() => (
      <div className="wf-empty-state compact">
        No MSLA records available.
      </div>
    )}
  />
</div>
 
           </div>
         </section>
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
               { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
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
               { key: "agreementId", label: "Agreement" },
               { key: "securityId", label: "Security ID" },
               { key: "quantity", label: "Quantity" },
               { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
 { key: "expiresAt", label: "Expires", render: r => formatDate(r.expiresAt) },
             ]} />
           </div>
         </section>
       )}
 
       {!loading && activeTab === "reservations" && (
         <section className="wf-content">
           <div className="wf-section-heading">
             <div>
               <div className="wf-eyebrow">CAPACITY COMMITMENT</div>
               <h2>Reservations</h2>
               <p>Request a reservation only after the locate has been approved.</p>
             </div>
           </div>
 
           <div className="wf-panel">
             <h3>Approved locates eligible for reservation</h3>
             <DataTable rows={approvedLocates} columns={[
               { key: "id", label: "Locate ID" },
               { key: "agreementId", label: "Agreement" },
               { key: "securityId", label: "Security ID" },
               { key: "quantity", label: "Approved quantity", render: r => r.approvedQuantity ?? r.quantity },
               { key: "status", label: "Status", render: r => <span className="wf-status">{r.status}</span> },
               { key: "action", label: "Action", render: r => (
                 <button className="wf-small-button" onClick={() => reserveLocate(r)}>
                   Request reservation
                 </button>
               )},
             ]} />
             {!approvedLocates.length && (
               <p className="wf-help">Approved locate requests will appear here.</p>
             )}
           </div>
 
           <div className="wf-panel">
             <h3>Reservation register</h3>
             <DataTable rows={reservations} columns={[
               { key: "id", label: "Reservation ID" },
               { key: "locateRequestId", label: "Locate ID" },
               { key: "quantity", label: "Quantity" },
               { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
               { key: "createdAt", label: "Requested", render: r => formatDate(r.createdAt) },
             ]} />
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
 
           <div className="wf-panel">
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
           </div>
 
           <div className="wf-panel">
             <h3>Loan register</h3>
            <DataTable rows={loans} columns={[
              { key: "id", label: "Loan ID" },
              { key: "reservationId", label: "Reservation" },
              { key: "securityId", label: "Security ID" },
              { key: "quantity", label: "Quantity" },
              { key: "status", label: "Status", render: r => <span className="wf-status">{r.status || "—"}</span> },
              { key: "createdAt", label: "Created", render: r => formatDate(r.createdAt) },
            ]} />
           </div>
         </section>
      )}
     </main>
   );
 }

