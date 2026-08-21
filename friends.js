"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * friends.js
 *
 * FILE 09 / 12
 *
 * سیستم کامل دوستان و ارتباط بازیکنان
 *
 * امکانات:
 *
 * - دریافت لیست دوستان
 * - جستجوی بازیکنان
 * - ارسال درخواست دوستی
 * - قبول درخواست
 * - رد درخواست
 * - لغو درخواست ارسال‌شده
 * - حذف دوست
 * - بررسی وضعیت دوستی
 * - دریافت درخواست‌های دریافتی
 * - دریافت درخواست‌های ارسالی
 * - نمایش بازیکنان آنلاین
 * - دعوت دوست به اتاق بازی
 * - هماهنگی با room.js
 * - هماهنگی با multiplayer.js
 * - هماهنگی با notifications.js
 * - هماهنگی با profile.js
 * - هماهنگی با main.js
 * - رویدادهای داخلی Friends
 * - Cache داخلی
 * - جلوگیری از درخواست تکراری
 * - مدیریت خطا
 * - Toast
 * - Loading
 * - به‌روزرسانی UI
 *
 * سازگار با:
 *
 * config.js
 * auth.js
 * database.sql
 * Supabase
 *
 * ================================================================
 */

/* ================================================================
   1. SUPABASE CLIENT
================================================================ */

function getFriendsSupabaseClient() {

    if (
        window.supabaseClient &&
        typeof window.supabaseClient.from === "function"
    ) {

        return window.supabaseClient;
    }

    if (
        window.supabase &&
        typeof window.supabase.from === "function"
    ) {

        return window.supabase;
    }

    console.error(
        "Friends: Supabase Client پیدا نشد."
    );

    return null;
}

/* ================================================================
   2. STATE
================================================================ */

const friendsState = {

    initialized: false,

    loading: false,

    friends: [],

    incomingRequests: [],

    outgoingRequests: [],

    searchResults: [],

    onlineFriends: [],

    selectedFriend: null,

    searchQuery: "",

    lastLoadedAt: 0,

    cacheDuration: 15000

};

/* ================================================================
   3. EVENTS
================================================================ */

const friendsEvents = {

    listeners: {},

    on(
        eventName,
        callback
    ) {

        if (
            typeof callback !== "function"
        ) {

            return;
        }

        if (
            !this.listeners[eventName]
        ) {

            this.listeners[eventName] = [];
        }

        this.listeners[eventName].push(
            callback
        );
    },

    off(
        eventName,
        callback
    ) {

        if (
            !this.listeners[eventName]
        ) {

            return;
        }

        this.listeners[eventName] =
            this.listeners[eventName].filter(
                item => item !== callback
            );
    },

    emit(
        eventName,
        data
    ) {

        const listeners =
            this.listeners[eventName] || [];

        listeners.forEach(
            callback => {

                try {

                    callback(data);

                } catch (error) {

                    console.error(
                        `Friends Event Error: ${eventName}`,
                        error
                    );
                }

            }
        );
    }

};

/* ================================================================
   4. UTILITY
================================================================ */

function friendsToast(
    message,
    icon = "ℹ️",
    duration = 3000
) {

    if (
        typeof window.showToast === "function"
    ) {

        window.showToast(
            message,
            icon,
            duration
        );

        return;
    }

    console.log(
        `${icon} ${message}`
    );
}

function friendsLoading(
    show,
    message = "لطفاً صبر کنید..."
) {

    if (
        show &&
        typeof window.showLoading === "function"
    ) {

        window.showLoading(
            message
        );

        return;
    }

    if (
        !show &&
        typeof window.hideLoading === "function"
    ) {

        window.hideLoading();
    }
}

function friendsGetCurrentUser() {

    if (
        typeof window.getCurrentUser === "function"
    ) {

        return window.getCurrentUser();
    }

    if (
        window.hokmAuth &&
        typeof window.hokmAuth.getCurrentUser === "function"
    ) {

        return window.hokmAuth.getCurrentUser();
    }

    return null;
}

function friendsGetCurrentProfile() {

    if (
        typeof window.getCurrentProfile === "function"
    ) {

        return window.getCurrentProfile();
    }

    if (
        window.hokmAuth &&
        typeof window.hokmAuth.getCurrentProfile === "function"
    ) {

        return window.hokmAuth.getCurrentProfile();
    }

    return null;
}

function friendsIsLoggedIn() {

    if (
        typeof window.isLoggedIn === "function"
    ) {

        return window.isLoggedIn();
    }

    if (
        window.hokmAuth &&
        typeof window.hokmAuth.isLoggedIn === "function"
    ) {

        return window.hokmAuth.isLoggedIn();
    }

    return !!friendsGetCurrentUser();
}

function getFriendName(
    profile
) {

    if (!profile) {

        return "بازیکن";
    }

    return (
        profile.display_name ||
        profile.username ||
        profile.name ||
        "بازیکن"
    );
}

function getFriendAvatar(
    profile
) {

    if (!profile) {

        return "";
    }

    return (
        profile.avatar_url ||
        profile.avatar ||
        ""
    );
}

/* ================================================================
   5. TABLE NAMES
================================================================ */

const FRIENDS_TABLES = [

    "friendships",

    "friends"

];

/* ================================================================
   6. FIND AVAILABLE FRIEND TABLE
================================================================ */

async function findFriendsTable() {

    const client =
        getFriendsSupabaseClient();

    if (!client) {

        return null;
    }

    for (
        const tableName of FRIENDS_TABLES
    ) {

        try {

            const {
                error
            } = await client
                .from(tableName)
                .select("*")
                .limit(1);

            if (
                !error
            ) {

                return tableName;
            }

        } catch (error) {

            console.warn(
                `Friends table check failed: ${tableName}`,
                error
            );
        }
    }

    return null;
}

