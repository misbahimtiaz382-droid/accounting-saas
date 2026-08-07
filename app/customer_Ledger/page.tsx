"use client";

import {
  CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  opening_balance: number | null;
};

type Sale = {
  id: string;
  customer_id: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_balance: number | null;
  payment_status: string | null;
  payment_method: string | null;
  due_date: string | null;
  created_at: string;
};

type LedgerCustomer = Customer & {
  totalSales: number;
  totalPaid: number;
  totalRemaining: number;
  invoiceCount: number;
};

export default function CustomerLedgerPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] =
    useState("");
  const [search, setSearch] = useState("");

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

    await Promise.all([
      loadCustomers(currentCompanyId),
      loadSales(currentCompanyId),
    ]);

    setLoading(false);
  }

  async function loadCustomers(
    currentCompanyId: string
  ) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, email, phone, opening_balance")
      .eq("company_id", currentCompanyId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers((data as Customer[]) || []);
  }

  async function loadSales(
    currentCompanyId: string
  ) {
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        customer_id,
        invoice_number,
        total_amount,
        paid_amount,
        remaining_balance,
        payment_status,
        payment_method,
        due_date,
        created_at
      `)
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSales((data as Sale[]) || []);
  }

  const ledgerCustomers = useMemo(() => {
    return customers.map((customer) => {
      const customerSales = sales.filter(
        (sale) =>
          sale.customer_id === customer.id
      );

      const totalSales = customerSales.reduce(
        (sum, sale) =>
          sum + Number(sale.total_amount || 0),
        0
      );

      const totalPaid = customerSales.reduce(
        (sum, sale) =>
          sum + Number(sale.paid_amount || 0),
        0
      );

     const totalRemaining =
  Number(customer.opening_balance || 0) +
  customerSales.reduce(
    (sum, sale) =>
      sum + Number(sale.remaining_balance || 0),
    0
  );

      return {
        ...customer,
        totalSales,
        totalPaid,
        totalRemaining,
        invoiceCount: customerSales.length,
      };
    });
  }, [customers, sales]);

  const filteredCustomers = useMemo(() => {
    const searchText = search
      .trim()
      .toLowerCase();

    if (!searchText) {
      return ledgerCustomers;
    }

    return ledgerCustomers.filter((customer) => {
      return (
        customer.name
          .toLowerCase()
          .includes(searchText) ||
        (customer.phone || "")
          .toLowerCase()
          .includes(searchText) ||
        (customer.email || "")
          .toLowerCase()
          .includes(searchText)
      );
    });
  }, [ledgerCustomers, search]);

  const selectedCustomer =
    ledgerCustomers.find(
      (customer) =>
        customer.id === selectedCustomerId
    ) || null;

  const selectedCustomerSales = sales.filter(
    (sale) =>
      sale.customer_id === selectedCustomerId
  );

  const overallSales = ledgerCustomers.reduce(
    (sum, customer) =>
      sum + customer.totalSales,
    0
  );

  const overallPaid = ledgerCustomers.reduce(
    (sum, customer) =>
      sum + customer.totalPaid,
    0
  );

  const overallRemaining =
    ledgerCustomers.reduce(
      (sum, customer) =>
        sum + customer.totalRemaining,
      0
    );

  function getStatusText(
    status: string | null
  ) {
    if (status === "paid") return "Paid";
    if (status === "partial") return "Partial";
    return "Unpaid";
  }

  function getStatusStyle(
    status: string | null
  ) {
    if (status === "paid") {
      return paidStatusStyle;
    }

    if (status === "partial") {
      return partialStatusStyle;
    }

    return unpaidStatusStyle;
  }

  function getPaymentMethodText(
    method: string | null
  ) {
    const methods: Record<string, string> = {
      cash: "Cash",
      bank_transfer: "Bank Transfer",
      card: "Card",
      jazzcash: "JazzCash",
      easypaisa: "EasyPaisa",
      cheque: "Cheque",
      other: "Other",
    };

    return methods[method || ""] || "-";
  }

  function handlePrintLedger() {
    if (!selectedCustomer) {
      alert("Customer select karo.");
      return;
    }

    window.print();
  }

  if (loading) {
    return (
      <main style={loadingStyle}>
        Loading customer ledger...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div
          className="ledger-actions"
          style={topActionStyle}
        >
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
            onClick={handlePrintLedger}
            disabled={!selectedCustomer}
            style={{
              ...printButtonStyle,
              opacity: selectedCustomer
                ? 1
                : 0.5,
              cursor: selectedCustomer
                ? "pointer"
                : "not-allowed",
            }}
          >
            Print Ledger
          </button>
        </div>

        <div style={headerStyle}>
          <div>
            <h1 style={pageTitleStyle}>
              Customer Ledger
            </h1>

            <p style={pageDescriptionStyle}>
              Customer sales, payments aur remaining
              balance check karo.
            </p>
          </div>
        </div>

        <div style={summaryGridStyle}>
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
              Total Sales
            </span>

            <strong style={summaryValueStyle}>
              Rs. {overallSales.toFixed(2)}
            </strong>
          </div>

          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>
              Total Received
            </span>

            <strong
              style={{
                ...summaryValueStyle,
                color: "#15803d",
              }}
            >
              Rs. {overallPaid.toFixed(2)}
            </strong>
          </div>

          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>
              Total Receivable
            </span>

            <strong
              style={{
                ...summaryValueStyle,
                color: "#b45309",
              }}
            >
              Rs. {overallRemaining.toFixed(2)}
            </strong>
          </div>
        </div>

        <div style={workspaceStyle}>
          <section
            className="customer-list-panel"
            style={customerListCardStyle}
          >
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>
                  Customers
                </h2>

                <p style={cardSubtitleStyle}>
                  Ledger open karne ke liye customer
                  select karo.
                </p>
              </div>

              <span style={recordBadgeStyle}>
                {filteredCustomers.length}
              </span>
            </div>

            <div style={searchWrapperStyle}>
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search customer..."
                style={searchInputStyle}
              />
            </div>

            <div style={customerListStyle}>
              {filteredCustomers.length === 0 ? (
                <div style={emptyStateStyle}>
                  Koi customer nahi mila.
                </div>
              ) : (
                filteredCustomers.map(
                  (customer) => {
                    const selected =
                      selectedCustomerId ===
                      customer.id;

                    return (
                      <button
                        type="button"
                        key={customer.id}
                        onClick={() =>
                          setSelectedCustomerId(
                            customer.id
                          )
                        }
                        style={{
                          ...customerButtonStyle,
                          ...(selected
                            ? selectedCustomerStyle
                            : {}),
                        }}
                      >
                        <div
                          style={
                            customerAvatarStyle
                          }
                        >
                          {customer.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div
                          style={
                            customerButtonInfoStyle
                          }
                        >
                          <strong
                            style={
                              customerNameStyle
                            }
                          >
                            {customer.name}
                          </strong>

                          <span
                            style={
                              customerMetaStyle
                            }
                          >
                            {
                              customer.invoiceCount
                            }{" "}
                            invoices
                          </span>
                        </div>

                        <div
                          style={
                            customerBalanceStyle
                          }
                        >
                          <span
                            style={
                              balanceLabelStyle
                            }
                          >
                            Balance
                          </span>

                          <strong
                            style={{
                              color:
                                customer.totalRemaining >
                                0
                                  ? "#b45309"
                                  : "#15803d",
                            }}
                          >
                            Rs.{" "}
                            {customer.totalRemaining.toFixed(
                              2
                            )}
                          </strong>
                        </div>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </section>

          <section style={ledgerCardStyle}>
            {!selectedCustomer ? (
              <div style={emptyLedgerStyle}>
                <div style={emptyIconStyle}>
                  📒
                </div>

                <h2 style={emptyTitleStyle}>
                  Customer select karo
                </h2>

                <p style={emptyTextStyle}>
                  Left side customer select karne ke
                  baad uska complete ledger yahan
                  nazar ayega.
                </p>
              </div>
            ) : (
              <>
                <div style={ledgerHeaderStyle}>
                  <div style={customerHeadingStyle}>
                    <div
                      style={
                        largeCustomerAvatarStyle
                      }
                    >
                      {selectedCustomer.name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div>
                      <h2
                        style={
                          selectedCustomerNameStyle
                        }
                      >
                        {selectedCustomer.name}
                      </h2>

                      <p
                        style={
                          selectedCustomerContactStyle
                        }
                      >
                        {selectedCustomer.phone ||
                          "No phone"}
                        {" • "}
                        {selectedCustomer.email ||
                          "No email"}
                      </p>
                    </div>
                  </div>

                  <span style={ledgerBadgeStyle}>
                    Customer Ledger
                  </span>
                </div>

                <div
                  style={
                    customerSummaryGridStyle
                  }
                >
                  <div
                    style={
                      customerSummaryBoxStyle
                    }
                  >
                    <span
                      style={
                        customerSummaryLabelStyle
                      }
                    >
                      Total Sales
                    </span>

                    <strong
                      style={
                        customerSummaryValueStyle
                      }
                    >
                      Rs.{" "}
                      {selectedCustomer.totalSales.toFixed(
                        2
                      )}
                    </strong>
                  </div>

                  <div
                    style={
                      customerSummaryBoxStyle
                    }
                  >
                    <span
                      style={
                        customerSummaryLabelStyle
                      }
                    >
                      Total Paid
                    </span>

                    <strong
                      style={{
                        ...customerSummaryValueStyle,
                        color: "#15803d",
                      }}
                    >
                      Rs.{" "}
                      {selectedCustomer.totalPaid.toFixed(
                        2
                      )}
                    </strong>
                  </div>

                  <div
                    style={
                      customerSummaryBoxStyle
                    }
                  >
                    <span
                      style={
                        customerSummaryLabelStyle
                      }
                    >
                      Remaining
                    </span>

                    <strong
                      style={{
                        ...customerSummaryValueStyle,
                        color: "#b45309",
                      }}
                    >
                      Rs.{" "}
                      {selectedCustomer.totalRemaining.toFixed(
                        2
                      )}
                    </strong>
                  </div>

                  <div
                    style={
                      customerSummaryBoxStyle
                    }
                  >
                    <span
                      style={
                        customerSummaryLabelStyle
                      }
                    >
                      Invoices
                    </span>

                    <strong
                      style={
                        customerSummaryValueStyle
                      }
                    >
                      {
                        selectedCustomer.invoiceCount
                      }
                    </strong>
                  </div>
                </div>

                <div style={tableWrapperStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th
                          style={
                            firstTableHeaderStyle
                          }
                        >
                          Date
                        </th>

                        <th
                          style={
                            tableHeaderStyle
                          }
                        >
                          Invoice
                        </th>

                        <th
                          style={
                            amountHeaderStyle
                          }
                        >
                          Total
                        </th>

                        <th
                          style={
                            amountHeaderStyle
                          }
                        >
                          Paid
                        </th>

                        <th
                          style={
                            amountHeaderStyle
                          }
                        >
                          Remaining
                        </th>

                        <th
                          style={
                            tableHeaderStyle
                          }
                        >
                          Method
                        </th>

                        <th
                          style={
                            tableHeaderStyle
                          }
                        >
                          Status
                        </th>

                        <th
                          style={
                            tableHeaderStyle
                          }
                        >
                          Due Date
                        </th>

                        <th
                          className="ledger-actions"
                          style={
                            actionHeaderStyle
                          }
                        >
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedCustomerSales.length ===
                      0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            style={
                              emptyTableCellStyle
                            }
                          >
                            Is customer ki koi sale
                            nahi hai.
                          </td>
                        </tr>
                      ) : (
                        selectedCustomerSales.map(
                          (sale) => (
                            <tr key={sale.id}>
                              <td
                                style={
                                  firstTableCellStyle
                                }
                              >
                                {new Date(
                                  sale.created_at
                                ).toLocaleDateString()}
                              </td>

                              <td
                                style={tableCellStyle}
                              >
                                <span
                                  style={
                                    invoiceBadgeStyle
                                  }
                                >
                                  {sale.invoice_number ||
                                    "-"}
                                </span>
                              </td>

                              <td
                                style={
                                  amountCellStyle
                                }
                              >
                                Rs.{" "}
                                {Number(
                                  sale.total_amount ||
                                    0
                                ).toFixed(2)}
                              </td>

                              <td
                                style={
                                  amountCellStyle
                                }
                              >
                                Rs.{" "}
                                {Number(
                                  sale.paid_amount ||
                                    0
                                ).toFixed(2)}
                              </td>

                              <td
                                style={
                                  amountCellStyle
                                }
                              >
                                Rs.{" "}
                                {Number(
                                  sale.remaining_balance ||
                                    0
                                ).toFixed(2)}
                              </td>

                              <td
                                style={tableCellStyle}
                              >
                                {getPaymentMethodText(
                                  sale.payment_method
                                )}
                              </td>

                              <td
                                style={tableCellStyle}
                              >
                                <span
                                  style={getStatusStyle(
                                    sale.payment_status
                                  )}
                                >
                                  {getStatusText(
                                    sale.payment_status
                                  )}
                                </span>
                              </td>

                              <td
                                style={tableCellStyle}
                              >
                                {sale.due_date
                                  ? new Date(
                                      sale.due_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>

                              <td
                                className="ledger-actions"
                                style={
                                  actionCellStyle
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    router.push(
                                      "/invoices/" +
                                        sale.id
                                    )
                                  }
                                  style={
                                    invoiceButtonStyle
                                  }
                                >
                                  View Invoice
                                </button>
                              </td>
                            </tr>
                          )
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
          }

          .ledger-actions,
          .customer-list-panel {
            display: none !important;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `}</style>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "32px",
  backgroundColor: "#f4f7fb",
  color: "#172033",
  fontFamily: "Arial, Helvetica, sans-serif",
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

const topActionStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "20px",
};

const backButtonStyle: CSSProperties = {
  border: "none",
  padding: 0,
  backgroundColor: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
};

const printButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: "8px",
  padding: "11px 17px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontWeight: "700",
};

const headerStyle: CSSProperties = {
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
  fontSize: "15px",
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
  fontSize: "13px",
};

const summaryValueStyle: CSSProperties = {
  color: "#101828",
  fontSize: "23px",
};

const workspaceStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "330px minmax(0, 1fr)",
  gap: "24px",
  alignItems: "start",
};

const customerListCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "16px",
  boxShadow:
    "0 8px 24px rgba(16,24,40,0.06)",
  overflow: "hidden",
};

const ledgerCardStyle: CSSProperties = {
  minHeight: "560px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "16px",
  boxShadow:
    "0 8px 24px rgba(16,24,40,0.06)",
  overflow: "hidden",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "20px",
  borderBottom: "1px solid #eaecf0",
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "18px",
};

const cardSubtitleStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#667085",
  fontSize: "12px",
};

const recordBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: "700",
};

const searchWrapperStyle: CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #eaecf0",
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  height: "42px",
  padding: "0 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  boxSizing: "border-box",
  fontSize: "14px",
  outline: "none",
};

const customerListStyle: CSSProperties = {
  maxHeight: "650px",
  overflowY: "auto",
};

