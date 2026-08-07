"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Supplier = {
  id: string;
  name: string;
};

type Purchase = {
  id: string;
  supplier_id: string;
  purchase_number: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  payment_status: string | null;
  created_at: string;
};

type SupplierPayment = {
  id: string;
  supplier_id: string;
  purchase_id: string;
  amount: number | null;
  payment_method: string | null;
  payment_date: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;

  purchases: {
    purchase_number: string | null;
  } | null;
};

type LedgerRow = {
  id: string;
  date: string;
  type: "Purchase" | "Payment";
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  method: string;
};

export default function SupplierLedgerPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [loading, setLoading] = useState(true);

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

    const { data: membership, error: membershipError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership?.company_id) {
      router.replace("/dashboard");
      return;
    }

    setCompanyId(membership.company_id);

    await Promise.all([
      loadSuppliers(membership.company_id),
      loadPurchases(membership.company_id),
      loadPayments(membership.company_id),
    ]);

    setLoading(false);
  }

  async function loadSuppliers(id: string) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("company_id", id)
      .order("name");

    if (error) {
      alert("Supplier load error: " + error.message);
      return;
    }

    setSuppliers(data || []);
  }

  async function loadPurchases(id: string) {
    const { data, error } = await supabase
      .from("purchases")
      .select(`
        id,
        supplier_id,
        purchase_number,
        invoice_number,
        total_amount,
        paid_amount,
        remaining_balance,
        payment_status,
        created_at
      `)
      .eq("company_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      alert("Purchase load error: " + error.message);
      return;
    }

    setPurchases((data || []) as Purchase[]);
  }

  async function loadPayments(id: string) {
    const { data, error } = await supabase
      .from("supplier_payments")
      .select(`
        id,
        supplier_id,
        purchase_id,
        amount,
        payment_method,
        payment_date,
        reference_number,
        notes,
        created_at,
        purchases (
          purchase_number
        )
      `)
      .eq("company_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      alert("Supplier payment load error: " + error.message);
      return;
    }

    setPayments((data || []) as unknown as SupplierPayment[]);
  }

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === supplierId
  );

  const supplierPurchases = useMemo(() => {
    return purchases.filter(
      (purchase) => purchase.supplier_id === supplierId
    );
  }, [supplierId, purchases]);

  const supplierPayments = useMemo(() => {
    return payments.filter(
      (payment) => payment.supplier_id === supplierId
    );
  }, [supplierId, payments]);

  const totalPurchases = supplierPurchases.reduce(
    (sum, purchase) => sum + Number(purchase.total_amount || 0),
    0
  );

  const totalPaid = supplierPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const totalPayable = Math.max(
    totalPurchases - totalPaid,
    0
  );

  const ledgerRows = useMemo(() => {
    const rows: Omit<LedgerRow, "balance">[] = [];

    supplierPurchases.forEach((purchase) => {
      rows.push({
        id: "purchase-" + purchase.id,
        date: purchase.created_at,
        type: "Purchase",
        reference:
          purchase.purchase_number ||
          purchase.invoice_number ||
          "Purchase",
        debit: Number(purchase.total_amount || 0),
        credit: 0,
        method: "-",
      });
    });

    supplierPayments.forEach((payment) => {
      rows.push({
        id: "payment-" + payment.id,
        date: payment.created_at,
        type: "Payment",
        reference:
          payment.purchases?.purchase_number ||
          payment.reference_number ||
          "Supplier Payment",
        debit: 0,
        credit: Number(payment.amount || 0),
        method: payment.payment_method || "-",
      });
    });

    rows.sort((a, b) => {
      return (
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
      );
    });

    let runningBalance = 0;

    return rows.map((row) => {
      runningBalance =
        runningBalance + row.debit - row.credit;

      return {
        ...row,
        balance: runningBalance,
      };
    });
  }, [supplierPurchases, supplierPayments]);

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading supplier ledger...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          style={backButtonStyle}
        >
          ← Back to Dashboard
        </button>

        <div style={headerStyle}>
          <div>
            <h1 style={{ margin: 0 }}>
              Supplier Ledger
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#667085",
              }}
            >
              Supplier purchases, payments aur outstanding
              balance ek jagah dekho.
            </p>
          </div>
        </div>

        <section style={filterCardStyle}>
          <label style={labelStyle}>
            Supplier
          </label>

          <select
            value={supplierId}
            onChange={(e) =>
              setSupplierId(e.target.value)
            }
            style={supplierSelectStyle}
          >
            <option value="">
              Select Supplier
            </option>

            {suppliers.map((supplier) => (
              <option
                key={supplier.id}
                value={supplier.id}
              >
                {supplier.name}
              </option>
            ))}
          </select>
        </section>

        {!supplierId ? (
          <section style={emptyCardStyle}>
            Supplier select karo ledger dekhne ke liye.
          </section>
        ) : (
          <>
            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>
                  Supplier
                </span>

                <strong style={summaryValueStyle}>
                  {selectedSupplier?.name || "-"}
                </strong>
              </div>

              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>
                  Total Purchases
                </span>

                <strong style={summaryValueStyle}>
                  Rs. {totalPurchases.toFixed(2)}
                </strong>
              </div>

              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>
                  Total Paid
                </span>

                <strong
                  style={{
                    ...summaryValueStyle,
                    color: "#15803d",
                  }}
                >
                  Rs. {totalPaid.toFixed(2)}
                </strong>
              </div>

              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>
                  Total Payable
                </span>

                <strong
                  style={{
                    ...summaryValueStyle,
                    color: "#b45309",
                  }}
                >
                  Rs. {totalPayable.toFixed(2)}
                </strong>
              </div>
            </div>

            <section style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2
                    style={{
                      margin: 0,
                    }}
                  >
                    Ledger Transactions
                  </h2>

                  <p
                    style={{
                      color: "#667085",
                      marginTop: "6px",
                    }}
                  >
                    Purchases debit aur supplier payments
                    credit ke taur par show ho rahi hain.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/supplier_payment")
                  }
                  style={paySupplierButtonStyle}
                >
                  + Pay Supplier
                </button>
              </div>

              {ledgerRows.length === 0 ? (
                <div style={emptyStyle}>
                  Is supplier ka abhi koi transaction nahi hai.
                </div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={th}>Date</th>
                        <th style={th}>Type</th>
                        <th style={th}>Reference</th>
                        <th style={th}>Method</th>
                        <th style={th}>Purchase</th>
                        <th style={th}>Payment</th>
                        <th style={th}>Balance</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledgerRows.map((row) => (
                        <tr key={row.id}>
                          <td style={td}>
                            {new Date(
                              row.date
                            ).toLocaleDateString()}
                          </td>

                          <td style={td}>
                            <span
                              style={
                                row.type === "Purchase"
                                  ? purchaseBadgeStyle
                                  : paymentBadgeStyle
                              }
                            >
                              {row.type}
                            </span>
                          </td>

                          <td style={td}>
                            {row.reference}
                          </td>

                          <td style={td}>
                            {row.method}
                          </td>

                          <td style={debitCellStyle}>
                            {row.debit > 0
                              ? "Rs. " +
                                row.debit.toFixed(2)
                              : "-"}
                          </td>

                          <td style={creditCellStyle}>
                            {row.credit > 0
                              ? "Rs. " +
                                row.credit.toFixed(2)
                              : "-"}
                          </td>

                          <td style={balanceCellStyle}>
                            Rs.{" "}
                            {row.balance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={cardStyle}>
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                Purchase Summary
              </h2>

              {supplierPurchases.length === 0 ? (
                <div style={emptyStyle}>
                  Is supplier ki koi purchase nahi hai.
                </div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={th}>
                          Purchase No.
                        </th>

                        <th style={th}>
                          Supplier Invoice
                        </th>

                        <th style={th}>
                          Total
                        </th>

                        <th style={th}>
                          Paid
                        </th>

                        <th style={th}>
                          Payable
                        </th>

                        <th style={th}>
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {supplierPurchases.map(
                        (purchase) => (
                          <tr key={purchase.id}>
                            <td style={td}>
                              {purchase.purchase_number ||
                                "-"}
                            </td>

                            <td style={td}>
                              {purchase.invoice_number ||
                                "-"}
                            </td>

                            <td style={td}>
                              Rs.{" "}
                              {Number(
                                purchase.total_amount || 0
                              ).toFixed(2)}
                            </td>

                            <td style={creditCellStyle}>
                              Rs.{" "}
                              {Number(
                                purchase.paid_amount || 0
                              ).toFixed(2)}
                            </td>

                            <td style={balanceCellStyle}>
                              Rs.{" "}
                              {Number(
                                purchase.remaining_balance ||
                                  0
                              ).toFixed(2)}
                            </td>

                            <td style={td}>
                              <span
                                style={getStatusStyle(
                                  purchase.payment_status
                                )}
                              >
                                {getStatusText(
                                  purchase.payment_status
                                )}
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function getStatusText(
  status: string | null
) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  return "Unpaid";
}

function getStatusStyle(
  status: string | null
): React.CSSProperties {
  if (status === "paid") {
    return {
      ...statusBaseStyle,
      backgroundColor: "#dcfce7",
      color: "#15803d",
    };
  }

  if (status === "partial") {
    return {
      ...statusBaseStyle,
      backgroundColor: "#fef3c7",
      color: "#b45309",
    };
  }

  return {
    ...statusBaseStyle,
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
  };
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

const containerStyle: React.CSSProperties = {
  maxWidth: "1250px",
  margin: "0 auto",
};

const backButtonStyle: React.CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  padding: 0,
  marginBottom: "20px",
  fontSize: "14px",
};

const headerStyle: React.CSSProperties = {
  marginBottom: "20px",
};

const filterCardStyle: React.CSSProperties = {
  maxWidth: "420px",
  backgroundColor: "#ffffff",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  marginBottom: "22px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "7px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: "700",
};

const supplierSelectStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
  marginBottom: "22px",
};

const summaryCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
};

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "13px",
  marginBottom: "7px",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "21px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  marginBottom: "22px",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  marginBottom: "15px",
};

const paySupplierButtonStyle: React.CSSProperties = {
  border: "none",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: "700",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "850px",
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
  color: "#667085",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "13px 12px",
  borderBottom: "1px solid #f2f4f7",
  color: "#475467",
  fontSize: "14px",
};

const debitCellStyle: React.CSSProperties = {
  ...td,
  color: "#b45309",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const creditCellStyle: React.CSSProperties = {
  ...td,
  color: "#15803d",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const balanceCellStyle: React.CSSProperties = {
  ...td,
  color: "#b42318",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const purchaseBadgeStyle: React.CSSProperties = {
  backgroundColor: "#fef3c7",
  color: "#b45309",
  padding: "5px 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "700",
};

const paymentBadgeStyle: React.CSSProperties = {
  backgroundColor: "#dcfce7",
  color: "#15803d",
  padding: "5px 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "700",
};

const statusBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "700",
};

const emptyCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "50px",
  textAlign: "center",
  color: "#98a2b3",
};

const emptyStyle: React.CSSProperties = {
  padding: "40px 0",
  textAlign: "center",
  color: "#98a2b3",
};