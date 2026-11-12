/* ShieldArbiter dashboard — connected to Mriya's Express API. */
const API_BASE = window.SHIELDARBITER_API || "http://localhost:3000";
let transactions = [];
let selectedTransaction = null;
let transactionGridApi = null;

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
}
function money(amount, currency) {
    const code = currency || "USD";
    try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: code }).format(Number(amount || 0)); }
    catch { return `${code} ${Number(amount || 0).toFixed(2)}`; }
}
function riskSignals(order) {
    const raw = order.signals || [];
    return raw.map(signal => typeof signal === "string" ? signal : (signal.detail || signal.name || JSON.stringify(signal)));
}
function mapOrder(order) {
    return {
        id: order.id,
        customer: order.email || order.payer_id || "PayPal buyer",
        amount: Number(order.amount || 0),
        currency: order.currency || "USD",
        risk_score: Number(order.risk_score || 0),
        risk_level: Number(order.risk_score || 0) >= 70 ? "HIGH" : Number(order.risk_score || 0) >= 40 ? "MEDIUM" : "LOW",
        signals: riskSignals(order),
        decision: order.decision || "PENDING",
        status: order.status || "UNKNOWN",
        popup: order.popup || null,
        raw: order
    };
}
async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

function initTransactionGrid() {
    const gridElement = document.getElementById("transactionGrid");
    const fallback = document.getElementById("transactionTableFallback");
    if (!gridElement || !window.agGrid || typeof window.agGrid.createGrid !== "function") {
        if (gridElement) gridElement.style.display = "none";
        return false;
    }

    const columnDefs = [
        { headerName: "Transaction ID", field: "id", minWidth: 190, flex: 1.35 },
        { headerName: "Customer", field: "customer", minWidth: 180, flex: 1.3 },
        { headerName: "Amount", field: "amount", minWidth: 130, valueFormatter: p => money(p.value, p.data.currency) },
        { headerName: "Risk Score", field: "risk_score", minWidth: 115, valueFormatter: p => `${p.value}/100` },
        { headerName: "Risk Level", field: "risk_level", minWidth: 120,
          cellRenderer: p => {
              const badge = document.createElement("span");
              badge.className = `risk ${String(p.value || "low").toLowerCase()}`;
              badge.textContent = p.value || "LOW";
              return badge;
          } },
        { headerName: "Payment Status", field: "status", minWidth: 145 },
        { headerName: "Action", field: "id", minWidth: 105, maxWidth: 115, sortable: false, filter: false,
          cellRenderer: p => {
              const button = document.createElement("button");
              button.type = "button";
              button.className = "btn btn-sm btn-primary";
              button.textContent = "View";
              button.addEventListener("click", () => viewTransaction(p.data.id));
              return button;
          } }
    ];

    transactionGridApi = window.agGrid.createGrid(gridElement, {
        rowData: [],
        columnDefs,
        defaultColDef: { sortable: true, filter: true, resizable: true, floatingFilter: true },
        pagination: true,
        paginationPageSize: 10,
        animateRows: true,
        rowHeight: 48,
        overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No transactions found. Run the seed script or create a PayPal order.</span>'
    });
    if (fallback) fallback.style.display = "none";
    document.getElementById("transactionSearch")?.addEventListener("input", event => {
        transactionGridApi.setQuickFilter(event.target.value);
    });
    return true;
}

