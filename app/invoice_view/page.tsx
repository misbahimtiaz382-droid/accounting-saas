"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Company = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string | null;
  logo_url: string | null;
};

type Customer = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type Product = {
  name: string;
  sku: string | null;
};

type SaleItem = {
  id: string;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  products: Product | null;
};

type Invoice = {
  id: string;
  company_id: string;
  customer_id: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  payment_status: string | null;
  payment_method: string | null;
  due_date: string | null;
  created_at: string;
  companies: Company | null;
  customers: Customer | null;
  sale_items: SaleItem[];
};

type PaymentReceived = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
};

function getTodayDate() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - timezoneOffset)
    .toISOString()
    .split("T")[0];
}

export default function InvoiceViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const invoiceId = searchParams.get("id") || "";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<PaymentReceived[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDate());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }

    loadPageData();
  }, [invoiceId]);

  async function getCurrentCompanyId() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/");
      return null;
    }

    const { data: membership, error: membershipError } =
      await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError || !membership?.company_id) {
      alert(
        membershipError?.message ||
          "Company membership nahi mili."
      );

      return null;
    }

    return {
      userId: user.id,
      companyId: membership.company_id as string,
    };
  }

  async function loadPageData() {
    setLoading(true);

    const currentCompany = await getCurrentCompanyId();

    if (!currentCompany) {
      setLoading(false);
      return;
    }

    const invoiceResult = await supabase
      .from("sales")
      .select(`
        id,
        company_id,
        customer_id,
        invoice_number,
        total_amount,
        discount_amount,
        tax_amount,
        paid_amount,
        remaining_balance,
        payment_status,
        payment_method,
        due_date,
        created_at,
        companies (
          name,
          email,
          phone,
          address,
          currency,
          logo_url
        ),
        customers (
          name,
          email,
          phone,
          address
        ),
        sale_items (
          id,
          quantity,
          unit_price,
          total_price,
          products (
            name,
            sku
          )
        )
      `)
      .eq("id", invoiceId)
      .eq("company_id", currentCompany.companyId)
      .maybeSingle();

    if (invoiceResult.error) {
      alert(
        "Invoice load error: " +
          invoiceResult.error.message
      );

      setLoading(false);
      return;
    }

    if (!invoiceResult.data) {
      setInvoice(null);
      setPayments([]);
      setLoading(false);
      return;
    }

    const loadedInvoice =
      invoiceResult.data as unknown as Invoice;

    setInvoice(loadedInvoice);

    const paymentsResult = await supabase
      .from("payments_received")
      .select(`
        id,
        amount,
        payment_date,
        payment_method,
        reference_number,
        notes,
        created_at
      `)
      .eq("invoice_id", invoiceId)
      .eq("company_id", currentCompany.companyId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (paymentsResult.error) {
      alert(
        "Payment history load error: " +
          paymentsResult.error.message
      );

      setPayments([]);
    } else {
      setPayments(
        (paymentsResult.data || []) as PaymentReceived[]
      );
    }

    const currentRemaining = Number(
      loadedInvoice.remaining_balance || 0
    );

    setPaymentAmount(
      currentRemaining > 0
        ? currentRemaining.toFixed(2)
        : ""
    );

    setLoading(false);
  }

  async function handleReceivePayment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!invoice || savingPayment) return;

    const amount = Number(paymentAmount);
    const totalAmount = Number(invoice.total_amount || 0);
    const oldPaidAmount = Number(invoice.paid_amount || 0);
    const oldRemainingBalance = Number(
      invoice.remaining_balance || 0
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Valid payment amount enter karo.");
      return;
    }

    if (!paymentDate) {
      alert("Payment date select karo.");
      return;
    }

    if (oldRemainingBalance <= 0) {
      alert("Ye invoice already fully paid hai.");
      return;
    }

    if (amount > oldRemainingBalance) {
      alert(
        `Payment remaining balance se zyada nahi ho sakti. Maximum ${getCurrencySymbol()}${oldRemainingBalance.toFixed(
          2
        )} hai.`
      );

      return;
    }

    setSavingPayment(true);

    const currentCompany = await getCurrentCompanyId();

    if (!currentCompany) {
      setSavingPayment(false);
      return;
    }

    const newPaidAmount = Number(
      Math.min(
        totalAmount,
        oldPaidAmount + amount
      ).toFixed(2)
    );

    const newRemainingBalance = Number(
      Math.max(
        0,
        totalAmount - newPaidAmount
      ).toFixed(2)
    );

    const newPaymentStatus =
      newRemainingBalance <= 0
        ? "paid"
        : newPaidAmount > 0
        ? "partial"
        : "unpaid";

    const {
      data: insertedPayment,
      error: paymentInsertError,
    } = await supabase
      .from("payments_received")
      .insert({
        company_id: currentCompany.companyId,
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod || null,
        reference_number:
          referenceNumber.trim() || null,
        notes: paymentNotes.trim() || null,
        created_by: currentCompany.userId,
      })
      .select("id")
      .single();

    if (paymentInsertError || !insertedPayment) {
      alert(
        "Payment save error: " +
          (paymentInsertError?.message ||
            "Unknown error")
      );

      setSavingPayment(false);
      return;
    }

    const { error: invoiceUpdateError } =
      await supabase
        .from("sales")
        .update({
          paid_amount: newPaidAmount,
          remaining_balance: newRemainingBalance,
          payment_status: newPaymentStatus,
          payment_method: paymentMethod || null,
        })
        .eq("id", invoice.id)
        .eq(
          "company_id",
          currentCompany.companyId
        );

    if (invoiceUpdateError) {
      await supabase
        .from("payments_received")
        .delete()
        .eq("id", insertedPayment.id)
        .eq(
          "company_id",
          currentCompany.companyId
        );

      alert(
        "Invoice update error: " +
          invoiceUpdateError.message
      );

      setSavingPayment(false);
      return;
    }

    setReferenceNumber("");
    setPaymentNotes("");
    setPaymentDate(getTodayDate());

    alert("Payment successfully save ho gayi.");

    await loadPageData();

    setSavingPayment(false);
  }

  function handlePrint() {
    window.print();
  }

  function getCurrencySymbol() {
    const currency = invoice?.companies?.currency;

    if (currency === "USD") return "$";
    if (currency === "GBP") return "£";
    if (currency === "EUR") return "€";
    if (currency === "AED") return "AED ";
    if (currency === "SAR") return "SAR ";

    return "Rs. ";
  }

  function getStatusText(status: string | null) {
    if (status === "paid") return "Paid";
    if (status === "partial") return "Partial";

    return "Unpaid";
  }

  function getStatusStyle(status: string | null) {
    if (status === "paid") return paidStatusStyle;
    if (status === "partial")
      return partialStatusStyle;

    return unpaidStatusStyle;
  }

  function getPaymentMethodText(
    method: string | null
  ) {
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

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading invoice...
      </main>
    );
  }

  if (!invoiceId) {
    return (
      <main style={loadingStyle}>
        <div style={errorBoxStyle}>
          <h2 style={{ marginTop: 0 }}>
            Invoice ID nahi mili
          </h2>

          <button
            type="button"
            onClick={() =>
              router.push("/invoices")
            }
            style={primaryButtonStyle}
          >
            Back to Invoices
          </button>
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main style={loadingStyle}>
        <div style={errorBoxStyle}>
          <h2 style={{ marginTop: 0 }}>
            Invoice nahi mili
          </h2>

          <button
            type="button"
            onClick={() =>
              router.push("/invoices")
            }
            style={primaryButtonStyle}
          >
            Back to Invoices
          </button>
        </div>
      </main>
    );
  }

  const company = invoice.companies;
  const customer = invoice.customers;
  const items = invoice.sale_items || [];
  const currency = getCurrencySymbol();

  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.total_price || 0),
    0
  );

  const discount = Number(
    invoice.discount_amount || 0
  );

  const tax = Number(invoice.tax_amount || 0);

  const calculatedGrandTotal =
    subtotal - discount + tax;

  const grandTotal =
    invoice.total_amount !== null
      ? Number(invoice.total_amount)
      : calculatedGrandTotal;

  const paidAmount = Number(
    invoice.paid_amount || 0
  );

  const remainingBalance = Number(
    invoice.remaining_balance || 0
  );

  return (
    <main style={pageStyle}>
      <div
        className="invoice-actions"
        style={actionRowStyle}
      >
        <button
          type="button"
          onClick={() =>
            router.push("/invoices")
          }
          style={backButtonStyle}
        >
          ← Back to Invoices
        </button>

        <button
          type="button"
          onClick={handlePrint}
          style={printButtonStyle}
        >
          Print / Save PDF
        </button>
      </div>

      <section style={invoiceStyle}>
        <header style={invoiceHeaderStyle}>
          <div style={companyBlockStyle}>
            {company?.logo_url && (
              <img
                src={company.logo_url}
                alt={
                  company.name || "Company logo"
                }
                style={logoStyle}
              />
            )}

            <div>
              <h1 style={companyNameStyle}>
                {company?.name ||
                  "Accounting SaaS"}
              </h1>

              {company?.address && (
                <p style={companyInfoStyle}>
                  {company.address}
                </p>
              )}

              {company?.phone && (
                <p style={companyInfoStyle}>
                  {company.phone}
                </p>
              )}

              {company?.email && (
                <p style={companyInfoStyle}>
                  {company.email}
                </p>
              )}
            </div>
          </div>

          <div style={invoiceMetaContainerStyle}>
            <h2 style={invoiceTitleStyle}>
              INVOICE
            </h2>

            <p style={invoiceMetaStyle}>
              <strong>Invoice:</strong>{" "}
              {invoice.invoice_number ||
                invoice.id.slice(0, 8)}
            </p>

            <p style={invoiceMetaStyle}>
              <strong>Date:</strong>{" "}
              {new Date(
                invoice.created_at
              ).toLocaleDateString()}
            </p>

            <p style={invoiceMetaStyle}>
              <strong>Due Date:</strong>{" "}
              {invoice.due_date
                ? new Date(
                    invoice.due_date
                  ).toLocaleDateString()
                : "-"}
            </p>

            <p style={invoiceMetaStyle}>
              <strong>
                Last Payment Method:
              </strong>{" "}
              {getPaymentMethodText(
                invoice.payment_method
              )}
            </p>

            <div style={statusRowStyle}>
              <strong>Status:</strong>

              <span
                style={getStatusStyle(
                  invoice.payment_status
                )}
              >
                {getStatusText(
                  invoice.payment_status
                )}
              </span>
            </div>
          </div>
        </header>

        <div style={customerSectionStyle}>
          <p style={sectionLabelStyle}>
            Bill To
          </p>

          <div style={customerDetailsStyle}>
            <div style={customerDetailRowStyle}>
              <span style={customerLabelStyle}>
                Name:
              </span>

              <span style={customerValueStyle}>
                {customer?.name ||
                  "Walk-in Customer"}
              </span>
            </div>

            {customer?.phone && (
              <div style={customerDetailRowStyle}>
                <span style={customerLabelStyle}>
                  Phone:
                </span>

                <span style={customerValueStyle}>
                  {customer.phone}
                </span>
              </div>
            )}

            {customer?.email && (
              <div style={customerDetailRowStyle}>
                <span style={customerLabelStyle}>
                  Email:
                </span>

                <span style={customerValueStyle}>
                  {customer.email}
                </span>
              </div>
            )}

            {customer?.address && (
              <div style={customerDetailRowStyle}>
                <span style={customerLabelStyle}>
                  Address:
                </span>

                <span style={customerValueStyle}>
                  {customer.address}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>
                  Product
                </th>

                <th style={tableHeaderStyle}>
                  SKU
                </th>

                <th style={numberHeaderStyle}>
                  Quantity
                </th>

                <th style={numberHeaderStyle}>
                  Rate
                </th>

                <th style={numberHeaderStyle}>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={emptyCellStyle}
                  >
                    Invoice items nahi mile.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td style={tableCellStyle}>
                      {item.products?.name ||
                        "-"}
                    </td>

                    <td style={tableCellStyle}>
                      {item.products?.sku || "-"}
                    </td>

                    <td style={numberCellStyle}>
                      {Number(
                        item.quantity || 0
                      )}
                    </td>

                    <td style={numberCellStyle}>
                      {currency}
                      {Number(
                        item.unit_price || 0
                      ).toFixed(2)}
                    </td>

                    <td style={numberCellStyle}>
                      {currency}
                      {Number(
                        item.total_price || 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={totalsContainerStyle}>
          <div style={totalRowStyle}>
            <span>Subtotal</span>

            <strong>
              {currency}
              {subtotal.toFixed(2)}
            </strong>
          </div>

          <div style={totalRowStyle}>
            <span>Discount</span>

            <strong style={discountValueStyle}>
              - {currency}
              {discount.toFixed(2)}
            </strong>
          </div>

          <div style={totalRowStyle}>
            <span>Tax</span>

            <strong style={taxValueStyle}>
              + {currency}
              {tax.toFixed(2)}
            </strong>
          </div>

          <div style={totalRowStyle}>
            <span>Paid Amount</span>

            <strong style={paidValueStyle}>
              {currency}
              {paidAmount.toFixed(2)}
            </strong>
          </div>

          <div style={totalRowStyle}>
            <span>Remaining Balance</span>

            <strong style={remainingValueStyle}>
              {currency}
              {remainingBalance.toFixed(2)}
            </strong>
          </div>

          <div style={grandTotalStyle}>
            <span>Grand Total</span>

            <strong>
              {currency}
              {grandTotal.toFixed(2)}
            </strong>
          </div>
        </div>

        <footer style={footerStyle}>
          Thank you for your business.
        </footer>
      </section>

      <section
        className="payment-management"
        style={paymentManagementStyle}
      >
        <div style={paymentCardStyle}>
          <h2 style={paymentHeadingStyle}>
            Receive Payment
          </h2>

          <p style={paymentDescriptionStyle}>
            Payment save hone ke baad invoice
            balance aur status automatically
            update hoga.
          </p>

          {remainingBalance <= 0 ? (
            <div style={fullyPaidBoxStyle}>
              Ye invoice fully paid hai.
            </div>
          ) : (
            <form
              onSubmit={handleReceivePayment}
              style={paymentFormStyle}
            >
              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>
                  Amount
                </span>

                <input
                  type="number"
                  min="0.01"
                  max={remainingBalance}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                  required
                />
              </label>

              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>
                  Payment Date
                </span>

                <input
                  type="date"
                  value={paymentDate}
                  onChange={(event) =>
                    setPaymentDate(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                  required
                />
              </label>

              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>
                  Payment Method
                </span>

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

                  <option value="jazzcash">
                    JazzCash
                  </option>

                  <option value="easypaisa">
                    EasyPaisa
                  </option>

                  <option value="cheque">
                    Cheque
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>
                  Reference Number
                </span>

                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(event) =>
                    setReferenceNumber(
                      event.target.value
                    )
                  }
                  placeholder="Transaction ID / cheque number"
                  style={inputStyle}
                />
              </label>

              <label
                style={fullWidthFieldStyle}
              >
                <span style={fieldLabelStyle}>
                  Notes
                </span>

                <textarea
                  value={paymentNotes}
                  onChange={(event) =>
                    setPaymentNotes(
                      event.target.value
                    )
                  }
                  placeholder="Optional payment notes"
                  rows={3}
                  style={textareaStyle}
                />
              </label>

              <div style={fullWidthFieldStyle}>
                <button
                  type="submit"
                  disabled={savingPayment}
                  style={{
                    ...receivePaymentButtonStyle,
                    opacity: savingPayment
                      ? 0.65
                      : 1,
                    cursor: savingPayment
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {savingPayment
                    ? "Saving Payment..."
                    : "Save Payment"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={paymentCardStyle}>
          <h2 style={paymentHeadingStyle}>
            Payment History
          </h2>

          <p style={paymentDescriptionStyle}>
            Har received payment ka permanent
            record.
          </p>

          <div style={paymentTableWrapperStyle}>
            <table style={paymentTableStyle}>
              <thead>
                <tr>
                  <th
                    style={paymentTableHeaderStyle}
                  >
                    Date
                  </th>

                  <th
                    style={paymentTableHeaderStyle}
                  >
                    Amount
                  </th>

                  <th
                    style={paymentTableHeaderStyle}
                  >
                    Method
                  </th>

                  <th
                    style={paymentTableHeaderStyle}
                  >
                    Reference
                  </th>

                  <th
                    style={paymentTableHeaderStyle}
                  >
                    Notes
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={
                        paymentEmptyCellStyle
                      }
                    >
                      Abhi koi payment record
                      nahi hai.
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id}>
                      <td
                        style={
                          paymentTableCellStyle
                        }
                      >
                        {new Date(
                          payment.payment_date +
                            "T00:00:00"
                        ).toLocaleDateString()}
                      </td>

                      <td
                        style={
                          paymentAmountCellStyle
                        }
                      >
                        {currency}
                        {Number(
                          payment.amount
                        ).toFixed(2)}
                      </td>

                      <td
                        style={
                          paymentTableCellStyle
                        }
                      >
                        {getPaymentMethodText(
                          payment.payment_method
                        )}
                      </td>

                      <td
                        style={
                          paymentTableCellStyle
                        }
                      >
                        {payment.reference_number ||
                          "-"}
                      </td>

                      <td
                        style={
                          paymentTableCellStyle
                        }
                      >
                        {payment.notes || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .invoice-actions,
          .payment-management {
            display: none !important;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#eef2f7",
  padding: "32px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#172033",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#eef2f7",
  fontFamily: "Arial, sans-serif",
  color: "#475467",
};

const errorBoxStyle: React.CSSProperties = {
  padding: "30px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  textAlign: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "11px 18px",
  cursor: "pointer",
  fontWeight: "700",
};

const actionRowStyle: React.CSSProperties = {
  maxWidth: "900px",
  margin: "0 auto 20px",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
};

const backButtonStyle: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  color: "#344054",
  padding: "11px 16px",
  cursor: "pointer",
  fontWeight: "600",
};

const printButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "11px 18px",
  cursor: "pointer",
  fontWeight: "700",
};

const invoiceStyle: React.CSSProperties = {
  maxWidth: "850px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  padding: "40px",
  borderRadius: "12px",
  boxShadow:
    "0 10px 35px rgba(16,24,40,0.1)",
};

const invoiceHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "24px",
  paddingBottom: "25px",
  borderBottom: "2px solid #2563eb",
};

const companyBlockStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
};

const logoStyle: React.CSSProperties = {
  width: "74px",
  height: "74px",
  borderRadius: "10px",
  objectFit: "contain",
  border: "1px solid #eaecf0",
  padding: "6px",
  backgroundColor: "#ffffff",
};

const companyNameStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "30px",
  color: "#101828",
};

const companyInfoStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "14px",
};

const invoiceMetaContainerStyle: React.CSSProperties = {
  textAlign: "right",
};

const invoiceTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "28px",
  color: "#101828",
};

const invoiceMetaStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#475467",
  fontSize: "14px",
};

const statusRowStyle: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "8px",
  color: "#475467",
  fontSize: "14px",
};

const paidStatusStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#dcfce7",
  color: "#15803d",
  fontSize: "12px",
  fontWeight: "700",
};

const partialStatusStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#fef3c7",
  color: "#b45309",
  fontSize: "12px",
  fontWeight: "700",
};

const unpaidStatusStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
  fontSize: "12px",
  fontWeight: "700",
};

const customerSectionStyle: React.CSSProperties = {
  margin: "28px 0",
  padding: "18px",
  backgroundColor: "#f8fafc",
  borderRadius: "10px",
  border: "1px solid #eaecf0",
};

const sectionLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#667085",
  fontSize: "12px",
  textTransform: "uppercase",
  fontWeight: "700",
  letterSpacing: "0.04em",
};

const customerDetailsStyle: React.CSSProperties = {
  marginTop: "14px",
  display: "grid",
  gap: "10px",
};

const customerDetailRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "85px 1fr",
  gap: "12px",
  alignItems: "start",
};

const customerLabelStyle: React.CSSProperties = {
  color: "#344054",
  fontSize: "14px",
  fontWeight: "700",
};

const customerValueStyle: React.CSSProperties = {
  color: "#667085",
  fontSize: "14px",
  wordBreak: "break-word",
};

const tableWrapperStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "650px",
  borderCollapse: "collapse",
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  backgroundColor: "#101828",
  color: "#ffffff",
  padding: "13px",
  fontSize: "13px",
};

const numberHeaderStyle: React.CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "right",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 13px",
  borderBottom: "1px solid #eaecf0",
  fontSize: "14px",
  color: "#475467",
};

const numberCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const emptyCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  textAlign: "center",
  color: "#667085",
};

const totalsContainerStyle: React.CSSProperties = {
  width: "350px",
  marginLeft: "auto",
  marginTop: "28px",
};

const totalRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "11px 4px",
  borderBottom: "1px solid #eaecf0",
  color: "#475467",
};

const discountValueStyle: React.CSSProperties = {
  color: "#b91c1c",
};

const taxValueStyle: React.CSSProperties = {
  color: "#15803d",
};

const paidValueStyle: React.CSSProperties = {
  color: "#15803d",
};

const remainingValueStyle: React.CSSProperties = {
  color: "#b45309",
};

const grandTotalStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "16px",
  marginTop: "8px",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "18px",
};

const footerStyle: React.CSSProperties = {
  marginTop: "45px",
  paddingTop: "20px",
  borderTop: "1px solid #eaecf0",
  textAlign: "center",
  color: "#667085",
  fontSize: "14px",
};

const paymentManagementStyle: React.CSSProperties = {
  maxWidth: "930px",
  margin: "24px auto 0",
  display: "grid",
  gap: "20px",
};

const paymentCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "12px",
  border: "1px solid #e4e7ec",
  boxShadow:
    "0 8px 24px rgba(16,24,40,0.06)",
};

