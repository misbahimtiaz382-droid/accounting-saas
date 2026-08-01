"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Expense = {
  id: string;
  category: string | null;
  amount: number | null;
  notes: string | null;
  expense_date: string | null;
  created_at: string;
};

export default function ExpensesPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );

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
    await loadExpenses(membership.company_id);
    setLoading(false);
  }

  async function loadExpenses(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, category, amount, notes, expense_date, created_at"
      )
      .eq("company_id", currentCompanyId)
      .order("expense_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setExpenses(data ?? []);
  }

  async function handleAddExpense(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!category.trim()) {
      alert("Expense category select karo.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Expense amount sahi likho.");
      return;
    }

    if (!expenseDate) {
      alert("Expense date select karo.");
      return;
    }

    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("expenses").insert({
      company_id: companyId,
      category: category.trim(),
      amount: Number(amount),
      notes: notes.trim() || null,
      expense_date: expenseDate,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setCategory("");
    setAmount("");
    setNotes("");
    setExpenseDate(new Date().toISOString().split("T")[0]);

    await loadExpenses(companyId);

    alert("Expense successfully save ho gaya.");
  }

  const totalExpenses = expenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  );

  async function handleDeleteExpense(expenseId: string) {
    const confirmed = window.confirm(
      "Kya aap ye expense delete karna chahti hain?"
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("company_id", companyId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadExpenses(companyId);
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
              Expenses
            </h1>

            <p style={{ color: "#667085" }}>
              Business expenses add aur manage karo.
            </p>
          </div>

          <div style={summaryBoxStyle}>
            <span
              style={{
                display: "block",
                color: "#667085",
                fontSize: "13px",
                marginBottom: "4px",
              }}
            >
              Total Expenses
            </span>

            <strong style={{ fontSize: "20px" }}>
              Rs. {totalExpenses.toFixed(2)}
            </strong>
          </div>
        </div>

        <div style={gridStyle}>
          <form onSubmit={handleAddExpense} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Add Expense</h2>

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              style={inputStyle}
            >
              <option value="">Select category</option>
              <option value="Office Rent">Office Rent</option>
              <option value="Electricity">Electricity</option>
              <option value="Internet">Internet</option>
              <option value="Salary">Salary</option>
              <option value="Marketing">Marketing</option>
              <option value="Transport">Transport</option>
              <option value="Software">Software</option>
              <option value="Stationery">Stationery</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Other">Other</option>
            </select>

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount"
              style={inputStyle}
            />

            <input
              type="date"
              value={expenseDate}
              onChange={(event) =>
                setExpenseDate(event.target.value)
              }
              style={inputStyle}
            />

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes"
              rows={4}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
            />

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                padding: "13px",
                border: "none",
                borderRadius: "8px",
                backgroundColor: saving
                  ? "#93c5fd"
                  : "#2563eb",
                color: "#ffffff",
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
                fontSize: "16px",
              }}
            >
              {saving ? "Saving..." : "Add Expense"}
            </button>
          </form>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Expense List</h2>

            {expenses.length === 0 ? (
              <p style={emptyStyle}>
                Abhi koi expense add nahi hua.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Category</th>
                      <th style={tableHeaderStyle}>Amount</th>
                      <th style={tableHeaderStyle}>Date</th>
                      <th style={tableHeaderStyle}>Notes</th>
                      <th style={tableHeaderStyle}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td style={tableCellStyle}>
                          {expense.category || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          Rs.{" "}
                          {Number(
                            expense.amount || 0
                          ).toFixed(2)}
                        </td>

                        <td style={tableCellStyle}>
                          {expense.expense_date
                            ? new Date(
                                expense.expense_date
                              ).toLocaleDateString()
                            : "-"}
                        </td>

                        <td style={tableCellStyle}>
                          {expense.notes || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteExpense(expense.id)
                            }
                            style={deleteButtonStyle}
                          >
                            Delete
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

const summaryBoxStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "14px 20px",
  borderRadius: "10px",
  border: "1px solid #eaecf0",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "370px 1fr",
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

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fda29b",
  borderRadius: "7px",
  padding: "7px 11px",
  backgroundColor: "#fff5f5",
  color: "#b42318",
  cursor: "pointer",
};