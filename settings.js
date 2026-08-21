"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * settings.js
 *
 * FILE 6 / 12
 *
 * سیستم کامل تنظیمات بازی
 * ================================================================
 */

/* ================================================================
   1. DEFAULT SETTINGS
================================================================ */

const DEFAULT_SETTINGS = {
    theme: "dark",
    language: "fa",
    graphicQuality: "high",
    animations: true,
    reducedMotion: false,
    soundEnabled: true,
    musicEnabled: true,
    effectsEnabled: true,
    soundVolume: 80,
    musicVolume: 60,
    effectsVolume: 80,
    vibrationEnabled: true,
    notificationsEnabled: true,
    gameNotifications: true,
    friendNotifications: true,
    shopNotifications: true,
    systemNotifications: true,
    showOnlineStatus: true,
    showProfileToOthers: true,
    allowFriendRequests: true,
    confirmExitGame: true,
    confirmPurchase: true,
    showTutorial: true,
    autoReconnect: true,
    autoStartNextRound: false,
    showCoins: true,
    showLevel: true,
    showPlayerName: true,
    showAvatars: true,
    cardAnimation: true,
    cardHints: true,
    highlightLegalMoves: true,
    autoSortCards: true,
    lowPowerMode: false,
    preloadGameAssets: true,
    rememberSession: true
};

/* ================================================================
   2. SETTINGS STATE
================================================================ */

const settingsState = {
    initialized: false,
    loading: false,
    saving: false,
    settings: { ...DEFAULT_SETTINGS },
    lastSavedAt: null
};

/* ================================================================
   3. SETTINGS EVENTS
================================================================ */

const settingsEvents = {
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
                console.error(`خطا در Settings Event: ${eventName}`, error);
            }
        });
    }
};

const SETTINGS_STORAGE_KEY = "hokm_online_settings_v1";

/* ================================================================
   4. UTILITIES & CLIENT
================================================================ */

function settingsToast(message, icon = "⚙️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function getSettingsSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
        return window.supabase;
    }
    return null;
}

function getSettingsCurrentUser() {
    if (typeof window.getCurrentUser === "function") return window.getCurrentUser();
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentUser === "function") {
        return window.hokmAuth.getCurrentUser();
    }
    return null;
}

