"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type AmountRow = {
  total_amount?: number | null;
  amount?: number | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [userRole, setUserRole] = useState("");

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const [totalSales, setTotalSales] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    const { data: membership, error } = await supabase
      .from("company_members")
      .select("company_id, role, companies(name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error || !membership) {
      router.replace("/");
      return;
    }

    const company = membership.companies as unknown as {
      name: string;
    };

    setCompanyName(company?.name || "My Company");
    setUserRole(membership.role);

    await loadDashboardStats(membership.company_id);

    setLoading(false);
  }

  async function loadDashboardStats(companyId: string) {
    const [
      salesResult,
      purchasesResult,
      expensesResult,
      customersResult,
      productsResult,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("total_amount")
        .eq("company_id", companyId),

      supabase
        .from("purchases")
        .select("total_amount")
        .eq("company_id", companyId),

      supabase
        .from("expenses")
        .select("amount")
        .eq("company_id", companyId),

      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),

      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
    ]);

    const sales =
      (salesResult.data ?? []) as AmountRow[];

    const purchases =
      (purchasesResult.data ?? []) as AmountRow[];

    const expenses =
      (expensesResult.data ?? []) as AmountRow[];

    setTotalRevenue(
      sales.reduce(
        (sum, item) =>
          sum + Number(item.total_amount || 0),
        0
      )
    );

    setTotalPurchases(
      purchases.reduce(
        (sum, item) =>
          sum + Number(item.total_amount || 0),
        0
      )
    );

    setTotalExpenses(
      expenses.reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      )
    );

    setTotalSales(sales.length);
    setTotalCustomers(customersResult.count ?? 0);
    setTotalProducts(productsResult.count ?? 0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const cashProfit =
    totalRevenue - totalPurchases - totalExpenses;

  const allMenuItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Customers", path: "/customer" },
    { label: "Suppliers", path: "/suppliers" },
    { label: "Products", path: "/product" },
    { label: "Sales", path: "/sales" },
    { label: "Purchases", path: "/purchase" },
    { label: "Expenses", path: "/expenses" },
    { label: "Payments", path: "/payment" },
    { label: "Reports", path: "/report" },
    { label: "Team", path: "/team" },
    { label: "Settings", path: "/settings" },
  ];

  const menuItems =
    userRole === "staff"
      ? allMenuItems.filter((item) =>
          [
            "Dashboard",
            "Customers",
            "Products",
            "Sales",
            "Payments",
          ].includes(item.label)
        )
      : allMenuItems;

  const cards = [
    {
      title: "Total Revenue",
      value: "Rs. " + totalRevenue.toFixed(2),
    },
    {
      title: "Total Purchases",
      value: "Rs. " + totalPurchases.toFixed(2),
    },
    {
      title: "Total Expenses",
      value: "Rs. " + totalExpenses.toFixed(2),
    },
    {
      title: "Cash Profit",
      value: "Rs. " + cashProfit.toFixed(2),
    },
    {
      title: "Total Sales",
      value: totalSales.toString(),
    },
    {
      title: "Customers",
      value: totalCustomers.toString(),
    },
    {
      title: "Products",
      value: totalProducts.toString(),
    },
  ];
  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <aside style={sidebarStyle}>
        <h2
          style={{
            margin: 0,
            padding: "0 12px 8px",
            fontSize: "23px",
          }}
        >
          Accounting SaaS
        </h2>

        <p
          style={{
            margin: 0,
            padding: "0 12px 24px",
            color: "#98a2b3",
            fontSize: "14px",
          }}
        >
          {companyName}
        </p>

        <nav style={{ flex: 1 }}>
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.path)}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "9px",
                padding: "12px 14px",
                marginBottom: "7px",
                textAlign: "left",
                backgroundColor:
                  index === 0 ? "#2563eb" : "transparent",
                color: "#ffffff",
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          style={logoutButtonStyle}
        >
          Logout
        </button>
      </aside>

      <section
        style={{
          flex: 1,
          padding: "32px",
        }}
      >
        <header style={headerStyle}>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "30px",
              }}
            >
              Dashboard
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#667085",
              }}
            >
              {companyName} ka business overview.
            </p>

            <p
              style={{
                marginTop: "5px",
                color: "#2563eb",
                fontWeight: "600",
              }}
            >
              Role: {userRole}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/sales")}
            style={newSaleButtonStyle}
          >
            + New Sale
          </button>
        </header>

        <div style={cardsGridStyle}>
          {cards.map((card) => (
            <div
              key={card.title}
              style={{
                backgroundColor: "#ffffff",
                padding: "22px",
                borderRadius: "14px",
                border: "1px solid #eaecf0",
                boxShadow:
                  "0 5px 18px rgba(16,24,40,0.07)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#667085",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                {card.title}
              </p>

              <h2
                style={{
                  margin: "12px 0 0",
                  fontSize: "27px",
                  color:
                    card.title === "Cash Profit" &&
                    cashProfit < 0
                      ? "#b42318"
                      : "#172033",
                }}
              >
                {card.value}
              </h2>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  backgroundColor: "#f4f7fb",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#172033",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const sidebarStyle: React.CSSProperties = {
  width: "250px",
  minHeight: "100vh",
  backgroundColor: "#101828",
  color: "#ffffff",
  padding: "28px 18px",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};

const logoutButtonStyle: React.CSSProperties = {
  border: "1px solid #344054",
  borderRadius: "9px",
  padding: "12px",
  backgroundColor: "transparent",
  color: "#ffffff",
  cursor: "pointer",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "28px",
};

const newSaleButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "9px",
  padding: "12px 18px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontWeight: "600",
  cursor: "pointer",
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
};