"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * room.js
 *
 * FILE 2 / 12
 *
 * سیستم کامل مدیریت اتاق و لابی بازی
 * ================================================================
 */

/* ================================================================
   1. CONSTANTS
================================================================ */

const ROOM_CONFIG = {
    MAX_PLAYERS: 4,
    MIN_PLAYERS_TO_START: 4,
    ENTRY_FEE: 400,
    CODE_LENGTH: 6,
    CODE_MIN: 100000,
    CODE_MAX: 999999,
    WAITING_STATUS: "waiting",
    STARTING_STATUS: "starting",
    PLAYING_STATUS: "playing",
    FINISHED_STATUS: "finished",
    CLOSED_STATUS: "closed",
    TEAM_A: "A",
    TEAM_B: "B",
    SEATS: [0, 1, 2, 3]
};

/* ================================================================
   2. ROOM STATE
================================================================ */

const roomState = {
    initialized: false,
    loading: false,
    currentRoom: null,
    currentRoomId: null,
    currentRoomCode: null,
    currentGameId: null,
    currentPlayer: null,
    players: [],
    isHost: false,
    isReady: false,
    currentSeat: null,
    currentTeam: null,
    status: "none",
    realtimeChannel: null,
    roomChannel: null,
    reconnectTimer: null,
    starting: false,
    leaving: false,
    joining: false,
    creating: false,
    lastError: null
};

/* ================================================================
   3. ROOM EVENTS
================================================================ */

const roomEvents = {
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
                console.error(`Room event error: ${eventName}`, error);
            }
        });
    }
};

/* ================================================================
   4. SUPABASE & AUTH HELPERS
================================================================ */

function getRoomSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
        return window.supabase;
    }
    console.error("Supabase client برای room.js پیدا نشد.");
    return null;
}

function roomGetUser() {
    if (typeof window.getCurrentUser === "function") return window.getCurrentUser();
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentUser === "function") {
        return window.hokmAuth.getCurrentUser();
    }
    return null;
}

function roomGetProfile() {
    if (typeof window.getCurrentProfile === "function") return window.getCurrentProfile();
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentProfile === "function") {
        return window.hokmAuth.getCurrentProfile();
    }
    return null;
}

function roomToast(message, icon = "ℹ️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function roomShowLoading(message = "لطفاً صبر کنید...") {
    if (typeof window.showLoading === "function") window.showLoading(message);
}

function roomHideLoading() {
    if (typeof window.hideLoading === "function") window.hideLoading();
}