/* ================================================================
   7. CURRENT TABLE
================================================================ */

let friendsTableName =
    null;

async function getFriendsTable() {

    if (
        friendsTableName
    ) {

        return friendsTableName;
    }

    friendsTableName =
        await findFriendsTable();

    return friendsTableName;
}

/* ================================================================
   8. NORMALIZE FRIEND RECORD
================================================================ */

function normalizeFriendRecord(
    record
) {

    if (!record) {

        return null;
    }

    const profile =
        record.profile ||
        record.friend_profile ||
        record.user ||
        null;

    return {

        id:
            record.id || null,

        user_id:
            record.user_id ||
            record.sender_id ||
            null,

        friend_id:
            record.friend_id ||
            record.receiver_id ||
            null,

        sender_id:
            record.sender_id ||
            record.user_id ||
            null,

        receiver_id:
            record.receiver_id ||
            record.friend_id ||
            null,

        status:
            record.status ||
            "pending",

        created_at:
            record.created_at ||
            null,

        updated_at:
            record.updated_at ||
            null,

        profile:
            profile

    };
}

/* ================================================================
   9. GET FRIEND ID
================================================================ */

function resolveFriendId(
    record
) {

    const user =
        friendsGetCurrentUser();

    if (!record) {

        return null;
    }

    if (
        record.user_id === user?.id
    ) {

        return record.friend_id;
    }

    if (
        record.sender_id === user?.id
    ) {

        return record.receiver_id;
    }

    if (
        record.receiver_id === user?.id
    ) {

        return record.sender_id;
    }

    return (
        record.friend_id ||
        record.user_id ||
        null
    );
}

/* ================================================================
   10. LOAD FRIENDS
================================================================ */

async function loadFriends(
    force = false
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user
    ) {

        friendsState.friends = [];

        return [];
    }

    const now =
        Date.now();

    if (
        !force &&
        friendsState.lastLoadedAt &&
        now - friendsState.lastLoadedAt <
            friendsState.cacheDuration
    ) {

        return friendsState.friends;
    }

    const table =
        await getFriendsTable();

    if (!table) {

        console.warn(
            "Friends table پیدا نشد."
        );

        return friendsState.friends;
    }

    friendsState.loading =
        true;

    try {

        let result =
            await client
                .from(table)
                .select("*")
                .or(
                    `user_id.eq.${user.id},friend_id.eq.${user.id},sender_id.eq.${user.id},receiver_id.eq.${user.id}`
                )
                .eq(
                    "status",
                    "accepted"
                );

        if (
            result.error
        ) {

            result =
                await client
                    .from(table)
                    .select("*")
                    .or(
                        `sender_id.eq.${user.id},receiver_id.eq.${user.id}`
                    )
                    .eq(
                        "status",
                        "accepted"
                    );
        }

        if (
            result.error
        ) {

            console.error(
                "خطا در دریافت دوستان:",
                result.error
            );

            return friendsState.friends;
        }

        const records =
            result.data || [];

        const friendIds =
            records
                .map(
                    resolveFriendId
                )
                .filter(
                    Boolean
                )
                .filter(
                    id =>
                        id !== user.id
                );

        if (
            friendIds.length === 0
        ) {

            friendsState.friends = [];

            friendsState.lastLoadedAt =
                Date.now();

            updateFriendsUI();

            return [];
        }

        const {
            data: profiles,
            error: profileError
        } = await client
            .from("profiles")
            .select("*")
            .in(
                "id",
                friendIds
            );

        if (
            profileError
        ) {

            console.error(
                "خطا در دریافت پروفایل دوستان:",
                profileError
            );
        }

        const profileMap =
            new Map();

        (
            profiles || []
        ).forEach(
            profile => {

                profileMap.set(
                    profile.id,
                    profile
                );

            }
        );

        friendsState.friends =
            friendIds.map(
                id => {

                    const relation =
                        records.find(
                            record =>
                                resolveFriendId(
                                    record
                                ) === id
                        );

                    return {

                        ...normalizeFriendRecord(
                            relation
                        ),

                        id,

                        friend_id:
                            id,

                        profile:
                            profileMap.get(
                                id
                            ) || null

                    };

                }
            );

        friendsState.lastLoadedAt =
            Date.now();

        updateFriendsUI();

        friendsEvents.emit(
            "friendsLoaded",
            friendsState.friends
        );

        return friendsState.friends;

    } catch (error) {

        console.error(
            "خطای loadFriends:",
            error
        );

        return friendsState.friends;

    } finally {

        friendsState.loading =
            false;
    }
}

/* ================================================================
   11. GET FRIENDS
================================================================ */

function getFriends() {

    return [
        ...friendsState.friends
    ];
}

/* ================================================================
   12. SEARCH PLAYERS
================================================================ */

async function searchPlayers(
    query
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    query =
        String(
            query || ""
        )
            .trim();

    friendsState.searchQuery =
        query;

    if (
        !client ||
        !query
    ) {

        friendsState.searchResults = [];

        updateFriendsUI();

        return [];
    }

    if (
        query.length < 2
    ) {

        friendsToast(
            "حداقل ۲ حرف وارد کنید.",
            "⚠️"
        );

        friendsState.searchResults = [];

        updateFriendsUI();

        return [];
    }

    try {

        const escapedQuery =
            query
                .replace(
                    /[%_]/g,
                    ""
                );

        let request =
            client
                .from("profiles")
                .select(
                    "id,username,display_name,avatar_url,level,games_played,games_won"
                )
                .or(
                    `username.ilike.%${escapedQuery}%,display_name.ilike.%${escapedQuery}%`
                )
                .limit(30);

        const {
            data,
            error
        } =
            await request;

        if (error) {

            console.error(
                "خطا در جستجوی بازیکنان:",
                error
            );

            friendsState.searchResults = [];

            return [];
        }

        friendsState.searchResults =
            (
                data || []
            ).filter(
                profile =>
                    !user ||
                    profile.id !== user.id
            );

        updateFriendsUI();

        friendsEvents.emit(
            "searchCompleted",
            friendsState.searchResults
        );

        return friendsState.searchResults;

    } catch (error) {

        console.error(
            "خطای searchPlayers:",
            error
        );

        return [];
    }
}

