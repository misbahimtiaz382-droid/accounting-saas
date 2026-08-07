"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  name: string;
};

type Sale = {
  id: string;
  customer_id: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  payment_status: string | null;
};

type Payment = {
  id: string;
  invoice_id: string;
  customer_id: string | null;
  amount: number | null;
  payment_method: string | null;
  payment_date: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;

  customers: {
    name: string;
  } | null;

  sales: {
    invoice_number: string | null;
  } | null;
};

function getTodayDate() {
  const now = new Date();
  const timezoneOffset =
    now.getTimezoneOffset() * 60000;

  return new Date(
    now.getTime() - timezoneOffset
  )
    .toISOString()
    .split("T")[0];
}

export default function PaymentsPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [sales, setSales] =
    useState<Sale[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [customerId, setCustomerId] =
    useState("");

  const [saleId, setSaleId] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("cash");

  const [paymentDate, setPaymentDate] =
    useState(getTodayDate());

  const [
    referenceNumber,
    setReferenceNumber,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [search, setSearch] =
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

  const customerSales = useMemo(() => {
    if (!customerId) return [];

    return sales.filter(
      (sale) =>
        sale.customer_id === customerId &&
        Number(
          sale.remaining_balance || 0
        ) > 0
    );
  }, [customerId, sales]);

  const selectedSale = sales.find(
    (sale) => sale.id === saleId
  );

  const invoiceTotal = Number(
    selectedSale?.total_amount || 0
  );

  const paidAmount = Number(
    selectedSale?.paid_amount || 0
  );

  const remainingBalance = Number(
    selectedSale?.remaining_balance || 0
  );

  const totalReceived = payments.reduce(
    (total, payment) =>
      total +
      Number(payment.amount || 0),
    0
  );

  const filteredPayments =
    payments.filter((payment) => {
      const text = search
        .trim()
        .toLowerCase();

      if (!text) return true;

      return (
        payment.customers?.name
          ?.toLowerCase()
          .includes(text) ||
        payment.sales?.invoice_number
          ?.toLowerCase()
          .includes(text) ||
        payment.reference_number
          ?.toLowerCase()
          .includes(text) ||
        payment.payment_method
          ?.toLowerCase()
          .includes(text)
      );
    });

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

    setUserId(user.id);

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
      alert(
        membershipError?.message ||
          "Company membership nahi mili."
      );

      setLoading(false);
      return;
    }

    setCompanyId(
      membership.company_id
    );

    await Promise.all([
      loadCustomers(
        membership.company_id
      ),
      loadSales(
        membership.company_id
      ),
      loadPayments(
        membership.company_id
      ),
    ]);

    setLoading(false);
  }

  async function loadCustomers(
    currentCompanyId: string
  ) {
    const { data, error } =
      await supabase
        .from("customers")
        .select("id, name")
        .eq(
          "company_id",
          currentCompanyId
        )
        .order("name");

    if (error) {
      alert(
        "Customers load error: " +
          error.message
      );
      return;
    }

    setCustomers(data ?? []);
  }

  async function loadSales(
    currentCompanyId: string
  ) {
    const { data, error } =
      await supabase
        .from("sales")
        .select(`
          id,
          customer_id,
          invoice_number,
          total_amount,
          paid_amount,
          remaining_balance,
          payment_status
        `)
        .eq(
          "company_id",
          currentCompanyId
        )
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      alert(
        "Invoices load error: " +
          error.message
      );
      return;
    }

    setSales(
      (data || []) as Sale[]
    );
  }

  async function loadPayments(
    currentCompanyId: string
  ) {
    const { data, error } =
      await supabase
        .from("payments_received")
        .select(`
          id,
          invoice_id,
          customer_id,
          amount,
          payment_method,
          payment_date,
          reference_number,
          notes,
          created_at,
          customers (
            name
          ),
          sales!payments_received_invoice_id_fkey (
            invoice_number
          )
        `)
        .eq(
          "company_id",
          currentCompanyId
        )
        .order("payment_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      alert(
        "Payments load error: " +
          error.message
      );
      return;
    }

    setPayments(
      (data || []) as unknown as Payment[]
    );
  }

  function handleCustomerChange(
    value: string
  ) {
    setCustomerId(value);
    setSaleId("");
    setAmount("");
  }

  function handleSaleChange(
    value: string
  ) {
    setSaleId(value);

    const sale = sales.find(
      (item) => item.id === value
    );

    const balance = Number(
      sale?.remaining_balance || 0
    );

    setAmount(
      balance > 0
        ? balance.toFixed(2)
        : ""
    );
  }

  async function handleAddPayment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    const paymentAmount =
      Number(amount);

    if (!customerId) {
      alert(
        "Customer select karo."
      );
      return;
    }

    if (!saleId) {
      alert(
        "Invoice select karo."
      );
      return;
    }

    if (
      !Number.isFinite(
        paymentAmount
      ) ||
      paymentAmount <= 0
    ) {
      alert(
        "Payment amount sahi likho."
      );
      return;
    }

    if (
      paymentAmount >
      remainingBalance
    ) {
      alert(
        "Remaining balance sirf Rs. " +
          remainingBalance.toFixed(2) +
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

    if (
      paymentMethod !== "cash" &&
      !referenceNumber.trim()
    ) {
      alert(
        "Cash ke ilawa payment ke liye reference number enter karo."
      );
      return;
    }

    setSaving(true);

    const {
      data: insertedPayment,
      error: paymentError,
    } = await supabase
      .from("payments_received")
      .insert({
        company_id: companyId,
        invoice_id: saleId,
        customer_id: customerId,
        amount: paymentAmount,
        payment_method:
          paymentMethod,
        payment_date:
          paymentDate,
        reference_number:
          referenceNumber.trim() ||
          null,
        notes:
          notes.trim() || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (
      paymentError ||
      !insertedPayment
    ) {
      alert(
        "Payment save error: " +
          (paymentError?.message ||
            "Unknown error")
      );

      setSaving(false);
      return;
    }

    // Trigger database mein paid_amount,
    // remaining_balance aur status recalculate karega.

    setAmount("");
    setReferenceNumber("");
    setNotes("");
    setPaymentMethod("cash");
    setPaymentDate(
      getTodayDate()
    );
    setSaleId("");

    await Promise.all([
      loadSales(companyId),
      loadPayments(companyId),
    ]);

    alert(
      "Payment successfully save ho gayi."
    );

    setSaving(false);
  }

  async function handleDeletePayment(
    payment: Payment
  ) {
    const confirmed =
      window.confirm(
        `Rs. ${Number(
          payment.amount || 0
        ).toFixed(
          2
        )} ki payment delete karni hai? Invoice balance dobara due ho jayega.`
      );

    if (!confirmed) return;

    setDeletingId(payment.id);

    const { error } = await supabase
      .from("payments_received")
      .delete()
      .eq("id", payment.id)
      .eq(
        "company_id",
        companyId
      );

    if (error) {
      alert(
        "Payment delete error: " +
          error.message
      );

      setDeletingId(null);
      return;
    }

    await Promise.all([
      loadSales(companyId),
      loadPayments(companyId),
    ]);

    setCustomerId("");
    setSaleId("");
    setAmount("");

    alert(
      "Payment delete ho gayi. Invoice balance automatically update ho gaya."
    );

    setDeletingId(null);
  }

  function getPaymentMethodText(
    method: string | null
  ) {
    const methods: Record<
      string,
      string
    > = {
      cash: "Cash",
      bank_transfer:
        "Bank Transfer",
      card: "Card",
      cheque: "Cheque",
      jazzcash: "JazzCash",
      easypaisa: "EasyPaisa",
      other: "Other",
    };

    return (
      methods[method || ""] ||
      method ||
      "-"
    );
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading payments...
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

        <div style={headingRowStyle}>
          <div>
            <h1 style={titleStyle}>
              Payments Received
            </h1>

            <p style={descriptionStyle}>
              Customer payments aur
              outstanding invoice
              balances manage karo.
            </p>
          </div>

          <div style={summaryBoxStyle}>
            <span
              style={summaryLabelStyle}
            >
              Total Received
            </span>

            <strong
              style={summaryValueStyle}
            >
              Rs.{" "}
              {totalReceived.toFixed(2)}
            </strong>
          </div>
        </div>

        <div style={gridStyle}>
          <form
            onSubmit={handleAddPayment}
            style={cardStyle}
          >
            <h2 style={cardTitleStyle}>
              Receive Payment
            </h2>

            <label style={labelStyle}>
              Customer
            </label>

            <select
              value={customerId}
              onChange={(event) =>
                handleCustomerChange(
                  event.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select customer
              </option>

              {customers.map(
                (customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                  </option>
                )
              )}
            </select>

            <label style={labelStyle}>
              Unpaid Invoice
            </label>

            <select
              value={saleId}
              onChange={(event) =>
                handleSaleChange(
                  event.target.value
                )
              }
              style={inputStyle}
              disabled={!customerId}
            >
              <option value="">
                Select invoice
              </option>

              {customerSales.map(
                (sale) => (
                  <option
                    key={sale.id}
                    value={sale.id}
                  >
                    {sale.invoice_number ||
                      "Invoice"}{" "}
                    — Remaining Rs.{" "}
                    {Number(
                      sale.remaining_balance ||
                        0
                    ).toFixed(2)}
                  </option>
                )
              )}
            </select>

            <div
              style={balanceGridStyle}
            >
              <div>
                Invoice Total

                <strong
                  style={
                    balanceValueStyle
                  }
                >
                  Rs.{" "}
                  {invoiceTotal.toFixed(
                    2
                  )}
                </strong>
              </div>

              <div>
                Already Paid

                <strong
                  style={
                    balanceValueStyle
                  }
                >
                  Rs.{" "}
                  {paidAmount.toFixed(
                    2
                  )}
                </strong>
              </div>

              <div>
                Remaining

                <strong
                  style={
                    balanceValueStyle
                  }
                >
                  Rs.{" "}
                  {remainingBalance.toFixed(
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
              min="0.01"
              step="0.01"
              max={
                remainingBalance ||
                undefined
              }
              value={amount}
              onChange={(event) =>
                setAmount(
                  event.target.value
                )
              }
              placeholder="Payment amount"
              style={inputStyle}
              disabled={!saleId}
            />

            <label style={labelStyle}>
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(
                  event.target.value
                )
              }
              style={inputStyle}
            >
              <option value="cash">
                Cash
              </option>

              <option value="bank_transfer">
                Bank Transfer
              </option>

              <option value="card">
                Card
              </option>

              <option value="cheque">
                Cheque
              </option>

              <option value="jazzcash">
                JazzCash
              </option>

              <option value="easypaisa">
                EasyPaisa
              </option>

              <option value="other">
                Other
              </option>
            </select>

            <label style={labelStyle}>
              Payment Date
            </label>

            <input
              type="date"
              value={paymentDate}
              onChange={(event) =>
                setPaymentDate(
                  event.target.value
                )
              }
              style={inputStyle}
            />

            <label style={labelStyle}>
              Reference Number
            </label>

            <input
              type="text"
              value={
                referenceNumber
              }
              onChange={(event) =>
                setReferenceNumber(
                  event.target.value
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
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              placeholder="Optional notes"
              rows={3}
              style={textareaStyle}
            />

            <button
              type="submit"
              disabled={
                saving ||
                !saleId ||
                remainingBalance <= 0
              }
              style={{
                ...saveButtonStyle,
                opacity:
                  saving ||
                  !saleId ||
                  remainingBalance <= 0
                    ? 0.6
                    : 1,
                cursor:
                  saving ||
                  !saleId ||
                  remainingBalance <= 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : "Receive Payment"}
            </button>
          </form>

          <section style={cardStyle}>
            <div
              style={
                historyHeadingStyle
              }
            >
              <div>
                <h2
                  style={cardTitleStyle}
                >
                  Payment History
                </h2>

                <p
                  style={
                    historyDescriptionStyle
                  }
                >
                  Sab received payments
                  ka permanent record.
                </p>
              </div>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search customer, invoice or reference"
                style={searchInputStyle}
              />
            </div>

            {filteredPayments.length ===
            0 ? (
              <p style={emptyStyle}>
                Koi payment record
                nahi mila.
              </p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table
                  style={tableStyle}
                >
                  <thead>
                    <tr>
                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Date
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Customer
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Invoice
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Amount
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Method
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Reference
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Notes
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPayments.map(
                      (payment) => (
                        <tr
                          key={
                            payment.id
                          }
                        >
                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {payment.payment_date
                              ? new Date(
                                  payment.payment_date +
                                    "T00:00:00"
                                ).toLocaleDateString()
                              : "-"}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {payment
                              .customers
                              ?.name ||
                              "Walk-in Customer"}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {payment
                              .sales
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
                            ).toFixed(2)}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {getPaymentMethodText(
                              payment.payment_method
                            )}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {payment.reference_number ||
                              "-"}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {payment.notes ||
                              "-"}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <div
                              style={
                                actionButtonsStyle
                              }
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/invoice_view?id=${payment.invoice_id}`
                                  )
                                }
                                style={
                                  viewButtonStyle
                                }
                              >
                                View Invoice
                              </button>
                              <button
  type="button"
  onClick={() =>
    router.push(
      `/payment_receipt?id=${payment.id}`
    )
  }
  style={receiptButtonStyle}
>
  View Receipt
</button>

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
                                  cursor:
                                    deletingId ===
                                    payment.id
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                {deletingId ===
                                payment.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
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

const containerStyle: React.CSSProperties = {
  maxWidth: "1300px",
  margin: "0 auto",
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
  gap: "20px",
  marginBottom: "24px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "30px",
};

const descriptionStyle: React.CSSProperties = {
  color: "#667085",
  marginBottom: 0,
};

const summaryBoxStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "14px 20px",
  borderRadius: "10px",
  border: "1px solid #eaecf0",
  minWidth: "180px",
};

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "13px",
  marginBottom: "4px",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "20px",
  color: "#15803d",
};

const gridStyle: React.CSSProperties = {
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
    "0 5px 18px rgba(16,24,40,0.06)",
};

const cardTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: "18px",
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
  fontSize: "15px",
  backgroundColor: "#ffffff",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  fontFamily:
    "Arial, Helvetica, sans-serif",
};

const balanceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, 1fr)",
  gap: "8px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "14px",
  fontSize: "12px",
};

const balanceValueStyle: React.CSSProperties = {
  display: "block",
  marginTop: "5px",
  fontSize: "14px",
};

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "700",
};

const historyHeadingStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "15px",
};

const historyDescriptionStyle: React.CSSProperties = {
  color: "#667085",
  marginTop: "-10px",
};

const searchInputStyle: React.CSSProperties = {
  width: "300px",
  maxWidth: "100%",
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
};

const emptyStyle: React.CSSProperties = {
  color: "#98a2b3",
  textAlign: "center",
  padding: "40px 0",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "1050px",
  borderCollapse: "collapse",
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  borderBottom:
    "1px solid #eaecf0",
  color: "#667085",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom:
    "1px solid #f2f4f7",
  fontSize: "14px",
  color: "#475467",
  verticalAlign: "top",
};

const amountCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  color: "#15803d",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const actionButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const viewButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: "7px",
  backgroundColor: "#eff6ff",
  color: "#2563eb",
  padding: "7px 10px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  borderRadius: "7px",
  backgroundColor: "#fef2f2",
  color: "#dc2626",
  padding: "7px 10px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const receiptButtonStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  borderRadius: "7px",
  backgroundColor: "#f0fdf4",
  color: "#15803d",
  padding: "7px 10px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};