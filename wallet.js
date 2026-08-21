"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * wallet.js
 *
 * FILE 7 / 12
 *
 * سیستم کامل کیف پول و سکه مجازی
 * ================================================================
 */

/* ================================================================
   1. CONFIGURATION
================================================================ */

const WALLET_CONFIG = {
    INITIAL_COINS: 3000,
    GAME_ENTRY_FEE: 400,
    MIN_BALANCE_FOR_GAME: 400,
    MAX_TRANSACTION_AMOUNT: 1000000000,
    TRANSACTION_HISTORY_LIMIT: 100,
    PACKAGES: {
        SMALL: {
            id: "coins_200",
            coins: 200,
            price: 25000,
            title: "بسته ۲۰۰ سکه",
            description: "۲۰۰ سکه مجازی"
        },
        MEDIUM: {
            id: "coins_600",
            coins: 600,
            price: 40000,
            title: "بسته ۶۰۰ سکه",
            description: "۶۰۰ سکه مجازی"
        },
        LARGE: {
            id: "coins_1200",
            coins: 1200,
            price: 80000,
            title: "بسته ۱۲۰۰ سکه",
            description: "۱۲۰۰ سکه مجازی"
        }
    }
};

/* ================================================================
   2. WALLET STATE
================================================================ */

const walletState = {
    initialized: false,
    loading: false,
    processing: false,
    balance: 0,
    transactions: [],
    lastTransaction: null,
    pendingGamePayment: null,
    userId: null,
    profile: null,
    online: false
};

/* ================================================================
   3. WALLET EVENTS
================================================================ */

const walletEvents = {
    listeners: {},

    on(eventName, callback) {
        if (typeof callback !== "function") return;
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    },

    off(eventName, callback) {
        if (!this.listeners[eventName]) return;
        this.listeners[eventName] = this.listeners[eventName].filter(
            listener => listener !== callback
        );
    },

    emit(eventName, data) {
        const listeners = this.listeners[eventName] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error("Wallet Event Error:", eventName, error);
            }
        });
    }
};

/* ================================================================
   4. SUPABASE & AUTH
================================================================ */

function walletGetSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
        return window.supabase;
    }
    return null;
}

function walletToast(message, icon = "ℹ️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function walletLoading(show, message = "لطفاً صبر کنید...") {
    if (show && typeof window.showLoading === "function") {
        window.showLoading(message);
        return;
    }
    if (!show && typeof window.hideLoading === "function") {
        window.hideLoading();
    }
}

function walletGetCurrentUser() {
    if (typeof window.getCurrentUser === "function") return window.getCurrentUser();
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentUser === "function") {
        return window.hokmAuth.getCurrentUser();
    }
    return null;
}

function walletGetCurrentProfile() {
    if (typeof window.getCurrentProfile === "function") return window.getCurrentProfile();
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentProfile === "function") {
        return window.hokmAuth.getCurrentProfile();
    }
    return null;
}

function walletNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function formatWalletCoins(amount) {
    return walletNumber(amount).toLocaleString("fa-IR");
}

function formatWalletPrice(price) {
    return walletNumber(price).toLocaleString("fa-IR") + " تومان";
}

