"use client";

import {
  CSSProperties,
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number | null;
  stock_quantity: number | null;
};

type Sale = {
  id: string;
  invoice_number: string | null;
  total_amount: number | null;
  payment_status: string | null;
  created_at: string;
  customers: {
    name: string;
  } | null;
};

export default function SalesPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  const selectedProduct = products.find(
    (product) => product.id === productId
  );

  const saleQuantity = Number(quantity || 0);
  const unitPrice = Number(selectedProduct?.sale_price || 0);

  const subtotal = saleQuantity * unitPrice;
  const discount = Math.max(0, Number(discountAmount || 0));
  const tax = Math.max(0, Number(taxAmount || 0));

  const grandTotal = Math.max(
    0,
    subtotal - discount + tax
  );

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

    const currentCompanyId = membership.company_id;

    setCompanyId(currentCompanyId);

    await Promise.all([
      loadCustomers(currentCompanyId),
      loadProducts(currentCompanyId),
      loadSales(currentCompanyId),
    ]);

    setLoading(false);
  }

  async function loadCustomers(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", currentCompanyId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers(data || []);
  }

  async function loadProducts(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, sku, sale_price, stock_quantity"
      )
      .eq("company_id", currentCompanyId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setProducts(data || []);
  }

  async function loadSales(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, invoice_number, total_amount, payment_status, created_at, customers(name)"
      )
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSales((data as unknown as Sale[]) || []);
  }

  function createInvoiceNumber() {
    const timePart = Date.now()
      .toString()
      .slice(-8);

    const randomPart = Math.random()
      .toString(36)
      .substring(2, 5)
      .toUpperCase();

    return "INV-" + timePart + randomPart;
  }

  async function createSale(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    if (!customerId) {
      alert("Customer select karo.");
      return;
    }

    if (!productId || !selectedProduct) {
      alert("Product select karo.");
      return;
    }

    if (
      !Number.isFinite(saleQuantity) ||
      saleQuantity < 1
    ) {
      alert("Quantity 1 ya us se zyada honi chahiye.");
      return;
    }

    const availableStock = Number(
      selectedProduct.stock_quantity || 0
    );

    if (saleQuantity > availableStock) {
      alert(
        "Available stock sirf " +
          availableStock +
          " hai."
      );
      return;
    }

    if (unitPrice <= 0) {
      alert("Product ki sale price valid nahi hai.");
      return;
    }

    if (discount > subtotal) {
      alert("Discount subtotal se zyada nahi ho sakta.");
      return;
    }

    setSaving(true);

    const invoiceNumber = createInvoiceNumber();

    const { data: sale, error: saleError } =
      await supabase
        .from("sales")
        .insert({
          company_id: companyId,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          total_amount: grandTotal,
          discount_amount: discount,
          tax_amount: tax,
          payment_status: paymentStatus,
        })
        .select("id")
        .single();

    if (saleError || !sale) {
      setSaving(false);

      alert(
        saleError?.message ||
          "Sale create nahi hui."
      );

      return;
    }

    const { error: itemError } = await supabase
      .from("sale_items")
      .insert({
        sale_id: sale.id,
        product_id: productId,
        quantity: saleQuantity,
        unit_price: unitPrice,
        total_price: subtotal,
      });

    if (itemError) {
      await supabase
        .from("sales")
        .delete()
        .eq("id", sale.id);

      setSaving(false);
      alert(itemError.message);
      return;
    }

    const newStock =
      availableStock - saleQuantity;

    const { error: stockError } = await supabase
      .from("products")
      .update({
        stock_quantity: newStock,
      })
      .eq("id", productId)
      .eq("company_id", companyId);

    if (stockError) {
      setSaving(false);
      alert(stockError.message);
      return;
    }

    setCustomerId("");
    setProductId("");
    setQuantity("1");
    setDiscountAmount("0");
    setTaxAmount("0");
    setPaymentStatus("unpaid");

    await Promise.all([
      loadProducts(companyId),
      loadSales(companyId),
    ]);

    setSaving(false);

    alert("Sale successfully create ho gayi.");
  }

  function getStatusStyle(status: string | null) {
    if (status === "paid") {
      return paidStatusStyle;
    }

    if (status === "partial") {
      return partialStatusStyle;
    }

    return unpaidStatusStyle;
  }

  function getStatusText(status: string | null) {
    if (status === "paid") {
      return "Paid";
    }

    if (status === "partial") {
      return "Partial";
    }

    return "Unpaid";
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading sales...
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

        <div style={headerRowStyle}>
          <div>
            <h1 style={pageTitleStyle}>Sales</h1>

            <p style={pageDescriptionStyle}>
              Sales create karo, stock update karo aur
              invoices view karo.
            </p>
          </div>

          <div style={salesCountStyle}>
            <span style={countLabelStyle}>
              Total Sales
            </span>

            <strong style={countNumberStyle}>
              {sales.length}
            </strong>
          </div>
        </div>

        <div style={contentGridStyle}>
          <form
            onSubmit={createSale}
            style={formCardStyle}
          >
            <div style={cardHeadingRowStyle}>
              <h2 style={cardTitleStyle}>
                Create Sale
              </h2>

              <p style={cardSubtitleStyle}>
                Customer, product aur quantity select
                karo.
              </p>
            </div>

            <label style={labelStyle}>
              Customer
            </label>

            <select
              value={customerId}
              onChange={(event) =>
                setCustomerId(event.target.value)
              }
              style={inputStyle}
            >
              <option value="">
                Select customer
              </option>

              {customers.map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.name}
                </option>
              ))}
            </select>

            <label style={labelStyle}>
              Product
            </label>

            <select
              value={productId}
              onChange={(event) =>
                setProductId(event.target.value)
              }
              style={inputStyle}
            >
              <option value="">
                Select product
              </option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.name} — Stock:{" "}
                  {Number(
                    product.stock_quantity || 0
                  )}
                </option>
              ))}
            </select>

            <label style={labelStyle}>
              Quantity
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              style={inputStyle}
            />

            <label style={labelStyle}>
              Discount Amount
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={(event) =>
                setDiscountAmount(event.target.value)
              }
              style={inputStyle}
            />

            <label style={labelStyle}>
              Tax Amount
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={taxAmount}
              onChange={(event) =>
                setTaxAmount(event.target.value)
              }
              style={inputStyle}
            />

            <label style={labelStyle}>
              Payment Status
            </label>

            <select
              value={paymentStatus}
              onChange={(event) =>
                setPaymentStatus(event.target.value)
              }
              style={inputStyle}
            >
              <option value="unpaid">
                Unpaid
              </option>

              <option value="paid">
                Paid
              </option>

              <option value="partial">
                Partial
              </option>
            </select>

            <div style={priceDetailsStyle}>
              <div style={priceRowStyle}>
                <span>Unit Price</span>

                <strong>
                  Rs. {unitPrice.toFixed(2)}
                </strong>
              </div>

              <div style={priceRowStyle}>
                <span>Subtotal</span>

                <strong>
                  Rs. {subtotal.toFixed(2)}
                </strong>
              </div>

              <div style={priceRowStyle}>
                <span>Discount</span>

                <strong>
                  - Rs. {discount.toFixed(2)}
                </strong>
              </div>

              <div style={priceRowStyle}>
                <span>Tax</span>

                <strong>
                  + Rs. {tax.toFixed(2)}
                </strong>
              </div>

              <div style={grandTotalRowStyle}>
                <span>Grand Total</span>

                <strong>
                  Rs. {grandTotal.toFixed(2)}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...createButtonStyle,
                opacity: saving ? 0.65 : 1,
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {saving
                ? "Creating Sale..."
                : "Create Sale"}
            </button>
          </form>

          <section style={salesCardStyle}>
            <div style={tableCardHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>
                  Recent Sales
                </h2>

                <p style={cardSubtitleStyle}>
                  Latest sales aur invoices.
                </p>
              </div>

              <span style={recordBadgeStyle}>
                {sales.length} Records
              </span>
            </div>

            {sales.length === 0 ? (
              <div style={emptyStateStyle}>
                <div style={emptyIconStyle}>🧾</div>

                <h3 style={emptyTitleStyle}>
                  Abhi koi sale nahi hai
                </h3>

                <p style={emptyTextStyle}>
                  Pehli sale create karne ke baad record
                  yahan show hoga.
                </p>
              </div>
            ) : (
              <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={firstHeaderStyle}>
                        Date
                      </th>

                      <th style={tableHeaderStyle}>
                        Customer
                      </th>

                      <th style={amountHeaderStyle}>
                        Amount
                      </th>

                      <th style={tableHeaderStyle}>
                        Status
                      </th>

                      <th style={tableHeaderStyle}>
                        Invoice
                      </th>

                      <th style={actionHeaderStyle}>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id}>
                        <td style={firstCellStyle}>
                          {new Date(
                            sale.created_at
                          ).toLocaleDateString()}
                        </td>

                        <td style={tableCellStyle}>
                          <div style={customerCellStyle}>
                            <span
                              style={customerAvatarStyle}
                            >
                              {(
                                sale.customers?.name ||
                                "W"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </span>

                            <span>
                              {sale.customers?.name ||
                                "Walk-in Customer"}
                            </span>
                          </div>
                        </td>

                        <td style={amountCellStyle}>
                          Rs.{" "}
                          {Number(
                            sale.total_amount || 0
                          ).toFixed(2)}
                        </td>

                        <td style={tableCellStyle}>
                          <span
                            style={getStatusStyle(
                              sale.payment_status
                            )}
                          >
                            {getStatusText(
                              sale.payment_status
                            )}
                          </span>
                        </td>

                        <td style={tableCellStyle}>
                          <span
                            style={invoiceBadgeStyle}
                          >
                            {sale.invoice_number ||
                              "No invoice"}
                          </span>
                        </td>

                        <td style={actionCellStyle}>
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                "/invoices/" + sale.id
                              )
                            }
                            style={invoiceButtonStyle}
                          >
                            View Invoice
                          </button>
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

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  padding: "32px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#172033",
};

const loadingStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f4f7fb",
  fontFamily: "Arial, sans-serif",
  color: "#475467",
};

