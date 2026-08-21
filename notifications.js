"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * notifications.js
 *
 * FILE: 8 / 12
 *
 * سیستم کامل اعلان‌ها
 * ================================================================
 */

/* ================================================================
   1. GLOBAL STATE
================================================================ */

const notificationState = {
    initialized: false,
    loading: false,
    realtimeStarted: false,
    notifications: [],
    unreadCount: 0,
    currentUserId: null,
    currentChannel: null,
    panelOpen: false,
    page: 1,
    pageSize: 30,
    hasMore: true,
    lastLoadedAt: null
};

/* ================================================================
   2. EVENT SYSTEM
================================================================ */

const notificationEvents = {
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
                console.error(`خطا در Notification Event: ${eventName}`, error);
            }
        });
    }
};

/* ================================================================
   3. SUPABASE CLIENT & HELPERS
================================================================ */

function getNotificationsSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
        return window.supabase;
    }
    return null;
}

function getNotificationUser() {
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentUser === "function") {
        return window.hokmAuth.getCurrentUser();
    }
    return null;
}

function notificationToast(message, icon = "🔔", duration = 3500) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function notificationLoading(show, message = "لطفاً صبر کنید...") {
    if (show && typeof window.showLoading === "function") {
        window.showLoading(message);
        return;
    }
    if (!show && typeof window.hideLoading === "function") {
        window.hideLoading();
    }
}

function escapeNotificationHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatNotificationDate(dateValue) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";

    try {
        return new Intl.DateTimeFormat("fa-IR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    } catch (error) {
        return date.toLocaleString();
    }
}

function formatNotificationRelativeTime(dateValue) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";

    const difference = Date.now() - date.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (difference < minute) return "همین الان";
    if (difference < hour) return `${Math.floor(difference / minute)} دقیقه پیش`;
    if (difference < day) return `${Math.floor(difference / hour)} ساعت پیش`;
    if (difference < 7 * day) return `${Math.floor(difference / day)} روز پیش`;

    return formatNotificationDate(dateValue);
}

function getNotificationIcon(type) {
    const icons = {
        system: "🔔",
        game: "🎮",
        game_start: "🎮",
        game_finished: "🏆",
        win: "🏆",
        loss: "😔",
        coins: "🪙",
        reward: "🎁",
        shop: "🛒",
        friend: "👥",
        friend_request: "🤝",
        friend_accepted: "💚",
        message: "💬",
        room: "🏠",
        invite: "📩",
        tournament: "🏆",
        level: "⭐",
        achievement: "🏅",
        warning: "⚠️",
        security: "🔐",
        update: "🆕"
    };

    return icons[type] || icons.system;
}

function normalizeNotification(notification) {
    if (!notification) return null;
    return {
        id: notification.id || null,
        user_id: notification.user_id || null,
        title: String(notification.title || "اعلان"),
        message: String(notification.message || ""),
        notification_type: notification.notification_type || "system",
        is_read: Boolean(notification.is_read),
        created_at: notification.created_at || new Date().toISOString()
    };
}

function sortNotifications(notifications) {
    return [...(notifications || [])].sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
}

function updateUnreadCount() {
    notificationState.unreadCount = notificationState.notifications.filter(
        n => n && n.is_read === false
    ).length;

    updateNotificationBadge();
    notificationEvents.emit("unreadCountChanged", notificationState.unreadCount);
    return notificationState.unreadCount;
}

function updateNotificationBadge() {
    document.querySelectorAll("[data-notification-badge]").forEach(badge => {
        const count = notificationState.unreadCount;
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.style.display = count > 0 ? "" : "none";
        badge.setAttribute("aria-label", `${count} اعلان خوانده‌نشده`);
    });

    document.querySelectorAll("[data-notification-count]").forEach(element => {
        element.textContent = Number(notificationState.unreadCount).toLocaleString("fa-IR");
    });
}

/* ================================================================
   4. DATA LOAD & MUTATIONS
================================================================ */

function getNotifications() {
    return [...notificationState.notifications];
}

function getUnreadNotifications() {
    return notificationState.notifications.filter(n => n && n.is_read === false);
}

function getUnreadCount() {
    return notificationState.unreadCount;
}

function findNotification(notificationId) {
    return notificationState.notifications.find(n => n.id === notificationId) || null;
}