function generateWalletTransactionId() {
    return "TX-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

function getWalletBalance() {
    return walletNumber(walletState.balance);
}

function hasEnoughCoins(amount) {
    return getWalletBalance() >= walletNumber(amount);
}

function setWalletBalance(amount) {
    amount = Math.max(0, Math.floor(walletNumber(amount)));
    walletState.balance = amount;
    updateWalletUI();
    syncWalletWithGameState();
    return amount;
}

/* ================================================================
   5. BALANCE MANAGEMENT
================================================================ */

async function loadWalletBalance() {
    const profile = walletGetCurrentProfile();
    const user = walletGetCurrentUser();

    if (profile) {
        walletState.profile = profile;
        walletState.userId = profile.id || user?.id || null;
        walletState.balance = Math.max(0, walletNumber(profile.coins, WALLET_CONFIG.INITIAL_COINS));
        walletState.online = !!user;
        updateWalletUI();
        syncWalletWithGameState();
        return walletState.balance;
    }

    if (user) {
        walletState.userId = user.id;
        walletState.online = true;
    }

    if (walletState.balance <= 0) {
        walletState.balance = WALLET_CONFIG.INITIAL_COINS;
    }

    updateWalletUI();
    syncWalletWithGameState();
    return walletState.balance;
}

async function ensureInitialWalletCoins() {
    const profile = walletGetCurrentProfile();
    if (profile && profile.coins !== undefined && profile.coins !== null) {
        walletState.balance = Math.max(0, walletNumber(profile.coins));
        updateWalletUI();
        syncWalletWithGameState();
        return walletState.balance;
    }

    if (walletState.balance <= 0) {
        walletState.balance = WALLET_CONFIG.INITIAL_COINS;
    }

    updateWalletUI();
    syncWalletWithGameState();
    return walletState.balance;
}

async function updateProfileCoins(newBalance) {
    const client = walletGetSupabaseClient();
    const user = walletGetCurrentUser();
    newBalance = Math.max(0, Math.floor(walletNumber(newBalance)));

    if (!client || !user) {
        walletState.balance = newBalance;
        updateWalletUI();
        syncWalletWithGameState();
        return { success: true, balance: newBalance, offline: true };
    }

    try {
        const { data, error } = await client
            .from("profiles")
            .update({ coins: newBalance })
            .eq("id", user.id)
            .select()
            .single();

        if (error) {
            console.error("Wallet profile update error:", error);
            return { success: false, error };
        }

        walletState.balance = walletNumber(data?.coins, newBalance);
        walletState.profile = data;
        updateWalletUI();
        syncWalletWithGameState();
        return { success: true, balance: walletState.balance, profile: data };
    } catch (error) {
        return { success: false, error };
    }
}

/* ================================================================
   6. ADD & REMOVE COINS
================================================================ */

async function addCoins(amount, reason = "شارژ سکه", metadata = {}) {
    amount = Math.floor(walletNumber(amount));
    if (amount <= 0) return { success: false, error: "INVALID_AMOUNT" };
    if (amount > WALLET_CONFIG.MAX_TRANSACTION_AMOUNT) return { success: false, error: "AMOUNT_TOO_LARGE" };
    if (walletState.processing) {
        walletToast("یک تراکنش دیگر در حال انجام است.", "⏳");
        return { success: false, error: "TRANSACTION_IN_PROGRESS" };
    }

    walletState.processing = true;
    try {
        const oldBalance = getWalletBalance();
        const newBalance = oldBalance + amount;
        const updateResult = await updateProfileCoins(newBalance);

        if (!updateResult.success) return updateResult;

        const transaction = await createWalletTransaction({
            type: "credit",
            amount,
            balance_before: oldBalance,
            balance_after: newBalance,
            reason,
            metadata
        });

        walletState.lastTransaction = transaction;
        walletEvents.emit("coinsAdded", { amount, oldBalance, newBalance, transaction });
        updateWalletUI();
        syncWalletWithGameState();

        return { success: true, amount, balance: newBalance, transaction };
    } finally {
        walletState.processing = false;
    }
}

async function removeCoins(amount, reason = "هزینه", metadata = {}) {
    amount = Math.floor(walletNumber(amount));
    if (amount <= 0) return { success: false, error: "INVALID_AMOUNT" };

    if (!hasEnoughCoins(amount)) {
        walletToast("سکه کافی نداری.", "🪙", 3500);
        walletEvents.emit("insufficientCoins", { required: amount, balance: getWalletBalance() });
        return { success: false, error: "INSUFFICIENT_COINS", required: amount, balance: getWalletBalance() };
    }

    if (walletState.processing) {
        walletToast("یک تراکنش دیگر در حال انجام است.", "⏳");
        return { success: false, error: "TRANSACTION_IN_PROGRESS" };
    }

    walletState.processing = true;
    try {
        const oldBalance = getWalletBalance();
        const newBalance = oldBalance - amount;
        const updateResult = await updateProfileCoins(newBalance);

        if (!updateResult.success) return updateResult;

        const transaction = await createWalletTransaction({
            type: "debit",
            amount,
            balance_before: oldBalance,
            balance_after: newBalance,
            reason,
            metadata
        });

        walletState.lastTransaction = transaction;
        walletEvents.emit("coinsRemoved", { amount, oldBalance, newBalance, transaction });
        updateWalletUI();
        syncWalletWithGameState();

        return { success: true, amount, balance: newBalance, transaction };
    } finally {
        walletState.processing = false;
    }
}

async function payGameEntryFee(metadata = {}) {
    const fee = WALLET_CONFIG.GAME_ENTRY_FEE;
    const gameId = metadata.gameId || metadata.roomId || null;

    if (gameId && walletState.pendingGamePayment === gameId) {
        return { success: true, alreadyPaid: true, balance: getWalletBalance() };
    }

    if (!hasEnoughCoins(fee)) {
        walletToast(`برای بازی حداقل ${formatWalletCoins(fee)} سکه لازم داری.`, "🪙", 4000);
        walletEvents.emit("gamePaymentFailed", { reason: "INSUFFICIENT_COINS", required: fee, balance: getWalletBalance() });
        return { success: false, error: "INSUFFICIENT_COINS", required: fee, balance: getWalletBalance() };
    }

    const result = await removeCoins(fee, "هزینه ورود به بازی", { ...metadata, gameEntry: true });
    if (result.success) {
        if (gameId) walletState.pendingGamePayment = gameId;
        walletEvents.emit("gameEntryPaid", { fee, balance: result.balance, gameId, transaction: result.transaction });
        walletToast(`${formatWalletCoins(fee)} سکه بابت ورود به بازی پرداخت شد.`, "🎮", 3000);
    }
    return result;
}

async function refundGameEntryFee(metadata = {}) {
    const fee = WALLET_CONFIG.GAME_ENTRY_FEE;
    const result = await addCoins(fee, "بازگشت هزینه ورود به بازی", { ...metadata, refund: true });
    if (result.success) {
        walletState.pendingGamePayment = null;
        walletToast(`${formatWalletCoins(fee)} سکه به کیف پول بازگشت داده شد.`, "↩️");
    }
    return result;
}

/* ================================================================
   7. TRANSACTIONS & PACKAGES
================================================================ */

async function createWalletTransaction(transactionData = {}) {
    const client = walletGetSupabaseClient();
    const user = walletGetCurrentUser();

    const transaction = {
        id: generateWalletTransactionId(),
        user_id: user?.id || null,
        type: transactionData.type || "unknown",
        amount: walletNumber(transactionData.amount),
        balance_before: walletNumber(transactionData.balance_before),
        balance_after: walletNumber(transactionData.balance_after),
        reason: transactionData.reason || "",
        metadata: transactionData.metadata || {},
        created_at: new Date().toISOString()
    };

    if (client && user) {
        try {
            await client.from("coin_transactions").insert({
                user_id: user.id,
                amount: transaction.type === "credit" ? transaction.amount : -transaction.amount,
                balance_before: transaction.balance_before,
                balance_after: transaction.balance_after,
                transaction_type: transaction.type === "credit" ? "bonus" : "game_entry",
                description: transaction.reason
            });
        } catch (error) {
            console.warn("Wallet transaction save warning:", error);
        }
    }

    walletState.transactions.unshift(transaction);
    if (walletState.transactions.length > WALLET_CONFIG.TRANSACTION_HISTORY_LIMIT) {
        walletState.transactions = walletState.transactions.slice(0, WALLET_CONFIG.TRANSACTION_HISTORY_LIMIT);
    }

    walletEvents.emit("transactionCreated", transaction);
    return transaction;
}

async function loadWalletTransactions(limit = WALLET_CONFIG.TRANSACTION_HISTORY_LIMIT) {
    const client = walletGetSupabaseClient();
    const user = walletGetCurrentUser();
    if (!client || !user) return walletState.transactions;

    try {
        const { data, error } = await client
            .from("coin_transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (!error && Array.isArray(data)) {
            walletState.transactions = data;
            updateWalletUI();
        }
        return walletState.transactions;
    } catch (error) {
        return walletState.transactions;
    }
}

function getCoinPackages() {
    return [
        { ...WALLET_CONFIG.PACKAGES.SMALL },
        { ...WALLET_CONFIG.PACKAGES.MEDIUM },
        { ...WALLET_CONFIG.PACKAGES.LARGE }
    ];
}

function getCoinPackage(packageId) {
    return getCoinPackages().find(item => item.id === packageId) || null;
}

async function startCoinPurchase(packageId) {
    const packageData = getCoinPackage(packageId);
    if (!packageData) {
        walletToast("بسته سکه پیدا نشد.", "❌");
        return { success: false, error: "PACKAGE_NOT_FOUND" };
    }

    const order = {
        orderId: "ORDER-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        packageId: packageData.id,
        coins: packageData.coins,
        price: packageData.price,
        status: "pending",
        createdAt: new Date().toISOString()
    };

    walletState.lastTransaction = order;
    walletEvents.emit("purchaseStarted", order);
    return { success: true, order };
}

async function confirmCoinPurchase(order) {
    if (!order || !order.packageId) return { success: false, error: "INVALID_ORDER" };
    const packageData = getCoinPackage(order.packageId);
    if (!packageData) return { success: false, error: "PACKAGE_NOT_FOUND" };

    const result = await addCoins(packageData.coins, `خرید ${packageData.title}`, {
        purchase: true,
        packageId: packageData.id,
        orderId: order.orderId || null,
        price: packageData.price
    });

    if (result.success) {
        walletEvents.emit("purchaseCompleted", { order, package: packageData, result });
        walletToast(`${formatWalletCoins(packageData.coins)} سکه به حساب شما اضافه شد.`, "🎉", 4000);
    }
    return result;
}

/* ================================================================
   8. UI & SYNC
================================================================ */

function updateWalletUI() {
    const balance = getWalletBalance();

    document.querySelectorAll("[data-wallet-balance], [data-user-coins], #coinBalance, #shopCoinBalance").forEach(element => {
        element.textContent = formatWalletCoins(balance);
    });

    document.querySelectorAll("[data-game-entry-fee]").forEach(element => {
        element.textContent = formatWalletCoins(WALLET_CONFIG.GAME_ENTRY_FEE);
    });

    walletEvents.emit("balanceUpdated", { balance });
}

function syncWalletWithGameState() {
    if (window.state?.player) {
        window.state.player.coins = getWalletBalance();
    }
    if (typeof window.updatePlayerUI === "function") {
        try { window.updatePlayerUI(); } catch (e) {}
    }
}

function renderCoinPackages(container = null) {
    const target = container || document.querySelector("[data-coin-packages], #coinPackages");
    if (!target) return;

    target.innerHTML = "";
    getCoinPackages().forEach(pkg => {
        const card = document.createElement("div");
        card.className = "coin-package-card";
        card.innerHTML = `
            <div>
                <div style="font-weight:bold; font-size:13px;">🪙 ${pkg.title}</div>
                <div style="font-size:11px; color:#aaa;">${formatWalletPrice(pkg.price)}</div>
            </div>
            <button type="button" class="coin-package-button" data-buy-coins="${pkg.id}">
                خرید
            </button>
        `;
        target.appendChild(card);
    });
}

function setupWalletButtons() {
    document.addEventListener("click", async event => {
        const button = event.target.closest("[data-buy-coins]");
        if (!button) return;
        event.preventDefault();
        const packageId = button.getAttribute("data-buy-coins");
        const res = await startCoinPurchase(packageId);
        if (res.success) {
            walletToast("سفارش خرید آماده شد.", "💳", 4000);
        }
    });
}

/* ================================================================
   9. INITIALIZE & API
================================================================ */

async function initializeWallet() {
    if (walletState.initialized) return walletState;
    walletState.loading = true;

    try {
        const user = walletGetCurrentUser();
        const profile = walletGetCurrentProfile();
        walletState.userId = user?.id || profile?.id || null;
        walletState.profile = profile || null;
        walletState.online = !!user;

        await ensureInitialWalletCoins();
        await loadWalletTransactions();
        updateWalletUI();
        renderCoinPackages();
        syncWalletWithGameState();

        walletState.initialized = true;
        walletEvents.emit("initialized", { balance: walletState.balance, userId: walletState.userId });
        console.log("Hokm Online Wallet initialized successfully.");
    } catch (error) {
        console.error("Wallet initialization error:", error);
    } finally {
        walletState.loading = false;
    }
    return walletState;
}

window.hokmWallet = {
    initialize: initializeWallet,
    getBalance: getWalletBalance,
    setBalance: setWalletBalance,
    addCoins,
    removeCoins,
    hasEnoughCoins,
    canStartGame: () => hasEnoughCoins(WALLET_CONFIG.GAME_ENTRY_FEE),
    getGameEntryFee: () => WALLET_CONFIG.GAME_ENTRY_FEE,
    payGameEntryFee,
    refundGameEntryFee,
    getCoinPackages,
    getCoinPackage,
    startCoinPurchase,
    confirmCoinPurchase,
    loadTransactions: loadWalletTransactions,
    updateUI: updateWalletUI,
    renderPackages: renderCoinPackages,
    on: (evt, cb) => walletEvents.on(evt, cb)
};

window.getWalletBalance = getWalletBalance;
window.addCoins = addCoins;
window.removeCoins = removeCoins;
window.hasEnoughCoins = hasEnoughCoins;
window.payGameEntryFee = payGameEntryFee;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        setupWalletButtons();
        initializeWallet();
    });
} else {
    setupWalletButtons();
    initializeWallet();
}