const containerStyle: CSSProperties = {
  maxWidth: "1380px",
  margin: "0 auto",
};

const backButtonStyle: CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  padding: "0",
  marginBottom: "22px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "26px",
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "30px",
  lineHeight: "38px",
  color: "#101828",
};

const pageDescriptionStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#667085",
  fontSize: "15px",
};

const salesCountStyle: CSSProperties = {
  minWidth: "135px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "14px 18px",
  boxShadow:
    "0 4px 14px rgba(16,24,40,0.04)",
};

const countLabelStyle: CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "12px",
  marginBottom: "5px",
};

const countNumberStyle: CSSProperties = {
  fontSize: "24px",
  color: "#101828",
};

const contentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(320px, 410px) minmax(0, 1fr)",
  gap: "24px",
  alignItems: "start",
};

const formCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  boxShadow:
    "0 8px 24px rgba(16,24,40,0.06)",
};

const salesCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  boxShadow:
    "0 8px 24px rgba(16,24,40,0.06)",
  overflow: "hidden",
};

const cardHeadingRowStyle: CSSProperties = {
  marginBottom: "22px",
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "19px",
};

const cardSubtitleStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "7px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: "600",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 12px",
  marginBottom: "16px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontSize: "14px",
  outline: "none",
};

const priceDetailsStyle: CSSProperties = {
  padding: "16px",
  marginBottom: "18px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  borderRadius: "11px",
};

const priceRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "7px 0",
  color: "#475467",
  fontSize: "14px",
};

const grandTotalRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "8px",
  paddingTop: "13px",
  borderTop: "1px solid #d0d5dd",
  color: "#2563eb",
  fontSize: "17px",
  fontWeight: "700",
};

const createButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  border: "none",
  borderRadius: "9px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
};

const tableCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "22px 24px",
  borderBottom: "1px solid #eaecf0",
};

const recordBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "700",
};

const tableWrapperStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "900px",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const tableHeaderStyle: CSSProperties = {
  padding: "13px 16px",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
  color: "#475467",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const firstHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  paddingLeft: "24px",
};

const amountHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "right",
};

const actionHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "center",
  paddingRight: "24px",
};

const tableCellStyle: CSSProperties = {
  padding: "16px",
  borderBottom: "1px solid #f2f4f7",
  color: "#475467",
  fontSize: "14px",
  verticalAlign: "middle",
};

const firstCellStyle: CSSProperties = {
  ...tableCellStyle,
  paddingLeft: "24px",
  color: "#344054",
  whiteSpace: "nowrap",
};

const amountCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: "right",
  color: "#101828",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const actionCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: "center",
  paddingRight: "24px",
};

const customerCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "#344054",
  fontWeight: "600",
};

const customerAvatarStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "50%",
  backgroundColor: "#eff6ff",
  color: "#2563eb",
  fontSize: "13px",
  fontWeight: "700",
};

const invoiceBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: "7px",
  backgroundColor: "#f2f4f7",
  color: "#344054",
  fontSize: "12px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const invoiceButtonStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: "8px",
  padding: "8px 12px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const paidStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#dcfce7",
  color: "#15803d",
  fontSize: "12px",
  fontWeight: "700",
};

const unpaidStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
  fontSize: "12px",
  fontWeight: "700",
};

const partialStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#fef3c7",
  color: "#b45309",
  fontSize: "12px",
  fontWeight: "700",
};

const emptyStateStyle: CSSProperties = {
  padding: "65px 24px",
  textAlign: "center",
};

const emptyIconStyle: CSSProperties = {
  fontSize: "34px",
  marginBottom: "12px",
};

const emptyTitleStyle: CSSProperties = {
  margin: 0,
  color: "#344054",
  fontSize: "16px",
};

const emptyTextStyle: CSSProperties = {
  maxWidth: "360px",
  margin: "8px auto 0",
  color: "#667085",
  fontSize: "13px",
  lineHeight: 1.6,
};