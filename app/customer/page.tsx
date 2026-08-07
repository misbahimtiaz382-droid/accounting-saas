"use client";

import {
  CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type CustomerType = "individual" | "business";

type Customer = {
  id: string;
  customer_type: CustomerType | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  display_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  address: string | null;
  tax_number: string | null;
  opening_balance: number | null;
  credit_limit: number | null;
  notes: string | null;
  created_at: string;
};

export default function CustomersPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [editingCustomerId, setEditingCustomerId] =
    useState<string | null>(null);

  const [customerType, setCustomerType] =
    useState<CustomerType>("individual");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [creditLimit, setCreditLimit] = useState("0");
  const [notes, setNotes] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (editingCustomerId) {
      return;
    }

    if (customerType === "business") {
      setDisplayName(companyName);
      return;
    }

    setDisplayName(
      [firstName, lastName]
        .filter(Boolean)
        .join(" ")
    );
  }, [
    customerType,
    firstName,
    lastName,
    companyName,
    editingCustomerId,
  ]);

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

    setCompanyId(membership.company_id);

    await loadCustomers(
      membership.company_id
    );

    setLoading(false);
  }

  async function loadCustomers(
    currentCompanyId: string
  ) {
    const { data, error } = await supabase
      .from("customers")
      .select(`
        id,
        customer_type,
        first_name,
        last_name,
        company_name,
        display_name,
        name,
        email,
        phone,
        alternate_phone,
        address,
        tax_number,
        opening_balance,
        credit_limit,
        notes,
        created_at
      `)
      .eq("company_id", currentCompanyId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers(
      (data as Customer[]) || []
    );
  }

  const filteredCustomers = useMemo(() => {
    const searchText = search
      .trim()
      .toLowerCase();

    return customers.filter((customer) => {
      const matchesType =
        typeFilter === "all" ||
        customer.customer_type === typeFilter;

      const searchableText = [
        customer.display_name,
        customer.name,
        customer.company_name,
        customer.first_name,
        customer.last_name,
        customer.email,
        customer.phone,
        customer.tax_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchText ||
        searchableText.includes(searchText);

      return matchesType && matchesSearch;
    });
  }, [customers, search, typeFilter]);

  const totalOpeningBalance = customers.reduce(
    (sum, customer) =>
      sum +
      Number(customer.opening_balance || 0),
    0
  );

  const businessCustomers = customers.filter(
    (customer) =>
      customer.customer_type === "business"
  ).length;

  const individualCustomers =
    customers.length - businessCustomers;

  function resetForm() {
    setEditingCustomerId(null);
    setCustomerType("individual");
    setFirstName("");
    setLastName("");
    setCompanyName("");
    setDisplayName("");
    setEmail("");
    setPhone("");
    setAlternatePhone("");
    setAddress("");
    setTaxNumber("");
    setOpeningBalance("0");
    setCreditLimit("0");
    setNotes("");
  }

  function handleEditCustomer(
    customer: Customer
  ) {
    setEditingCustomerId(customer.id);

    setCustomerType(
      customer.customer_type ||
        "individual"
    );

    setFirstName(
      customer.first_name || ""
    );

    setLastName(
      customer.last_name || ""
    );

    setCompanyName(
      customer.company_name || ""
    );

    setDisplayName(
      customer.display_name ||
        customer.name ||
        ""
    );

    setEmail(customer.email || "");
    setPhone(customer.phone || "");

    setAlternatePhone(
      customer.alternate_phone || ""
    );

    setAddress(customer.address || "");

    setTaxNumber(
      customer.tax_number || ""
    );

    setOpeningBalance(
      String(
        customer.opening_balance || 0
      )
    );

    setCreditLimit(
      String(customer.credit_limit || 0)
    );

    setNotes(customer.notes || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function getFinalDisplayName() {
    if (displayName.trim()) {
      return displayName.trim();
    }

    if (
      customerType === "business" &&
      companyName.trim()
    ) {
      return companyName.trim();
    }

    return [firstName, lastName]
      .filter((value) => value.trim())
      .join(" ")
      .trim();
  }
  async function handleSaveCustomer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyId) {
      alert("Company load nahi hui.");
      return;
    }

    const finalDisplayName =
      getFinalDisplayName();

    if (!finalDisplayName) {
      alert(
        customerType === "business"
          ? "Company name ya display name likho."
          : "First name ya display name likho."
      );
      return;
    }

    if (
      customerType === "business" &&
      !companyName.trim()
    ) {
      alert("Company name likho.");
      return;
    }

    if (
      customerType === "individual" &&
      !firstName.trim()
    ) {
      alert("First name likho.");
      return;
    }

    const openingBalanceValue =
      Math.max(
        0,
        Number(openingBalance || 0)
      );

    const creditLimitValue =
      Math.max(
        0,
        Number(creditLimit || 0)
      );

    if (
      !Number.isFinite(
        openingBalanceValue
      )
    ) {
      alert(
        "Opening balance valid number hona chahiye."
      );
      return;
    }

    if (
      !Number.isFinite(creditLimitValue)
    ) {
      alert(
        "Credit limit valid number hona chahiye."
      );
      return;
    }

    const payload = {
      customer_type: customerType,
      first_name:
        customerType === "individual"
          ? firstName.trim() || null
          : null,
      last_name:
        customerType === "individual"
          ? lastName.trim() || null
          : null,
      company_name:
        customerType === "business"
          ? companyName.trim() || null
          : null,
      display_name: finalDisplayName,
      name: finalDisplayName,
      email: email.trim() || null,
      phone: phone.trim() || null,
      alternate_phone:
        alternatePhone.trim() || null,
      address: address.trim() || null,
      tax_number:
        taxNumber.trim() || null,
      opening_balance:
        openingBalanceValue,
      credit_limit:
        creditLimitValue,
      notes: notes.trim() || null,
    };

    setSaving(true);

    if (editingCustomerId) {
      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", editingCustomerId)
        .eq("company_id", companyId);

      setSaving(false);

      if (error) {
        alert(error.message);
        return;
      }

      resetForm();

      await loadCustomers(companyId);

      alert(
        "Customer successfully update ho gaya."
      );

      return;
    }

    const { error } = await supabase
      .from("customers")
      .insert({
        company_id: companyId,
        ...payload,
      });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    resetForm();

    await loadCustomers(companyId);

    alert(
      "Customer successfully add ho gaya."
    );
  }

  async function handleDeleteCustomer(
    customer: Customer
  ) {
    const confirmed =
      window.confirm(
        '"' +
          (customer.display_name ||
            customer.name) +
          '" ko delete karna hai?'
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
      const errorMessage =
        error.message.toLowerCase();

      if (
        errorMessage.includes(
          "foreign key"
        ) ||
        errorMessage.includes(
          "violates"
        )
      ) {
        alert(
          "Ye customer sale, payment ya ledger record ke saath linked hai, isliye delete nahi ho sakta."
        );

        return;
      }

      alert(error.message);
      return;
    }

    if (
      editingCustomerId ===
      customer.id
    ) {
      resetForm();
    }

    await loadCustomers(companyId);

    alert("Customer delete ho gaya.");
  }

  function getCustomerTypeText(
    type: CustomerType | null
  ) {
    return type === "business"
      ? "Business"
      : "Individual";
  }

  function getCustomerTypeStyle(
    type: CustomerType | null
  ) {
    return type === "business"
      ? businessBadgeStyle
      : individualBadgeStyle;
  }

  function getCustomerInitial(
    customer: Customer
  ) {
    return (
      customer.display_name ||
      customer.name ||
      "C"
    )
      .charAt(0)
      .toUpperCase();
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading customers...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <button
            type="button"
            onClick={() =>
              router.push("/dashboard")
            }
            style={backButtonStyle}
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            onClick={resetForm}
            style={newCustomerButtonStyle}
          >
            + New Customer
          </button>
        </div>

        <div style={headingRowStyle}>
          <div>
            <h1 style={pageTitleStyle}>
              Customers
            </h1>

            <p style={pageDescriptionStyle}>
              Professional customer profiles,
              credit details aur records manage
              karo.
            </p>
          </div>
        </div>

        <section style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>
              Total Customers
            </span>

            <strong style={summaryValueStyle}>
              {customers.length}
            </strong>
          </div>

          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>
              Business Customers
            </span>

            <strong style={summaryValueStyle}>
              {businessCustomers}
            </strong>
          </div>

          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>
              Individual Customers
            </span>

            <strong style={summaryValueStyle}>
              {individualCustomers}
            </strong>
          </div>

          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>
              Opening Balance
            </span>

            <strong
              style={{
                ...summaryValueStyle,
                color: "#b45309",
              }}
            >
              Rs.{" "}
              {totalOpeningBalance.toFixed(2)}
            </strong>
          </div>
        </section>

        <div style={workspaceStyle}>
          <form
            onSubmit={handleSaveCustomer}
            style={formCardStyle}
          >
            <div style={formHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>
                  {editingCustomerId
                    ? "Edit Customer"
                    : "New Customer"}
                </h2>

                <p style={cardSubtitleStyle}>
                  Required customer information
                  enter karo.
                </p>
              </div>

              {editingCustomerId && (
                <span style={editBadgeStyle}>
                  Editing
                </span>
              )}
            </div>

            <div style={sectionBlockStyle}>
              <h3 style={sectionHeadingStyle}>
                Customer Type
              </h3>

              <div style={typeSelectorStyle}>
                <button
                  type="button"
                  onClick={() =>
                    setCustomerType(
                      "individual"
                    )
                  }
                  style={{
                    ...typeButtonStyle,
                    ...(customerType ===
                    "individual"
                      ? activeTypeButtonStyle
                      : {}),
                  }}
                >
                  <span style={typeIconStyle}>
                    👤
                  </span>

                  <span>
                    <strong>
                      Individual
                    </strong>

                    <small
                      style={typeHelperStyle}
                    >
                      Personal customer
                    </small>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCustomerType(
                      "business"
                    )
                  }
                  style={{
                    ...typeButtonStyle,
                    ...(customerType ===
                    "business"
                      ? activeTypeButtonStyle
                      : {}),
                  }}
                >
                  <span style={typeIconStyle}>
                    🏢
                  </span>

                  <span>
                    <strong>Business</strong>

                    <small
                      style={typeHelperStyle}
                    >
                      Company or organization
                    </small>
                  </span>
                </button>
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <h3 style={sectionHeadingStyle}>
                Basic Information
              </h3>

              {customerType ===
              "individual" ? (
                <div style={twoColumnStyle}>
                  <div>
                    <label style={labelStyle}>
                      First Name *
                    </label>

                    <input
                      value={firstName}
                      onChange={(event) =>
                        setFirstName(
                          event.target.value
                        )
                      }
                      placeholder="First name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Last Name
                    </label>

                    <input
                      value={lastName}
                      onChange={(event) =>
                        setLastName(
                          event.target.value
                        )
                      }
                      placeholder="Last name"
                      style={inputStyle}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>
                    Company Name *
                  </label>

                  <input
                    value={companyName}
                    onChange={(event) =>
                      setCompanyName(
                        event.target.value
                      )
                    }
                    placeholder="Company name"
                    style={inputStyle}
                  />
                </div>
              )}

              <label style={labelStyle}>
                Display Name *
              </label>

              <input
                value={displayName}
                onChange={(event) =>
                  setDisplayName(
                    event.target.value
                  )
                }
                placeholder="Name shown on invoices"
                style={inputStyle}
              />
            </div>

            <div style={sectionBlockStyle}>
              <h3 style={sectionHeadingStyle}>
                Contact Details
              </h3>

              <label style={labelStyle}>
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="customer@email.com"
                style={inputStyle}
              />

              <div style={twoColumnStyle}>
                <div>
                  <label style={labelStyle}>
                    Mobile Number
                  </label>

                  <input
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target.value
                      )
                    }
                    placeholder="03XXXXXXXXX"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Alternate Phone
                  </label>

                  <input
                    value={alternatePhone}
                    onChange={(event) =>
                      setAlternatePhone(
                        event.target.value
                      )
                    }
                    placeholder="Alternate number"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
            <div style={sectionBlockStyle}>
              <h3 style={sectionHeadingStyle}>
                Business Details
              </h3>

              <label style={labelStyle}>
                Address
              </label>

              <textarea
                value={address}
                onChange={(event) =>
                  setAddress(event.target.value)
                }
                placeholder="Complete customer address"
                rows={4}
                style={{
                  ...textareaStyle,
                  resize: "vertical",
                }}
              />

              <div style={twoColumnStyle}>
                <div>
                  <label style={labelStyle}>
                    NTN / Tax Number
                  </label>

                  <input
                    value={taxNumber}
                    onChange={(event) =>
                      setTaxNumber(
                        event.target.value
                      )
                    }
                    placeholder="Tax number"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Credit Limit
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={creditLimit}
                    onChange={(event) =>
                      setCreditLimit(
                        event.target.value
                      )
                    }
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
              </div>

              <label style={labelStyle}>
                Opening Balance
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(event) =>
                  setOpeningBalance(
                    event.target.value
                  )
                }
                placeholder="0"
                style={inputStyle}
              />

              <label style={labelStyle}>
                Notes
              </label>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Customer remarks or notes"
                rows={4}
                style={{
                  ...textareaStyle,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={formActionsStyle}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...primaryButtonStyle,
                  opacity: saving ? 0.6 : 1,
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {saving
                  ? "Saving..."
                  : editingCustomerId
                    ? "Update Customer"
                    : "Save Customer"}
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
            </div>
          </form>

          <section style={listCardStyle}>
            <div style={listHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>
                  Customer Directory
                </h2>

                <p style={cardSubtitleStyle}>
                  Search, filter, edit aur customer
                  profile manage karo.
                </p>
              </div>

              <span style={recordBadgeStyle}>
                {filteredCustomers.length} Records
              </span>
            </div>

            <div style={filterBarStyle}>
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search name, phone, email or NTN..."
                style={searchInputStyle}
              />

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value
                  )
                }
                style={filterSelectStyle}
              >
                <option value="all">
                  All Types
                </option>

                <option value="individual">
                  Individual
                </option>

                <option value="business">
                  Business
                </option>
              </select>
            </div>

            {filteredCustomers.length === 0 ? (
              <div style={emptyStateStyle}>
                <div style={emptyIconStyle}>
                  👥
                </div>

                <h3 style={emptyTitleStyle}>
                  Koi customer nahi mila
                </h3>

                <p style={emptyTextStyle}>
                  New Customer form se customer add
                  karo.
                </p>
              </div>
            ) : (
              <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th
                        style={firstTableHeaderStyle}
                      >
                        Customer
                      </th>

                      <th style={tableHeaderStyle}>
                        Type
                      </th>

                      <th style={tableHeaderStyle}>
                        Contact
                      </th>

                      <th style={tableHeaderStyle}>
                        NTN
                      </th>

                      <th
                        style={amountHeaderStyle}
                      >
                        Opening
                      </th>

                      <th
                        style={amountHeaderStyle}
                      >
                        Credit Limit
                      </th>

                      <th
                        style={actionHeaderStyle}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCustomers.map(
                      (customer) => (
                        <tr key={customer.id}>
                          <td
                            style={
                              firstTableCellStyle
                            }
                          >
                            <div
                              style={
                                customerCellStyle
                              }
                            >
                              <span
                                style={
                                  customerAvatarStyle
                                }
                              >
                                {getCustomerInitial(
                                  customer
                                )}
                              </span>

                              <div
                                style={
                                  customerInfoStyle
                                }
                              >
                                <strong
                                  style={
                                    customerNameStyle
                                  }
                                >
                                  {customer.display_name ||
                                    customer.name}
                                </strong>

                                <span
                                  style={
                                    customerSubTextStyle
                                  }
                                >
                                  {customer.company_name ||
                                    [
                                      customer.first_name,
                                      customer.last_name,
                                    ]
                                      .filter(Boolean)
                                      .join(" ") ||
                                    "-"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td style={tableCellStyle}>
                            <span
                              style={getCustomerTypeStyle(
                                customer.customer_type
                              )}
                            >
                              {getCustomerTypeText(
                                customer.customer_type
                              )}
                            </span>
                          </td>

                          <td style={tableCellStyle}>
                            <div
                              style={
                                contactStackStyle
                              }
                            >
                              <span>
                                {customer.phone ||
                                  "No phone"}
                              </span>

                              <small
                                style={
                                  contactSubTextStyle
                                }
                              >
                                {customer.email ||
                                  "No email"}
                              </small>
                            </div>
                          </td>

                          <td style={tableCellStyle}>
                            {customer.tax_number ||
                              "-"}
                          </td>

                          <td
                            style={amountCellStyle}
                          >
                            Rs.{" "}
                            {Number(
                              customer.opening_balance ||
                                0
                            ).toFixed(2)}
                          </td>

                          <td
                            style={amountCellStyle}
                          >
                            Rs.{" "}
                            {Number(
                              customer.credit_limit ||
                                0
                            ).toFixed(2)}
                          </td>

                          <td
                            style={actionCellStyle}
                          >
                            <div
                              style={
                                actionButtonsStyle
                              }
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    "/customer_Ledger"
                                  )
                                }
                                style={
                                  ledgerButtonStyle
                                }
                              >
                                Ledger
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleEditCustomer(
                                    customer
                                  )
                                }
                                style={editButtonStyle}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteCustomer(
                                    customer
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  customer.id
                                }
                                style={{
                                  ...deleteButtonStyle,
                                  opacity:
                                    deletingId ===
                                    customer.id
                                      ? 0.6
                                      : 1,
                                  cursor:
                                    deletingId ===
                                    customer.id
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                {deletingId ===
                                customer.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
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
const pageStyle: CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  padding: "32px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#172033",
};

const containerStyle: CSSProperties = {
  maxWidth: "1500px",
  margin: "0 auto",
};

const loadingStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f4f7fb",
  color: "#475467",
  fontFamily: "Arial, sans-serif",
};

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "20px",
};

const backButtonStyle: CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  color: "#2563eb",
  padding: 0,
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
};

const newCustomerButtonStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0 16px",
  border: "none",
  borderRadius: "9px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "700",
};

const headingRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "24px",
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "30px",
};

const pageDescriptionStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#667085",
  fontSize: "14px",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const summaryCardStyle: CSSProperties = {
  padding: "20px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  boxShadow:
    "0 5px 18px rgba(16,24,40,0.05)",
};

const summaryLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "8px",
  color: "#667085",
  fontSize: "12px",
  fontWeight: "600",
};

const summaryValueStyle: CSSProperties = {
  color: "#101828",
  fontSize: "23px",
};

const workspaceStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(360px, 430px) minmax(0, 1fr)",
  gap: "24px",
  alignItems: "start",
};

const formCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "16px",
  boxShadow:
    "0 8px 24px rgba(16,24,40,0.06)",
  overflow: "hidden",
};

const listCardStyle: CSSProperties = {
  minWidth: 0,
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "16px",
  boxShadow:
    "0 8px 24px rgba(16,24,40,0.06)",
  overflow: "hidden",
};

const formHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "22px 24px",
  borderBottom: "1px solid #eaecf0",
};

const listHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "22px 24px",
  borderBottom: "1px solid #eaecf0",
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "19px",
};

const cardSubtitleStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "12px",
};

const editBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "11px",
  fontWeight: "700",
};

const sectionBlockStyle: CSSProperties = {
  padding: "22px 24px",
  borderBottom: "1px solid #f2f4f7",
};

