"use strict";

/* ================================================================
   HOKM ONLINE - auth.js
   ================================================================ */

function getSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
        return window.supabase;
    }
    console.error("Supabase client پیدا نشد. ابتدا config.js و Supabase را بررسی کنید.");
    return null;
}

const authState = {
    initialized: false,
    loading: false,
    user: null,
    profile: null,
    session: null,
    loggedIn: false
};

const authEvents = {
    listeners: {},
    on(eventName, callback) {
        if (typeof callback !== "function") return;
        if (!this.listeners[eventName]) this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    },
    emit(eventName, data) {
        const listeners = this.listeners[eventName] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`خطا در Auth Event: ${eventName}`, error);
            }
        });
    }
};

function authToast(message, icon = "ℹ️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function authLoading(show, message = "لطفاً صبر کنید...") {
    if (show && typeof window.showLoading === "function") {
        window.showLoading(message);
        return;
    }
    if (!show && typeof window.hideLoading === "function") {
        window.hideLoading();
    }
}

function getCurrentUser() { return authState.user; }
function getCurrentSession() { return authState.session; }
function isLoggedIn() { return authState.loggedIn === true && !!authState.user; }
function getCurrentProfile() { return authState.profile; }

function getProfileDisplayName(profile = null) {
    const data = profile || authState.profile;
    if (!data) {
        return (
            authState.user?.user_metadata?.display_name ||
            authState.user?.user_metadata?.username ||
            "بازیکن"
        );
    }
    return (
        data.display_name ||
        data.username ||
        authState.user?.user_metadata?.display_name ||
        authState.user?.user_metadata?.username ||
        "بازیکن"
    );
}

async function loadAuthSession() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const { data, error } = await client.auth.getSession();
        if (error) {
            console.error("خطا در دریافت Session:", error);
            return null;
        }

        authState.session = data?.session || null;
        authState.user = data?.session?.user || null;
        authState.loggedIn = !!authState.user;
        return authState.session;
    } catch (error) {
        console.error("خطا در loadAuthSession:", error);
        return null;
    }
}

async function loadProfile(userId = null) {
    const client = getSupabaseClient();
    if (!client) return null;

    const id = userId || authState.user?.id;
    if (!id) {
        authState.profile = null;
        return null;
    }

    try {
        const { data, error } = await client
            .from("profiles")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) {
            console.error("خطا در دریافت پروفایل:", error);
            return null;
        }

        authState.profile = data || null;
        return data || null;
    } catch (error) {
        console.error("خطا در loadProfile:", error);
        return null;
    }
}

async function createProfile(user, extraData = {}) {
    const client = getSupabaseClient();
    if (!client || !user) return null;

    const defaultName =
        extraData.display_name ||
        extraData.username ||
        user.user_metadata?.display_name ||
        user.user_metadata?.username ||
        user.user_metadata?.name ||
        "بازیکن";

    const safeName = String(defaultName).trim().slice(0, 20) || "بازیکن";

    const profileData = {
        id: user.id,
        username: safeName,
        avatar_url: extraData.avatar_url || user.user_metadata?.avatar_url || null,
        coins: Number(extraData.coins ?? 1000),
        level: Number(extraData.level ?? 1),
        games_played: Number(extraData.games_played ?? 0),
        games_won: Number(extraData.games_won ?? 0),
        total_tricks: Number(extraData.total_tricks ?? 0),
        experience: Number(extraData.experience ?? 0)
    };

    try {
        const { data, error } = await client
            .from("profiles")
            .insert(profileData)
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return await loadProfile(user.id);
            }
            console.error("خطا در ساخت پروفایل:", error);
            return null;
        }

        authState.profile = data;
        return data;
    } catch (error) {
        console.error("خطا در createProfile:", error);
        return null;
    }
}

async function ensureProfile(user) {
    if (!user) return null;
    let profile = await loadProfile(user.id);
    if (!profile) {
        profile = await createProfile(user);
    }
    return profile;
}

function isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(String(email || ""));
}

function translateAuthError(error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("invalid login credentials")) return "ایمیل یا رمز عبور اشتباه است.";
    if (message.includes("email not confirmed")) return "ابتدا ایمیل خود را تأیید کنید.";
    if (message.includes("user already registered")) return "این ایمیل قبلاً ثبت‌نام شده است.";
    if (message.includes("password should be at least")) return "رمز عبور باید حداقل ۶ کاراکتر باشد.";
    if (message.includes("unable to validate email address")) return "فرمت ایمیل صحیح نیست.";
    if (message.includes("rate limit")) return "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.";
    if (message.includes("network")) return "اتصال اینترنت را بررسی کنید.";
    if (message.includes("fetch")) return "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.";
    if (message.includes("duplicate")) return "این اطلاعات قبلاً ثبت شده است.";
    return error?.message || "خطایی در احراز هویت رخ داد.";
}

