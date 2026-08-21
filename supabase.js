"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * supabase.js
 *
 * سیستم مرکزی اتصال و اعتبارسنجی Supabase
 * ================================================================
 */

let supabaseClient = null;

function initializeSupabase() {
    if (typeof window.supabase === "undefined") {
        console.error("Supabase library پیدا نشد.");
        showSupabaseError("کتابخانه Supabase بارگذاری نشده است.");
        return false;
    }

    const config = window.HOKM_SUPABASE_CONFIG || window.SUPABASE_CONFIG;

    if (!config || !config.url || !config.anonKey) {
        console.error("تنظیمات اتصال Supabase پیدا نشد.");
        showSupabaseError("تنظیمات Supabase هنوز کامل نشده است.");
        return false;
    }

    if (supabaseClient) return true;

    try {
        supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        window.supabaseClient = supabaseClient;
        console.log("Supabase Client initialized successfully.");
        return true;
    } catch (error) {
        console.error("خطا در ساخت Supabase Client:", error);
        showSupabaseError("اتصال به Supabase ایجاد نشد.");
        return false;
    }
}

function getSupabase() {
    if (!supabaseClient) {
        const initialized = initializeSupabase();
        if (!initialized) return null;
    }
    return supabaseClient;
}

async function checkSupabaseConnection() {
    const client = getSupabase();
    if (!client) {
        return { success: false, error: "Supabase Client در دسترس نیست." };
    }

    try {
        const { data, error } = await client.auth.getSession();
        if (error) {
            console.error("Supabase connection error:", error);
            return { success: false, error };
        }
        return { success: true, session: data?.session || null };
    } catch (error) {
        return { success: false, error };
    }
}

async function testSupabaseDatabase() {
    const client = getSupabase();
    if (!client) {
        return { success: false, error: "Supabase Client در دسترس نیست." };
    }

    try {
        const { data, error } = await client.from("profiles").select("id").limit(1);
        if (error) {
            console.error("Database test failed:", error);
            return { success: false, error };
        }
        return { success: true, data };
    } catch (error) {
        return { success: false, error };
    }
}

function showSupabaseError(message) {
    if (typeof showToast === "function") {
        showToast(message, "⚠️", 4000);
        return;
    }
    console.warn("Supabase:", message);
}

function setSupabaseStatus(connected) {
    const statusElement = document.getElementById("supabaseStatus");
    if (!statusElement) return;

    if (connected) {
        statusElement.textContent = "متصل";
        statusElement.classList.remove("offline");
        statusElement.classList.add("online");
    } else {
        statusElement.textContent = "قطع";
        statusElement.classList.remove("online");
        statusElement.classList.add("offline");
    }
}

async function initializeSupabaseSystem() {
    const initialized = initializeSupabase();
    if (!initialized) {
        setSupabaseStatus(false);
        return false;
    }

    const connection = await checkSupabaseConnection();
    if (!connection.success) {
        setSupabaseStatus(false);
        return false;
    }

    setSupabaseStatus(true);
    return true;
}

window.HokmSupabase = {
    getClient: getSupabase,
    initialize: initializeSupabase,
    checkConnection: checkSupabaseConnection,
    testDatabase: testSupabaseDatabase,
    isConnected: function () {
        return supabaseClient !== null;
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSupabaseSystem);
} else {
    initializeSupabaseSystem();
}
