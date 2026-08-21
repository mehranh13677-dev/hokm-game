"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * main.js
 *
 * فایل شماره ۱۲ از ۱۲
 *
 * هسته هماهنگ‌کننده اصلی برنامه
 * ================================================================
 */

/* ================================================================
   1. APPLICATION STATE
================================================================ */

const appState = {
    initialized: false,
    loading: false,
    currentPage: "home",
    previousPage: null,
    currentRoom: null,
    currentGame: null,
    navigationLocked: false,
    mobileMenuOpen: false,
    modalOpen: false,
    lastError: null,
    lastAction: null,
    online: navigator.onLine,
    bootTime: Date.now(),
    eventsBound: false
};

/* ================================================================
   2. APPLICATION EVENTS
================================================================ */

const appEvents = {
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

    emit(eventName, data = null) {
        const listeners = this.listeners[eventName] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`خطا در App Event: ${eventName}`, error);
            }
        });
    }
};

/* ================================================================
   3. SAFE MODULE ACCESS & HELPERS
================================================================ */

function getModule(name) {
    if (window[name]) return window[name];
    return null;
}

function appToast(message, icon = "ℹ️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function appLoading(show, message = "لطفاً صبر کنید...") {
    appState.loading = !!show;
    if (show && typeof window.showLoading === "function") {
        window.showLoading(message);
        return;
    }
    if (!show && typeof window.hideLoading === "function") {
        window.hideLoading();
    }
}

function $(selector, parent = document) {
    return parent.querySelector(selector);
}

function $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}

function getElement(id) {
    return document.getElementById(id);
}

function setText(selector, value) {
    $$(selector).forEach(element => {
        element.textContent = value ?? "";
    });
}

function showElement(element) {
    if (!element) return;
    element.hidden = false;
    element.style.display = "";
}

function hideElement(element) {
    if (!element) return;
    element.hidden = true;
    element.style.display = "none";
}

/* ================================================================
   4. NAVIGATION & PAGES
================================================================ */

function getPageElements() {
    return {
        home: $("[data-page='home']") || getElement("homeScreen") || getElement("homePage"),
        profile: $("[data-page='profile']") || getElement("profileScreen") || getElement("profilePage"),
        shop: $("[data-page='shop']") || getElement("shopScreen") || getElement("shopPage"),
        ranking: $("[data-page='ranking']") || getElement("leaderboardScreen") || getElement("rankingPage"),
        settings: $("[data-page='settings']") || getElement("settingsScreen") || getElement("settingsPage"),
        game: $("[data-page='game']") || getElement("gameScreen") || getElement("gamePage"),
        room: $("[data-page='room']") || getElement("roomScreen") || getElement("roomPage"),
        friends: $("[data-page='friends']") || getElement("friendsScreen") || getElement("friendsPage"),
        notifications: $("[data-page='notifications']") || getElement("notificationsScreen") || getElement("notificationsPage")
    };
}

function hideAllPages() {
    const pages = getPageElements();
    Object.values(pages).forEach(page => {
        if (!page) return;
        page.classList.remove("active", "page-active", "active-screen");
        page.classList.add("hidden");
        page.hidden = true;
        page.style.display = "none";
    });
}

