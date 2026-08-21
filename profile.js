"use strict";

/*
====================================================================
 HOKM ONLINE
 profile.js
====================================================================

 فایل شماره ۵ از ۱۲
 سیستم مدیریت پروفایل و آمار بازیکن
====================================================================
*/

/* ================================================================
   1. PROFILE STATE
================================================================ */

const profileState = {
    initialized: false,
    loading: false,
    editing: false,
    profile: null,
    user: null,
    isGuest: false,
    selectedAvatar: null,
    originalProfile: null
};

/* ================================================================
   2. PROFILE CONSTANTS
================================================================ */

const PROFILE_CONFIG = {
    defaultName: "بازیکن",
    defaultLevel: 1,
    defaultCoins: 3000,
    defaultExperience: 0,
    maxNameLength: 20,
    minNameLength: 2,
    avatars: [
        "♟️", "👑", "😎", "🔥", "⚡", "🎯", "🦁", "🐯",
        "🐺", "🦊", "🐼", "🐸", "🤖", "👽", "💎", "🏆"
    ],
    levelBaseXP: 100,
    levelXPIncrement: 50
};

/* ================================================================
   3. UTILITY FUNCTIONS
================================================================ */

function profileLog(...args) {
    console.log("[HOKM PROFILE]", ...args);
}

function profileWarn(...args) {
    console.warn("[HOKM PROFILE]", ...args);
}

function profileError(...args) {
    console.error("[HOKM PROFILE]", ...args);
}

function profileToast(message, icon = "ℹ️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function profileLoading(show, message = "لطفاً صبر کنید...") {
    if (show && typeof window.showLoading === "function") {
        window.showLoading(message);
        return;
    }
    if (!show && typeof window.hideLoading === "function") {
        window.hideLoading();
    }
}

function profileNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function profileString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value);
}

/* ================================================================
   4. CLIENT & CURRENT USER
================================================================ */

function getProfileSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
        return window.supabase;
    }
    return null;
}

function profileGetCurrentUser() {
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentUser === "function") {
        return window.hokmAuth.getCurrentUser();
    }
    return profileState.user || null;
}

function profileGetCurrentProfile() {
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentProfile === "function") {
        const profile = window.hokmAuth.getCurrentProfile();
        if (profile) return profile;
    }
    return profileState.profile || null;
}

/* ================================================================
   5. PROFILE NORMALIZATION
================================================================ */

