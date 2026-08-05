"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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
  invoice_number: string | null;
  total_amount: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  payment_status: string | null;
  created_at: string;
  companies: Company | null;
  customers: Customer | null;
  sale_items: SaleItem[];
};

export default function InvoicePage() {
  const router = useRouter();
  const params = useParams();

  const invoiceId = String(params.id || "");

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  async function loadInvoice() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/");
      return;
    }

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        invoice_number,
        total_amount,
        discount_amount,
        tax_amount,
        payment_status,
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
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setInvoice(data as unknown as Invoice);
    setLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  function getStatusText(status: string | null) {
    if (status === "paid") return "Paid";
    if (status === "partial") return "Partial";

    return "Unpaid";
  }

  function getStatusStyle(status: string | null) {
    if (status === "paid") return paidStatusStyle;
    if (status === "partial") return partialStatusStyle;

    return unpaidStatusStyle;
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading invoice...
      </main>
    );
  }

  if (!invoice) {
    return (
      <main style={loadingStyle}>
        Invoice nahi mili.
      </main>
    );
  }

  const company = invoice.companies;
  const customer = invoice.customers;
  const items = invoice.sale_items || [];

  function getCurrencySymbol() {
    if (company?.currency === "USD") return "$";
    if (company?.currency === "GBP") return "£";
    if (company?.currency === "EUR") return "€";
    if (company?.currency === "AED") return "AED ";
    if (company?.currency === "SAR") return "SAR ";

    return "Rs. ";
  }

  const currency = getCurrencySymbol();

  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item.total_price || 0);
  }, 0);

  const discount = Number(invoice.discount_amount || 0);
  const tax = Number(invoice.tax_amount || 0);

  const calculatedGrandTotal =
    subtotal - discount + tax;

  const grandTotal =
    invoice.total_amount !== null
      ? Number(invoice.total_amount)
      : calculatedGrandTotal;

  return (
    <main style={pageStyle}>
      <div
        className="invoice-actions"
        style={actionRowStyle}
      >
        <button
          type="button"
          onClick={() => router.push("/sales")}
          style={backButtonStyle}
        >
          ← Back to Sales
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
                alt={company.name || "Company logo"}
                style={logoStyle}
              />
            )}

            <div>
              <h1 style={companyNameStyle}>
                {company?.name || "Accounting SaaS"}
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
                {customer?.name || "Walk-in Customer"}
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
                      {item.products?.name || "-"}
                    </td>

                    <td style={tableCellStyle}>
                      {item.products?.sku || "-"}
                    </td>

                    <td style={numberCellStyle}>
                      {Number(item.quantity || 0)}
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

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .invoice-actions {
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

const unpaidStatusStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
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