async function loadNotifications(options = {}) {
    const client = getNotificationsSupabaseClient();
    const user = getNotificationUser();

    if (!client || !user) {
        notificationState.notifications = [];
        notificationState.unreadCount = 0;
        updateNotificationBadge();
        return [];
    }

    const reset = options.reset !== false;
    const pageSize = Number(options.pageSize || notificationState.pageSize);

    if (reset) {
        notificationState.page = 1;
        notificationState.hasMore = true;
        notificationState.notifications = [];
    }

    notificationState.loading = true;

    try {
        const from = (notificationState.page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await client
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            console.error("خطا در دریافت اعلان‌ها:", error);
            return notificationState.notifications;
        }

        const normalized = (data || []).map(normalizeNotification).filter(Boolean);

        if (reset) {
            notificationState.notifications = normalized;
        } else {
            const existingIds = new Set(notificationState.notifications.map(n => n.id));
            normalized.forEach(n => {
                if (!existingIds.has(n.id)) {
                    notificationState.notifications.push(n);
                }
            });
            notificationState.notifications = sortNotifications(notificationState.notifications);
        }

        notificationState.hasMore = normalized.length === pageSize;
        notificationState.lastLoadedAt = new Date();

        updateUnreadCount();
        renderNotifications();
        notificationEvents.emit("loaded", getNotifications());

        return getNotifications();
    } catch (error) {
        console.error("خطای loadNotifications:", error);
        return notificationState.notifications;
    } finally {
        notificationState.loading = false;
    }
}

async function loadMoreNotifications() {
    if (notificationState.loading || !notificationState.hasMore) {
        return notificationState.notifications;
    }
    notificationState.page += 1;
    return await loadNotifications({ reset: false });
}

async function markAsRead(notificationId) {
    const client = getNotificationsSupabaseClient();
    const user = getNotificationUser();
    if (!client || !user || !notificationId) return false;

    const notification = findNotification(notificationId);
    if (!notification || notification.is_read) return true;

    try {
        const { error } = await client
            .from("notifications")
            .update({ is_read: true })
            .eq("id", notificationId)
            .eq("user_id", user.id);

        if (error) {
            console.error("خطا در خوانده‌شدن اعلان:", error);
            return false;
        }

        notification.is_read = true;
        updateUnreadCount();
        renderNotifications();
        notificationEvents.emit("read", notification);
        return true;
    } catch (error) {
        console.error("خطای markAsRead:", error);
        return false;
    }
}

async function markAllAsRead() {
    const client = getNotificationsSupabaseClient();
    const user = getNotificationUser();
    if (!client || !user) return false;

    try {
        const { error } = await client
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", user.id)
            .eq("is_read", false);

        if (error) {
            console.error("خطا در خوانده‌شدن همه اعلان‌ها:", error);
            notificationToast("علامت‌گذاری اعلان‌ها انجام نشد.", "❌");
            return false;
        }

        notificationState.notifications.forEach(n => { n.is_read = true; });
        updateUnreadCount();
        renderNotifications();
        notificationEvents.emit("allRead", true);
        notificationToast("همه اعلان‌ها خوانده شدند.", "✅");
        return true;
    } catch (error) {
        console.error("خطای markAllAsRead:", error);
        return false;
    }
}

async function deleteNotification(notificationId) {
    const client = getNotificationsSupabaseClient();
    const user = getNotificationUser();
    if (!client || !user || !notificationId) return false;

    try {
        const { error } = await client
            .from("notifications")
            .delete()
            .eq("id", notificationId)
            .eq("user_id", user.id);

        if (error) {
            console.error("خطا در حذف اعلان:", error);
            return false;
        }

        notificationState.notifications = notificationState.notifications.filter(
            n => n.id !== notificationId
        );

        updateUnreadCount();
        renderNotifications();
        notificationEvents.emit("deleted", notificationId);
        return true;
    } catch (error) {
        console.error("خطای deleteNotification:", error);
        return false;
    }
}

async function deleteAllNotifications() {
    const client = getNotificationsSupabaseClient();
    const user = getNotificationUser();
    if (!client || !user) return false;

    try {
        const { error } = await client
            .from("notifications")
            .delete()
            .eq("user_id", user.id);

        if (error) {
            console.error("خطا در حذف اعلان‌ها:", error);
            notificationToast("حذف اعلان‌ها انجام نشد.", "❌");
            return false;
        }

        notificationState.notifications = [];
        notificationState.unreadCount = 0;
        updateNotificationBadge();
        renderNotifications();
        notificationEvents.emit("allDeleted", true);
        notificationToast("همه اعلان‌ها حذف شدند.", "🗑️");
        return true;
    } catch (error) {
        console.error("خطای deleteAllNotifications:", error);
        return false;
    }
}

