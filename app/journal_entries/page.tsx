"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Account = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
};

type JournalLine = {
  account_id: string;
  description: string;
  debit: string;
  credit: string;
};

type JournalEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  reference_number: string | null;
  description: string | null;
  status: string;
  created_at: string;
};

const emptyLine = (): JournalLine => ({
  account_id: "",
  description: "",
  debit: "",
  credit: "",
});

export default function JournalEntriesPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");

  const [lines, setLines] = useState<JournalLine[]>([
    emptyLine(),
    emptyLine(),
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

    const { data: membership, error: membershipError } = await supabase
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

    await Promise.all([
      loadAccounts(membership.company_id),
      loadEntries(membership.company_id),
    ]);

    setLoading(false);
  }

  async function loadAccounts(id: string) {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, account_code, account_name, account_type")
      .eq("company_id", id)
      .eq("is_active", true)
      .order("account_code", { ascending: true });

    if (error) {
      alert("Accounts load error: " + error.message);
      return;
    }

    setAccounts((data || []) as Account[]);
  }

  async function loadEntries(id: string) {
    const { data, error } = await supabase
      .from("journal_entries")
      .select(`
        id,
        entry_number,
        entry_date,
        reference_number,
        description,
        status,
        created_at
      `)
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      alert("Journal entries load error: " + error.message);
      return;
    }

    setEntries((data || []) as JournalEntry[]);
  }

  function updateLine(
    index: number,
    field: keyof JournalLine,
    value: string
  ) {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;

        const updated = {
          ...line,
          [field]: value,
        };

        if (field === "debit" && Number(value) > 0) {
          updated.credit = "";
        }

        if (field === "credit" && Number(value) > 0) {
          updated.debit = "";
        }

        return updated;
      })
    );
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) {
      alert("Journal entry mein kam az kam 2 lines honi chahiye.");
      return;
    }

    setLines((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  const totalDebit = useMemo(() => {
    return lines.reduce(
      (sum, line) => sum + Number(line.debit || 0),
      0
    );
  }, [lines]);

  const totalCredit = useMemo(() => {
    return lines.reduce(
      (sum, line) => sum + Number(line.credit || 0),
      0
    );
  }, [lines]);

  const difference = totalDebit - totalCredit;

  const isBalanced =
    totalDebit > 0 &&
    totalCredit > 0 &&
    Math.abs(difference) < 0.005;

  async function saveJournalEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (saving) return;

    if (!entryDate) {
      alert("Entry date select karo.");
      return;
    }

    const validLines = lines.filter((line) => {
      return (
        line.account_id &&
        (Number(line.debit || 0) > 0 ||
          Number(line.credit || 0) > 0)
      );
    });

    if (validLines.length < 2) {
      alert("Kam az kam 2 valid journal lines chahiye.");
      return;
    }

    if (!isBalanced) {
      alert(
        `Journal balance nahi hai.\nDebit: Rs. ${totalDebit.toFixed(
          2
        )}\nCredit: Rs. ${totalCredit.toFixed(2)}`
      );
      return;
    }

    setSaving(true);

    const { data: entryNumber, error: numberError } =
      await supabase.rpc("generate_journal_entry_number");

    if (numberError || !entryNumber) {
      alert(
        "Journal entry number generate nahi hua: " +
          (numberError?.message || "")
      );
      setSaving(false);
      return;
    }

    const { data: journalEntry, error: entryError } =
      await supabase
        .from("journal_entries")
        .insert({
          company_id: companyId,
          entry_number: entryNumber,
          entry_date: entryDate,
          reference_number: referenceNumber.trim() || null,
          description: description.trim() || null,
          source_type: "manual",
          source_id: null,
          status: "posted",
        })
        .select("id")
        .single();

    if (entryError || !journalEntry) {
      alert(
        "Journal entry save error: " +
          (entryError?.message || "Unknown error")
      );
      setSaving(false);
      return;
    }

    const linePayload = validLines.map((line) => ({
      journal_entry_id: journalEntry.id,
      account_id: line.account_id,
      description: line.description.trim() || null,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
    }));

    const { error: linesError } = await supabase
      .from("journal_entry_lines")
      .insert(linePayload);

    if (linesError) {
      await supabase
        .from("journal_entries")
        .delete()
        .eq("id", journalEntry.id);

      alert(
        "Journal lines save error: " + linesError.message
      );

      setSaving(false);
      return;
    }

    setReferenceNumber("");
    setDescription("");
    setEntryDate(new Date().toISOString().split("T")[0]);
    setLines([emptyLine(), emptyLine()]);

    await loadEntries(companyId);

    setSaving(false);

    alert("Journal entry successfully save ho gayi.");
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading Journal Entries...
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
            <h1 style={{ margin: 0 }}>Journal Entries</h1>

            <p
              style={{
                marginTop: "8px",
                color: "#667085",
              }}
            >
              Manual debit aur credit entries record karo.
            </p>
          </div>

          <div style={counterStyle}>
            <span style={counterLabelStyle}>
              Total Entries
            </span>

            <strong style={{ fontSize: "20px" }}>
              {entries.length}
            </strong>
          </div>
        </div>

        <form onSubmit={saveJournalEntry}>
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>
              New Journal Entry
            </h2>

            <div style={topGridStyle}>
              <div>
                <label style={labelStyle}>
                  Entry Date
                </label>

                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) =>
                    setEntryDate(e.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Reference Number
                </label>

                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) =>
                    setReferenceNumber(e.target.value)
                  }
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>
            </div>

            <label style={labelStyle}>
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Journal entry description"
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
            />

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Account</th>
                    <th style={th}>Description</th>
                    <th style={th}>Debit</th>
                    <th style={th}>Credit</th>
                    <th style={th}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td style={td}>
                        <select
                          value={line.account_id}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "account_id",
                              e.target.value
                            )
                          }
                          style={tableInputStyle}
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
                      </td>

                      <td style={td}>
                        <input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="Optional"
                          style={tableInputStyle}
                        />
                      </td>

                      <td style={td}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "debit",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                          style={moneyInputStyle}
                        />
                      </td>

                      <td style={td}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "credit",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                          style={moneyInputStyle}
                        />
                      </td>

                      <td style={td}>
                        <button
                          type="button"
                          onClick={() =>
                            removeLine(index)
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

            <button
              type="button"
              onClick={addLine}
              style={addLineButtonStyle}
            >
              + Add Line
            </button>

            <div style={summaryGridStyle}>
              <div style={summaryBoxStyle}>
                <span style={summaryLabelStyle}>
                  Total Debit
                </span>

                <strong
                  style={{
                    color: "#2563eb",
                  }}
                >
                  Rs. {totalDebit.toFixed(2)}
                </strong>
              </div>

              <div style={summaryBoxStyle}>
                <span style={summaryLabelStyle}>
                  Total Credit
                </span>

                <strong
                  style={{
                    color: "#15803d",
                  }}
                >
                  Rs. {totalCredit.toFixed(2)}
                </strong>
              </div>

              <div style={summaryBoxStyle}>
                <span style={summaryLabelStyle}>
                  Difference
                </span>

                <strong
                  style={{
                    color: isBalanced
                      ? "#15803d"
                      : "#b91c1c",
                  }}
                >
                  Rs. {Math.abs(difference).toFixed(2)}
                </strong>
              </div>

              <div style={summaryBoxStyle}>
                <span style={summaryLabelStyle}>
                  Status
                </span>

                <strong
                  style={{
                    color: isBalanced
                      ? "#15803d"
                      : "#b45309",
                  }}
                >
                  {isBalanced
                    ? "Balanced"
                    : "Not Balanced"}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !isBalanced}
              style={{
                ...saveButtonStyle,
                opacity:
                  saving || !isBalanced
                    ? 0.6
                    : 1,
                cursor:
                  saving || !isBalanced
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : "Post Journal Entry"}
            </button>
          </section>
        </form>

        <section
          style={{
            ...cardStyle,
            marginTop: "24px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Recent Journal Entries
          </h2>

          {entries.length === 0 ? (
            <div style={emptyStyle}>
              Abhi koi journal entry nahi hai.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={recentTableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Entry No.</th>
                    <th style={th}>Reference</th>
                    <th style={th}>Description</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td style={td}>
                        {new Date(
                          entry.entry_date + "T00:00:00"
                        ).toLocaleDateString()}
                      </td>

                      <td style={td}>
                        <strong>
                          {entry.entry_number}
                        </strong>
                      </td>

                      <td style={td}>
                        {entry.reference_number || "-"}
                      </td>

                      <td style={td}>
                        {entry.description || "-"}
                      </td>

                      <td style={td}>
                        <span
                          style={
                            entry.status === "posted"
                              ? postedBadgeStyle
                              : draftBadgeStyle
                          }
                        >
                          {entry.status}
                        </span>
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
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const counterStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "14px 18px",
};

const counterLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "12px",
  marginBottom: "4px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
};

const topGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: "700",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px",
  marginBottom: "14px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "1000px",
  borderCollapse: "collapse",
};

const recentTableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "800px",
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
  padding: "12px",
  borderBottom: "1px solid #f2f4f7",
  fontSize: "14px",
};

const tableInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "180px",
  padding: "9px",
  border: "1px solid #d0d5dd",
  borderRadius: "7px",
  boxSizing: "border-box",
};

const moneyInputStyle: React.CSSProperties = {
  width: "120px",
  padding: "9px",
  border: "1px solid #d0d5dd",
  borderRadius: "7px",
  boxSizing: "border-box",
};

const removeButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  borderRadius: "7px",
  padding: "7px 10px",
  cursor: "pointer",
};

const addLineButtonStyle: React.CSSProperties = {
  marginTop: "14px",
  border: "1px solid #bfdbfe",
  backgroundColor: "#eff6ff",
  color: "#2563eb",
  borderRadius: "7px",
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: "700",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "12px",
  marginTop: "20px",
  marginBottom: "20px",
};

const summaryBoxStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "14px",
};

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: "12px",
  marginBottom: "5px",
};

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontWeight: "700",
};

const postedBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: "999px",
  backgroundColor: "#dcfce7",
  color: "#15803d",
  fontSize: "12px",
  fontWeight: "700",
};

const draftBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: "999px",
  backgroundColor: "#fef3c7",
  color: "#b45309",
  fontSize: "12px",
  fontWeight: "700",
};

const emptyStyle: React.CSSProperties = {
  padding: "40px 0",
  textAlign: "center",
  color: "#98a2b3",
};