function createDefaultProfile(user = null) {
    const metadata = user?.user_metadata || {};
    const metadataName = metadata.display_name || metadata.username || metadata.name;
    const name = profileNormalizeName(metadataName || PROFILE_CONFIG.defaultName);

    return {
        id: user?.id || null,
        username: name,
        display_name: name,
        avatar_url: metadata.avatar_url || null,
        avatar: metadata.avatar || PROFILE_CONFIG.avatars[0],
        coins: PROFILE_CONFIG.defaultCoins,
        level: PROFILE_CONFIG.defaultLevel,
        experience: PROFILE_CONFIG.defaultExperience,
        games_played: 0,
        games_won: 0,
        games_lost: 0,
        total_tricks: 0,
        win_streak: 0,
        best_win_streak: 0,
        rating: 1000,
        rank: "برنزی",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

function profileNormalizeName(name) {
    let result = profileString(name, PROFILE_CONFIG.defaultName).trim();
    if (result.length < PROFILE_CONFIG.minNameLength) {
        result = PROFILE_CONFIG.defaultName;
    }
    return result.slice(0, PROFILE_CONFIG.maxNameLength);
}

function normalizeProfile(profile, user = null) {
    const base = createDefaultProfile(user);
    const source = profile || {};
    const normalized = { ...base, ...source };

    const name = profileNormalizeName(
        normalized.display_name || normalized.username || base.display_name
    );

    normalized.username = name;
    normalized.display_name = name;
    normalized.coins = Math.max(0, profileNumber(normalized.coins, PROFILE_CONFIG.defaultCoins));
    normalized.level = Math.max(1, profileNumber(normalized.level, 1));
    normalized.experience = Math.max(0, profileNumber(normalized.experience, 0));
    normalized.games_played = Math.max(0, profileNumber(normalized.games_played, 0));
    normalized.games_won = Math.max(0, profileNumber(normalized.games_won, 0));
    normalized.games_lost = Math.max(0, profileNumber(normalized.games_lost, 0));
    normalized.total_tricks = Math.max(0, profileNumber(normalized.total_tricks, 0));
    normalized.win_streak = Math.max(0, profileNumber(normalized.win_streak, 0));
    normalized.best_win_streak = Math.max(0, profileNumber(normalized.best_win_streak, 0));
    normalized.rating = Math.max(0, profileNumber(normalized.rating, 1000));
    normalized.rank = normalized.rank || calculateRank(normalized.rating);

    return normalized;
}

/* ================================================================
   6. CALCULATIONS
================================================================ */

function getRequiredExperience(level) {
    const safeLevel = Math.max(1, profileNumber(level, 1));
    return PROFILE_CONFIG.levelBaseXP + (safeLevel - 1) * PROFILE_CONFIG.levelXPIncrement;
}

function getLevelProgress(profile = null) {
    const data = profile || profileState.profile || createDefaultProfile();
    const level = Math.max(1, profileNumber(data.level, 1));
    const experience = Math.max(0, profileNumber(data.experience, 0));
    const required = getRequiredExperience(level);
    const percentage = Math.min(100, Math.max(0, (experience / required) * 100));

    return { level, experience, required, percentage };
}

function calculateRank(rating) {
    const value = profileNumber(rating, 1000);
    if (value >= 1800) return "الماسی";
    if (value >= 1600) return "الماس";
    if (value >= 1400) return "طلایی";
    if (value >= 1200) return "نقره‌ای";
    return "برنزی";
}

function calculateWinRate(profile = null) {
    const data = profile || profileState.profile;
    if (!data) return 0;
    const games = profileNumber(data.games_played, 0);
    const wins = profileNumber(data.games_won, 0);
    if (games <= 0) return 0;
    return Math.min(100, Math.max(0, (wins / games) * 100));
}

function profileFormatNumber(value) {
    return profileNumber(value, 0).toLocaleString("fa-IR");
}

function profileFormatPercent(value) {
    return profileNumber(value, 0).toFixed(1) + "%";
}

/* ================================================================
   7. STORAGE & SERVER SYNC
================================================================ */

function loadLocalProfile() {
    try {
        const saved = localStorage.getItem("hokm_profile");
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== "object") return null;
        return normalizeProfile(parsed);
    } catch (error) {
        profileError("خطا در خواندن پروفایل محلی:", error);
        return null;
    }
}

function saveLocalProfile(profile) {
    try {
        const normalized = normalizeProfile(profile);
        localStorage.setItem("hokm_profile", JSON.stringify(normalized));
        return true;
    } catch (error) {
        profileError("خطا در ذخیره پروفایل محلی:", error);
        return false;
    }
}

async function loadProfileFromServer() {
    const client = getProfileSupabaseClient();
    const user = profileGetCurrentUser();
    if (!client || !user) return null;

    try {
        const { data, error } = await client
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error || !data) return null;
        return normalizeProfile(data, user);
    } catch (error) {
        profileError("خطای غیرمنتظره در loadProfileFromServer:", error);
        return null;
    }
}

async function saveProfileToServer(updates) {
    const client = getProfileSupabaseClient();
    const user = profileGetCurrentUser();
    if (!client || !user) return null;

    try {
        const allowed = { updated_at: new Date().toISOString() };
        if (updates.username !== undefined) allowed.username = profileNormalizeName(updates.username);
        if (updates.display_name !== undefined) allowed.username = profileNormalizeName(updates.display_name);
        if (updates.avatar_url !== undefined) allowed.avatar_url = updates.avatar_url;
        if (updates.avatar !== undefined) allowed.avatar = updates.avatar;

        const { data, error } = await client
            .from("profiles")
            .update(allowed)
            .eq("id", user.id)
            .select()
            .single();

        if (error) return null;
        return normalizeProfile(data, user);
    } catch (error) {
        profileError("خطای saveProfileToServer:", error);
        return null;
    }
}

