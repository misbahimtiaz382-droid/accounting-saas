"use client";

import {
  CSSProperties,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Company = {
  name: string;
  currency: string | null;
};

type Membership = {
  company_id: string;
  role: string;
  companies: Company | null;
};

type Sale = {
  id: string;
  invoice_number: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  payment_status: string | null;
  created_at: string;
  customers: {
    name: string;
  } | null;
};

type Purchase = {
  id: string;
  purchase_number: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  payment_status: string | null;
  created_at: string;
  suppliers: {
    name: string;
  } | null;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number | null;
  purchase_price: number | null;
  sale_price: number | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [companyName, setCompanyName] =
    useState("My Company");

  const [currencyCode, setCurrencyCode] =
    useState("PKR");

  const [userRole, setUserRole] =
    useState("");

  const [sales, setSales] =
    useState<Sale[]>([]);

  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [totalCustomers, setTotalCustomers] =
    useState(0);

  const [totalSuppliers, setTotalSuppliers] =
    useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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
      data: membershipData,
      error: membershipError,
    } = await supabase
      .from("company_members")
      .select(`
        company_id,
        role,
        companies (
          name,
          currency
        )
      `)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (
      membershipError ||
      !membershipData?.company_id
    ) {
      alert(
        membershipError?.message ||
          "Company membership nahi mili."
      );

      router.replace("/");
      return;
    }

    const membership =
      membershipData as unknown as Membership;

    const currentCompanyId =
      membership.company_id;

    setCompanyName(
      membership.companies?.name ||
        "My Company"
    );

    setCurrencyCode(
      membership.companies?.currency ||
        "PKR"
    );

    setUserRole(
      membership.role || "staff"
    );

    await Promise.all([
      loadSales(currentCompanyId),
      loadPurchases(currentCompanyId),
      loadProducts(currentCompanyId),
      loadCustomerCount(currentCompanyId),
      loadSupplierCount(currentCompanyId),
    ]);

    setLoading(false);
  }

  async function loadSales(
    companyId: string
  ) {
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        invoice_number,
        total_amount,
        paid_amount,
        remaining_balance,
        payment_status,
        created_at,
        customers (
          name
        )
      `)
      .eq("company_id", companyId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      alert(
        "Sales load error: " +
          error.message
      );

      return;
    }

    setSales(
      (data as unknown as Sale[]) || []
    );
  }

  async function loadPurchases(
    companyId: string
  ) {
    const { data, error } = await supabase
      .from("purchases")
      .select(`
        id,
        purchase_number,
        total_amount,
        paid_amount,
        remaining_balance,
        payment_status,
        created_at,
        suppliers (
          name
        )
      `)
      .eq("company_id", companyId)
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
      (data as unknown as Purchase[]) ||
        []
    );
  }

  async function loadProducts(
    companyId: string
  ) {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        sku,
        stock_quantity,
        purchase_price,
        sale_price
      `)
      .eq("company_id", companyId)
      .order("name", {
        ascending: true,
      });

    if (error) {
      alert(
        "Products load error: " +
          error.message
      );

      return;
    }

    setProducts(
      (data as Product[]) || []
    );
  }

  async function loadCustomerCount(
    companyId: string
  ) {
    const { count, error } =
      await supabase
        .from("customers")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("company_id", companyId);

    if (error) {
      alert(
        "Customers count error: " +
          error.message
      );

      return;
    }

    setTotalCustomers(count || 0);
  }

  async function loadSupplierCount(
    companyId: string
  ) {
    const { count, error } =
      await supabase
        .from("suppliers")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("company_id", companyId);

    if (error) {
      alert(
        "Suppliers count error: " +
          error.message
      );

      return;
    }

    setTotalSuppliers(count || 0);
  }

  function getCurrencySymbol() {
    if (currencyCode === "USD") {
      return "$";
    }

    if (currencyCode === "GBP") {
      return "£";
    }

    if (currencyCode === "EUR") {
      return "€";
    }

    if (currencyCode === "AED") {
      return "AED ";
    }

    if (currencyCode === "SAR") {
      return "SAR ";
    }

    return "Rs. ";
  }

  const currency =
    getCurrencySymbol();

  const totalRevenue = sales.reduce(
    (sum, sale) =>
      sum +
      Number(sale.total_amount || 0),
    0
  );

  const totalReceived = sales.reduce(
    (sum, sale) =>
      sum +
      Number(sale.paid_amount || 0),
    0
  );

  const totalReceivable = sales.reduce(
    (sum, sale) =>
      sum +
      Number(
        sale.remaining_balance || 0
      ),
    0
  );

  const totalPurchaseAmount =
    purchases.reduce(
      (sum, purchase) =>
        sum +
        Number(
          purchase.total_amount || 0
        ),
      0
    );

  const totalPayable =
    purchases.reduce(
      (sum, purchase) =>
        sum +
        Number(
          purchase.remaining_balance || 0
        ),
      0
    );

  const totalStockUnits =
    products.reduce(
      (sum, product) =>
        sum +
        Number(
          product.stock_quantity || 0
        ),
      0
    );

  const stockValue =
    products.reduce(
      (sum, product) =>
        sum +
        Number(
          product.stock_quantity || 0
        ) *
          Number(
            product.purchase_price || 0
          ),
      0
    );

  const lowStockProducts =
    products.filter(
      (product) =>
        Number(
          product.stock_quantity || 0
        ) <= 5
    );

  const outOfStockProducts =
    products.filter(
      (product) =>
        Number(
          product.stock_quantity || 0
        ) <= 0
    );

  const recentSales =
    sales.slice(0, 5);

  const recentPurchases =
    purchases.slice(0, 5);

  const menuItems = [
    {
      label: "Dashboard",
      icon: "⌂",
      path: "/dashboard",
    },
    {
      label: "Customers",
      icon: "👥",
      path: "/customer",
    },
    {
      label: "Suppliers",
      icon: "🏢",
      path: "/suppliers",
    },
    {
      label: "Products",
      icon: "📦",
      path: "/product",
    },
    {
      label: "Sales",
      icon: "🧾",
      path: "/sales",
    },
    {
  label: "Invoices",
  icon: "📄",
  path: "/invoices",
},

{
  label: "Payments",
  icon: "💳",
  path: "/payment",
},
    {
      label: "Purchase",
      icon: "🛒",
      path: "/purchase",
    },
    {
  label: "Supplier Payments",
  icon: "💸",
  path: "/supplier_payment",
},
{
  label: "Supplier Ledger",
  icon: "📒",
  path: "/supplier_ledger",
},
    {
      label: "Customer Ledger",
      icon: "📒",
      path: "/customer_Ledger",
    },
    {
  label: "Chart of Accounts",
  icon: "📊",
  path: "/accounts",
},
{
  label: "Journal Entries",
  icon: "🧾",
  path: "/journal_entries",
},
{
  label: "General Ledger",
  icon: "📚",
  path: "/general_ledger",
},
    {
      label: "Settings",
      icon: "⚙️",
      path: "/settings",
    },
  ];

  const staffAllowedMenus = [
    "Dashboard",
    "Customers",
    "Products",
    "Sales",
    "Customer Ledger",
  ];

  const visibleMenuItems =
    userRole === "staff"
      ? menuItems.filter((item) =>
          staffAllowedMenus.includes(
            item.label
          )
        )
      : menuItems;

  const summaryCards = [
    {
      title: "Total Revenue",
      value:
        currency +
        totalRevenue.toFixed(2),
      icon: "↗️",
      description:
        sales.length +
        " sales invoices",
      valueColor: "#101828",
    },
    {
      title: "Total Received",
      value:
        currency +
        totalReceived.toFixed(2),
      icon: "✓",
      description:
        "Customer payments",
      valueColor: "#15803d",
    },
    {
      title: "Total Receivable",
      value:
        currency +
        totalReceivable.toFixed(2),
      icon: "⌛",
      description:
        "Customer balance due",
      valueColor: "#b45309",
    },
    {
      title: "Total Purchases",
      value:
        currency +
        totalPurchaseAmount.toFixed(2),
      icon: "↓",
      description:
        purchases.length +
        " purchase bills",
      valueColor: "#101828",
    },
    {
      title: "Total Payable",
      value:
        currency +
        totalPayable.toFixed(2),
      icon: "!",
      description:
        "Supplier balance due",
      valueColor: "#b42318",
    },
    {
      title: "Stock Value",
      value:
        currency +
        stockValue.toFixed(2),
      icon: "▣",
      description:
        totalStockUnits +
        " total units",
      valueColor: "#101828",
    },
    {
      title: "Customers",
      value:
        totalCustomers.toString(),
      icon: "👤",
      description:
        totalSuppliers +
        " suppliers",
      valueColor: "#101828",
    },
    {
      title: "Low Stock",
      value:
        lowStockProducts.length.toString(),
      icon: "⚠️",
      description:
        outOfStockProducts.length +
        " out of stock",
      valueColor:
        lowStockProducts.length > 0
          ? "#b42318"
          : "#15803d",
    },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
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

  if (loading) {
    return (
      <main style={loadingStyle}>
        <div style={loadingCardStyle}>
          <div
            style={loadingIconStyle}
          >
            ◌
          </div>

          <strong>
            Dashboard loading...
          </strong>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <aside style={sidebarStyle}>
        <div style={brandSectionStyle}>
          <div style={brandLogoStyle}>
            A
          </div>

          <div style={brandTextStyle}>
            <strong style={brandNameStyle}>
              Accounting
            </strong>

            <span
              style={
                brandDescriptionStyle
              }
            >
              Business Manager
            </span>
          </div>
        </div>

        <div style={companyBoxStyle}>
          <span
            style={
              companyBoxLabelStyle
            }
          >
            Current Company
          </span>

          <strong
            style={
              companyBoxNameStyle
            }
          >
            {companyName}
          </strong>

          <span style={roleBadgeStyle}>
            {userRole || "User"}
          </span>
        </div>

        <nav style={navStyle}>
          <span
            style={navigationLabelStyle}
          >
            MAIN MENU
          </span>

          {visibleMenuItems.map(
            (item) => {
              const active =
                item.label ===
                "Dashboard";

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() =>
                    router.push(item.path)
                  }
                  style={{
                    ...menuButtonStyle,
                    ...(active
                      ? activeMenuButtonStyle
                      : {}),
                  }}
                >
                  <span
                    style={menuIconStyle}
                  >
                    {item.icon}
                  </span>

                  <span>{item.label}</span>
                </button>
              );
            }
          )}
        </nav>

        <div style={sidebarFooterStyle}>
          <button
            type="button"
            onClick={handleLogout}
            style={logoutButtonStyle}
          >
            <span>↪️</span>
            Logout
          </button>
        </div>
      </aside>

      <section style={contentStyle}>
        <header style={headerStyle}>
          <div>
            <p style={welcomeTextStyle}>
              Welcome back
            </p>

            <h1 style={pageTitleStyle}>
              Dashboard
            </h1>

            <p
              style={
                pageDescriptionStyle
              }
            >
              {companyName} ka complete
              business overview.
            </p>
          </div>

          <div style={headerActionsStyle}>
            <button
              type="button"
              onClick={() =>
                router.push("/purchases")
              }
              style={
                secondaryActionButtonStyle
              }
            >
              + New Purchase
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/sales")
              }
              style={
                primaryActionButtonStyle
              }
            >
              + New Sale
            </button>
          </div>
        </header>

        <section
          style={summaryGridStyle}
        >
          {summaryCards.map((card) => (
            <div
              key={card.title}
              style={summaryCardStyle}
            >
              <div
                style={
                  summaryCardHeaderStyle
                }
              >
                <span
                  style={
                    summaryCardTitleStyle
                  }
                >
                  {card.title}
                </span>

                <span
                  style={
                    summaryCardIconStyle
                  }
                >
                  {card.icon}
                </span>
              </div>

              <strong
                style={{
                  ...summaryCardValueStyle,
                  color: card.valueColor,
                }}
              >
                {card.value}
              </strong>

              <span
                style={
                  summaryCardDescriptionStyle
                }
              >
                {card.description}
              </span>
            </div>
          ))}
        </section>

        <section
          style={mainGridStyle}
        >
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2
                  style={panelTitleStyle}
                >
                  Recent Sales
                </h2>

                <p
                  style={
                    panelDescriptionStyle
                  }
                >
                  Latest customer invoices
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push("/sales")
                }
                style={viewAllButtonStyle}
              >
                View All
              </button>
            </div>

            {recentSales.length === 0 ? (
              <div
                style={emptyPanelStyle}
              >
                <span
                  style={
                    emptyPanelIconStyle
                  }
                >
                  🧾
                </span>

                <strong>
                  Abhi koi sale nahi hai
                </strong>

                <p
                  style={
                    emptyPanelTextStyle
                  }
                >
                  New Sale button se pehli
                  sale create karo.
                </p>
              </div>
            ) : (
              <div
                style={tableWrapperStyle}
              >
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th
                        style={
                          firstTableHeaderStyle
                        }
                      >
                        Customer
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Invoice
                      </th>

                      <th
                        style={
                          amountHeaderStyle
                        }
                      >
                        Amount
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentSales.map(
                      (sale) => (
                        <tr key={sale.id}>
                          <td
                            style={
                              firstTableCellStyle
                            }
                          >
                            <div
                              style={
                                partyCellStyle
                              }
                            >
                              <span
                                style={
                                  partyAvatarStyle
                                }
                              >
                                {(
                                  sale.customers
                                    ?.name ||
                                  "W"
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>

                              <div>
                                <strong
                                  style={
                                    partyNameStyle
                                  }
                                >
                                  {sale
                                    .customers
                                    ?.name ||
                                    "Walk-in Customer"}
                                </strong>

                                <span
                                  style={
                                    partyDateStyle
                                  }
                                >
                                  {new Date(
                                    sale.created_at
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <span
                              style={
                                numberBadgeStyle
                              }
                            >
                              {sale.invoice_number ||
                                "-"}
                            </span>
                          </td>

                          <td
                            style={
                              amountCellStyle
                            }
                          >
                            {currency}
                            {Number(
                              sale.total_amount ||
                                0
                            ).toFixed(2)}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
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
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2
                  style={panelTitleStyle}
                >
                  Recent Purchases
                </h2>

                <p
                  style={
                    panelDescriptionStyle
                  }
                >
                  Latest supplier purchases
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push("/purchases")
                }
                style={viewAllButtonStyle}
              >
                View All
              </button>
            </div>

            {recentPurchases.length ===
            0 ? (
              <div
                style={emptyPanelStyle}
              >
                <span
                  style={
                    emptyPanelIconStyle
                  }
                >
                  📦
                </span>

                <strong>
                  Abhi koi purchase nahi hai
                </strong>

                <p
                  style={
                    emptyPanelTextStyle
                  }
                >
                  Supplier purchase create
                  karne ke baad record yahan
                  ayega.
                </p>
              </div>
            ) : (
              <div
                style={tableWrapperStyle}
              >
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th
                        style={
                          firstTableHeaderStyle
                        }
                      >
                        Supplier
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Purchase No.
                      </th>

                      <th
                        style={
                          amountHeaderStyle
                        }
                      >
                        Amount
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentPurchases.map(
                      (purchase) => (
                        <tr
                          key={purchase.id}
                        >
                          <td
                            style={
                              firstTableCellStyle
                            }
                          >
                            <div
                              style={
                                partyCellStyle
                              }
                            >
                              <span
                                style={
                                  supplierAvatarStyle
                                }
                              >
                                {(
                                  purchase
                                    .suppliers
                                    ?.name ||
                                  "S"
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>

                              <div>
                                <strong
                                  style={
                                    partyNameStyle
                                  }
                                >
                                  {purchase
                                    .suppliers
                                    ?.name ||
                                    "Supplier"}
                                </strong>

                                <span
                                  style={
                                    partyDateStyle
                                  }
                                >
                                  {new Date(
                                    purchase.created_at
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <span
                              style={
                                numberBadgeStyle
                              }
                            >
                              {purchase.purchase_number ||
                                "-"}
                            </span>
                          </td>

                          <td
                            style={
                              amountCellStyle
                            }
                          >
                            {currency}
                            {Number(
                              purchase.total_amount ||
                                0
                            ).toFixed(2)}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <span
                              style={getStatusStyle(
                                purchase.payment_status
                              )}
                            >
                              {getStatusText(
                                purchase.payment_status
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section
          style={lowerGridStyle}
        >
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2
                  style={panelTitleStyle}
                >
                  Low Stock Alert
                </h2>

                <p
                  style={
                    panelDescriptionStyle
                  }
                >
                  5 ya us se kam stock wale
                  products
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push("/product")
                }
                style={viewAllButtonStyle}
              >
                Manage Products
              </button>
            </div>

            {lowStockProducts.length ===
            0 ? (
              <div
                style={healthyStockStyle}
              >
                <span
                  style={
                    healthyStockIconStyle
                  }
                >
                  ✓
                </span>

                <div>
                  <strong>
                    Stock healthy hai
                  </strong>

                  <p
                    style={
                      emptyPanelTextStyle
                    }
                  >
                    Koi low-stock product
                    nahi hai.
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={
                  lowStockListStyle
                }
              >
                {lowStockProducts
                  .slice(0, 6)
                  .map((product) => {
                    const stock = Number(
                      product.stock_quantity ||
                        0
                    );

                    return (
                      <div
                        key={product.id}
                        style={
                          lowStockItemStyle
                        }
                      >
                        <div
                          style={
                            lowStockProductInfoStyle
                          }
                        >
                          <span
                            style={
                              lowStockIconStyle
                            }
                          >
                            📦
                          </span>

                          <div>
                            <strong
                              style={
                                lowStockNameStyle
                              }
                            >
                              {product.name}
                            </strong>

                            <span
                              style={
                                lowStockSkuStyle
                              }
                            >
                              SKU:{" "}
                              {product.sku ||
                                "-"}
                            </span>
                          </div>
                        </div>

                        <span
                          style={{
                            ...stockBadgeStyle,
                            backgroundColor:
                              stock <= 0
                                ? "#fee2e2"
                                : "#fef3c7",
                            color:
                              stock <= 0
                                ? "#b91c1c"
                                : "#b45309",
                          }}
                        >
                          {stock <= 0
                            ? "Out of stock"
                            : stock +
                              " remaining"}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div style={quickActionsPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2
                  style={panelTitleStyle}
                >
                  Quick Actions
                </h2>

                <p
                  style={
                    panelDescriptionStyle
                  }
                >
                  Common tasks quickly open
                  karo
                </p>
              </div>
            </div>

            <div
              style={
                quickActionsGridStyle
              }
            >
              <button
                type="button"
                onClick={() =>
                  router.push("/sales")
                }
                style={quickActionStyle}
              >
                <span
                  style={
                    quickActionIconStyle
                  }
                >
                  🧾
                </span>

                <div>
                  <strong>
                    Create Sale
                  </strong>

                  <span>
                    New customer invoice
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/purchases")
                }
                style={quickActionStyle}
              >
                <span
                  style={
                    quickActionIconStyle
                  }
                >
                  🛒
                </span>

                <div>
                  <strong>
                    Add Purchase
                  </strong>

                  <span>
                    Increase product stock
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/customer")
                }
                style={quickActionStyle}
              >
                <span
                  style={
                    quickActionIconStyle
                  }
                >
                  👤
                </span>

                <div>
                  <strong>
                    Add Customer
                  </strong>

                  <span>
                    Create customer record
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/suppliers")
                }
                style={quickActionStyle}
              >
                <span
                  style={
                    quickActionIconStyle
                  }
                >
                  🏢
                </span>

                <div>
                  <strong>
                    Add Supplier
                  </strong>

                  <span>
                    Create supplier record
                  </span>
                </div>
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  backgroundColor: "#f4f7fb",
  color: "#172033",
  fontFamily:
    "Arial, Helvetica, sans-serif",
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

const loadingCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "20px 24px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  boxShadow:
    "0 8px 25px rgba(16,24,40,0.08)",
};

const loadingIconStyle: CSSProperties = {
  fontSize: "26px",
  color: "#2563eb",
};

const sidebarStyle: CSSProperties = {
  width: "270px",
  minHeight: "100vh",
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  display: "flex",
  flexDirection: "column",
  padding: "24px 18px",
  boxSizing: "border-box",
  backgroundColor: "#101828",
  color: "#ffffff",
};

const brandSectionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "0 8px 22px",
  borderBottom:
    "1px solid rgba(255,255,255,0.09)",
};

const brandLogoStyle: CSSProperties = {
  width: "42px",
  height: "42px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "12px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "800",
};

const brandTextStyle: CSSProperties = {
  minWidth: 0,
};

const brandNameStyle: CSSProperties = {
  display: "block",
  color: "#ffffff",
  fontSize: "17px",
};

const brandDescriptionStyle: CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#98a2b3",
  fontSize: "11px",
};

const companyBoxStyle: CSSProperties = {
  padding: "16px",
  margin: "18px 0",
  border:
    "1px solid rgba(255,255,255,0.09)",
  borderRadius: "12px",
  backgroundColor:
    "rgba(255,255,255,0.04)",
};

const companyBoxLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "6px",
  color: "#98a2b3",
  fontSize: "10px",
  textTransform: "uppercase",
};

const companyBoxNameStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
  color: "#ffffff",
  fontSize: "14px",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const roleBadgeStyle: CSSProperties = {
  display: "inline-flex",
  marginTop: "10px",
  padding: "4px 8px",
  borderRadius: "999px",
  backgroundColor:
    "rgba(37,99,235,0.25)",
  color: "#bfdbfe",
  fontSize: "10px",
  fontWeight: "700",
  textTransform: "capitalize",
};

const navStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
};

const navigationLabelStyle: CSSProperties = {
  display: "block",
  padding: "4px 12px 10px",
  color: "#667085",
  fontSize: "10px",
  fontWeight: "700",
};

const menuButtonStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minHeight: "44px",
  padding: "0 13px",
  marginBottom: "5px",
  border: "none",
  borderRadius: "9px",
  backgroundColor: "transparent",
  color: "#d0d5dd",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
};

const activeMenuButtonStyle: CSSProperties = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
};

const menuIconStyle: CSSProperties = {
  width: "22px",
  textAlign: "center",
  fontSize: "16px",
};

const sidebarFooterStyle: CSSProperties = {
  paddingTop: "18px",
  borderTop:
    "1px solid rgba(255,255,255,0.09)",
};

const logoutButtonStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "9px",
  minHeight: "42px",
  border:
    "1px solid rgba(255,255,255,0.14)",
  borderRadius: "9px",
  backgroundColor:
    "rgba(255,255,255,0.04)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
};

const contentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "30px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "26px",
};

const welcomeTextStyle: CSSProperties = {
  margin: "0 0 5px",
  color: "#2563eb",
  fontSize: "12px",
  fontWeight: "700",
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "30px",
};

const pageDescriptionStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#667085",
  fontSize: "14px",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const primaryActionButtonStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0 16px",
  border: "none",
  borderRadius: "9px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "700",
};

const secondaryActionButtonStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0 16px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  backgroundColor: "#ffffff",
  color: "#344054",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "700",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "16px",
  marginBottom: "22px",
};

const summaryCardStyle: CSSProperties = {
  padding: "19px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  boxShadow:
    "0 5px 18px rgba(16,24,40,0.05)",
};

const summaryCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "12px",
};

const summaryCardTitleStyle: CSSProperties = {
  color: "#667085",
  fontSize: "12px",
  fontWeight: "700",
};

const summaryCardIconStyle: CSSProperties = {
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px",
  backgroundColor: "#eff6ff",
  color: "#2563eb",
  fontSize: "14px",
  fontWeight: "700",
};

const summaryCardValueStyle: CSSProperties = {
  display: "block",
  marginBottom: "7px",
  fontSize: "23px",
};

const summaryCardDescriptionStyle: CSSProperties = {
  color: "#98a2b3",
  fontSize: "11px",
};

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "20px",
  marginBottom: "20px",
};

const lowerGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0, 1.25fr) minmax(320px, 0.75fr)",
  gap: "20px",
};

const panelStyle: CSSProperties = {
  minWidth: 0,
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "15px",
  boxShadow:
    "0 6px 20px rgba(16,24,40,0.05)",
  overflow: "hidden",
};

const quickActionsPanelStyle: CSSProperties = {
  ...panelStyle,
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  padding: "19px 20px",
  borderBottom: "1px solid #eaecf0",
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "17px",
};

const panelDescriptionStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#667085",
  fontSize: "11px",
};

const viewAllButtonStyle: CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const emptyPanelStyle: CSSProperties = {
  minHeight: "230px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "25px",
  color: "#344054",
  textAlign: "center",
};

const emptyPanelIconStyle: CSSProperties = {
  marginBottom: "12px",
  fontSize: "30px",
};

const emptyPanelTextStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#667085",
  fontSize: "11px",
  lineHeight: 1.5,
};

const tableWrapperStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "620px",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const tableHeaderStyle: CSSProperties = {
  padding: "11px 13px",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
  color: "#667085",
  textAlign: "left",
  fontSize: "10px",
  fontWeight: "700",
  textTransform: "uppercase",
};

const firstTableHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  paddingLeft: "20px",
};

const amountHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "right",
};

const tableCellStyle: CSSProperties = {
  padding: "13px",
  borderBottom: "1px solid #f2f4f7",
  color: "#475467",
  fontSize: "12px",
  verticalAlign: "middle",
};

const firstTableCellStyle: CSSProperties = {
  ...tableCellStyle,
  paddingLeft: "20px",
};

const amountCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: "right",
  color: "#101828",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const partyCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const partyAvatarStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "50%",
  backgroundColor: "#dbeafe",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: "700",
};