async function signUp(email, password, displayName) {
    const client = getSupabaseClient();
    if (!client) {
        authToast("اتصال Supabase آماده نیست.", "⚠️");
        return { success: false, error: "Supabase client not found" };
    }

    email = String(email || "").trim().toLowerCase();
    password = String(password || "");
    displayName = String(displayName || "").trim();

    if (!email) { authToast("ایمیل را وارد کنید.", "⚠️"); return { success: false, error: "EMAIL_REQUIRED" }; }
    if (!isValidEmail(email)) { authToast("فرمت ایمیل صحیح نیست.", "⚠️"); return { success: false, error: "INVALID_EMAIL" }; }
    if (password.length < 6) { authToast("رمز عبور باید حداقل ۶ کاراکتر باشد.", "⚠️"); return { success: false, error: "WEAK_PASSWORD" }; }
    if (displayName.length < 2) { authToast("نام بازیکن باید حداقل ۲ حرف باشد.", "⚠️"); return { success: false, error: "INVALID_NAME" }; }

    try {
        authLoading(true, "در حال ساخت حساب...");
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: displayName.slice(0, 20),
                    display_name: displayName.slice(0, 20)
                }
            }
        });

        authLoading(false);
        if (error) {
            console.error("خطای ثبت‌نام:", error);
            authToast(translateAuthError(error), "❌", 4000);
            return { success: false, error };
        }

        authState.user = data?.user || null;
        authState.session = data?.session || null;
        authState.loggedIn = !!authState.user;

        if (data?.session && data?.user) {
            await ensureProfile(data.user);
        }

        if (data?.user && !data?.session) {
            authToast("حساب ساخته شد. ایمیل خود را برای تأیید حساب بررسی کنید.", "📧", 5000);
        } else {
            authToast("حساب با موفقیت ساخته شد.", "🎉", 3500);
        }

        authEvents.emit("signup", data);
        updateAuthUI();

        return {
            success: true,
            user: data?.user || null,
            session: data?.session || null,
            profile: authState.profile
        };
    } catch (error) {
        authLoading(false);
        console.error("خطای غیرمنتظره ثبت‌نام:", error);
        authToast("در ثبت‌نام مشکلی به وجود آمد.", "❌");
        return { success: false, error };
    }
}

async function signIn(email, password) {
    const client = getSupabaseClient();
    if (!client) {
        authToast("اتصال Supabase آماده نیست.", "⚠️");
        return { success: false, error: "Supabase client not found" };
    }

    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

    if (!email) { authToast("ایمیل را وارد کنید.", "⚠️"); return { success: false, error: "EMAIL_REQUIRED" }; }
    if (!isValidEmail(email)) { authToast("ایمیل واردشده صحیح نیست.", "⚠️"); return { success: false, error: "INVALID_EMAIL" }; }
    if (!password) { authToast("رمز عبور را وارد کنید.", "⚠️"); return { success: false, error: "PASSWORD_REQUIRED" }; }

    try {
        authLoading(true, "در حال ورود...");
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        authLoading(false);

        if (error) {
            console.error("خطای ورود:", error);
            authToast(translateAuthError(error), "❌", 4000);
            return { success: false, error };
        }

        authState.user = data?.user || null;
        authState.session = data?.session || null;
        authState.loggedIn = !!authState.user;

        if (authState.user) {
            await ensureProfile(authState.user);
        }

        updateAuthUI();
        authEvents.emit("signin", data);
        authToast("با موفقیت وارد شدی. خوش آمدی! 🎮", "👋", 3500);

        return {
            success: true,
            user: data?.user || null,
            session: data?.session || null,
            profile: authState.profile
        };
    } catch (error) {
        authLoading(false);
        console.error("خطای غیرمنتظره ورود:", error);
        authToast("ورود انجام نشد.", "❌");
        return { success: false, error };
    }
}

async function signOut() {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        authLoading(true, "در حال خروج...");
        const { error } = await client.auth.signOut();
        authLoading(false);

        if (error) {
            console.error("خطای خروج:", error);
            authToast("خروج از حساب انجام نشد.", "❌");
            return false;
        }

        authState.user = null;
        authState.session = null;
        authState.profile = null;
        authState.loggedIn = false;

        updateAuthUI();
        authEvents.emit("signout", null);
        authToast("با موفقیت از حساب خارج شدی.", "🚪");
        return true;
    } catch (error) {
        authLoading(false);
        console.error("خطای غیرمنتظره خروج:", error);
        return false;
    }
}

