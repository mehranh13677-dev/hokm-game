"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * ui.js
 *
 * نسخه کامل سیستم رابط کاربری
 * ================================================================
 */

/* ================================================================
   1. UI STATE
================================================================ */

const uiState = {
    initialized: false,
    currentPage: "home",
    previousPage: null,
    modalOpen: false,
    loading: false,
    mobileMenuOpen: false,
    overlayOpen: false,
    toastQueue: [],
    toastActive: false,
    activeModalId: null,
    currentConfirm: null,
    notificationsCount: 0,
    unreadMessagesCount: 0,
    online: navigator.onLine,
    darkMode: document.documentElement.classList.contains("dark"),
    navigationLocked: false
};

/* ================================================================
   2. UI ELEMENT CACHE
================================================================ */

const uiElements = {
    overlay: null,
    toastContainer: null,
    modalContainer: null,
    loadingContainer: null,
    loadingMessage: null,
    mobileMenu: null,
    mobileMenuButton: null,
    pageContainer: null,
    connectionStatus: null
};

/* ================================================================
   3. EVENT SYSTEM
================================================================ */

const uiEvents = {
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
            item => item !== callback
        );
    },

    emit(eventName, data) {
        const listeners = this.listeners[eventName] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`UI Event Error: ${eventName}`, error);
            }
        });
    }
};

/* ================================================================
   4. DOM HELPERS & FORMATTERS
================================================================ */

function ui$(selector, parent = document) {
    if (!selector) return null;
    return parent.querySelector(selector);
}

function ui$$(selector, parent = document) {
    if (!selector) return [];
    return Array.from(parent.querySelectorAll(selector));
}

function createElement(tagName, className = "", attributes = {}) {
    const element = document.createElement(tagName);
    if (className) element.className = className;

    Object.entries(attributes).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        if (key === "text") {
            element.textContent = String(value);
            return;
        }
        if (key === "html") {
            element.innerHTML = String(value);
            return;
        }
        element.setAttribute(key, String(value));
    });

    return element;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatNumber(value, locale = "fa-IR") {
    const number = Number(value);
    if (!Number.isFinite(number)) return "۰";
    return number.toLocaleString(locale);
}

function formatCoins(value) {
    return formatNumber(value);
}

function formatTime(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value) {
    if (!value) return "";
    return `${formatDate(value)} - ${formatTime(value)}`;
}

function truncateText(value, maxLength = 40) {
    const text = String(value ?? "");
    if (text.length <= maxLength) return text;
    return text.slice(0, Math.max(0, maxLength - 3)) + "...";
}

function normalizeText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
}

/* ================================================================
   5. UI ROOTS
================================================================ */

function ensureUIRoots() {
    let toastContainer = document.getElementById("hokm-toast-container");
    if (!toastContainer) {
        toastContainer = createElement("div", "hokm-toast-container", {
            id: "hokm-toast-container",
            "aria-live": "polite",
            "aria-atomic": "true"
        });
        document.body.appendChild(toastContainer);
    }
    uiElements.toastContainer = toastContainer;

    let overlay = document.getElementById("hokm-ui-overlay");
    if (!overlay) {
        overlay = createElement("div", "hokm-ui-overlay", {
            id: "hokm-ui-overlay",
            "aria-hidden": "true"
        });
        document.body.appendChild(overlay);
    }
    uiElements.overlay = overlay;

    let modalContainer = document.getElementById("hokm-modal-container");
    if (!modalContainer) {
        modalContainer = createElement("div", "hokm-modal-container", {
            id: "hokm-modal-container"
        });
        document.body.appendChild(modalContainer);
    }
    uiElements.modalContainer = modalContainer;

    let loadingContainer = document.getElementById("hokm-loading-container");
    if (!loadingContainer) {
        loadingContainer = createElement("div", "hokm-loading-container", {
            id: "hokm-loading-container",
            "aria-hidden": "true"
        });
        loadingContainer.innerHTML = `
            <div class="hokm-loading-card">
                <div class="hokm-loading-spinner">
                    <span></span><span></span><span></span><span></span>
                </div>
                <div class="hokm-loading-message" id="hokm-loading-message">
                    لطفاً صبر کنید...
                </div>
            </div>
        `;
        document.body.appendChild(loadingContainer);
    }
    uiElements.loadingContainer = loadingContainer;
    uiElements.loadingMessage = loadingContainer.querySelector("#hokm-loading-message");
}

