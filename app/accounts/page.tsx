"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Account = {
  id: string;
  company_id: string;
  account_code: string;
  account_name: string;
  account_type:
    | "asset"
    | "liability"
    | "equity"
    | "income"
    | "expense";
  account_subtype: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
};

export default function AccountsPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] =
    useState<Account["account_type"]>("asset");
  const [accountSubtype, setAccountSubtype] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.company_id) {
      router.replace("/dashboard");
      return;
    }

    setCompanyId(membership.company_id);

    await loadAccounts(membership.company_id);

    setLoading(false);
  }

  async function loadAccounts(id: string) {
    const { data, error } = await supabase
      .from("accounts")
      .select(`
        id,
        company_id,
        account_code,
        account_name,
        account_type,
        account_subtype,
        is_system,
        is_active,
        created_at
      `)
      .eq("company_id", id)
      .order("account_code", { ascending: true });

    if (error) {
      alert("Accounts load error: " + error.message);
      return;
    }

    setAccounts((data || []) as Account[]);
  }

  async function addAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!accountCode.trim()) {
      alert("Account code enter karo.");
      return;
    }

    if (!accountName.trim()) {
      alert("Account name enter karo.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("accounts")
      .insert({
        company_id: companyId,
        account_code: accountCode.trim(),
        account_name: accountName.trim(),
        account_type: accountType,
        account_subtype: accountSubtype.trim() || null,
        is_system: false,
        is_active: true,
      });

    if (error) {
      alert("Account save error: " + error.message);
      setSaving(false);
      return;
    }

    setAccountCode("");
    setAccountName("");
    setAccountType("asset");
    setAccountSubtype("");

    await loadAccounts(companyId);

    setSaving(false);

    alert("Account successfully add ho gaya.");
  }

  async function toggleAccount(account: Account) {
    if (account.is_system) {
      alert("System account ko disable nahi kar sakte.");
      return;
    }

    const { error } = await supabase
      .from("accounts")
      .update({
        is_active: !account.is_active,
      })
      .eq("id", account.id)
      .eq("company_id", companyId);

    if (error) {
      alert("Account update error: " + error.message);
      return;
    }

    await loadAccounts(companyId);
  }

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesSearch =
        account.account_name
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        account.account_code
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesType =
        typeFilter === "all" ||
        account.account_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [accounts, search, typeFilter]);

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading Chart of Accounts...
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

        <div style={headerStyle}>
          <div>
            <h1 style={{ margin: 0 }}>
              Chart of Accounts
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#667085",
              }}
            >
              Business ke accounting accounts manage karo.
            </p>
          </div>

          <div style={counterStyle}>
            Total Accounts
            <strong>{accounts.length}</strong>
          </div>
        </div>

        <div style={layoutStyle}>
          <form
            onSubmit={addAccount}
            style={cardStyle}
          >
            <h2 style={{ marginTop: 0 }}>
              Add Account
            </h2>

            <label style={labelStyle}>
              Account Code
            </label>

            <input
              value={accountCode}
              onChange={(e) =>
                setAccountCode(e.target.value)
              }
              placeholder="e.g. 6500"
              style={inputStyle}
            />

            <label style={labelStyle}>
              Account Name
            </label>

            <input
              value={accountName}
              onChange={(e) =>
                setAccountName(e.target.value)
              }
              placeholder="e.g. Marketing Expense"
              style={inputStyle}
            />

            <label style={labelStyle}>
              Account Type
            </label>

            <select
              value={accountType}
              onChange={(e) =>
                setAccountType(
                  e.target
                    .value as Account["account_type"]
                )
              }
              style={inputStyle}
            >
              <option value="asset">
                Asset
              </option>

              <option value="liability">
                Liability
              </option>

              <option value="equity">
                Equity
              </option>

              <option value="income">
                Income
              </option>

              <option value="expense">
                Expense
              </option>
            </select>

            <label style={labelStyle}>
              Subtype
            </label>

            <input
              value={accountSubtype}
              onChange={(e) =>
                setAccountSubtype(
                  e.target.value
                )
              }
              placeholder="Optional"
              style={inputStyle}
            />

            <button
              disabled={saving}
              style={buttonStyle}
            >
              {saving
                ? "Saving..."
                : "Add Account"}
            </button>
          </form>

          <section style={cardStyle}>
            <div style={filterRowStyle}>
              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search account..."
                style={searchStyle}
              />

              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value)
                }
                style={filterStyle}
              >
                <option value="all">
                  All Types
                </option>

                <option value="asset">
                  Assets
                </option>

                <option value="liability">
                  Liabilities
                </option>

                <option value="equity">
                  Equity
                </option>

                <option value="income">
                  Income
                </option>

                <option value="expense">
                  Expenses
                </option>
              </select>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Code</th>
                    <th style={th}>Account Name</th>
                    <th style={th}>Type</th>
                    <th style={th}>Subtype</th>
                    <th style={th}>System</th>
                    <th style={th}>Status</th>
                    <th style={th}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAccounts.map(
                    (account) => (
                      <tr key={account.id}>
                        <td style={td}>
                          {account.account_code}
                        </td>

                        <td style={td}>
                          <strong>
                            {account.account_name}
                          </strong>
                        </td>

                        <td style={td}>
                          {formatType(
                            account.account_type
                          )}
                        </td>

                        <td style={td}>
                          {account.account_subtype ||
                            "-"}
                        </td>

                        <td style={td}>
                          {account.is_system
                            ? "Yes"
                            : "No"}
                        </td>

                        <td style={td}>
                          <span
                            style={
                              account.is_active
                                ? activeBadgeStyle
                                : inactiveBadgeStyle
                            }
                          >
                            {account.is_active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td style={td}>
                          {account.is_system ? (
                            <span
                              style={{
                                color: "#98a2b3",
                              }}
                            >
                              Protected
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                toggleAccount(
                                  account
                                )
                              }
                              style={
                                account.is_active
                                  ? disableButtonStyle
                                  : enableButtonStyle
                              }
                            >
                              {account.is_active
                                ? "Disable"
                                : "Enable"}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function formatType(
  type: Account["account_type"]
) {
  if (type === "asset") return "Asset";
  if (type === "liability")
    return "Liability";
  if (type === "equity") return "Equity";
  if (type === "income") return "Income";
  return "Expense";
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  padding: "32px",
  fontFamily:
    "Arial, Helvetica, sans-serif",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "1250px",
  margin: "0 auto",
};

const backButtonStyle: React.CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  padding: 0,
  marginBottom: "20px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const counterStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "14px 18px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "360px minmax(0, 1fr)",
  gap: "24px",
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: "700",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  marginBottom: "14px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "700",
};

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginBottom: "18px",
};

const searchStyle: React.CSSProperties = {
  flex: 1,
  padding: "11px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
};

const filterStyle: React.CSSProperties = {
  width: "180px",
  padding: "11px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "850px",
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
  color: "#667085",
  fontSize: "13px",
};

const td: React.CSSProperties = {
  padding: "13px 12px",
  borderBottom: "1px solid #f2f4f7",
  fontSize: "14px",
};

const activeBadgeStyle: React.CSSProperties = {
  backgroundColor: "#dcfce7",
  color: "#15803d",
  padding: "5px 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "700",
};

const inactiveBadgeStyle: React.CSSProperties = {
  backgroundColor: "#f2f4f7",
  color: "#667085",
  padding: "5px 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "700",
};

const disableButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  borderRadius: "7px",
  padding: "7px 10px",
  cursor: "pointer",
};

const enableButtonStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  backgroundColor: "#f0fdf4",
  color: "#15803d",
  borderRadius: "7px",
  padding: "7px 10px",
  cursor: "pointer",
};