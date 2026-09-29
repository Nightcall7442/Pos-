import { useState, useEffect } from "react";
import LoginScreen from "./screens/LoginScreen";
import MenuScreen from "./screens/MenuScreen";
import PaymentModal from "./screens/PaymentScreen";
import ReceiptModal from "./screens/ReceiptScreen";
import OpenShiftScreen from "./screens/OpenShiftScreen";
import CloseShiftScreen from "./screens/CloseShiftScreen";
import { useCartStore } from "./store/cartStore";
import { disconnectSocket } from "./services/socket";
import api, { clearSession } from "./services/api";
import type { Order, CashShift } from "./types";

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [currentShift, setCurrentShift] = useState<CashShift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const clearCart = useCartStore((s) => s.clearCart);

  useEffect(() => {
    const savedToken = localStorage.getItem("pos-token");
    const savedUser = localStorage.getItem("pos-user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("pos-user");
      }
    }
  }, []);

  // Check for active shift after login
  useEffect(() => {
    if (!token || !user) return;
    setShiftLoading(true);
    api
      .get("/cash-shifts/current")
      .then((res) => {
        setCurrentShift(res.data.data || null);
      })
      .catch(() => {
        setCurrentShift(null);
      })
      .finally(() => {
        setShiftLoading(false);
      });
  }, [token, user]);

  const handleLogin = (userData: UserData, userToken: string): void => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("pos-user", JSON.stringify(userData));
  };

  const handleLogout = (): void => {
    disconnectSocket();
    setUser(null);
    setToken(null);
    setCurrentShift(null);
    clearSession();
    clearCart();
  };

  const handleShiftOpened = (shift: CashShift): void => {
    setCurrentShift(shift);
  };

  const handleCloseShift = (): void => {
    setShowCloseShift(true);
  };

  const handleShiftClosed = (): void => {
    setCurrentShift(null);
    setShowCloseShift(false);
    handleLogout();
  };

  // Not logged in
  if (!token || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Loading shift state
  if (shiftLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-dark-500 border-t-primary-500" />
          <p className="text-sm text-dark-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  // No shift open — require opening one
  if (!currentShift) {
    return <OpenShiftScreen user={user} onShiftOpened={handleShiftOpened} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-dark-950">
      <MenuScreen
        user={user}
        shift={currentShift}
        onLogout={handleLogout}
        onCheckout={() => setShowPayment(true)}
        onCloseShift={handleCloseShift}
      />

      {showPayment && (
        <PaymentModal
          shiftId={currentShift.id}
          onComplete={(order) => {
            setCompletedOrder(order);
            setShowPayment(false);
            setShowReceipt(true);
          }}
          onClose={() => setShowPayment(false)}
        />
      )}

      {showReceipt && completedOrder && (
        <ReceiptModal
          order={completedOrder}
          onNewOrder={() => {
            setCompletedOrder(null);
            setShowReceipt(false);
          }}
        />
      )}

      {showCloseShift && (
        <CloseShiftScreen
          shiftId={currentShift.id}
          onShiftClosed={handleShiftClosed}
          onCancel={() => setShowCloseShift(false)}
        />
      )}
    </div>
  );
}

export default App;