const sectionHeadingStyle: CSSProperties = {
  margin: "0 0 16px",
  color: "#344054",
  fontSize: "14px",
};

const typeSelectorStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
};

const typeButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  minHeight: "74px",
  padding: "13px",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  backgroundColor: "#ffffff",
  color: "#344054",
  textAlign: "left",
  cursor: "pointer",
};

const activeTypeButtonStyle: CSSProperties = {
  borderColor: "#2563eb",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
};

const typeIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "9px",
  backgroundColor: "#f8fafc",
  fontSize: "18px",
};

const typeHelperStyle: CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "#667085",
  fontSize: "10px",
  fontWeight: "400",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "7px",
  color: "#344054",
  fontSize: "12px",
  fontWeight: "700",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 12px",
  marginBottom: "16px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontSize: "14px",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  padding: "12px",
  marginBottom: "16px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  outline: "none",
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "14px",
};

const formActionsStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  padding: "22px 24px",
};

const primaryButtonStyle: CSSProperties = {
  flex: 1,
  minHeight: "44px",
  border: "none",
  borderRadius: "9px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
};

const cancelButtonStyle: CSSProperties = {
  minWidth: "120px",
  minHeight: "44px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  backgroundColor: "#ffffff",
  color: "#344054",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "700",
};

const recordBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "11px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const filterBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 170px",
  gap: "12px",
  padding: "16px 20px",
  borderBottom: "1px solid #eaecf0",
  backgroundColor: "#f8fafc",
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  height: "42px",
  padding: "0 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
  fontSize: "13px",
  outline: "none",
};

const filterSelectStyle: CSSProperties = {
  width: "100%",
  height: "42px",
  padding: "0 10px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontSize: "13px",
  outline: "none",
};

const emptyStateStyle: CSSProperties = {
  padding: "70px 24px",
  textAlign: "center",
};

const emptyIconStyle: CSSProperties = {
  marginBottom: "12px",
  fontSize: "36px",
};

const emptyTitleStyle: CSSProperties = {
  margin: 0,
  color: "#344054",
  fontSize: "17px",
};

const emptyTextStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#667085",
  fontSize: "12px",
};

const tableWrapperStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "1050px",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const tableHeaderStyle: CSSProperties = {
  padding: "13px 14px",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
  color: "#667085",
  textAlign: "left",
  fontSize: "10px",
  fontWeight: "700",
  textTransform: "uppercase",
};

const firstTableHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  paddingLeft: "22px",
};

const amountHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "right",
};

const actionHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "center",
  paddingRight: "22px",
};

const tableCellStyle: CSSProperties = {
  padding: "15px 14px",
  borderBottom: "1px solid #f2f4f7",
  color: "#475467",
  fontSize: "12px",
  verticalAlign: "middle",
};

