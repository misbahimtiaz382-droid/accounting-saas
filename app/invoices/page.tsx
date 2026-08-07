"use client";

import {
  CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Customer = {
  name: string;
  phone: string | null;
  email: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  payment_status: string | null;
  payment_method: string | null;
  due_date: string | null;
  created_at: string;
  customers: Customer | null;
};

type StatusFilter =
  | "all"
  | "paid"
  | "partial"
  | "unpaid"
  | "overdue";

export default function InvoicesPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [loading, setLoading] = useState(true);

  const [selectedInvoice, setSelectedInvoice] =
    useState<Invoice | null>(null);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/");
      return;
    }

    const { data: membership, error: membershipError } =
      await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      alert(membershipError.message);
      setLoading(false);
      return;
    }

    if (!membership?.company_id) {
      alert("Company membership nahi mili.");
      router.replace("/dashboard");
      return;
    }

    setCompanyId(membership.company_id);
    await loadInvoices(membership.company_id);
    setLoading(false);
  }

  async function loadInvoices(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        invoice_number,
        customer_id,
        total_amount,
        paid_amount,
        remaining_balance,
        payment_status,
        payment_method,
        due_date,
        created_at,
        customers (
          name,
          phone,
          email
        )
      `)
      .eq("company_id", currentCompanyId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      alert("Invoices load error: " + error.message);
      return;
    }

    setInvoices((data as unknown as Invoice[]) || []);
  }

  function isInvoiceOverdue(invoice: Invoice) {
    if (
      invoice.payment_status === "paid" ||
      !invoice.due_date
    ) {
      return false;
    }

    const dueDate = new Date(
      invoice.due_date + "T23:59:59"
    );

    return dueDate < new Date();
  }

  const filteredInvoices = useMemo(() => {
    const text = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const searchableText = [
        invoice.invoice_number,
        invoice.customers?.name,
        invoice.customers?.phone,
        invoice.customers?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !text || searchableText.includes(text);

      let matchesStatus = true;

      if (statusFilter === "overdue") {
        matchesStatus = isInvoiceOverdue(invoice);
      } else if (statusFilter !== "all") {
        matchesStatus =
          invoice.payment_status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const totalInvoiceAmount = invoices.reduce(
    (sum, invoice) =>
      sum + Number(invoice.total_amount || 0),
    0
  );

  const totalReceived = invoices.reduce(
    (sum, invoice) =>
      sum + Number(invoice.paid_amount || 0),
    0
  );

  const totalOutstanding = invoices.reduce(
    (sum, invoice) =>
      sum + Number(invoice.remaining_balance || 0),
    0
  );

  const overdueInvoices = invoices.filter((invoice) =>
    isInvoiceOverdue(invoice)
  );

  const overdueAmount = overdueInvoices.reduce(
    (sum, invoice) =>
      sum + Number(invoice.remaining_balance || 0),
    0
  );

  const paidInvoices = invoices.filter(
    (invoice) => invoice.payment_status === "paid"
  ).length;

  const partialInvoices = invoices.filter(
    (invoice) => invoice.payment_status === "partial"
  ).length;

  const unpaidInvoices = invoices.filter(
    (invoice) => invoice.payment_status === "unpaid"
  ).length;

  function getStatusText(invoice: Invoice) {
    if (isInvoiceOverdue(invoice)) return "Overdue";
    if (invoice.payment_status === "paid") return "Paid";
    if (invoice.payment_status === "partial") {
      return "Partial";
    }

    return "Unpaid";
  }

  function getStatusStyle(invoice: Invoice): CSSProperties {
    if (isInvoiceOverdue(invoice)) {
      return overdueStatusStyle;
    }

    if (invoice.payment_status === "paid") {
      return paidStatusStyle;
    }

    if (invoice.payment_status === "partial") {
      return partialStatusStyle;
    }

    return unpaidStatusStyle;
  }

  function getPaymentMethodText(method: string | null) {
    const methods: Record<string, string> = {
      cash: "Cash",
      bank_transfer: "Bank Transfer",
      card: "Card",
      jazzcash: "JazzCash",
      easypaisa: "EasyPaisa",
      cheque: "Cheque",
      other: "Other",
    };

    return methods[method || ""] || "-";
  }

  function openPaymentModal(invoice: Invoice) {
    const remaining = Number(
      invoice.remaining_balance || 0
    );

    if (remaining <= 0) {
      alert("Ye invoice already fully paid hai.");
      return;
    }

    setSelectedInvoice(invoice);
    setPaymentAmount(remaining.toFixed(2));
    setPaymentMethod(invoice.payment_method || "cash");
  }

  function closePaymentModal() {
    if (savingPayment) return;

    setSelectedInvoice(null);
    setPaymentAmount("");
    setPaymentMethod("cash");
  }

  async function handleRecordPayment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedInvoice || !companyId) {
      return;
    }

    const totalAmount = Number(
      selectedInvoice.total_amount || 0
    );

    const oldPaidAmount = Number(
      selectedInvoice.paid_amount || 0
    );

    const currentRemaining = Number(
      selectedInvoice.remaining_balance ||
        totalAmount - oldPaidAmount
    );

    const receivedAmount = Number(paymentAmount || 0);

    if (
      !Number.isFinite(receivedAmount) ||
      receivedAmount <= 0
    ) {
      alert("Payment amount 0 se zyada hona chahiye.");
      return;
    }

    if (receivedAmount > currentRemaining) {
      alert(
        "Payment remaining balance se zyada nahi ho sakti."
      );
      return;
    }

    const newPaidAmount =
      oldPaidAmount + receivedAmount;

    const newRemainingBalance = Math.max(
      0,
      totalAmount - newPaidAmount
    );

    let newPaymentStatus = "unpaid";

    if (newRemainingBalance <= 0) {
      newPaymentStatus = "paid";
    } else if (newPaidAmount > 0) {
      newPaymentStatus = "partial";
    }

    setSavingPayment(true);

    const { error } = await supabase
      .from("sales")
      .update({
        paid_amount: newPaidAmount,
        remaining_balance: newRemainingBalance,
        payment_status: newPaymentStatus,
        payment_method: paymentMethod,
      })
      .eq("id", selectedInvoice.id)
      .eq("company_id", companyId);

    if (error) {
      setSavingPayment(false);
      alert("Payment save error: " + error.message);
      return;
    }

    await loadInvoices(companyId);

    setSavingPayment(false);
    setSelectedInvoice(null);
    setPaymentAmount("");

    alert("Payment successfully record ho gayi.");
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading invoices...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            style={backButtonStyle}
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            onClick={() => router.push("/sales")}
            style={newInvoiceButtonStyle}
          >
            + New Invoice
          </button>
        </div>

        <div style={headerStyle}>
          <h1 style={pageTitleStyle}>Invoices</h1>

          <p style={pageDescriptionStyle}>
            Customer invoices, payments aur outstanding
            balances manage karo.
          </p>
        </div>

        <section style={summaryGridStyle}>
          <SummaryCard
            title="Total Invoices"
            value={invoices.length.toString()}
            detail={`Paid: ${paidInvoices}`}
          />

          <SummaryCard
            title="Invoice Amount"
            value={`Rs. ${totalInvoiceAmount.toFixed(2)}`}
            detail="All invoices"
          />

          <SummaryCard
            title="Total Received"
            value={`Rs. ${totalReceived.toFixed(2)}`}
            detail="Customer payments"
            valueColor="#15803d"
          />

          <SummaryCard
            title="Outstanding"
            value={`Rs. ${totalOutstanding.toFixed(2)}`}
            detail={`Partial: ${partialInvoices} | Unpaid: ${unpaidInvoices}`}
            valueColor="#b45309"
          />

          <SummaryCard
            title="Overdue"
            value={`Rs. ${overdueAmount.toFixed(2)}`}
            detail={`${overdueInvoices.length} invoices`}
            valueColor="#b91c1c"
          />
        </section>

        <section style={invoiceCardStyle}>
          <div style={invoiceCardHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
                Invoice Directory
              </h2>

              <p style={sectionDescriptionStyle}>
                Search, filter, view aur payment record
                karo.
              </p>
            </div>

            <span style={recordBadgeStyle}>
              {filteredInvoices.length} Records
            </span>
          </div>

          <div style={filterBarStyle}>
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search invoice, customer, phone or email..."
              style={searchInputStyle}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter
                )
              }
              style={filterSelectStyle}
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {filteredInvoices.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={emptyIconStyle}>🧾</div>

              <h3 style={emptyTitleStyle}>
                Koi invoice nahi mili
              </h3>

              <p style={emptyTextStyle}>
                New Invoice button se invoice create karo.
              </p>
            </div>
          ) : (
            <div style={tableWrapperStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={firstTableHeaderStyle}>
                      Customer
                    </th>
                    <th style={tableHeaderStyle}>
                      Invoice
                    </th>
                    <th style={tableHeaderStyle}>Date</th>
                    <th style={tableHeaderStyle}>
                      Due Date
                    </th>
                    <th style={amountHeaderStyle}>
                      Total
                    </th>
                    <th style={amountHeaderStyle}>
                      Paid
                    </th>
                    <th style={amountHeaderStyle}>
                      Remaining
                    </th>
                    <th style={tableHeaderStyle}>
                      Method
                    </th>
                    <th style={tableHeaderStyle}>
                      Status
                    </th>
                    <th style={actionHeaderStyle}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInvoices.map((invoice) => {
                    const customerName =
                      invoice.customers?.name ||
                      "Walk-in Customer";

                    return (
                      <tr key={invoice.id}>
                        <td style={firstTableCellStyle}>
                          <div style={customerCellStyle}>
                            <span style={customerAvatarStyle}>
                              {customerName
                                .charAt(0)
                                .toUpperCase()}
                            </span>

                            <div>
                              <strong
                                style={customerNameStyle}
                              >
                                {customerName}
                              </strong>

                              <span
                                style={customerSubTextStyle}
                              >
                                {invoice.customers?.phone ||
                                  invoice.customers?.email ||
                                  "No contact"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={tableCellStyle}>
                          <span
                            style={invoiceNumberBadgeStyle}
                          >
                            {invoice.invoice_number ||
                              invoice.id.slice(0, 8)}
                          </span>
                        </td>

                        <td style={tableCellStyle}>
                          {new Date(
                            invoice.created_at
                          ).toLocaleDateString()}
                        </td>

                        <td style={tableCellStyle}>
                          {invoice.due_date
                            ? new Date(
                                invoice.due_date
                              ).toLocaleDateString()
                            : "-"}
                        </td>

                        <td style={amountCellStyle}>
                          Rs.{" "}
                          {Number(
                            invoice.total_amount || 0
                          ).toFixed(2)}
                        </td>

                        <td style={amountCellStyle}>
                          Rs.{" "}
                          {Number(
                            invoice.paid_amount || 0
                          ).toFixed(2)}
                        </td>

                        <td style={amountCellStyle}>
                          Rs.{" "}
                          {Number(
                            invoice.remaining_balance || 0
                          ).toFixed(2)}
                        </td>

                        <td style={tableCellStyle}>
                          {getPaymentMethodText(
                            invoice.payment_method
                          )}
                        </td>

                        <td style={tableCellStyle}>
                          <span
                            style={getStatusStyle(invoice)}
                          >
                            {getStatusText(invoice)}
                          </span>
                        </td>

                        <td style={actionCellStyle}>
                          <div style={actionButtonsStyle}>
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  "/invoice_view?id=" +
                                    invoice.id
                                )
                              }
                              style={viewButtonStyle}
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openPaymentModal(invoice)
                              }
                              disabled={
                                Number(
                                  invoice.remaining_balance ||
                                    0
                                ) <= 0
                              }
                              style={{
                                ...paymentButtonStyle,
                                opacity:
                                  Number(
                                    invoice.remaining_balance ||
                                      0
                                  ) <= 0
                                    ? 0.5
                                    : 1,
                              }}
                            >
                              Record Payment
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedInvoice && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>
                  Record Payment
                </h2>

                <p style={modalDescriptionStyle}>
                  Invoice:{" "}
                  {selectedInvoice.invoice_number ||
                    selectedInvoice.id.slice(0, 8)}
                </p>
              </div>

              <button
                type="button"
                onClick={closePaymentModal}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={paymentSummaryStyle}>
              <div>
                <span style={paymentSummaryLabelStyle}>
                  Customer
                </span>

                <strong>
                  {selectedInvoice.customers?.name ||
                    "Walk-in Customer"}
                </strong>
              </div>

              <div>
                <span style={paymentSummaryLabelStyle}>
                  Remaining
                </span>

                <strong style={{ color: "#b45309" }}>
                  Rs.{" "}
                  {Number(
                    selectedInvoice.remaining_balance || 0
                  ).toFixed(2)}
                </strong>
              </div>
            </div>

            <form
              onSubmit={handleRecordPayment}
              style={paymentFormStyle}
            >
              <label style={labelStyle}>
                Payment Amount *
              </label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                max={Number(
                  selectedInvoice.remaining_balance || 0
                )}
                value={paymentAmount}
                onChange={(event) =>
                  setPaymentAmount(event.target.value)
                }
                style={inputStyle}
              />

              <label style={labelStyle}>
                Payment Method
              </label>

              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value)
                }
                style={inputStyle}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">
                  Bank Transfer
                </option>
                <option value="card">Card</option>
                <option value="jazzcash">
                  JazzCash
                </option>
                <option value="easypaisa">
                  EasyPaisa
                </option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>

              <div style={modalActionsStyle}>
                <button
                  type="button"
                  onClick={closePaymentModal}
                  disabled={savingPayment}
                  style={cancelButtonStyle}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingPayment}
                  style={{
                    ...savePaymentButtonStyle,
                    opacity: savingPayment ? 0.6 : 1,
                  }}
                >
                  {savingPayment
                    ? "Saving..."
                    : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  valueColor = "#101828",
}: {
  title: string;
  value: string;
  detail: string;
  valueColor?: string;
}) {
  return (
    <div style={summaryCardStyle}>
      <span style={summaryLabelStyle}>{title}</span>

      <strong
        style={{
          ...summaryValueStyle,
          color: valueColor,
        }}
      >
        {value}
      </strong>

      <span style={summarySmallTextStyle}>
        {detail}
      </span>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  padding: "32px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#172033",
};

const containerStyle: CSSProperties = {
  maxWidth: "1500px",
  margin: "0 auto",
};

const loadingStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f4f7fb",
};

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "20px",
};

const backButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  fontWeight: "700",
};

const newInvoiceButtonStyle: CSSProperties = {
  padding: "12px 17px",
  border: "none",
  borderRadius: "9px",
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "700",
};

const headerStyle: CSSProperties = {
  marginBottom: "24px",
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "30px",
};

const pageDescriptionStyle: CSSProperties = {
  color: "#667085",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const summaryCardStyle: CSSProperties = {
  padding: "20px",
  background: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
};

const summaryLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "8px",
  color: "#667085",
  fontSize: "12px",
};

const summaryValueStyle: CSSProperties = {
  display: "block",
  fontSize: "23px",
};

const summarySmallTextStyle: CSSProperties = {
  display: "block",
  marginTop: "7px",
  color: "#98a2b3",
  fontSize: "11px",
};

const invoiceCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "16px",
  overflow: "hidden",
};

const invoiceCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "22px 24px",
  borderBottom: "1px solid #eaecf0",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "19px",
};

const sectionDescriptionStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "12px",
};

const recordBadgeStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "11px",
  fontWeight: "700",
};

const filterBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 190px",
  gap: "12px",
  padding: "16px 20px",
  background: "#f8fafc",
};

const searchInputStyle: CSSProperties = {
  height: "42px",
  padding: "0 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
};

const filterSelectStyle: CSSProperties = {
  height: "42px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
};

const emptyStateStyle: CSSProperties = {
  padding: "70px 24px",
  textAlign: "center",
};

const emptyIconStyle: CSSProperties = {
  fontSize: "36px",
};

const emptyTitleStyle: CSSProperties = {
  marginBottom: "7px",
};

const emptyTextStyle: CSSProperties = {
  color: "#667085",
};

const tableWrapperStyle: CSSProperties = {
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "1350px",
  borderCollapse: "collapse",
};

const tableHeaderStyle: CSSProperties = {
  padding: "13px 14px",
  background: "#f8fafc",
  textAlign: "left",
  color: "#667085",
  fontSize: "10px",
};

const firstTableHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  paddingLeft: "22px",
};

const amountHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "right",
};

const actionHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "center",
};

const tableCellStyle: CSSProperties = {
  padding: "15px 14px",
  borderBottom: "1px solid #f2f4f7",
  fontSize: "12px",
};

const firstTableCellStyle: CSSProperties = {
  ...tableCellStyle,
  paddingLeft: "22px",
};

const amountCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: "right",
  fontWeight: "700",
};

const actionCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: "center",
};

const customerCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
};

const customerAvatarStyle: CSSProperties = {
  width: "38px",
  height: "38px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: "#dbeafe",
  color: "#1d4ed8",
  fontWeight: "700",
};

const customerNameStyle: CSSProperties = {
  display: "block",
};

const customerSubTextStyle: CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "#98a2b3",
  fontSize: "10px",
};

const invoiceNumberBadgeStyle: CSSProperties = {
  padding: "6px 9px",
  borderRadius: "7px",
  background: "#f2f4f7",
  fontSize: "10px",
  fontWeight: "700",
};

const actionButtonsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "7px",
};

const viewButtonStyle: CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #bfdbfe",
  borderRadius: "7px",
  background: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
};

const paymentButtonStyle: CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #a7f3d0",
  borderRadius: "7px",
  background: "#ecfdf3",
  color: "#047857",
  cursor: "pointer",
};

const paidStatusStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#dcfce7",
  color: "#15803d",
  fontSize: "10px",
};

const partialStatusStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#fef3c7",
  color: "#b45309",
  fontSize: "10px",
};

const unpaidStatusStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: "10px",
};

const overdueStatusStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#7f1d1d",
  color: "#ffffff",
  fontSize: "10px",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(16,24,40,0.55)",
};

const modalStyle: CSSProperties = {
  width: "100%",
  maxWidth: "500px",
  background: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "22px 24px",
  borderBottom: "1px solid #eaecf0",
};

const modalTitleStyle: CSSProperties = {
  margin: 0,
};

const modalDescriptionStyle: CSSProperties = {
  color: "#667085",
};

const closeButtonStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "22px",
};

const paymentSummaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "14px",
  padding: "18px 24px",
  background: "#f8fafc",
};

const paymentSummaryLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "6px",
  color: "#667085",
  fontSize: "11px",
};

const paymentFormStyle: CSSProperties = {
  padding: "22px 24px",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "7px",
  fontWeight: "700",
  fontSize: "12px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 12px",
  marginBottom: "16px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  boxSizing: "border-box",
};

const modalActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
};

const cancelButtonStyle: CSSProperties = {
  padding: "11px 18px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  cursor: "pointer",
};

const savePaymentButtonStyle: CSSProperties = {
  padding: "11px 18px",
  border: "none",
  borderRadius: "9px",
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
};