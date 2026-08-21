"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * config.js
 *
 * نسخه پایه نهایی پروژه
 *
 * مسئولیت:
 * - تنظیمات Supabase
 * - تنظیمات اصلی بازی
 * - اقتصاد بازی
 * - تنظیمات فروشگاه
 * - تنظیمات اتاق
 * - تنظیمات Realtime
 * - تنظیمات مسیرهای پروژه
 * ================================================================
 */

/* ================================================================
   1. SUPABASE CONFIG
================================================================ */

const HOKM_SUPABASE_CONFIG = {

    url:
        "https://nljarvuyhpjwwtfmjcqo.supabase.co",

    anonKey:
        "Sb_publishable_W2DCPAo0Oa4c0kKqcWJjWw_t7sLGz-6",

    passwordResetPath:
        "/reset-password.html"

};

/* ================================================================
   2. GAME CONFIG
================================================================ */

const HOKM_GAME_CONFIG = {

    name:
        "حکم آنلاین",

    version:
        "1.0.0",

    language:
        "fa",

    direction:
        "rtl",

    maxPlayers:
        4,

    playersPerTeam:
        2,

    startingCoins:
        3000,

    gameEntryFee:
        400,

    minimumCoinsToPlay:
        400,

    cardsPerPlayer:
        13,

    deckSize:
        52,

    tricksPerRound:
        13,

    winningScore:
        7

};

/* ================================================================
   3. COIN PACKAGES
================================================================ */

const HOKM_COIN_PACKAGES = [

    {
        id:
            "coins_200",

        coins:
            200,

        priceToman:
            25000,

        title:
            "بسته ۲۰۰ سکه",

        popular:
            false
    },

    {
        id:
            "coins_600",

        coins:
            600,

        priceToman:
            40000,

        title:
            "بسته ۶۰۰ سکه",

        popular:
            true
    },

    {
        id:
            "coins_1200",

        coins:
            1200,

        priceToman:
            80000,

        title:
            "بسته ۱۲۰۰ سکه",

        popular:
            false
    }

];

/* ================================================================
   4. SHOP CONFIG
================================================================ */

const HOKM_SHOP_CONFIG = [

    {
        id:
            "card_classic",

        itemKey:
            "card-classic",

        name:
            "کارت کلاسیک",

        description:
            "پوسته کلاسیک و شیک برای کارت‌های بازی.",

        type:
            "card-theme",

        price:
            250,

        icon:
            "🃏"
    },

    {
        id:
            "card_royal",

        itemKey:
            "card-royal",

        name:
            "کارت سلطنتی",

        description:
            "پوسته ویژه و لوکس برای کارت‌های بازی.",

        type:
            "card-theme",

        price:
            500,

        icon:
            "👑"
    },

    {
        id:
            "card_diamond",

        itemKey:
            "card-diamond",

        name:
            "کارت الماسی",

        description:
            "پوسته ویژه الماسی برای میز بازی.",

        type:
            "card-theme",

        price:
            750,

        icon:
            "💎"
    },

    {
        id:
            "table_luxury",

        itemKey:
            "table-luxury",

        name:
            "میز سلطنتی",

        description:
            "تم لوکس برای میز بازی.",

        type:
            "table-theme",

        price:
            1000,

        icon:
            "♟️"
    },

    {
        id:
            "avatar_gold",

        itemKey:
            "avatar-gold",

        name:
            "آواتار طلایی",

        description:
            "آواتار ویژه طلایی برای پروفایل.",

        type:
            "avatar",

        price:
            750,

        icon:
            "🏆"
    },

    {
        id:
            "card_back_fire",

        itemKey:
            "card-back-fire",

        name:
            "پشت کارت آتشین",

        description:
            "پشت کارت ویژه با ظاهر آتشین.",

        type:
            "card-back",

        price:
            900,

        icon:
            "🔥"
    },

    {
        id:
            "card_back_royal",

        itemKey:
            "card-back-royal",

        name:
            "پشت کارت سلطنتی",

        description:
            "پشت کارت ویژه برای بازیکنان حرفه‌ای.",

        type:
            "card-back",

        price:
            1200,

        icon:
            "👑"
    }

];

