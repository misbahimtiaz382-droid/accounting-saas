"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type TeamMember = {
  user_id: string;
  email: string;
  role: string;
  joined_at: string;
};

export default function TeamPage() {
  const router = useRouter();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [companyName, setCompanyName] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");

  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadTeamPage();
  }, []);

  async function loadTeamPage() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    const { data: membership, error: membershipError } =
      await supabase
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
      alert("Company membership nahi mili.");
      router.replace("/dashboard");
      return;
    }

    const company = membership.companies as unknown as {
      name: string;
    };

    setCompanyName(company?.name || "My Company");

    await loadMembers();
    setLoading(false);
  }

  async function loadMembers() {
    const { data, error } = await supabase.rpc("get_my_team");

    if (error) {
      alert(error.message);
      return;
    }

    setMembers((data ?? []) as TeamMember[]);
  }

  async function handleInvite(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!inviteEmail.trim()) {
      alert("Team member ka email likho.");
      return;
    }

    setInviting(true);

    const { error } = await supabase.rpc(
      "create_team_invitation",
      {
        invite_email: inviteEmail.trim(),
        invite_role: inviteRole,
      }
    );

    setInviting(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Invitation record successfully create ho gaya.");

    setInviteEmail("");
    setInviteRole("staff");
  }

  function formatRole(role: string) {
    if (!role) {
      return "-";
    }

    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function formatDate(date: string) {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleDateString();
  }

  if (loading) {
    return <main style={loadingStyle}>Loading...</main>;
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

        <div style={headingStyle}>
          <h1 style={{ margin: 0, fontSize: "30px" }}>
            Team Members
          </h1>

          <p style={{ color: "#667085" }}>
            {companyName} ke users aur permissions manage karo.
          </p>
        </div>

        <div style={contentGridStyle}>
          <form
            onSubmit={handleInvite}
            style={inviteCardStyle}
          >
            <h2 style={{ marginTop: 0 }}>
              Invite Team Member
            </h2>

            <p style={descriptionStyle}>
              Manager ya staff member ko company me invite karo.
            </p>

            <label style={labelStyle}>
              Email Address
            </label>

            <input
              type="email"
              value={inviteEmail}
              onChange={(event) =>
                setInviteEmail(event.target.value)
              }
              placeholder="staff@company.com"
              style={inputStyle}
            />

            <label style={labelStyle}>Role</label>

            <select
              value={inviteRole}
              onChange={(event) =>
                setInviteRole(event.target.value)
              }
              style={inputStyle}
            >
              <option value="manager">
                Manager
              </option>

              <option value="staff">
                Staff
              </option>
            </select>

            <button
              type="submit"
              disabled={inviting}
              style={{
                ...inviteButtonStyle,
                backgroundColor: inviting
                  ? "#93c5fd"
                  : "#2563eb",
                cursor: inviting
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {inviting
                ? "Creating Invitation..."
                : "Invite Member"}
            </button>
          </form>

          <section style={membersCardStyle}>
            <div style={tableHeadingStyle}>
              <div>
                <h2 style={{ margin: 0 }}>
                  Current Team
                </h2>

                <p style={descriptionStyle}>
                  {members.length} team member
                  {members.length === 1 ? "" : "s"}
                </p>
              </div>

              <button
                type="button"
                onClick={loadMembers}
                style={refreshButtonStyle}
              >
                Refresh
              </button>
            </div>

            {members.length === 0 ? (
              <div style={emptyStateStyle}>
                Team member nahi mila.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>
                        Email
                      </th>

                      <th style={tableHeaderStyle}>
                        Role
                      </th>

                      <th style={tableHeaderStyle}>
                        Joined
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {members.map((member) => (
                      <tr key={member.user_id}>
                        <td style={tableCellStyle}>
                          {member.email}
                        </td>

                        <td style={tableCellStyle}>
                          <span
                            style={{
                              ...roleBadgeStyle,
                              backgroundColor:
                                member.role === "owner"
                                  ? "#ecfdf3"
                                  : member.role === "manager"
                                  ? "#eff6ff"
                                  : "#f9fafb",
                              color:
                                member.role === "owner"
                                  ? "#067647"
                                  : member.role === "manager"
                                  ? "#1d4ed8"
                                  : "#475467",
                            }}
                          >
                            {formatRole(member.role)}
                          </span>
                        </td>

                        <td style={tableCellStyle}>
                          {formatDate(member.joined_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>
            Role Permissions
          </h3>

          <div style={permissionRowStyle}>
            <strong>Owner</strong>
            <span>
              Complete company aur team access.
            </span>
          </div>

          <div style={permissionRowStyle}>
            <strong>Manager</strong>
            <span>
              Sales, purchases, reports aur operational access.
            </span>
          </div>

          <div style={permissionRowStyle}>
            <strong>Staff</strong>
            <span>
              Limited daily entry aur transaction access.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "32px",
  backgroundColor: "#f4f7fb",
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
  marginBottom: "20px",
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  fontSize: "15px",
};

const headingStyle: React.CSSProperties = {
  marginBottom: "24px",
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(280px, 360px) minmax(0, 1fr)",
  gap: "22px",
  alignItems: "start",
};

const inviteCardStyle: React.CSSProperties = {
  padding: "25px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const membersCardStyle: React.CSSProperties = {
  padding: "25px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const descriptionStyle: React.CSSProperties = {
  margin: "7px 0 20px",
  color: "#667085",
  fontSize: "14px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "7px",
  color: "#344054",
  fontSize: "14px",
  fontWeight: "600",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  marginBottom: "18px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
  fontSize: "15px",
};

const inviteButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
};

const tableHeadingStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "15px",
};

const refreshButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  color: "#344054",
  cursor: "pointer",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const tableHeaderStyle: React.CSSProperties = {
  padding: "13px",
  borderBottom: "1px solid #eaecf0",
  color: "#667085",
  textAlign: "left",
  fontSize: "13px",
};

const tableCellStyle: React.CSSProperties = {
  padding: "15px 13px",
  borderBottom: "1px solid #f2f4f7",
  fontSize: "14px",
};

const roleBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "600",
};

const emptyStateStyle: React.CSSProperties = {
  padding: "45px 20px",
  color: "#98a2b3",
  textAlign: "center",
};

const infoCardStyle: React.CSSProperties = {
  marginTop: "22px",
  padding: "24px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  boxShadow: "0 5px 18px rgba(16,24,40,0.06)",
};

const permissionRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: "20px",
  padding: "13px 0",
  borderBottom: "1px solid #f2f4f7",
};