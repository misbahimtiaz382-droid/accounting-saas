"use client";

import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!fullName.trim()) {
      alert("Full name likho.");
      return;
    }

    if (!email.trim()) {
      alert("Email likho.");
      return;
    }

    if (password.length < 8) {
      alert("Password kam az kam 8 characters ka ho.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords match nahi kar rahe.");
      return;
    }

    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    const { data, error: signupError } =
      await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

    if (signupError) {
      setLoading(false);
      alert(signupError.message);
      return;
    }

    /*
      Agar email confirmation ON hai to signup ke foran baad
      session nahi milega. User email verify karke login karega.
      Login page invitation accept function chalayega.
    */
    if (!data.session) {
      setLoading(false);

      alert(
        "Account create ho gaya. Email verify karke login karo."
      );

      router.push("/");
      return;
    }

    /*
      Pehle pending invitation accept karne ki koshish hogi.
      Invitation mil gayi to user invited company me Staff/Manager
      role ke saath add ho jayega.
    */
    const { error: invitationError } = await supabase.rpc(
      "accept_my_team_invitation"
    );

    if (!invitationError) {
      setLoading(false);

      alert(
        "Account create ho gaya aur aap invited company me join ho gaye."
      );

      router.replace("/dashboard");
      return;
    }

    const invitationMessage =
      invitationError.message.toLowerCase();

    const invitationNotFound =
      invitationMessage.includes(
        "pending invitation not found"
      );

    /*
      Pending invitation na milna normal hai:
      iska matlab user apni new company bana raha hai.

      Iske ilawa koi error ho to company create nahi hogi.
    */
    if (!invitationNotFound) {
      setLoading(false);
      alert(invitationError.message);
      return;
    }

    /*
      Invitation nahi mili, isliye ab company name compulsory hai.
    */
    if (!companyName.trim()) {
      setLoading(false);

      alert(
        "Agar aapko team invitation nahi mili to Company Name likhna zaroori hai."
      );

      return;
    }

    const { error: companyError } = await supabase.rpc(
      "create_company_for_current_user",
      {
        company_name: companyName.trim(),
      }
    );

    setLoading(false);

    if (companyError) {
      alert(companyError.message);
      return;
    }

    alert("Account aur company successfully create ho gaye.");

    router.replace("/dashboard");
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={headingStyle}>
          <div style={logoStyle}>A</div>

          <div>
            <h1 style={{ margin: 0, fontSize: "28px" }}>
              Create your account
            </h1>

            <p
              style={{
                margin: "7px 0 0",
                color: "#667085",
              }}
            >
              Apni company banao ya team invitation accept
              karo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSignup}>
          <label style={labelStyle}>Full Name</label>

          <input
            value={fullName}
            onChange={(event) =>
              setFullName(event.target.value)
            }
            placeholder="Your full name"
            autoComplete="name"
            style={inputStyle}
          />

          <label style={labelStyle}>
            Company Name
            <span style={optionalTextStyle}>
              {" "}
              — invited staff ke liye optional
            </span>
          </label>

          <input
            value={companyName}
            onChange={(event) =>
              setCompanyName(event.target.value)
            }
            placeholder="Your company name"
            autoComplete="organization"
            style={inputStyle}
          />

          <label style={labelStyle}>Email Address</label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="you@company.com"
            autoComplete="email"
            style={inputStyle}
          />

          <div style={twoColumnStyle}>
            <div>
              <label style={labelStyle}>Password</label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Confirm Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Repeat password"
                autoComplete="new-password"
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...signupButtonStyle,
              backgroundColor: loading
                ? "#93c5fd"
                : "#2563eb",
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>
        </form>

        <div style={dividerStyle}>
          <span style={dividerLineStyle} />

          <span style={dividerTextStyle}>
            Already registered?
          </span>

          <span style={dividerLineStyle} />
        </div>

        <button
          type="button"
          onClick={() => router.push("/")}
          disabled={loading}
          style={loginButtonStyle}
        >
          Go to Login
        </button>

        <p style={termsStyle}>
          Account create karne se aap platform ki terms aur
          privacy policy se agree karte hain.
        </p>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 18px",
  boxSizing: "border-box",
  background:
    "linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%)",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#172033",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  padding: "36px",
  borderRadius: "20px",
  backgroundColor: "#ffffff",
  boxShadow:
    "0 24px 65px rgba(15, 23, 42, 0.28)",
  boxSizing: "border-box",
};

const headingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  marginBottom: "28px",
};

const logoStyle: React.CSSProperties = {
  width: "50px",
  height: "50px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontWeight: "700",
  fontSize: "24px",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "7px",
  color: "#344054",
  fontSize: "14px",
  fontWeight: "600",
};

const optionalTextStyle: React.CSSProperties = {
  color: "#98a2b3",
  fontWeight: "400",
  fontSize: "12px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  marginBottom: "17px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontSize: "15px",
  outline: "none",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "15px",
};

const signupButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: "9px",
  padding: "14px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
};

const dividerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "24px 0 16px",
};

const dividerLineStyle: React.CSSProperties = {
  height: "1px",
  flex: 1,
  backgroundColor: "#eaecf0",
};

const dividerTextStyle: React.CSSProperties = {
  color: "#98a2b3",
  fontSize: "13px",
};

const loginButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  backgroundColor: "#ffffff",
  color: "#344054",
  cursor: "pointer",
  fontSize: "15px",
  fontWeight: "600",
};

const termsStyle: React.CSSProperties = {
  margin: "18px 0 0",
  color: "#98a2b3",
  fontSize: "12px",
  lineHeight: "1.5",
  textAlign: "center",
};