"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Supplier = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  purchase_price: number | null;
  stock_quantity: number | null;
};

type Purchase = {
  id: string;
  invoice_number: string | null;
  total_amount: number | null;
  created_at: string;
  suppliers: {
    name: string;
  } | null;
};

export default function PurchasesPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  const selectedProduct = products.find(
    (product) => product.id === productId
  );

  const purchaseQuantity = Number(quantity || 0);
  const purchasePrice = Number(unitPrice || 0);
  const totalAmount = purchaseQuantity * purchasePrice;

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
      loadSuppliers(membership.company_id),
      loadProducts(membership.company_id),
      loadPurchases(membership.company_id),
    ]);

    setLoading(false);
  }

  async function loadSuppliers(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("company_id", currentCompanyId)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setSuppliers(data ?? []);
  }

  async function loadProducts(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, purchase_price, stock_quantity")
      .eq("company_id", currentCompanyId)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setProducts(data ?? []);
  }

  async function loadPurchases(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("purchases")
      .select(
        "id, invoice_number, total_amount, created_at, suppliers(name)"
      )
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPurchases((data as unknown as Purchase[]) ?? []);
  }

  function handleProductChange(value: string) {
    setProductId(value);

    const product = products.find((item) => item.id === value);

    if (product) {
      setUnitPrice(String(Number(product.purchase_price || 0)));
    } else {
      setUnitPrice("");
    }
  }

  async function handleCreatePurchase(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!supplierId) {
      alert("Supplier select karo.");
      return;
    }

    if (!productId) {
      alert("Product select karo.");
      return;
    }

    if (purchaseQuantity <= 0) {
      alert("Quantity 1 ya us se zyada honi chahiye.");
      return;
    }

    if (purchasePrice < 0) {
      alert("Purchase price sahi likho.");
      return;
    }

    if (!selectedProduct) {
      alert("Product load nahi hua.");
      return;
    }

    setSaving(true);

    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .insert({
        company_id: companyId,
        supplier_id: supplierId,
        total_amount: totalAmount,
      })
      .select("id")
      .single();

    if (purchaseError) {
      setSaving(false);
      alert(purchaseError.message);
      return;
    }

    const { error: itemError } = await supabase
      .from("purchase_items")
      .insert({
        purchase_id: purchase.id,
        product_id: productId,
        quantity: purchaseQuantity,
        unit_price: purchasePrice,
        total_price: totalAmount,
      });

    if (itemError) {
      setSaving(false);
      alert(itemError.message);
      return;
    }

    const oldStock = Number(selectedProduct.stock_quantity || 0);

    const { error: stockError } = await supabase
      .from("products")
      .update({
        stock_quantity: oldStock + purchaseQuantity,
        purchase_price: purchasePrice,
      })
      .eq("id", productId)
      .eq("company_id", companyId);

    setSaving(false);

    if (stockError) {
      alert(stockError.message);
      return;
    }

    setSupplierId("");
    setProductId("");
    setQuantity("1");
    setUnitPrice("");

    await Promise.all([
      loadProducts(companyId),
      loadPurchases(companyId),
    ]);

    alert("Purchase successfully save ho gayi.");
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
            <h1 style={{ margin: 0, fontSize: "30px" }}>
              Purchases
            </h1>

            <p style={{ color: "#667085" }}>
              Supplier purchases aur product stock manage karo.
            </p>
          </div>

          <div style={counterStyle}>
            Total Purchases: <strong>{purchases.length}</strong>
          </div>
        </div>

        <div style={gridStyle}>
          <form onSubmit={handleCreatePurchase} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Create Purchase</h2>

            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              style={inputStyle}
            >
              <option value="">Select supplier</option>

              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <select
              value={productId}
              onChange={(event) =>
                handleProductChange(event.target.value)
              }
              style={inputStyle}
            >
              <option value="">Select product</option>

              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — Current stock:{" "}
                  {product.stock_quantity || 0}
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

            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              placeholder="Purchase price"
              style={inputStyle}
            />

            <div style={totalBoxStyle}>
              <div>
                Quantity
                <strong style={{ display: "block", marginTop: "5px" }}>
                  {purchaseQuantity}
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
              {saving ? "Saving..." : "Create Purchase"}
            </button>
          </form>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Recent Purchases</h2>

            {purchases.length === 0 ? (
              <p style={emptyStyle}>
                Abhi koi purchase create nahi hui.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Invoice</th>
                      <th style={tableHeaderStyle}>Supplier</th>
                      <th style={tableHeaderStyle}>Amount</th>
                      <th style={tableHeaderStyle}>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {purchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td style={tableCellStyle}>
                          {purchase.invoice_number || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          {purchase.suppliers?.name || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          Rs.{" "}
                          {Number(
                            purchase.total_amount || 0
                          ).toFixed(2)}
                        </td>

                        <td style={tableCellStyle}>
                          {new Date(
                            purchase.created_at
                          ).toLocaleDateString()}
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
  gridTemplateColumns: "390px 1fr",
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