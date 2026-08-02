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
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        invoice_number,
        total_amount,
        created_at,
        companies (
          name,
          email,
          phone,
          address,
          currency
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

  if (loading) {
    return <main style={loadingStyle}>Loading invoice...</main>;
  }

  if (!invoice) {
    return <main style={loadingStyle}>Invoice nahi mili.</main>;
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

  return (
    <main style={pageStyle}>
      <div className="invoice-actions" style={actionRowStyle}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "30px" }}>
              {company?.name || "Accounting SaaS"}
            </h1>

            {company?.address && (
              <p style={companyInfoStyle}>{company.address}</p>
            )}

            {company?.phone && (
              <p style={companyInfoStyle}>{company.phone}</p>
            )}

            {company?.email && (
              <p style={companyInfoStyle}>{company.email}</p>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: 0, fontSize: "28px" }}>
              INVOICE
            </h2>

            <p style={invoiceMetaStyle}>
              <strong>Invoice:</strong>{" "}
              {invoice.invoice_number || invoice.id.slice(0, 8)}
            </p>

            <p style={invoiceMetaStyle}>
              <strong>Date:</strong>{" "}
              {new Date(invoice.created_at).toLocaleDateString()}
            </p>
          </div>
        </header>

        <div style={customerSectionStyle}>
          <p style={sectionLabelStyle}>Bill To</p>

          <h3 style={{ margin: "6px 0" }}>
            {customer?.name || "Walk-in Customer"}
          </h3>

          {customer?.phone && (
            <p style={customerInfoStyle}>{customer.phone}</p>
          )}

          {customer?.email && (
            <p style={customerInfoStyle}>{customer.email}</p>
          )}

          {customer?.address && (
            <p style={customerInfoStyle}>{customer.address}</p>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Product</th>
                <th style={tableHeaderStyle}>SKU</th>
                <th style={numberHeaderStyle}>Quantity</th>
                <th style={numberHeaderStyle}>Rate</th>
                <th style={numberHeaderStyle}>Total</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...tableCellStyle,
                      textAlign: "center",
                      color: "#667085",
                    }}
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
                      {Number(item.unit_price || 0).toFixed(2)}
                    </td>

                    <td style={numberCellStyle}>
                      {currency}
                      {Number(item.total_price || 0).toFixed(2)}
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
              {Number(invoice.total_amount || 0).toFixed(2)}
            </strong>
          </div>

          <div style={grandTotalStyle}>
            <span>Grand Total</span>

            <strong>
              {currency}
              {Number(invoice.total_amount || 0).toFixed(2)}
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
  fontFamily: "Arial",
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
};

const printButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "11px 18px",
  cursor: "pointer",
  fontWeight: "600",
};

const invoiceStyle: React.CSSProperties = {
  maxWidth: "850px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  padding: "40px",
  borderRadius: "12px",
  boxShadow: "0 10px 35px rgba(16,24,40,0.1)",
};

const invoiceHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "24px",
  paddingBottom: "25px",
  borderBottom: "2px solid #2563eb",
};

const companyInfoStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "14px",
};

const invoiceMetaStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#475467",
  fontSize: "14px",
};

const customerSectionStyle: React.CSSProperties = {
  margin: "28px 0",
  padding: "18px",
  backgroundColor: "#f8fafc",
  borderRadius: "10px",
};

const sectionLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#667085",
  fontSize: "13px",
  textTransform: "uppercase",
  fontWeight: "700",
};

const customerInfoStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#667085",
  fontSize: "14px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
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
};

const numberCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  textAlign: "right",
};

const totalsContainerStyle: React.CSSProperties = {
  width: "330px",
  marginLeft: "auto",
  marginTop: "28px",
};

const totalRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "12px 0",
  borderBottom: "1px solid #eaecf0",
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