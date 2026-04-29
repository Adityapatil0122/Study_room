import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingState from "../components/common/LoadingState.jsx";
import LogoutConfirmModal from "../components/common/LogoutConfirmModal.jsx";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { showAppToast, showLogoutToast } from "../lib/toast.js";

const EDITABLE_PROFILE_FIELDS = ["name", "email", "address", "city", "state", "pincode"];

const formatAmount = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const mergePayments = (data) => {
  if (Array.isArray(data)) return data;
  const offline = Array.isArray(data?.all) ? data.all : [];
  const online = Array.isArray(data?.online) ? data.online : [];
  return [...offline, ...online].sort((a, b) => {
    const left = new Date(a.payment_date ?? a.created_at ?? 0).getTime();
    const right = new Date(b.payment_date ?? b.created_at ?? 0).getTime();
    return right - left;
  });
};

const loadRazorpayCheckout = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.body.appendChild(script);
  });

function StudentPortalView() {
  const { api, student, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [seats, setSeats] = useState([]);
  const [showSeats, setShowSeats] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [requestingQr, setRequestingQr] = useState(false);
  const [processingRazorpay, setProcessingRazorpay] = useState(false);
  const [selectingSeatId, setSelectingSeatId] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  const loadPortal = useCallback(async () => {
    try {
      setError("");
      const [subData, paymentData, profileData] = await Promise.all([
        api.getStudentSubscription(),
        api.listMyPayments(),
        api.getStudentProfile(),
      ]);
      setSubscription(subData);
      setPayments(mergePayments(paymentData));
      setProfile(profileData);
      const nextProfileForm = {};
      EDITABLE_PROFILE_FIELDS.forEach((field) => {
        nextProfileForm[field] = profileData?.[field] ?? "";
      });
      setProfileForm(nextProfileForm);
    } catch (err) {
      setError(err?.message ?? "Failed to load your account.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const recentPayments = useMemo(() => payments.slice(0, 5), [payments]);
  const scheduledRequest = subscription?.scheduled_request ?? null;
  const pendingQr = subscription?.pending_qr ?? null;

  const refresh = () => {
    setRefreshing(true);
    loadPortal();
  };

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const handleLogoutConfirmed = () => {
    setLogoutConfirmOpen(false);
    showLogoutToast("student");
    logout();
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await api.updateStudentProfile(profileForm);
      setProfile(updated);
      setEditingProfile(false);
      showAppToast("Profile updated.", "success");
    } catch (err) {
      showAppToast(err?.message ?? "Could not update profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const requestQrApproval = async () => {
    if (!scheduledRequest) {
      showAppToast("Payment details are not available yet.", "info");
      return;
    }

    setRequestingQr(true);
    try {
      const result = await api.requestQrPayment({
        plan_id: scheduledRequest.plan_id,
        is_renewal: Boolean(profile?.renewal_date),
        scheduled_request_id: scheduledRequest.id,
      });
      showAppToast(
        result?.already_pending
          ? "Your request is already pending."
          : "Admin has been notified.",
        "success"
      );
      await loadPortal();
    } catch (err) {
      showAppToast(
        err?.message ?? "Could not send QR approval request.",
        "error"
      );
    } finally {
      setRequestingQr(false);
    }
  };

  const payWithRazorpay = async () => {
    if (!scheduledRequest) {
      showAppToast("Payment details are not available yet.", "info");
      return;
    }

    setProcessingRazorpay(true);
    try {
      await loadRazorpayCheckout();
      const order = await api.createScheduledOrder({
        request_id: scheduledRequest.id,
      });

      const total =
        scheduledRequest.total_amount ??
        Math.max(
          0,
          Number(scheduledRequest.amount ?? 0) +
            Number(scheduledRequest.deposit_amount ?? 0) -
            (scheduledRequest.discount_enabled
              ? Number(scheduledRequest.discount_amount ?? 0)
              : 0) +
            (scheduledRequest.late_fee_enabled
              ? Number(scheduledRequest.late_fee_amount ?? 0)
              : 0)
        );

      const checkout = new window.Razorpay({
        key: order.razorpay_key_id,
        amount: order.amount,
        currency: order.currency ?? "INR",
        name: "Aradhya Abhyasika",
        description: scheduledRequest.plan_name ?? "Library Membership",
        order_id: order.razorpay_order_id,
        prefill: {
          name: student?.name ?? profile?.name ?? "",
          email: student?.email ?? profile?.email ?? "",
          contact: student?.phone ?? profile?.phone ?? "",
        },
        theme: { color: "#4f46e5" },
        handler: async (result) => {
          try {
            await api.verifyScheduledPayment({
              razorpay_order_id: result.razorpay_order_id,
              razorpay_payment_id: result.razorpay_payment_id,
              razorpay_signature: result.razorpay_signature,
              scheduled_request_id: scheduledRequest.id,
            });
            showAppToast(`${formatAmount(total)} paid successfully.`, "success");
            await loadPortal();
            setActiveTab("home");
          } catch (err) {
            showAppToast(err?.message ?? "Payment verification failed.", "error");
          } finally {
            setProcessingRazorpay(false);
          }
        },
        modal: {
          ondismiss: () => setProcessingRazorpay(false),
        },
      });

      checkout.open();
    } catch (err) {
      showAppToast(err?.message ?? "Could not start Razorpay checkout.", "error");
      setProcessingRazorpay(false);
    }
  };

  const loadSeats = async () => {
    setShowSeats(true);
    try {
      const data = await api.listAvailableSeats();
      setSeats(
        [...(data ?? [])].sort((left, right) =>
          String(left?.seat_number ?? "").localeCompare(
            String(right?.seat_number ?? ""),
            undefined,
            { numeric: true, sensitivity: "base" }
          )
        )
      );
    } catch (err) {
      showAppToast(err?.message ?? "Could not load seats.", "error");
    }
  };

  const selectSeat = async (seat) => {
    if (!window.confirm(`Select seat ${seat.seat_number}?`)) return;
    setSelectingSeatId(seat.id);
    try {
      await api.selectSeat(seat.id);
      showAppToast(`Seat ${seat.seat_number} assigned.`, "success");
      setShowSeats(false);
      setSeats([]);
      await loadPortal();
    } catch (err) {
      showAppToast(err?.message ?? "Could not select seat.", "error");
    } finally {
      setSelectingSeatId(null);
    }
  };

  if (loading) {
    return <LoadingState message="Loading student portal..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <img
              src="/images/logo.png"
              alt="Aardhya Abhyasika"
              className="h-14 w-14 rounded-full border border-slate-200 object-contain"
            />
            <div>
              <p className="text-sm text-slate-500">Welcome back,</p>
              <h1 className="text-2xl font-semibold text-slate-900">
                {student?.name ?? profile?.name ?? "Student"}
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <TabButton
              icon="home"
              label="Home"
              active={activeTab === "home"}
              onClick={() => setActiveTab("home")}
            />
            <TabButton
              icon="creditCard"
              label="Payments"
              active={activeTab === "payments"}
              onClick={() => setActiveTab("payments")}
            />
            <TabButton
              icon="user"
              label="Profile"
              active={activeTab === "profile"}
              onClick={() => setActiveTab("profile")}
            />
          </nav>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:text-indigo-600 disabled:opacity-60"
          >
            <LucideIcon
              name="refreshCw"
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {activeTab === "home" ? (
          <HomeTab
            subscription={subscription}
            recentPayments={recentPayments}
            onShowPayments={() => setActiveTab("payments")}
            onPay={() => setActiveTab("payments")}
            onLoadSeats={loadSeats}
          />
        ) : null}

        {activeTab === "payments" ? (
          <PaymentsTab
            payments={payments}
            scheduledRequest={scheduledRequest}
            pendingQr={pendingQr}
            onRequestQr={requestQrApproval}
            onPayRazorpay={payWithRazorpay}
            requestingQr={requestingQr}
            processingRazorpay={processingRazorpay}
          />
        ) : null}

        {activeTab === "profile" ? (
          <ProfileTab
            profile={profile}
            form={profileForm}
            editing={editingProfile}
            saving={savingProfile}
            onEdit={() => setEditingProfile(true)}
            onCancel={() => {
              setEditingProfile(false);
              loadPortal();
            }}
            onChange={handleProfileChange}
            onSave={saveProfile}
            onLogout={handleLogout}
          />
        ) : null}
      </main>

      {showSeats ? (
        <SeatPicker
          seats={seats}
          selectingSeatId={selectingSeatId}
          onClose={() => setShowSeats(false)}
          onSelect={selectSeat}
        />
      ) : null}
      <LogoutConfirmModal
        open={logoutConfirmOpen}
        role="user"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogoutConfirmed}
      />
    </div>
  );
}

function HomeTab({ subscription, recentPayments, onShowPayments, onPay, onLoadSeats }) {
  const daysRemaining = subscription?.days_remaining;
  const hasPlan = Boolean(subscription?.plan);
  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isExpiring = daysRemaining !== null && daysRemaining <= 7;
  const showPaymentButton =
    subscription?.membership_status !== "on_hold" &&
    !subscription?.pending_qr &&
    !subscription?.scheduled_request &&
    (!hasPlan || (daysRemaining !== null && daysRemaining <= 7));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Current Plan
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {subscription?.plan?.name ?? "No plan active"}
          </h2>
          {subscription?.plan ? (
            <p className="mt-2 text-slate-600">
              {formatAmount(subscription.plan.price)} /{" "}
              {subscription.plan.duration_days} days
            </p>
          ) : null}

          <div className="my-6 h-px bg-slate-200" />

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Renewal Date" value={subscription?.renewal_date ?? "-"} />
            <Stat
              label="Days Left"
              value={daysRemaining ?? "-"}
              tone={isExpired ? "red" : isExpiring ? "amber" : "slate"}
            />
            <Stat
              label="Seat"
              value={subscription?.seat?.seat_number ?? "-"}
              tone={subscription?.seat ? "emerald" : "slate"}
            />
          </div>
        </div>

        {subscription?.membership_status === "on_hold" ? (
          <Notice
            tone="amber"
            title="Membership On Hold"
            message={`Your membership is paused since ${
              subscription.hold_start ? formatDate(subscription.hold_start) : "recently"
            }.`}
          />
        ) : null}

        {subscription?.scheduled_request ? (
          <Notice
            tone="indigo"
            title="Payment Request from Admin"
            message={`${formatAmount(subscription.scheduled_request.total_amount ?? subscription.scheduled_request.amount)} due for ${subscription.scheduled_request.plan_name ?? "membership"}.`}
            actionLabel="View Payment"
            onAction={onPay}
          />
        ) : null}

        {subscription?.pending_qr ? (
          <Notice
            tone="amber"
            title="Payment Pending Approval"
            message={`${formatAmount(subscription.pending_qr.amount)} submitted on ${formatDate(subscription.pending_qr.submitted_at)}.`}
          />
        ) : null}

        {hasPlan && daysRemaining > 0 ? (
          <Notice
            tone="emerald"
            title="Plan Active"
            message={`Your ${subscription.plan.name} plan is active. ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining.`}
          />
        ) : null}

        {subscription?.seat_selection_allowed ? (
          <button
            type="button"
            onClick={onLoadSeats}
            className="flex w-full items-center justify-between rounded-2xl bg-emerald-600 p-5 text-left text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500"
          >
            <span>
              <span className="block text-base font-semibold">Select Your Seat</span>
              <span className="text-sm text-emerald-100">Pick your spot in the library</span>
            </span>
            <LucideIcon name="arrowRight" className="h-6 w-6" />
          </button>
        ) : null}

        {showPaymentButton ? (
          <button
            type="button"
            onClick={onPay}
            className="btn-gradient-primary flex w-full items-center justify-between rounded-2xl p-5 text-left shadow-lg shadow-indigo-600/20"
          >
            <span>
              <span className="block text-base font-semibold">
                {hasPlan ? "Renew Plan" : "Make a Payment"}
              </span>
              <span className="text-sm text-indigo-100">
                {hasPlan ? "Renew from the payments tab" : "Wait for admin request or pay after request is sent"}
              </span>
            </span>
            <LucideIcon name="arrowRight" className="h-6 w-6" />
          </button>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Payments</h2>
          <button
            type="button"
            onClick={onShowPayments}
            className="text-sm font-bold text-indigo-600"
          >
            View All
          </button>
        </div>
        <div className="space-y-3">
          {recentPayments.length ? (
            recentPayments.map((payment, index) => (
              <PaymentRow
                key={`${payment.id ?? index}-${payment.payment_mode ?? "mode"}`}
                payment={payment}
              />
            ))
          ) : (
            <EmptyState icon="receipt" title="No payments yet" />
          )}
        </div>
      </section>
    </div>
  );
}

function PaymentsTab({
  payments,
  scheduledRequest,
  pendingQr,
  onRequestQr,
  onPayRazorpay,
  requestingQr,
  processingRazorpay,
}) {
  const scheduledTotal =
    scheduledRequest?.total_amount ??
    Math.max(
      0,
      Number(scheduledRequest?.amount ?? 0) +
        Number(scheduledRequest?.deposit_amount ?? 0) -
        (scheduledRequest?.discount_enabled
          ? Number(scheduledRequest?.discount_amount ?? 0)
          : 0) +
        (scheduledRequest?.late_fee_enabled
          ? Number(scheduledRequest?.late_fee_amount ?? 0)
          : 0)
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Payments</h2>
          <p className="mt-1 text-slate-500">
            Your full payment history and admin payment requests.
          </p>
        </div>
      </div>

      {scheduledRequest ? (
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                Payment Request
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {formatAmount(scheduledTotal)}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {scheduledRequest.plan_name ?? "Membership"} -{" "}
                {formatDate(scheduledRequest.valid_from)} to{" "}
                {formatDate(scheduledRequest.valid_until)}
              </p>
              {scheduledRequest.notes ? (
                <p className="mt-2 text-sm italic text-slate-400">
                  &quot;{scheduledRequest.notes}&quot;
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onPayRazorpay}
                disabled={processingRazorpay}
                className="btn-gradient-primary rounded-2xl px-5 py-3 text-sm font-bold shadow-lg shadow-indigo-600/20 disabled:bg-none disabled:bg-indigo-300"
              >
                {processingRazorpay
                  ? "Opening Razorpay..."
                  : `Pay ${formatAmount(scheduledTotal)} via Razorpay`}
              </button>
              <button
                type="button"
                onClick={onRequestQr}
                disabled={requestingQr || Boolean(pendingQr)}
                className="rounded-2xl border-2 border-emerald-600 bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:border-emerald-200 disabled:text-emerald-300"
              >
                {pendingQr
                  ? "Approval Pending"
                  : requestingQr
                  ? "Sending..."
                  : "I Paid via QR - Notify Admin"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Notice
          tone="slate"
          title="Waiting for Admin"
          message="Your payment details have not been set up yet. The admin will send your plan and amount shortly."
        />
      )}

      {pendingQr ? (
        <Notice
          tone="amber"
          title="QR Payment Pending Approval"
          message={`${formatAmount(pendingQr.amount)} is waiting for admin approval.`}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {payments.length ? (
          payments.map((payment, index) => (
            <PaymentCard
              key={`${payment.id ?? index}-${payment.payment_mode ?? "mode"}`}
              payment={payment}
            />
          ))
        ) : (
          <div className="lg:col-span-2">
            <EmptyState icon="receipt" title="No payments yet" />
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileTab({
  profile,
  form,
  editing,
  saving,
  onEdit,
  onCancel,
  onChange,
  onSave,
  onLogout,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">My Profile</h2>
          <p className="mt-1 text-slate-500">View and edit your details</p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={onEdit}
            className="btn-gradient-primary rounded-xl px-5 py-3 text-sm font-bold"
          >
            Edit
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Editable Information
          </p>
          <EditableField
            label="Full Name"
            name="name"
            value={editing ? form.name : profile?.name}
            editing={editing}
            onChange={onChange}
          />
          <EditableField
            label="Email"
            name="email"
            value={editing ? form.email : profile?.email}
            editing={editing}
            onChange={onChange}
          />
          <EditableField
            label="Address"
            name="address"
            value={editing ? form.address : profile?.address}
            editing={editing}
            onChange={onChange}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <EditableField
              label="City"
              name="city"
              value={editing ? form.city : profile?.city}
              editing={editing}
              onChange={onChange}
            />
            <EditableField
              label="State"
              name="state"
              value={editing ? form.state : profile?.state}
              editing={editing}
              onChange={onChange}
            />
          </div>
          <EditableField
            label="Pincode"
            name="pincode"
            value={editing ? form.pincode : profile?.pincode}
            editing={editing}
            onChange={onChange}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Read-Only Information
          </p>
          <ReadOnlyField label="Phone" value={profile?.phone} />
          <ReadOnlyField label="Gender" value={profile?.gender} />
          <ReadOnlyField label="Aadhaar" value={profile?.aadhaar} />
          <ReadOnlyField label="PAN" value={profile?.pan_card} />
          <ReadOnlyField label="Join Date" value={profile?.join_date} />
          <ReadOnlyField label="Preferred Shift" value={profile?.preferred_shift} />
        </section>
      </div>

      {editing ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-gradient-primary rounded-xl px-5 py-3 text-sm font-bold disabled:bg-none disabled:bg-indigo-300"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50"
        >
          Logout
        </button>
      )}
    </div>
  );
}

function TabButton({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
        active
          ? "btn-gradient-primary"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      <LucideIcon name={icon} className="h-4 w-4" />
      {label}
    </button>
  );
}

function Stat({ label, value, tone = "slate" }) {
  const tones = {
    slate: "text-slate-950",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tones[tone] ?? tones.slate}`}>
        {value}
      </p>
    </div>
  );
}

function Notice({ tone, title, message, actionLabel, onAction }) {
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    slate: "border-slate-200 bg-white text-slate-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${styles[tone] ?? styles.slate}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm opacity-90">{message}</p>
        </div>
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-bold"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PaymentRow({ payment }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-950">
          {payment.plan_name ?? "Payment"}
        </p>
        <p className="mt-1 truncate text-xs text-slate-500">
          {(payment.payment_mode ?? "-").toUpperCase()} -{" "}
          {payment.valid_from ?? "-"} to {payment.valid_until ?? "-"}
        </p>
      </div>
      <p className="shrink-0 font-semibold text-slate-900">
        {formatAmount(payment.amount_paid ?? payment.amount)}
      </p>
    </div>
  );
}

function PaymentCard({ payment }) {
  const badge = modeBadge(payment.payment_mode);
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1 bg-indigo-600" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {payment.plan_name ?? "Payment"}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {formatDate(payment.payment_date ?? payment.created_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-slate-900">
              {formatAmount(payment.amount_paid ?? payment.amount)}
            </p>
            <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              PAID
            </span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span
            className={`rounded-xl px-3 py-1 text-xs font-bold ${badge.className}`}
          >
            {badge.label}
          </span>
          {payment.valid_from && payment.valid_until ? (
            <span className="rounded-xl bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {payment.valid_from} to {payment.valid_until}
            </span>
          ) : null}
        </div>
        {payment.notes ? (
          <p className="mt-4 text-sm italic text-slate-400">
            &quot;{payment.notes}&quot;
          </p>
        ) : null}
      </div>
    </article>
  );
}

function modeBadge(mode) {
  const normalized = mode?.toLowerCase() ?? "";
  if (normalized === "razorpay") {
    return { label: "Razorpay", className: "bg-violet-50 text-violet-700" };
  }
  if (normalized === "qr" || normalized === "upi") {
    return { label: "QR / UPI", className: "bg-emerald-50 text-emerald-700" };
  }
  if (normalized === "cash") {
    return { label: "Cash", className: "bg-amber-50 text-amber-700" };
  }
  return { label: mode?.toUpperCase() ?? "-", className: "bg-slate-100 text-slate-700" };
}

function EditableField({ label, name, value, editing, onChange }) {
  return (
    <label className="mb-4 block">
      <span className="text-sm text-slate-500">{label}</span>
      {editing ? (
        <input
          name={name}
          value={value ?? ""}
          onChange={onChange}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      ) : (
        <span className="mt-1 block font-bold text-slate-950">
          {value || "-"}
        </span>
      )}
    </label>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="mb-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value || "-"}</p>
    </div>
  );
}

function EmptyState({ icon, title }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <LucideIcon name={icon} className="mx-auto h-9 w-9 text-slate-300" />
      <p className="mt-3 font-bold text-slate-700">{title}</p>
    </div>
  );
}

function SeatPicker({ seats, selectingSeatId, onClose, onSelect }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Choose Your Seat
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select an available seat. Contact admin to change it later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500"
          >
            <LucideIcon name="x" className="h-5 w-5" />
          </button>
        </div>

        {seats.length ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
            {seats.map((seat) => {
              const busy = selectingSeatId === seat.id;
              return (
                <button
                  type="button"
                  key={seat.id}
                  onClick={() => onSelect(seat)}
                  disabled={Boolean(selectingSeatId)}
                  className="aspect-square rounded-2xl border-2 border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  {busy ? (
                    <LucideIcon name="loader2" className="mx-auto h-5 w-5 animate-spin" />
                  ) : (
                    seat.seat_number
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="armchair" title="No seats are currently available" />
        )}
      </div>
    </div>
  );
}

export default StudentPortalView;