/* ================================================================
   6. TOAST SYSTEM
================================================================ */

function showToast(message, icon = "ℹ️", duration = 3000, type = "info") {
    message = normalizeText(message);
    if (!message) return;

    uiState.toastQueue.push({ message, icon, duration, type });
    processToastQueue();
}

function processToastQueue() {
    if (uiState.toastActive || uiState.toastQueue.length === 0) return;
    const toast = uiState.toastQueue.shift();
    uiState.toastActive = true;
    renderToast(toast);
}

function renderToast(toast) {
    ensureUIRoots();
    const element = createElement("div", `hokm-toast hokm-toast-${toast.type}`);
    element.innerHTML = `
        <div class="hokm-toast-icon">${escapeHTML(toast.icon)}</div>
        <div class="hokm-toast-content">
            <div class="hokm-toast-message">${escapeHTML(toast.message)}</div>
        </div>
        <button type="button" class="hokm-toast-close" aria-label="بستن">×</button>
    `;

    const closeButton = element.querySelector(".hokm-toast-close");
    let timer = null;

    const removeToast = () => {
        if (!element.isConnected) {
            finishToast();
            return;
        }
        element.classList.add("hokm-toast-hide");
        setTimeout(() => {
            element.remove();
            finishToast();
        }, 250);
    };

    closeButton.addEventListener("click", removeToast);
    uiElements.toastContainer.appendChild(element);

    requestAnimationFrame(() => {
        element.classList.add("hokm-toast-show");
    });

    timer = setTimeout(removeToast, Math.max(1000, Number(toast.duration) || 3000));
}

function finishToast() {
    uiState.toastActive = false;
    setTimeout(processToastQueue, 50);
}

function showSuccess(message, duration = 3000) { showToast(message, "✅", duration, "success"); }
function showError(message, duration = 4000) { showToast(message, "❌", duration, "error"); }
function showWarning(message, duration = 3500) { showToast(message, "⚠️", duration, "warning"); }
function showInfo(message, duration = 3000) { showToast(message, "ℹ️", duration, "info"); }

/* ================================================================
   7. LOADING & OVERLAY
================================================================ */

function showLoading(message = "لطفاً صبر کنید...") {
    ensureUIRoots();
    uiState.loading = true;
    if (uiElements.loadingMessage) uiElements.loadingMessage.textContent = message;
    uiElements.loadingContainer.classList.add("active");
    uiElements.loadingContainer.setAttribute("aria-hidden", "false");
    document.body.classList.add("hokm-ui-loading");
    uiEvents.emit("loading", { visible: true, message });
}

function hideLoading() {
    ensureUIRoots();
    uiState.loading = false;
    uiElements.loadingContainer.classList.remove("active");
    uiElements.loadingContainer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hokm-ui-loading");
    uiEvents.emit("loading", { visible: false });
}

function showOverlay(options = {}) {
    ensureUIRoots();
    uiState.overlayOpen = true;
    uiElements.overlay.classList.add("active");
    uiElements.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("hokm-overlay-open");
    uiEvents.emit("overlay", { visible: true });
}

function hideOverlay() {
    ensureUIRoots();
    uiState.overlayOpen = false;
    uiElements.overlay.classList.remove("active");
    uiElements.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hokm-overlay-open");
    uiEvents.emit("overlay", { visible: false });
}

/* ================================================================
   8. MODAL & CONFIRM
================================================================ */

