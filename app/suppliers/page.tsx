"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export default function SuppliersPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

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
    await loadSuppliers(membership.company_id);
    setLoading(false);
  }

  async function loadSuppliers(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, email, phone, address")
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSuppliers(data ?? []);
  }

  async function handleAddSupplier(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Supplier name likho.");
      return;
    }

    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("suppliers").insert({
      company_id: companyId,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    setAddress("");

    await loadSuppliers(companyId);
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
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
              Suppliers
            </h1>

            <p style={{ color: "#667085" }}>
              Supplier records add aur manage karo.
            </p>
          </div>

          <div style={counterStyle}>
            Total Suppliers: <strong>{suppliers.length}</strong>
          </div>
        </div>

        <div style={gridStyle}>
          <form
            onSubmit={handleAddSupplier}
            style={cardStyle}
          >
            <h2 style={{ marginTop: 0 }}>Add Supplier</h2>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Supplier name"
              style={inputStyle}
            />

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              style={inputStyle}
            />

            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Phone"
              style={inputStyle}
            />

            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Address"
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
                backgroundColor: saving ? "#93c5fd" : "#2563eb",
                color: "#ffffff",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "16px",
              }}
            >
              {saving ? "Saving..." : "Add Supplier"}
            </button>
          </form>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Supplier List</h2>

            {suppliers.length === 0 ? (
              <p style={emptyStyle}>
                Abhi koi supplier add nahi hua.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Name</th>
                      <th style={tableHeaderStyle}>Email</th>
                      <th style={tableHeaderStyle}>Phone</th>
                      <th style={tableHeaderStyle}>Address</th>
                    </tr>
                  </thead>

                  <tbody>
                    {suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td style={tableCellStyle}>
                          {supplier.name}
                        </td>

                        <td style={tableCellStyle}>
                          {supplier.email || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          {supplier.phone || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          {supplier.address || "-"}
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
  gridTemplateColumns: "360px 1fr",
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