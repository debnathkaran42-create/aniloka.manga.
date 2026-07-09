/* ANILOKA — PREMIUM PAGE
   -----------------------------------------------------------
   Tries real Razorpay Checkout first (js/payment-config.js).
   Falls back to a simulated checkout automatically when no
   real Razorpay key is configured yet, so everything keeps
   working out of the box.
   ========================================================= */
(function () {
  if (!AUTH.requireLogin()) return;
  const session = DB.getSession();
  let user = DB.getUser(session.uid);

  const modal = document.getElementById("checkout-modal-backdrop");
  const planSummary = document.getElementById("plan-summary");
  let selectedPlan = null;

  const prices = DB.getSettings().premiumPrices || { weekly: 2.99, monthly: 8.99, yearly: 69.99 };
  const PLANS = {
    weekly: { label: "Weekly", price: `₹${prices.weekly.toFixed(2)}`, amount: prices.weekly, period: "/week" },
    monthly: { label: "Monthly", price: `₹${prices.monthly.toFixed(2)}`, amount: prices.monthly, period: "/month" },
    yearly: { label: "Yearly", price: `₹${prices.yearly.toFixed(2)}`, amount: prices.yearly, period: "/year" }
  };

  // Reflect current prices on the visible plan cards (admin can edit these in Admin Panel → Site Settings)
  document.querySelectorAll(".plan-card .btn[data-plan]").forEach(btn => {
    const plan = PLANS[btn.dataset.plan];
    const priceEl = btn.closest(".plan-card").querySelector(".plan-price");
    if (priceEl && plan) priceEl.innerHTML = `${plan.price}<span>${plan.period}</span>`;
  });

  function renderStatus() {
    const banner = document.getElementById("current-plan-banner");
    if (user.isPremium) {
      banner.classList.remove("hidden");
      banner.querySelector(".plan-detail").textContent = `${PLANS[user.premiumPlan]?.label || "Premium"} plan active`;
    } else {
      banner.classList.add("hidden");
    }
    document.querySelectorAll(".plan-card .btn").forEach(btn => {
      const isCurrent = user.isPremium && btn.dataset.plan === user.premiumPlan;
      btn.textContent = isCurrent ? "Current Plan" : "Choose Plan";
      btn.disabled = isCurrent;
    });
  }

  function grantPremium(plan, meta) {
    user = DB.saveUser(session.uid, { isPremium: true, premiumPlan: plan });
    const purchases = DB._read("aniloka_purchases_" + session.uid, []);
    purchases.unshift({ plan: PLANS[plan].label, date: new Date().toLocaleDateString(), ...meta });
    DB._write("aniloka_purchases_" + session.uid, purchases);
    toast(`Welcome to AniLoka Premium — ${PLANS[plan].label} plan active!`, "success");
    applyPremiumTheme();
    renderStatus();
  }

  document.querySelectorAll(".plan-card .btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedPlan = btn.dataset.plan;
      const p = PLANS[selectedPlan];

      const openedReal = openRazorpayCheckout({
        amountRupees: p.amount,
        description: `AniLoka Premium — ${p.label} Plan`,
        prefillEmail: session.email,
        onSuccess: (response) => grantPremium(selectedPlan, { razorpay_payment_id: response.razorpay_payment_id, real: true })
      });
      if (openedReal) return;

      // Fallback: simulated checkout (no real Razorpay key configured yet)
      planSummary.innerHTML = `<b>${p.label} Plan</b><br>${p.price}${p.period} — billed to a simulated card ending 4242.`;
      modal.classList.add("open");
    });
  });

  document.getElementById("close-checkout").addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

  document.getElementById("confirm-purchase").addEventListener("click", () => {
    const btn = document.getElementById("confirm-purchase");
    btn.disabled = true; btn.textContent = "Processing…";

    setTimeout(() => {
      grantPremium(selectedPlan, { simulated: true });
      btn.disabled = false; btn.textContent = "Confirm & Pay";
      modal.classList.remove("open");
    }, 900);
  });

  document.getElementById("cancel-premium")?.addEventListener("click", () => {
    if (!confirm("Cancel your Premium subscription?")) return;
    user = DB.saveUser(session.uid, { isPremium: false, premiumPlan: null });
    applyPremiumTheme();
    renderStatus();
    toast("Premium canceled. You've been moved back to the free plan.", "info");
  });

  renderStatus();
  initNav("premium");
  hidePageLoader();
})();