function showModal(options = {}) {
    ensureUIRoots();
    const {
        id = `modal-${Date.now()}`,
        title = "",
        message = "",
        content = "",
        icon = "ℹ️",
        buttons = [],
        closeOnOverlay = true,
        className = "",
        showClose = true,
        width = "normal"
    } = options;

    if (uiState.modalOpen) closeModal(uiState.activeModalId);

    const modal = createElement("div", `hokm-modal ${className} hokm-modal-${width}`, { id });
    const buttonList = Array.isArray(buttons) ? buttons : [];
    let buttonsHTML = "";

    buttonList.forEach((button, index) => {
        const type = button.type || "secondary";
        buttonsHTML += `
            <button type="button" class="hokm-modal-button hokm-modal-button-${escapeHTML(type)}" data-modal-button="${index}">
                ${escapeHTML(button.icon || "")} ${escapeHTML(button.text || button.label || "باشه")}
            </button>
        `;
    });

    modal.innerHTML = `
        <div class="hokm-modal-backdrop" data-modal-backdrop></div>
        <div class="hokm-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
            <div class="hokm-modal-header">
                <div class="hokm-modal-title-wrapper">
                    <div class="hokm-modal-icon">${escapeHTML(icon)}</div>
                    <h3 class="hokm-modal-title" id="${id}-title">${escapeHTML(title)}</h3>
                </div>
                ${showClose ? `<button type="button" class="hokm-modal-close" data-modal-close aria-label="بستن">×</button>` : ""}
            </div>
            <div class="hokm-modal-body">
                ${message ? `<p class="hokm-modal-message">${escapeHTML(message)}</p>` : ""}
                ${content ? `<div class="hokm-modal-content">${content}</div>` : ""}
            </div>
            ${buttonList.length ? `<div class="hokm-modal-footer">${buttonsHTML}</div>` : ""}
        </div>
    `;

    uiElements.modalContainer.appendChild(modal);
    uiState.modalOpen = true;
    uiState.activeModalId = id;
    document.body.classList.add("hokm-modal-open");

    if (closeOnOverlay) {
        modal.querySelector("[data-modal-backdrop]")?.addEventListener("click", () => closeModal(id));
    }
    modal.querySelector("[data-modal-close]")?.addEventListener("click", () => closeModal(id));

    modal.querySelectorAll("[data-modal-button]").forEach(buttonElement => {
        const index = Number(buttonElement.dataset.modalButton);
        const buttonData = buttonList[index];
        buttonElement.addEventListener("click", async () => {
            let shouldClose = buttonData.close !== false;
            if (typeof buttonData.onClick === "function") {
                const res = await buttonData.onClick();
                if (res === false) shouldClose = false;
            }
            if (shouldClose) closeModal(id);
        });
    });

    requestAnimationFrame(() => modal.classList.add("active"));
    uiEvents.emit("modalOpened", { id, modal });
    return modal;
}

function closeModal(id = null) {
    const modalId = id || uiState.activeModalId;
    if (!modalId) return;

    const modal = document.getElementById(modalId);
    if (!modal) {
        uiState.modalOpen = false;
        uiState.activeModalId = null;
        document.body.classList.remove("hokm-modal-open");
        return;
    }

    modal.classList.remove("active");
    setTimeout(() => {
        modal.remove();
        if (uiState.activeModalId === modalId) {
            uiState.activeModalId = null;
            uiState.modalOpen = false;
            document.body.classList.remove("hokm-modal-open");
        }
    }, 220);

    uiEvents.emit("modalClosed", { id: modalId });
}

function showConfirm(options = {}) {
    const {
        title = "تأیید عملیات",
        message = "آیا مطمئن هستید؟",
        icon = "❓",
        confirmText = "تأیید",
        cancelText = "انصراف",
        confirmType = "primary",
        onConfirm = null,
        onCancel = null
    } = options;

    return showModal({
        id: `confirm-${Date.now()}`,
        title,
        message,
        icon,
        width: "small",
        buttons: [
            {
                text: cancelText,
                type: "secondary",
                close: true,
                onClick: async () => { if (typeof onCancel === "function") await onCancel(); }
            },
            {
                text: confirmText,
                type: confirmType,
                close: true,
                onClick: async () => { if (typeof onConfirm === "function") await onConfirm(); }
            }
        ]
    });
}

/* ================================================================
   9. NAVIGATION & MOBILE MENU
================================================================ */