/* ================================================================
   13. GET SEARCH RESULTS
================================================================ */

function getSearchResults() {

    return [
        ...friendsState.searchResults
    ];
}

/* ================================================================
   14. SEND FRIEND REQUEST
================================================================ */

async function sendFriendRequest(
    targetUserId
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user
    ) {

        friendsToast(
            "برای افزودن دوست باید وارد حساب شوید.",
            "⚠️"
        );

        return false;
    }

    if (
        !targetUserId
    ) {

        return false;
    }

    if (
        targetUserId === user.id
    ) {

        friendsToast(
            "نمی‌توانی خودت را به دوستان اضافه کنی.",
            "⚠️"
        );

        return false;
    }

    const relation =
        await getFriendship(
            targetUserId
        );

    if (
        relation?.status === "accepted"
    ) {

        friendsToast(
            "این بازیکن در لیست دوستانت است.",
            "👥"
        );

        return false;
    }

    if (
        relation?.status === "pending"
    ) {

        friendsToast(
            "درخواست دوستی قبلاً ارسال شده است.",
            "⏳"
        );

        return false;
    }

    const table =
        await getFriendsTable();

    if (!table) {

        friendsToast(
            "سیستم دوستان هنوز در دیتابیس آماده نیست.",
            "⚠️",
            4000
        );

        return false;
    }

    friendsLoading(
        true,
        "در حال ارسال درخواست دوستی..."
    );

    try {

        let {
            data,
            error
        } =
            await client
                .from(table)
                .insert({

                    sender_id:
                        user.id,

                    receiver_id:
                        targetUserId,

                    status:
                        "pending"

                })
                .select()
                .single();

        if (
            error
        ) {

            const fallback =
                await client
                    .from(table)
                    .insert({

                        user_id:
                            user.id,

                        friend_id:
                            targetUserId,

                        status:
                            "pending"

                    })
                    .select()
                    .single();

            data =
                fallback.data;

            error =
                fallback.error;
        }

        friendsLoading(
            false
        );

        if (error) {

            console.error(
                "خطا در ارسال درخواست دوستی:",
                error
            );

            if (
                String(
                    error.message || ""
                ).toLowerCase().includes(
                    "duplicate"
                )
            ) {

                friendsToast(
                    "درخواست دوستی قبلاً وجود دارد.",
                    "ℹ️"
                );

            } else {

                friendsToast(
                    "ارسال درخواست دوستی انجام نشد.",
                    "❌"
                );
            }

            return false;
        }

        friendsToast(
            "درخواست دوستی ارسال شد.",
            "👥",
            3500
        );

        friendsEvents.emit(
            "requestSent",
            data
        );

        if (
            typeof window.createNotification === "function"
        ) {

            try {

                await window.createNotification(
                    targetUserId,
                    {
                        type:
                            "friend_request",

                        title:
                            "درخواست دوستی جدید",

                        message:
                            "یک بازیکن برای شما درخواست دوستی ارسال کرده است."
                    }
                );

            } catch (notificationError) {

                console.warn(
                    "Notification failed:",
                    notificationError
                );
            }
        }

        await loadOutgoingRequests(
            true
        );

        return true;

    } catch (error) {

        friendsLoading(
            false
        );

        console.error(
            "خطای sendFriendRequest:",
            error
        );

        friendsToast(
            "خطایی هنگام ارسال درخواست رخ داد.",
            "❌"
        );

        return false;
    }
}

/* ================================================================
   15. GET FRIENDSHIP
================================================================ */

async function getFriendship(
    targetUserId
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user ||
        !targetUserId
    ) {

        return null;
    }

    const table =
        await getFriendsTable();

    if (!table) {

        return null;
    }

    try {

        let {
            data,
            error
        } =
            await client
                .from(table)
                .select("*")
                .or(
                    `and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`
                )
                .limit(1)
                .maybeSingle();

        if (
            error
        ) {

            const fallback =
                await client
                    .from(table)
                    .select("*")
                    .or(
                        `and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`
                    )
                    .limit(1)
                    .maybeSingle();

            data =
                fallback.data;

            error =
                fallback.error;
        }

        if (error) {

            return null;
        }

        return data || null;

    } catch (error) {

        console.error(
            "خطای getFriendship:",
            error
        );

        return null;
    }
}

/* ================================================================
   16. ACCEPT FRIEND REQUEST
================================================================ */

async function acceptFriendRequest(
    requestId
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user ||
        !requestId
    ) {

        return false;
    }

    const table =
        await getFriendsTable();

    if (!table) {

        return false;
    }

    friendsLoading(
        true,
        "در حال قبول درخواست..."
    );

    try {

        let {
            data,
            error
        } =
            await client
                .from(table)
                .update({

                    status:
                        "accepted"

                })
                .eq(
                    "id",
                    requestId
                )
                .eq(
                    "receiver_id",
                    user.id
                )
                .select()
                .single();

        if (
            error
        ) {

            const fallback =
                await client
                    .from(table)
                    .update({

                        status:
                            "accepted"

                    })
                    .eq(
                        "id",
                        requestId
                    )
                    .select()
                    .single();

            data =
                fallback.data;

            error =
                fallback.error;
        }

        friendsLoading(
            false
        );

        if (error) {

            console.error(
                "خطا در قبول درخواست:",
                error
            );

            friendsToast(
                "قبول درخواست انجام نشد.",
                "❌"
            );

            return false;
        }

        friendsToast(
            "درخواست دوستی قبول شد.",
            "🎉"
        );

        friendsEvents.emit(
            "requestAccepted",
            data
        );

        await Promise.all([
            loadFriends(true),
            loadIncomingRequests(true)
        ]);

        return true;

    } catch (error) {

        friendsLoading(
            false
        );

        console.error(
            "خطای acceptFriendRequest:",
            error
        );

        return false;
    }
}

