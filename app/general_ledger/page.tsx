"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Account = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
};

type LedgerLine = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  description: string | null;
  debit: number | null;
  credit: number | null;

  journal_entries: {
    entry_number: string;
    entry_date: string;
    reference_number: string | null;
    description: string | null;
    status: string;
  } | null;
};

type DisplayRow = {
  id: string;
  date: string;
  entryNumber: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export default function GeneralLedgerPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<LedgerLine[]>([]);

  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(true);

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

    const { data: membership, error: membershipError } =
      await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError || !membership?.company_id) {
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
        account_code,
        account_name,
        account_type
      `)
      .eq("company_id", id)
      .eq("is_active", true)
      .order("account_code", { ascending: true });

    if (error) {
      alert("Accounts load error: " + error.message);
      return;
    }

    setAccounts((data || []) as Account[]);
  }

  async function loadLedger(selectedAccountId: string) {
    if (!selectedAccountId) {
      setLines([]);
      return;
    }

    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select(`
        id,
        journal_entry_id,
        account_id,
        description,
        debit,
        credit,

        journal_entries (
          entry_number,
          entry_date,
          reference_number,
          description,
          status
        )
      `)
      .eq("account_id", selectedAccountId)
      .order("created_at", { ascending: true });

    if (error) {
      alert("Ledger load error: " + error.message);
      return;
    }

    setLines((data || []) as unknown as LedgerLine[]);
  }

  async function handleAccountChange(value: string) {
    setAccountId(value);
    await loadLedger(value);
  }

  const selectedAccount = accounts.find(
    (account) => account.id === accountId
  );

  const ledgerRows = useMemo(() => {
    const validLines = lines
      .filter(
        (line) =>
          line.journal_entries &&
          line.journal_entries.status === "posted"
      )
      .sort((a, b) => {
        const dateA = new Date(
          a.journal_entries?.entry_date || ""
        ).getTime();

        const dateB = new Date(
          b.journal_entries?.entry_date || ""
        ).getTime();

        return dateA - dateB;
      });

    let runningBalance = 0;

    return validLines.map((line) => {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      runningBalance =
        runningBalance +
        getBalanceEffect(
          selectedAccount?.account_type || "",
          debit,
          credit
        );

      return {
        id: line.id,
        date:
          line.journal_entries?.entry_date || "",
        entryNumber:
          line.journal_entries?.entry_number || "-",
        reference:
          line.journal_entries?.reference_number || "-",
        description:
          line.description ||
          line.journal_entries?.description ||
          "-",
        debit,
        credit,
        balance: runningBalance,
      } as DisplayRow;
    });
  }, [lines, selectedAccount]);

  const totalDebit = ledgerRows.reduce(
    (sum, row) => sum + row.debit,
    0
  );

  const totalCredit = ledgerRows.reduce(
    (sum, row) => sum + row.credit,
    0
  );

  const closingBalance =
    ledgerRows.length > 0
      ? ledgerRows[ledgerRows.length - 1].balance
      : 0;

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading General Ledger...
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
              General Ledger
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#667085",
              }}
            >
              Har account ki debit, credit aur
              running balance dekho.
            </p>
          </div>
        </div>

        <section style={filterCardStyle}>
          <label style={labelStyle}>
            Account
          </label>

          <select
            value={accountId}
            onChange={(e) =>
              handleAccountChange(e.target.value)
            }
            style={accountSelectStyle}
          >
            <option value="">
              Select Account
            </option>

            {accounts.map((account) => (
              <option
                key={account.id}
                value={account.id}
              >
                {account.account_code} -{" "}
                {account.account_name}
              </option>
            ))}
          </select>
        </section>

        {!accountId ? (
          <section style={emptyCardStyle}>
            Ledger dekhne ke liye account select karo.
          </section>
        ) : (
          <>
            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>
                  Account
                </span>

                <strong style={summaryValueStyle}>
                  {selectedAccount?.account_name || "-"}
                </strong>
              </div>

              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>
                  Total Debit
                </span>

                <strong
                  style={{
                    ...summaryValueStyle,
                    color: "#2563eb",
                  }}
                >
                  Rs. {totalDebit.toFixed(2)}
                </strong>
              </div>

              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>
                  Total Credit
                </span>

                <strong
                  style={{
                    ...summaryValueStyle,
                    color: "#15803d",
                  }}
                >
                  Rs. {totalCredit.toFixed(2)}
                </strong>
              </div>

              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>
                  Closing Balance
                </span>

                <strong
                  style={{
                    ...summaryValueStyle,
                    color: "#b45309",
                  }}
                >
                  Rs. {closingBalance.toFixed(2)}
                </strong>
              </div>
            </div>

            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>
                Ledger Transactions
              </h2>

              {ledgerRows.length === 0 ? (
                <div style={emptyStyle}>
                  Is account ki abhi koi posted
                  transaction nahi hai.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={th}>Date</th>
                        <th style={th}>Entry No.</th>
                        <th style={th}>Reference</th>
                        <th style={th}>Description</th>
                        <th style={th}>Debit</th>
                        <th style={th}>Credit</th>
                        <th style={th}>Balance</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledgerRows.map((row) => (
                        <tr key={row.id}>
                          <td style={td}>
                            {new Date(
                              row.date + "T00:00:00"
                            ).toLocaleDateString()}
                          </td>

                          <td style={td}>
                            <strong>
                              {row.entryNumber}
                            </strong>
                          </td>

                          <td style={td}>
                            {row.reference}
                          </td>

                          <td style={td}>
                            {row.description}
                          </td>

                          <td style={debitCellStyle}>
                            {row.debit > 0
                              ? "Rs. " +
                                row.debit.toFixed(2)
                              : "-"}
                          </td>

                          <td style={creditCellStyle}>
                            {row.credit > 0
                              ? "Rs. " +
                                row.credit.toFixed(2)
                              : "-"}
                          </td>

                          <td style={balanceCellStyle}>
                            Rs. {row.balance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function getBalanceEffect(
  accountType: string,
  debit: number,
  credit: number
) {
  if (
    accountType === "asset" ||
    accountType === "expense"
  ) {
    return debit - credit;
  }

  if (
    accountType === "liability" ||
    accountType === "equity" ||
    accountType === "income"
  ) {
    return credit - debit;
  }

  return debit - credit;
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
  justifyContent: "center",
  alignItems: "center",
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
  marginBottom: "22px",
};

const filterCardStyle: React.CSSProperties = {
  maxWidth: "500px",
  backgroundColor: "#ffffff",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  marginBottom: "22px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "7px",
  fontSize: "13px",
  fontWeight: "700",
};

const accountSelectStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
  marginBottom: "22px",
};

const summaryCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
};

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "13px",
  marginBottom: "7px",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "20px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "900px",
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

const debitCellStyle: React.CSSProperties = {
  ...td,
  color: "#2563eb",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const creditCellStyle: React.CSSProperties = {
  ...td,
  color: "#15803d",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const balanceCellStyle: React.CSSProperties = {
  ...td,
  color: "#b45309",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const emptyCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "50px",
  textAlign: "center",
  color: "#98a2b3",
};

const emptyStyle: React.CSSProperties = {
  padding: "40px 0",
  textAlign: "center",
  color: "#98a2b3",
};