async function loadTransactions() {
    const table = document.getElementById("transactionTable");
    if (table) table.innerHTML = '<tr><td colspan="6">Loading live backend transactions…</td></tr>';
    try {
        const rows = await api("/orders");
        document.getElementById("transactionLoadError")?.classList.add("d-none");
        transactions = rows.map(mapOrder);
        renderTransactions();
        const demoNote = document.querySelector(".demo-note");
        if (demoNote) demoNote.textContent = "Connected to ShieldArbiter backend. Data is from the local SQLite database; seeded records are simulated demo transactions.";
        const flagged = transactions.find(t => t.popup);
        if (flagged) showInboundPopup(flagged);
    } catch (error) {
        const message = `Could not load backend data: ${error.message}. Start the backend on port 3000 and refresh.`;
        const errorBox = document.getElementById("transactionLoadError");
        if (errorBox) { errorBox.textContent = message; errorBox.classList.remove("d-none"); }
        if (table && !transactionGridApi) table.innerHTML = `<tr><td colspan="6" class="text-danger">${escapeHtml(message)}</td></tr>`;
        console.error(error);
    }
}
function renderTransactions() {
    if (transactionGridApi) {
        transactionGridApi.setGridOption("rowData", transactions);
    } else {
        const table = document.getElementById("transactionTable");
        if (table) {
            table.innerHTML = "";
            if (!transactions.length) table.innerHTML = '<tr><td colspan="6">No transactions found. Run the seed script or create a PayPal order.</td></tr>';
            transactions.forEach(t => {
                const row = document.createElement("tr");
                row.innerHTML = `<td>${escapeHtml(t.id)}</td><td>${escapeHtml(t.customer)}</td><td>${escapeHtml(money(t.amount, t.currency))}</td><td>${t.risk_score}/100</td><td><span class="risk ${t.risk_level.toLowerCase()}">${t.risk_level}</span></td><td><button class="btn btn-sm btn-primary" type="button">View</button></td>`;
                row.querySelector("button").addEventListener("click", () => viewTransaction(t.id));
                table.appendChild(row);
            });
        }
    }
    updateStatistics();
}
function updateStatistics() {
    document.getElementById("totalTransactions").textContent = transactions.length;
    document.getElementById("lowRisk").textContent = transactions.filter(t => t.risk_level === "LOW").length;
    document.getElementById("mediumRisk").textContent = transactions.filter(t => t.risk_level === "MEDIUM").length;
    document.getElementById("highRisk").textContent = transactions.filter(t => t.risk_level === "HIGH").length;
}
async function viewTransaction(id) {
    try {
        const order = await api(`/orders/${encodeURIComponent(id)}`);
        selectedTransaction = mapOrder(order);
        const details = document.getElementById("transactionDetails");
        const signals = selectedTransaction.signals;
        details.innerHTML = `
            <h5>${escapeHtml(order.id)}</h5>
            <p><strong>Customer:</strong> ${escapeHtml(order.email || order.payer_id || "PayPal buyer")}</p>
            <p><strong>Amount:</strong> ${escapeHtml(money(order.amount, order.currency))}</p>
            <p><strong>Payment status:</strong> ${escapeHtml(order.status)}</p>
            <p><strong>Risk score:</strong> ${Number(order.risk_score || 0)}/100</p>
            <p><strong>Decision:</strong> ${escapeHtml(order.decision || "PENDING")}</p>
            <h6>Risk signals</h6><ul>${signals.length ? signals.map(x => `<li>${escapeHtml(x)}</li>`).join("") : "<li>No risk signals recorded.</li>"}</ul>
            ${order.popup ? '<div class="alert alert-warning"><strong>Registry match detected.</strong> Merchant review is required.</div>' : ""}
            <div class="d-flex flex-wrap gap-2 mt-3">
              ${order.popup ? '<button class="btn btn-warning btn-sm" id="reviewRiskBtn">Review risk alert</button>' : ""}
              <button class="btn btn-outline-primary btn-sm" id="openCaseBtn">Open case</button>
            </div>`;
        const review = document.getElementById("reviewRiskBtn");
        if (review) review.addEventListener("click", () => showInboundPopup(selectedTransaction));
        document.getElementById("openCaseBtn").addEventListener("click", () => openCase(selectedTransaction.id));
    } catch (error) {
        document.getElementById("transactionDetails").textContent = `Could not load transaction: ${error.message}`;
    }
}
function ensureModalStyles() {
    if (document.getElementById("shieldarbiter-modal-style")) return;
    const style = document.createElement("style");
    style.id = "shieldarbiter-modal-style";
    style.textContent = `
      .sa-backdrop{position:fixed;inset:0;background:#101827b8;z-index:9998;display:flex;align-items:center;justify-content:center;padding:18px}
      .sa-modal{background:#fff;color:#172033;border-radius:14px;max-width:540px;width:100%;padding:24px;box-shadow:0 20px 60px #0005;max-height:90vh;overflow:auto}
      .sa-modal h4{margin-bottom:12px}.sa-modal .sa-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}
      .sa-modal textarea{width:100%;min-height:78px;margin-top:10px;padding:9px;border:1px solid #ccd3dd;border-radius:8px}
    `;
    document.head.appendChild(style);
}
function closePopup() { document.getElementById("saBackdrop")?.remove(); }
function showInboundPopup(transaction) {
    const popup = transaction.popup;
    if (!popup) return;
    ensureModalStyles(); closePopup();
    const matches = (popup.matches || []).map(m => `<li>${escapeHtml(m.type)} — ${escapeHtml(m.reason)} (case ${escapeHtml(m.case_id ?? "n/a")})</li>`).join("");
    const backdrop = document.createElement("div"); backdrop.className = "sa-backdrop"; backdrop.id = "saBackdrop";
    backdrop.innerHTML = `<div class="sa-modal" role="dialog" aria-modal="true">
      <h4>⚠ Previously flagged payment medium</h4>
      <p>${escapeHtml(popup.note || "A registry match was detected. A flag indicates elevated risk, not proof of fraud.")}</p>
      <p><strong>Transaction:</strong> ${escapeHtml(transaction.id)} · <strong>Risk:</strong> ${transaction.risk_score}/100</p>
      <ul>${matches || "<li>Registry match found</li>"}</ul>
      <label for="saDecisionNote"><strong>Merchant note</strong> (required to proceed with caution)</label>
      <textarea id="saDecisionNote" placeholder="Enter reason for your decision"></textarea>
      <div class="sa-actions">
        <button class="btn btn-danger" id="saHold">Hold</button>
        <button class="btn btn-warning" id="saProceed">Proceed with caution</button>
        <button class="btn btn-outline-secondary" id="saFalse">Mark false positive</button>
        <button class="btn btn-light" id="saClose">Close</button>
      </div><p id="saFeedback" class="mt-3 mb-0" role="status"></p>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector("#saClose").addEventListener("click", closePopup);
    const decide = async (action) => {
        const note = backdrop.querySelector("#saDecisionNote").value.trim();
        if (action === "proceed_with_caution" && !note) { backdrop.querySelector("#saFeedback").textContent = "Please enter a merchant note before overriding."; return; }
        try {
            const updated = await api(`/orders/${encodeURIComponent(transaction.id)}/decision`, { method: "POST", body: JSON.stringify({ action, note }) });
            const index = transactions.findIndex(t => t.id === transaction.id);
            if (index >= 0) transactions[index] = mapOrder(updated);
            renderTransactions();
            backdrop.querySelector("#saFeedback").textContent = `Decision saved: ${updated.decision}`;
            setTimeout(closePopup, 900);
            if (selectedTransaction?.id === transaction.id) viewTransaction(transaction.id);
        } catch (error) { backdrop.querySelector("#saFeedback").textContent = error.message; }
    };
    backdrop.querySelector("#saHold").addEventListener("click", () => decide("hold"));
    backdrop.querySelector("#saProceed").addEventListener("click", () => decide("proceed_with_caution"));
    backdrop.querySelector("#saFalse").addEventListener("click", () => decide("mark_false_positive"));
}
function complaintModalStyles() {
    ensureModalStyles();
    if (document.getElementById("sa-complaint-style")) return;
    const style = document.createElement("style");
    style.id = "sa-complaint-style";
    style.textContent = `
      .sa-modal .form-label{font-weight:600;margin-top:10px}
      .sa-modal .form-control,.sa-modal .form-select{width:100%;padding:9px;border:1px solid #ccd3dd;border-radius:8px;color:#172033;background:#fff}
      .sa-modal .sa-result{background:#f4f7fb;border:1px solid #dce4ef;border-radius:10px;padding:12px;margin-top:14px;white-space:normal}
      .sa-modal .sa-result pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;margin:8px 0 0}
      .sa-modal .sa-muted{color:#64748b;font-size:13px}
    `;
    document.head.appendChild(style);
}

async function openCase(orderId) {
    complaintModalStyles();
    closePopup();
    const backdrop = document.createElement("div");
    backdrop.className = "sa-backdrop";
    backdrop.id = "saBackdrop";
    backdrop.innerHTML = `
      <div class="sa-modal" role="dialog" aria-modal="true" aria-labelledby="saCaseTitle">
        <h4 id="saCaseTitle">Open customer complaint</h4>
        <p class="sa-muted">Transaction: ${escapeHtml(orderId)}. Select the issue; ShieldArbiter will analyse it and determine whether it can follow a policy-based resolution or needs escalation.</p>
        <form id="saComplaintForm">
          <label class="form-label" for="saComplaintType">Complaint type</label>
          <select class="form-select" id="saComplaintType" required>
            <option value="DELAYED_DELIVERY">Delayed delivery</option>
            <option value="ITEM_NOT_RECEIVED">Item not received</option>
            <option value="DAMAGED_ITEM">Damaged item</option>
            <option value="WRONG_ITEM">Wrong item received</option>
            <option value="REFUND_NOT_RECEIVED">Refund not received</option>
            <option value="UNAUTHORIZED_TRANSACTION">Unauthorized transaction</option>
            <option value="OTHER">Other / unclear issue</option>
          </select>
          <label class="form-label" for="saComplaintText">Describe the issue</label>
          <textarea id="saComplaintText" class="form-control" required placeholder="Describe what happened and what outcome you are requesting."></textarea>
          <div id="saDelayGroup">
            <label class="form-label" for="saDelayDays">Delivery delay (days)</label>
            <input id="saDelayDays" class="form-control" type="number" min="0" max="365" value="5">
          </div>
          <label class="form-label" for="saDeliveryStatus">Delivery status</label>
          <select id="saDeliveryStatus" class="form-select">
            <option value="DELAYED">Delayed</option>
            <option value="DELIVERED">Marked delivered</option>
            <option value="NOT_DELIVERED">Not delivered</option>
            <option value="UNKNOWN">Unknown / not verified</option>
          </select>
          <label class="form-label" for="saEvidenceAvailable">Evidence available</label>
          <select id="saEvidenceAvailable" class="form-select">
            <option value="false">No evidence attached yet</option>
            <option value="true">Customer or merchant evidence is available</option>
          </select>
          <div class="sa-actions">
            <button class="btn btn-primary" type="submit" id="saAnalyseComplaint">Analyse complaint</button>
            <button class="btn btn-light" type="button" id="saCancelComplaint">Cancel</button>
          </div>
          <p id="saComplaintFeedback" class="mt-3 mb-0" role="status"></p>
          <div id="saComplaintResult"></div>
        </form>
      </div>`;
    document.body.appendChild(backdrop);

    const typeSelect = backdrop.querySelector('#saComplaintType');
    const delayGroup = backdrop.querySelector('#saDelayGroup');
    const toggleDelay = () => { delayGroup.style.display = typeSelect.value === 'DELAYED_DELIVERY' ? 'block' : 'none'; };
    typeSelect.addEventListener('change', toggleDelay);
    toggleDelay();
    backdrop.querySelector('#saCancelComplaint').addEventListener('click', closePopup);

    backdrop.querySelector('#saComplaintForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const submit = backdrop.querySelector('#saAnalyseComplaint');
        const feedback = backdrop.querySelector('#saComplaintFeedback');
        const resultBox = backdrop.querySelector('#saComplaintResult');
        const complaintType = typeSelect.value;
        const complaint = backdrop.querySelector('#saComplaintText').value.trim();
        if (!complaint) { feedback.textContent = 'Please describe the complaint.'; return; }
        submit.disabled = true;
        feedback.textContent = 'Creating case and running ShieldArbiter analysis…';
        resultBox.innerHTML = '';
        try {
            const created = await api('/cases', {
                method: 'POST',
                body: JSON.stringify({ order_id: orderId, complaint })
            });
            const caseId = created.case_id || created.id;
            if (!caseId) throw new Error('Case was created but the backend did not return a case ID.');

            let arbitration = null;
            let arbitrationWarning = "";
            try {
                arbitration = await api(`/cases/${caseId}/arbitrate`, {
                    method: 'POST',
                    body: JSON.stringify({
                        complaint_type: complaintType,
                        delivery_status: backdrop.querySelector('#saDeliveryStatus').value,
                        delivery_delay_days: complaintType === 'DELAYED_DELIVERY' ? Number(backdrop.querySelector('#saDelayDays').value || 0) : null,
                        evidence_available: backdrop.querySelector('#saEvidenceAvailable').value === 'true'
                    })
                });
            } catch (analysisError) {
                arbitrationWarning = `Rule-based arbitration unavailable: ${analysisError.message}`;
                console.warn(arbitrationWarning);
            }

            // Run the real AI case-analysis endpoint after the complaint has been created.
            let aiResult = null;
            let aiWarning = "";
            try {
                aiResult = await api(`/cases/${caseId}/ai-analysis`, {
                    method: 'POST',
                    body: JSON.stringify({})
                });
            } catch (aiError) {
                aiWarning = `AI analysis unavailable: ${aiError.message}`;
                console.warn(aiWarning);
            }

            let policy = null;
            let policyError = "";
            try {
                const policyPayload = { complaint_type: complaintType };
                if (complaintType === 'DELAYED_DELIVERY') {
                    policyPayload.delivery_delay_days = Number(backdrop.querySelector('#saDelayDays').value || 0);
                }
                policy = await api(`/cases/${caseId}/evaluate-policy`, {
                    method: 'POST',
                    body: JSON.stringify(policyPayload)
                });
            } catch (error) {
                policyError = error.message;
                console.warn("Policy evaluation:", error);
            }

            const aiAnalysis = aiResult?.analysis || null;
            const aiAction = String(aiAnalysis?.recommended_action || '').toUpperCase();
            const policyAction = String(policy?.proposed_action || policy?.case?.proposed_action || '').toUpperCase();
            const policyStatus = String(policy?.resolution_status || policy?.case?.resolution_status || '').toUpperCase();
            const pendingApproval = String(policy?.approval_status || policy?.case?.approval_status || '').toUpperCase() === 'PENDING'
                && policyAction === 'REFUND_PROPOSAL';
            const escalated = policyAction === 'MANUAL_REVIEW' || policyStatus === 'ESCALATED'
                || (!policy && !aiAnalysis) || aiAction === 'MANUAL_REVIEW';
            const statusLabel = pendingApproval ? 'AWAITING MERCHANT APPROVAL'
                : escalated ? 'MANUAL REVIEW' : 'ANALYSIS COMPLETED';
            const risk = aiAnalysis?.risk_assessment || {};
            const resultBoxHtml = `
              <div class="sa-result">
                <strong>Case #${escapeHtml(caseId)} · <span class="sa-status">${escapeHtml(statusLabel)}</span></strong>
                <div class="sa-result-grid">
                  <div class="sa-result-metric"><small>AI recommendation</small><strong>${escapeHtml(aiAction || 'Not available')}</strong></div>
                  <div class="sa-result-metric"><small>AI risk assessment</small><strong>${escapeHtml(risk.level || 'UNKNOWN')} ${risk.score == null ? '' : `(${escapeHtml(risk.score)}/100)`}</strong></div>
                  <div class="sa-result-metric"><small>Merchant policy</small><strong>${escapeHtml(policyAction || 'Not evaluated')}</strong></div>
                  <div class="sa-result-metric"><small>Proposed compensation</small><strong>${policy?.proposed_compensation == null ? '—' : escapeHtml(money(policy.proposed_compensation, policy.currency || 'USD'))}</strong></div>
                </div>
                ${aiAnalysis?.case_summary ? `<p><strong>AI case summary</strong><br>${escapeHtml(aiAnalysis.case_summary)}</p>` : ''}
                ${aiAnalysis?.rationale ? `<p><strong>AI rationale</strong><br>${escapeHtml(aiAnalysis.rationale)}</p>` : ''}
                ${Array.isArray(aiAnalysis?.missing_information) && aiAnalysis.missing_information.length ? `<p><strong>Missing information</strong></p><ul>${aiAnalysis.missing_information.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
                ${arbitrationWarning ? `<p class="text-warning small">${escapeHtml(arbitrationWarning)}</p>` : ''}
                ${aiWarning ? `<p class="text-warning small">${escapeHtml(aiWarning)}</p>` : ''}
                ${policyError ? `<p class="text-warning small">Policy evaluation: ${escapeHtml(policyError)}</p>` : ''}
                <details><summary>View complete AI analysis</summary><pre>${escapeHtml(aiAnalysis ? JSON.stringify(aiAnalysis, null, 2) : 'AI analysis was not available.')}</pre></details>
                ${arbitration ? `<details><summary>View rule-based arbitration</summary><pre>${escapeHtml(JSON.stringify(arbitration, null, 2))}</pre></details>` : ''}
                ${policy ? `<details><summary>View merchant policy result</summary><pre>${escapeHtml(JSON.stringify(policy, null, 2))}</pre></details>` : ''}
                ${pendingApproval ? `<div class="sa-actions"><button type="button" class="btn btn-success btn-sm" id="saApproveRefund">Approve proposed refund</button><button type="button" class="btn btn-outline-danger btn-sm" id="saRejectRefund">Reject proposal</button></div><p class="sa-muted mt-2">Approval calls the PayPal refund API. Use only with a test transaction and explicit merchant authorization.</p><label class="form-label" for="saRejectReason">Rejection reason (required only if rejecting)</label><textarea id="saRejectReason" class="form-control" placeholder="Explain why the proposal is rejected"></textarea><p id="saApprovalFeedback" class="sa-muted mb-0"></p>` : ''}
              </div>`;
            resultBox.innerHTML = resultBoxHtml;
            feedback.textContent = `Case #${caseId} created. Review the AI recommendation and merchant policy result below.`;
            if (pendingApproval) {
                const approvalFeedback = resultBox.querySelector('#saApprovalFeedback');
                resultBox.querySelector('#saApproveRefund').addEventListener('click', async () => {
                    const confirmed = window.confirm('This will call PayPal Sandbox and attempt to refund the proposed amount. Continue only if this is an authorized test transaction. Proceed?');
                    if (!confirmed) return;
                    const btn = resultBox.querySelector('#saApproveRefund'); btn.disabled = true;
                    approvalFeedback.textContent = 'Submitting merchant approval and requesting PayPal refund…';
                    try {
                        const approved = await api(`/cases/${caseId}/approve-refund`, { method: 'POST', body: JSON.stringify({}) });
                        approvalFeedback.textContent = `Refund workflow response: ${approved.refund_status || approved.status || 'submitted'}. Refreshing transactions…`;
                        await loadTransactions();
                    } catch (e) { approvalFeedback.textContent = `Approval failed: ${e.message}`; btn.disabled = false; }
                });
                resultBox.querySelector('#saRejectRefund').addEventListener('click', async () => {
                    const reason = resultBox.querySelector('#saRejectReason').value.trim();
                    if (!reason) { approvalFeedback.textContent = 'Enter a reason before rejecting the proposal.'; return; }
                    const btn = resultBox.querySelector('#saRejectRefund'); btn.disabled = true;
                    try {
                        await api(`/cases/${caseId}/reject-refund`, { method: 'POST', body: JSON.stringify({ reason }) });
                        approvalFeedback.textContent = 'Proposal rejected. No PayPal refund was issued.';
                        btn.textContent = 'Rejected';
                    } catch (e) { approvalFeedback.textContent = `Rejection failed: ${e.message}`; btn.disabled = false; }
                });
            }
        } catch (error) {
            feedback.textContent = error.message;
        } finally {
            submit.disabled = false;
        }
    });
}

