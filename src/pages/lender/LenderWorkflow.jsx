import { useEffect, useMemo, useState } from "react";
import { lenderGet, lenderPost } from "../../api/lenderApi";
import "./LenderWorkflow.css";

const resources = ["borrowers","inventory","inventory-history","agreements","locates","reservations","loans","collateral","collateral-history","returns","lifecycle-requests","valuations","margin-calls","recalls","fees","rebates","accruals","defaults","buy-ins","rebate-payments","ledger","notifications","audit"];
const nav = [
  ["dashboard","Dashboard","OVERVIEW"],["locates","Locate queue","LENDING OPERATIONS"],["inventory","Inventory"],["agreements","MSLA agreements"],["loans","Loans & returns"],["collateral","Collateral"],["risk","Risk & margin"],["recalls","Recalls"],["operations","Operations & audit"]
];
const rowsOf = value => Array.isArray(value) ? value : Array.isArray(value?.content) ? value.content : Array.isArray(value?.data) ? value.data : [];
const money = value => Number(value || 0).toLocaleString("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2});
const date = value => value ? new Date(value).toLocaleString() : "—";
const title = value => String(value || "").replaceAll("_"," ").toLowerCase().replace(/\b\w/g, x => x.toUpperCase());

function Table({ rows, columns, empty="No records available." }) {
  return <div className="lw-table-wrap"><table className="lw-table"><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>
    {rows.length ? rows.map((row,i)=><tr key={row.id ?? i}>{columns.map(c=><td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? "—")}</td>)}</tr>) : <tr><td className="lw-empty" colSpan={columns.length}>{empty}</td></tr>}
  </tbody></table></div>;
}
function Status({value}) { return <span className="lw-status">{title(value || "Pending")}</span>; }