function showPage(pageName) {
    const pages = getPageElements();
    const page = pages[pageName];
    if (!page) {
        console.warn(`صفحه ${pageName} پیدا نشد.`);
        return false;
    }

    hideAllPages();
    page.classList.remove("hidden");
    page.hidden = false;
    page.style.display = "";
    page.classList.add("active", "page-active", "active-screen");

    appState.previousPage = appState.currentPage;
    appState.currentPage = pageName;
    updateNavigationUI(pageName);

    appEvents.emit("pageChanged", {
        page: pageName,
        previousPage: appState.previousPage
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
}

function updateNavigationUI(pageName) {
    $$("[data-page-link], [data-screen]").forEach(link => {
        const target = link.dataset.pageLink || link.dataset.screen;
        const active = target === pageName;
        link.classList.toggle("active", active);
        link.classList.toggle("selected", active);
        link.setAttribute("aria-current", active ? "page" : "false");
    });
}

async function navigateTo(pageName, options = {}) {
    if (!pageName || appState.navigationLocked) return false;
    appState.navigationLocked = true;

    try {
        const protectedPages = ["profile", "friends", "notifications", "settings", "room", "game"];
        if (protectedPages.includes(pageName)) {
            const auth = getModule("hokmAuth");
            if (auth && typeof auth.isLoggedIn === "function" && !auth.isLoggedIn()) {
                appToast("برای ورود به این بخش ابتدا وارد حساب شوید.", "🔐", 3500);
                showAuthScreen();
                return false;
            }
        }

        if (pageName === "shop") await refreshShop();
        if (pageName === "profile") await refreshProfile();
        if (pageName === "friends") await refreshFriends();
        if (pageName === "notifications") await refreshNotifications();
        if (pageName === "ranking") await refreshLeaderboard();
        if (pageName === "settings") await refreshSettings();

        const result = showPage(pageName);
        if (options.closeMenu !== false) closeMobileMenu();
        return result;
    } finally {
        setTimeout(() => { appState.navigationLocked = false; }, 50);
    }
}

/* ================================================================
   5. AUTH, MODAL & MOBILE MENU
================================================================ */

function showAuthScreen() {
    const authModal = $("[data-modal='auth']") || getElement("authModal");
    if (authModal) {
        showModal(authModal);
        return;
    }
    showPage("authScreen");
}

function showModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.hidden = false;
    modal.style.display = "flex";
    modal.classList.add("active");
    document.body.classList.add("modal-open");
    appState.modalOpen = true;
}

function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove("active");
    modal.classList.add("hidden");
    modal.hidden = true;
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
    appState.modalOpen = false;
}

function closeAllModals() {
    $$("[data-modal], .modal").forEach(modal => hideModal(modal));
    appState.modalOpen = false;
}

function openMobileMenu() {
    appState.mobileMenuOpen = true;
    document.body.classList.add("menu-open");
    const menu = $("[data-mobile-menu]") || getElement("mobileMenu");
    if (menu) menu.classList.add("open", "active");
}

function closeMobileMenu() {
    appState.mobileMenuOpen = false;
    document.body.classList.remove("menu-open");
    const menu = $("[data-mobile-menu]") || getElement("mobileMenu");
    if (menu) menu.classList.remove("open", "active");
}

function toggleMobileMenu() {
    if (appState.mobileMenuOpen) closeMobileMenu();
    else openMobileMenu();
}

/* ================================================================
   6. USER ACTIONS & AUTH HANDLERS
================================================================ */

async function handleLoginSubmit(form) {
    if (!form) return;
    const email = form.querySelector("[name='email'], #emailInput")?.value || "";
    const password = form.querySelector("[name='password'], #passwordInput")?.value || "";
    const auth = getModule("hokmAuth");

    if (!auth || typeof auth.signIn !== "function") {
        appToast("سیستم ورود آماده نیست.", "⚠️");
        return;
    }

    const result = await auth.signIn(email, password);
    if (result?.success) {
        closeAllModals();
        await refreshAllUserData();
        navigateTo("home");
    }
}

async function handleRegisterSubmit(form) {
    if (!form) return;
    const email = form.querySelector("[name='email']")?.value || "";
    const password = form.querySelector("[name='password']")?.value || "";
    const displayName = form.querySelector("[name='display_name']")?.value || "";
    const auth = getModule("hokmAuth");

    if (!auth || typeof auth.signUp !== "function") {
        appToast("سیستم ثبت‌نام آماده نیست.", "⚠️");
        return;
    }

    const result = await auth.signUp(email, password, displayName);
    if (result?.success) {
        closeAllModals();
        await refreshAllUserData();
        navigateTo("home");
    }
}

async function handleLogout() {
    const auth = getModule("hokmAuth");
    if (!auth || typeof auth.signOut !== "function") return;

    const confirmed = window.confirm("آیا مطمئن هستید که می‌خواهید از حساب خارج شوید؟");
    if (!confirmed) return;

    appLoading(true, "در حال خروج...");
    try {
        await auth.signOut();
    } finally {
        appLoading(false);
        appState.currentRoom = null;
        appState.currentGame = null;
        navigateTo("home");
    }
}

/* ================================================================
   7. ROOM & GAME ACTIONS
================================================================ */