const supplierAvatarStyle: CSSProperties = {
  ...partyAvatarStyle,
  backgroundColor: "#fef3c7",
  color: "#b45309",
};

const partyNameStyle: CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: "12px",
};

const partyDateStyle: CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#98a2b3",
  fontSize: "9px",
};

const numberBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "5px 7px",
  borderRadius: "6px",
  backgroundColor: "#f2f4f7",
  color: "#475467",
  fontSize: "9px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const paidStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: "999px",
  backgroundColor: "#dcfce7",
  color: "#15803d",
  fontSize: "9px",
  fontWeight: "700",
};

const partialStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: "999px",
  backgroundColor: "#fef3c7",
  color: "#b45309",
  fontSize: "9px",
  fontWeight: "700",
};

const unpaidStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: "999px",
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
  fontSize: "9px",
  fontWeight: "700",
};

const healthyStockStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "13px",
  padding: "28px 20px",
};

const healthyStockIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  backgroundColor: "#dcfce7",
  color: "#15803d",
  fontWeight: "800",
};

const lowStockListStyle: CSSProperties = {
  padding: "5px 20px 15px",
};

const lowStockItemStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "13px 0",
  borderBottom: "1px solid #f2f4f7",
};

const lowStockProductInfoStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  minWidth: 0,
};

const lowStockIconStyle: CSSProperties = {
  width: "35px",
  height: "35px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "9px",
  backgroundColor: "#f8fafc",
};

const lowStockNameStyle: CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: "12px",
};

const lowStockSkuStyle: CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#98a2b3",
  fontSize: "9px",
};

const stockBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: "999px",
  fontSize: "9px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const quickActionsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  padding: "16px",
};

const quickActionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  minHeight: "75px",
  padding: "12px",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  backgroundColor: "#ffffff",
  color: "#344054",
  textAlign: "left",
  cursor: "pointer",
};

const quickActionIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "9px",
  backgroundColor: "#eff6ff",
  fontSize: "17px",
};