async function createNotification(userId, title, message, type = "system") {
    const client = getNotificationsSupabaseClient();
    if (!client || !userId) return null;

    const safeTitle = String(title || "اعلان").trim().slice(0, 100);
    const safeMessage = String(message || "").trim().slice(0, 500);
    if (!safeMessage) return null;

    try {
        const { data, error } = await client
            .from("notifications")
            .insert({
                user_id: userId,
                title: safeTitle,
                message: safeMessage,
                notification_type: type || "system",
                is_read: false
            })
            .select()
            .single();

        if (error) {
            console.error("خطا در ساخت اعلان:", error);
            return null;
        }

        return normalizeNotification(data);
    } catch (error) {
        console.error("خطای createNotification:", error);
        return null;
    }
}

async function notifyCurrentUser(title, message, type = "system") {
    const user = getNotificationUser();
    if (!user) return null;
    return await createNotification(user.id, title, message, type);
}

/* ================================================================
   5. BROWSER & IN-GAME NOTIFICATIONS
================================================================ */

async function showBrowserNotification(notification) {
    if (!notification || typeof window.Notification === "undefined") return false;

    try {
        if (Notification.permission === "default") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") return false;
        }
        if (Notification.permission !== "granted") return false;

        const icon = getNotificationIcon(notification.notification_type);
        new Notification(`${icon} ${notification.title}`, {
            body: notification.message,
            tag: `hokm-${notification.id || Date.now()}`
        });

        return true;
    } catch (error) {
        return false;
    }
}

function showInGameNotification(notification) {
    if (!notification) return;
    const icon = getNotificationIcon(notification.notification_type);
    notificationToast(`${notification.title}: ${notification.message}`, icon, 5000);
    notificationEvents.emit("received", notification);
}

async function handleNewNotification(rawNotification) {
    const notification = normalizeNotification(rawNotification);
    if (!notification) return;

    const existing = findNotification(notification.id);
    if (existing) {
        Object.assign(existing, notification);
    } else {
        notificationState.notifications.unshift(notification);
    }

    notificationState.notifications = sortNotifications(notificationState.notifications);
    updateUnreadCount();
    renderNotifications();
    showInGameNotification(notification);
    await showBrowserNotification(notification);
    notificationEvents.emit("new", notification);
}

/* ================================================================
   6. REALTIME SUBSCRIPTION
================================================================ */