const customerButtonStyle: CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns:
    "42px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "12px",
  padding: "14px",
  border: "none",
  borderBottom: "1px solid #f2f4f7",
  backgroundColor: "#ffffff",
  textAlign: "left",
  cursor: "pointer",
};

const selectedCustomerStyle: CSSProperties = {
  backgroundColor: "#eff6ff",
  borderLeft: "4px solid #2563eb",
};

const customerAvatarStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  backgroundColor: "#dbeafe",
  color: "#1d4ed8",
  fontWeight: "700",
};

const customerButtonInfoStyle: CSSProperties = {
  minWidth: 0,
};

const customerNameStyle: CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: "14px",
};

const customerMetaStyle: CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "#667085",
  fontSize: "11px",
};

const customerBalanceStyle: CSSProperties = {
  textAlign: "right",
  fontSize: "12px",
  whiteSpace: "nowrap",
};

const balanceLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  color: "#667085",
  fontSize: "10px",
};

const emptyStateStyle: CSSProperties = {
  padding: "40px 20px",
  color: "#667085",
  textAlign: "center",
  fontSize: "13px",
};

const emptyLedgerStyle: CSSProperties = {
  minHeight: "560px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "30px",
  textAlign: "center",
};

const emptyIconStyle: CSSProperties = {
  marginBottom: "14px",
  fontSize: "42px",
};

