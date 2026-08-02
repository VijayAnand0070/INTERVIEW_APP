import {
  BriefcaseBusiness,
  FileUp,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Button from "./Button.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/resume/upload", label: "Upload", icon: FileUp },
];

export default function AppShell() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-ink text-white shadow-sm">
              <BriefcaseBusiness size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-bold leading-5 text-ink">
                  Interviewees AI Interview App
                </p>
                <span className="hidden rounded-md border border-moss/20 bg-moss/5 px-2 py-0.5 text-xs font-semibold text-moss sm:inline-flex">
                  Production
                </span>
              </div>
              <p className="mt-0.5 max-w-[180px] truncate text-xs text-stone-500 sm:max-w-none">
                {user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1 md:flex">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-white text-ink shadow-sm"
                        : "text-stone-600 hover:bg-white hover:text-ink"
                    }`
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="hidden items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 lg:flex">
              <ShieldCheck size={16} className="text-moss" />
              Supabase Auth
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white md:hidden">
        <div className="grid grid-cols-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold ${
                  isActive ? "text-moss" : "text-stone-600"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