async function loadProfileData() {
    if (profileState.loading) return profileState.profile;
    profileState.loading = true;

    try {
        const user = profileGetCurrentUser();
        profileState.user = user;

        if (user) {
            profileState.isGuest = false;
            let profile = profileGetCurrentProfile();
            if (!profile) profile = await loadProfileFromServer();

            if (profile) {
                profileState.profile = normalizeProfile(profile, user);
            } else {
                const local = loadLocalProfile();
                profileState.profile = normalizeProfile(local || createDefaultProfile(user), user);
            }
        } else {
            profileState.isGuest = true;
            const local = loadLocalProfile();
            profileState.profile = normalizeProfile(local || createDefaultProfile(), null);
        }

        profileState.originalProfile = JSON.parse(JSON.stringify(profileState.profile));
        saveLocalProfile(profileState.profile);
        updateProfileUI();
        return profileState.profile;
    } catch (error) {
        profileError("خطا در loadProfileData:", error);
        if (!profileState.profile) profileState.profile = createDefaultProfile();
        updateProfileUI();
        return profileState.profile;
    } finally {
        profileState.loading = false;
    }
}

/* ================================================================
   8. UI RENDERING
================================================================ */

function updateProfileUI() {
    const profile = profileState.profile || createDefaultProfile();
    const user = profileState.user || profileGetCurrentUser();
    profileState.profile = normalizeProfile(profile, user);
    const data = profileState.profile;

    document.querySelectorAll("[data-profile-name], [data-user-name]").forEach(el => {
        el.textContent = data.display_name || data.username || PROFILE_CONFIG.defaultName;
    });

    document.querySelectorAll("[data-profile-username]").forEach(el => {
        el.textContent = data.username || data.display_name || PROFILE_CONFIG.defaultName;
    });

    document.querySelectorAll("[data-profile-email], [data-user-email]").forEach(el => {
        el.textContent = user?.email || "مهمان";
    });

    document.querySelectorAll("[data-profile-coins], [data-user-coins]").forEach(el => {
        el.textContent = profileFormatNumber(data.coins);
    });

    document.querySelectorAll("[data-profile-level], [data-user-level]").forEach(el => {
        el.textContent = profileFormatNumber(data.level);
    });

    document.querySelectorAll("[data-profile-experience]").forEach(el => {
        el.textContent = profileFormatNumber(data.experience);
    });

    document.querySelectorAll("[data-games-played], #profileGames, #gamesPlayed").forEach(el => {
        el.textContent = profileFormatNumber(data.games_played);
    });

    document.querySelectorAll("[data-games-won], #profileWins, #gamesWon").forEach(el => {
        el.textContent = profileFormatNumber(data.games_won);
    });

    document.querySelectorAll("[data-games-lost], #profileLosses").forEach(el => {
        el.textContent = profileFormatNumber(data.games_lost);
    });

    document.querySelectorAll("[data-total-tricks]").forEach(el => {
        el.textContent = profileFormatNumber(data.total_tricks);
    });

    const winRate = calculateWinRate(data);
    document.querySelectorAll("[data-win-rate], #winRate").forEach(el => {
        el.textContent = profileFormatPercent(winRate);
    });

    document.querySelectorAll("[data-win-streak]").forEach(el => {
        el.textContent = profileFormatNumber(data.win_streak);
    });

    document.querySelectorAll("[data-best-win-streak]").forEach(el => {
        el.textContent = profileFormatNumber(data.best_win_streak);
    });

    document.querySelectorAll("[data-profile-rating]").forEach(el => {
        el.textContent = profileFormatNumber(data.rating);
    });

    document.querySelectorAll("[data-profile-rank]").forEach(el => {
        el.textContent = data.rank || calculateRank(data.rating);
    });

    updateProfileAvatarUI(data);
    updateLevelProgressUI(data);
    syncProfileWithGameState();
    emitProfileEvent("profileUIUpdated", data);
}

