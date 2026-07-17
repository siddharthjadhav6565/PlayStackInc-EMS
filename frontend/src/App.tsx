import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

axios.defaults.baseURL = "https://playstackinc-ems.onrender.com/api";

type Role = "SUPER_ADMIN" | "HR_MANAGER" | "EMPLOYEE";
type Status = "ACTIVE" | "INACTIVE";
type Theme = "light" | "dark" | "system";

type User = {
  id: string;
  employeeId?: string;
  name: string;
  email: string;
  role: Role;
};

type Employee = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  salary: string | number;
  joiningDate: string;
  profileImage?: string | null;
  role: Role;
  status: Status;
  managerId?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
};

type Stats = {
  total: number;
  active: number;
  inactive: number;
  hrManagers: number;
  employees: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type EmployeeForm = {
  employeeId: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  department: string;
  designation: string;
  salary: string;
  joiningDate: string;
  profileImage: string;
  role: Role;
  status: Status;
  managerId: string;
};

type CsvImportResult = {
  created: number;
  failed: number;
  errors?: Array<{
    row: number;
    message: string;
  }>;
};

const emptyForm: EmployeeForm = {
  employeeId: "",
  name: "",
  email: "",
  password: "",
  phone: "",
  department: "",
  designation: "",
  salary: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  profileImage: "",
  role: "EMPLOYEE",
  status: "ACTIVE",
  managerId: "",
};

const ROLE_OPTIONS: Role[] = ["SUPER_ADMIN", "HR_MANAGER", "EMPLOYEE"];
const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE"];

const PIE_COLORS = ["#16a34a", "#f59e0b"];

function resolveTheme(theme: Theme) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return theme;
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (responseData?.errors?.length) {
      return responseData.errors
        .map((issue: { path?: string[]; message?: string }) => {
          const field = issue.path?.join(".") || "Field";
          return `${field}: ${issue.message || "Invalid value"}`;
        })
        .join(" | ");
    }

    return responseData?.message || "Request failed. Please try again.";
  }

  return "Something went wrong. Please try again.";
}

