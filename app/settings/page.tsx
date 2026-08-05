"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string | null;
  logo_url: string | null;
};

export default function SettingsPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("PKR");

  const [logoUrl, setLogoUrl] = useState("");
  const [selectedLogo, setSelectedLogo] =
    useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] =
    useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  async function loadSettings() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/");
      return;
    }

    const {
      data: membership,
      error: membershipError,
    } = await supabase
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

    if (!membership?.company_id) {
      alert("Company membership nahi mili.");
      router.replace("/dashboard");
      return;
    }

    const currentCompanyId = membership.company_id;

    setCompanyId(currentCompanyId);

    const { data, error } = await supabase
      .from("companies")
      .select(
        "id, name, email, phone, address, currency, logo_url"
      )
      .eq("id", currentCompanyId)
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
    setLogoUrl(company.logo_url || "");

    setLoading(false);
  }

  function handleLogoSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Sirf PNG, JPG, JPEG ya WEBP image upload karo.");
      event.target.value = "";
      return;
    }

    const maximumSize = 2 * 1024 * 1024;

    if (file.size > maximumSize) {
      alert("Logo image 2 MB se choti honi chahiye.");
      event.target.value = "";
      return;
    }

    if (localPreview) {
      URL.revokeObjectURL(localPreview);
    }

    const previewUrl = URL.createObjectURL(file);

    setSelectedLogo(file);
    setLocalPreview(previewUrl);
  }

  async function uploadCompanyLogo() {
    if (!selectedLogo) {
      return logoUrl || null;
    }

    if (!companyId) {
      throw new Error("Company load nahi hui.");
    }

    setUploadingLogo(true);

    try {
      const extension =
        selectedLogo.name.split(".").pop()?.toLowerCase() ||
        "png";

      const filePath =
        companyId +
        "/logo-" +
        Date.now() +
        "." +
        extension;

      const { error: uploadError } =
        await supabase.storage
          .from("company-logo")
          .upload(filePath, selectedLogo, {
            cacheControl: "3600",
            upsert: true,
            contentType: selectedLogo.type,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from("company-logo")
          .getPublicUrl(filePath);

      const publicUrl =
        publicUrlData.publicUrl || "";

      if (!publicUrl) {
        throw new Error(
          "Logo ka public URL generate nahi hua."
        );
      }

      setLogoUrl(publicUrl);
      setSelectedLogo(null);

      if (localPreview) {
        URL.revokeObjectURL(localPreview);
        setLocalPreview("");
      }

      return publicUrl;
    } finally {
      setUploadingLogo(false);
    }
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

    try {
      const uploadedLogoUrl =
        await uploadCompanyLogo();

      const { error } = await supabase
        .from("companies")
        .update({
          name: companyName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          currency,
          logo_url: uploadedLogoUrl,
        })
        .eq("id", companyId);

      if (error) {
        throw error;
      }

      alert(
        "Company settings successfully save ho gayi."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Settings save nahi hui.";

      alert(message);
    } finally {
      setSaving(false);
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    const confirmed = window.confirm(
      "Company logo remove karna hai?"
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("companies")
      .update({
        logo_url: null,
      })
      .eq("id", companyId);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (localPreview) {
      URL.revokeObjectURL(localPreview);
    }

    setLogoUrl("");
    setLocalPreview("");
    setSelectedLogo(null);

    alert("Company logo remove ho gaya.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const displayedLogo = localPreview || logoUrl;

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading settings...
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

        <div style={headingStyle}>
          <div>
            <h1 style={pageTitleStyle}>
              Company Settings
            </h1>

            <p style={pageDescriptionStyle}>
              Company information, currency aur invoice
              logo manage karo.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSaveSettings}
          style={cardStyle}
        >
          <section style={logoSectionStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
                Company Logo
              </h2>

              <p style={sectionDescriptionStyle}>
                Ye logo invoices aur company documents par
                show hoga.
              </p>
            </div>

            <div style={logoContentStyle}>
              <div style={logoPreviewStyle}>
                {displayedLogo ? (
                  <img
                    src={displayedLogo}
                    alt="Company logo preview"
                    style={logoImageStyle}
                  />
                ) : (
                  <div style={emptyLogoStyle}>
                    <span style={emptyLogoLetterStyle}>
                      {companyName
                        .charAt(0)
                        .toUpperCase() || "C"}
                    </span>

                    <span style={emptyLogoTextStyle}>
                      No Logo
                    </span>
                  </div>
                )}
              </div>

              <div style={logoControlsStyle}>
                <label style={uploadButtonStyle}>
                  Choose Logo

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoSelection}
                    style={hiddenFileInputStyle}
                  />
                </label>

                <p style={uploadHelpStyle}>
                  PNG, JPG ya WEBP. Maximum 2 MB.
                </p>

                {selectedLogo && (
                  <p style={selectedFileStyle}>
                    Selected: {selectedLogo.name}
                  </p>
                )}

                {displayedLogo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    style={removeLogoButtonStyle}
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
          </section>

          <div style={dividerStyle} />

          <h2 style={sectionTitleStyle}>
            Company Information
          </h2>

          <label style={labelStyle}>
            Company Name
          </label>

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
              <label style={labelStyle}>
                Business Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Business email"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Phone Number
              </label>

              <input
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value)
                }
                placeholder="Phone number"
                style={inputStyle}
              />
            </div>
          </div>

          <label style={labelStyle}>
            Business Address
          </label>

          <textarea
            value={address}
            onChange={(event) =>
              setAddress(event.target.value)
            }
            placeholder="Business address"
            rows={4}
            style={textareaStyle}
          />

          <label style={labelStyle}>
            Currency
          </label>

          <select
            value={currency}
            onChange={(event) =>
              setCurrency(event.target.value)
            }
            style={inputStyle}
          >
            <option value="PKR">
              PKR — Pakistani Rupee
            </option>

            <option value="USD">
              USD — US Dollar
            </option>

            <option value="GBP">
              GBP — British Pound
            </option>

            <option value="EUR">
              EUR — Euro
            </option>

            <option value="AED">
              AED — UAE Dirham
            </option>

            <option value="SAR">
              SAR — Saudi Riyal
            </option>
          </select>

          <div style={buttonRowStyle}>
            <button
              type="submit"
              disabled={saving || uploadingLogo}
              style={{
                ...saveButtonStyle,
                opacity:
                  saving || uploadingLogo ? 0.65 : 1,
                cursor:
                  saving || uploadingLogo
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {uploadingLogo
                ? "Uploading Logo..."
                : saving
                  ? "Saving..."
                  : "Save Settings"}
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
          <h3 style={infoTitleStyle}>
            Current Company
          </h3>

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

          <div style={infoRowStyle}>
            <span>Company Logo</span>
            <strong>
              {logoUrl ? "Uploaded" : "Not uploaded"}
            </strong>
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

const containerStyle: React.CSSProperties = {
  maxWidth: "900px",
  margin: "0 auto",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f4f7fb",
  fontFamily: "Arial, sans-serif",
  color: "#475467",
};

const backButtonStyle: React.CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  marginBottom: "20px",
  padding: 0,
  fontSize: "14px",
  fontWeight: "600",
};

const headingStyle: React.CSSProperties = {
  marginBottom: "24px",
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "30px",
  color: "#101828",
};

const pageDescriptionStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#667085",
  fontSize: "15px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "28px",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  boxShadow:
    "0 8px 24px rgba(16,24,40,0.06)",
  marginBottom: "24px",
};

const logoSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "19px",
};

const sectionDescriptionStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const logoContentStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "22px",
  flexWrap: "wrap",
};

const logoPreviewStyle: React.CSSProperties = {
  width: "130px",
  height: "130px",
  border: "1px solid #d0d5dd",
  borderRadius: "14px",
  backgroundColor: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const logoImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  padding: "10px",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
};

const emptyLogoStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
};

const emptyLogoLetterStyle: React.CSSProperties = {
  width: "50px",
  height: "50px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#eff6ff",
  color: "#2563eb",
  fontSize: "22px",
  fontWeight: "700",
};

const emptyLogoTextStyle: React.CSSProperties = {
  color: "#667085",
  fontSize: "12px",
};

const logoControlsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "8px",
};

const uploadButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 16px",
  borderRadius: "8px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "13px",
};

