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
  const [editingProductId, setEditingProductId] = useState<string | null>(
    null
  );

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

    setProducts((data as Product[]) ?? []);
  }

  function resetForm() {
    setEditingProductId(null);
    setName("");
    setSku("");
    setPurchasePrice("");
    setSellingPrice("");
    setStockQuantity("");
  }

  function handleEditProduct(product: Product) {
    setEditingProductId(product.id);
    setName(product.name);
    setSku(product.sku || "");
    setPurchasePrice(
      product.purchase_price === null
        ? ""
        : String(product.purchase_price)
    );
    setSellingPrice(
      product.selling_price === null
        ? ""
        : String(product.selling_price)
    );
    setStockQuantity(
      product.stock_quantity === null
        ? ""
        : String(product.stock_quantity)
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSaveProduct(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Product name likho.");
      return;
    }

    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    const parsedPurchasePrice = purchasePrice
      ? Number(purchasePrice)
      : 0;

    const parsedSellingPrice = sellingPrice
      ? Number(sellingPrice)
      : 0;

    const parsedStockQuantity = stockQuantity
      ? Number(stockQuantity)
      : 0;

    if (
      parsedPurchasePrice < 0 ||
      parsedSellingPrice < 0 ||
      parsedStockQuantity < 0
    ) {
      alert("Price aur stock negative nahi ho sakte.");
      return;
    }

    setSaving(true);

    if (editingProductId) {
      const { error } = await supabase
        .from("products")
        .update({
          name: name.trim(),
          sku: sku.trim() || null,
          purchase_price: parsedPurchasePrice,
          selling_price: parsedSellingPrice,
          stock_quantity: parsedStockQuantity,
        })
        .eq("id", editingProductId)
        .eq("company_id", companyId);

      setSaving(false);

      if (error) {
        alert(error.message);
        return;
      }

      resetForm();
      await loadProducts(companyId);
      alert("Product successfully update ho gaya.");
      return;
    }

    const { error } = await supabase.from("products").insert({
      company_id: companyId,
      name: name.trim(),
      sku: sku.trim() || null,
      purchase_price: parsedPurchasePrice,
      selling_price: parsedSellingPrice,
      stock_quantity: parsedStockQuantity,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    resetForm();
    await loadProducts(companyId);
    alert("Product successfully add ho gaya.");
  }

  async function handleDeleteProduct(product: Product) {
    const confirmed = window.confirm(
      '"' + product.name + '" ko delete karna hai?'
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(product.id);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id)
      .eq("company_id", companyId);

    setDeletingId(null);

    if (error) {
      const message = error.message.toLowerCase();

      if (
        message.includes("foreign key") ||
        message.includes("violates")
      ) {
        alert(
          "Ye product sale ya purchase ke saath linked hai, isliye delete nahi ho sakta."
        );
        return;
      }

      alert(error.message);
      return;
    }

    if (editingProductId === product.id) {
      resetForm();
    }

    await loadProducts(companyId);
    alert("Product delete ho gaya.");
  }

  if (loading) {
    return <main style={loadingStyle}>Loading...</main>;
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "1250px", margin: "0 auto" }}>
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
              Products
            </h1>

            <p style={{ color: "#667085" }}>
              Products aur stock add, edit aur manage karo.
            </p>
          </div>

          <div style={counterStyle}>
            Total Products: <strong>{products.length}</strong>
          </div>
        </div>

        <div style={gridStyle}>
          <form onSubmit={handleSaveProduct} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>
              {editingProductId
                ? "Edit Product"
                : "Add Product"}
            </h2>

            {editingProductId && (
              <div style={editNoticeStyle}>
                Product edit mode active hai.
              </div>
            )}

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
              onChange={(event) =>
                setPurchasePrice(event.target.value)
              }
              placeholder="Purchase price"
              style={inputStyle}
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(event) =>
                setSellingPrice(event.target.value)
              }
              placeholder="Selling price"
              style={inputStyle}
            />

            <input
              type="number"
              min="0"
              step="1"
              value={stockQuantity}
              onChange={(event) =>
                setStockQuantity(event.target.value)
              }
              placeholder="Opening stock"
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={saving}
              style={{
                ...primaryButtonStyle,
                backgroundColor: saving
                  ? "#93c5fd"
                  : "#2563eb",
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : editingProductId
                ? "Update Product"
                : "Add Product"}
            </button>

            {editingProductId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={cancelButtonStyle}
              >
                Cancel Edit
              </button>
            )}
          </form>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Product List</h2>

            {products.length === 0 ? (
              <p style={emptyStyle}>
                Abhi koi product add nahi hua.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Name</th>
                      <th style={tableHeaderStyle}>SKU</th>
                      <th style={tableHeaderStyle}>Purchase</th>
                      <th style={tableHeaderStyle}>Selling</th>
                      <th style={tableHeaderStyle}>Stock</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td style={tableCellStyle}>
                          {product.name}
                        </td>

                        <td style={tableCellStyle}>
                          {product.sku || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          Rs.{" "}
                          {Number(
                            product.purchase_price || 0
                          ).toFixed(2)}
                        </td>

                        <td style={tableCellStyle}>
                          Rs.{" "}
                          {Number(
                            product.selling_price || 0
                          ).toFixed(2)}
                        </td>

                        <td style={tableCellStyle}>
                          {Number(product.stock_quantity || 0)}
                        </td>

                        <td style={tableCellStyle}>
                          <div style={actionButtonsStyle}>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditProduct(product)
                              }
                              style={editButtonStyle}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteProduct(product)
                              }
                              disabled={deletingId === product.id}
                              style={{
                                ...deleteButtonStyle,
                                cursor:
                                  deletingId === product.id
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  deletingId === product.id
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {deletingId === product.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
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
  gridTemplateColumns: "380px minmax(0, 1fr)",
  gap: "24px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const editNoticeStyle: React.CSSProperties = {
  backgroundColor: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  padding: "10px 12px",
  borderRadius: "8px",
  marginBottom: "14px",
  fontSize: "14px",
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

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
};

const cancelButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  color: "#344054",
  cursor: "pointer",
  fontSize: "15px",
  marginTop: "10px",
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
  whiteSpace: "nowrap",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f2f4f7",
  fontSize: "14px",
  verticalAlign: "top",
};

const actionButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const editButtonStyle: React.CSSProperties = {
  border: "1px solid #93c5fd",
  borderRadius: "7px",
  padding: "7px 11px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: "13px",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fda29b",
  borderRadius: "7px",
  padding: "7px 11px",
  backgroundColor: "#fff5f5",
  color: "#b42318",
  fontSize: "13px",
};