/* ================================================================
   17. REJECT FRIEND REQUEST
================================================================ */

async function rejectFriendRequest(
    requestId
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user ||
        !requestId
    ) {

        return false;
    }

    const table =
        await getFriendsTable();

    if (!table) {

        return false;
    }

    try {

        let {
            error
        } =
            await client
                .from(table)
                .delete()
                .eq(
                    "id",
                    requestId
                )
                .eq(
                    "receiver_id",
                    user.id
                );

        if (
            error
        ) {

            const fallback =
                await client
                    .from(table)
                    .delete()
                    .eq(
                        "id",
                        requestId
                    );

            error =
                fallback.error;
        }

        if (error) {

            console.error(
                "خطا در رد درخواست:",
                error
            );

            friendsToast(
                "رد درخواست انجام نشد.",
                "❌"
            );

            return false;
        }

        friendsToast(
            "درخواست رد شد.",
            "ℹ️"
        );

        friendsEvents.emit(
            "requestRejected",
            requestId
        );

        await loadIncomingRequests(
            true
        );

        return true;

    } catch (error) {

        console.error(
            "خطای rejectFriendRequest:",
            error
        );

        return false;
    }
}

/* ================================================================
   18. CANCEL OUTGOING REQUEST
================================================================ */

async function cancelFriendRequest(
    requestId
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user ||
        !requestId
    ) {

        return false;
    }

    const table =
        await getFriendsTable();

    if (!table) {

        return false;
    }

    try {

        let {
            error
        } =
            await client
                .from(table)
                .delete()
                .eq(
                    "id",
                    requestId
                )
                .eq(
                    "sender_id",
                    user.id
                );

        if (
            error
        ) {

            const fallback =
                await client
                    .from(table)
                    .delete()
                    .eq(
                        "id",
                        requestId
                    );

            error =
                fallback.error;
        }

        if (error) {

            console.error(
                "خطا در لغو درخواست:",
                error
            );

            friendsToast(
                "لغو درخواست انجام نشد.",
                "❌"
            );

            return false;
        }

        friendsToast(
            "درخواست دوستی لغو شد.",
            "↩️"
        );

        friendsEvents.emit(
            "requestCancelled",
            requestId
        );

        await loadOutgoingRequests(
            true
        );

        return true;

    } catch (error) {

        console.error(
            "خطای cancelFriendRequest:",
            error
        );

        return false;
    }
}

/* ================================================================
   19. REMOVE FRIEND
================================================================ */

async function removeFriend(
    friendId
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user ||
        !friendId
    ) {

        return false;
    }

    const table =
        await getFriendsTable();

    if (!table) {

        return false;
    }

    const confirmed =
        window.confirm
            ? window.confirm(
                "آیا مطمئنی می‌خواهی این بازیکن را از دوستانت حذف کنی؟"
            )
            : true;

    if (!confirmed) {

        return false;
    }

    friendsLoading(
        true,
        "در حال حذف دوست..."
    );

    try {

        let {
            error
        } =
            await client
                .from(table)
                .delete()
                .or(
                    `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
                );

        if (
            error
        ) {

            const fallback =
                await client
                    .from(table)
                    .delete()
                    .or(
                        `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
                    );

            error =
                fallback.error;
        }

        friendsLoading(
            false
        );

        if (error) {

            console.error(
                "خطا در حذف دوست:",
                error
            );

            friendsToast(
                "حذف دوست انجام نشد.",
                "❌"
            );

            return false;
        }

        friendsToast(
            "بازیکن از دوستانت حذف شد.",
            "👤"
        );

        friendsEvents.emit(
            "friendRemoved",
            friendId
        );

        await loadFriends(
            true
        );

        return true;

    } catch (error) {

        friendsLoading(
            false
        );

        console.error(
            "خطای removeFriend:",
            error
        );

        return false;
    }
}

/* ================================================================
   20. LOAD INCOMING REQUESTS
================================================================ */

