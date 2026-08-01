"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  purchase_price: number | null;
  selling_price: number | null;
  stock_quantity: number | null;
};

export default function ProductsPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

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
    await loadProducts(membership.company_id);
    setLoading(false);
  }

  async function loadProducts(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, sku, purchase_price, selling_price, stock_quantity"
      )
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setProducts(data ?? []);
  }

  async function handleAddProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Product name likho.");
      return;
    }

    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("products").insert({
      company_id: companyId,
      name: name.trim(),
      sku: sku.trim() || null,
      purchase_price: purchasePrice ? Number(purchasePrice) : 0,
      selling_price: sellingPrice ? Number(sellingPrice) : 0,
      stock_quantity: stockQuantity ? Number(stockQuantity) : 0,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setSku("");
    setPurchasePrice("");
    setSellingPrice("");
    setStockQuantity("");

    await loadProducts(companyId);
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial",
        }}
      >
        Loading...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f7fb",
        padding: "32px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#172033",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          style={{
            border: "none",
            backgroundColor: "transparent",
            color: "#2563eb",
            cursor: "pointer",
            marginBottom: "20px",
            fontSize: "15px",
          }}
        >
          ← Back to Dashboard
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "30px" }}>Products</h1>
            <p style={{ color: "#667085" }}>
              Products aur stock manage karo.
            </p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "12px 18px",
              borderRadius: "10px",
              border: "1px solid #eaecf0",
            }}
          >
            Total Products: <strong>{products.length}</strong>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px 1fr",
            gap: "24px",
          }}
        >
          <form
            onSubmit={handleAddProduct}
            style={{
              backgroundColor: "#ffffff",
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid #eaecf0",
              boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Add Product</h2>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product name"
              style={inputStyle}
            />

            <input
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="SKU"
              style={inputStyle}
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
              placeholder="Purchase price"
              style={inputStyle}
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
              placeholder="Selling price"
              style={inputStyle}
            />

            <input
              type="number"
              min="0"
              step="1"
              value={stockQuantity}
              onChange={(event) => setStockQuantity(event.target.value)}
              placeholder="Opening stock"
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                padding: "13px",
                border: "none",
                borderRadius: "8px",
                backgroundColor: saving ? "#93c5fd" : "#2563eb",
                color: "#ffffff",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "16px",
              }}
            >
              {saving ? "Saving..." : "Add Product"}
            </button>
          </form>

          <section
            style={{
              backgroundColor: "#ffffff",
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid #eaecf0",
              boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Product List</h2>

            {products.length === 0 ? (
              <p
                style={{
                  color: "#98a2b3",
                  textAlign: "center",
                  padding: "40px 0",
                }}
              >
                Abhi koi product add nahi hua.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Name</th>
                      <th style={tableHeaderStyle}>SKU</th>
                      <th style={tableHeaderStyle}>Purchase</th>
                      <th style={tableHeaderStyle}>Selling</th>
                      <th style={tableHeaderStyle}>Stock</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td style={tableCellStyle}>{product.name}</td>
                        <td style={tableCellStyle}>{product.sku || "-"}</td>
                        <td style={tableCellStyle}>
                          Rs. {Number(product.purchase_price || 0).toFixed(2)}
                        </td>
                        <td style={tableCellStyle}>
                          Rs. {Number(product.selling_price || 0).toFixed(2)}
                        </td>
                        <td style={tableCellStyle}>
                          {product.stock_quantity || 0}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  marginBottom: "14px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
  fontSize: "15px",
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