function cloneSettings(settings) {
    return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (Number.isNaN(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function normalizeSettings(settings) {
    const normalized = cloneSettings(settings);

    const booleanKeys = [
        "animations", "reducedMotion", "soundEnabled", "musicEnabled", "effectsEnabled",
        "vibrationEnabled", "notificationsEnabled", "gameNotifications", "friendNotifications",
        "shopNotifications", "systemNotifications", "showOnlineStatus", "showProfileToOthers",
        "allowFriendRequests", "confirmExitGame", "confirmPurchase", "showTutorial",
        "autoReconnect", "autoStartNextRound", "showCoins", "showLevel", "showPlayerName",
        "showAvatars", "cardAnimation", "cardHints", "highlightLegalMoves", "autoSortCards",
        "lowPowerMode", "preloadGameAssets", "rememberSession"
    ];

    booleanKeys.forEach(key => {
        normalized[key] = Boolean(normalized[key]);
    });

    normalized.soundVolume = clampNumber(normalized.soundVolume, 0, 100, DEFAULT_SETTINGS.soundVolume);
    normalized.musicVolume = clampNumber(normalized.musicVolume, 0, 100, DEFAULT_SETTINGS.musicVolume);
    normalized.effectsVolume = clampNumber(normalized.effectsVolume, 0, 100, DEFAULT_SETTINGS.effectsVolume);

    if (!["dark", "light", "auto"].includes(normalized.theme)) {
        normalized.theme = DEFAULT_SETTINGS.theme;
    }
    if (typeof normalized.language !== "string" || !normalized.language) {
        normalized.language = DEFAULT_SETTINGS.language;
    }
    if (!["low", "medium", "high", "ultra"].includes(normalized.graphicQuality)) {
        normalized.graphicQuality = DEFAULT_SETTINGS.graphicQuality;
    }

    return normalized;
}

/* ================================================================
   5. STORAGE & SERVER SYNC
================================================================ */

function loadLocalSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return null;
        return normalizeSettings(JSON.parse(raw));
    } catch (error) {
        return null;
    }
}

function saveLocalSettings(settings = settingsState.settings) {
    try {
        const normalized = normalizeSettings(settings);
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
        return true;
    } catch (error) {
        return false;
    }
}

async function loadRemoteSettings() {
    const client = getSettingsSupabaseClient();
    const user = getSettingsCurrentUser();
    if (!client || !user) return null;

    try {
        const metadata = user.user_metadata?.settings;
        if (metadata && typeof metadata === "object") return normalizeSettings(metadata);

        const { data, error } = await client
            .from("player_settings")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!error && data) {
            return normalizeSettings({
                soundEnabled: data.sound_enabled,
                musicEnabled: data.music_enabled,
                notificationsEnabled: data.notifications_enabled,
                vibrationEnabled: data.vibration_enabled,
                language: data.language,
                theme: data.theme,
                showOnlineStatus: data.show_online_status
            });
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function saveRemoteSettings(settings = settingsState.settings) {
    const client = getSettingsSupabaseClient();
    const user = getSettingsCurrentUser();
    if (!client || !user) return false;

    const normalized = normalizeSettings(settings);
    try {
        const { error } = await client
            .from("player_settings")
            .upsert({
                user_id: user.id,
                sound_enabled: normalized.soundEnabled,
                music_enabled: normalized.musicEnabled,
                notifications_enabled: normalized.notificationsEnabled,
                vibration_enabled: normalized.vibrationEnabled,
                language: normalized.language,
                theme: normalized.theme,
                show_online_status: normalized.showOnlineStatus,
                updated_at: new Date().toISOString()
            });

        return !error;
    } catch (error) {
        return false;
    }
}

async function saveSettingsToServer() {
    if (settingsState.saving) return false;
    settingsState.saving = true;
    try {
        const result = await saveRemoteSettings(settingsState.settings);
        if (result) settingsState.lastSavedAt = Date.now();
        return result;
    } catch (error) {
        return false;
    } finally {
        settingsState.saving = false;
    }
}

/* ================================================================
   6. GET / SET SETTING
================================================================ */

function getSettings() {
    return { ...settingsState.settings };
}

function getSetting(key, fallback = null) {
    if (Object.prototype.hasOwnProperty.call(settingsState.settings, key)) {
        return settingsState.settings[key];
    }
    return fallback;
}

async function setSetting(key, value, options = {}) {
    if (typeof key !== "string" || !key) return false;
    const previousValue = settingsState.settings[key];
    const updated = { ...settingsState.settings, [key]: value };

    settingsState.settings = normalizeSettings(updated);
    saveLocalSettings(settingsState.settings);
    applySetting(key, settingsState.settings[key]);

    settingsEvents.emit("changed", {
        key,
        value: settingsState.settings[key],
        previousValue,
        settings: getSettings()
    });

    if (options.remote !== false) saveSettingsToServer();
    return true;
}

async function setSettings(updates = {}, options = {}) {
    if (!updates || typeof updates !== "object") return false;
    const previous = getSettings();
    settingsState.settings = normalizeSettings({ ...settingsState.settings, ...updates });

    saveLocalSettings(settingsState.settings);
    applyAllSettings();

    settingsEvents.emit("changed", {
        key: null,
        value: settingsState.settings,
        previousValue: previous,
        settings: getSettings()
    });

    if (options.remote !== false) saveSettingsToServer();
    return true;
}

/* ================================================================
   7. APPLY SETTINGS
================================================================ */

function applyAllSettings() {
    Object.keys(settingsState.settings).forEach(key => {
        applySetting(key, settingsState.settings[key]);
    });
    updateSettingsUI();
}

function applySetting(key, value) {
    switch (key) {
        case "theme": applyTheme(value); break;
        case "language": applyLanguage(value); break;
        case "graphicQuality": applyGraphicQuality(value); break;
        case "animations": applyAnimations(value); break;
        case "reducedMotion": applyReducedMotion(value); break;
        case "soundEnabled": applySoundEnabled(value); break;
        case "musicEnabled": applyMusicEnabled(value); break;
        case "effectsEnabled": applyEffectsEnabled(value); break;
        case "vibrationEnabled": applyVibrationEnabled(value); break;
        case "notificationsEnabled": applyNotificationsEnabled(value); break;
        case "showOnlineStatus": applyOnlineStatus(value); break;
        case "showProfileToOthers": applyProfileVisibility(value); break;
        case "cardAnimation":
        case "cardHints":
        case "highlightLegalMoves":
        case "autoSortCards":
            applyGameSettings();
            break;
        case "lowPowerMode": applyLowPowerMode(value); break;
        default: break;
    }
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (!root) return;
    let finalTheme = theme;

    if (theme === "auto") {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        finalTheme = prefersDark ? "dark" : "light";
    }

    root.setAttribute("data-theme", finalTheme);
    root.classList.toggle("theme-dark", finalTheme === "dark");
    root.classList.toggle("theme-light", finalTheme === "light");
    document.body?.classList.toggle("dark-mode", finalTheme === "dark");
    document.body?.classList.toggle("light-mode", finalTheme === "light");
    settingsEvents.emit("themeChanged", finalTheme);
}

function applyLanguage(language) {
    document.documentElement.setAttribute("lang", language);
    document.documentElement.setAttribute("dir", language === "fa" ? "rtl" : "ltr");
    settingsEvents.emit("languageChanged", language);
}

function applyGraphicQuality(quality) {
    const body = document.body;
    if (!body) return;
    body.classList.remove("quality-low", "quality-medium", "quality-high", "quality-ultra");
    body.classList.add(`quality-${quality}`);
    document.documentElement.setAttribute("data-quality", quality);
    settingsEvents.emit("graphicQualityChanged", quality);
}

function applyAnimations(enabled) {
    document.documentElement.classList.toggle("animations-disabled", !enabled);
    document.documentElement.classList.toggle("no-animations", !enabled);
    applyGameSettings();
}

function applyReducedMotion(enabled) {
    document.documentElement.classList.toggle("reduced-motion", Boolean(enabled));
}

function applySoundEnabled(enabled) {
    if (typeof window.setSoundEnabled === "function") window.setSoundEnabled(Boolean(enabled));
    settingsEvents.emit("soundChanged", Boolean(enabled));
}

function applyMusicEnabled(enabled) {
    if (typeof window.setMusicEnabled === "function") window.setMusicEnabled(Boolean(enabled));
    settingsEvents.emit("musicChanged", Boolean(enabled));
}

function applyEffectsEnabled(enabled) {
    if (typeof window.setEffectsEnabled === "function") window.setEffectsEnabled(Boolean(enabled));
    settingsEvents.emit("effectsChanged", Boolean(enabled));
}

function applyVibrationEnabled(enabled) {
    settingsEvents.emit("vibrationChanged", Boolean(enabled));
}

function applyNotificationsEnabled(enabled) {
    document.documentElement.classList.toggle("notifications-disabled", !enabled);
    if (window.hokmNotifications && typeof window.hokmNotifications.setEnabled === "function") {
        window.hokmNotifications.setEnabled(Boolean(enabled));
    }
    settingsEvents.emit("notificationsChanged", Boolean(enabled));
}

function applyOnlineStatus(enabled) {
    document.documentElement.setAttribute("data-show-online", enabled ? "true" : "false");
    settingsEvents.emit("onlineStatusChanged", Boolean(enabled));
}

function applyProfileVisibility(enabled) {
    document.documentElement.setAttribute("data-profile-visible", enabled ? "true" : "false");
    settingsEvents.emit("profileVisibilityChanged", Boolean(enabled));
}

function applyGameSettings() {
    const gameSettings = {
        animations: settingsState.settings.animations,
        reducedMotion: settingsState.settings.reducedMotion,
        cardAnimation: settingsState.settings.cardAnimation,
        cardHints: settingsState.settings.cardHints,
        highlightLegalMoves: settingsState.settings.highlightLegalMoves,
        autoSortCards: settingsState.settings.autoSortCards,
        graphicQuality: settingsState.settings.graphicQuality
    };

    if (window.hokmGame && typeof window.hokmGame.applySettings === "function") {
        window.hokmGame.applySettings(gameSettings);
    }
    settingsEvents.emit("gameSettingsChanged", gameSettings);
}

function applyLowPowerMode(enabled) {
    document.documentElement.classList.toggle("low-power-mode", Boolean(enabled));
    document.documentElement.classList.toggle("performance-mode", Boolean(enabled));
    settingsEvents.emit("lowPowerModeChanged", Boolean(enabled));
}

/* ================================================================
   8. UI CONTROLS & FORMATTERS
================================================================ */

function updateSettingsUI() {
    const settings = settingsState.settings;

    document.querySelectorAll("[data-setting]").forEach(element => {
        const key = element.dataset.setting;
        if (!Object.prototype.hasOwnProperty.call(settings, key)) return;
        const value = settings[key];

        if (element.type === "checkbox") element.checked = Boolean(value);
        if (element.type === "range") element.value = value;
        if (element.tagName === "SELECT") element.value = value;
        if (element.type === "radio") element.checked = element.value === String(value);
    });

    const soundBox = document.getElementById("soundSetting");
    if (soundBox) soundBox.checked = settings.soundEnabled;
    const vibBox = document.getElementById("vibrationSetting");
    if (vibBox) vibBox.checked = settings.vibrationEnabled;
    const notifBox = document.getElementById("notificationSetting");
    if (notifBox) notifBox.checked = settings.notificationsEnabled;
}

function formatSettingValue(key, value) {
    switch (key) {
        case "theme": return value === "dark" ? "تیره" : value === "light" ? "روشن" : "خودکار";
        case "graphicQuality": return value === "low" ? "پایین" : value === "medium" ? "متوسط" : value === "high" ? "بالا" : "فوق‌العاده";
        default: return typeof value === "boolean" ? (value ? "فعال" : "غیرفعال") : String(value);
    }
}

async function setTheme(theme) {
    if (!["dark", "light", "auto"].includes(theme)) return false;
    return await setSetting("theme", theme);
}

async function setGraphicQuality(quality) {
    if (!["low", "medium", "high", "ultra"].includes(quality)) return false;
    return await setSetting("graphicQuality", quality);
}

async function setLanguage(language) {
    if (typeof language !== "string" || !language) return false;
    return await setSetting("language", language);
}

function vibrate(pattern = 30) {
    if (!settingsState.settings.vibrationEnabled || !navigator.vibrate) return false;
    try {
        navigator.vibrate(pattern);
        return true;
    } catch (e) {
        return false;
    }
}

async function resetSettings(options = {}) {
    const previous = getSettings();
    settingsState.settings = normalizeSettings(DEFAULT_SETTINGS);
    saveLocalSettings(settingsState.settings);
    applyAllSettings();

    settingsEvents.emit("reset", { previous, settings: getSettings() });
    if (options.remote !== false) await saveSettingsToServer();
    if (options.showToast !== false) settingsToast("تنظیمات به حالت پیش‌فرض برگشت.", "🔄");
    return true;
}

function clearLocalSettings() {
    try {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
        return true;
    } catch (e) {
        return false;
    }
}

/* ================================================================
   9. PANEL & EVENTS
================================================================ */

function openSettingsPanel() {
    const panel = document.querySelector("[data-settings-panel], #settingsScreen");
    if (panel) {
        panel.classList.add("active", "open");
        panel.removeAttribute("hidden");
    }
    updateSettingsUI();
    settingsEvents.emit("panelOpened");
}

function closeSettingsPanel() {
    const panel = document.querySelector("[data-settings-panel], #settingsScreen");
    if (panel) {
        panel.classList.remove("active", "open");
    }
    settingsEvents.emit("panelClosed");
}

function toggleSettingsPanel() {
    const panel = document.querySelector("[data-settings-panel], #settingsScreen");
    if (panel && (panel.classList.contains("open") || panel.classList.contains("active"))) {
        closeSettingsPanel();
    } else {
        openSettingsPanel();
    }
}

function setupSettingsUIEvents() {
    document.addEventListener("change", async event => {
        const target = event.target;
        if (target.id === "soundSetting") await setSetting("soundEnabled", target.checked);
        if (target.id === "vibrationSetting") await setSetting("vibrationEnabled", target.checked);
        if (target.id === "notificationSetting") await setSetting("notificationsEnabled", target.checked);

        const el = target.closest("[data-setting]");
        if (el) {
            const key = el.dataset.setting;
            const val = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
            await setSetting(key, val);
        }
    });

    document.addEventListener("click", async event => {
        if (event.target.closest("[data-open-settings]")) {
            event.preventDefault();
            openSettingsPanel();
        }
        if (event.target.closest("[data-close-settings]")) {
            event.preventDefault();
            closeSettingsPanel();
        }
        if (event.target.closest("[data-reset-settings]")) {
            event.preventDefault();
            await resetSettings();
        }
    });
}

function setupSystemThemeListener() {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
        if (settingsState.settings.theme === "auto") applyTheme("auto");
    };
    if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handler);
    }
}

