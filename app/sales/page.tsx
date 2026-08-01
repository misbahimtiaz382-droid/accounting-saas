"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  selling_price: number | null;
  stock_quantity: number | null;
};

type Sale = {
  id: string;
  total_amount: number;
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  const selectedProduct = products.find(
    (product) => product.id === productId
  );

  const unitPrice = Number(selectedProduct?.selling_price || 0);
  const saleQuantity = Number(quantity || 0);

  const totalAmount = useMemo(() => {
    return unitPrice * saleQuantity;
  }, [unitPrice, saleQuantity]);

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
      loadProducts(membership.company_id),
      loadSales(membership.company_id),
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

  async function loadProducts(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, selling_price, stock_quantity")
      .eq("company_id", currentCompanyId)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setProducts(data ?? []);
  }

  async function loadSales(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("sales")
      .select("id, total_amount, created_at, customers(name)")
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSales((data as unknown as Sale[]) ?? []);
  }

  async function handleCreateSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customerId) {
      alert("Customer select karo.");
      return;
    }

    if (!productId) {
      alert("Product select karo.");
      return;
    }

    if (saleQuantity <= 0) {
      alert("Quantity 1 ya us se zyada honi chahiye.");
      return;
    }

    if (!selectedProduct) {
      alert("Product load nahi hua.");
      return;
    }

    const availableStock = Number(selectedProduct.stock_quantity || 0);

    if (saleQuantity > availableStock) {
alert("Stock sirf " + availableStock + " available hai.");
      return;
    }

    setSaving(true);

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        company_id: companyId,
        customer_id: customerId,
        total_amount: totalAmount,
      })
      .select("id")
      .single();

    if (saleError) {
      setSaving(false);
      alert(saleError.message);
      return;
    }

    const { error: itemError } = await supabase.from("sale_items").insert({
      sale_id: sale.id,
      product_id: productId,
      quantity: saleQuantity,
      unit_price: unitPrice,
      total_price: totalAmount,
    });

    if (itemError) {
      setSaving(false);
      alert(itemError.message);
      return;
    }

    const { error: stockError } = await supabase
      .from("products")
      .update({
        stock_quantity: availableStock - saleQuantity,
      })
      .eq("id", productId)
      .eq("company_id", companyId);

    setSaving(false);

    if (stockError) {
      alert(stockError.message);
      return;
    }

    setCustomerId("");
    setProductId("");
    setQuantity("1");

    await Promise.all([
      loadProducts(companyId),
      loadSales(companyId),
    ]);

    alert("Sale successfully save ho gayi.");
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
            <h1 style={{ margin: 0, fontSize: "30px" }}>Sales</h1>

            <p style={{ color: "#667085" }}>
              Customer sale aur stock manage karo.
            </p>
          </div>

          <div style={counterStyle}>
            Total Sales: <strong>{sales.length}</strong>
          </div>
        </div>

        <div style={gridStyle}>
          <form onSubmit={handleCreateSale} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Create Sale</h2>

            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
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
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              style={inputStyle}
            >
              <option value="">Select product</option>

              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — Stock: {product.stock_quantity || 0}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Quantity"
              style={inputStyle}
            />

            <div style={totalBoxStyle}>
              <div>
                Unit Price

                <strong style={{ display: "block", marginTop: "5px" }}>
                  Rs. {unitPrice.toFixed(2)}
                </strong>
              </div>

              <div>
                Total

                <strong style={{ display: "block", marginTop: "5px" }}>
                  Rs. {totalAmount.toFixed(2)}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...saveButtonStyle,
                backgroundColor: saving ? "#93c5fd" : "#2563eb",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Create Sale"}
            </button>
          </form>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Recent Sales</h2>

            {sales.length === 0 ? (
              <p style={emptyStyle}>
                Abhi koi sale create nahi hui.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Customer</th>
                      <th style={tableHeaderStyle}>Amount</th>
                      <th style={tableHeaderStyle}>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id}>
                        <td style={tableCellStyle}>
                          {sale.customers?.name || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          Rs. {Number(sale.total_amount || 0).toFixed(2)}
                        </td>

                        <td style={tableCellStyle}>
                          {new Date(sale.created_at).toLocaleDateString()}
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

const counterStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "12px 18px",
  borderRadius: "10px",
  border: "1px solid #eaecf0",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "380px 1fr",
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

const totalBoxStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "16px",
  marginBottom: "16px",
};

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
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