async function resolveCase(caseId) {
    try {
        const result = await api(`/cases/${caseId}/resolve`, { method: "POST", body: JSON.stringify({ outcome: "REFUNDED" }) });
        alert(`Case resolved. Outcome: ${result.outcome}`);
        await loadTransactions();
    } catch (error) {
        if (error.status === 409 && error.data?.popup) {
            const note = window.prompt("This refund recipient is flagged. Enter the merchant override reason to continue:");
            if (note === null) return;
            if (!note.trim()) { alert("A merchant override note is required."); return; }
            try {
                const result = await api(`/cases/${caseId}/resolve`, { method: "POST", body: JSON.stringify({ outcome: "REFUNDED", confirm_override: true, override_note: note.trim() }) });
                alert(`Refund processed. Outcome: ${result.outcome}`);
                await loadTransactions();
            } catch (retryError) { alert(`Refund could not be completed: ${retryError.message}`); }
        } else { alert(`Case could not be resolved: ${error.message}`); }
    }
}

initTransactionGrid();
loadTransactions();


async function createSandboxCheckout(event) {
    event.preventDefault();
    const button = document.getElementById("createSandboxPayment");
    const message = document.getElementById("checkoutMessage");
    button.disabled = true;
    message.textContent = "Creating PayPal order…";
    const payload = {
        email: document.getElementById("buyerEmail").value.trim(),
        amount: Number(document.getElementById("paymentAmount").value),
        currency: document.getElementById("paymentCurrency").value,
        device_id: document.getElementById("buyerDevice").value.trim(),
        ip: document.getElementById("buyerIp").value.trim(),
        shipping_address: document.getElementById("shippingAddress").value.trim(),
        ip_country: document.getElementById("ipCountry").value.trim().toUpperCase() || null,
        ship_country: document.getElementById("shipCountry").value.trim().toUpperCase() || null
    };
    try {
        const result = await api("/orders/create", { method: "POST", body: JSON.stringify(payload) });
        if (!result.approve_url) {
            message.textContent = `Order ${result.order_id} created but not sent to PayPal. Risk: ${result.risk_score}/100 (${result.decision}). Merchant review is required before capture. Review it in the transaction dashboard.`;
            await loadTransactions();
            return;
        }
        message.innerHTML = `Order <strong>${escapeHtml(result.order_id)}</strong> passed the configured pre-capture checks (risk ${result.risk_score}/100). <a href="${escapeHtml(result.approve_url)}" target="_blank" rel="noopener noreferrer">Open PayPal Sandbox approval</a>`;
        window.open(result.approve_url, "_blank", "noopener,noreferrer");
    } catch (error) {
        message.textContent = `Checkout could not be created: ${error.message}`;
    } finally { button.disabled = false; }
}
async function handlePayPalReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paypal_cancel") === "1") {
        alert("PayPal Sandbox checkout was cancelled.");
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }
    const token = params.get("token");
    if (params.get("paypal_return") !== "1" || !token) return;
    try {
        const captured = await api("/orders/capture", { method: "POST", body: JSON.stringify({ order_id: token }) });
        alert(`Payment captured. Risk score: ${captured.risk_score}/100. Decision: ${captured.decision}.`);
        window.history.replaceState({}, document.title, window.location.pathname);
        await loadTransactions();
        await viewTransaction(token);
    } catch (error) {
        alert(`Buyer returned from PayPal, but capture failed: ${error.message}. Check the backend terminal and PayPal Sandbox order.`);
    }
}