/* ================================================================
   5. ROOM CONFIG
================================================================ */

const HOKM_ROOM_CONFIG = {

    codeLength:
        6,

    maxPlayers:
        4,

    minPlayers:
        2,

    defaultName:
        "اتاق حکم",

    defaultPrivate:
        true,

    statuses: {

        waiting:
            "waiting",

        starting:
            "starting",

        playing:
            "playing",

        finished:
            "finished",

        closed:
            "closed"

    }

};

/* ================================================================
   6. GAME STATUS
================================================================ */

const HOKM_GAME_STATUS = {

    waiting:
        "waiting",

    active:
        "active",

    finished:
        "finished",

    cancelled:
        "cancelled"

};

/* ================================================================
   7. GAME PHASES
================================================================ */

const HOKM_GAME_PHASES = {

    idle:
        "idle",

    dealing:
        "dealing",

    trumpSelection:
        "trump-selection",

    playing:
        "playing",

    trickFinished:
        "trick-finished",

    roundFinished:
        "round-finished",

    gameFinished:
        "game-finished"

};

/* ================================================================
   8. SUITS
================================================================ */

const HOKM_SUITS = {

    hearts:
        {
            key: "hearts",
            symbol: "♥",
            name: "دل"
        },

    diamonds:
        {
            key: "diamonds",
            symbol: "♦",
            name: "خشت"
        },

    clubs:
        {
            key: "clubs",
            symbol: "♣",
            name: "گشنیز"
        },

    spades:
        {
            key: "spades",
            symbol: "♠",
            name: "پیک"
        }

};

/* ================================================================
   9. CARD RANKS
================================================================ */

const HOKM_CARD_RANKS = [

    {
        value: 2,
        label: "۲"
    },

    {
        value: 3,
        label: "۳"
    },

    {
        value: 4,
        label: "۴"
    },

    {
        value: 5,
        label: "۵"
    },

    {
        value: 6,
        label: "۶"
    },

    {
        value: 7,
        label: "۷"
    },

    {
        value: 8,
        label: "۸"
    },

    {
        value: 9,
        label: "۹"
    },

    {
        value: 10,
        label: "۱۰"
    },

    {
        value: 11,
        label: "J"
    },

    {
        value: 12,
        label: "Q"
    },

    {
        value: 13,
        label: "K"
    },

    {
        value: 14,
        label: "A"
    }

];

/* ================================================================
   10. REALTIME CONFIG
================================================================ */

const HOKM_REALTIME_CONFIG = {

    enabled:
        true,

    tables: [

        "rooms",

        "room_players",

        "games",

        "game_players",

        "game_tricks",

        "trick_cards",

        "chat_messages"

    ]

};

/* ================================================================
   11. AUTH CONFIG
================================================================ */

const HOKM_AUTH_CONFIG = {

    minimumPasswordLength:
        6,

    usernameMinimumLength:
        2,

    usernameMaximumLength:
        20,

    defaultUsername:
        "بازیکن",

    requireEmailConfirmation:
        true

};

/* ================================================================
   12. CHAT CONFIG
================================================================ */

const HOKM_CHAT_CONFIG = {

    maxMessageLength:
        100,

    enabled:
        true

};

/* ================================================================
   13. PROFILE CONFIG
================================================================ */

const HOKM_PROFILE_CONFIG = {

    defaultLevel:
        1,

    defaultExperience:
        0,

    defaultGamesPlayed:
        0,

    defaultGamesWon:
        0,

    defaultTotalTricks:
        0

};

/* ================================================================
   14. LOCAL STORAGE KEYS
================================================================ */

const HOKM_STORAGE_KEYS = {

    settings:
        "hokm_settings",

    guest:
        "hokm_guest",

    ui:
        "hokm_ui",

    lastRoom:
        "hokm_last_room",

    selectedCardTheme:
        "hokm_selected_card_theme",

    selectedCardBack:
        "hokm_selected_card_back",

    selectedTableTheme:
        "hokm_selected_table_theme"

};