function navigateTo(page, options = {}) {
    page = normalizeText(page);
    if (!page || uiState.navigationLocked) return;

    const { pushHistory = true, closeMenu = true, scrollTop = true, silent = false } = options;
    uiState.previousPage = uiState.currentPage;
    uiState.currentPage = page;

    if (pushHistory) {
        try {
            history.pushState({ hokmPage: page }, "", `#${encodeURIComponent(page)}`);
        } catch (e) {}
    }

    ui$$("[data-page], .screen").forEach(el => {
        const elPage = el.dataset.page || el.id.replace("Screen", "").toLowerCase();
        const active = elPage === page.toLowerCase();
        el.classList.toggle("active", active);
        el.classList.toggle("active-screen", active);
        if (active) el.removeAttribute("hidden");
        else el.setAttribute("hidden", "");
    });

    if (closeMenu) closeMobileMenu();
    if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });

    if (!silent) {
        uiEvents.emit("navigation", { page, previousPage: uiState.previousPage });
    }
    return page;
}

function openMobileMenu() {
    uiState.mobileMenuOpen = true;
    document.body.classList.add("hokm-mobile-menu-open");
    showOverlay({ closeOnClick: true });
    uiEvents.emit("mobileMenu", { open: true });
}

function closeMobileMenu() {
    uiState.mobileMenuOpen = false;
    document.body.classList.remove("hokm-mobile-menu-open");
    if (!uiState.modalOpen) hideOverlay();
    uiEvents.emit("mobileMenu", { open: false });
}

function toggleMobileMenu() {
    if (uiState.mobileMenuOpen) closeMobileMenu();
    else openMobileMenu();
}

/* ================================================================
   10. DATA UPDATERS
================================================================ */

function updateCoinsUI(coins) {
    const value = Number(coins);
    if (!Number.isFinite(value)) return;

    ui$$("[data-user-coins], #coinBalance, #shopCoinBalance").forEach(el => {
        el.textContent = formatCoins(value);
    });

    if (window.state?.player) window.state.player.coins = value;
    uiEvents.emit("coinsUpdated", { coins: value });
}

function updateLevelUI(level) {
    const value = Number(level);
    if (!Number.isFinite(value)) return;
    ui$$("[data-user-level], #playerLevel, #profileLevel").forEach(el => {
        el.textContent = `سطح ${formatNumber(value)}`;
    });
}

function updateUserUI(profile = null) {
    const p = profile || window.hokmAuth?.getCurrentProfile?.();
    if (!p) return;

    const name = p.display_name || p.username || "بازیکن";
    ui$$("[data-user-name], #playerName, #profileName").forEach(el => el.textContent = name);
    if (p.coins !== undefined) updateCoinsUI(p.coins);
    if (p.level !== undefined) updateLevelUI(p.level);
}

function updateAuthVisibility() {
    const loggedIn = window.hokmAuth && typeof window.hokmAuth.isLoggedIn === "function" ? window.hokmAuth.isLoggedIn() : false;
    ui$$("[data-auth='logged-in']").forEach(el => el.style.display = loggedIn ? "" : "none");
    ui$$("[data-auth='logged-out']").forEach(el => el.style.display = loggedIn ? "none" : "");
}

/* ================================================================
   11. INITIALIZATION & SHORTCUTS
================================================================ */

function initializeUI() {
    if (uiState.initialized) return;
    ensureUIRoots();
    uiState.initialized = true;
    uiEvents.emit("initialized", uiState);
    console.log("Hokm Online UI initialized successfully.");
}

window.hokmUI = {
    state: uiState,
    events: uiEvents,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    hideLoading,
    showOverlay,
    hideOverlay,
    showModal,
    closeModal,
    showConfirm,
    navigateTo,
    openMobileMenu,
    closeMobileMenu,
    toggleMobileMenu,
    updateUserUI,
    updateAuthVisibility,
    updateCoinsUI,
    updateLevelUI,
    formatNumber,
    formatCoins,
    initializeUI
};

window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showModal = showModal;
window.closeModal = closeModal;
window.showConfirm = showConfirm;
window.updateUserUI = updateUserUI;
window.updateCoinsUI = updateCoinsUI;
window.formatCoins = formatCoins;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeUI);
} else {
    initializeUI();
}