async function loadIncomingRequests(
    force = false
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user
    ) {

        friendsState.incomingRequests = [];

        return [];
    }

    const table =
        await getFriendsTable();

    if (!table) {

        return [];
    }

    try {

        let {
            data,
            error
        } =
            await client
                .from(table)
                .select("*")
                .eq(
                    "receiver_id",
                    user.id
                )
                .eq(
                    "status",
                    "pending"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (
            error
        ) {

            const fallback =
                await client
                    .from(table)
                    .select("*")
                    .eq(
                        "friend_id",
                        user.id
                    )
                    .eq(
                        "status",
                        "pending"
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            data =
                fallback.data;

            error =
                fallback.error;
        }

        if (error) {

            console.error(
                "خطا در دریافت درخواست‌های دریافتی:",
                error
            );

            return [];
        }

        const records =
            data || [];

        const senderIds =
            records
                .map(
                    record =>
                        record.sender_id ||
                        record.user_id
                )
                .filter(
                    Boolean
                );

        let profiles = [];

        if (
            senderIds.length
        ) {

            const profileResult =
                await client
                    .from("profiles")
                    .select("*")
                    .in(
                        "id",
                        senderIds
                    );

            profiles =
                profileResult.data || [];
        }

        const profileMap =
            new Map();

        profiles.forEach(
            profile => {

                profileMap.set(
                    profile.id,
                    profile
                );

            }
        );

        friendsState.incomingRequests =
            records.map(
                record => {

                    const senderId =
                        record.sender_id ||
                        record.user_id;

                    return {

                        ...normalizeFriendRecord(
                            record
                        ),

                        profile:
                            profileMap.get(
                                senderId
                            ) || null

                    };

                }
            );

        updateFriendsUI();

        friendsEvents.emit(
            "incomingRequestsLoaded",
            friendsState.incomingRequests
        );

        return friendsState.incomingRequests;

    } catch (error) {

        console.error(
            "خطای loadIncomingRequests:",
            error
        );

        return [];
    }
}

/* ================================================================
   21. LOAD OUTGOING REQUESTS
================================================================ */

async function loadOutgoingRequests(
    force = false
) {

    const client =
        getFriendsSupabaseClient();

    const user =
        friendsGetCurrentUser();

    if (
        !client ||
        !user
    ) {

        friendsState.outgoingRequests = [];

        return [];
    }

    const table =
        await getFriendsTable();

    if (!table) {

        return [];
    }

    try {

        let {
            data,
            error
        } =
            await client
                .from(table)
                .select("*")
                .eq(
                    "sender_id",
                    user.id
                )
                .eq(
                    "status",
                    "pending"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (
            error
        ) {

            const fallback =
                await client
                    .from(table)
                    .select("*")
                    .eq(
                        "user_id",
                        user.id
                    )
                    .eq(
                        "status",
                        "pending"
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            data =
                fallback.data;

            error =
                fallback.error;
        }

        if (error) {

            console.error(
                "خطا در دریافت درخواست‌های ارسالی:",
                error
            );

            return [];
        }

        const records =
            data || [];

        const receiverIds =
            records
                .map(
                    record =>
                        record.receiver_id ||
                        record.friend_id
                )
                .filter(
                    Boolean
                );

        let profiles = [];

        if (
            receiverIds.length
        ) {

            const profileResult =
                await client
                    .from("profiles")
                    .select("*")
                    .in(
                        "id",
                        receiverIds
                    );

            profiles =
                profileResult.data || [];
        }

        const profileMap =
            new Map();

        profiles.forEach(
            profile => {

                profileMap.set(
                    profile.id,
                    profile
                );

            }
        );

        friendsState.outgoingRequests =
            records.map(
                record => {

                    const receiverId =
                        record.receiver_id ||
                        record.friend_id;

                    return {

                        ...normalizeFriendRecord(
                            record
                        ),

                        profile:
                            profileMap.get(
                                receiverId
                            ) || null

                    };

                }
            );

        updateFriendsUI();

        friendsEvents.emit(
            "outgoingRequestsLoaded",
            friendsState.outgoingRequests
        );

        return friendsState.outgoingRequests;

    } catch (error) {

        console.error(
            "خطای loadOutgoingRequests:",
            error
        );

        return [];
    }
}

/* ================================================================
   22. ONLINE STATUS
================================================================ */

async function loadOnlineFriends() {

    const friends =
        await loadFriends();

    friendsState.onlineFriends =
        friends.filter(
            friend =>
                friend.online === true ||
                friend.profile?.online === true ||
                friend.profile?.is_online === true
        );

    updateFriendsUI();

    friendsEvents.emit(
        "onlineFriendsUpdated",
        friendsState.onlineFriends
    );

    return friendsState.onlineFriends;
}

/* ================================================================
   23. IS FRIEND
================================================================ */

async function isFriend(
    userId
) {

    const friendship =
        await getFriendship(
            userId
        );

    return (
        friendship?.status ===
        "accepted"
    );
}

/* ================================================================
   24. INVITE FRIEND TO ROOM
================================================================ */

async function inviteFriendToRoom(
    friendId,
    roomId = null
) {

    const user =
        friendsGetCurrentUser();

    if (
        !user ||
        !friendId
    ) {

        friendsToast(
            "برای دعوت به بازی باید وارد حساب شوید.",
            "⚠️"
        );

        return false;
    }

    let currentRoomId =
        roomId;

    if (
        !currentRoomId &&
        window.hokmRoom &&
        typeof window.hokmRoom.getCurrentRoom === "function"
    ) {

        try {

            const room =
                window.hokmRoom.getCurrentRoom();

            currentRoomId =
                room?.id ||
                room?.room_id ||
                null;

        } catch (error) {

            console.warn(
                "Could not read current room:",
                error
            );
        }
    }

    if (
        !currentRoomId &&
        window.state
    ) {

        currentRoomId =
            window.state.roomId ||
            window.state.currentRoomId ||
            null;
    }

    if (!currentRoomId) {

        friendsToast(
            "ابتدا وارد یک اتاق بازی شوید.",
            "🎮"
        );

        return false;
    }

    if (
        window.hokmRoom &&
        typeof window.hokmRoom.invitePlayer === "function"
    ) {

        try {

            const result =
                await window.hokmRoom.invitePlayer(
                    friendId,
                    currentRoomId
                );

            if (result !== false) {

                friendsToast(
                    "دعوت بازی ارسال شد.",
                    "🎮"
                );

                friendsEvents.emit(
                    "gameInviteSent",
                    {

                        friendId,

                        roomId:
                            currentRoomId

                    }
                );

                return true;
            }

        } catch (error) {

            console.warn(
                "Room invite API failed:",
                error
            );
        }
    }

    if (
        typeof window.createNotification === "function"
    ) {

        try {

            await window.createNotification(
                friendId,
                {

                    type:
                        "game_invite",

                    title:
                        "دعوت به بازی حکم",

                    message:
                        "یک دوست شما را به بازی حکم دعوت کرده است.",

                    data: {

                        room_id:
                            currentRoomId

                    }

                }
            );

            friendsToast(
                "دعوت بازی ارسال شد.",
                "🎮"
            );

            friendsEvents.emit(
                "gameInviteSent",
                {

                    friendId,

                    roomId:
                        currentRoomId

                }
            );

            return true;

        } catch (error) {

            console.error(
                "Notification invite failed:",
                error
            );
        }
    }

    friendsToast(
        "ارسال دعوت بازی امکان‌پذیر نیست.",
        "❌"
    );

    return false;
}

/* ================================================================
   25. SELECT FRIEND
================================================================ */

function selectFriend(
    friend
) {

    friendsState.selectedFriend =
        friend || null;

    updateFriendsUI();

    friendsEvents.emit(
        "friendSelected",
        friend || null
    );

    return friend || null;
}

/* ================================================================
   26. CLEAR SEARCH
================================================================ */

function clearFriendSearch() {

    friendsState.searchQuery =
        "";

    friendsState.searchResults =
        [];

    updateFriendsUI();

    friendsEvents.emit(
        "searchCleared"
    );
}

/* ================================================================
   27. REFRESH FRIENDS
================================================================ */

async function refreshFriends() {

    friendsState.lastLoadedAt =
        0;

    await Promise.all([
        loadFriends(true),
        loadIncomingRequests(true),
        loadOutgoingRequests(true),
        loadOnlineFriends()
    ]);

    updateFriendsUI();

    friendsEvents.emit(
        "refreshed"
    );

    return friendsState.friends;
}

/* ================================================================
   28. FRIEND COUNT
================================================================ */

function getFriendCount() {

    return friendsState.friends.length;
}

/* ================================================================
   29. INCOMING REQUEST COUNT
================================================================ */

function getIncomingRequestCount() {

    return friendsState.incomingRequests.length;
}

/* ================================================================
   30. OUTGOING REQUEST COUNT
================================================================ */

function getOutgoingRequestCount() {

    return friendsState.outgoingRequests.length;
}

/* ================================================================
   31. UI HELPERS
================================================================ */

function updateFriendsUI() {

    document
        .querySelectorAll(
            "[data-friends-count]"
        )
        .forEach(
            element => {

                element.textContent =
                    friendsState.friends.length
                        .toLocaleString(
                            "fa-IR"
                        );

            }
        );

    document
        .querySelectorAll(
            "[data-friend-requests-count]"
        )
        .forEach(
            element => {

                const count =
                    friendsState.incomingRequests.length;

                element.textContent =
                    count.toLocaleString(
                        "fa-IR"
                    );

                element.style.display =
                    count > 0
                        ? ""
                        : "none";

            }
        );

    document
        .querySelectorAll(
            "[data-friend-search-count]"
        )
        .forEach(
            element => {

                element.textContent =
                    friendsState.searchResults.length
                        .toLocaleString(
                            "fa-IR"
                        );

            }
        );

    renderFriendLists();
}

/* ================================================================
   32. RENDER FRIEND LISTS
================================================================ */

function renderFriendLists() {

    const friendContainers =
        document.querySelectorAll(
            "[data-friends-list]"
        );

    friendContainers.forEach(
        container => {

            container.innerHTML =
                "";

            if (
                friendsState.friends.length === 0
            ) {

                container.innerHTML = `
                    <div class="friends-empty" style="text-align:center; padding:20px; color:#aaa; font-size:13px;">
                        <div style="font-size:32px; margin-bottom:8px;">👥</div>
                        <div>هنوز دوستی اضافه نکرده‌ای</div>
                    </div>
                `;

                return;
            }

            friendsState.friends.forEach(
                friend => {

                    container.appendChild(
                        createFriendElement(
                            friend
                        )
                    );

                }
            );

        }
    );

    document
        .querySelectorAll(
            "[data-friend-search-results]"
        )
        .forEach(
            container => {

                container.innerHTML =
                    "";

                if (
                    friendsState.searchResults.length === 0
                ) {

                    if (
                        friendsState.searchQuery
                    ) {

                        container.innerHTML = `
                            <div class="friends-empty" style="text-align:center; padding:15px; color:#aaa; font-size:12px;">
                                بازیکنی پیدا نشد.
                            </div>
                        `;
                    }

                    return;
                }

                friendsState.searchResults.forEach(
                    profile => {

                        container.appendChild(
                            createSearchResultElement(
                                profile
                            )
                        );

                    }
                );

            }
        );

    document
        .querySelectorAll(
            "[data-incoming-friend-requests]"
        )
        .forEach(
            container => {

                container.innerHTML =
                    "";

                if (
                    friendsState.incomingRequests.length === 0
                ) {

                    container.innerHTML = `
                        <div class="friends-empty" style="text-align:center; padding:15px; color:#aaa; font-size:12px;">
                            درخواست دوستی جدیدی نداری.
                        </div>
                    `;

                    return;
                }

                friendsState.incomingRequests.forEach(
                    request => {

                        container.appendChild(
                            createIncomingRequestElement(
                                request
                            )
                        );

                    }
                );

            }
        );

    document
        .querySelectorAll(
            "[data-outgoing-friend-requests]"
        )
        .forEach(
            container => {

                container.innerHTML =
                    "";

                if (
                    friendsState.outgoingRequests.length === 0
                ) {

                    container.innerHTML = `
                        <div class="friends-empty" style="text-align:center; padding:15px; color:#aaa; font-size:12px;">
                            درخواست ارسالی نداری.
                        </div>
                    `;

                    return;
                }

                friendsState.outgoingRequests.forEach(
                    request => {

                        container.appendChild(
                            createOutgoingRequestElement(
                                request
                            )
                        );

                    }
                );

            }
        );
}

/* ================================================================
   33. CREATE FRIEND ELEMENT
================================================================ */

function createFriendElement(
    friend
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "friend-item";

    wrapper.style.cssText =
        "display:flex; justify-content:space-between; align-items:center; background:#0f3460; padding:10px; border-radius:8px; margin-bottom:8px;";

    const profile =
        friend.profile ||
        {};

    const name =
        getFriendName(
            profile
        );

    const avatar =
        getFriendAvatar(
            profile
        );

    const online =
        friend.online === true ||
        profile.online === true ||
        profile.is_online === true;

    wrapper.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="position:relative; width:34px; height:34px; border-radius:50%; background:#1a1a2e; display:flex; justify-content:center; align-items:center;">
                ${
                    avatar
                        ? `<img src="${escapeFriendsHtml(avatar)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="">`
                        : `👤`
                }
                <span style="position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; background:${online ? '#4ecca3' : '#666'}; border:2px solid #0f3460;"></span>
            </div>
            <div>
                <div style="font-size:13px; font-weight:bold;">${escapeFriendsHtml(name)}</div>
                <div style="font-size:11px; color:${online ? '#4ecca3' : '#888'};">${online ? 'آنلاین' : 'آفلاین'}</div>
            </div>
        </div>

        <div style="display:flex; gap:6px;">
            <button
                type="button"
                style="padding:6px 10px; background:#e94560; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;"
                data-friend-play="${escapeFriendsHtml(friend.friend_id || friend.id)}"
            >
                🎮 بازی
            </button>
            <button
                type="button"
                style="padding:6px 10px; background:#1a1a2e; color:#aaa; border:none; border-radius:6px; cursor:pointer; font-size:11px;"
                data-friend-remove="${escapeFriendsHtml(friend.friend_id || friend.id)}"
            >
                حذف
            </button>
        </div>
    `;

    wrapper.addEventListener(
        "click",
        event => {

            const playButton =
                event.target.closest(
                    "[data-friend-play]"
                );

            const removeButton =
                event.target.closest(
                    "[data-friend-remove]"
                );

            if (playButton) {

                inviteFriendToRoom(
                    playButton.dataset.friendPlay
                );

                return;
            }

            if (removeButton) {

                removeFriend(
                    removeButton.dataset.friendRemove
                );

                return;
            }

            selectFriend(
                friend
            );

        }
    );

    return wrapper;
}

/* ================================================================
   34. CREATE SEARCH RESULT
================================================================ */

function createSearchResultElement(
    profile
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "friend-search-result";

    wrapper.style.cssText =
        "display:flex; justify-content:space-between; align-items:center; background:#0f3460; padding:10px; border-radius:8px; margin-bottom:8px;";

    const name =
        getFriendName(
            profile
        );

    const avatar =
        getFriendAvatar(
            profile
        );

    wrapper.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:50%; background:#1a1a2e; display:flex; justify-content:center; align-items:center;">
                ${
                    avatar
                        ? `<img src="${escapeFriendsHtml(avatar)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="">`
                        : `👤`
                }
            </div>
            <div>
                <div style="font-size:13px; font-weight:bold;">${escapeFriendsHtml(name)}</div>
                <div style="font-size:11px; color:#aaa;">سطح ${Number(profile.level || 1).toLocaleString("fa-IR")}</div>
            </div>
        </div>

        <button
            type="button"
            style="padding:6px 12px; background:#4ecca3; color:#1a1a2e; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"
            data-add-friend="${escapeFriendsHtml(profile.id)}"
        >
            ➕ افزودن
        </button>
    `;

    const addButton =
        wrapper.querySelector(
            "[data-add-friend]"
        );

    if (addButton) {

        addButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                sendFriendRequest(
                    profile.id
                );

            }
        );
    }

    return wrapper;
}

/* ================================================================
   35. CREATE INCOMING REQUEST
================================================================ */

function createIncomingRequestElement(
    request
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "friend-request-item";

    wrapper.style.cssText =
        "display:flex; justify-content:space-between; align-items:center; background:#0f3460; padding:10px; border-radius:8px; margin-bottom:8px;";

    const profile =
        request.profile ||
        {};

    const name =
        getFriendName(
            profile
        );

    wrapper.innerHTML = `
        <div>
            <div style="font-size:13px; font-weight:bold;">${escapeFriendsHtml(name)}</div>
            <div style="font-size:11px; color:#aaa;">درخواست دوستی</div>
        </div>

        <div style="display:flex; gap:6px;">
            <button
                type="button"
                style="padding:6px 10px; background:#4ecca3; color:#1a1a2e; border:none; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;"
                data-accept-request="${escapeFriendsHtml(request.id)}"
            >
                ✓ قبول
            </button>

            <button
                type="button"
                style="padding:6px 10px; background:#e94560; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:11px;"
                data-reject-request="${escapeFriendsHtml(request.id)}"
            >
                ✕ رد
            </button>
        </div>
    `;

    const acceptButton =
        wrapper.querySelector(
            "[data-accept-request]"
        );

    const rejectButton =
        wrapper.querySelector(
            "[data-reject-request]"
        );

    if (acceptButton) {

        acceptButton.addEventListener(
            "click",
            () => {

                acceptFriendRequest(
                    request.id
                );

            }
        );
    }

    if (rejectButton) {

        rejectButton.addEventListener(
            "click",
            () => {

                rejectFriendRequest(
                    request.id
                );

            }
        );
    }

    return wrapper;
}

/* ================================================================
   36. CREATE OUTGOING REQUEST
================================================================ */

function createOutgoingRequestElement(
    request
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "friend-request-item";

    wrapper.style.cssText =
        "display:flex; justify-content:space-between; align-items:center; background:#0f3460; padding:10px; border-radius:8px; margin-bottom:8px;";

    const profile =
        request.profile ||
        {};

    const name =
        getFriendName(
            profile
        );

    wrapper.innerHTML = `
        <div>
            <div style="font-size:13px; font-weight:bold;">${escapeFriendsHtml(name)}</div>
            <div style="font-size:11px; color:#aaa;">⏳ منتظر پاسخ</div>
        </div>

        <button
            type="button"
            style="padding:6px 10px; background:#1a1a2e; color:#aaa; border:none; border-radius:6px; cursor:pointer; font-size:11px;"
            data-cancel-request="${escapeFriendsHtml(request.id)}"
        >
            لغو درخواست
        </button>
    `;

    const cancelButton =
        wrapper.querySelector(
            "[data-cancel-request]"
        );

    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            () => {

                cancelFriendRequest(
                    request.id
                );

            }
        );
    }

    return wrapper;
}

/* ================================================================
   37. ESCAPE HTML
================================================================ */

function escapeFriendsHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

/* ================================================================
   38. FRIEND EVENTS API
================================================================ */

function onFriendsChange(
    callback
) {

    friendsEvents.on(
        "friendsLoaded",
        callback
    );
}

function onFriendRequest(
    callback
) {

    friendsEvents.on(
        "requestSent",
        callback
    );
}

function onFriendRequestAccepted(
    callback
) {

    friendsEvents.on(
        "requestAccepted",
        callback
    );
}

function onFriendRemoved(
    callback
) {

    friendsEvents.on(
        "friendRemoved",
        callback
    );
}

function onFriendSelected(
    callback
) {

    friendsEvents.on(
        "friendSelected",
        callback
    );
}

/* ================================================================
   39. INITIALIZE
================================================================ */

async function initializeFriends() {

    if (
        friendsState.initialized
    ) {

        return friendsState;
    }

    const user =
        friendsGetCurrentUser();

    if (!user) {

        if (
            window.hokmAuth &&
            typeof window.hokmAuth.waitForAuth === "function"
        ) {

            try {

                await window.hokmAuth.waitForAuth();

            } catch (error) {

                console.warn(
                    "Friends انتظار Auth را دریافت نکرد.",
                    error
                );
            }
        }
    }

    if (
        !friendsGetCurrentUser()
    ) {

        friendsState.initialized =
            true;

        updateFriendsUI();

        return friendsState;
    }

    try {

        friendsState.loading =
            true;

        await Promise.all([
            loadFriends(true),
            loadIncomingRequests(true),
            loadOutgoingRequests(true)
        ]);

        await loadOnlineFriends();

        friendsState.initialized =
            true;

        friendsEvents.emit(
            "initialized",
            friendsState
        );

        console.log(
            "Hokm Online Friends initialized successfully."
        );

    } catch (error) {

        console.error(
            "خطا در initializeFriends:",
            error
        );

    } finally {

        friendsState.loading =
            false;
    }

    return friendsState;
}

/* ================================================================
   40. AUTH INTEGRATION
================================================================ */

function setupFriendsAuthListener() {

    if (
        window.hokmAuth &&
        typeof window.hokmAuth.onAuthChange === "function"
    ) {

        window.hokmAuth.onAuthChange(
            async () => {

                friendsState.lastLoadedAt =
                    0;

                if (
                    friendsGetCurrentUser()
                ) {

                    await initializeFriends();

                } else {

                    friendsState.friends =
                        [];

                    friendsState.incomingRequests =
                        [];

                    friendsState.outgoingRequests =
                        [];

                    friendsState.searchResults =
                        [];

                    friendsState.onlineFriends =
                        [];

                    updateFriendsUI();

                }

            }
        );

        return;
    }

    if (
        window.hokmAuth &&
        typeof window.hokmAuth.onSignIn === "function"
    ) {

        window.hokmAuth.onSignIn(
            () => {

                friendsState.initialized =
                    false;

                initializeFriends();

            }
        );
    }

    if (
        window.hokmAuth &&
        typeof window.hokmAuth.onSignOut === "function"
    ) {

        window.hokmAuth.onSignOut(
            () => {

                friendsState.initialized =
                    false;

                friendsState.friends =
                    [];

                friendsState.incomingRequests =
                    [];

                friendsState.outgoingRequests =
                    [];

                friendsState.searchResults =
                    [];

                friendsState.onlineFriends =
                    [];

                updateFriendsUI();

            }
        );
    }
}

/* ================================================================
   41. PUBLIC API
================================================================ */

window.hokmFriends = {

    initialize:
        initializeFriends,

    loadFriends,

    getFriends,

    searchPlayers,

    getSearchResults,

    sendFriendRequest,

    getFriendship,

    acceptFriendRequest,

    rejectFriendRequest,

    cancelFriendRequest,

    removeFriend,

    loadIncomingRequests,

    loadOutgoingRequests,

    loadOnlineFriends,

    isFriend,

    inviteFriendToRoom,

    selectFriend,

    clearFriendSearch,

    refresh:

        refreshFriends,

    getFriendCount,

    getIncomingRequestCount,

    getOutgoingRequestCount,

    getState:

        () => friendsState,

    onFriendsChange,

    onFriendRequest,

    onFriendRequestAccepted,

    onFriendRemoved,

    onFriendSelected

};

/* ================================================================
   42. GLOBAL SHORTCUTS
================================================================ */

window.loadFriends =
    loadFriends;

window.searchPlayers =
    searchPlayers;

window.sendFriendRequest =
    sendFriendRequest;

window.acceptFriendRequest =
    acceptFriendRequest;

window.rejectFriendRequest =
    rejectFriendRequest;

window.cancelFriendRequest =
    cancelFriendRequest;

window.removeFriend =
    removeFriend;

window.inviteFriendToRoom =
    inviteFriendToRoom;

/* ================================================================
   43. DOM READY
================================================================ */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            setupFriendsAuthListener();

            initializeFriends();

        }
    );

} else {

    setupFriendsAuthListener();

    initializeFriends();
}

/* ================================================================
   END OF FRIENDS.JS
   FILE 09 / 12
================================================================ */
