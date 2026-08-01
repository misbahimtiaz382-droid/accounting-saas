"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string | null;
};

export default function SettingsPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("PKR");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
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

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, email, phone, address, currency")
      .eq("id", membership.company_id)
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const company = data as Company;

    setCompanyName(company.name || "");
    setEmail(company.email || "");
    setPhone(company.phone || "");
    setAddress(company.address || "");
    setCurrency(company.currency || "PKR");

    setLoading(false);
  }

  async function handleSaveSettings(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyName.trim()) {
      alert("Company name likho.");
      return;
    }

    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("companies")
      .update({
        name: companyName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        currency,
      })
      .eq("id", companyId);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Company settings successfully save ho gayi.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return <main style={loadingStyle}>Loading...</main>;
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          style={backButtonStyle}
        >
          ← Back to Dashboard
        </button>

        <div style={headingStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: "30px" }}>
              Settings
            </h1>

            <p style={{ color: "#667085" }}>
              Company ki basic information manage karo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Company Information</h2>

          <label style={labelStyle}>Company Name</label>

          <input
            value={companyName}
            onChange={(event) =>
              setCompanyName(event.target.value)
            }
            placeholder="Company name"
            style={inputStyle}
          />

          <div style={twoColumnStyle}>
            <div>
              <label style={labelStyle}>Business Email</label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Business email"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone Number</label>

              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
                style={inputStyle}
              />
            </div>
          </div>

          <label style={labelStyle}>Business Address</label>

          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Business address"
            rows={4}
            style={{
              ...inputStyle,
              resize: "vertical",
            }}
          />

          <label style={labelStyle}>Currency</label>

          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            style={inputStyle}
          >
            <option value="PKR">PKR — Pakistani Rupee</option>
            <option value="USD">USD — US Dollar</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="EUR">EUR — Euro</option>
            <option value="AED">AED — UAE Dirham</option>
            <option value="SAR">SAR — Saudi Riyal</option>
          </select>

          <div style={buttonRowStyle}>
            <button
              type="submit"
              disabled={saving}
              style={{
                ...saveButtonStyle,
                backgroundColor: saving
                  ? "#93c5fd"
                  : "#2563eb",
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={logoutButtonStyle}
            >
              Logout
            </button>
          </div>
        </form>

        <section style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>Current Company</h3>

          <div style={infoRowStyle}>
            <span>Company Name</span>
            <strong>{companyName || "-"}</strong>
          </div>

          <div style={infoRowStyle}>
            <span>Email</span>
            <strong>{email || "-"}</strong>
          </div>

          <div style={infoRowStyle}>
            <span>Phone</span>
            <strong>{phone || "-"}</strong>
          </div>

          <div style={infoRowStyle}>
            <span>Currency</span>
            <strong>{currency}</strong>
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

const headingStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "28px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
  marginBottom: "24px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: "600",
  marginBottom: "7px",
  color: "#344054",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  marginBottom: "18px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
  fontSize: "15px",
  backgroundColor: "#ffffff",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginTop: "5px",
};

const saveButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
};

const logoutButtonStyle: React.CSSProperties = {
  padding: "13px 22px",
  border: "1px solid #fda29b",
  borderRadius: "8px",
  backgroundColor: "#fff5f5",
  color: "#b42318",
  cursor: "pointer",
  fontSize: "15px",
};

const infoCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "13px 0",
  borderBottom: "1px solid #f2f4f7",
};