async function startQuickGame() {
    const auth = getModule("hokmAuth");
    if (auth && typeof auth.isLoggedIn === "function" && !auth.isLoggedIn()) {
        showAuthScreen();
        appToast("برای شروع بازی باید وارد حساب شوید.", "🔐");
        return;
    }

    const wallet = getModule("hokmWallet");
    const GAME_COST = 400;
    if (wallet && typeof wallet.hasEnoughCoins === "function") {
        const enough = await wallet.hasEnoughCoins(GAME_COST);
        if (!enough) {
            appToast("برای بازی حداقل ۴۰۰ سکه نیاز دارید.", "🪙", 4000);
            navigateTo("shop");
            return;
        }
    }

    appLoading(true, "در حال پیدا کردن میز مناسب...");
    try {
        const room = getModule("hokmRoom");
        if (room && typeof room.quickMatch === "function") {
            const result = await room.quickMatch();
            if (result) {
                appState.currentRoom = result;
                navigateTo("room");
                return;
            }
        }

        const multiplayer = getModule("hokmMultiplayer");
        if (multiplayer && typeof multiplayer.quickMatch === "function") {
            const result = await multiplayer.quickMatch();
            if (result) {
                appState.currentRoom = result;
                navigateTo("room");
                return;
            }
        }

        if (typeof window.quickPlay === "function") {
            window.quickPlay();
            return;
        }

        appToast("در حال حاضر میز مناسبی پیدا نشد. دوباره تلاش کنید.", "🎮", 4000);
    } catch (error) {
        console.error("Quick Game Error:", error);
        appState.lastError = error;
        appToast("شروع بازی با مشکل مواجه شد.", "❌");
    } finally {
        appLoading(false);
    }
}

async function openCreateRoom() {
    const auth = getModule("hokmAuth");
    if (auth && typeof auth.isLoggedIn === "function" && !auth.isLoggedIn()) {
        showAuthScreen();
        return;
    }

    const modal = $("[data-modal='create-room']") || getElement("createRoomModal");
    if (modal) {
        showModal(modal);
        return;
    }

    if (typeof window.openCreateRoom === "function") {
        window.openCreateRoom();
        return;
    }

    await createRoomFromForm(null);
}

async function createRoomFromForm(form) {
    const room = getModule("hokmRoom");
    if (!room || typeof room.createRoom !== "function") {
        if (typeof window.createRoom === "function") {
            window.createRoom();
            return;
        }
        appToast("سیستم اتاق بازی آماده نیست.", "⚠️");
        return;
    }

    let settings = {
        players: 4,
        entryFee: 400,
        isPrivate: false,
        name: "میز حکم",
        timeControl: "normal"
    };

    if (form) {
        settings.players = Number(form.querySelector("[name='players']")?.value || 4);
        settings.entryFee = Number(form.querySelector("[name='entry_fee']")?.value || 400);
        settings.name = form.querySelector("[name='room_name']")?.value || "میز حکم";
        settings.isPrivate = !!form.querySelector("[name='private']")?.checked;
        settings.timeControl = form.querySelector("[name='time_control']")?.value || "normal";
    }

    appLoading(true, "در حال ساخت میز...");
    try {
        const result = await room.createRoom(settings);
        if (result) {
            appState.currentRoom = result;
            closeAllModals();
            navigateTo("room");
            appToast("میز با موفقیت ساخته شد.", "🎮");
        }
    } catch (error) {
        console.error("Create Room Error:", error);
        appToast("ساخت میز انجام نشد.", "❌");
    } finally {
        appLoading(false);
    }
}

async function joinRoom(roomId) {
    if (!roomId) return;
    const room = getModule("hokmRoom");
    if (!room || typeof room.joinRoom !== "function") {
        if (typeof window.joinRoom === "function") {
            window.joinRoom();
            return;
        }
        appToast("سیستم ورود به اتاق آماده نیست.", "⚠️");
        return;
    }

    appLoading(true, "در حال ورود به میز...");
    try {
        const result = await room.joinRoom(roomId);
        if (result) {
            appState.currentRoom = result;
            navigateTo("room");
        }
    } catch (error) {
        console.error("Join Room Error:", error);
        appToast("ورود به میز انجام نشد.", "❌");
    } finally {
        appLoading(false);
    }
}

async function leaveCurrentRoom() {
    const room = getModule("hokmRoom");
    if (room && typeof room.leaveRoom === "function") {
        try { await room.leaveRoom(); } catch (e) {}
    }
    if (typeof window.leaveRoom === "function") {
        window.leaveRoom();
    }
    appState.currentRoom = null;
    navigateTo("home");
}