function updateProfileAvatarUI(profile) {
    const data = profile || profileState.profile || createDefaultProfile();
    document.querySelectorAll("[data-profile-avatar], [data-user-avatar], #profileAvatar").forEach(element => {
        if (element.tagName === "IMG") {
            if (data.avatar_url) element.src = data.avatar_url;
        } else {
            element.textContent = data.avatar || "♟️";
        }
    });
}

function updateLevelProgressUI(profile) {
    const progress = getLevelProgress(profile);
    document.querySelectorAll("[data-xp-progress]").forEach(el => {
        el.style.width = `${progress.percentage}%`;
        el.setAttribute("aria-valuenow", String(progress.percentage));
    });

    document.querySelectorAll("[data-xp-text]").forEach(el => {
        el.textContent = `${profileFormatNumber(progress.experience)} / ${profileFormatNumber(progress.required)}`;
    });

    document.querySelectorAll("[data-xp-percent]").forEach(el => {
        el.textContent = profileFormatPercent(progress.percentage);
    });
}

function syncProfileWithGameState() {
    const profile = profileState.profile;
    if (!profile || !window.state || !window.state.player) return;

    const player = window.state.player;
    player.name = profile.display_name || profile.username || player.name || PROFILE_CONFIG.defaultName;
    player.coins = profileNumber(profile.coins, player.coins || PROFILE_CONFIG.defaultCoins);
    player.level = profileNumber(profile.level, player.level || 1);
    player.experience = profileNumber(profile.experience, player.experience || 0);
    player.gamesPlayed = profileNumber(profile.games_played, player.gamesPlayed || 0);
    player.gamesWon = profileNumber(profile.games_won, player.gamesWon || 0);
    player.totalTricks = profileNumber(profile.total_tricks, player.totalTricks || 0);

    if (typeof window.updatePlayerUI === "function") {
        try { window.updatePlayerUI(); } catch (e) {}
    }
}

/* ================================================================
   9. EDIT & MUTATIONS
================================================================ */

async function updateProfileName(newName) {
    const name = profileNormalizeName(newName);
    if (name === PROFILE_CONFIG.defaultName && profileString(newName).trim().length < PROFILE_CONFIG.minNameLength) {
        profileToast("نام بازیکن معتبر نیست.", "⚠️");
        return false;
    }

    const current = profileState.profile || createDefaultProfile();
    const oldName = current.display_name || current.username;
    if (name === oldName) {
        closeProfileEditor();
        return true;
    }

    profileLoading(true, "در حال ذخیره نام...");
    try {
        let savedProfile = null;
        if (window.hokmAuth && typeof window.hokmAuth.updateDisplayName === "function") {
            savedProfile = await window.hokmAuth.updateDisplayName(name);
        }

        if (!savedProfile) {
            savedProfile = await saveProfileToServer({ username: name, display_name: name });
        }

        if (!savedProfile) {
            profileState.profile = normalizeProfile({
                ...current,
                username: name,
                display_name: name,
                updated_at: new Date().toISOString()
            });
        } else {
            profileState.profile = normalizeProfile(savedProfile, profileState.user);
        }

        saveLocalProfile(profileState.profile);
        updateProfileUI();
        closeProfileEditor();
        profileToast("نام بازیکن با موفقیت تغییر کرد.", "✅", 3500);
        emitProfileEvent("nameChanged", profileState.profile);
        return true;
    } catch (error) {
        profileError("خطا در updateProfileName:", error);
        profileToast("تغییر نام انجام نشد.", "❌");
        return false;
    } finally {
        profileLoading(false);
    }
}

