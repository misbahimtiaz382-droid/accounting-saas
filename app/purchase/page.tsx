"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

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

type PurchaseItem = {
  id: string;
  product_id: string;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;

  products: {
    name: string;
  } | null;
};

type Purchase = {
  id: string;
  supplier_id: string | null;
  purchase_number: string | null;
  invoice_number: string | null;

  total_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;

  payment_status: string | null;

  created_at: string;

  suppliers: {
    name: string;
  } | null;

  purchase_items: PurchaseItem[];
};

export default function PurchasesPage() {
  const router = useRouter();

  const [companyId, setCompanyId] =
    useState("");

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [supplierId, setSupplierId] =
    useState("");

  const [productId, setProductId] =
    useState("");

  const [quantity, setQuantity] =
    useState("1");

  const [unitPrice, setUnitPrice] =
    useState("");

  const [
    invoiceNumber,
    setInvoiceNumber,
  ] = useState("");

  const [paidAmount, setPaidAmount] =
    useState("0");

  const [selectedPurchase, setSelectedPurchase] =
    useState<Purchase | null>(null);

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
      loadProducts(
        membership.company_id
      ),
      loadPurchases(
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

  async function loadProducts(
    id: string
  ) {
    const { data, error } =
      await supabase
        .from("products")
        .select(`
          id,
          name,
          purchase_price,
          stock_quantity
        `)
        .eq("company_id", id)
        .order("name");

    if (error) {
      alert(
        "Products load error: " +
          error.message
      );
      return;
    }

    setProducts(data || []);
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
          payment_status,
          created_at,

          suppliers (
            name
          ),

          purchase_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_price,

            products (
              name
            )
          )
        `)
        .eq("company_id", id)
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      alert(
        "Purchases load error: " +
          error.message
      );
      return;
    }

    setPurchases(
      (data || []) as unknown as Purchase[]
    );
  }

  const selectedProduct =
    products.find(
      (item) =>
        item.id === productId
    );

  const totalAmount =
    Number(quantity || 0) *
    Number(unitPrice || 0);

  const enteredPaidAmount =
    Number(paidAmount || 0);

  const remainingBalance =
    Math.max(
      totalAmount -
        enteredPaidAmount,
      0
    );

  function handleProduct(
    value: string
  ) {
    setProductId(value);

    const product =
      products.find(
        (item) =>
          item.id === value
      );

    if (product) {
      setUnitPrice(
        String(
          product.purchase_price ||
            0
        )
      );
    } else {
      setUnitPrice("");
    }
  }

  function getPaymentStatus(
    total: number,
    paid: number
  ) {
    if (total <= 0) {
      return "unpaid";
    }

    if (paid <= 0) {
      return "unpaid";
    }

    if (paid < total) {
      return "partial";
    }

    return "paid";
  }

  async function createPurchase(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (saving) return;

    const qty =
      Number(quantity);

    const price =
      Number(unitPrice);

    const paid =
      Number(paidAmount || 0);

    if (!supplierId) {
      alert(
        "Supplier select karo."
      );
      return;
    }

    if (!productId) {
      alert(
        "Product select karo."
      );
      return;
    }

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      alert(
        "Quantity sahi enter karo."
      );
      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      alert(
        "Purchase price sahi enter karo."
      );
      return;
    }

    if (totalAmount <= 0) {
      alert(
        "Purchase total zero nahi ho sakta."
      );
      return;
    }

    if (
      !Number.isFinite(paid) ||
      paid < 0
    ) {
      alert(
        "Paid amount sahi enter karo."
      );
      return;
    }

    if (paid > totalAmount) {
      alert(
        "Paid amount purchase total se zyada nahi ho sakta."
      );
      return;
    }
setSaving(true);

const status =
  getPaymentStatus(
    totalAmount,
    paid
  );

const remaining =
  Math.max(
    totalAmount - paid,
    0
  );

const { data: purchaseNumber, error: numberError } =
  await supabase.rpc("generate_purchase_number");

if (numberError || !purchaseNumber) {
  alert("Purchase number generate nahi hua.");
  setSaving(false);
  return;
}

const {
  data: purchase,
  error: purchaseError,
} = await supabase
      .from("purchases")
     .insert({
  company_id: companyId,
  supplier_id: supplierId,

  purchase_number: purchaseNumber,

  invoice_number:
    invoiceNumber.trim() || null,

  total_amount: totalAmount,
  paid_amount: paid,
  remaining_balance: remaining,
  payment_status: status,
})
      .select("id")
      .single();

    if (
      purchaseError ||
      !purchase
    ) {
      alert(
        "Purchase save error: " +
          (purchaseError?.message ||
            "Unknown error")
      );

      setSaving(false);
      return;
    }

    const {
      error: itemError,
    } = await supabase
      .from("purchase_items")
      .insert({
        purchase_id:
          purchase.id,

        product_id:
          productId,

        quantity:
          qty,

        unit_price:
          price,

        total_price:
          totalAmount,
      });

    if (itemError) {
      await supabase
        .from("purchases")
        .delete()
        .eq(
          "id",
          purchase.id
        );

      alert(
        "Purchase item error: " +
          itemError.message
      );

      setSaving(false);
      return;
    }

    if (selectedProduct) {
      const newStock =
        Number(
          selectedProduct.stock_quantity ||
            0
        ) + qty;

      const {
        error: stockError,
      } = await supabase
        .from("products")
        .update({
          stock_quantity:
            newStock,

          purchase_price:
            price,
        })
        .eq(
          "id",
          productId
        )
        .eq(
          "company_id",
          companyId
        );

      if (stockError) {
        alert(
          "Purchase save ho gayi, lekin stock update error: " +
            stockError.message
        );
      }
    }

    setSupplierId("");
    setProductId("");
    setQuantity("1");
    setUnitPrice("");
    setInvoiceNumber("");
    setPaidAmount("0");

    await Promise.all([
      loadPurchases(
        companyId
      ),
      loadProducts(
        companyId
      ),
    ]);

    setSaving(false);

    alert(
      "Purchase successfully save ho gayi."
    );
  }

  async function handleDeletePurchase(
    purchase: Purchase
  ) {
    const confirmed =
      window.confirm(
        `Rs. ${Number(
          purchase.total_amount ||
            0
        ).toFixed(
          2
        )} ki purchase delete karni hai? Stock bhi reverse hoga.`
      );

    if (!confirmed) return;

    setDeletingId(
      purchase.id
    );

    /*
      Pehle stock reverse karenge.
    */

    for (
      const item of
      purchase.purchase_items ||
      []
    ) {
      const product =
        products.find(
          (p) =>
            p.id ===
            item.product_id
        );

      if (product) {
        const currentStock =
          Number(
            product.stock_quantity ||
              0
          );

        const purchaseQty =
          Number(
            item.quantity || 0
          );

        const newStock =
          Math.max(
            currentStock -
              purchaseQty,
            0
          );

        const {
          error:
            stockError,
        } = await supabase
          .from("products")
          .update({
            stock_quantity:
              newStock,
          })
          .eq(
            "id",
            item.product_id
          )
          .eq(
            "company_id",
            companyId
          );

        if (stockError) {
          alert(
            "Stock reverse error: " +
              stockError.message
          );

          setDeletingId(null);
          return;
        }
      }
    }

    /*
      Purchase items delete.
    */

    const {
      error:
        itemsDeleteError,
    } = await supabase
      .from("purchase_items")
      .delete()
      .eq(
        "purchase_id",
        purchase.id
      );

    if (itemsDeleteError) {
      alert(
        "Purchase items delete error: " +
          itemsDeleteError.message
      );

      setDeletingId(null);
      return;
    }

    /*
      Purchase delete.
    */

    const {
      error:
        purchaseDeleteError,
    } = await supabase
      .from("purchases")
      .delete()
      .eq(
        "id",
        purchase.id
      )
      .eq(
        "company_id",
        companyId
      );

    if (
      purchaseDeleteError
    ) {
      alert(
        "Purchase delete error: " +
          purchaseDeleteError.message
      );

      setDeletingId(null);
      return;
    }

    if (
      selectedPurchase?.id ===
      purchase.id
    ) {
      setSelectedPurchase(null);
    }

    await Promise.all([
      loadPurchases(
        companyId
      ),
      loadProducts(
        companyId
      ),
    ]);

    setDeletingId(null);

    alert(
      "Purchase delete ho gayi aur stock reverse ho gaya."
    );
  }

  function getStatusStyle(
    status: string | null
  ): React.CSSProperties {
    if (status === "paid") {
      return {
        ...statusBaseStyle,
        backgroundColor:
          "#dcfce7",
        color: "#15803d",
      };
    }

    if (status === "partial") {
      return {
        ...statusBaseStyle,
        backgroundColor:
          "#fef3c7",
        color: "#b45309",
      };
    }

    return {
      ...statusBaseStyle,
      backgroundColor:
        "#fee2e2",
      color: "#b91c1c",
    };
  }

  function getStatusText(
    status: string | null
  ) {
    if (status === "paid")
      return "Paid";

    if (status === "partial")
      return "Partial";

    return "Unpaid";
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading purchases...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div
        style={containerStyle}
      >
        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard"
            )
          }
          style={backStyle}
        >
          ← Back to Dashboard
        </button>

        <div
          style={headerStyle}
        >
          <div>
            <h1
              style={{
                marginBottom:
                  "5px",
              }}
            >
              Purchases
            </h1>

            <p
              style={{
                color:
                  "#667085",
                marginTop: 0,
              }}
            >
              Manage supplier
              purchases, payable
              balances and stock.
            </p>
          </div>

          <div
            style={counterStyle}
          >
            <span
              style={{
                color:
                  "#667085",
                fontSize:
                  "13px",
              }}
            >
              Total Purchases
            </span>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  "5px",
                fontSize:
                  "20px",
              }}
            >
              {purchases.length}
            </strong>
          </div>
        </div>

        <div
          style={layoutStyle}
        >
          <form
            onSubmit={
              createPurchase
            }
            style={cardStyle}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Create Purchase
            </h2>

            <label
              style={labelStyle}
            >
              Supplier
            </label>

            <select
              value={
                supplierId
              }
              onChange={(e) =>
                setSupplierId(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select Supplier
              </option>

              {suppliers.map(
                (s) => (
                  <option
                    key={s.id}
                    value={s.id}
                  >
                    {s.name}
                  </option>
                )
              )}
            </select>

            <label
              style={labelStyle}
            >
              Supplier Invoice /
              Reference Number
            </label>

            <input
              type="text"
              value={
                invoiceNumber
              }
              onChange={(e) =>
                setInvoiceNumber(
                  e.target.value
                )
              }
              placeholder="e.g. SUP-INV-001"
              style={inputStyle}
            />

            <label
              style={labelStyle}
            >
              Product
            </label>

            <select
              value={productId}
              onChange={(e) =>
                handleProduct(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select Product
              </option>

              {products.map(
                (p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name}
                  </option>
                )
              )}
            </select>

            <label
              style={labelStyle}
            >
              Quantity
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  e.target.value
                )
              }
              placeholder="Quantity"
              style={inputStyle}
            />

            <label
              style={labelStyle}
            >
              Purchase Price
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(e) =>
                setUnitPrice(
                  e.target.value
                )
              }
              placeholder="Purchase Price"
              style={inputStyle}
            />

            <label
              style={labelStyle}
            >
              Paid Amount
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              max={
                totalAmount ||
                undefined
              }
              value={paidAmount}
              onChange={(e) =>
                setPaidAmount(
                  e.target.value
                )
              }
              placeholder="Paid Amount"
              style={inputStyle}
            />

            <div
              style={summaryGridStyle}
            >
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
                  Paid
                </span>

                <strong
                  style={{
                    color:
                      "#15803d",
                  }}
                >
                  Rs.{" "}
                  {enteredPaidAmount.toFixed(
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
                  {remainingBalance.toFixed(
                    2
                  )}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...buttonStyle,
                opacity: saving
                  ? 0.6
                  : 1,
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : "Create Purchase"}
            </button>
          </form>

          <section
            style={cardStyle}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Recent Purchases
            </h2>

            {purchases.length ===
            0 ? (
              <div
                style={emptyStyle}
              >
                Abhi koi purchase
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
                        Purchase No.
                      </th>

                      <th style={th}>
                        Invoice
                      </th>

                      <th style={th}>
                        Supplier
                      </th>

                      <th style={th}>
                        Total
                      </th>

                      <th style={th}>
                        Paid
                      </th>

                      <th style={th}>
                        Payable
                      </th>

                      <th style={th}>
                        Status
                      </th>

                      <th style={th}>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {purchases.map(
                      (p) => (
                        <tr
                          key={p.id}
                        >
                          <td
                            style={td}
                          >
                            {new Date(
                              p.created_at
                            ).toLocaleDateString()}
                          </td>
                          <td style={td}>
                               {p.purchase_number || "-"}
                          </td>

                          <td
                            style={td}
                          >
                            {p.invoice_number ||
                              "-"}
                          </td>

                          <td
                            style={td}
                          >
                            {p.suppliers
                              ?.name ||
                              "-"}
                          </td>

                          <td
                            style={
                              moneyCellStyle
                            }
                          >
                            Rs.{" "}
                            {Number(
                              p.total_amount ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td
                            style={
                              paidCellStyle
                            }
                          >
                            Rs.{" "}
                            {Number(
                              p.paid_amount ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td
                            style={
                              payableCellStyle
                            }
                          >
                            Rs.{" "}
                            {Number(
                              p.remaining_balance ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td
                            style={td}
                          >
                            <span
                              style={getStatusStyle(
                                p.payment_status
                              )}
                            >
                              {getStatusText(
                                p.payment_status
                              )}
                            </span>
                          </td>

                          <td
                            style={td}
                          >
                            <div
                              style={
                                actionStyle
                              }
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPurchase(
                                    p
                                  )
                                }
                                style={
                                  viewButtonStyle
                                }
                              >
                                View
                              </button>

                              <button
                                type="button"
                                disabled={
                                  deletingId ===
                                  p.id
                                }
                                onClick={() =>
                                  handleDeletePurchase(
                                    p
                                  )
                                }
                                style={{
                                  ...deleteButtonStyle,
                                  opacity:
                                    deletingId ===
                                    p.id
                                      ? 0.6
                                      : 1,
                                }}
                              >
                                {deletingId ===
                                p.id
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

        {selectedPurchase && (
          <section
            style={
              detailCardStyle
            }
          >
            <div
              style={
                detailHeaderStyle
              }
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Purchase Details
                </h2>

                <p
                  style={{
                    color:
                      "#667085",
                  }}
                >
                  {selectedPurchase.invoice_number ||
                    "No supplier invoice number"}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedPurchase(
                    null
                  )
                }
                style={
                  closeButtonStyle
                }
              >
                Close
              </button>
            </div>

            <div
              style={
                purchaseInfoGridStyle
              }
            >
              <div>
                <span
                  style={
                    smallLabelStyle
                  }
                >
                  Supplier
                </span>

                <strong>
                  {selectedPurchase
                    .suppliers
                    ?.name ||
                    "-"}
                </strong>
              </div>

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
                  {Number(
                    selectedPurchase.total_amount ||
                      0
                  ).toFixed(2)}
                </strong>
              </div>

              <div>
                <span
                  style={
                    smallLabelStyle
                  }
                >
                  Paid
                </span>

                <strong
                  style={{
                    color:
                      "#15803d",
                  }}
                >
                  Rs.{" "}
                  {Number(
                    selectedPurchase.paid_amount ||
                      0
                  ).toFixed(2)}
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
                  {Number(
                    selectedPurchase.remaining_balance ||
                      0
                  ).toFixed(2)}
                </strong>
              </div>
            </div>

            <div
              style={{
                overflowX:
                  "auto",
                marginTop:
                  "20px",
              }}
            >
              <table
                style={tableStyle}
              >
                <thead>
                  <tr>
                    <th style={th}>
                      Product
                    </th>

                    <th style={th}>
                      Quantity
                    </th>

                    <th style={th}>
                      Rate
                    </th>

                    <th style={th}>
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {selectedPurchase.purchase_items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td
                          style={td}
                        >
                          {item
                            .products
                            ?.name ||
                            "-"}
                        </td>

                        <td
                          style={td}
                        >
                          {Number(
                            item.quantity ||
                              0
                          )}
                        </td>

                        <td
                          style={td}
                        >
                          Rs.{" "}
                          {Number(
                            item.unit_price ||
                              0
                          ).toFixed(
                            2
                          )}
                        </td>

                        <td
                          style={td}
                        >
                          Rs.{" "}
                          {Number(
                            item.total_price ||
                              0
                          ).toFixed(
                            2
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f5f7fb",
  padding: "30px",
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
  margin: "auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "25px",
  gap: "20px",
};

const counterStyle: React.CSSProperties = {
  background: "#fff",
  padding: "15px 20px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
};

const backStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "#2563eb",
  cursor: "pointer",
  padding: 0,
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "390px minmax(0, 1fr)",
  gap: "25px",
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "15px",
  border: "1px solid #e5e7eb",
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
  marginBottom: "15px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
  background: "#fff",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, 1fr)",
  gap: "8px",
  padding: "15px",
  background: "#f8fafc",
  borderRadius: "10px",
  marginBottom: "15px",
  border: "1px solid #eaecf0",
};

const smallLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "12px",
  marginBottom: "5px",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "850px",
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  background: "#f8fafc",
  padding: "13px",
  textAlign: "left",
  fontSize: "13px",
  color: "#667085",
  borderBottom: "1px solid #eaecf0",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "14px 13px",
  background: "#fff",
  borderBottom: "1px solid #f2f4f7",
  fontSize: "14px",
  color: "#475467",
};

const moneyCellStyle: React.CSSProperties = {
  ...td,
  whiteSpace: "nowrap",
};

const paidCellStyle: React.CSSProperties = {
  ...td,
  color: "#15803d",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const payableCellStyle: React.CSSProperties = {
  ...td,
  color: "#b45309",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const statusBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "700",
};

const actionStyle: React.CSSProperties = {
  display: "flex",
  gap: "7px",
};

const viewButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: "7px",
  background: "#eff6ff",
  color: "#2563eb",
  padding: "7px 10px",
  cursor: "pointer",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  borderRadius: "7px",
  background: "#fef2f2",
  color: "#dc2626",
  padding: "7px 10px",
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  padding: "45px 0",
  textAlign: "center",
  color: "#98a2b3",
};

const detailCardStyle: React.CSSProperties = {
  marginTop: "25px",
  background: "#fff",
  padding: "25px",
  borderRadius: "15px",
  border: "1px solid #e5e7eb",
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const closeButtonStyle: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: "7px",
  background: "#fff",
  padding: "8px 12px",
  cursor: "pointer",
};

const purchaseInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "16px",
  padding: "18px",
  background: "#f8fafc",
  borderRadius: "10px",
};