async function startRoomGame() {
    const room = getModule("hokmRoom");
    if (room && typeof room.startGame === "function") {
        appLoading(true, "در حال آماده‌سازی بازی...");
        try {
            const result = await room.startGame();
            if (result) {
                appState.currentGame = result;
                navigateTo("game");
            }
        } finally {
            appLoading(false);
        }
        return;
    }

    if (typeof window.startGame === "function") {
        window.startGame();
        navigateTo("game");
    }
}

/* ================================================================
   8. REFRESH HELPERS
================================================================ */

async function refreshShop() {
    const shop = getModule("hokmShop");
    if (shop?.render) await shop.render();
}

async function refreshProfile() {
    const profile = getModule("hokmProfile");
    if (profile?.render) await profile.render();
}

async function refreshWallet() {
    const wallet = getModule("hokmWallet");
    if (wallet?.render) await wallet.render();
}

async function refreshFriends() {
    const friends = getModule("hokmFriends");
    if (friends?.refresh) await friends.refresh();
}

async function refreshNotifications() {
    const notifications = getModule("hokmNotifications");
    if (notifications?.render) await notifications.render();
}

async function refreshLeaderboard() {
    const leaderboard = getModule("hokmLeaderboard");
    if (leaderboard?.refreshLeaderboard) await leaderboard.refreshLeaderboard();
}

async function refreshSettings() {
    const settings = getModule("hokmSettings");
    if (settings?.render) await settings.render();
}

async function refreshGameUI() {
    const gameUI = getModule("hokmGameUI");
    if (gameUI?.render) await gameUI.render();
}

async function refreshAllUserData() {
    await Promise.allSettled([
        refreshWallet(),
        refreshProfile(),
        refreshFriends(),
        refreshNotifications()
    ]);
    updateGlobalUserUI();
}

function updateGlobalUserUI() {
    const auth = getModule("hokmAuth");
    if (!auth) return;

    const profile = typeof auth.getCurrentProfile === "function" ? auth.getCurrentProfile() : null;
    const user = typeof auth.getCurrentUser === "function" ? auth.getCurrentUser() : null;
    const name = typeof auth.getProfileDisplayName === "function" ? auth.getProfileDisplayName() : (profile?.username || "بازیکن");

    setText("[data-user-name], #playerName, #profileName", name);
    setText("[data-user-email]", user?.email || "");

    if (profile?.coins !== undefined) {
        setText("[data-user-coins], #coinBalance, #shopCoinBalance", Number(profile.coins).toLocaleString("fa-IR"));
    }

    if (profile?.level !== undefined) {
        setText("[data-user-level], #playerLevel, #profileLevel", `سطح ${Number(profile.level).toLocaleString("fa-IR")}`);
    }
}

/* ================================================================
   9. GLOBAL EVENTS
================================================================ */

function handleOnline() {
    appState.online = true;
    document.body.classList.remove("offline");
    appToast("اتصال اینترنت برقرار شد.", "🟢", 2500);
    const multiplayer = getModule("hokmMultiplayer");
    if (multiplayer?.reconnect) multiplayer.reconnect();
    appEvents.emit("online");
}

function handleOffline() {
    appState.online = false;
    document.body.classList.add("offline");
    appToast("اتصال اینترنت قطع شد.", "🔴", 4000);
    appEvents.emit("offline");
}