async function initializeSettings() {
    if (settingsState.initialized || settingsState.loading) return settingsState;
    settingsState.loading = true;

    try {
        const localSettings = loadLocalSettings();
        if (localSettings) settingsState.settings = localSettings;

        const remoteSettings = await loadRemoteSettings();
        if (remoteSettings) {
            settingsState.settings = normalizeSettings(remoteSettings);
            saveLocalSettings(settingsState.settings);
        }

        applyAllSettings();
        settingsState.initialized = true;
        settingsState.loading = false;
        settingsEvents.emit("initialized", getSettings());
        return settingsState;
    } catch (error) {
        settingsState.loading = false;
        settingsState.settings = normalizeSettings(settingsState.settings);
        applyAllSettings();
        settingsState.initialized = true;
        return settingsState;
    }
}

window.hokmSettings = {
    initialize: initializeSettings,
    getSettings,
    getSetting,
    setSetting,
    setSettings,
    save: saveSettingsToServer,
    reset: resetSettings,
    clearLocal: clearLocalSettings,
    setTheme,
    setGraphicQuality,
    setLanguage,
    vibrate,
    open: openSettingsPanel,
    close: closeSettingsPanel,
    toggle: toggleSettingsPanel,
    on: (evt, cb) => settingsEvents.on(evt, cb),
    applyAll: applyAllSettings,
    updateUI: updateSettingsUI
};

window.getSettings = getSettings;
window.setSetting = setSetting;
window.openSettings = openSettingsPanel;
window.closeSettings = closeSettingsPanel;
window.toggleSettings = toggleSettingsPanel;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initializeSettings();
        setupSettingsUIEvents();
        setupSystemThemeListener();
    });
} else {
    initializeSettings();
    setupSettingsUIEvents();
    setupSystemThemeListener();
}