async function updateAvatar(avatar, avatarUrl = null) {
    if (!avatar && !avatarUrl) return false;
    const current = profileState.profile || createDefaultProfile();
    const updates = {
        avatar: avatar || current.avatar,
        avatar_url: avatarUrl !== null ? avatarUrl : current.avatar_url
    };

    profileLoading(true, "در حال ذخیره آواتار...");
    try {
        let saved = null;
        if (window.hokmAuth && typeof window.hokmAuth.updateProfile === "function") {
            saved = await window.hokmAuth.updateProfile(updates);
        }

        if (!saved) saved = await saveProfileToServer(updates);

        if (saved) {
            profileState.profile = normalizeProfile(saved, profileState.user);
        } else {
            profileState.profile = normalizeProfile({
                ...current,
                ...updates,
                updated_at: new Date().toISOString()
            });
        }

        saveLocalProfile(profileState.profile);
        updateProfileUI();
        profileToast("آواتار با موفقیت تغییر کرد.", "✅");
        emitProfileEvent("avatarChanged", profileState.profile);
        return true;
    } catch (error) {
        profileError("خطا در updateAvatar:", error);
        profileToast("تغییر آواتار انجام نشد.", "❌");
        return false;
    } finally {
        profileLoading(false);
    }
}

function openProfileEditor() {
    const profile = profileState.profile || createDefaultProfile();
    profileState.editing = true;
    profileState.selectedAvatar = profile.avatar || PROFILE_CONFIG.avatars[0];

    const modal = document.querySelector("[data-profile-editor]");
    if (modal) {
        modal.classList.add("active");
        modal.style.display = "flex";
    } else if (typeof window.editProfile === "function") {
        window.editProfile();
        return;
    }

    const input = document.querySelector("[data-profile-name-input]");
    if (input) {
        input.value = profile.display_name || profile.username || "";
        setTimeout(() => { input.focus(); try { input.select(); } catch (_) {} }, 100);
    }
    renderAvatarSelector();
}

function closeProfileEditor() {
    profileState.editing = false;
    const modal = document.querySelector("[data-profile-editor]");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
}

function renderAvatarSelector() {
    const container = document.querySelector("[data-avatar-selector]");
    if (!container) return;

    container.innerHTML = "";
    PROFILE_CONFIG.avatars.forEach(avatar => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "profile-avatar-option";
        button.textContent = avatar;
        if (avatar === profileState.selectedAvatar) button.classList.add("selected");

        button.addEventListener("click", () => {
            profileState.selectedAvatar = avatar;
            container.querySelectorAll(".profile-avatar-option").forEach(item => {
                item.classList.remove("selected");
            });
            button.classList.add("selected");
        });
        container.appendChild(button);
    });
}

async function saveProfileEditor() {
    const input = document.querySelector("[data-profile-name-input]");
    if (!input) return false;

    const name = profileString(input.value).trim();
    if (name.length < PROFILE_CONFIG.minNameLength) {
        profileToast("نام باید حداقل ۲ کاراکتر باشد.", "⚠️");
        return false;
    }

    const nameResult = await updateProfileName(name);
    if (!nameResult) return false;

    if (profileState.selectedAvatar) {
        await updateAvatar(profileState.selectedAvatar);
    }
    closeProfileEditor();
    return true;
}

function cancelProfileEditor() {
    profileState.selectedAvatar = profileState.profile?.avatar || PROFILE_CONFIG.avatars[0];
    closeProfileEditor();
}

async function addExperience(amount) {
    const value = Math.max(0, profileNumber(amount, 0));
    if (value <= 0) return profileState.profile;

    const profile = profileState.profile || createDefaultProfile();
    let level = Math.max(1, profileNumber(profile.level, 1));
    let experience = Math.max(0, profileNumber(profile.experience, 0)) + value;
    let levelUp = false;

    while (experience >= getRequiredExperience(level)) {
        experience -= getRequiredExperience(level);
        level++;
        levelUp = true;
    }

    profileState.profile = normalizeProfile({
        ...profile,
        level,
        experience,
        updated_at: new Date().toISOString()
    });

    saveLocalProfile(profileState.profile);
    updateProfileUI();

    if (levelUp) {
        profileToast(`تبریک! به سطح ${profileFormatNumber(level)} رسیدی! 🎉`, "🏆", 5000);
        emitProfileEvent("levelUp", { level, profile: profileState.profile });
    }

    emitProfileEvent("experienceAdded", { amount: value, profile: profileState.profile });
    return profileState.profile;
}