async function handleGlobalClick(event) {
    const target = event.target;

    const nav = target.closest("[data-page-link], [data-nav], [data-screen]");
    if (nav) {
        event.preventDefault();
        const page = nav.dataset.pageLink || nav.dataset.nav || nav.dataset.screen;
        if (page) await navigateTo(page);
        return;
    }

    if (target.closest("#quickGameButton, [data-action='quick-game']")) {
        event.preventDefault();
        await startQuickGame();
        return;
    }

    if (target.closest("#createRoomButton, [data-action='create-room']")) {
        event.preventDefault();
        await openCreateRoom();
        return;
    }

    if (target.closest("#joinRoomButton, [data-action='join-room']")) {
        event.preventDefault();
        if (typeof window.openJoinRoom === "function") window.openJoinRoom();
        return;
    }

    if (target.closest("#leaveRoomButton, [data-action='leave-room']")) {
        event.preventDefault();
        await leaveCurrentRoom();
        return;
    }

    if (target.closest("#startRoomGameButton, [data-action='start-room-game']")) {
        event.preventDefault();
        await startRoomGame();
        return;
    }

    if (target.closest("#profileNavButton, [data-action='profile']")) {
        event.preventDefault();
        await navigateTo("profile");
        return;
    }

    if (target.closest("#shopNavButton, [data-action='shop']")) {
        event.preventDefault();
        await navigateTo("shop");
        return;
    }

    if (target.closest("#leaderboardNavButton, #quickLeaderboard, [data-action='ranking']")) {
        event.preventDefault();
        await navigateTo("ranking");
        return;
    }

    if (target.closest("#homeNavButton")) {
        event.preventDefault();
        await navigateTo("home");
        return;
    }

    if (target.closest("#settingsButton, [data-action='settings']")) {
        event.preventDefault();
        await navigateTo("settings");
        return;
    }

    if (target.closest("[data-back]")) {
        event.preventDefault();
        const targetScreen = target.closest("[data-back]").dataset.back;
        await navigateTo(targetScreen || "home");
        return;
    }

    if (target.closest("#roomBackButton, #profileBackButton, #shopBackButton, #leaderboardBackButton, #friendsBackButton, #settingsBackButton, #notificationsBackButton")) {
        event.preventDefault();
        await navigateTo("home");
        return;
    }

    if (target.closest("[data-action='logout'], #logoutButton")) {
        event.preventDefault();
        await handleLogout();
        return;
    }

    if (target.closest("#guestLoginButton")) {
        event.preventDefault();
        await navigateTo("home");
        return;
    }
}

function handleKeyboard(event) {
    if (event.key === "Escape") {
        if (appState.modalOpen) closeAllModals();
        if (appState.mobileMenuOpen) closeMobileMenu();
    }
}

function setupGlobalEvents() {
    if (appState.eventsBound) return;
    document.addEventListener("click", handleGlobalClick);
    document.addEventListener("keydown", handleKeyboard);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    appState.eventsBound = true;
}

/* ================================================================
   10. INITIALIZATION
================================================================ */

async function initializeCoreModules() {
    const modules = [
        "hokmAuth", "hokmWallet", "hokmShop", "hokmProfile",
        "hokmFriends", "hokmNotifications", "hokmLeaderboard",
        "hokmSettings", "hokmRoom", "hokmMultiplayer", "hokmChat", "hokmGameUI"
    ];

    for (const moduleName of modules) {
        const module = getModule(moduleName);
        if (module && typeof module.initialize === "function") {
            try { await module.initialize(); } catch (e) {
                console.error(`خطا در initialize ماژول ${moduleName}:`, e);
            }
        }
    }
}

async function initializeApplication() {
    if (appState.initialized) return;
    appState.loading = true;
    appEvents.emit("bootStarted");

    try {
        setupGlobalEvents();
        showPage("home");

        const auth = getModule("hokmAuth");
        if (auth && typeof auth.initializeAuth === "function") {
            try { await auth.initializeAuth(); } catch (e) {}
        }

        await initializeCoreModules();

        const game = getModule("hokmGame");
        if (game?.initialize) await game.initialize();

        await refreshAllUserData();
        await refreshGameUI();

        showPage("home");
        updateGlobalUserUI();

        appState.initialized = true;
        appEvents.emit("ready", { bootTime: Date.now() - appState.bootTime });
        console.log("Hokm Online Application initialized successfully.");
    } catch (error) {
        appState.lastError = error;
        console.error("خطای راه‌اندازی برنامه:", error);
    } finally {
        appState.loading = false;
        appLoading(false);
    }
}

window.hokmApp = {
    state: appState,
    events: appEvents,
    navigate: navigateTo,
    showPage,
    showModal,
    hideModal,
    closeAllModals,
    startQuickGame,
    createRoom: createRoomFromForm,
    joinRoom,
    leaveRoom: leaveCurrentRoom,
    startRoomGame,
    refreshShop,
    refreshProfile,
    refreshWallet,
    refreshFriends,
    refreshNotifications,
    refreshLeaderboard,
    refreshSettings,
    refreshGameUI,
    refreshAllUserData,
    updateGlobalUserUI
};

window.navigateTo = navigateTo;
window.startQuickGame = startQuickGame;
window.openCreateRoom = openCreateRoom;
window.createRoom = createRoomFromForm;
window.joinRoom = joinRoom;
window.leaveCurrentRoom = leaveCurrentRoom;
window.startRoomGame = startRoomGame;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApplication, { once: true });
} else {
    initializeApplication();
}