function roomEscapeText(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function getCurrentRoom() { return roomState.currentRoom; }
function getCurrentRoomId() { return roomState.currentRoomId; }
function getCurrentRoomCode() { return roomState.currentRoomCode; }
function getCurrentRoomPlayers() { return [...roomState.players]; }
function isRoomHost() { return roomState.isHost === true; }
function isRoomReady() { return roomState.isReady === true; }

function generateRoomCode() {
    return String(Math.floor(Math.random() * (ROOM_CONFIG.CODE_MAX - ROOM_CONFIG.CODE_MIN + 1)) + ROOM_CONFIG.CODE_MIN);
}

function normalizeRoomCode(code) {
    return String(code || "").replace(/\D/g, "").slice(0, ROOM_CONFIG.CODE_LENGTH);
}

function isValidRoomCode(code) {
    return /^[0-9]{6}$/.test(String(code || ""));
}

function getRoomPlayerCoins() {
    const profile = roomGetProfile();
    if (profile && profile.coins !== undefined) return Number(profile.coins);
    if (window.state?.player?.coins !== undefined) return Number(window.state.player.coins);
    return 0;
}

function roomRequireLogin() {
    const user = roomGetUser();
    if (!user) {
        roomToast("برای ورود به اتاق ابتدا وارد حساب کاربری شوید.", "🔐", 4000);
        roomEvents.emit("loginRequired");
        return false;
    }
    return true;
}

async function refreshRoomProfile() {
    if (window.hokmAuth && typeof window.hokmAuth.loadProfile === "function") {
        const profile = await window.hokmAuth.loadProfile();
        if (profile) return profile;
    }
    return roomGetProfile();
}

function getTeamForSeat(seat) {
    return Number(seat) % 2 === 0 ? ROOM_CONFIG.TEAM_A : ROOM_CONFIG.TEAM_B;
}

/* ================================================================
   5. CREATE ROOM
================================================================ */

async function createRoom(options = {}) {
    const client = getRoomSupabaseClient();
    if (!client) {
        roomToast("اتصال بازی به سرور آماده نیست.", "⚠️");
        return { success: false, error: "SUPABASE_CLIENT_NOT_FOUND" };
    }
    if (!roomRequireLogin()) return { success: false, error: "LOGIN_REQUIRED" };
    if (roomState.creating) return { success: false, error: "ALREADY_CREATING" };

    const user = roomGetUser();
    const profile = await refreshRoomProfile();
    if (!profile) {
        roomToast("پروفایل بازیکن پیدا نشد.", "⚠️");
        return { success: false, error: "PROFILE_NOT_FOUND" };
    }

    const roomName = String(options.name || "اتاق حکم").trim().slice(0, 50) || "اتاق حکم";
    roomState.creating = true;
    roomShowLoading("در حال ساخت اتاق...");

    try {
        let createdRoom = null;
        let lastError = null;

        for (let attempt = 0; attempt < 10; attempt++) {
            const code = generateRoomCode();
            const roomData = {
                code,
                name: roomName,
                host_id: user.id,
                entry_fee: ROOM_CONFIG.ENTRY_FEE,
                is_private: options.isPrivate !== false,
                status: ROOM_CONFIG.WAITING_STATUS,
                max_players: ROOM_CONFIG.MAX_PLAYERS
            };

            const result = await client.from("rooms").insert(roomData).select().single();
            if (!result.error) {
                createdRoom = result.data;
                break;
            }
            lastError = result.error;
            if (result.error.code !== "23505") break;
        }

        if (!createdRoom) {
            console.error("خطای ساخت اتاق:", lastError);
            roomToast("ساخت اتاق انجام نشد.", "❌");
            return { success: false, error: lastError };
        }

        const hostResult = await joinRoomSeat(createdRoom.id, user.id, 0, "A", true);
        if (!hostResult.success) {
            await client.from("rooms").delete().eq("id", createdRoom.id);
            return hostResult;
        }

        roomState.currentRoom = createdRoom;
        roomState.currentRoomId = createdRoom.id;
        roomState.currentRoomCode = createdRoom.code;
        roomState.status = createdRoom.status;
        roomState.isHost = true;
        roomState.currentSeat = 0;
        roomState.currentTeam = "A";

        await loadRoom(createdRoom.id);
        await subscribeToRoom(createdRoom.id);
        updateRoomUI();

        roomEvents.emit("roomCreated", createdRoom);
        roomToast(`اتاق ساخته شد. کد اتاق: ${createdRoom.code}`, "🎮", 5000);

        return { success: true, room: createdRoom, code: createdRoom.code };
    } catch (error) {
        console.error("خطای createRoom:", error);
        roomToast("خطایی هنگام ساخت اتاق رخ داد.", "❌");
        return { success: false, error };
    } finally {
        roomState.creating = false;
        roomHideLoading();
    }
}

/* ================================================================
   6. JOIN ROOM
================================================================ */

async function joinRoom(roomCode, options = {}) {
    const client = getRoomSupabaseClient();
    if (!client) {
        roomToast("اتصال Supabase آماده نیست.", "⚠️");
        return { success: false, error: "SUPABASE_CLIENT_NOT_FOUND" };
    }
    if (!roomRequireLogin()) return { success: false, error: "LOGIN_REQUIRED" };
    if (roomState.joining) return { success: false, error: "ALREADY_JOINING" };

    const code = normalizeRoomCode(roomCode);
    if (!isValidRoomCode(code)) {
        roomToast("کد اتاق باید ۶ رقم باشد.", "⚠️");
        return { success: false, error: "INVALID_ROOM_CODE" };
    }

    const user = roomGetUser();
    roomState.joining = true;
    roomShowLoading("در حال ورود به اتاق...");

    try {
        const { data: room, error: roomError } = await client
            .from("rooms")
            .select("*")
            .eq("code", code)
            .maybeSingle();

        if (roomError || !room) {
            roomToast("اتاقی با این کد پیدا نشد.", "❌");
            return { success: false, error: "ROOM_NOT_FOUND" };
        }

        if (room.status === ROOM_CONFIG.CLOSED_STATUS || room.status === ROOM_CONFIG.FINISHED_STATUS) {
            roomToast("این اتاق دیگر قابل ورود نیست.", "⚠️");
            return { success: false, error: "ROOM_CLOSED" };
        }

        const { data: existingPlayer } = await client
            .from("room_players")
            .select("*")
            .eq("room_id", room.id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (existingPlayer) {
            roomState.currentRoom = room;
            roomState.currentRoomId = room.id;
            roomState.currentRoomCode = room.code;
            roomState.currentSeat = existingPlayer.seat;
            roomState.currentTeam = existingPlayer.team;
            roomState.isReady = existingPlayer.is_ready;
            roomState.isHost = room.host_id === user.id;

            await loadRoom(room.id);
            await subscribeToRoom(room.id);
            updateRoomUI();
            roomToast("به اتاق برگشتی. 🎮", "👋");
            return { success: true, room };
        }

        const { count } = await client
            .from("room_players")
            .select("id", { count: "exact", head: true })
            .eq("room_id", room.id)
            .is("left_at", null);

        if (Number(count || 0) >= ROOM_CONFIG.MAX_PLAYERS) {
            roomToast("ظرفیت این اتاق تکمیل است.", "🚫");
            return { success: false, error: "ROOM_FULL" };
        }

        const seat = await findAvailableSeat(room.id);
        if (seat === null) {
            roomToast("صندلی خالی در اتاق وجود ندارد.", "🚫");
            return { success: false, error: "NO_SEAT" };
        }

        const team = getTeamForSeat(seat);
        const result = await joinRoomSeat(room.id, user.id, seat, team, false);
        if (!result.success) return result;

        roomState.currentRoom = room;
        roomState.currentRoomId = room.id;
        roomState.currentRoomCode = room.code;
        roomState.currentSeat = seat;
        roomState.currentTeam = team;
        roomState.isHost = room.host_id === user.id;
        roomState.isReady = false;

        await loadRoom(room.id);
        await subscribeToRoom(room.id);
        updateRoomUI();

        roomEvents.emit("roomJoined", room);
        roomToast("با موفقیت وارد اتاق شدی. 🎮", "✅");
        return { success: true, room, seat, team };
    } catch (error) {
        console.error("خطای joinRoom:", error);
        roomToast("ورود به اتاق انجام نشد.", "❌");
        return { success: false, error };
    } finally {
        roomState.joining = false;
        roomHideLoading();
    }
}

async function joinRoomSeat(roomId, userId, seat, team, isHost = false) {
    const client = getRoomSupabaseClient();
    if (!client) return { success: false, error: "SUPABASE_CLIENT_NOT_FOUND" };

    const { data, error } = await client
        .from("room_players")
        .insert({
            room_id: roomId,
            user_id: userId,
            seat: seat,
            team: team,
            is_ready: isHost,
            joined_at: new Date().toISOString(),
            left_at: null
        })
        .select()
        .single();

    if (error) return { success: false, error };
    roomState.currentPlayer = data;
    return { success: true, player: data };
}

async function findAvailableSeat(roomId) {
    const client = getRoomSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
        .from("room_players")
        .select("seat")
        .eq("room_id", roomId)
        .is("left_at", null);

    if (error) return null;
    const occupied = new Set((data || []).map(item => Number(item.seat)));

    for (const seat of ROOM_CONFIG.SEATS) {
        if (!occupied.has(seat)) return seat;
    }
    return null;
}

/* ================================================================
   7. LOAD & REFRESH ROOM
================================================================ */

async function loadRoom(roomId) {
    const client = getRoomSupabaseClient();
    if (!client || !roomId) return null;

    try {
        const { data: room, error: roomError } = await client
            .from("rooms")
            .select("*")
            .eq("id", roomId)
            .single();

        if (roomError) return null;

        const { data: players } = await client
            .from("room_players")
            .select(`
                id, room_id, user_id, seat, team, is_ready, joined_at, left_at,
                profiles ( id, username, avatar_url, level )
            `)
            .eq("room_id", roomId)
            .is("left_at", null)
            .order("seat", { ascending: true });

        roomState.currentRoom = room;
        roomState.currentRoomId = room.id;
        roomState.currentRoomCode = room.code;
        roomState.status = room.status;
        roomState.players = players || [];

        const user = roomGetUser();
        const me = roomState.players.find(p => p.user_id === user?.id);

        roomState.currentPlayer = me || null;
        roomState.isHost = room.host_id === user?.id;

        if (me) {
            roomState.currentSeat = Number(me.seat);
            roomState.currentTeam = me.team;
            roomState.isReady = Boolean(me.is_ready);
        }

        updateRoomUI();
        roomEvents.emit("roomUpdated", { room, players: players || [] });
        return { room, players: players || [] };
    } catch (error) {
        return null;
    }
}

async function refreshCurrentRoom() {
    if (!roomState.currentRoomId) return null;
    return await loadRoom(roomState.currentRoomId);
}

/* ================================================================
   8. READY & SEAT CHANGE
================================================================ */

async function toggleRoomReady() {
    const client = getRoomSupabaseClient();
    const user = roomGetUser();
    if (!client || !user || !roomState.currentRoomId || roomState.starting) return false;

    const newReady = !roomState.isReady;
    const { data, error } = await client
        .from("room_players")
        .update({ is_ready: newReady })
        .eq("room_id", roomState.currentRoomId)
        .eq("user_id", user.id)
        .select()
        .single();

    if (error) return false;
    roomState.isReady = Boolean(data.is_ready);
    updateRoomUI();
    roomEvents.emit("readyChanged", data);
    roomToast(roomState.isReady ? "آماده شدی! ✅" : "از حالت آماده خارج شدی.", roomState.isReady ? "🟢" : "⚪");
    return true;
}

async function changeRoomSeat(newSeat) {
    const client = getRoomSupabaseClient();
    const user = roomGetUser();
    if (!client || !user || !roomState.currentRoomId) return false;

    const seat = Number(newSeat);
    if (!ROOM_CONFIG.SEATS.includes(seat)) return false;

    const { data, error } = await client
        .from("room_players")
        .update({
            seat,
            team: getTeamForSeat(seat),
            is_ready: false
        })
        .eq("room_id", roomState.currentRoomId)
        .eq("user_id", user.id)
        .select()
        .single();

    if (error) return false;
    roomState.currentSeat = seat;
    roomState.currentTeam = getTeamForSeat(seat);
    roomState.isReady = false;
    roomState.currentPlayer = data;

    await refreshCurrentRoom();
    roomEvents.emit("seatChanged", data);
    return true;
}

/* ================================================================
   9. LEAVE ROOM
================================================================ */

async function leaveRoom(options = {}) {
    const client = getRoomSupabaseClient();
    const user = roomGetUser();
    if (!client || !user) {
        clearRoomState();
        return true;
    }
    if (roomState.leaving) return false;

    roomState.leaving = true;
    try {
        const roomId = roomState.currentRoomId;
        if (!roomId) {
            clearRoomState();
            return true;
        }

        await client
            .from("room_players")
            .update({ left_at: new Date().toISOString(), is_ready: false })
            .eq("room_id", roomId)
            .eq("user_id", user.id);

        if (roomState.isHost) {
            await transferHostAfterLeave(roomId, user.id);
        }

        await unsubscribeFromRoom();
        clearRoomState();
        updateRoomUI();

        roomEvents.emit("roomLeft", { roomId });
        if (options.silent !== true) roomToast("از اتاق خارج شدی.", "🚪");
        return true;
    } catch (error) {
        return false;
    } finally {
        roomState.leaving = false;
    }
}

async function transferHostAfterLeave(roomId, leavingUserId) {
    const client = getRoomSupabaseClient();
    if (!client) return false;

    try {
        const { data: players } = await client
            .from("room_players")
            .select("user_id, seat, joined_at")
            .eq("room_id", roomId)
            .is("left_at", null)
            .order("joined_at", { ascending: true });

        const nextHost = (players || []).find(p => p.user_id !== leavingUserId);
        if (!nextHost) {
            await client.from("rooms").update({
                status: ROOM_CONFIG.CLOSED_STATUS,
                closed_at: new Date().toISOString()
            }).eq("id", roomId);
            return true;
        }

        await client.from("rooms").update({ host_id: nextHost.user_id }).eq("id", roomId);
        return true;
    } catch (error) {
        return false;
    }
}

function clearRoomState() {
    roomState.currentRoom = null;
    roomState.currentRoomId = null;
    roomState.currentRoomCode = null;
    roomState.currentGameId = null;
    roomState.currentPlayer = null;
    roomState.players = [];
    roomState.isHost = false;
    roomState.isReady = false;
    roomState.currentSeat = null;
    roomState.currentTeam = null;
    roomState.status = "none";
    roomState.starting = false;
    roomState.lastError = null;
}

function getReadyPlayersCount() {
    return roomState.players.filter(p => Boolean(p.is_ready)).length;
}

function getActivePlayersCount() {
    return roomState.players.filter(p => !p.left_at).length;
}

function canStartRoom() {
    if (!roomState.currentRoom) return { allowed: false, reason: "NO_ROOM" };
    if (!roomState.isHost) return { allowed: false, reason: "NOT_HOST" };
    if (roomState.status !== ROOM_CONFIG.WAITING_STATUS) return { allowed: false, reason: "ROOM_NOT_WAITING" };

    const active = getActivePlayersCount();
    if (active !== ROOM_CONFIG.MAX_PLAYERS) return { allowed: false, reason: "NOT_ENOUGH_PLAYERS", count: active };

    const ready = getReadyPlayersCount();
    if (ready !== ROOM_CONFIG.MAX_PLAYERS) return { allowed: false, reason: "NOT_ALL_READY", count: ready };

    return { allowed: true };
}

/* ================================================================
   10. ENTRY FEE & START GAME
================================================================ */

async function chargeEntryFee(userId, gameId = null) {
    const client = getRoomSupabaseClient();
    if (!client) return { success: false, error: "SUPABASE_CLIENT_NOT_FOUND" };

    const profile = await refreshRoomProfile();
    if (!profile) return { success: false, error: "PROFILE_NOT_FOUND" };

    const currentCoins = Number(profile.coins || 0);
    const fee = ROOM_CONFIG.ENTRY_FEE;

    if (currentCoins < fee) {
        roomToast(`برای شروع بازی حداقل ${fee.toLocaleString("fa-IR")} سکه لازم داری.`, "🪙", 4000);
        roomEvents.emit("insufficientCoins", { required: fee, current: currentCoins });
        return { success: false, error: "INSUFFICIENT_COINS" };
    }

    const newBalance = currentCoins - fee;
    const { data: updatedProfile, error: updateError } = await client
        .from("profiles")
        .update({ coins: newBalance })
        .eq("id", userId)
        .select()
        .single();

    if (updateError) return { success: false, error: updateError };

    await client.from("coin_transactions").insert({
        user_id: userId,
        amount: -fee,
        balance_after: newBalance,
        transaction_type: "game_entry",
        description: "هزینه ورود به بازی حکم",
        reference_id: gameId || null
    });

    if (window.state?.player) window.state.player.coins = newBalance;
    if (window.hokmAuth?.loadProfile) await window.hokmAuth.loadProfile();
    if (typeof window.updatePlayerUI === "function") window.updatePlayerUI();

    roomEvents.emit("coinsCharged", { amount: fee, balance: newBalance, gameId });
    return { success: true, amount: fee, balance: newBalance, profile: updatedProfile };
}

async function startRoomGame() {
    const client = getRoomSupabaseClient();
    const user = roomGetUser();
    if (!client || !user) return { success: false, error: "LOGIN_REQUIRED" };
    if (roomState.starting) return { success: false, error: "ALREADY_STARTING" };

    const permission = canStartRoom();
    if (!permission.allowed) {
        roomToast("شرایط شروع بازی کامل نیست.", "⚠️");
        return { success: false, error: permission.reason };
    }

    roomState.starting = true;
    roomShowLoading("در حال آماده‌سازی بازی...");

    try {
        const { data: game, error: gameError } = await client
            .from("games")
            .insert({
                room_id: roomState.currentRoomId,
                status: "active",
                phase: "dealing",
                leader_seat: 0,
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        if (gameError) throw gameError;

        roomState.currentGameId = game.id;
        const players = roomState.players.filter(p => !p.left_at);

        for (const player of players) {
            const charge = await chargeEntryFee(player.user_id, game.id);
            if (!charge.success) {
                await client.from("games").delete().eq("id", game.id);
                return { success: false, error: "PLAYER_INSUFFICIENT_COINS" };
            }
        }

        await client.from("rooms").update({ status: ROOM_CONFIG.PLAYING_STATUS }).eq("id", roomState.currentRoomId);
        roomState.status = ROOM_CONFIG.PLAYING_STATUS;
        updateRoomUI();

        roomEvents.emit("gameStarted", { game, room: roomState.currentRoom, players });
        if (typeof window.initializeGameFromRoom === "function") {
            await window.initializeGameFromRoom(game, roomState.currentRoom, players);
        }

        roomToast("بازی شروع شد! 🎮", "🔥", 3500);
        return { success: true, game, room: roomState.currentRoom };
    } catch (error) {
        console.error("خطای startRoomGame:", error);
        roomToast("خطایی هنگام شروع بازی رخ داد.", "❌");
        return { success: false, error };
    } finally {
        roomState.starting = false;
        roomHideLoading();
    }
}

/* ================================================================
   11. REALTIME & SUBSCRIPTION
================================================================ */

async function subscribeToRoom(roomId) {
    const client = getRoomSupabaseClient();
    if (!client || !roomId) return null;

    await unsubscribeFromRoom();
    const channel = client.channel(`hokm-room-${roomId}`);

    channel.on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, payload => {
        if (payload.eventType === "UPDATE") {
            roomState.currentRoom = payload.new;
            roomState.status = payload.new.status;
            updateRoomUI();
            roomEvents.emit("roomRealtime", payload);
            if (payload.new.status === ROOM_CONFIG.PLAYING_STATUS) roomEvents.emit("gameReady", payload.new);
        }
    });

    channel.on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, async payload => {
        await refreshCurrentRoom();
        roomEvents.emit("playersRealtime", payload);
    });

    const status = await channel.subscribe();
    if (status === "SUBSCRIBED") {
        roomState.realtimeChannel = channel;
        roomState.roomChannel = channel;
        roomEvents.emit("realtimeConnected", roomId);
    }
    return channel;
}

async function unsubscribeFromRoom() {
    const client = getRoomSupabaseClient();
    if (roomState.realtimeChannel && client) {
        try { await client.removeChannel(roomState.realtimeChannel); } catch (e) {}
    }
    roomState.realtimeChannel = null;
    roomState.roomChannel = null;
}

async function copyRoomCode() {
    const code = roomState.currentRoomCode;
    if (!code) return false;
    try {
        if (navigator.clipboard) await navigator.clipboard.writeText(code);
        roomToast("کد اتاق کپی شد. 📋", "✅");
        return true;
    } catch (e) {
        return false;
    }
}

function getPlayerBySeat(seat) {
    return roomState.players.find(p => Number(p.seat) === Number(seat)) || null;
}

function getRoomPlayerDisplayData(player) {
    const profile = player?.profiles || {};
    return {
        id: player?.user_id || "",
        name: profile.username || "بازیکن",
        avatar: profile.avatar_url || "",
        level: Number(profile.level || 1),
        seat: Number(player?.seat ?? 0),
        team: player?.team || "",
        ready: Boolean(player?.is_ready),
        isCurrentUser: player?.user_id === roomGetUser()?.id
    };
}

/* ================================================================
   12. UI UPDATES
================================================================ */

function updateRoomUI() {
    document.querySelectorAll("[data-room-code], #roomCode").forEach(el => {
        el.textContent = roomState.currentRoomCode || "------";
    });

    ROOM_CONFIG.SEATS.forEach(seat => {
        const player = getPlayerBySeat(seat);
        const nameEl = document.getElementById(`playerName${seat + 1}`);
        if (nameEl) {
            nameEl.textContent = player?.profiles?.username || (player ? "بازیکن" : "انتظار بازیکن");
        }
    });

    const readyBtn = document.querySelector("[data-room-ready]");
    if (readyBtn) {
        readyBtn.textContent = roomState.isReady ? "لغو آمادگی" : "آماده‌ام";
    }

    const startBtn = document.querySelector("#startRoomGameButton, [data-room-start]");
    if (startBtn) {
        const canStart = canStartRoom();
        startBtn.disabled = !canStart.allowed;
    }

    roomEvents.emit("uiUpdated", roomState);
}

function setupRoomUIEvents() {
    document.addEventListener("click", async event => {
        if (event.target.closest("#copyRoomCodeButton, [data-room-copy]")) {
            event.preventDefault();
            await copyRoomCode();
        }
        if (event.target.closest("[data-room-ready]")) {
            event.preventDefault();
            await toggleRoomReady();
        }
        if (event.target.closest("#startRoomGameButton, [data-room-start]")) {
            event.preventDefault();
            await startRoomGame();
        }
        if (event.target.closest("#roomBackButton, [data-room-leave]")) {
            event.preventDefault();
            await leaveRoom();
        }
    });
}

async function initializeRoom() {
    if (roomState.initialized) return roomState;
    try {
        setupRoomUIEvents();
        roomState.initialized = true;
        updateRoomUI();
        roomEvents.emit("initialized", roomState);
        console.log("Hokm Online Room initialized successfully.");
        return roomState;
    } catch (e) {
        return roomState;
    }
}

window.hokmRoom = {
    createRoom,
    joinRoom,
    leaveRoom,
    loadRoom,
    refreshCurrentRoom,
    toggleRoomReady,
    changeRoomSeat,
    startRoomGame,
    copyRoomCode,
    getCurrentRoom,
    getCurrentRoomId,
    getCurrentRoomCode,
    getCurrentRoomPlayers,
    isRoomHost,
    isRoomReady,
    initializeRoom,
    on: (evt, cb) => roomEvents.on(evt, cb)
};

window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.startRoomGame = startRoomGame;
window.toggleRoomReady = toggleRoomReady;
window.copyRoomCode = copyRoomCode;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeRoom);
} else {
    initializeRoom();
}
