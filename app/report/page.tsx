"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type AmountRow = {
  total_amount?: number | null;
  amount?: number | null;
};

export default function ReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");

  const [totalSalesAmount, setTotalSalesAmount] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);

  const [salesCount, setSalesCount] = useState(0);
  const [purchasesCount, setPurchasesCount] = useState(0);
  const [expensesCount, setExpensesCount] = useState(0);
  const [paymentsCount, setPaymentsCount] = useState(0);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from("company_members")
      .select("company_id, companies(name)")
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

    const company = membership.companies as unknown as {
      name: string;
    };

    setCompanyName(company?.name || "My Company");

    await loadReportData(membership.company_id);

    setLoading(false);
  }

  async function loadReportData(currentCompanyId: string) {
    const [
      salesResult,
      purchasesResult,
      expensesResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("total_amount")
        .eq("company_id", currentCompanyId),

      supabase
        .from("purchases")
        .select("total_amount")
        .eq("company_id", currentCompanyId),

      supabase
        .from("expenses")
        .select("amount")
        .eq("company_id", currentCompanyId),

      supabase
        .from("payments")
        .select("amount")
        .eq("company_id", currentCompanyId),
    ]);

    if (salesResult.error) {
      alert(salesResult.error.message);
      return;
    }

    if (purchasesResult.error) {
      alert(purchasesResult.error.message);
      return;
    }

    if (expensesResult.error) {
      alert(expensesResult.error.message);
      return;
    }

    if (paymentsResult.error) {
      alert(paymentsResult.error.message);
      return;
    }

    const sales = (salesResult.data ?? []) as AmountRow[];
    const purchases = (purchasesResult.data ?? []) as AmountRow[];
    const expenses = (expensesResult.data ?? []) as AmountRow[];
    const payments = (paymentsResult.data ?? []) as AmountRow[];

    const salesAmount = sales.reduce(
      (total, item) => total + Number(item.total_amount || 0),
      0
    );

    const purchasesAmount = purchases.reduce(
      (total, item) => total + Number(item.total_amount || 0),
      0
    );

    const expensesAmount = expenses.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const receivedAmount = payments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    setTotalSalesAmount(salesAmount);
    setTotalPurchases(purchasesAmount);
    setTotalExpenses(expensesAmount);
    setTotalReceived(receivedAmount);

    setSalesCount(sales.length);
    setPurchasesCount(purchases.length);
    setExpensesCount(expenses.length);
    setPaymentsCount(payments.length);
  }

  const outstandingBalance = Math.max(
    totalSalesAmount - totalReceived,
    0
  );

  const cashProfit =
    totalSalesAmount - totalPurchases - totalExpenses;

  const cards = [
    {
      title: "Total Sales",
      value: "Rs. " + totalSalesAmount.toFixed(2),
      note: salesCount + " sales",
    },
    {
      title: "Total Purchases",
      value: "Rs. " + totalPurchases.toFixed(2),
      note: purchasesCount + " purchases",
    },
    {
      title: "Total Expenses",
      value: "Rs. " + totalExpenses.toFixed(2),
      note: expensesCount + " expenses",
    },
    {
      title: "Payments Received",
      value: "Rs. " + totalReceived.toFixed(2),
      note: paymentsCount + " payments",
    },
    {
      title: "Outstanding Balance",
      value: "Rs. " + outstandingBalance.toFixed(2),
      note: "Customer balance",
    },
    {
      title: "Cash Profit",
      value: "Rs. " + cashProfit.toFixed(2),
      note: "Sales - Purchases - Expenses",
    },
  ];

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
              Reports
            </h1>

            <p style={{ color: "#667085" }}>
              {companyName} ki financial summary.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            style={printButtonStyle}
          >
            Print Report
          </button>
        </div>

        <div style={cardsGridStyle}>
          {cards.map((card) => (
            <div key={card.title} style={cardStyle}>
              <p style={cardTitleStyle}>{card.title}</p>

              <h2
                style={{
                  margin: "12px 0 6px",
                  fontSize: "27px",
                  color:
                    card.title === "Cash Profit" && cashProfit < 0
                      ? "#b42318"
                      : "#172033",
                }}
              >
                {card.value}
              </h2>

              <p style={cardNoteStyle}>{card.note}</p>
            </div>
          ))}
        </div>

        <section style={summarySectionStyle}>
          <h2 style={{ marginTop: 0 }}>Financial Summary</h2>

          <div style={summaryRowStyle}>
            <span>Total Sales Revenue</span>
            <strong>Rs. {totalSalesAmount.toFixed(2)}</strong>
          </div>

          <div style={summaryRowStyle}>
            <span>Less: Purchases</span>
            <strong>Rs. {totalPurchases.toFixed(2)}</strong>
          </div>

          <div style={summaryRowStyle}>
            <span>Less: Expenses</span>
            <strong>Rs. {totalExpenses.toFixed(2)}</strong>
          </div>

          <div
            style={{
              ...summaryRowStyle,
              borderTop: "2px solid #eaecf0",
              marginTop: "8px",
              paddingTop: "18px",
              fontSize: "18px",
            }}
          >
            <span>Cash Profit</span>

            <strong
              style={{
                color: cashProfit < 0 ? "#b42318" : "#067647",
              }}
            >
              Rs. {cashProfit.toFixed(2)}
            </strong>
          </div>

          <div style={summaryRowStyle}>
            <span>Payments Received</span>
            <strong>Rs. {totalReceived.toFixed(2)}</strong>
          </div>

          <div style={summaryRowStyle}>
            <span>Outstanding Receivables</span>
            <strong>Rs. {outstandingBalance.toFixed(2)}</strong>
          </div>
        </section>
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

const printButtonStyle: React.CSSProperties = {
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
    "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "18px",
  marginBottom: "24px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "22px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#667085",
  fontSize: "14px",
  fontWeight: "600",
};

const cardNoteStyle: React.CSSProperties = {
  margin: 0,
  color: "#98a2b3",
  fontSize: "13px",
};

const summarySectionStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "28px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 0",
  borderBottom: "1px solid #f2f4f7",
};