function startNotificationsRealtime() {
    const client = getNotificationsSupabaseClient();
    const user = getNotificationUser();
    if (!client || !user || notificationState.realtimeStarted) return false;

    try {
        const channelName = `hokm-notifications-${user.id}`;
        const channel = client
            .channel(channelName)
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${user.id}`
            }, payload => {
                handleNewNotification(payload.new);
            })
            .on("postgres_changes", {
                event: "UPDATE",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${user.id}`
            }, payload => {
                const updated = normalizeNotification(payload.new);
                if (!updated) return;
                const index = notificationState.notifications.findIndex(n => n.id === updated.id);
                if (index >= 0) {
                    notificationState.notifications[index] = updated;
                } else {
                    notificationState.notifications.unshift(updated);
                }
                updateUnreadCount();
                renderNotifications();
                notificationEvents.emit("updated", updated);
            })
            .on("postgres_changes", {
                event: "DELETE",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${user.id}`
            }, payload => {
                const deletedId = payload.old?.id;
                if (!deletedId) return;
                notificationState.notifications = notificationState.notifications.filter(
                    n => n.id !== deletedId
                );
                updateUnreadCount();
                renderNotifications();
                notificationEvents.emit("deletedRealtime", deletedId);
            })
            .subscribe(status => {
                if (status === "SUBSCRIBED") {
                    notificationState.realtimeStarted = true;
                }
            });

        notificationState.currentChannel = channel;
        return true;
    } catch (error) {
        console.error("خطا در Notifications Realtime:", error);
        return false;
    }
}

async function stopNotificationsRealtime() {
    const client = getNotificationsSupabaseClient();
    if (!client || !notificationState.currentChannel) {
        notificationState.realtimeStarted = false;
        return;
    }

    try {
        await client.removeChannel(notificationState.currentChannel);
    } catch (error) {
        console.warn("خطا در توقف Notifications Realtime:", error);
    }

    notificationState.currentChannel = null;
    notificationState.realtimeStarted = false;
}

/* ================================================================
   7. DOM RENDERING
================================================================ */

function createNotificationHTML(notification) {
    const icon = getNotificationIcon(notification.notification_type);
    const unreadClass = notification.is_read ? "" : " notification-unread";
    const title = escapeNotificationHTML(notification.title);
    const message = escapeNotificationHTML(notification.message);
    const relativeTime = escapeNotificationHTML(formatNotificationRelativeTime(notification.created_at));
    const fullDate = escapeNotificationHTML(formatNotificationDate(notification.created_at));

    return `
        <article
            class="hokm-notification-item${unreadClass}"
            data-notification-id="${escapeNotificationHTML(notification.id)}"
            data-read="${notification.is_read ? "true" : "false"}"
            role="article"
        >
            <div class="hokm-notification-icon">
                <span>${icon}</span>
            </div>
            <div class="hokm-notification-content">
                <div class="hokm-notification-header">
                    <strong class="hokm-notification-title">${title}</strong>
                    ${notification.is_read ? "" : `<span class="hokm-notification-unread-dot" aria-label="خوانده نشده"></span>`}
                </div>
                <p class="hokm-notification-message">${message}</p>
                <time class="hokm-notification-time" datetime="${escapeNotificationHTML(notification.created_at)}" title="${fullDate}">
                    ${relativeTime}
                </time>
            </div>
            <div class="hokm-notification-actions">
                ${notification.is_read ? "" : `
                    <button type="button" class="hokm-notification-action" data-notification-read="${escapeNotificationHTML(notification.id)}" title="خوانده شد" aria-label="خوانده شد">
                        ✓
                    </button>
                `}
                <button type="button" class="hokm-notification-action hokm-notification-delete" data-notification-delete="${escapeNotificationHTML(notification.id)}" title="حذف اعلان" aria-label="حذف اعلان">
                    🗑️
                </button>
            </div>
        </article>
    `;
}

function renderNotifications(container = null) {
    const target = container || document.querySelector("[data-notifications-list], #notificationsList");
    if (!target) {
        updateNotificationBadge();
        return;
    }

    const notifications = notificationState.notifications;
    if (notifications.length === 0) {
        target.innerHTML = `
            <div class="hokm-notifications-empty">
                <div class="hokm-notifications-empty-icon">🔔</div>
                <h3>اعلانی وجود ندارد</h3>
                <p>وقتی اتفاق مهمی در بازی رخ دهد، اعلان آن اینجا نمایش داده می‌شود.</p>
            </div>
        `;
        updateNotificationBadge();
        return;
    }

    target.innerHTML = notifications.map(createNotificationHTML).join("");
    updateNotificationBadge();
}

function openNotificationPanel() {
    const panel = document.querySelector("[data-notifications-panel], #notificationsScreen");
    if (!panel) return false;
    panel.classList.add("active", "open");
    panel.removeAttribute("hidden");
    notificationState.panelOpen = true;
    renderNotifications();
    notificationEvents.emit("panelOpened", true);
    return true;
}

function closeNotificationPanel() {
    const panel = document.querySelector("[data-notifications-panel], #notificationsScreen");
    if (!panel) return false;
    panel.classList.remove("active", "open");
    notificationState.panelOpen = false;
    notificationEvents.emit("panelClosed", true);
    return true;
}

function toggleNotificationPanel() {
    return notificationState.panelOpen ? closeNotificationPanel() : openNotificationPanel();
}

async function handleNotificationAuthChange(data) {
    const user = data?.user || getNotificationUser();
    if (!user) {
        await stopNotificationsRealtime();
        notificationState.currentUserId = null;
        notificationState.notifications = [];
        notificationState.unreadCount = 0;
        updateNotificationBadge();
        renderNotifications();
        return;
    }

    if (notificationState.currentUserId === user.id && notificationState.initialized) return;

    await stopNotificationsRealtime();
    notificationState.currentUserId = user.id;
    await loadNotifications({ reset: true });
    startNotificationsRealtime();
}

/* ================================================================
   8. INITIALIZATION & EVENTS
================================================================ */

function bindNotificationEvents() {
    if (document.body.dataset.notificationsBound === "true") return;
    document.body.dataset.notificationsBound = "true";

    document.addEventListener("click", async event => {
        const openButton = event.target.closest("[data-open-notifications]");
        if (openButton) {
            event.preventDefault();
            toggleNotificationPanel();
            return;
        }

        const closeButton = event.target.closest("[data-close-notifications]");
        if (closeButton) {
            event.preventDefault();
            closeNotificationPanel();
            return;
        }

        const readButton = event.target.closest("[data-notification-read]");
        if (readButton) {
            event.preventDefault();
            const id = readButton.getAttribute("data-notification-read");
            await markAsRead(id);
            return;
        }

        const deleteButton = event.target.closest("[data-notification-delete]");
        if (deleteButton) {
            event.preventDefault();
            const id = deleteButton.getAttribute("data-notification-delete");
            await deleteNotification(id);
            return;
        }

        const markAllButton = event.target.closest("[data-mark-all-notifications-read]");
        if (markAllButton) {
            event.preventDefault();
            await markAllAsRead();
            return;
        }

        const deleteAllButton = event.target.closest("[data-delete-all-notifications]");
        if (deleteAllButton) {
            event.preventDefault();
            if (window.confirm("آیا می‌خواهید تمام اعلان‌ها حذف شوند؟")) {
                await deleteAllNotifications();
            }
            return;
        }

        const loadMoreButton = event.target.closest("[data-load-more-notifications]");
        if (loadMoreButton) {
            event.preventDefault();
            await loadMoreNotifications();
            return;
        }

        const notificationItem = event.target.closest("[data-notification-id]");
        if (notificationItem && !event.target.closest("button")) {
            const id = notificationItem.getAttribute("data-notification-id");
            const notification = findNotification(id);
            if (notification && !notification.is_read) {
                await markAsRead(id);
            }
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && notificationState.panelOpen) {
            closeNotificationPanel();
        }
    });
}

function bindAuthIntegration() {
    if (window.hokmAuth && typeof window.hokmAuth.onAuthChange === "function") {
        window.hokmAuth.onAuthChange(data => handleNotificationAuthChange(data));
    }
    if (window.hokmAuth && typeof window.hokmAuth.onSignIn === "function") {
        window.hokmAuth.onSignIn(data => {
            const user = data?.user || getNotificationUser();
            if (user) handleNotificationAuthChange({ user });
        });
    }
    if (window.hokmAuth && typeof window.hokmAuth.onSignOut === "function") {
        window.hokmAuth.onSignOut(async () => {
            await handleNotificationAuthChange({ user: null });
        });
    }
}

async function initializeNotifications() {
    if (notificationState.initialized) return;
    notificationState.initialized = true;

    const user = getNotificationUser();
    if (user) {
        notificationState.currentUserId = user.id;
        await loadNotifications({ reset: true });
        startNotificationsRealtime();
    } else {
        updateNotificationBadge();
    }

    bindNotificationEvents();
    notificationEvents.emit("initialized", notificationState);
    console.log("Hokm Online Notifications initialized successfully.");
}

async function startNotifications() {
    bindAuthIntegration();
    if (window.hokmAuth && typeof window.hokmAuth.waitForAuth === "function") {
        try { await window.hokmAuth.waitForAuth(); } catch (e) {}
    }
    await initializeNotifications();
}

window.hokmNotifications = {
    state: notificationState,
    events: notificationEvents,
    initialize: initializeNotifications,
    load: loadNotifications,
    loadMore: loadMoreNotifications,
    getAll: getNotifications,
    getUnread: getUnreadNotifications,
    getUnreadCount,
    find: findNotification,
    markAsRead,
    markAllAsRead,
    delete: deleteNotification,
    deleteAll: deleteAllNotifications,
    create: createNotification,
    notifyCurrentUser,
    open: openNotificationPanel,
    close: closeNotificationPanel,
    toggle: toggleNotificationPanel,
    render: renderNotifications,
    startRealtime: startNotificationsRealtime,
    stopRealtime: stopNotificationsRealtime,
    requestPermission: async () => {
        if (typeof window.Notification === "undefined") return false;
        const res = await Notification.requestPermission();
        return res === "granted";
    }
};

window.loadNotifications = loadNotifications;
window.getNotifications = getNotifications;
window.getUnreadNotifications = getUnreadNotifications;
window.getUnreadNotificationCount = getUnreadCount;
window.markNotificationAsRead = markAsRead;
window.markAllNotificationsAsRead = markAllAsRead;
window.deleteNotification = deleteNotification;
window.deleteAllNotifications = deleteAllNotifications;
window.createNotification = createNotification;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startNotifications, { once: true });
} else {
    startNotifications();
}
