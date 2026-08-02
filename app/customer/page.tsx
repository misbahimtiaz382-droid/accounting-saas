"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export default function CustomersPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    await loadCustomers(membership.company_id);
    setLoading(false);
  }

  async function loadCustomers(currentCompanyId: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, email, phone, address")
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers((data as Customer[]) ?? []);
  }

  function resetForm() {
    setEditingCustomerId(null);
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
  }

  function handleEditCustomer(customer: Customer) {
    setEditingCustomerId(customer.id);
    setName(customer.name);
    setEmail(customer.email || "");
    setPhone(customer.phone || "");
    setAddress(customer.address || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSaveCustomer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Customer name likho.");
      return;
    }

    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    setSaving(true);

    if (editingCustomerId) {
      const { error } = await supabase
        .from("customers")
        .update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        })
        .eq("id", editingCustomerId)
        .eq("company_id", companyId);

      setSaving(false);

      if (error) {
        alert(error.message);
        return;
      }

      resetForm();
      await loadCustomers(companyId);
      alert("Customer successfully update ho gaya.");
      return;
    }

    const { error } = await supabase.from("customers").insert({
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

    resetForm();
    await loadCustomers(companyId);
    alert("Customer successfully add ho gaya.");
  }

  async function handleDeleteCustomer(customer: Customer) {
  const confirmed = window.confirm(
    '"' + customer.name + '" ko delete karna hai?'
  );

    if (!confirmed) {
      return;
    }

    setDeletingId(customer.id);

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id)
      .eq("company_id", companyId);

    setDeletingId(null);

    if (error) {
      const errorMessage = error.message.toLowerCase();

      if (
        errorMessage.includes("foreign key") ||
        errorMessage.includes("violates")
      ) {
        alert(
          "Ye customer sale ya payment ke saath linked hai, isliye delete nahi ho sakta."
        );
        return;
      }

      alert(error.message);
      return;
    }

    if (editingCustomerId === customer.id) {
      resetForm();
    }

    await loadCustomers(companyId);
    alert("Customer delete ho gaya.");
  }

  if (loading) {
    return <main style={loadingStyle}>Loading...</main>;
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "1150px", margin: "0 auto" }}>
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
              Customers
            </h1>

            <p style={{ color: "#667085" }}>
              Customer records add, edit aur manage karo.
            </p>
          </div>

          <div style={counterStyle}>
            Total Customers: <strong>{customers.length}</strong>
          </div>
        </div>

        <div style={gridStyle}>
          <form onSubmit={handleSaveCustomer} style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>
              {editingCustomerId
                ? "Edit Customer"
                : "Add Customer"}
            </h2>

            {editingCustomerId && (
              <div style={editNoticeStyle}>
                Customer edit mode active hai.
              </div>
            )}

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer name"
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
                ...primaryButtonStyle,
                backgroundColor: saving
                  ? "#93c5fd"
                  : "#2563eb",
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : editingCustomerId
                ? "Update Customer"
                : "Add Customer"}
            </button>

            {editingCustomerId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={cancelButtonStyle}
              >
                Cancel Edit
              </button>
            )}
          </form>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Customer List</h2>

            {customers.length === 0 ? (
              <p style={emptyStyle}>
                Abhi koi customer add nahi hua.
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
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id}>
                        <td style={tableCellStyle}>
                          {customer.name}
                        </td>

                        <td style={tableCellStyle}>
                          {customer.email || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          {customer.phone || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          {customer.address || "-"}
                        </td>

                        <td style={tableCellStyle}>
                          <div style={actionButtonsStyle}>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditCustomer(customer)
                              }
                              style={editButtonStyle}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteCustomer(customer)
                              }
                              disabled={deletingId === customer.id}
                              style={{
                                ...deleteButtonStyle,
                                cursor:
                                  deletingId === customer.id
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  deletingId === customer.id
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {deletingId === customer.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
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
  gridTemplateColumns: "360px minmax(0, 1fr)",
  gap: "24px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const editNoticeStyle: React.CSSProperties = {
  backgroundColor: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  padding: "10px 12px",
  borderRadius: "8px",
  marginBottom: "14px",
  fontSize: "14px",
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

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
};

const cancelButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  color: "#344054",
  cursor: "pointer",
  fontSize: "15px",
  marginTop: "10px",
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
  whiteSpace: "nowrap",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f2f4f7",
  fontSize: "14px",
  verticalAlign: "top",
};

const actionButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const editButtonStyle: React.CSSProperties = {
  border: "1px solid #93c5fd",
  borderRadius: "7px",
  padding: "7px 11px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: "13px",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fda29b",
  borderRadius: "7px",
  padding: "7px 11px",
  backgroundColor: "#fff5f5",
  color: "#b42318",
  fontSize: "13px",
};