const emptyTitleStyle: CSSProperties = {
  margin: 0,
  color: "#344054",
  fontSize: "20px",
};

const emptyTextStyle: CSSProperties = {
  maxWidth: "400px",
  margin: "9px auto 0",
  color: "#667085",
  fontSize: "14px",
  lineHeight: 1.6,
};

const ledgerHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "24px",
  borderBottom: "1px solid #eaecf0",
};

const customerHeadingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
};

const largeCustomerAvatarStyle: CSSProperties = {
  width: "52px",
  height: "52px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  backgroundColor: "#dbeafe",
  color: "#1d4ed8",
  fontSize: "21px",
  fontWeight: "700",
};

const selectedCustomerNameStyle: CSSProperties = {
  margin: 0,
  color: "#101828",
  fontSize: "21px",
};

const selectedCustomerContactStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const ledgerBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "7px 11px",
  borderRadius: "999px",
  backgroundColor: "#f2f4f7",
  color: "#475467",
  fontSize: "12px",
  fontWeight: "700",
};

const customerSummaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "14px",
  padding: "20px 24px",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
};

const customerSummaryBoxStyle: CSSProperties = {
  padding: "14px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
};

const customerSummaryLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "6px",
  color: "#667085",
  fontSize: "11px",
};

const customerSummaryValueStyle: CSSProperties = {
  color: "#101828",
  fontSize: "17px",
};

const tableWrapperStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "1100px",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const tableHeaderStyle: CSSProperties = {
  padding: "13px 15px",
  backgroundColor: "#ffffff",
  borderBottom: "1px solid #eaecf0",
  color: "#475467",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: "700",
  textTransform: "uppercase",
};

const firstTableHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  paddingLeft: "24px",
};

const amountHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "right",
};

const actionHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: "center",
  paddingRight: "24px",
};

const tableCellStyle: CSSProperties = {
  padding: "15px",
  borderBottom: "1px solid #f2f4f7",
  color: "#475467",
  fontSize: "13px",
  verticalAlign: "middle",
};

const firstTableCellStyle: CSSProperties = {
  ...tableCellStyle,
  paddingLeft: "24px",
  whiteSpace: "nowrap",
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
  paddingRight: "24px",
};

const emptyTableCellStyle: CSSProperties = {
  ...tableCellStyle,
  padding: "45px 20px",
  textAlign: "center",
  color: "#667085",
};

const invoiceBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: "7px",
  backgroundColor: "#f2f4f7",
  color: "#344054",
  fontSize: "11px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const invoiceButtonStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: "7px",
  padding: "7px 10px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const paidStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#dcfce7",
  color: "#15803d",
  fontSize: "11px",
  fontWeight: "700",
};

const partialStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#fef3c7",
  color: "#b45309",
  fontSize: "11px",
  fontWeight: "700",
};

const unpaidStatusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
  fontSize: "11px",
  fontWeight: "700",
};