function formatDate(value?: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function downloadBlob(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("ems-theme");

    if (
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "system"
    ) {
      return savedTheme;
    }

    return "system";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(
    null
  );
  const [form, setForm] = useState<EmployeeForm>(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importResult, setImportResult] = useState<CsvImportResult | null>(
    null
  );

  const canManageEmployees =
    user?.role === "SUPER_ADMIN" || user?.role === "HR_MANAGER";

  const authConfig = () => ({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  useEffect(() => {
    const currentTheme = resolveTheme(theme);

    document.documentElement.classList.toggle("dark", currentTheme === "dark");
    document.documentElement.style.colorScheme = currentTheme;
    localStorage.setItem("ems-theme", theme);

    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const onSystemThemeChange = () => {
      const systemTheme = resolveTheme("system");
      document.documentElement.classList.toggle("dark", systemTheme === "dark");
      document.documentElement.style.colorScheme = systemTheme;
    };

    mediaQuery.addEventListener("change", onSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", onSystemThemeChange);
    };
  }, [theme]);

  const departments = useMemo(() => {
    return Array.from(
      new Set(employees.map((employee) => employee.department).filter(Boolean))
    ).sort();
  }, [employees]);

  const managers = useMemo(() => {
    return employees.filter(
      (employee) =>
        employee.role === "HR_MANAGER" ||
        employee.role === "SUPER_ADMIN"
    );
  }, [employees]);

  const departmentChartData = useMemo(() => {
    const counts = employees
      .filter((employee) => !employee.deletedAt)
      .reduce<Record<string, number>>((accumulator, employee) => {
        accumulator[employee.department] =
          (accumulator[employee.department] || 0) + 1;

        return accumulator;
      }, {});

    return Object.entries(counts)
      .map(([name, employees]) => ({
        name,
        employees,
      }))
      .sort((a, b) => b.employees - a.employees)
      .slice(0, 6);
  }, [employees]);

  const statusChartData = useMemo(() => {
    return [
      {
        name: "Active",
        value: stats?.active || 0,
      },
      {
        name: "Inactive",
        value: stats?.inactive || 0,
      },
    ];
  }, [stats]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginLoading(true);
    setError("");

    try {
      const { data } = await axios.post("/auth/login", {
        email,
        password,
      });

      setToken(data.token);
      setUser(data.user);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoginLoading(false);
    }
  }

  async function logout() {
    try {
      await axios.post("/auth/logout", {}, authConfig());
    } catch {
      // JWT is removed client-side even if the request fails.
    } finally {
      localStorage.clear();
      setToken("");
      setUser(null);
      setEmployees([]);
      setStats(null);
    }
  }

  async function loadDashboard() {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const [statsResponse, employeesResponse] = await Promise.all([
        axios.get("/employees/stats", authConfig()),
        axios.get("/employees", {
          ...authConfig(),
          params: {
            page,
            limit: 10,
            search,
            department,
            role,
            status,
            includeDeleted,
          },
        }),
      ]);

      setStats(statsResponse.data.data);
      setEmployees(employeesResponse.data.data);
      setPagination(employeesResponse.data.pagination);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    const searchTimeout = window.setTimeout(() => {
      loadDashboard();
    }, 250);

    return () => window.clearTimeout(searchTimeout);
  }, [
    token,
    page,
    search,
    department,
    role,
    status,
    includeDeleted,
  ]);

  function updateForm<K extends keyof EmployeeForm>(
    key: K,
    value: EmployeeForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function resetFilters() {
    setSearch("");
    setDepartment("");
    setRole("");
    setStatus("");
    setIncludeDeleted(false);
    setPage(1);
  }

  function openCreateModal() {
    setEditingEmployee(null);
    setForm(emptyForm);
    setError("");
    setShowEmployeeModal(true);
  }

  function openEditModal(employee: Employee) {
    setEditingEmployee(employee);

    setForm({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      password: "",
      phone: employee.phone || "",
      department: employee.department,
      designation: employee.designation,
      salary: String(employee.salary),
      joiningDate: employee.joiningDate.slice(0, 10),
      profileImage: employee.profileImage || "",
      role: employee.role,
      status: employee.status,
      managerId: employee.managerId || "",
    });

    setError("");
    setShowEmployeeModal(true);
  }

  function closeEmployeeModal() {
    if (submitting) return;

    setShowEmployeeModal(false);
    setEditingEmployee(null);
    setForm(emptyForm);
  }

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        employeeId: form.employeeId.trim(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
        department: form.department.trim(),
        designation: form.designation.trim(),
        salary: Number(form.salary),
        joiningDate: form.joiningDate,
        profileImage: form.profileImage.trim() || null,
        role: form.role,
        status: form.status,
        managerId: form.managerId || null,
      };

      if (editingEmployee) {
        await axios.put(
          `/employees/${editingEmployee.id}`,
          payload,
          authConfig()
        );

        setSuccess(`${form.name} updated successfully.`);
      } else {
        await axios.post("/employees", payload, authConfig());
        setSuccess(`${form.name} created successfully.`);
      }

      closeEmployeeModal();
      await loadDashboard();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(employee: Employee) {
    const nextStatus: Status =
      employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      await axios.patch(
        `/employees/${employee.id}/status`,
        { status: nextStatus },
        authConfig()
      );

      setSuccess(`${employee.name} is now ${nextStatus.toLowerCase()}.`);
      await loadDashboard();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  async function softDeleteEmployee(employee: Employee) {
    const confirmed = window.confirm(
      `Soft delete ${employee.name}? The record can be restored later.`
    );

    if (!confirmed) return;

    try {
      await axios.delete(`/employees/${employee.id}`, authConfig());

      setSuccess(`${employee.name} was moved to deleted records.`);

      if (employees.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        await loadDashboard();
      }
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  async function restoreEmployee(employee: Employee) {
    try {
      await axios.patch(
        `/employees/${employee.id}/restore`,
        {},
        authConfig()
      );

      setSuccess(`${employee.name} restored successfully.`);
      await loadDashboard();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  function exportEmployees() {
    const headers = [
      "Employee ID",
      "Name",
      "Email",
      "Phone",
      "Department",
      "Designation",
      "Salary",
      "Joining Date",
      "Role",
      "Status",
      "Manager ID",
      "Profile Image",
      "Deleted",
    ];

    const rows = employees.map((employee) => [
      employee.employeeId,
      employee.name,
      employee.email,
      employee.phone,
      employee.department,
      employee.designation,
      employee.salary,
      employee.joiningDate,
      employee.role,
      employee.status,
      employee.managerId || "",
      employee.profileImage || "",
      employee.deletedAt ? "YES" : "NO",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    downloadBlob(
      `employees-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  }

  function downloadCsvTemplate() {
    const headers = [
      "employeeId",
      "name",
      "email",
      "password",
      "phone",
      "department",
      "designation",
      "salary",
      "joiningDate",
      "role",
      "status",
      "managerId",
      "profileImage",
    ];

    const sample = [
      "EMP-1001",
      "Aarav Sharma",
      "aarav@company.com",
      "TempPass123",
      "+919876543210",
      "Engineering",
      "Software Engineer",
      "65000",
      "2026-07-17",
      "EMPLOYEE",
      "ACTIVE",
      "",
      "",
    ];

    const csv = [headers, sample]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    downloadBlob(
      "employee-import-template.csv",
      csv,
      "text/csv;charset=utf-8"
    );
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a valid CSV file.");
      return;
    }

    setImporting(true);
    setImportResult(null);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post("/employees/import", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setImportResult(response.data.data);
      setSuccess(
        `${response.data.data.created} employee record(s) imported successfully.`
      );

      await loadDashboard();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#f4f4f0] p-4 text-[#111111] transition-colors duration-300 dark:bg-[#0a0a0a] dark:text-[#f4f4f0] sm:p-8">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md items-center sm:min-h-[calc(100vh-4rem)]">
          <form
            onSubmit={login}
            className="w-full border border-[#111111]/20 bg-white p-6 shadow-[8px_8px_0_#111111] transition-colors duration-300 dark:border-white/20 dark:bg-[#111111] dark:shadow-[8px_8px_0_#f4f4f0] sm:p-8"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.22em] text-[#ff5a36] uppercase">
                  EMS / Secure Access
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                  Sign in to the registry.
                </h1>
              </div>

              <ThemeSelector theme={theme} onChange={setTheme} compact />
            </div>

            <p className="mb-6 text-sm leading-6 text-[#666666] dark:text-white/55">
              Manage employee records, roles, teams, imports, and organization
              activity.
            </p>

            {error && <Alert type="error" message={error} onClose={() => setError("")} />}

            <div className="mt-5 space-y-4">
              <FieldLabel label="Email">
                <input
                  required
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClassName}
                />
              </FieldLabel>

              <FieldLabel label="Password">
                <input
                  required
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClassName}
                />
              </FieldLabel>

              <button
                disabled={loginLoading}
                className="w-full bg-[#111111] px-4 py-3 text-sm font-bold text-[#f4f4f0] transition-colors hover:bg-[#ff5a36] hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#f4f4f0] dark:text-[#111111]"
              >
                {loginLoading ? "Signing in..." : "Login"}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f4f0] px-4 py-5 text-[#111111] transition-colors duration-300 dark:bg-[#0a0a0a] dark:text-[#f4f4f0] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border border-[#111111] bg-[#111111] p-5 text-[#f4f4f0] transition-colors duration-300 dark:border-white/20 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-[#ff5a36] uppercase">
                EMS / Operations Registry
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                Employee Management
              </h1>

              <p className="mt-2 text-sm text-white/60">
                Signed in as{" "}
                <span className="font-semibold text-white">{user?.name}</span>
                <span className="mx-2 text-white/25">/</span>
                {user?.role.replace("_", " ")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ThemeSelector theme={theme} onChange={setTheme} />

              <button
                onClick={exportEmployees}
                className="border border-white/25 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white hover:text-[#111111]"
              >
                Export CSV
              </button>

              {canManageEmployees && (
                <>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="border border-white/25 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white hover:text-[#111111]"
                  >
                    Import CSV
                  </button>

                  <button
                    onClick={openCreateModal}
                    className="border border-[#ff5a36] bg-[#ff5a36] px-4 py-2 text-sm font-bold text-[#111111] transition-colors hover:bg-[#ff784f]"
                  >
                    + Add Employee
                  </button>
                </>
              )}

              <button
                onClick={logout}
                className="border border-white/25 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white hover:text-[#111111]"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {error && <Alert type="error" message={error} onClose={() => setError("")} />}
        {success && (
          <Alert type="success" message={success} onClose={() => setSuccess("")} />
        )}

        {stats && (
          <section className="mb-6 grid grid-cols-2 border-l border-t border-[#111111]/15 dark:border-white/15 lg:grid-cols-5">
            <StatCard label="Total" value={stats.total} accent="bg-[#111111] dark:bg-white" />
            <StatCard label="Active" value={stats.active} accent="bg-emerald-500" />
            <StatCard label="Inactive" value={stats.inactive} accent="bg-amber-500" />
            <StatCard label="HR Managers" value={stats.hrManagers} accent="bg-violet-500" />
            <StatCard label="Employees" value={stats.employees} accent="bg-[#ff5a36]" />
          </section>
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
          <article className="border border-[#111111]/15 bg-white p-5 transition-colors dark:border-white/15 dark:bg-[#111111] xl:col-span-3">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-[#666666] uppercase dark:text-white/45">
                  Department Distribution
                </p>
                <h2 className="mt-1 text-lg font-black tracking-[-0.02em]">
                  Team allocation
                </h2>
              </div>

              <span className="border border-[#111111]/15 px-2 py-1 text-xs font-bold dark:border-white/15">
                {departmentChartData.length} groups
              </span>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentChartData}
                  margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.12}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "currentColor", opacity: 0.06 }}
                    contentStyle={{
                      background: "#111111",
                      color: "#f4f4f0",
                      border: "1px solid rgba(255,255,255,.2)",
                    }}
                  />
                  <Bar
                    dataKey="employees"
                    fill="#ff5a36"
                    radius={0}
                    maxBarSize={54}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="border border-[#111111]/15 bg-white p-5 transition-colors dark:border-white/15 dark:bg-[#111111] xl:col-span-2">
            <div className="mb-5">
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#666666] uppercase dark:text-white/45">
                Workforce Status
              </p>
              <h2 className="mt-1 text-lg font-black tracking-[-0.02em]">
                Active coverage
              </h2>
            </div>

            <div className="flex h-64 items-center gap-2">
              <ResponsiveContainer width="62%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    contentStyle={{
                      background: "#111111",
                      color: "#f4f4f0",
                      border: "1px solid rgba(255,255,255,.2)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="min-w-0 flex-1 space-y-3">
                {statusChartData.map((item, index) => (
                  <div key={item.name}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0"
                        style={{ backgroundColor: PIE_COLORS[index] }}
                      />
                      <span className="text-xs font-bold text-[#666666] dark:text-white/55">
                        {item.name}
                      </span>
                    </div>

                    <p className="mt-1 text-2xl font-black">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="mb-4 border border-[#111111]/15 bg-white p-4 transition-colors dark:border-white/15 dark:bg-[#111111]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              className={`${inputClassName} xl:col-span-2`}
              placeholder="Search name, email, or employee ID"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />

            <select
              className={inputClassName}
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className={inputClassName}
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item.replace("_", " ")}
                </option>
              ))}
            </select>

            <select
              className={inputClassName}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All status</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={loadDashboard}
                className="flex-1 bg-[#111111] px-3 py-2.5 text-sm font-bold text-[#f4f4f0] transition-colors hover:bg-[#ff5a36] hover:text-[#111111] dark:bg-[#f4f4f0] dark:text-[#111111]"
              >
                Refresh
              </button>

              <button
                onClick={resetFilters}
                className="border border-[#111111]/25 px-3 py-2.5 text-sm font-bold transition-colors hover:bg-[#eeeeea] dark:border-white/20 dark:hover:bg-white/10"
              >
                Reset
              </button>
            </div>
          </div>

          {canManageEmployees && (
            <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-xs font-bold text-[#666666] dark:text-white/55">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => {
                  setIncludeDeleted(event.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 accent-[#ff5a36]"
              />
              Include soft-deleted employees
            </label>
          )}
        </section>

        <section className="overflow-hidden border border-[#111111]/15 bg-white transition-colors dark:border-white/15 dark:bg-[#111111]">
          <div className="flex flex-col gap-3 border-b border-[#111111]/15 p-5 dark:border-white/15 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#666666] uppercase dark:text-white/45">
                Employee Directory
              </p>
              <h2 className="mt-1 text-lg font-black tracking-[-0.02em]">
                {pagination.total} record{pagination.total === 1 ? "" : "s"}{" "}
                found
              </h2>
            </div>

            <p className="text-xs font-bold text-[#666666] dark:text-white/55">
              Page {pagination.page} / {pagination.totalPages}
            </p>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-[#111111]/15 bg-[#eeeeea] text-left text-[10px] font-bold tracking-[0.14em] text-[#666666] uppercase dark:border-white/15 dark:bg-white/5 dark:text-white/45">
                <tr>
                  {[
                    "Employee",
                    "Department",
                    "Role",
                    "Status",
                    "Joining",
                    "Salary",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-5 py-4">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-sm text-[#666666] dark:text-white/55">
                      Loading employee records...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-sm text-[#666666] dark:text-white/55">
                      No employee records match these filters.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <EmployeeTableRow
                      key={employee.id}
                      employee={employee}
                      canManage={canManageEmployees}
                      onEdit={openEditModal}
                      onChangeStatus={changeStatus}
                      onDelete={softDeleteEmployee}
                      onRestore={restoreEmployee}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {loading ? (
              <p className="py-10 text-center text-sm text-[#666666] dark:text-white/55">
                Loading employee records...
              </p>
            ) : employees.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#666666] dark:text-white/55">
                No employee records match these filters.
              </p>
            ) : (
              employees.map((employee) => (
                <EmployeeMobileCard
                  key={employee.id}
                  employee={employee}
                  canManage={canManageEmployees}
                  onEdit={openEditModal}
                  onChangeStatus={changeStatus}
                  onDelete={softDeleteEmployee}
                  onRestore={restoreEmployee}
                />
              ))
            )}
          </div>

          <PaginationControls
            page={pagination.page}
            totalPages={pagination.totalPages}
            loading={loading}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() =>
              setPage((current) =>
                Math.min(pagination.totalPages, current + 1)
              )
            }
          />
        </section>
      </div>

      {showEmployeeModal && (
        <EmployeeModal
          form={form}
          editingEmployee={editingEmployee}
          managers={managers}
          loading={submitting}
          onClose={closeEmployeeModal}
          onSubmit={saveEmployee}
          onChange={updateForm}
        />
      )}

      {showImportModal && (
        <ImportModal
          importing={importing}
          result={importResult}
          onClose={() => {
            if (!importing) {
              setShowImportModal(false);
              setImportResult(null);
            }
          }}
          onImport={importCsv}
          onDownloadTemplate={downloadCsvTemplate}
        />
      )}
    </main>
  );
}

const inputClassName =
  "w-full border border-[#111111]/25 bg-transparent px-3 py-2.5 text-sm text-[#111111] outline-none transition-colors placeholder:text-[#111111]/35 focus:border-[#ff5a36] dark:border-white/20 dark:text-[#f4f4f0] dark:placeholder:text-white/30";

function ThemeSelector({
  theme,
  onChange,
  compact = false,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
  compact?: boolean;
}) {
  const options: Array<{ value: Theme; label: string; icon: string }> = [
    { value: "light", label: "Light", icon: "☀" },
    { value: "dark", label: "Dark", icon: "☾" },
    { value: "system", label: "System", icon: "◐" },
  ];

  return (
    <div
      className={`flex border border-white/20 p-1 ${
        compact
          ? "border-[#111111]/20 dark:border-white/20"
          : "bg-black/20"
      }`}
      aria-label="Theme selector"
    >
      {options.map((option) => {
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-label={`${option.label} theme`}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={[
              "grid h-8 w-8 place-items-center text-sm transition-colors",
              compact
                ? active
                  ? "bg-[#111111] text-white dark:bg-white dark:text-[#111111]"
                  : "text-[#111111]/65 hover:bg-[#111111]/10 dark:text-white/65 dark:hover:bg-white/10"
                : active
                ? "bg-white text-[#111111]"
                : "text-white/65 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

function Alert({
  type,
  message,
  onClose,
}: {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const className =
    type === "success"
      ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
      : "border-red-600 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100";

  return (
    <div
      className={`mb-5 flex items-start justify-between gap-4 border p-4 text-sm font-medium ${className}`}
      role="alert"
    >
      <span>{message}</span>
      <button type="button" onClick={onClose} className="font-black">
        ×
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <article className="border-b border-r border-[#111111]/15 bg-white p-5 transition-colors dark:border-white/15 dark:bg-[#111111]">
      <div className={`mb-5 h-1.5 w-10 ${accent}`} />
      <p className="text-[10px] font-bold tracking-[0.18em] text-[#666666] uppercase dark:text-white/45">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em]">{value}</p>
    </article>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold tracking-[0.16em] text-[#666666] uppercase dark:text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const className =
    status === "ACTIVE"
      ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
      : "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300";

  return (
    <span
      className={`inline-flex border px-2 py-1 text-[10px] font-black tracking-[0.12em] ${className}`}
    >
      {status}
    </span>
  );
}

function EmployeeTableRow({
  employee,
  canManage,
  onEdit,
  onChangeStatus,
  onDelete,
  onRestore,
}: {
  employee: Employee;
  canManage: boolean;
  onEdit: (employee: Employee) => void;
  onChangeStatus: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onRestore: (employee: Employee) => void;
}) {
  const isDeleted = Boolean(employee.deletedAt);

  return (
    <tr
      className={`border-b border-[#111111]/10 text-sm transition-colors hover:bg-[#eeeeea] dark:border-white/10 dark:hover:bg-white/5 ${
        isDeleted ? "opacity-55" : ""
      }`}
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <EmployeeAvatar employee={employee} />
          <div>
            <p className="font-bold">{employee.name}</p>
            <p className="mt-1 text-xs text-[#666666] dark:text-white/50">
              {employee.employeeId} · {employee.email}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <p className="font-medium">{employee.department}</p>
        <p className="mt-1 text-xs text-[#666666] dark:text-white/50">
          {employee.designation}
        </p>
      </td>

      <td className="px-5 py-4">
        <span className="border border-[#111111]/20 px-2 py-1 text-[10px] font-black tracking-[0.1em] dark:border-white/20">
          {employee.role.replace("_", " ")}
        </span>
      </td>

      <td className="px-5 py-4">
        {isDeleted ? (
          <span className="border border-red-500 px-2 py-1 text-[10px] font-black tracking-[0.12em] text-red-600 dark:text-red-300">
            DELETED
          </span>
        ) : (
          <StatusBadge status={employee.status} />
        )}
      </td>

      <td className="px-5 py-4 text-[#666666] dark:text-white/55">
        {formatDate(employee.joiningDate)}
      </td>

      <td className="px-5 py-4 font-bold">{formatMoney(employee.salary)}</td>

      <td className="px-5 py-4">
        {canManage && (
          <div className="flex flex-wrap gap-3 text-xs font-black">
            {isDeleted ? (
              <button
                onClick={() => onRestore(employee)}
                className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
              >
                Restore
              </button>
            ) : (
              <>
                <button
                  onClick={() => onEdit(employee)}
                  className="text-[#111111] hover:text-[#ff5a36] dark:text-white"
                >
                  Edit
                </button>

                <button
                  onClick={() => onChangeStatus(employee)}
                  className="text-amber-600 hover:text-amber-800 dark:text-amber-400"
                >
                  {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>

                <button
                  onClick={() => onDelete(employee)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function EmployeeMobileCard({
  employee,
  canManage,
  onEdit,
  onChangeStatus,
  onDelete,
  onRestore,
}: {
  employee: Employee;
  canManage: boolean;
  onEdit: (employee: Employee) => void;
  onChangeStatus: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onRestore: (employee: Employee) => void;
}) {
  const isDeleted = Boolean(employee.deletedAt);

  return (
    <article
      className={`border border-[#111111]/15 p-4 dark:border-white/15 ${
        isDeleted ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <EmployeeAvatar employee={employee} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-black">{employee.name}</h3>
              <p className="mt-1 text-xs text-[#666666] dark:text-white/50">
                {employee.employeeId}
              </p>
            </div>

            {isDeleted ? (
              <span className="border border-red-500 px-2 py-1 text-[10px] font-black tracking-[0.12em] text-red-600 dark:text-red-300">
                DELETED
              </span>
            ) : (
              <StatusBadge status={employee.status} />
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <InfoItem label="Department" value={employee.department} />
            <InfoItem label="Role" value={employee.role.replace("_", " ")} />
            <InfoItem label="Designation" value={employee.designation} />
            <InfoItem label="Salary" value={formatMoney(employee.salary)} />
          </div>
        </div>
      </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-[#111111]/10 pt-4 text-xs font-black dark:border-white/10">
          {isDeleted ? (
            <button
              onClick={() => onRestore(employee)}
              className="text-emerald-600 dark:text-emerald-400"
            >
              Restore employee
            </button>
          ) : (
            <>
              <button
                onClick={() => onEdit(employee)}
                className="text-[#111111] dark:text-white"
              >
                Edit
              </button>
              <button
                onClick={() => onChangeStatus(employee)}
                className="text-amber-600 dark:text-amber-400"
              >
                {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => onDelete(employee)}
                className="text-red-600 dark:text-red-400"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function EmployeeAvatar({ employee }: { employee: Employee }) {
  const initials = employee.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  if (employee.profileImage) {
    return (
      <img
        src={employee.profileImage}
        alt={`${employee.name} profile`}
        className="h-10 w-10 shrink-0 border border-[#111111]/20 object-cover dark:border-white/20"
      />
    );
  }

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#111111] text-xs font-black text-[#f4f4f0] dark:bg-[#f4f4f0] dark:text-[#111111]">
      {initials}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-[0.12em] text-[#666666] uppercase dark:text-white/45">
        {label}
      </p>
      <p className="mt-1 truncate font-bold">{value}</p>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  loading,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#111111]/15 p-4 dark:border-white/15 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-[#666666] dark:text-white/55">
        Page {String(page).padStart(2, "0")} of{" "}
        {String(totalPages).padStart(2, "0")}
      </p>

      <div className="flex gap-2">
        <button
          disabled={loading || page <= 1}
          onClick={onPrevious}
          className="border border-[#111111]/25 px-4 py-2 text-xs font-black transition-colors hover:bg-[#111111] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/20 dark:hover:bg-white dark:hover:text-[#111111]"
        >
          Previous
        </button>

        <button
          disabled={loading || page >= totalPages}
          onClick={onNext}
          className="bg-[#111111] px-4 py-2 text-xs font-black text-white transition-colors hover:bg-[#ff5a36] hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-white dark:text-[#111111]"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function EmployeeModal({
  form,
  editingEmployee,
  managers,
  loading,
  onClose,
  onSubmit,
  onChange,
}: {
  form: EmployeeForm;
  editingEmployee: Employee | null;
  managers: Employee[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof EmployeeForm>(
    key: K,
    value: EmployeeForm[K]
  ) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 sm:p-8">
      <div className="mx-auto flex min-h-full max-w-4xl items-center">
        <form
          onSubmit={onSubmit}
          className="my-8 w-full border border-[#111111] bg-[#f4f4f0] text-[#111111] shadow-[10px_10px_0_#ff5a36] dark:border-white/20 dark:bg-[#111111] dark:text-[#f4f4f0]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#111111]/15 p-5 dark:border-white/15">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#ff5a36] uppercase">
                Employee Record
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">
                {editingEmployee ? "Edit employee" : "Add employee"}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-2xl font-black leading-none"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
            <FieldLabel label="Employee ID">
              <input
                required
                value={form.employeeId}
                onChange={(event) => onChange("employeeId", event.target.value)}
                className={inputClassName}
                placeholder="EMP-1001"
              />
            </FieldLabel>

            <FieldLabel label="Full Name">
              <input
                required
                value={form.name}
                onChange={(event) => onChange("name", event.target.value)}
                className={inputClassName}
                placeholder="Employee full name"
              />
            </FieldLabel>

            <FieldLabel label="Email">
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => onChange("email", event.target.value)}
                className={inputClassName}
                placeholder="employee@company.com"
              />
            </FieldLabel>

            <FieldLabel
              label={
                editingEmployee
                  ? "New Password (leave empty to retain)"
                  : "Temporary Password"
              }
            >
              <input
                required={!editingEmployee}
                type="password"
                minLength={6}
                value={form.password}
                onChange={(event) => onChange("password", event.target.value)}
                className={inputClassName}
                placeholder="Minimum 6 characters"
              />
            </FieldLabel>

            <FieldLabel label="Phone">
              <input
                required
                value={form.phone}
                onChange={(event) => onChange("phone", event.target.value)}
                className={inputClassName}
                placeholder="+91 9876543210"
              />
            </FieldLabel>

            <FieldLabel label="Profile Image URL">
              <input
                type="url"
                value={form.profileImage}
                onChange={(event) => onChange("profileImage", event.target.value)}
                className={inputClassName}
                placeholder="https://..."
              />
            </FieldLabel>

            <FieldLabel label="Department">
              <input
                required
                value={form.department}
                onChange={(event) => onChange("department", event.target.value)}
                className={inputClassName}
                placeholder="Engineering"
              />
            </FieldLabel>

            <FieldLabel label="Designation">
              <input
                required
                value={form.designation}
                onChange={(event) => onChange("designation", event.target.value)}
                className={inputClassName}
                placeholder="Software Engineer"
              />
            </FieldLabel>

            <FieldLabel label="Monthly Salary">
              <input
                required
                min="0"
                type="number"
                value={form.salary}
                onChange={(event) => onChange("salary", event.target.value)}
                className={inputClassName}
                placeholder="65000"
              />
            </FieldLabel>

            <FieldLabel label="Joining Date">
              <input
                required
                type="date"
                value={form.joiningDate}
                onChange={(event) => onChange("joiningDate", event.target.value)}
                className={inputClassName}
              />
            </FieldLabel>

            <FieldLabel label="Role">
              <select
                value={form.role}
                onChange={(event) => onChange("role", event.target.value as Role)}
                className={inputClassName}
              >
                {ROLE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item.replace("_", " ")}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  onChange("status", event.target.value as Status)
                }
                className={inputClassName}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Reporting Manager">
              <select
                value={form.managerId}
                onChange={(event) => onChange("managerId", event.target.value)}
                className={inputClassName}
              >
                <option value="">No manager assigned</option>
                {managers
                  .filter((manager) => manager.id !== editingEmployee?.id)
                  .map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.employeeId})
                    </option>
                  ))}
              </select>
            </FieldLabel>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#111111]/15 p-5 dark:border-white/15">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="border border-[#111111]/25 px-4 py-2.5 text-sm font-bold dark:border-white/20"
            >
              Cancel
            </button>

            <button
              disabled={loading}
              className="bg-[#111111] px-5 py-2.5 text-sm font-bold text-[#f4f4f0] transition-colors hover:bg-[#ff5a36] hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-[#111111]"
            >
              {loading
                ? "Saving..."
                : editingEmployee
                ? "Save Changes"
                : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({
  importing,
  result,
  onClose,
  onImport,
  onDownloadTemplate,
}: {
  importing: boolean;
  result: CsvImportResult | null;
  onClose: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl border border-[#111111] bg-[#f4f4f0] p-6 text-[#111111] shadow-[10px_10px_0_#ff5a36] dark:border-white/20 dark:bg-[#111111] dark:text-[#f4f4f0]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-[#ff5a36] uppercase">
              Bulk Operations
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">
              Import employees
            </h2>
          </div>

          <button
            type="button"
            disabled={importing}
            onClick={onClose}
            className="text-2xl font-black leading-none"
            aria-label="Close import modal"
          >
            ×
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-[#666666] dark:text-white/55">
          Upload a CSV containing employee records. Invalid rows are skipped and
          returned in the import result.
        </p>

        <button
          type="button"
          onClick={onDownloadTemplate}
          className="mt-4 border border-[#111111]/25 px-4 py-2 text-xs font-black dark:border-white/20"
        >
          Download CSV Template
        </button>

        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-[#111111]/25 p-8 text-center transition-colors hover:border-[#ff5a36] dark:border-white/20">
          <span className="text-sm font-black">
            {importing ? "Importing records..." : "Select CSV file"}
          </span>
          <span className="mt-2 text-xs text-[#666666] dark:text-white/50">
            Required: employeeId, name, email, password, phone, department,
            designation, salary, joiningDate, role, status
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importing}
            onChange={onImport}
            className="sr-only"
          />
        </label>

        {result && (
          <div className="mt-5 border border-[#111111]/15 p-4 text-sm dark:border-white/15">
            <p className="font-black">
              Imported: {result.created} · Failed: {result.failed}
            </p>

            {result.errors?.length ? (
              <div className="mt-3 max-h-32 space-y-1 overflow-y-auto text-xs text-red-600 dark:text-red-300">
                {result.errors.map((error) => (
                  <p key={`${error.row}-${error.message}`}>
                    Row {error.row}: {error.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}