async function updateProfile(updates = {}) {
    const client = getSupabaseClient();
    if (!client || !authState.user) {
        authToast("ابتدا وارد حساب شوید.", "⚠️");
        return null;
    }

    const allowedUpdates = {};
    if (updates.display_name !== undefined || updates.username !== undefined) {
        const rawName = updates.display_name !== undefined ? updates.display_name : updates.username;
        const name = String(rawName || "").trim().slice(0, 20);
        if (name.length < 2) {
            authToast("نام بازیکن معتبر نیست.", "⚠️");
            return null;
        }
        allowedUpdates.username = name;
    }

    if (updates.avatar_url !== undefined) {
        allowedUpdates.avatar_url = updates.avatar_url;
    }

    if (Object.keys(allowedUpdates).length === 0) {
        return authState.profile;
    }

    try {
        const { data, error } = await client
            .from("profiles")
            .update(allowedUpdates)
            .eq("id", authState.user.id)
            .select()
            .single();

        if (error) {
            console.error("خطا در به‌روزرسانی پروفایل:", error);
            authToast("ذخیره پروفایل انجام نشد.", "❌");
            return null;
        }

        authState.profile = data;
        syncWithGameState();
        updateAuthUI();
        authEvents.emit("profileUpdated", data);
        return data;
    } catch (error) {
        console.error("خطای updateProfile:", error);
        return null;
    }
}

async function updateDisplayName(name) {
    return await updateProfile({ display_name: name });
}

async function changePassword(newPassword) {
    const client = getSupabaseClient();
    if (!client || !authState.user) {
        authToast("ابتدا وارد حساب شوید.", "⚠️");
        return false;
    }

    newPassword = String(newPassword || "");
    if (newPassword.length < 6) {
        authToast("رمز عبور باید حداقل ۶ کاراکتر باشد.", "⚠️");
        return false;
    }

    try {
        authLoading(true, "در حال تغییر رمز عبور...");
        const { error } = await client.auth.updateUser({ password: newPassword });
        authLoading(false);

        if (error) {
            console.error("خطا در تغییر رمز:", error);
            authToast(translateAuthError(error), "❌");
            return false;
        }

        authToast("رمز عبور با موفقیت تغییر کرد.", "🔐");
        return true;
    } catch (error) {
        authLoading(false);
        console.error("خطای changePassword:", error);
        return false;
    }
}

async function resetPassword(email) {
    const client = getSupabaseClient();
    if (!client) return false;

    email = String(email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
        authToast("یک ایمیل معتبر وارد کنید.", "⚠️");
        return false;
    }

    try {
        authLoading(true, "در حال ارسال لینک بازیابی...");
        let redirectUrl = `${window.location.origin}${window.location.pathname}`;
        if (window.HOKM_SUPABASE_CONFIG && window.HOKM_SUPABASE_CONFIG.passwordResetPath) {
            redirectUrl = `${window.location.origin}${window.HOKM_SUPABASE_CONFIG.passwordResetPath}`;
        }

        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
        authLoading(false);

        if (error) {
            console.error("خطای بازیابی رمز:", error);
            authToast(translateAuthError(error), "❌");
            return false;
        }

        authToast("لینک بازیابی رمز به ایمیل شما ارسال شد.", "📧", 5000);
        return true;
    } catch (error) {
        authLoading(false);
        console.error("خطای resetPassword:", error);
        return false;
    }
}

function setupAuthListener() {
    const client = getSupabaseClient();
    if (!client) return;

    client.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth State Change:", event);
        authState.session = session || null;
        authState.user = session?.user || null;
        authState.loggedIn = !!authState.user;

        if (!authState.user) {
            authState.profile = null;
            updateAuthUI();
            authEvents.emit("authStateChanged", { event, session, user: null });
            return;
        }

        const userId = authState.user.id;
        setTimeout(async () => {
            if (!authState.user || authState.user.id !== userId) return;
            await ensureProfile(authState.user);
            updateAuthUI();
        }, 0);

        authEvents.emit("authStateChanged", { event, session, user: authState.user });
    });
}

