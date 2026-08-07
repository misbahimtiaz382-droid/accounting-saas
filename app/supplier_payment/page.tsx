"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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

  suppliers: {
    name: string;
  } | null;

  purchases: {
    purchase_number: string | null;
    invoice_number: string | null;
  } | null;
};

export default function SupplierPaymentPage() {
  const router = useRouter();

  const [companyId, setCompanyId] =
    useState("");

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [payments, setPayments] =
    useState<SupplierPayment[]>([]);

  const [supplierId, setSupplierId] =
    useState("");

  const [purchaseId, setPurchaseId] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("Cash");

  const [paymentDate, setPaymentDate] =
    useState(
      new Date().toISOString().split("T")[0]
    );

  const [referenceNumber, setReferenceNumber] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

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

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (
      membershipError ||
      !membership?.company_id
    ) {
      router.replace("/dashboard");
      return;
    }

    setCompanyId(
      membership.company_id
    );

    await Promise.all([
      loadSuppliers(
        membership.company_id
      ),
      loadPurchases(
        membership.company_id
      ),
      loadPayments(
        membership.company_id
      ),
    ]);

    setLoading(false);
  }

  async function loadSuppliers(
    id: string
  ) {
    const { data, error } =
      await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", id)
        .order("name");

    if (error) {
      alert(
        "Supplier load error: " +
          error.message
      );
      return;
    }

    setSuppliers(data || []);
  }

  async function loadPurchases(
    id: string
  ) {
    const { data, error } =
      await supabase
        .from("purchases")
        .select(`
          id,
          supplier_id,
          purchase_number,
          invoice_number,
          total_amount,
          paid_amount,
          remaining_balance,
          payment_status
        `)
        .eq("company_id", id)
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      alert(
        "Purchase load error: " +
          error.message
      );
      return;
    }

    setPurchases(
      (data || []) as Purchase[]
    );
  }

  async function loadPayments(
    id: string
  ) {
    const { data, error } =
      await supabase
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

          suppliers (
            name
          ),

          purchases (
            purchase_number,
            invoice_number
          )
        `)
        .eq("company_id", id)
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      alert(
        "Supplier payment load error: " +
          error.message
      );
      return;
    }

    setPayments(
      (data || []) as unknown as SupplierPayment[]
    );
  }

  const supplierPurchases =
    useMemo(() => {
      if (!supplierId) {
        return [];
      }

      return purchases.filter(
        (purchase) =>
          purchase.supplier_id === supplierId &&
          Number(
            purchase.remaining_balance || 0
          ) > 0
      );
    }, [supplierId, purchases]);

  const selectedPurchase =
    purchases.find(
      (purchase) =>
        purchase.id === purchaseId
    );

  const totalAmount = Number(
    selectedPurchase?.total_amount || 0
  );

  const paidAmount = Number(
    selectedPurchase?.paid_amount || 0
  );

  const payableAmount = Number(
    selectedPurchase?.remaining_balance || 0
  );

  const totalPaidToSuppliers =
    payments.reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount || 0),
      0
    );

  function handleSupplierChange(
    value: string
  ) {
    setSupplierId(value);
    setPurchaseId("");
    setAmount("");
  }

  function handlePurchaseChange(
    value: string
  ) {
    setPurchaseId(value);
    setAmount("");
  }

  async function handlePayment(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (saving) return;

    const paymentAmount =
      Number(amount || 0);

    if (!supplierId) {
      alert("Supplier select karo.");
      return;
    }

    if (!purchaseId) {
      alert("Purchase select karo.");
      return;
    }

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      alert(
        "Payment amount sahi enter karo."
      );
      return;
    }

    if (
      paymentAmount > payableAmount
    ) {
      alert(
        "Payable sirf Rs. " +
          payableAmount.toFixed(2) +
          " hai."
      );
      return;
    }

    if (!paymentDate) {
      alert(
        "Payment date select karo."
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("supplier_payments")
      .insert({
        company_id: companyId,
        supplier_id: supplierId,
        purchase_id: purchaseId,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number:
          referenceNumber.trim() ||
          null,
        notes:
          notes.trim() || null,
      });

    if (error) {
      alert(
        "Supplier payment save error: " +
          error.message
      );

      setSaving(false);
      return;
    }

    setAmount("");
    setReferenceNumber("");
    setNotes("");
    setPaymentMethod("Cash");

    await Promise.all([
      loadPurchases(companyId),
      loadPayments(companyId),
    ]);

    setPurchaseId("");

    setSaving(false);

    alert(
      "Supplier payment successfully save ho gayi."
    );
  }

  async function handleDeletePayment(
    payment: SupplierPayment
  ) {
    const confirmed =
      window.confirm(
        `Rs. ${Number(
          payment.amount || 0
        ).toFixed(
          2
        )} ki supplier payment delete/reverse karni hai?`
      );

    if (!confirmed) return;

    setDeletingId(payment.id);

    const { error } = await supabase
      .from("supplier_payments")
      .delete()
      .eq("id", payment.id)
      .eq("company_id", companyId);

    if (error) {
      alert(
        "Payment delete error: " +
          error.message
      );

      setDeletingId(null);
      return;
    }

    await Promise.all([
      loadPurchases(companyId),
      loadPayments(companyId),
    ]);

    setDeletingId(null);

    alert(
      "Supplier payment reverse ho gayi."
    );
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading supplier payments...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard"
            )
          }
          style={backButtonStyle}
        >
          ← Back to Dashboard
        </button>

        <div style={headerStyle}>
          <div>
            <h1
              style={{
                margin: 0,
              }}
            >
              Supplier Payments
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#667085",
              }}
            >
              Supplier payables aur
              purchase payments manage
              karo.
            </p>
          </div>

          <div style={summaryBoxStyle}>
            <span style={summaryLabelStyle}>
              Total Paid to Suppliers
            </span>

            <strong
              style={{
                fontSize: "20px",
                color: "#15803d",
              }}
            >
              Rs.{" "}
              {totalPaidToSuppliers.toFixed(
                2
              )}
            </strong>
          </div>
        </div>

        <div style={layoutStyle}>
          <form
            onSubmit={handlePayment}
            style={cardStyle}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Pay Supplier
            </h2>

            <label style={labelStyle}>
              Supplier
            </label>

            <select
              value={supplierId}
              onChange={(e) =>
                handleSupplierChange(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select Supplier
              </option>

              {suppliers.map(
                (supplier) => (
                  <option
                    key={
                      supplier.id
                    }
                    value={
                      supplier.id
                    }
                  >
                    {supplier.name}
                  </option>
                )
              )}
            </select>

            <label style={labelStyle}>
              Unpaid / Partial Purchase
            </label>

            <select
              value={purchaseId}
              onChange={(e) =>
                handlePurchaseChange(
                  e.target.value
                )
              }
              style={inputStyle}
              disabled={!supplierId}
            >
              <option value="">
                Select Purchase
              </option>

              {supplierPurchases.map(
                (purchase) => (
                  <option
                    key={
                      purchase.id
                    }
                    value={
                      purchase.id
                    }
                  >
                    {purchase.purchase_number ||
                      "Purchase"}{" "}
                    — Rs.{" "}
                    {Number(
                      purchase.remaining_balance ||
                        0
                    ).toFixed(
                      2
                    )}{" "}
                    payable
                  </option>
                )
              )}
            </select>

            <div style={balanceGridStyle}>
              <div>
                <span
                  style={
                    smallLabelStyle
                  }
                >
                  Total
                </span>

                <strong>
                  Rs.{" "}
                  {totalAmount.toFixed(
                    2
                  )}
                </strong>
              </div>

              <div>
                <span
                  style={
                    smallLabelStyle
                  }
                >
                  Already Paid
                </span>

                <strong
                  style={{
                    color:
                      "#15803d",
                  }}
                >
                  Rs.{" "}
                  {paidAmount.toFixed(
                    2
                  )}
                </strong>
              </div>

              <div>
                <span
                  style={
                    smallLabelStyle
                  }
                >
                  Payable
                </span>

                <strong
                  style={{
                    color:
                      "#b45309",
                  }}
                >
                  Rs.{" "}
                  {payableAmount.toFixed(
                    2
                  )}
                </strong>
              </div>
            </div>

            <label style={labelStyle}>
              Payment Amount
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
              placeholder="Payment amount"
              style={inputStyle}
            />

            <label style={labelStyle}>
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="Cash">
                Cash
              </option>

              <option value="Bank Transfer">
                Bank Transfer
              </option>

              <option value="Card">
                Card
              </option>

              <option value="Cheque">
                Cheque
              </option>

              <option value="JazzCash">
                JazzCash
              </option>

              <option value="Easypaisa">
                Easypaisa
              </option>

              <option value="Other">
                Other
              </option>
            </select>

            <label style={labelStyle}>
              Payment Date
            </label>

            <input
              type="date"
              value={paymentDate}
              onChange={(e) =>
                setPaymentDate(
                  e.target.value
                )
              }
              style={inputStyle}
            />

            <label style={labelStyle}>
              Reference Number
            </label>

            <input
              type="text"
              value={referenceNumber}
              onChange={(e) =>
                setReferenceNumber(
                  e.target.value
                )
              }
              placeholder="Transaction ID / cheque number"
              style={inputStyle}
            />

            <label style={labelStyle}>
              Notes
            </label>

            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(
                  e.target.value
                )
              }
              placeholder="Optional notes"
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
            />

            <button
              type="submit"
              disabled={
                saving ||
                !purchaseId
              }
              style={{
                ...payButtonStyle,
                opacity:
                  saving ||
                  !purchaseId
                    ? 0.6
                    : 1,
                cursor:
                  saving ||
                  !purchaseId
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : "Record Payment"}
            </button>
          </form>

          <section style={cardStyle}>
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Supplier Payment History
            </h2>

            <p
              style={{
                color: "#667085",
                marginTop: "-5px",
              }}
            >
              Sab supplier payments ka
              permanent record.
            </p>

            {payments.length === 0 ? (
              <div style={emptyStyle}>
                Abhi koi supplier payment
                nahi hai.
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table
                  style={tableStyle}
                >
                  <thead>
                    <tr>
                      <th style={th}>
                        Date
                      </th>

                      <th style={th}>
                        Supplier
                      </th>

                      <th style={th}>
                        Purchase No.
                      </th>

                      <th style={th}>
                        Supplier Invoice
                      </th>

                      <th style={th}>
                        Amount
                      </th>

                      <th style={th}>
                        Method
                      </th>

                      <th style={th}>
                        Reference
                      </th>

                      <th style={th}>
                        Notes
                      </th>

                      <th style={th}>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map(
                      (payment) => (
                        <tr
                          key={
                            payment.id
                          }
                        >
                          <td
                            style={td}
                          >
                            {payment.payment_date
                              ? new Date(
                                  payment.payment_date +
                                    "T00:00:00"
                                ).toLocaleDateString()
                              : "-"}
                          </td>

                          <td
                            style={td}
                          >
                            {payment
                              .suppliers
                              ?.name ||
                              "-"}
                          </td>

                          <td
                            style={td}
                          >
                            {payment
                              .purchases
                              ?.purchase_number ||
                              "-"}
                          </td>

                          <td
                            style={td}
                          >
                            {payment
                              .purchases
                              ?.invoice_number ||
                              "-"}
                          </td>

                          <td
                            style={
                              amountCellStyle
                            }
                          >
                            Rs.{" "}
                            {Number(
                              payment.amount ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td
                            style={td}
                          >
                            {payment.payment_method ||
                              "-"}
                          </td>

                          <td
                            style={td}
                          >
                            {payment.reference_number ||
                              "-"}
                          </td>

                          <td
                            style={td}
                          >
                            {payment.notes ||
                              "-"}
                          </td>

                          <td
                            style={td}
                          >
                            <button
                              type="button"
                              disabled={
                                deletingId ===
                                payment.id
                              }
                              onClick={() =>
                                handleDeletePayment(
                                  payment
                                )
                              }
                              style={{
                                ...deleteButtonStyle,
                                opacity:
                                  deletingId ===
                                  payment.id
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {deletingId ===
                              payment.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </td>
                        </tr>
                      )
                    )}
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
  fontFamily:
    "Arial, Helvetica, sans-serif",
  color: "#172033",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
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
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "24px",
};

const summaryBoxStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "14px 18px",
  borderRadius: "10px",
  border: "1px solid #eaecf0",
};

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "12px",
  marginBottom: "5px",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "390px minmax(0, 1fr)",
  gap: "24px",
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow:
    "0 5px 18px rgba(16,24,40,0.05)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: "700",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  marginBottom: "14px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
  fontSize: "14px",
  backgroundColor: "#ffffff",
};

const balanceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, 1fr)",
  gap: "8px",
  padding: "14px",
  marginBottom: "14px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
};

const smallLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "12px",
  marginBottom: "5px",
};

const payButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "13px",
  fontWeight: "700",
};

const emptyStyle: React.CSSProperties = {
  padding: "45px 0",
  textAlign: "center",
  color: "#98a2b3",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "1000px",
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

const amountCellStyle: React.CSSProperties = {
  ...td,
  color: "#15803d",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  backgroundColor: "#fef2f2",
  color: "#dc2626",
  borderRadius: "7px",
  padding: "7px 10px",
  cursor: "pointer",
};