document.getElementById("sandboxPaymentForm")?.addEventListener("submit", createSandboxCheckout);
handlePayPalReturn();

// ---------- Case history ----------
function caseValue(value, fallback = "—") {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "object") return value.recommended_action || value.recommendation || value.action || JSON.stringify(value);
    return String(value);
}
function caseBadge(value) {
    const text = caseValue(value, "UNKNOWN").toUpperCase();
    const tone = /REJECT|ESCALAT|HIGH|MANUAL/.test(text) ? "red" : /PENDING|AWAIT|OPEN|REQUEST/.test(text) ? "amber" : /APPROV|RESOLV|COMPLET/.test(text) ? "green" : "blue";
    return `<span class="case-status-badge ${tone}">${escapeHtml(text.replaceAll("_", " "))}</span>`;
}
async function loadCases() {
    const body = document.getElementById("casesTableBody");
    const message = document.getElementById("casesLoadMessage");
    if (!body) return;
    body.innerHTML = '<tr><td colspan="9">Loading cases…</td></tr>';
    if (message) message.textContent = "Loading cases from the backend…";
    try {
        const rows = await api("/cases");
        body.innerHTML = "";
        if (!Array.isArray(rows) || rows.length === 0) {
            body.innerHTML = '<tr><td colspan="9">No customer cases have been created yet.</td></tr>';
            if (message) message.textContent = "0 cases found.";
            return;
        }
        rows.forEach(c => {
            const order = c.order || {};
            const recommendation = c.recommendation || {};
            const isAstropodsAI = recommendation.engine === "astropods-mastra-ai";

            const ai = c.ai_recommendation || c.ai_analysis ||
                (isAstropodsAI ? recommendation : {});

            const arbitration = c.arbitration_recommendation ||
                c.arbitration ||
                (!isAstropodsAI ? recommendation : {});
            const tr = document.createElement("tr");
            const complaintType = c.complaint_type || c.complaint_category || "CUSTOMER COMPLAINT";
            const arbitrationText = arbitration.recommendation || arbitration.action || c.arbitration_action || "—";
            const aiText = ai.recommended_action || ai.recommendation || c.ai_action || "—";
            const compensation = c.proposed_compensation == null ? "—" : money(c.proposed_compensation, c.currency || order.currency || "USD");
            tr.innerHTML = `
              <td><strong>#${escapeHtml(c.id)}</strong><br><small>${escapeHtml(c.created_at || "")}</small></td>
              <td>${escapeHtml(c.order_id || order.id || "—")}</td>
              <td>${escapeHtml(complaintType)}</td>
              <td>${escapeHtml(caseValue(arbitrationText))}</td>
              <td>${escapeHtml(caseValue(aiText))}</td>
              <td>${escapeHtml(compensation)}</td>
              <td>${caseBadge(c.approval_status || c.resolution_status || "NOT REQUIRED")}</td>
              <td>${caseBadge(c.status || "OPEN")}</td>
              <td><button type="button" class="btn btn-outline-primary btn-sm case-table-action">View</button></td>`;
            tr.querySelector("button").addEventListener("click", () => viewCase(c.id));
            body.appendChild(tr);
        });
        if (message) message.textContent = `${rows.length} case${rows.length === 1 ? "" : "s"} found. Select View to inspect a case.`;
    } catch (error) {
        body.innerHTML = `<tr><td colspan="9" class="text-danger">Could not load cases: ${escapeHtml(error.message)}</td></tr>`;
        if (message) message.textContent = "Case history could not be loaded.";
    }
}
async function viewCase(caseId) {
    const panel = document.getElementById("caseDetailsPanel");
    if (!panel) return;
    panel.classList.remove("d-none");
    panel.innerHTML = "Loading case details…";
    try {
        const c = await api(`/cases/${encodeURIComponent(caseId)}`);
        const order = c.order || {};
       const recommendation = c.recommendation || {};
const evidenceRows = Array.isArray(c.evidence) ? c.evidence : [];

const isAstropodsAI = recommendation.engine === "astropods-mastra-ai";

const ai = c.ai_recommendation || c.ai_analysis ||
    (isAstropodsAI ? recommendation : {});

const arbitration = c.arbitration_recommendation ||
    c.arbitration ||
    (!isAstropodsAI ? recommendation : {});

const aiAction = ai.recommended_action || ai.recommendation ||
    c.ai_action || "AI analysis unavailable";

const aiSummary = ai.case_summary || ai.rationale ||
    ai.reason || "No AI summary saved.";

const risk = ai.risk_assessment || {};
       const details = [
    ["Case ID", `#${c.id}`],
    ["Transaction ID", c.order_id || order.id],
    ["Customer", order.email || order.payer_id],
    ["Payment amount", order.amount == null ? "—" : money(order.amount, order.currency)],
    ["Complaint type", c.complaint_type || "—"],
    ["Complaint", c.complaint || "—"],
    ["Delivery delay (days)", c.delivery_delay_days ?? recommendation.delivery_delay_days ?? c.delay ?? "—"],
    ["Delivery status", c.delivery_status || recommendation.delivery_status || "—"],
    ["Arbitration recommendation", arbitration.recommendation || arbitration.action || c.arbitration_action || "—"],
    ["AI recommendation", aiAction],
    ["Proposed action", c.proposed_action],
    ["Proposed compensation", c.proposed_compensation == null ? "—" : money(c.proposed_compensation, c.currency || order.currency)],
    ["Approval status", c.approval_status],
    ["Refund ID", c.refund_id],
    ["Refund status", c.refund_status],
    ["Resolution status", c.resolution_status],
    ["Case status", c.status],
    ["Outcome", c.outcome]
 ];
        panel.innerHTML = `
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2"><h3>Case #${escapeHtml(c.id)} details</h3><button type="button" class="btn btn-sm btn-outline-secondary" id="closeCaseDetails">Close details</button></div>
          <div class="case-details-grid">${details.map(([label, value]) => `<div class="case-detail-item"><small>${escapeHtml(label)}</small><strong>${escapeHtml(caseValue(value))}</strong></div>`).join("")}</div>
          <div class="mt-3">
    <h5>Astropods AI Analysis</h5>

    <div class="case-details-grid">
        <div class="case-detail-item">
            <small>AI Engine</small>
            <strong>${escapeHtml(ai.engine || "Astropods AI")}</strong>
        </div>

        <div class="case-detail-item">
            <small>Risk Level</small>
            <strong>${escapeHtml(risk.level || "UNKNOWN")}</strong>
        </div>

        <div class="case-detail-item">
            <small>Risk Score</small>
            <strong>${risk.score == null ? "—" : escapeHtml(risk.score) + "/100"}</strong>
        </div>

        <div class="case-detail-item">
            <small>Confidence</small>
            <strong>${escapeHtml(ai.confidence || "—")}</strong>
        </div>

        <div class="case-detail-item">
            <small>Recommended Action</small>
            <strong>${escapeHtml(aiAction)}</strong>
        </div>

        <div class="case-detail-item">
            <small>Human Review</small>
            <strong>${ai.requires_human_review ? "Required" : "Not required"}</strong>
        </div>
    </div>

    <div class="mt-3">
        <strong>Case Summary</strong>
        <p>${escapeHtml(aiSummary)}</p>
    </div>

    <div class="mt-3">
        <strong>Risk Explanation</strong>
        <p>${escapeHtml(risk.explanation || "Not available")}</p>
    </div>

    <div class="mt-3">
        <strong>AI Rationale</strong>
        <p>${escapeHtml(ai.rationale || "Not available")}</p>
    </div>

    ${Array.isArray(ai.identified_indicators) && ai.identified_indicators.length
        ? `<div class="mt-3">
            <strong>Identified Indicators</strong>
            <ul>${ai.identified_indicators.map(item =>
                `<li>${escapeHtml(item)}</li>`).join("")}</ul>
           </div>` : ""}

    ${Array.isArray(ai.evidence_analysis) && ai.evidence_analysis.length
        ? `<div class="mt-3">
            <strong>Evidence Analysis</strong>
            <ul>${ai.evidence_analysis.map(item =>
                `<li>${escapeHtml(item)}</li>`).join("")}</ul>
           </div>` : ""}

    ${Array.isArray(ai.missing_information) && ai.missing_information.length
        ? `<div class="mt-3">
            <strong>Missing Information</strong>
            <ul>${ai.missing_information.map(item =>
                `<li>${escapeHtml(item)}</li>`).join("")}</ul>
           </div>` : ""}

    <small class="text-muted">
        Analyzed at: ${escapeHtml(ai.analyzed_at || "Not available")}
    </small>
</div>
          <div class="mt-3"><strong>Evidence history (${evidenceRows.length} entries)</strong>
            ${evidenceRows.length ? `<ol class="mt-2">${evidenceRows.map(e => `<li><strong>${escapeHtml(e.type || "Evidence")}</strong> — ${escapeHtml(e.note || e.description || "")} <small class="text-muted">${escapeHtml(e.created_at || "")}</small></li>`).join("")}</ol>` : '<p class="text-muted">No evidence entries returned for this case.</p>'}
         
          </div>
          ${String(c.approval_status || "").toUpperCase() === "PENDING" &&
            String(c.proposed_action || "").toUpperCase() === "REFUND_PROPOSAL" &&
            String(c.status || "").toUpperCase() !== "RESOLVED"
            ? `<div class="mt-3 d-flex gap-2 flex-wrap">
                <button type="button" class="btn btn-success btn-sm" id="caseApproveRefund">Approve refund</button>
                <button type="button" class="btn btn-outline-danger btn-sm" id="caseRejectRefund">Reject proposal</button>
              </div>
              <label class="form-label mt-2" for="caseRejectReason">Rejection reason</label>
              <textarea id="caseRejectReason" class="form-control" placeholder="Enter reason for rejection"></textarea>
              <p id="caseActionFeedback" class="mt-2"></p>`
            : ""}
          `;
        panel.querySelector("#closeCaseDetails").addEventListener("click", () => panel.classList.add("d-none"));

        const approveBtn = panel.querySelector("#caseApproveRefund");
        const rejectBtn = panel.querySelector("#caseRejectRefund");

        approveBtn?.addEventListener("click", async () => {
            const confirmed = window.confirm(
                "This may issue a real PayPal Sandbox refund. Do you have authorization to approve it?"
            );
            if (!confirmed) return;

            approveBtn.disabled = true;
            const feedback = panel.querySelector("#caseActionFeedback");
            feedback.textContent = "Processing approval...";

            try {
                const result = await api(`/cases/${c.id}/approve-refund`, {
                    method: "POST",
                    body: JSON.stringify({})
                });
                feedback.textContent = `Refund status: ${result.refund_status || result.status || "Submitted"}`;
                await loadCases();
                await viewCase(c.id);
            } catch (error) {
                feedback.textContent = `Approval failed: ${error.message}`;
                approveBtn.disabled = false;
            }
        });

        rejectBtn?.addEventListener("click", async () => {
            const reason = panel.querySelector("#caseRejectReason").value.trim();
            const feedback = panel.querySelector("#caseActionFeedback");

            if (!reason) {
                feedback.textContent = "Please enter a rejection reason.";
                return;
            }

            rejectBtn.disabled = true;

            try {
                await api(`/cases/${c.id}/reject-refund`, {
                    method: "POST",
                    body: JSON.stringify({ reason })
                });
                feedback.textContent = "Proposal rejected. No PayPal refund was issued.";
                await loadCases();
                await viewCase(c.id);
            } catch (error) {
                feedback.textContent = `Rejection failed: ${error.message}`;
                rejectBtn.disabled = false;
            }
        });


        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
        panel.innerHTML = `<p class="text-danger">Could not load Case #${escapeHtml(caseId)}: ${escapeHtml(error.message)}</p>`;
    }
}
document.getElementById("refreshCasesBtn")?.addEventListener("click", loadCases);
document.getElementById("casesNavLink")?.addEventListener("click", loadCases);
loadCases();