export default function LenderWorkflow() {
  const [org,setOrg]=useState("");
  const [active,setActive]=useState("dashboard");
  const [data,setData]=useState({});
  const [securities,setSecurities]=useState([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");
  const [inventoryForm,setInventoryForm]=useState({securityId:"",quantity:"",reference:""});
  const base=`/organizations/${org}`;

  async function loadAll() {
    if(!org) return;
    setLoading(true);
    const results=await Promise.allSettled([
      ...resources.map(resource=>lenderGet(`${base}/${resource}`)),
      lenderGet("/securities")
    ]);
    const next={};
    resources.forEach((resource,index)=>next[resource]=results[index].status==="fulfilled"?rowsOf(results[index].value):[]);
    setData(next);
    setSecurities(results[resources.length].status==="fulfilled"?rowsOf(results[resources.length].value):[]);
    setLoading(false);
  }
  useEffect(()=>{ if(org) loadAll(); },[org]);

  function flash(message){setNotice(message);window.setTimeout(()=>setNotice(""),4000);}
  async function act(key,path,payload,message){
    setBusy(key);
    try { await lenderPost(`${base}${path}`,payload); flash(message); await loadAll(); }
    catch(error){flash(error.response?.data?.detail || error.response?.data?.message || "The action could not be completed.");}
    finally{setBusy("");}
  }
  async function decide(kind,id,approve,quantity){
    const reason=window.prompt(approve?"Approval note":"Reason for rejection",approve?"Approved after review":"");
    if(reason===null || !reason.trim()) return;
    const payload=approve?{quantity:Number(quantity || 0),reason:reason.trim()}:{reason:reason.trim()};
    await act(`${kind}-${id}`,`/${kind}/${id}/${approve?"approve":"reject"}`,payload,`${title(kind)} #${id} ${approve?"approved":"rejected"}.`);
  }
  async function settle(kind,id){
    const reference=window.prompt("Enter external settlement / confirmation reference");
    if(!reference?.trim()) return;
    const path=kind==="return"?`/returns/${id}/settle`:`/loans/${id}/settle`;
    await act(`settle-${id}`,path,{reference:reference.trim()},`${title(kind)} #${id} settlement confirmed.`);
  }
  async function collateralDecision(id,approve){
    const reference=window.prompt(approve?"Confirmation reference":"Reason for rejection");
    if(!reference?.trim()) return;
    const path=approve?`/collateral/${id}/confirm`:`/collateral/${id}/reject`;
    await act(`collateral-${id}`,path,approve?{reference:reference.trim()}:{reason:reference.trim()},`Collateral position #${id} updated.`);
  }
  async function releaseDecision(id,approve){
    const value=window.prompt(approve?"Release confirmation reference":"Reason for refusing release");
    if(!value?.trim()) return;
    const path=approve?`/collateral/${id}/release-confirmations`:`/collateral/${id}/release-rejections`;
    await act(`release-${id}`,path,approve?{reference:value.trim()}:{reason:value.trim()},`Collateral release #${id} processed.`);
  }
  async function addInventory(e){
    e.preventDefault();
    await act("inventory-create","/inventory",{securityId:Number(inventoryForm.securityId),quantity:Number(inventoryForm.quantity),reference:inventoryForm.reference},"Inventory position created.");
    setInventoryForm({securityId:"",quantity:"",reference:""});
  }
  async function adjustInventory(item){
    const delta=window.prompt("Quantity adjustment (use a negative number to reduce)", "0");
    if(delta===null || !Number.isFinite(Number(delta)) || Number(delta)===0) return;
    const reference=window.prompt("Adjustment reference");
    if(!reference?.trim()) return;
    await act(`adjust-${item.id}`,`/inventory/${item.id}/adjustments`,{quantityDelta:Number(delta),reference:reference.trim()},`Inventory #${item.id} adjusted.`);
  }

  const d=key=>data[key]||[];
  const openLocates=d("locates").filter(x=>["PENDING","SUBMITTED","REQUESTED","UNDER_REVIEW"].includes(String(x.status||"").toUpperCase()));
  const openLoans=d("loans").filter(x=>!["CLOSED","REJECTED","CANCELLED"].includes(String(x.status||"").toUpperCase()));
  const openCalls=d("margin-calls").filter(x=>["OPEN","OVERDUE","PARTIALLY_FULFILLED"].includes(String(x.status||"").toUpperCase()));

  if(!org) return <main className="lw-shell"><section className="lw-org"><div className="lw-eyebrow">MERIDIAN / SECURITIES FINANCE</div><h1>Lender Operations</h1><p>Connect a lender organization to open the institutional operations workspace.</p><form onSubmit={e=>{e.preventDefault();if(org.trim())setOrg(org.trim());}}><label>Lender organization ID<input value={org} onChange={e=>setOrg(e.target.value)} placeholder="Enter organization ID" required /></label><button className="lw-primary">Open workspace</button></form><a href="/">← Borrower workspace</a></section></main>;

  const actionButton=(key,label,onClick)=> <button className="lw-action" disabled={busy===key} onClick={onClick}>{busy===key?"Working…":label}</button>;
  return <main className="lw-shell">
    <header className="lw-header"><div><div className="lw-eyebrow">SECURITIES LENDING / LENDER</div><h1>Lender Operations</h1><p>Inventory control, borrower servicing and lifecycle oversight</p></div><div className="lw-head-actions"><span>Organization #{org}</span><button onClick={loadAll}>↻ Refresh</button><a href="/">Borrower view</a></div></header>
    <div className="lw-layout"><aside className="lw-sidebar"><div className="lw-brand"><b>M</b><span>MERIDIAN<small>SECURITIES FINANCE</small></span></div>{nav.map(([id,label,group],i)=><div key={id}>{group&&<small className="lw-nav-group">{group}</small>}<button className={active===id?"active":""} onClick={()=>setActive(id)}>{label}</button></div>)}</aside>
    <section className="lw-main">
      {notice&&<div className="lw-notice">{notice}</div>}
      {loading&&<div className="lw-loading">Refreshing lender records…</div>}
      {!loading&&active==="dashboard"&&<>
        <div className="lw-page-title"><div><span>CONTROL CENTRE</span><h2>Operational overview</h2><p>Current queues and exposures for this lender organization.</p></div></div>
        <div className="lw-kpis">{[["Open locate requests",openLocates.length],["Active loans",openLoans.length],["Open margin calls",openCalls.length],["Inventory positions",d("inventory").length],["Pending collateral",d("collateral").filter(x=>["PENDING","SUBMITTED","PENDING_CONFIRMATION"].includes(String(x.status||"").toUpperCase())).length]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
        <div className="lw-grid-two"><section className="lw-panel"><h3>Locate requests requiring review</h3><Table rows={openLocates.slice(0,6)} columns={[{key:"id",label:"Request"},{key:"borrowerId",label:"Borrower"},{key:"securityId",label:"Security"},{key:"quantity",label:"Quantity"},{key:"status",label:"Status",render:r=><Status value={r.status}/>}]} /></section><section className="lw-panel"><h3>Margin call watchlist</h3><Table rows={openCalls.slice(0,6)} columns={[{key:"id",label:"Call"},{key:"loanId",label:"Loan"},{key:"amount",label:"Amount",render:r=>money(r.amount)},{key:"dueAt",label:"Due",render:r=>date(r.dueAt??r.due_at)},{key:"status",label:"Status",render:r=><Status value={r.status}/>}]} /></section></div>
      </>}
      {!loading&&active==="locates"&&<><div className="lw-page-title"><div><span>BORROWER REQUEST INBOX</span><h2>Locate request queue</h2><p>Review borrower demand against lender-controlled inventory before responding.</p></div></div><div className="lw-panel"><Table rows={d("locates")} columns={[{key:"id",label:"Locate ID"},{key:"borrowerId",label:"Borrower"},{key:"securityId",label:"Security"},{key:"quantity",label:"Requested"},{key:"expiresAt",label:"Expiry",render:r=>date(r.expiresAt??r.expires_at)},{key:"status",label:"Status",render:r=><Status value={r.status}/ >},{key:"actions",label:"Decision",render:r=><div className="lw-actions">{actionButton(`locate-${r.id}`,"Approve",()=>{const q=window.prompt("Approved quantity",String(r.quantity||""));if(q&&Number(q)>0)decide("locates",r.id,true,q);})}{actionButton(`locate-${r.id}`,"Reject",()=>decide("locates",r.id,false))}</div>}]} /></div><div className="lw-note">Approve only the quantity validated against your internal inventory. The borrower sees the decision and resulting reservation status, not your available inventory.</div></>}
      {!loading&&active==="inventory"&&<><div className="lw-page-title"><div><span>SUPPLY CONTROL</span><h2>Inventory management</h2><p>Maintain lendable positions and review inventory adjustments.</p></div></div><div className="lw-panel"><h3>Add inventory position</h3><form className="lw-form" onSubmit={addInventory}><label>Security<select required value={inventoryForm.securityId} onChange={e=>setInventoryForm({...inventoryForm,securityId:e.target.value})}><option value="">Select security</option>{securities.map(s=><option key={s.id} value={s.id}>{s.symbol||s.ticker} — {s.name}</option>)}</select></label><label>Quantity<input type="number" min="1" required value={inventoryForm.quantity} onChange={e=>setInventoryForm({...inventoryForm,quantity:e.target.value})}/></label><label>Reference<input required value={inventoryForm.reference} onChange={e=>setInventoryForm({...inventoryForm,reference:e.target.value})} placeholder="Custody / source reference"/></label><button className="lw-primary" disabled={busy==="inventory-create"}>Add position</button></form></div><div className="lw-panel"><h3>Inventory register</h3><Table rows={d("inventory")} columns={[{key:"id",label:"Position ID"},{key:"securityId",label:"Security"},{key:"quantity",label:"Quantity"},{key:"availableQuantity",label:"Available"},{key:"reservedQuantity",label:"Reserved"},{key:"status",label:"Status",render:r=><Status value={r.status}/ >},{key:"action",label:"Adjust",render:r=>actionButton(`adjust-${r.id}`,"Adjust",()=>adjustInventory(r))}]} /></div><div className="lw-panel"><h3>Inventory movement history</h3><Table rows={d("inventory-history")} columns={[{key:"id",label:"Event"},{key:"inventoryId",label:"Position"},{key:"quantityDelta",label:"Change"},{key:"reference",label:"Reference"},{key:"createdAt",label:"Date",render:r=>date(r.createdAt??r.created_at)}]}/></div></>}
      {!loading&&active==="agreements"&&<div className="lw-panel"><div className="lw-page-title"><div><span>CONTRACT CONTROL</span><h2>MSLA agreement review</h2><p>Approve or reject borrower-submitted master lending agreements.</p></div></div><Table rows={d("agreements")} columns={[{key:"id",label:"Agreement"},{key:"borrowerId",label:"Borrower"},{key:"number",label:"Reference"},{key:"creditLimit",label:"Credit limit",render:r=>money(r.creditLimit)},{key:"effectiveDate",label:"Effective",render:r=>date(r.effectiveDate)},{key:"expiryDate",label:"Expiry",render:r=>date(r.expiryDate)},{key:"status",label:"Status",render:r=><Status value={r.status}/ >},{key:"actions",label:"Decision",render:r=><div className="lw-actions">{actionButton(`agreement-${r.id}`,"Approve",()=>decide("agreements",r.id,true,1))}{actionButton(`agreement-${r.id}`,"Reject",()=>decide("agreements",r.id,false))}</div>}]} /></div>}
      {!loading&&active==="loans"&&<><div className="lw-page-title"><div><span>TRADE SERVICING</span><h2>Loans & returns</h2><p>Approve loan requests, confirm settlement and process return instructions.</p></div></div><div className="lw-panel"><h3>Loan register</h3><Table rows={d("loans")} columns={[{key:"id",label:"Loan"},{key:"borrowerId",label:"Borrower"},{key:"securityId",label:"Security"},{key:"quantity",label:"Quantity"},{key:"outstandingQuantity",label:"Outstanding"},{key:"status",label:"Status",render:r=><Status value={r.status}/ >},{key:"actions",label:"Actions",render:r=><div className="lw-actions">{actionButton(`loan-${r.id}`,"Approve",()=>decide("loans",r.id,true,r.quantity))}{actionButton(`loan-${r.id}`,"Reject",()=>decide("loans",r.id,false))}{actionButton(`settle-${r.id}`,"Settle",()=>settle("loan",r.id))}</div>}]} /></div><div className="lw-panel"><h3>Return instructions</h3><Table rows={d("returns")} columns={[{key:"id",label:"Return"},{key:"loanId",label:"Loan"},{key:"quantity",label:"Quantity"},{key:"status",label:"Status",render:r=><Status value={r.status}/ >},{key:"requestedAt",label:"Requested",render:r=>date(r.requestedAt??r.requested_at)},{key:"actions",label:"Actions",render:r=><div className="lw-actions">{actionButton(`return-${r.id}`,"Confirm",()=>settle("return",r.id))}{actionButton(`return-${r.id}`,"Reject",()=>decide("returns",r.id,false))}</div>}]} /></div></>}
      {!loading&&active==="collateral"&&<><div className="lw-page-title"><div><span>COLLATERAL CONTROL</span><h2>Collateral operations</h2><p>Confirm pledges and process borrower release requests.</p></div></div><div className="lw-panel"><h3>Collateral positions</h3><Table rows={d("collateral")} columns={[{key:"id",label:"Position"},{key:"loanId",label:"Loan"},{key:"borrowerId",label:"Borrower"},{key:"assetType",label:"Type"},{key:"securityId",label:"Security"},{key:"quantity",label:"Quantity"},{key:"cashAmount",label:"Cash",render:r=>r.cashAmount==null?"—":money(r.cashAmount)},{key:"status",label:"Status",render:r=><Status value={r.status}/ >},{key:"actions",label:"Actions",render:r=><div className="lw-actions">{actionButton(`collateral-${r.id}`,"Confirm",()=>collateralDecision(r.id,true))}{actionButton(`collateral-${r.id}`,"Reject",()=>collateralDecision(r.id,false))}{actionButton(`release-${r.id}`,"Release",()=>releaseDecision(r.id,true))}</div>}]} /></div><div className="lw-panel"><h3>Collateral movement history</h3><Table rows={d("collateral-history")} columns={[{key:"id",label:"Movement"},{key:"collateralPositionId",label:"Position"},{key:"loanId",label:"Loan"},{key:"eventType",label:"Event"},{key:"reference",label:"Reference"},{key:"createdAt",label:"Date",render:r=>date(r.createdAt??r.created_at)}]}/></div></>}
      {!loading&&active==="risk"&&<><div className="lw-page-title"><div><span>RISK & VALUATION</span><h2>Valuations & margin calls</h2><p>Monitor valuation outputs and margin obligations generated by the risk process.</p></div></div><div className="lw-panel"><h3>Margin call register</h3><Table rows={d("margin-calls")} columns={[{key:"id",label:"Call"},{key:"loanId",label:"Loan"},{key:"borrowerId",label:"Borrower"},{key:"amount",label:"Call amount",render:r=>money(r.amount)},{key:"fulfilledAmount",label:"Fulfilled",render:r=>money(r.fulfilledAmount??r.fulfilled_amount)},{key:"dueAt",label:"Due",render:r=>date(r.dueAt??r.due_at)},{key:"status",label:"Status",render:r=><Status value={r.status}/ >}]}/></div><div className="lw-panel"><h3>Valuation register</h3><Table rows={d("valuations")} columns={[{key:"id",label:"Valuation"},{key:"loanId",label:"Loan"},{key:"marketValue",label:"Market value",render:r=>money(r.marketValue??r.market_value)},{key:"collateralValue",label:"Collateral value",render:r=>money(r.collateralValue??r.collateral_value)},{key:"coverageRatio",label:"Coverage ratio"},{key:"valuedAt",label:"Valued at",render:r=>date(r.valuedAt??r.valued_at)}]}/></div></>}
      {!loading&&active==="recalls"&&<div className="lw-panel"><div className="lw-page-title"><div><span>RECALL MANAGEMENT</span><h2>Recall register</h2><p>Initiate recalls against active loans and monitor the return lifecycle.</p></div></div><Table rows={d("loans").filter(x=>["SETTLED","ACTIVE","PARTIALLY_RETURNED"].includes(String(x.status||"").toUpperCase()))} columns={[{key:"id",label:"Loan"},{key:"borrowerId",label:"Borrower"},{key:"securityId",label:"Security"},{key:"outstandingQuantity",label:"Outstanding"},{key:"status",label:"Status",render:r=><Status value={r.status}/ >},{key:"action",label:"Recall",render:r=>actionButton(`recall-${r.id}`,"Initiate recall",()=>{const q=window.prompt("Recall quantity",String(r.outstandingQuantity??r.quantity));if(!q||Number(q)<=0)return;const reason=window.prompt("Recall reason");if(!reason?.trim())return;act(`recall-${r.id}`,`/loans/${r.id}/recall-requests`,{quantity:Number(q),reason:reason.trim()},"Recall request submitted.");})}]} /><h3>Recall history</h3><Table rows={d("recalls")} columns={[{key:"id",label:"Recall"},{key:"loanId",label:"Loan"},{key:"quantity",label:"Quantity"},{key:"reason",label:"Reason"},{key:"status",label:"Status",render:r=><Status value={r.status}/ >},{key:"createdAt",label:"Created",render:r=>date(r.createdAt??r.created_at)}]}/></div>}
      {!loading&&active==="operations"&&<><div className="lw-page-title"><div><span>CONTROL & RECONCILIATION</span><h2>Operations & audit</h2><p>Review lifecycle requests, fees, rebates, ledger entries, notifications and audit events.</p></div></div>{[["lifecycle-requests","Lifecycle requests"],["fees","Fees"],["rebates","Rebates"],["accruals","Accruals"],["defaults","Defaults"],["buy-ins","Buy-ins"],["rebate-payments","Rebate payments"],["ledger","Ledger"],["notifications","Notifications"],["audit","Audit trail"]].map(([key,label])=><div className="lw-panel" key={key}><h3>{label}</h3><Table rows={d(key)} columns={Object.keys(d(key)[0]||{id:""}).slice(0,7).map(field=>({key:field,label:title(field),render:field.toLowerCase().includes("at")||field.toLowerCase().includes("date")?r=>date(r[field]):undefined}))}/></div>)}</>}
    </section></div>
  </main>;
}