const firstTableCellStyle: CSSProperties = {
  ...tableCellStyle,
  paddingLeft: "22px",
};

const amountCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: "right",
  color: "#101828",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const actionCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: "center",
  paddingRight: "22px",
};

const customerCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
};

const customerAvatarStyle: CSSProperties = {
  width: "38px",
  height: "38px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "50%",
  backgroundColor: "#dbeafe",
  color: "#1d4ed8",
  fontWeight: "700",
};

const customerInfoStyle: CSSProperties = {
  minWidth: 0,
};

const customerNameStyle: CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: "13px",
};

const customerSubTextStyle: CSSProperties = {
  display: "block",
  marginTop: "4px",
  maxWidth: "180px",
  overflow: "hidden",
  color: "#98a2b3",
  fontSize: "10px",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const contactStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const contactSubTextStyle: CSSProperties = {
  color: "#98a2b3",
  fontSize: "10px",
};

const businessBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: "999px",
  backgroundColor: "#fef3c7",
  color: "#b45309",
  fontSize: "10px",
  fontWeight: "700",
};

const individualBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: "999px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "10px",
  fontWeight: "700",
};

const actionButtonsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "7px",
};

const ledgerButtonStyle: CSSProperties = {
  border: "1px solid #a7f3d0",
  borderRadius: "7px",
  padding: "7px 9px",
  backgroundColor: "#ecfdf3",
  color: "#047857",
  cursor: "pointer",
  fontSize: "10px",
  fontWeight: "700",
};

const editButtonStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: "7px",
  padding: "7px 9px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: "10px",
  fontWeight: "700",
};

const deleteButtonStyle: CSSProperties = {
  border: "1px solid #fecaca",
  borderRadius: "7px",
  padding: "7px 9px",
  backgroundColor: "#fff1f2",
  color: "#be123c",
  fontSize: "10px",
  fontWeight: "700",
};