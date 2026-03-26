import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { TransactionHistory } from "./components/TransactionHistory";
import { AddStock } from "./components/AddStock";
import { InventoryOverview } from "./components/InventoryOverview";
import { Reports } from "./components/Reports";
import { UserManagement } from "./components/UserManagement";
import { Archive } from "./components/Archive";
import { Login } from "./components/Login";
import { ResetPassword } from "./components/ResetPassword";
import { ConfirmSignUp } from "./components/ConfirmSignUp";
import { Account } from "./components/Account";
import { Toaster } from "./components/ui/sonner";
import { toast } from 'sonner';
import { useAuth } from "./contexts/AuthContext";
import { Protected } from "./components/Protected";
import { PERMISSIONS } from "./lib/permissions";
import supabase from "./lib/supabaseClient";

export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  // Use auth context instead of local state
  const { user: currentUser, isAuthenticated, signOut } = useAuth();

  // Handle initial routing and password reset flow
  useEffect(() => {
    const handleInitialRoute = async () => {
      console.log('App - Handling initial route');
      
      // Get current session and URL info
      const { data: { session } } = await supabase.auth.getSession();
      const hash = window.location.hash;
      const pathname = window.location.pathname;
      
  // Check for different types of reset flows. Only treat explicit recovery flows
  // (type=recovery) as password reset triggers — don't treat generic access_token in hash
  // as a recovery flow to avoid false positives.
  const isRecoveryFlow = hash.includes('type=recovery') || window.location.search.includes('type=recovery');
      const isForceReset = sessionStorage.getItem('forcePasswordReset') === 'true';
      // If we just completed confirmation, skip treating this as a first-login reset
      const justConfirmed = sessionStorage.getItem('justConfirmed') === 'true';
      if (justConfirmed) {
        try { sessionStorage.removeItem('justConfirmed') } catch (e) {}
      }

      const isFirstLogin = session && !session.user?.user_metadata?.has_changed_password && !justConfirmed;
      
      console.log('Recovery flow:', isRecoveryFlow);
      console.log('Force reset:', isForceReset);
      console.log('First login:', isFirstLogin);
      
      // Check for email confirmation flow
      const isConfirmationFlow = pathname === '/confirm' || 
        hash.includes('type=signup') || 
        window.location.search.includes('confirmation_token');

      if (isConfirmationFlow) {
        console.log('Handling confirmation flow');
        setActiveView('confirm');
        return;
      }

      // Handle the various reset scenarios
      if (isRecoveryFlow || isForceReset || isFirstLogin) {
        if (isRecoveryFlow) {
          // Store the token for the reset process (only when we explicitly detected type=recovery)
          const hashParams = new URLSearchParams(hash.replace('#', ''));
          const token = hashParams.get('access_token') || hashParams.get('token');
          if (token) {
            try { sessionStorage.setItem('resetToken', token); } catch (e) {}
          }
        }

        // Mark that a password reset is required
        try { sessionStorage.setItem('forcePasswordReset', 'true'); } catch (e) {}
        setActiveView("reset-password");
        return;
      }
      
      // Handle normal routing logic
      console.log('Debug - Handling route with session:', !!session);
      console.log('Debug - User metadata:', session?.user?.user_metadata);
      console.log('Debug - Just confirmed flag:', sessionStorage.getItem('justConfirmed'));
      
      if (!session) {
        console.log('No session - setting view to login');
        setActiveView("login");
      } else if (sessionStorage.getItem('justConfirmed') === 'true') {
        console.log('Post-confirmation - setting view to login');
        sessionStorage.removeItem('justConfirmed');
        setActiveView("login");
      } else if (!session.user?.user_metadata?.has_changed_password) {
        console.log('Password change required - setting view to reset-password');
        sessionStorage.setItem('forcePasswordReset', 'true');
        setActiveView("reset-password");
      } else {
        console.log('Session exists - setting view to dashboard');
        setActiveView("dashboard");
      }
    };

    handleInitialRoute();
  }, []);

  const [archivedUsers, setArchivedUsers] = useState([
    {
      id: "arch-1",
      username: "jessa",
      role: "Staff",
      createdAt: "5/15/2025",
      archivedAt: "8/20/2025",
      archivedBy: "shuee",
      reason: "No longer part of Shobe",
    },
    {
      id: "arch-2",
      username: "marco",
      role: "Staff",
      createdAt: "3/10/2025",
      archivedAt: "7/5/2025",
      archivedBy: "shuee",
      reason: "No longer part of Shobe",
    },
  ]);

  const [inventory, setInventory] = useState([
    {
      id: "1",
      name: "3ft tarpaulin",
      quantity: 165,
      unit: "ft",
      reorderLevel: 20,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH3FC12TP",
    },
    {
      id: "2",
      name: "4ft tarpaulin",
      quantity: 165,
      unit: "ft",
      reorderLevel: 20,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH4FC12TP",
    },
    {
      id: "3",
      name: "5ft tarpaulin",
      quantity: 165,
      unit: "ft",
      reorderLevel: 20,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH5FC12TP",
    },
    {
      id: "4",
      name: "6ft tarpaulin",
      quantity: 165,
      unit: "ft",
      reorderLevel: 20,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH6FC12TP",
    },
    {
      id: "5",
      name: "4ft election tarp (8oz)",
      quantity: 165,
      unit: "ft",
      reorderLevel: 20,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH4FA9TP",
    },
    {
      id: "13",
      name: "3ft election tarp (8oz)",
      quantity: 165,
      unit: "ft",
      reorderLevel: 20,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH3FA9TP",
    },
    {
      id: "6",
      name: "4ft laminating film (glossy)",
      quantity: 30,
      unit: "ft",
      reorderLevel: 5,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH4FGLLM",
    },
    {
      id: "7",
      name: "4ft vinyl sticker",
      quantity: 165,
      unit: "ft",
      reorderLevel: 10,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH4FSTVS",
    },
    {
      id: "8",
      name: "5ft vinyl sticker",
      quantity: 165,
      unit: "ft",
      reorderLevel: 10,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SH5FSTVS",
    },
    {
      id: "9",
      name: "Cyan Ink",
      quantity: 1,
      unit: "bottles",
      reorderLevel: 2,
      status: "Low Stock",
      dateAdded: "2025-09-01",
      sku: "SHCYIN",
    },
    {
      id: "10",
      name: "Black Ink",
      quantity: 0,
      unit: "bottles",
      reorderLevel: 2,
      status: "Out of Stock",
      dateAdded: "2025-09-01",
      sku: "SHBLIN",
    },
    {
      id: "11",
      name: "Magenta Ink",
      quantity: 1,
      unit: "bottles",
      reorderLevel: 2,
      status: "Low Stock",
      dateAdded: "2025-09-01",
      sku: "SHMAIN",
    },
    {
      id: "12",
      name: "Yellow Ink",
      quantity: 5,
      unit: "bottles",
      reorderLevel: 2,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "SHYEIN",
    },
    {
      id: "14",
      name: "A4 sintra board",
      quantity: 25,
      unit: "sheets",
      reorderLevel: 10,
      status: "In Stock",
      dateAdded: "2025-09-01",
      sku: "AMA4SBBD",
    },
    {
      id: "15",
      name: "A3 sintra board",
      quantity: 8,
      unit: "sheets",
      reorderLevel: 10,
      status: "Low Stock",
      dateAdded: "2025-09-01",
      sku: "AMA3SBBD",
    },
  ]);

  const [transactions, setTransactions] = useState([
    {
      id: "1",
      dateTime: "9/5/2025, 9:15:56 PM",
      type: "Used",
      material: "4ft tarpaulin",
      quantity: 8,
      user: "verity",
      note: "ECC Banner (8ft x 4ft)",
      sku: "SH4FC12TP",
    },
    {
      id: "2",
      dateTime: "9/5/2025, 9:05:30 PM",
      type: "Used",
      material: "5ft tarpaulin",
      quantity: 15,
      user: "verity",
      note: "SAMPLE (15ft x 5ft)",
      sku: "SH5FC12TP",
    },
    {
      id: "3",
      dateTime: "9/5/2025, 9:04:24 PM",
      type: "Used",
      material: "3ft tarpaulin",
      quantity: 6,
      user: "verity",
      note: "ECC (6ft x 3ft)",
      sku: "SH3FC12TP",
    },
    {
      id: "4",
      dateTime: "9/5/2025, 9:01:43 PM",
      type: "Added",
      material: "3ft tarpaulin",
      quantity: 50,
      user: "shuee",
      note: "ArtMart Signage Materials Trading - Stock replenishment",
      sku: "AM3FC12TP250901",
    },
    {
      id: "5",
      dateTime: "9/4/2025, 2:30:15 PM",
      type: "Used",
      material: "Cyan Ink",
      quantity: 1,
      user: "verity",
      note: "Large format printing",
      sku: "SHCYIN",
    },
  ]);

  const handleLogin = async (idOrEmail, role) => {
    try {


      const userRole = role || 'User'

      // Decide which view to show after successful login
      if (userRole === 'Staff') {
        setActiveView('inventory')
      } else {
        setActiveView('dashboard')
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      // Call AuthContext signOut
      const { error } = await signOut();
      if (error) throw error;
      
      // Reset view to default
      setActiveView("dashboard");
      
      // Clear auth state
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      // Force reload to clear everything
      window.location.href = '/';
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
      
      // If error, force reload anyway
      window.location.href = '/';
    }
  };

  const addStock = (material, quantity, note, isNew, sku, reorderLevel, unit) => {
    const finalUnit = unit || getMaterialUnit(material);
    const finalReorderLevel = reorderLevel || getDefaultReorderLevel(material);

    const newItem = {
      id: Date.now().toString(),
      name: material,
      quantity,
      unit: finalUnit,
      reorderLevel: finalReorderLevel,
      status: "In Stock",
      isNew: true,
      dateAdded: new Date().toISOString().split("T")[0],
      sku,
    };

    setInventory((prev) => {
      const newInventory = [newItem, ...prev];
      return updateMaterialStatuses(newInventory, material);
    });

    const newTransaction = {
      id: Date.now().toString(),
      dateTime: new Date().toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      }),
      type: "Added",
      material,
      quantity,
      user: currentUser?.username || "Unknown User",
      note: note || "Stock replenishment",
      sku,
    };

    setTransactions((prev) => [newTransaction, ...prev]);
  };

  const editStock = (id, quantity, reorderLevel) => {
    let editedMaterial = "";
    setInventory((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          editedMaterial = item.name;
          return { ...item, quantity, reorderLevel, status: "In Stock" };
        }
        return item;
      });
      return updateMaterialStatuses(updated, editedMaterial);
    });
  };

  const useStock = (id, quantity, note) => {
    let usedMaterial = "";
    setInventory((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          usedMaterial = item.name;
          const newQty = parseFloat((item.quantity - quantity).toFixed(2));
          return { ...item, quantity: newQty, status: "In Stock", isNew: false };
        }
        return item;
      });
      return updateMaterialStatuses(updated, usedMaterial);
    });

    const usedItem = inventory.find((i) => i.id === id);
    const newTransaction = {
      id: Date.now().toString(),
      dateTime: new Date().toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      }),
      type: "Used",
      material: usedItem?.name || "Unknown",
      quantity,
      user: currentUser?.username || "Unknown User",
      note,
      sku: usedItem?.sku,
    };

    setTransactions((prev) => [newTransaction, ...prev]);
  };

  const getMaterialUnit = (material) => {
    try {
      const stored = localStorage.getItem("shobe-material-configs");
      if (stored) {
        const configs = JSON.parse(stored);
        const match = configs.find(
          (c) =>
            c.displayName.toLowerCase() === material.toLowerCase() ||
            c.name.toLowerCase() === material.toLowerCase()
        );
        if (match && match.defaultUnit) return match.defaultUnit;
      }
    } catch {}
    const units = {
      "3ft tarpaulin": "ft",
      "4ft tarpaulin": "ft",
      "5ft tarpaulin": "ft",
      "6ft tarpaulin": "ft",
      "3ft election tarp (8oz)": "ft",
      "4ft election tarp (8oz)": "ft",
      "4ft laminating film (glossy)": "ft",
      "5ft laminating film (glossy)": "ft",
      "4ft vinyl sticker": "ft",
      "5ft vinyl sticker": "ft",
      "cyan ink": "bottles",
      "black ink": "bottles",
      "magenta ink": "bottles",
      "yellow ink": "bottles",
      "a4 sintra board": "sheets",
      "a3 sintra board": "sheets",
      "a2 sintra board": "sheets",
    };
    if (material.toLowerCase().startsWith("round neck shirt")) return "pieces";
    return units[material.toLowerCase()] || "units";
  };

  const getDefaultReorderLevel = (material) => {
    try {
      const stored = localStorage.getItem("shobe-material-configs");
      if (stored) {
        const configs = JSON.parse(stored);
        const match = configs.find(
          (c) =>
            c.displayName.toLowerCase() === material.toLowerCase() ||
            c.name.toLowerCase() === material.toLowerCase()
        );
        if (match && match.defaultReorderLevel)
          return match.defaultReorderLevel;
      }
    } catch {}
    const levels = {
      "3ft tarpaulin": 20,
      "4ft tarpaulin": 20,
      "5ft tarpaulin": 20,
      "6ft tarpaulin": 20,
      "cyan ink": 2,
      "black ink": 2,
      "magenta ink": 2,
      "yellow ink": 2,
      "a4 sintra board": 10,
      "a3 sintra board": 10,
      "a2 sintra board": 5,
    };
    if (material.toLowerCase().startsWith("round neck shirt")) return 2;
    return levels[material.toLowerCase()] || 10;
  };

  // Helper: get base material name (strip appended size/type after " - ")
  const getBaseName = (name) => {
    if (!name) return '';
    return String(name).split(' - ')[0].trim();
  };

  const updateMaterialStatuses = (inventoryItems, targetMaterial) => {
    const targetBase = getBaseName(targetMaterial).toLowerCase();

    const totalQuantity = inventoryItems
      .filter((i) => getBaseName(i.name).toLowerCase() === targetBase)
      .reduce((sum, i) => sum + i.quantity, 0);

    const reorderLevel = getDefaultReorderLevel(targetBase);
    let materialStatus = "In Stock";
    if (totalQuantity === 0) materialStatus = "Out of Stock";
    else if (totalQuantity <= reorderLevel) materialStatus = "Low Stock";

    return inventoryItems.map((i) =>
      getBaseName(i.name).toLowerCase() === targetBase
        ? { ...i, status: materialStatus }
        : i
    );
  };

  const getLowStockItems = () => {
    const materialTotals = inventory.reduce((acc, item) => {
      const base = getBaseName(item.name).toLowerCase();
      if (!acc[base])
        acc[base] = {
          name: getBaseName(item.name),
          totalQuantity: 0,
          reorderLevel: getDefaultReorderLevel(getBaseName(item.name)),
          unit: item.unit,
        };
      acc[base].totalQuantity += item.quantity;
      return acc;
    }, {});

    return Object.values(materialTotals)
      .filter((m) => m.totalQuantity <= m.reorderLevel)
      .map((m) => ({
        id: m.name.toLowerCase().replace(/\s+/g, "-"),
        name: m.name,
        quantity: m.totalQuantity,
        unit: m.unit,
        reorderLevel: m.reorderLevel,
        status: m.totalQuantity === 0 ? "Out of Stock" : "Low Stock",
        dateAdded: new Date().toISOString().split("T")[0],
        sku: "AGGREGATE",
      }));
  };

  // Compute low stock items once per render so we can watch changes and notify
  const lowStockItems = getLowStockItems();

  // Notify when new low-stock items appear (skip first mount)
  const prevLowIdsRef = useRef([]);
  const mountedRef = useRef(false);
  useEffect(() => {
    const currIds = lowStockItems.map(i => i.id);
    if (!mountedRef.current) {
      // Initialize and skip notification on first mount
      prevLowIdsRef.current = currIds;
      mountedRef.current = true;
      return;
    }

    const prevIds = prevLowIdsRef.current || [];
    const newIds = currIds.filter(id => !prevIds.includes(id));
    if (newIds.length > 0) {
      // Compose message listing new low-stock items (names)
      const newItems = lowStockItems.filter(i => newIds.includes(i.id));
      const names = newItems.map(i => i.name).join(', ');
      const msg = newItems.length === 1 ? `${names} is low or out of stock` : `${newItems.length} items are low or out of stock: ${names}`;
      toast.warning(msg, { duration: 8000 });
    }

    prevLowIdsRef.current = currIds;
  }, [lowStockItems]);

  const renderContent = () => {
  switch (activeView) {
      case "dashboard":
        return (
          <Dashboard
            inventory={inventory}
            transactions={transactions}
            currentUser={currentUser}
            onLogout={handleLogout}
            lowStockItems={lowStockItems}
            onNavigateToAccount={() => setActiveView("account")}
          />
        );
      case "inventory":
        return (
          <InventoryOverview
            inventory={inventory}
            onUseStock={useStock}
            onEditStock={editStock}
            currentUser={currentUser}
            onLogout={handleLogout}
            lowStockItems={lowStockItems}
            onNavigateToAccount={() => setActiveView("account")}
          />
        );
      case "add-stock":
        return (
          <AddStock
            onAddStock={addStock}
            currentUser={currentUser}
            onLogout={handleLogout}
            lowStockItems={lowStockItems}
            inventory={inventory}
            onAddMaterial={(m) => console.log("Material added:", m)}
            onNavigateToAccount={() => setActiveView("account")}
          />
        );
      case "history":
        return (
          <TransactionHistory
            transactions={transactions}
            currentUser={currentUser}
            onLogout={handleLogout}
            lowStockItems={lowStockItems}
            onNavigateToAccount={() => setActiveView("account")}
          />
        );
      case "reports":
        return (
          <Reports
            inventory={inventory}
            transactions={transactions}
            currentUser={currentUser}
            onLogout={handleLogout}
            lowStockItems={lowStockItems}
            onNavigateToAccount={() => setActiveView("account")}
          />
        );
      case "user-management":
        return (
          <UserManagement
            currentUser={currentUser}
            onLogout={handleLogout}
            lowStockItems={lowStockItems}
            onArchiveUser={(user) => {
              const archivedUser = {
                id: user.id,
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                archivedAt: new Date().toLocaleDateString("en-US", {
                  month: "numeric",
                  day: "numeric",
                  year: "numeric",
                }),
                archivedBy: currentUser?.username || "Unknown",
                reason: user.reason,
              };
                            setArchivedUsers((prev) => [archivedUser, ...prev]);
            }}
            onNavigateToAccount={() => setActiveView("account")}
          />
        );
      case "archive":
        return (
          <Archive
            archivedUsers={archivedUsers}
            currentUser={currentUser}
            onLogout={handleLogout}
            lowStockItems={getLowStockItems()}
            onNavigateToAccount={() => setActiveView("account")}
          />
        );
      case "account":
        return (
          <Account
            currentUser={currentUser}
            onLogout={handleLogout}
            onBack={() =>
              setActiveView(
                currentUser?.role === "Admin" ? "dashboard" : "inventory"
              )
            }
          />
        );
      default:
        return null;
    }
  };

  const [showResetPassword, setShowResetPassword] = useState(false);

  // Check for reset password flow
  useEffect(() => {
    const hash = window.location.hash;
    const path = window.location.pathname;
    const search = window.location.search;
    const fullUrl = window.location.href;
    
    console.log('Debug - Full URL:', fullUrl);
    console.log('Debug - Path:', path);
    console.log('Debug - Hash:', hash);
    console.log('Debug - Search:', search);
    
    // Check if we're coming from a Supabase auth flow
    const params = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.replace('#', ''));
    
    console.log('Debug - Search Params:', Object.fromEntries(params.entries()));
    console.log('Debug - Hash Params:', Object.fromEntries(hashParams.entries()));

    // Check if we're coming from confirmation
    const justConfirmed = sessionStorage.getItem('justConfirmed') === 'true';
    const isLoginRedirect = path === '/login' && params.get('confirmed') === '1';
    console.log('Debug - Just Confirmed:', justConfirmed);
    console.log('Debug - Is Login Redirect:', isLoginRedirect);
    
    // Skip reset check if we just confirmed
    if (justConfirmed || isLoginRedirect) {
      console.log('Skipping reset check - coming from confirmation');
      return;
    }
    
    // Look for token in various places
    const hasToken = 
      hash.includes('access_token') || 
      search.includes('access_token') ||
      params.has('token') ||
      hashParams.has('token');
    
    const isResetFlow = 
      path === '/reset-password' || 
      hasToken ||
      hash.includes('type=recovery') ||
      search.includes('type=recovery');

    console.log('Debug - Has Token:', hasToken);
    console.log('Debug - Is Reset Flow:', isResetFlow);
    
    if (isResetFlow) {
      // If we have a token but aren't on the reset page, preserve it while redirecting
      if (hasToken && path !== '/reset-password') {
        const newUrl = '/reset-password' + (hash || search);
        console.log('Debug - Redirecting to:', newUrl);
        window.history.replaceState(null, '', newUrl);
      }
      setShowResetPassword(true);
    }
  }, []);

  // Render content based on activeView
  if (activeView === "confirm") {
    console.log('Rendering ConfirmSignUp component');
    return (
      <>
        <ConfirmSignUp />
        <Toaster />
      </>
    );
  }

  if (activeView === "reset-password") {
    console.log('Rendering ResetPassword component');
    return (
      <>
        <ResetPassword />
        <Toaster />
      </>
    );
  }

  // Handle login view
  if (activeView === "login" || !isAuthenticated) {
    console.log('Rendering Login component');
    return (
      <>
        <Login onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        currentUser={currentUser}
      />
      <div className="flex-1 flex flex-col h-full ml-48">
        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </div>
      <Toaster />
    </div>
  )
}