function updateAuthUI() {
    const loggedIn = isLoggedIn();

    document.querySelectorAll("[data-auth='logged-in']").forEach(el => {
        el.style.display = loggedIn ? "" : "none";
    });

    document.querySelectorAll("[data-auth='logged-out']").forEach(el => {
        el.style.display = loggedIn ? "none" : "";
    });

    const name = getProfileDisplayName();
    document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = name; });
    document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = authState.user?.email || ""; });

    const avatar = authState.profile?.avatar_url || authState.user?.user_metadata?.avatar_url;
    document.querySelectorAll("[data-user-avatar]").forEach(el => {
        if (avatar && el.tagName === "IMG") el.src = avatar;
    });

    const coins = authState.profile?.coins;
    if (coins !== undefined && coins !== null) {
        document.querySelectorAll("[data-user-coins]").forEach(el => {
            el.textContent = Number(coins).toLocaleString("fa-IR");
        });
    }

    const level = authState.profile?.level;
    if (level !== undefined && level !== null) {
        document.querySelectorAll("[data-user-level]").forEach(el => {
            el.textContent = Number(level).toLocaleString("fa-IR");
        });
    }

    syncWithGameState();
}

function syncWithGameState() {
    if (!authState.profile || !window.state || !window.state.player) return;
    const profile = authState.profile;
    const playerName = profile.display_name || profile.username;

    if (playerName) window.state.player.name = playerName;
    if (profile.coins !== undefined) window.state.player.coins = Number(profile.coins);
    if (profile.level !== undefined) window.state.player.level = Number(profile.level);
    if (profile.games_played !== undefined) window.state.player.gamesPlayed = Number(profile.games_played);
    if (profile.games_won !== undefined) window.state.player.gamesWon = Number(profile.games_won);
    if (profile.total_tricks !== undefined) window.state.player.totalTricks = Number(profile.total_tricks);
    if (profile.experience !== undefined) window.state.player.experience = Number(profile.experience);

    if (typeof window.updatePlayerUI === "function") window.updatePlayerUI();
}

async function initializeAuth() {
    if (authState.initialized) return;
    const client = getSupabaseClient();
    if (!client) {
        console.warn("Auth initialization متوقف شد چون Supabase Client پیدا نشد.");
        return;
    }

    try {
        authState.loading = true;
        await loadAuthSession();
        if (authState.user) {
            await ensureProfile(authState.user);
        }
        setupAuthListener();
        updateAuthUI();
        authState.initialized = true;
        authState.loading = false;
        authEvents.emit("initialized", {
            user: authState.user,
            session: authState.session,
            profile: authState.profile
        });
        console.log("Hokm Online Auth initialized successfully.");
    } catch (error) {
        authState.loading = false;
        console.error("خطا در initializeAuth:", error);
    }
}

function waitForAuth() {
    return new Promise(resolve => {
        if (authState.initialized) {
            resolve(authState);
            return;
        }
        authEvents.on("initialized", () => resolve(authState));
    });
}

function onAuthChange(cb) { authEvents.on("authStateChanged", cb); }
function onSignUp(cb) { authEvents.on("signup", cb); }
function onSignIn(cb) { authEvents.on("signin", cb); }
function onSignOut(cb) { authEvents.on("signout", cb); }
function onProfileUpdated(cb) { authEvents.on("profileUpdated", cb); }

window.hokmAuth = {
    signUp,
    signIn,
    signOut,
    resetPassword,
    changePassword,
    updateProfile,
    updateDisplayName,
    getCurrentUser,
    getCurrentSession,
    getCurrentProfile,
    getProfileDisplayName,
    isLoggedIn,
    loadProfile,
    ensureProfile,
    waitForAuth,
    onAuthChange,
    onSignUp,
    onSignIn,
    onSignOut,
    onProfileUpdated,
    initializeAuth
};

window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.resetPassword = resetPassword;
window.changePassword = changePassword;
window.updateProfile = updateProfile;
window.updateDisplayName = updateDisplayName;
window.getCurrentUser = getCurrentUser;
window.getCurrentSession = getCurrentSession;
window.getCurrentProfile = getCurrentProfile;
window.getProfileDisplayName = getProfileDisplayName;
window.isLoggedIn = isLoggedIn;

function startAuthInitialization() {
    if (authState.initialized) return;
    if (getSupabaseClient()) {
        initializeAuth();
        return;
    }

    let attempts = 0;
    const maxAttempts = 20;
    const retryTimer = setInterval(() => {
        attempts++;
        if (authState.initialized) { clearInterval(retryTimer); return; }
        if (getSupabaseClient()) {
            clearInterval(retryTimer);
            initializeAuth();
            return;
        }
        if (attempts >= maxAttempts) {
            clearInterval(retryTimer);
            console.warn("Supabase Client بعد از تلاش‌های متعدد پیدا نشد.");
        }
    }, 500);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAuthInitialization);
} else {
    startAuthInitialization();
}