/* ================================================================
   10. EVENTS & INIT
================================================================ */

const profileEvents = {
    listeners: {},
    on(eventName, callback) {
        if (typeof callback !== "function") return;
        if (!this.listeners[eventName]) this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    },
    emit(eventName, data) {
        const listeners = this.listeners[eventName] || [];
        listeners.forEach(callback => {
            try { callback(data); } catch (e) { profileError(`خطا در رویداد ${eventName}:`, e); }
        });
    }
};

function emitProfileEvent(eventName, data) {
    profileEvents.emit(eventName, data);
}

function setupProfileUIEvents() {
    document.addEventListener("click", event => {
        if (event.target.closest("[data-action='edit-profile'], #editProfileButton")) {
            event.preventDefault();
            openProfileEditor();
        }
        if (event.target.closest("[data-action='close-profile-editor']")) {
            event.preventDefault();
            closeProfileEditor();
        }
        if (event.target.closest("[data-action='save-profile']")) {
            event.preventDefault();
            saveProfileEditor();
        }
    });
}

function setupProfileAuthEvents() {
    if (!window.hokmAuth) return;

    if (typeof window.hokmAuth.onSignIn === "function") {
        window.hokmAuth.onSignIn(async data => {
            profileState.user = data?.user || profileGetCurrentUser();
            await loadProfileData();
        });
    }

    if (typeof window.hokmAuth.onSignOut === "function") {
        window.hokmAuth.onSignOut(() => {
            profileState.user = null;
            profileState.isGuest = true;
            profileState.profile = normalizeProfile(loadLocalProfile() || createDefaultProfile());
            updateProfileUI();
        });
    }

    if (typeof window.hokmAuth.onAuthChange === "function") {
        window.hokmAuth.onAuthChange(async data => {
            profileState.user = data?.user || null;
            profileState.isGuest = !profileState.user;
            await loadProfileData();
        });
    }
}

async function initializeProfile() {
    if (profileState.initialized) return profileState.profile;
    try {
        profileState.loading = true;
        setupProfileUIEvents();
        setupProfileAuthEvents();
        await loadProfileData();
        profileState.initialized = true;
        emitProfileEvent("initialized", profileState.profile);
        profileLog("Profile system initialized successfully.");
        return profileState.profile;
    } catch (error) {
        profileError("خطا در initializeProfile:", error);
        return profileState.profile;
    } finally {
        profileState.loading = false;
    }
}

window.hokmProfile = {
    state: profileState,
    config: PROFILE_CONFIG,
    initialize: initializeProfile,
    load: loadProfileData,
    updateUI: updateProfileUI,
    get: profileGetCurrentProfile,
    getUser: profileGetCurrentUser,
    getName: () => (profileState.profile || createDefaultProfile()).display_name,
    getCoins: () => profileNumber(profileState.profile?.coins, 0),
    getLevel: () => profileNumber(profileState.profile?.level, 1),
    updateName: updateProfileName,
    updateAvatar: updateAvatar,
    addExperience: addExperience,
    setCoins: (amount) => {
        if (!profileState.profile) profileState.profile = createDefaultProfile();
        profileState.profile.coins = Math.max(0, profileNumber(amount, 0));
        saveLocalProfile(profileState.profile);
        updateProfileUI();
        return profileState.profile.coins;
    },
    openEditor: openProfileEditor,
    closeEditor: closeProfileEditor,
    saveEditor: saveProfileEditor,
    on: profileEvents.on.bind(profileEvents)
};

window.initializeProfile = initializeProfile;
window.loadProfileData = loadProfileData;
window.updateProfileUI = updateProfileUI;
window.openProfileEditor = openProfileEditor;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { setTimeout(initializeProfile, 100); });
} else {
    setTimeout(initializeProfile, 100);
}