const hiddenFileInputStyle: React.CSSProperties = {
  display: "none",
};

const uploadHelpStyle: React.CSSProperties = {
  margin: 0,
  color: "#667085",
  fontSize: "12px",
};

const selectedFileStyle: React.CSSProperties = {
  margin: 0,
  color: "#15803d",
  fontSize: "12px",
  fontWeight: "600",
};

const removeLogoButtonStyle: React.CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#b42318",
  cursor: "pointer",
  padding: 0,
  fontSize: "12px",
  fontWeight: "700",
};

const dividerStyle: React.CSSProperties = {
  height: "1px",
  backgroundColor: "#eaecf0",
  margin: "28px 0",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: "600",
  marginTop: "18px",
  marginBottom: "7px",
  color: "#344054",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  boxSizing: "border-box",
  fontSize: "15px",
  backgroundColor: "#ffffff",
  color: "#101828",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: "110px",
  height: "auto",
  padding: "12px",
  resize: "vertical",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "18px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginTop: "26px",
};

const saveButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
};

const logoutButtonStyle: React.CSSProperties = {
  padding: "13px 22px",
  border: "1px solid #fda29b",
  borderRadius: "8px",
  backgroundColor: "#fff5f5",
  color: "#b42318",
  cursor: "pointer",
  fontSize: "15px",
  fontWeight: "600",
};

const infoCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  boxShadow:
    "0 5px 18px rgba(16,24,40,0.06)",
};

const infoTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  color: "#101828",
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "13px 0",
  borderBottom: "1px solid #f2f4f7",
  color: "#475467",
};