const paymentHeadingStyle: React.CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "22px",
};

const paymentDescriptionStyle: React.CSSProperties = {
  margin: "8px 0 20px",
  color: "#667085",
  fontSize: "14px",
};

const paymentFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: "7px",
};

const fullWidthFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: "7px",
  gridColumn: "1 / -1",
};

const fieldLabelStyle: React.CSSProperties = {
  color: "#344054",
  fontSize: "13px",
  fontWeight: "700",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  padding: "11px 12px",
  fontSize: "14px",
  color: "#101828",
  backgroundColor: "#ffffff",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const receivePaymentButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#16a34a",
  color: "#ffffff",
  padding: "12px 18px",
  fontWeight: "700",
  fontSize: "14px",
};

const fullyPaidBoxStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "8px",
  backgroundColor: "#dcfce7",
  color: "#166534",
  fontWeight: "700",
};

const paymentTableWrapperStyle: React.CSSProperties = {
  overflowX: "auto",
};

const paymentTableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "720px",
  borderCollapse: "collapse",
};

const paymentTableHeaderStyle: React.CSSProperties = {
  backgroundColor: "#f2f4f7",
  color: "#344054",
  padding: "12px",
  textAlign: "left",
  fontSize: "13px",
  borderBottom: "1px solid #d0d5dd",
};

const paymentTableCellStyle: React.CSSProperties = {
  padding: "13px 12px",
  color: "#475467",
  fontSize: "14px",
  borderBottom: "1px solid #eaecf0",
  verticalAlign: "top",
  wordBreak: "break-word",
};

const paymentAmountCellStyle: React.CSSProperties = {
  ...paymentTableCellStyle,
  color: "#15803d",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const paymentEmptyCellStyle: React.CSSProperties = {
  ...paymentTableCellStyle,
  textAlign: "center",
  color: "#667085",
};