/* ================================================================
   15. SUPABASE CLIENT CREATION
================================================================ */

function createHokmSupabaseClient() {

    if (
        window.supabaseClient &&
        typeof window.supabaseClient.from === "function"
    ) {

        return window.supabaseClient;
    }

    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {

        console.error(
            "کتابخانه Supabase پیدا نشد."
        );

        return null;
    }

    if (
        !HOKM_SUPABASE_CONFIG.url ||
        HOKM_SUPABASE_CONFIG.url === "YOUR_SUPABASE_URL" ||
        !HOKM_SUPABASE_CONFIG.anonKey ||
        HOKM_SUPABASE_CONFIG.anonKey === "YOUR_SUPABASE_ANON_KEY"
    ) {

        console.warn(
            "آدرس یا anon key مربوط به Supabase هنوز تنظیم نشده است."
        );

        return null;
    }

    try {

        const client =
            window.supabase.createClient(

                HOKM_SUPABASE_CONFIG.url,

                HOKM_SUPABASE_CONFIG.anonKey,

                {

                    auth: {

                        persistSession:
                            true,

                        autoRefreshToken:
                            true,

                        detectSessionInUrl:
                            true

                    }

                }

            );

        window.supabaseClient =
            client;

        return client;

    } catch (error) {

        console.error(
            "خطا در ساخت Supabase Client:",
            error
        );

        return null;
    }
}

/* ================================================================
   16. CONFIG HELPERS
================================================================ */

function getHokmConfig() {

    return HOKM_GAME_CONFIG;
}

function getHokmCoinPackages() {

    return HOKM_COIN_PACKAGES;
}

function getHokmShopItems() {

    return HOKM_SHOP_CONFIG;
}

function getHokmSupabaseConfig() {

    return HOKM_SUPABASE_CONFIG;
}

function getHokmRoomConfig() {

    return HOKM_ROOM_CONFIG;
}

/* ================================================================
   17. GLOBAL EXPORT
================================================================ */

window.HOKM_SUPABASE_CONFIG =
    HOKM_SUPABASE_CONFIG;

window.HOKM_GAME_CONFIG =
    HOKM_GAME_CONFIG;

window.HOKM_COIN_PACKAGES =
    HOKM_COIN_PACKAGES;

window.HOKM_SHOP_CONFIG =
    HOKM_SHOP_CONFIG;

window.HOKM_ROOM_CONFIG =
    HOKM_ROOM_CONFIG;

window.HOKM_GAME_STATUS =
    HOKM_GAME_STATUS;

window.HOKM_GAME_PHASES =
    HOKM_GAME_PHASES;

window.HOKM_SUITS =
    HOKM_SUITS;

window.HOKM_CARD_RANKS =
    HOKM_CARD_RANKS;

window.HOKM_REALTIME_CONFIG =
    HOKM_REALTIME_CONFIG;

window.HOKM_AUTH_CONFIG =
    HOKM_AUTH_CONFIG;

window.HOKM_CHAT_CONFIG =
    HOKM_CHAT_CONFIG;

window.HOKM_PROFILE_CONFIG =
    HOKM_PROFILE_CONFIG;

window.HOKM_STORAGE_KEYS =
    HOKM_STORAGE_KEYS;

window.createHokmSupabaseClient =
    createHokmSupabaseClient;

window.getHokmConfig =
    getHokmConfig;

window.getHokmCoinPackages =
    getHokmCoinPackages;

window.getHokmShopItems =
    getHokmShopItems;

window.getHokmSupabaseConfig =
    getHokmSupabaseConfig;

window.getHokmRoomConfig =
    getHokmRoomConfig;

/* ================================================================
   18. INITIALIZE CLIENT
================================================================ */

(function initializeHokmConfig() {

    if (
        window.supabase &&
        typeof window.supabase.createClient === "function"
    ) {

        createHokmSupabaseClient();

    }

})();
