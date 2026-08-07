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

type CartItem = {
  product_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  available_stock: number;
};

type Sale = {
  id: string;
  invoice_number: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  payment_method: string | null;
  payment_status: string | null;
  due_date: string | null;
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

  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [dueDate, setDueDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  const selectedProduct = products.find(
    (product) => product.id === productId
  );

  const selectedQuantity = Number(quantity || 0);

  const cartSubtotal = cartItems.reduce(
    (sum, item) => sum + item.total_price,
    0
  );

  const discount = Math.max(
    0,
    Number(discountAmount || 0)
  );

  const tax = Math.max(
    0,
    Number(taxAmount || 0)
  );

  const grandTotal = Math.max(
    0,
    cartSubtotal - discount + tax
  );

  const paid = Math.max(
    0,
    Number(paidAmount || 0)
  );

  const remainingBalance = Math.max(
    0,
    grandTotal - paid
  );

  const automaticPaymentStatus =
    grandTotal <= 0 || paid <= 0
      ? "unpaid"
      : paid >= grandTotal
        ? "paid"
        : "partial";

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

  async function loadCustomers(
    currentCompanyId: string
  ) {
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

  async function loadProducts(
    currentCompanyId: string
  ) {
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

  async function loadSales(
    currentCompanyId: string
  ) {
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        invoice_number,
        total_amount,
        paid_amount,
        remaining_balance,
        payment_method,
        payment_status,
        due_date,
        created_at,
        customers(name)
      `)
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSales(
      (data as unknown as Sale[]) || []
    );
  }

 async function createInvoiceNumber() {
  const { data, error } = await supabase.rpc(
    "generate_invoice_number"
  );

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Invoice number generate nahi hua."
    );
  }

  return data as string;
}
  function addItemToCart() {
    if (!selectedProduct) {
      alert("Product select karo.");
      return;
    }

    if (
      !Number.isFinite(selectedQuantity) ||
      selectedQuantity < 1
    ) {
      alert("Quantity 1 ya us se zyada honi chahiye.");
      return;
    }

    const availableStock = Number(
      selectedProduct.stock_quantity || 0
    );

    const existingItem = cartItems.find(
      (item) =>
        item.product_id === selectedProduct.id
    );

    const existingQuantity =
      existingItem?.quantity || 0;

    const finalQuantity =
      existingQuantity + selectedQuantity;

    if (finalQuantity > availableStock) {
      alert(
        "Available stock sirf " +
          availableStock +
          " hai."
      );
      return;
    }

    const unitPrice = Number(
      selectedProduct.sale_price || 0
    );

    if (unitPrice <= 0) {
      alert("Product ki sale price valid nahi hai.");
      return;
    }

    if (existingItem) {
      setCartItems((currentItems) =>
        currentItems.map((item) =>
          item.product_id === selectedProduct.id
            ? {
                ...item,
                quantity: finalQuantity,
                total_price:
                  finalQuantity * unitPrice,
              }
            : item
        )
      );
    } else {
      const newItem: CartItem = {
        product_id: selectedProduct.id,
        name: selectedProduct.name,
        sku: selectedProduct.sku,
        quantity: selectedQuantity,
        unit_price: unitPrice,
        total_price:
          selectedQuantity * unitPrice,
        available_stock: availableStock,
      };

      setCartItems((currentItems) => [
        ...currentItems,
        newItem,
      ]);
    }

    setProductId("");
    setQuantity("1");
  }

  function removeCartItem(
    productIdToRemove: string
  ) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) =>
          item.product_id !== productIdToRemove
      )
    );
  }

  function updateCartQuantity(
    productIdToUpdate: string,
    newQuantityValue: string
  ) {
    const newQuantity = Number(
      newQuantityValue || 0
    );

    setCartItems((currentItems) =>
      currentItems.map((item) => {
        if (
          item.product_id !== productIdToUpdate
        ) {
          return item;
        }

        if (
          !Number.isFinite(newQuantity) ||
          newQuantity < 1
        ) {
          return item;
        }

        if (
          newQuantity > item.available_stock
        ) {
          alert(
            "Available stock sirf " +
              item.available_stock +
              " hai."
          );

          return item;
        }

        return {
          ...item,
          quantity: newQuantity,
          total_price:
            newQuantity * item.unit_price,
        };
      })
    );
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

    if (cartItems.length === 0) {
      alert(
        "Kam az kam ek product cart me add karo."
      );
      return;
    }

    if (discount > cartSubtotal) {
      alert(
        "Discount subtotal se zyada nahi ho sakta."
      );
      return;
    }

    if (paid > grandTotal) {
      alert(
        "Paid amount grand total se zyada nahi ho sakta."
      );
      return;
    }

    if (
      automaticPaymentStatus !== "paid" &&
      !dueDate
    ) {
      alert(
        "Unpaid ya partial sale ke liye due date select karo."
      );
      return;
    }

    setSaving(true);

    const invoiceNumber =
      await createInvoiceNumber();
      alert("Invoice number: " + invoiceNumber);

    const {
      data: sale,
      error: saleError,
    } = await supabase
      .from("sales")
      .insert({
        company_id: companyId,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        total_amount: grandTotal,
        discount_amount: discount,
        tax_amount: tax,
        paid_amount: paid,
        remaining_balance: remainingBalance,
        payment_method: paymentMethod,
        payment_status: automaticPaymentStatus,
        due_date:
          automaticPaymentStatus === "paid"
            ? null
            : dueDate || null,
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

    const saleItemsPayload = cartItems.map(
      (item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })
    );

    const { error: itemsError } =
      await supabase
        .from("sale_items")
        .insert(saleItemsPayload);

    if (itemsError) {
      await supabase
        .from("sales")
        .delete()
        .eq("id", sale.id);

      setSaving(false);
      alert(itemsError.message);
      return;
    }

    for (const item of cartItems) {
      const newStock =
        item.available_stock -
        item.quantity;

      const { error: stockError } =
        await supabase
          .from("products")
          .update({
            stock_quantity: newStock,
          })
          .eq("id", item.product_id)
          .eq("company_id", companyId);

      if (stockError) {
        setSaving(false);

        alert(
          "Stock update error: " +
            stockError.message
        );

        return;
      }
    }

    setCustomerId("");
    setProductId("");
    setQuantity("1");
    setCartItems([]);
    setDiscountAmount("0");
    setTaxAmount("0");
    setPaidAmount("0");
    setPaymentMethod("cash");
    setDueDate("");

    await Promise.all([
      loadProducts(companyId),
      loadSales(companyId),
    ]);

    setSaving(false);

    alert(
      "Sale aur payment details successfully save ho gayi."
    );
  }

  function getStatusText(
    status: string | null
  ) {
    if (status === "paid") {
      return "Paid";
    }

    if (status === "partial") {
      return "Partial";
    }

    return "Unpaid";
  }

  function getStatusStyle(
    status: string | null
  ) {
    if (status === "paid") {
      return paidStatusStyle;
    }

    if (status === "partial") {
      return partialStatusStyle;
    }

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
              Multiple products, payments aur remaining balance manage karo.
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

        <form
          onSubmit={createSale}
          style={saleWorkspaceStyle}
        >
          <section style={leftPanelStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>
                Create Sale
              </h2>

              <p style={sectionDescriptionStyle}>
                Customer, products aur payment details enter karo.
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

            <div style={productPickerStyle}>
              <div style={productFieldStyle}>
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
              </div>

              <div style={quantityFieldStyle}>
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
              </div>
            </div>

            {selectedProduct && (
              <div style={selectedProductInfoStyle}>
                <div>
                  <span style={smallMutedTextStyle}>
                    Selected Product
                  </span>

                  <strong style={selectedProductNameStyle}>
                    {selectedProduct.name}
                  </strong>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={smallMutedTextStyle}>
                    Unit Price
                  </span>

                  <strong style={selectedProductPriceStyle}>
                    Rs.{" "}
                    {Number(
                      selectedProduct.sale_price || 0
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={addItemToCart}
              style={addItemButtonStyle}
            >
              + Add Item
            </button>

            <div style={dividerStyle} />

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
              Paid Amount
            </label>

            <input
              type="number"
              min="0"
              max={grandTotal}
              step="0.01"
              value={paidAmount}
              onChange={(event) =>
                setPaidAmount(event.target.value)
              }
              style={inputStyle}
            />

            <label style={labelStyle}>
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value)
              }
              style={inputStyle}
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">
                Bank Transfer
              </option>
              <option value="card">Card</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">
                EasyPaisa
              </option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>

            {automaticPaymentStatus !== "paid" && (
              <>
                <label style={labelStyle}>
                  Due Date
                </label>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  style={inputStyle}
                />
              </>
            )}

            <div style={statusPreviewStyle}>
              <span>Automatic Status</span>

              <strong
                style={getStatusStyle(
                  automaticPaymentStatus
                )}
              >
                {getStatusText(
                  automaticPaymentStatus
                )}
              </strong>
            </div>

            <div style={totalsBoxStyle}>
              <div style={totalLineStyle}>
                <span>Subtotal</span>

                <strong>
                  Rs. {cartSubtotal.toFixed(2)}
                </strong>
              </div>

              <div style={totalLineStyle}>
                <span>Discount</span>

                <strong style={discountTextStyle}>
                  - Rs. {discount.toFixed(2)}
                </strong>
              </div>

              <div style={totalLineStyle}>
                <span>Tax</span>

                <strong style={taxTextStyle}>
                  + Rs. {tax.toFixed(2)}
                </strong>
              </div>

              <div style={totalLineStyle}>
                <span>Paid</span>

                <strong style={paidTextStyle}>
                  Rs. {paid.toFixed(2)}
                </strong>
              </div>

              <div style={totalLineStyle}>
                <span>Remaining</span>

                <strong style={remainingTextStyle}>
                  Rs. {remainingBalance.toFixed(2)}
                </strong>
              </div>

              <div style={grandTotalLineStyle}>
                <span>Grand Total</span>

                <strong>
                  Rs. {grandTotal.toFixed(2)}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                saving || cartItems.length === 0
              }
              style={{
                ...createSaleButtonStyle,
                opacity:
                  saving || cartItems.length === 0
                    ? 0.6
                    : 1,
                cursor:
                  saving || cartItems.length === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "Creating Sale..."
                : "Create Sale & Invoice"}
            </button>
          </section>

          <section style={cartPanelStyle}>
            <div style={cartHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>
                  Invoice Items
                </h2>

                <p style={sectionDescriptionStyle}>
                  Ek invoice me multiple products add kar sakte ho.
                </p>
              </div>

              <span style={cartCountBadgeStyle}>
                {cartItems.length} Items
              </span>
            </div>

            {cartItems.length === 0 ? (
              <div style={emptyCartStyle}>
                <div style={emptyCartIconStyle}>
                  🛒
                </div>

                <h3 style={emptyCartTitleStyle}>
                  Cart empty hai
                </h3>

                <p style={emptyCartTextStyle}>
                  Product aur quantity select karke Add Item dabao.
                </p>
              </div>
            ) : (
              <div style={cartTableWrapperStyle}>
                <table style={cartTableStyle}>
                  <thead>
                    <tr>
                      <th style={cartHeaderCellStyle}>
                        Product
                      </th>

                      <th style={cartHeaderCellStyle}>
                        SKU
                      </th>

                      <th style={cartNumberHeaderStyle}>
                        Quantity
                      </th>

                      <th style={cartNumberHeaderStyle}>
                        Rate
                      </th>

                      <th style={cartNumberHeaderStyle}>
                        Total
                      </th>

                      <th style={cartActionHeaderStyle}>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {cartItems.map((item) => (
                      <tr key={item.product_id}>
                        <td style={cartCellStyle}>
                          <strong style={productNameStyle}>
                            {item.name}
                          </strong>

                          <span style={stockTextStyle}>
                            Available:{" "}
                            {item.available_stock}
                          </span>
                        </td>

                        <td style={cartCellStyle}>
                          {item.sku || "-"}
                        </td>

                        <td style={cartNumberCellStyle}>
                          <input
                            type="number"
                            min="1"
                            max={item.available_stock}
                            value={item.quantity}
                            onChange={(event) =>
                              updateCartQuantity(
                                item.product_id,
                                event.target.value
                              )
                            }
                            style={cartQuantityInputStyle}
                          />
                        </td>

                        <td style={cartNumberCellStyle}>
                          Rs.{" "}
                          {item.unit_price.toFixed(2)}
                        </td>

                        <td style={cartTotalCellStyle}>
                          Rs.{" "}
                          {item.total_price.toFixed(2)}
                        </td>

                        <td style={cartActionCellStyle}>
                          <button
                            type="button"
                            onClick={() =>
                              removeCartItem(
                                item.product_id
                              )
                            }
                            style={removeButtonStyle}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </form>

        <section style={salesCardStyle}>
          <div style={salesCardHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
                Recent Sales
              </h2>

              <p style={sectionDescriptionStyle}>
                Payment, remaining balance aur invoices.
              </p>
            </div>

            <span style={recordBadgeStyle}>
              {sales.length} Records
            </span>
          </div>

          {sales.length === 0 ? (
            <div style={emptySalesStyle}>
              Abhi koi sale nahi hai.
            </div>
          ) : (
            <div style={salesTableWrapperStyle}>
              <table style={salesTableStyle}>
                <thead>
                  <tr>
                    <th style={firstSalesHeaderStyle}>
                      Date
                    </th>

                    <th style={salesHeaderStyle}>
                      Customer
                    </th>

                    <th style={salesAmountHeaderStyle}>
                      Total
                    </th>

                    <th style={salesAmountHeaderStyle}>
                      Paid
                    </th>

                    <th style={salesAmountHeaderStyle}>
                      Remaining
                    </th>

                    <th style={salesHeaderStyle}>
                      Method
                    </th>

                    <th style={salesHeaderStyle}>
                      Status
                    </th>

                    <th style={salesHeaderStyle}>
                      Invoice
                    </th>

                    <th style={salesActionHeaderStyle}>
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td style={firstSalesCellStyle}>
                        {new Date(
                          sale.created_at
                        ).toLocaleDateString()}
                      </td>

                      <td style={salesCellStyle}>
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

                      <td style={salesAmountCellStyle}>
                        Rs.{" "}
                        {Number(
                          sale.total_amount || 0
                        ).toFixed(2)}
                      </td>

                      <td style={salesAmountCellStyle}>
                        Rs.{" "}
                        {Number(
                          sale.paid_amount || 0
                        ).toFixed(2)}
                      </td>

                      <td style={salesAmountCellStyle}>
                        Rs.{" "}
                        {Number(
                          sale.remaining_balance || 0
                        ).toFixed(2)}
                      </td>

                      <td style={salesCellStyle}>
                        {getPaymentMethodText(
                          sale.payment_method
                        )}
                      </td>

                      <td style={salesCellStyle}>
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

                      <td style={salesCellStyle}>
                        <span style={invoiceBadgeStyle}>
                          {sale.invoice_number ||
                            "No invoice"}
                        </span>
                      </td>

                      <td style={salesActionCellStyle}>
                        <button
  type="button"
  onClick={() =>
    router.push(`/invoice_view?id=${sale.id}`)
  }
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
  color: "#475467",
  fontFamily: "Arial, sans-serif",
};

const containerStyle: CSSProperties = {
  maxWidth: "1500px",
  margin: "0 auto",
};

const backButtonStyle: CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  padding: 0,
  marginBottom: "20px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
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
  color: "#101828",
  fontSize: "30px",
};

const pageDescriptionStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#667085",
  fontSize: "15px",
};

const salesCountStyle: CSSProperties = {
  minWidth: "130px",
  padding: "14px 18px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  boxShadow: "0 4px 14px rgba(16,24,40,0.04)",
};

const countLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "5px",
  color: "#667085",
  fontSize: "12px",
};

const countNumberStyle: CSSProperties = {
  color: "#101828",
  fontSize: "24px",
};

const saleWorkspaceStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(340px, 420px) minmax(0, 1fr)",
  gap: "24px",
  alignItems: "start",
  marginBottom: "28px",
};

const leftPanelStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  boxShadow: "0 8px 24px rgba(16,24,40,0.06)",
};

const cartPanelStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  boxShadow: "0 8px 24px rgba(16,24,40,0.06)",
  overflow: "hidden",
};

const sectionHeaderStyle: CSSProperties = {
  marginBottom: "22px",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "19px",
};

const sectionDescriptionStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "7px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: "700",
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

const productPickerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 110px",
  gap: "12px",
};

const productFieldStyle: CSSProperties = {
  minWidth: 0,
};

const quantityFieldStyle: CSSProperties = {
  minWidth: 0,
};

const selectedProductInfoStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "13px",
  marginBottom: "14px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
};

const smallMutedTextStyle: CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "11px",
  marginBottom: "4px",
};

const selectedProductNameStyle: CSSProperties = {
  color: "#344054",
  fontSize: "14px",
};

const selectedProductPriceStyle: CSSProperties = {
  color: "#2563eb",
  fontSize: "15px",
};

const addItemButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "42px",
  border: "1px solid #bfdbfe",
  borderRadius: "9px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
};

const dividerStyle: CSSProperties = {
  height: "1px",
  backgroundColor: "#eaecf0",
  margin: "24px 0",
};

const statusPreviewStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "13px",
  marginBottom: "16px",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  backgroundColor: "#f8fafc",
  color: "#475467",
  fontSize: "13px",
  fontWeight: "700",
};

const totalsBoxStyle: CSSProperties = {
  padding: "16px",
  marginTop: "4px",
  marginBottom: "18px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  borderRadius: "11px",
};

const totalLineStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "7px 0",
  color: "#475467",
  fontSize: "14px",
};

const discountTextStyle: CSSProperties = {
  color: "#b91c1c",
};

const taxTextStyle: CSSProperties = {
  color: "#15803d",
};

const paidTextStyle: CSSProperties = {
  color: "#15803d",
};

const remainingTextStyle: CSSProperties = {
  color: "#b45309",
};

const grandTotalLineStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "8px",
  paddingTop: "13px",
  borderTop: "1px solid #d0d5dd",
  color: "#2563eb",
  fontSize: "17px",
  fontWeight: "700",
};

const createSaleButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "45px",
  border: "none",
  borderRadius: "9px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
};

const cartHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "22px 24px",
  borderBottom: "1px solid #eaecf0",
};

const cartCountBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: "700",
};

const emptyCartStyle: CSSProperties = {
  padding: "75px 24px",
  textAlign: "center",
};

const emptyCartIconStyle: CSSProperties = {
  fontSize: "36px",
  marginBottom: "12px",
};

const emptyCartTitleStyle: CSSProperties = {
  margin: 0,
  color: "#344054",
  fontSize: "17px",
};

const emptyCartTextStyle: CSSProperties = {
  maxWidth: "360px",
  margin: "8px auto 0",
  color: "#667085",
  fontSize: "13px",
  lineHeight: 1.6,
};

const cartTableWrapperStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const cartTableStyle: CSSProperties = {
  width: "100%",
  minWidth: "800px",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const cartHeaderCellStyle: CSSProperties = {
  padding: "13px 15px",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
  color: "#475467",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: "700",
  textTransform: "uppercase",
};

const cartNumberHeaderStyle: CSSProperties = {
  ...cartHeaderCellStyle,
  textAlign: "right",
};

const cartActionHeaderStyle: CSSProperties = {
  ...cartHeaderCellStyle,
  textAlign: "center",
};

const cartCellStyle: CSSProperties = {
  padding: "15px",
  borderBottom: "1px solid #f2f4f7",
  color: "#475467",
  fontSize: "14px",
  verticalAlign: "middle",
};

const cartNumberCellStyle: CSSProperties = {
  ...cartCellStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const cartTotalCellStyle: CSSProperties = {
  ...cartNumberCellStyle,
  color: "#101828",
  fontWeight: "700",
};

const cartActionCellStyle: CSSProperties = {
  ...cartCellStyle,
  textAlign: "center",
};

const productNameStyle: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  color: "#344054",
};

const stockTextStyle: CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "11px",
};

const cartQuantityInputStyle: CSSProperties = {
  width: "75px",
  height: "36px",
  padding: "0 8px",
  border: "1px solid #d0d5dd",
  borderRadius: "7px",
  textAlign: "center",
  fontSize: "14px",
};

const removeButtonStyle: CSSProperties = {
  border: "1px solid #fecaca",
  borderRadius: "7px",
  padding: "7px 10px",
  backgroundColor: "#fff1f2",
  color: "#be123c",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "700",
};

const salesCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  boxShadow: "0 8px 24px rgba(16,24,40,0.06)",
  overflow: "hidden",
};

const salesCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "22px 24px",
  borderBottom: "1px solid #eaecf0",
};

const recordBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: "700",
};

const salesTableWrapperStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const salesTableStyle: CSSProperties = {
  width: "100%",
  minWidth: "1200px",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const salesHeaderStyle: CSSProperties = {
  padding: "13px 16px",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
  color: "#475467",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: "700",
  textTransform: "uppercase",
};

const firstSalesHeaderStyle: CSSProperties = {
  ...salesHeaderStyle,
  paddingLeft: "24px",
};

const salesAmountHeaderStyle: CSSProperties = {
  ...salesHeaderStyle,
  textAlign: "right",
};

const salesActionHeaderStyle: CSSProperties = {
  ...salesHeaderStyle,
  textAlign: "center",
  paddingRight: "24px",
};

const salesCellStyle: CSSProperties = {
  padding: "16px",
  borderBottom: "1px solid #f2f4f7",
  color: "#475467",
  fontSize: "14px",
  verticalAlign: "middle",
};

const firstSalesCellStyle: CSSProperties = {
  ...salesCellStyle,
  paddingLeft: "24px",
  color: "#344054",
  whiteSpace: "nowrap",
};

const salesAmountCellStyle: CSSProperties = {
  ...salesCellStyle,
  textAlign: "right",
  color: "#101828",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const salesActionCellStyle: CSSProperties = {
  ...salesCellStyle,
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

const viewInvoiceButtonStyle: CSSProperties = {
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

const emptySalesStyle: CSSProperties = {
  padding: "55px 24px",
  color: "#667085",
  textAlign: "center",
  fontSize: "14px",
};