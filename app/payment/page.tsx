"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  name: string;
};

type Sale = {
  id: string;
  customer_id: string;
  invoice_number: string | null;
  total_amount: number | null;
};

type Payment = {
  id: string;
  sale_id: string;
  customer_id: string;
  amount: number | null;
  payment_method: string | null;
  payment_date: string | null;
  notes: string | null;
  customers: {
    name: string;
  } | null;
  sales: {
    invoice_number: string | null;
  } | null;
};

export default function PaymentsPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  const customerSales = useMemo(() => {
    if (!customerId) {
      return [];
    }

    return sales.filter((sale) => sale.customer_id === customerId);
  }, [customerId, sales]);

  const selectedSale = sales.find((sale) => sale.id === saleId);

  const selectedSalePayments = payments.filter(
    (payment) => payment.sale_id === saleId
  );

  const paidAmount = selectedSalePayments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );

  const invoiceTotal = Number(selectedSale?.total_amount || 0);
  const remainingBalance = Math.max(invoiceTotal - paidAmount, 0);

  const totalReceived = payments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );

  async function loadPage() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    const { data: membership, error: membershipError } = await supabase
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

    if (!membership) {
      router.replace("/dashboard");
      return;
    }

    setCompanyId(membership.company_id);

    await Promise.all([
      loadCustomers(membership.company_id),
      loadSales(membership.company_id),
      loadPayments(membership.company_id),
    ]);

    setLoading(false);
  }

  async function loadCustomers(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", currentCompanyId)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers(data ?? []);
  }

  async function loadSales(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("sales")
      .select("id, customer_id, invoice_number, total_amount")
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSales(data ?? []);
  }

  async function loadPayments(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, sale_id, customer_id, amount, payment_method, payment_date, notes, customers(name), sales(invoice_number)"
      )
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPayments((data as unknown as Payment[]) ?? []);
  }

  function handleCustomerChange(value: string) {
    setCustomerId(value);
    setSaleId("");
    setAmount("");
  }

  function handleSaleChange(value: string) {
    setSaleId(value);
    setAmount("");
  }

  async function handleAddPayment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const paymentAmount = Number(amount || 0);

    if (!customerId) {
      alert("Customer select karo.");
      return;
    }

    if (!saleId) {
      alert("Invoice select karo.");
      return;
    }

    if (paymentAmount <= 0) {
      alert("Payment amount sahi likho.");
      return;
    }

    if (paymentAmount > remainingBalance) {
      alert(
        "Remaining balance sirf Rs. " +
          remainingBalance.toFixed(2) +
          " hai."
      );
      return;
    }

    if (!paymentDate) {
      alert("Payment date select karo.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("payments").insert({
      company_id: companyId,
      sale_id: saleId,
      customer_id: customerId,
      amount: paymentAmount,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setAmount("");
    setNotes("");
    setPaymentMethod("Cash");
    setPaymentDate(new Date().toISOString().split("T")[0]);

    await loadPayments(companyId);

    alert("Payment successfully save ho gayi.");
  }

  if (loading) {
    return <main style={loadingStyle}>Loading...</main>;
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          style={backButtonStyle}
        >
          ← Back to Dashboard
        </button>

        <div style={headingRowStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: "30px" }}>
              Payments
            </h1>

            <p style={{ color: "#667085" }}>
              Customer payments aur outstanding balances manage karo.
            </p>
          </div>

          <div style={summaryBoxStyle}>
            <span style={summaryLabelStyle}>Total Received</span>

            <strong style={{ fontSize: "20px" }}>
              Rs. {totalReceived.toFixed(2)}
            </strong>
          </div>
        </div>

        <div style={gridStyle}>
          <form onSubmit={handleAddPayment} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Receive Payment</h2>

            <select
              value={customerId}
              onChange={(event) =>
                handleCustomerChange(event.target.value)
              }
              style={inputStyle}
            >
              <option value="">Select customer</option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <select
              value={saleId}
              onChange={(event) =>
                handleSaleChange(event.target.value)
              }
              style={inputStyle}
              disabled={!customerId}
            >
              <option value="">Select invoice</option>

              {customerSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.invoice_number || "Invoice"} — Rs.{" "}
                  {Number(sale.total_amount || 0).toFixed(2)}
                </option>
              ))}
            </select>

            <div style={balanceGridStyle}>
              <div>
                Invoice Total
                <strong style={balanceValueStyle}>
                  Rs. {invoiceTotal.toFixed(2)}
                </strong>
              </div>

              <div>
                Already Paid
                <strong style={balanceValueStyle}>
                  Rs. {paidAmount.toFixed(2)}
                </strong>
              </div>

              <div>
                Remaining
                <strong style={balanceValueStyle}>
                  Rs. {remainingBalance.toFixed(2)}
                </strong>
              </div>
            </div>

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Payment amount"
              style={inputStyle}
            />

            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value)
              }
              style={inputStyle}
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Card">Card</option>
              <option value="Cheque">Cheque</option>
              <option value="JazzCash">JazzCash</option>
              <option value="Easypaisa">Easypaisa</option>
              <option value="Other">Other</option>
            </select>

            <input
              type="date"
              value={paymentDate}
              onChange={(event) =>
                setPaymentDate(event.target.value)
              }
              style={inputStyle}
            />

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes"
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
            />

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                padding: "13px",
                border: "none",
                borderRadius: "8px",
                backgroundColor: saving
                  ? "#93c5fd"
                  : "#2563eb",
                color: "#ffffff",
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
                fontSize: "16px",
              }}
            >
              {saving ? "Saving..." : "Receive Payment"}
            </button>
          </form>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Payment History</h2>

            {payments.length === 0 ? (
              <p style={emptyStyle}>
                Abhi koi payment receive nahi hui.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Customer</th>
                      <th style={tableHeaderStyle}>Invoice</th>
                      <th style={tableHeaderStyle}>Amount</th>
                      <th style={tableHeaderStyle}>Method</th>
                      <th style={tableHeaderStyle}>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td style={tableCellStyle}>
                          {payment.customers?.name || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          {payment.sales?.invoice_number || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          Rs.{" "}
                          {Number(payment.amount || 0).toFixed(2)}
                        </td>

                        <td style={tableCellStyle}>
                          {payment.payment_method || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          {payment.payment_date
                            ? new Date(
                                payment.payment_date
                              ).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  padding: "32px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#172033",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial",
};

const backButtonStyle: React.CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  marginBottom: "20px",
  fontSize: "15px",
};

const headingRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const summaryBoxStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "14px 20px",
  borderRadius: "10px",
  border: "1px solid #eaecf0",
};

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "13px",
  marginBottom: "4px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "390px 1fr",
  gap: "24px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  marginBottom: "14px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
  fontSize: "15px",
  backgroundColor: "#ffffff",
};

const balanceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "8px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "14px",
  fontSize: "13px",
};

const balanceValueStyle: React.CSSProperties = {
  display: "block",
  marginTop: "5px",
  fontSize: "14px",
};

const emptyStyle: React.CSSProperties = {
  color: "#98a2b3",
  textAlign: "center",
  padding: "40px 0",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #eaecf0",
  color: "#667085",
  fontSize: "14px",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f2f4f7",
  fontSize: "14px",
};