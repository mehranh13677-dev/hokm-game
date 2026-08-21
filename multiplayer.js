"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * multiplayer.js
 *
 * FILE 03 / 12
 *
 * سیستم کامل Multiplayer و Realtime
 * ================================================================
 */

/* ================================================================
   1. GLOBAL CONFIGURATION
================================================================ */

const MULTIPLAYER_CONFIG = {
    heartbeatInterval: 15000,
    connectionTimeout: 10000,
    reconnectDelay: 2500,
    maxReconnectAttempts: 10,
    messageTimeout: 8000,
    maxPendingMessages: 100,
    maxPlayersPerRoom: 4,
    maxStateSize: 200000,
    version: "1.0.0"
};

/* ================================================================
   2. MULTIPLAYER STATE
================================================================ */

const multiplayerState = {
    initialized: false,
    connected: false,
    connecting: false,
    reconnecting: false,
    roomId: null,
    channel: null,
    channelName: null,
    connectionStatus: "disconnected",
    connectionError: null,
    reconnectAttempts: 0,
    lastConnectionAt: null,
    lastHeartbeatAt: null,
    lastMessageAt: null,
    lastActionId: null,
    sequence: 0,
    players: [],
    playerMap: {},
    readyPlayers: {},
    currentTurn: null,
    gameStarted: false,
    gameFinished: false,
    gameStateVersion: 0,
    lastGameState: null,
    pendingMessages: [],
    pendingActions: [],
    sentActions: {},
    receivedActions: {},
    presence: {},
    localPlayerId: null,
    localPlayerName: null,
    localPlayerSeat: null,
    isHost: false,
    hostId: null,
    heartbeatTimer: null,
    reconnectTimer: null,
    connectionTimer: null,
    initializedAt: null
};

/* ================================================================
   3. EVENT SYSTEM
================================================================ */

const multiplayerEvents = {
    listeners: {},

    on(eventName, callback) {
        if (typeof callback !== "function") return function () {};
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);

        return function unsubscribe() {
            const list = multiplayerEvents.listeners[eventName];
            if (!list) return;
            const index = list.indexOf(callback);
            if (index !== -1) list.splice(index, 1);
        };
    },

    emit(eventName, data) {
        const list = this.listeners[eventName] || [];
        list.slice().forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error("Multiplayer Event Error:", eventName, error);
            }
        });
    },

    off(eventName, callback) {
        if (!this.listeners[eventName]) return;
        this.listeners[eventName] = this.listeners[eventName].filter(
            item => item !== callback
        );
    },

    clear() {
        this.listeners = {};
    }
};

/* ================================================================
   4. UTILITY FUNCTIONS
================================================================ */

function multiplayerToast(message, icon = "ℹ️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(icon, message);
}

function multiplayerLoading(show, message = "لطفاً صبر کنید...") {
    if (show && typeof window.showLoading === "function") {
        window.showLoading(message);
        return;
    }
    if (!show && typeof window.hideLoading === "function") {
        window.hideLoading();
    }
}

function generateId(prefix = "mp") {
    return (
        prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 10)
    );
}

function now() {
    return Date.now();
}

function cloneData(data) {
    if (data === undefined || data === null) return data;
    try {
        return JSON.parse(JSON.stringify(data));
    } catch (error) {
        console.error("Clone multiplayer data failed:", error);
        return null;
    }
}

function safeString(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    return String(value);
}

function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/* ================================================================
   5. SUPABASE & AUTH
================================================================ */

function getMultiplayerSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.channel === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.channel === "function") {
        return window.supabase;
    }
    console.error("Supabase Client برای Multiplayer پیدا نشد.");
    return null;
}

function getMultiplayerUser() {
    if (typeof window.getCurrentUser === "function") return window.getCurrentUser();
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentUser === "function") {
        return window.hokmAuth.getCurrentUser();
    }
    return null;
}

function getMultiplayerUserId() {
    const user = getMultiplayerUser();
    if (user?.id) return user.id;
    if (multiplayerState.localPlayerId) return multiplayerState.localPlayerId;
    return null;
}

function getMultiplayerPlayerName() {
    if (multiplayerState.localPlayerName) return multiplayerState.localPlayerName;
    if (typeof window.getProfileDisplayName === "function") return window.getProfileDisplayName();
    if (window.hokmAuth && typeof window.hokmAuth.getProfileDisplayName === "function") {
        return window.hokmAuth.getProfileDisplayName();
    }
    const user = getMultiplayerUser();
    return (
        user?.user_metadata?.display_name ||
        user?.user_metadata?.username ||
        "بازیکن"
    );
}

function initializeMultiplayer() {
    if (multiplayerState.initialized) return true;
    const client = getMultiplayerSupabaseClient();
    if (!client) {
        console.warn("Multiplayer initialization منتظر Supabase است.");
        return false;
    }

    multiplayerState.localPlayerId = getMultiplayerUserId();
    multiplayerState.localPlayerName = getMultiplayerPlayerName();
    multiplayerState.initialized = true;
    multiplayerState.initializedAt = now();

    setupAuthIntegration();
    multiplayerEvents.emit("initialized", getMultiplayerPublicState());
    console.log("Hokm Online Multiplayer initialized.");
    return true;
}

function setupAuthIntegration() {
    if (window.hokmAuth && typeof window.hokmAuth.onAuthChange === "function") {
        window.hokmAuth.onAuthChange(data => {
            const user = data?.user || getMultiplayerUser();
            if (user) {
                multiplayerState.localPlayerId = user.id;
                multiplayerState.localPlayerName = getMultiplayerPlayerName();
            }
        });
    }
}

function createChannelName(roomId) {
    return "hokm-room-" + safeString(roomId);
}

/* ================================================================
   6. CONNECTION & PRESENCE
================================================================ */

async function connectToRoom(roomId, options = {}) {
    initializeMultiplayer();
    const client = getMultiplayerSupabaseClient();
    if (!client) {
        multiplayerToast("اتصال به سرور آماده نیست.", "⚠️");
        return { success: false, error: "SUPABASE_CLIENT_NOT_FOUND" };
    }
    if (!roomId) {
        multiplayerToast("شناسه اتاق معتبر نیست.", "⚠️");
        return { success: false, error: "ROOM_ID_REQUIRED" };
    }

    roomId = safeString(roomId).trim();
    if (multiplayerState.roomId === roomId && multiplayerState.connected) {
        return { success: true, alreadyConnected: true };
    }

    await disconnectFromRoom(false);
    multiplayerState.roomId = roomId;
    multiplayerState.localPlayerId = getMultiplayerUserId();
    multiplayerState.localPlayerName = getMultiplayerPlayerName();
    multiplayerState.connectionStatus = "connecting";
    multiplayerState.connecting = true;
    multiplayerState.connectionError = null;

    multiplayerEvents.emit("connectionStateChanged", getMultiplayerPublicState());
    multiplayerLoading(true, "در حال اتصال به بازی...");

    try {
        const channelName = createChannelName(roomId);
        multiplayerState.channelName = channelName;

        const channel = client.channel(channelName, {
            config: {
                presence: {
                    key: multiplayerState.localPlayerId || generateId("guest")
                },
                broadcast: { self: false, ack: true }
            }
        });

        multiplayerState.channel = channel;
        setupChannelListeners(channel);

        const timeoutPromise = new Promise((_, reject) => {
            multiplayerState.connectionTimer = setTimeout(() => {
                reject(new Error("اتصال به اتاق بیش از حد طول کشید."));
            }, MULTIPLAYER_CONFIG.connectionTimeout);
        });

        const subscribePromise = new Promise((resolve, reject) => {
            channel.subscribe(status => {
                if (status === "SUBSCRIBED") {
                    if (multiplayerState.connectionTimer) {
                        clearTimeout(multiplayerState.connectionTimer);
                        multiplayerState.connectionTimer = null;
                    }
                    resolve(status);
                }
                if (status === "CHANNEL_ERROR") reject(new Error("CHANNEL_ERROR"));
                if (status === "TIMED_OUT") reject(new Error("CHANNEL_TIMED_OUT"));
            });
        });

        await Promise.race([subscribePromise, timeoutPromise]);

        multiplayerState.connected = true;
        multiplayerState.connecting = false;
        multiplayerState.reconnecting = false;
        multiplayerState.connectionStatus = "connected";
        multiplayerState.reconnectAttempts = 0;
        multiplayerState.lastConnectionAt = now();
        multiplayerState.connectionError = null;

        multiplayerLoading(false);
        startHeartbeat();
        await trackPresence();
        await requestRoomSync();
        await announceJoin(options);

        multiplayerEvents.emit("connected", getMultiplayerPublicState());
        multiplayerEvents.emit("connectionStateChanged", getMultiplayerPublicState());
        multiplayerToast("به بازی آنلاین متصل شدی 🎮", "🟢", 2500);

        return { success: true, roomId, channelName };
    } catch (error) {
        multiplayerLoading(false);
        multiplayerState.connected = false;
        multiplayerState.connecting = false;
        multiplayerState.connectionStatus = "error";
        multiplayerState.connectionError = error;

        if (multiplayerState.channel) {
            try { await client.removeChannel(multiplayerState.channel); } catch (e) {}
        }
        multiplayerState.channel = null;

        multiplayerEvents.emit("connectionError", error);
        multiplayerEvents.emit("connectionStateChanged", getMultiplayerPublicState());
        scheduleReconnect();

        return { success: false, error };
    }
}

function setupChannelListeners(channel) {
    if (!channel) return;

    channel.on("broadcast", { event: "multiplayer_message" }, payload => {
        handleIncomingMessage(payload?.payload || payload);
    });

    channel.on("presence", { event: "sync" }, () => {
        updatePresenceState();
    });

    channel.on("presence", { event: "join" }, payload => {
        handlePresenceJoin(payload);
    });

    channel.on("presence", { event: "leave" }, payload => {
        handlePresenceLeave(payload);
    });
}

async function trackPresence() {
    const channel = multiplayerState.channel;
    if (!channel) return false;

    const playerId = getMultiplayerUserId() || generateId("guest");
    multiplayerState.localPlayerId = playerId;
    multiplayerState.localPlayerName = getMultiplayerPlayerName();

    try {
        await channel.track({
            player_id: playerId,
            user_id: playerId,
            player_name: multiplayerState.localPlayerName,
            seat: multiplayerState.localPlayerSeat,
            online: true,
            ready: !!multiplayerState.readyPlayers[playerId],
            timestamp: now()
        });
        return true;
    } catch (error) {
        console.error("Presence track error:", error);
        return false;
    }
}

function updatePresenceState() {
    const channel = multiplayerState.channel;
    if (!channel) return;

    try {
        const state = channel.presenceState();
        multiplayerState.presence = state || {};
        const players = [];

        Object.keys(multiplayerState.presence).forEach(key => {
            const entries = multiplayerState.presence[key];
            if (!Array.isArray(entries)) return;
            entries.forEach(entry => {
                if (!entry) return;
                const playerId = entry.player_id || entry.user_id || key;
                players.push({
                    id: playerId,
                    userId: entry.user_id || playerId,
                    name: entry.player_name || "بازیکن",
                    seat: entry.seat ?? null,
                    online: entry.online !== false,
                    ready: entry.ready === true,
                    timestamp: entry.timestamp || now()
                });
            });
        });

        multiplayerState.players = normalizePlayers(players);
        multiplayerState.playerMap = createPlayerMap(multiplayerState.players);
        multiplayerEvents.emit("playersUpdated", cloneData(multiplayerState.players));
        updateRoomUI();
    } catch (error) {
        console.error("Presence state error:", error);
    }
}

function handlePresenceJoin(payload) {
    updatePresenceState();
    multiplayerEvents.emit("playerJoined", payload);
    updateRoomUI();
}

function handlePresenceLeave(payload) {
    updatePresenceState();
    multiplayerEvents.emit("playerLeft", payload);
    updateRoomUI();
}

function normalizePlayers(players) {
    const map = {};
    players.forEach(player => {
        if (!player?.id) return;
        map[player.id] = { ...map[player.id], ...player };
    });

    return Object.values(map).sort((a, b) => {
        if (a.seat !== null && b.seat !== null) {
            return Number(a.seat) - Number(b.seat);
        }
        return String(a.name).localeCompare(String(b.name), "fa");
    });
}

function createPlayerMap(players) {
    const map = {};
    players.forEach(player => {
        if (player?.id) map[player.id] = player;
    });
    return map;
}

async function announceJoin(options = {}) {
    return sendMessage("player_joined", {
        player: {
            id: getMultiplayerUserId(),
            name: getMultiplayerPlayerName(),
            seat: multiplayerState.localPlayerSeat
        },
        options: cloneData(options)
    });
}

/* ================================================================
   7. MESSAGING & ACTIONS
================================================================ */

async function sendMessage(type, data = {}, options = {}) {
    const channel = multiplayerState.channel;
    if (!channel || !multiplayerState.connected) {
        queueMessage(type, data, options);
        return { success: false, queued: true, error: "NOT_CONNECTED" };
    }

    const messageId = generateId("msg");
    const message = {
        id: messageId,
        type: safeString(type),
        data: cloneData(data),
        sender: {
            id: getMultiplayerUserId(),
            name: getMultiplayerPlayerName(),
            seat: multiplayerState.localPlayerSeat
        },
        room_id: multiplayerState.roomId,
        timestamp: now(),
        sequence: ++multiplayerState.sequence,
        version: MULTIPLAYER_CONFIG.version
    };

    try {
        const result = await channel.send({
            type: "broadcast",
            event: "multiplayer_message",
            payload: message
        });

        multiplayerState.lastMessageAt = now();
        if (options.track !== false) {
            multiplayerState.pendingMessages = multiplayerState.pendingMessages.filter(
                item => item.id !== messageId
            );
        }

        multiplayerEvents.emit("messageSent", message);
        return { success: true, messageId, result };
    } catch (error) {
        console.error("Send multiplayer message error:", error);
        if (options.queue !== false) {
            queueMessage(type, data, options);
        }
        return { success: false, error };
    }
}

function handleIncomingMessage(message) {
    if (!message) return;
    if (!message.id) message.id = generateId("remote");
    if (message.room_id && multiplayerState.roomId && message.room_id !== multiplayerState.roomId) {
        return;
    }
    if (message.sender?.id === getMultiplayerUserId()) return;
    if (multiplayerState.receivedActions[message.id]) return;

    multiplayerState.receivedActions[message.id] = now();
    multiplayerState.lastMessageAt = now();
    multiplayerEvents.emit("messageReceived", message);

    routeIncomingMessage(message);
    cleanupReceivedMessages();
}

function routeIncomingMessage(message) {
    switch (message.type) {
        case "player_joined": handleRemotePlayerJoined(message); break;
        case "player_left": handleRemotePlayerLeft(message); break;
        case "room_sync_request": handleRoomSyncRequest(message); break;
        case "room_sync": handleRoomSync(message); break;
        case "player_ready": handlePlayerReady(message); break;
        case "player_unready": handlePlayerUnready(message); break;
        case "game_start": handleGameStart(message); break;
        case "game_state": handleGameState(message); break;
        case "game_action": handleGameAction(message); break;
        case "turn_changed": handleTurnChanged(message); break;
        case "game_finished": handleGameFinished(message); break;
        case "chat_message": handleChatMessage(message); break;
        case "host_changed": handleHostChanged(message); break;
        case "heartbeat": handleHeartbeat(message); break;
        case "ping":
            sendMessage("pong", { pingId: message.data?.pingId }, { queue: false });
            break;
        case "pong":
            multiplayerEvents.emit("pong", message);
            break;
        default:
            multiplayerEvents.emit("unknownMessage", message);
            break;
    }
}

function handleRemotePlayerJoined(message) {
    multiplayerEvents.emit("remotePlayerJoined", message.data);
    updatePresenceState();
    updateRoomUI();
}

function handleRemotePlayerLeft(message) {
    const playerId = message.data?.player?.id;
    if (playerId) delete multiplayerState.playerMap[playerId];
    multiplayerEvents.emit("remotePlayerLeft", message.data);
    updatePresenceState();
    updateRoomUI();
}

function queueMessage(type, data, options = {}) {
    if (multiplayerState.pendingMessages.length >= MULTIPLAYER_CONFIG.maxPendingMessages) {
        multiplayerState.pendingMessages.shift();
    }
    multiplayerState.pendingMessages.push({
        id: generateId("queued"),
        type,
        data: cloneData(data),
        options: cloneData(options),
        createdAt: now()
    });
}

async function requestRoomSync() {
    return sendMessage("room_sync_request", {
        requester: {
            id: getMultiplayerUserId(),
            name: getMultiplayerPlayerName()
        }
    });
}

function handleRoomSyncRequest(message) {
    if (!isCurrentHost()) return;
    sendRoomSync(message.sender?.id);
}

async function sendRoomSync(targetPlayerId = null) {
    return sendMessage("room_sync", {
        targetPlayerId,
        roomId: multiplayerState.roomId,
        players: cloneData(multiplayerState.players),
        readyPlayers: cloneData(multiplayerState.readyPlayers),
        gameStarted: multiplayerState.gameStarted,
        gameFinished: multiplayerState.gameFinished,
        currentTurn: multiplayerState.currentTurn,
        gameStateVersion: multiplayerState.gameStateVersion,
        gameState: cloneData(multiplayerState.lastGameState),
        hostId: multiplayerState.hostId
    });
}

function handleRoomSync(message) {
    const data = message.data;
    if (data?.targetPlayerId && data.targetPlayerId !== getMultiplayerUserId()) return;

    if (Array.isArray(data?.players)) {
        multiplayerState.players = normalizePlayers(data.players);
        multiplayerState.playerMap = createPlayerMap(multiplayerState.players);
    }
    if (isObject(data?.readyPlayers)) {
        multiplayerState.readyPlayers = { ...data.readyPlayers };
    }
    multiplayerState.gameStarted = !!data?.gameStarted;
    multiplayerState.gameFinished = !!data?.gameFinished;
    multiplayerState.currentTurn = data?.currentTurn ?? null;
    multiplayerState.gameStateVersion = safeNumber(data?.gameStateVersion, multiplayerState.gameStateVersion);
    multiplayerState.hostId = data?.hostId || multiplayerState.hostId;

    if (data?.gameState) {
        applyRemoteGameState(data.gameState, { fromSync: true });
    }

    multiplayerEvents.emit("roomSynced", cloneData(data));
    updateRoomUI();
}

async function setPlayerReady(ready = true) {
    const playerId = getMultiplayerUserId();
    if (!playerId) return { success: false, error: "PLAYER_NOT_FOUND" };

    multiplayerState.readyPlayers[playerId] = !!ready;
    await trackPresence();

    const result = await sendMessage(ready ? "player_ready" : "player_unready", {
        playerId,
        playerName: getMultiplayerPlayerName(),
        seat: multiplayerState.localPlayerSeat,
        ready: !!ready
    });

    multiplayerEvents.emit(ready ? "playerReady" : "playerUnready", { playerId, ready: !!ready });
    updateRoomUI();
    return result;
}

function handlePlayerReady(message) {
    const playerId = message.data?.playerId;
    if (!playerId) return;
    multiplayerState.readyPlayers[playerId] = true;
    updatePresenceState();
    multiplayerEvents.emit("playerReady", message.data);
    updateRoomUI();
}

function handlePlayerUnready(message) {
    const playerId = message.data?.playerId;
    if (!playerId) return;
    multiplayerState.readyPlayers[playerId] = false;
    updatePresenceState();
    multiplayerEvents.emit("playerUnready", message.data);
    updateRoomUI();
}

/* ================================================================
   8. GAME ENGINE INTEGRATION
================================================================ */

async function startMultiplayerGame(initialGameState = null) {
    if (!isCurrentHost()) return { success: false, error: "ONLY_HOST_CAN_START" };
    if (multiplayerState.gameStarted) return { success: false, error: "GAME_ALREADY_STARTED" };
    if (multiplayerState.players.length < 2) {
        multiplayerToast("برای شروع بازی حداقل دو بازیکن لازم است.", "⚠️");
        return { success: false, error: "NOT_ENOUGH_PLAYERS" };
    }

    multiplayerState.gameStarted = true;
    multiplayerState.gameFinished = false;
    multiplayerState.gameStateVersion = 1;
    multiplayerState.currentTurn = null;

    if (initialGameState) {
        multiplayerState.lastGameState = cloneData(initialGameState);
    }

    const result = await sendMessage("game_start", {
        players: cloneData(multiplayerState.players),
        gameState: cloneData(multiplayerState.lastGameState),
        version: multiplayerState.gameStateVersion
    });

    multiplayerEvents.emit("gameStarted", {
        players: cloneData(multiplayerState.players),
        gameState: cloneData(multiplayerState.lastGameState)
    });

    return result;
}

function handleGameStart(message) {
    const data = message.data;
    multiplayerState.gameStarted = true;
    multiplayerState.gameFinished = false;
    multiplayerState.gameStateVersion = safeNumber(data?.version, 1);

    if (data?.gameState) {
        applyRemoteGameState(data.gameState, { fromStart: true });
    }

    multiplayerEvents.emit("gameStarted", cloneData(data));
    if (typeof window.startOnlineGame === "function") {
        try { window.startOnlineGame(cloneData(data)); } catch (e) {}
    }
    updateGameUI();
}

async function sendGameAction(actionType, actionData = {}, options = {}) {
    if (!multiplayerState.connected) return { success: false, error: "NOT_CONNECTED" };
    if (!multiplayerState.gameStarted) return { success: false, error: "GAME_NOT_STARTED" };

    const actionId = generateId("action");
    const action = {
        actionId,
        actionType: safeString(actionType),
        data: cloneData(actionData),
        playerId: getMultiplayerUserId(),
        playerName: getMultiplayerPlayerName(),
        seat: multiplayerState.localPlayerSeat,
        turn: multiplayerState.currentTurn,
        stateVersion: multiplayerState.gameStateVersion,
        timestamp: now()
    };

    multiplayerState.sentActions[actionId] = true;
    multiplayerState.lastActionId = actionId;
    multiplayerState.pendingActions.push(action);

    const result = await sendMessage("game_action", action, options);
    if (!result.success) {
        multiplayerState.pendingActions = multiplayerState.pendingActions.filter(
            item => item.actionId !== actionId
        );
    }

    return { ...result, action };
}

function handleGameAction(message) {
    const action = message.data;
    if (!action || !action.actionId) return;
    if (multiplayerState.receivedActions[action.actionId]) return;

    multiplayerState.receivedActions[action.actionId] = now();
    multiplayerState.pendingActions = multiplayerState.pendingActions.filter(
        item => item.actionId !== action.actionId
    );

    if (action.roomId && action.roomId !== multiplayerState.roomId) return;

    multiplayerEvents.emit("gameAction", cloneData(action));

    if (typeof window.handleOnlineGameAction === "function") {
        try { window.handleOnlineGameAction(cloneData(action)); } catch (e) {}
    }
    if (typeof window.applyRemoteMove === "function") {
        try { window.applyRemoteMove(cloneData(action)); } catch (e) {}
    }
}

async function sendGameState(gameState, options = {}) {
    if (!multiplayerState.connected) return { success: false, error: "NOT_CONNECTED" };
    if (!isCurrentHost() && options.allowNonHost !== true) {
        return { success: false, error: "ONLY_HOST_CAN_SYNC" };
    }

    const clonedState = cloneData(gameState);
    if (clonedState === null) return { success: false, error: "INVALID_GAME_STATE" };

    multiplayerState.gameStateVersion++;
    multiplayerState.lastGameState = clonedState;

    const result = await sendMessage("game_state", {
        state: clonedState,
        version: multiplayerState.gameStateVersion,
        updatedBy: getMultiplayerUserId(),
        timestamp: now()
    }, options);

    multiplayerEvents.emit("gameStateSent", {
        state: clonedState,
        version: multiplayerState.gameStateVersion
    });

    return result;
}

function handleGameState(message) {
    const data = message.data;
    if (!data?.state) return;

    const version = safeNumber(data.version, 0);
    if (version < multiplayerState.gameStateVersion) return;

    multiplayerState.gameStateVersion = version;
    applyRemoteGameState(data.state, { version, sender: message.sender });
}

function applyRemoteGameState(state, metadata = {}) {
    const clonedState = cloneData(state);
    if (clonedState === null) return false;

    multiplayerState.lastGameState = clonedState;
    if (metadata.version !== undefined) {
        multiplayerState.gameStateVersion = safeNumber(metadata.version, multiplayerState.gameStateVersion);
    }

    multiplayerEvents.emit("gameStateUpdated", {
        state: cloneData(clonedState),
        metadata: cloneData(metadata)
    });

    if (typeof window.applyRemoteGameState === "function") {
        try { window.applyRemoteGameState(cloneData(clonedState), cloneData(metadata)); } catch (e) {}
    }
    if (typeof window.syncGameFromServer === "function") {
        try { window.syncGameFromServer(cloneData(clonedState)); } catch (e) {}
    }

    updateGameUI();
    return true;
}

async function setCurrentTurn(playerId) {
    if (!isCurrentHost()) return { success: false, error: "ONLY_HOST_CAN_CHANGE_TURN" };

    multiplayerState.currentTurn = playerId || null;
    const result = await sendMessage("turn_changed", {
        playerId: multiplayerState.currentTurn,
        timestamp: now()
    });

    multiplayerEvents.emit("turnChanged", { playerId: multiplayerState.currentTurn });
    updateGameUI();
    return result;
}

function handleTurnChanged(message) {
    const playerId = message.data?.playerId;
    multiplayerState.currentTurn = playerId || null;
    multiplayerEvents.emit("turnChanged", { playerId: multiplayerState.currentTurn });

    if (typeof window.setOnlineTurn === "function") {
        try { window.setOnlineTurn(multiplayerState.currentTurn); } catch (e) {}
    }
    updateGameUI();
}

async function finishMultiplayerGame(resultData = {}) {
    multiplayerState.gameFinished = true;
    multiplayerState.gameStarted = false;

    const result = await sendMessage("game_finished", {
        result: cloneData(resultData),
        finishedAt: now()
    });

    multiplayerEvents.emit("gameFinished", cloneData(resultData));
    return result;
}

function handleGameFinished(message) {
    multiplayerState.gameFinished = true;
    multiplayerState.gameStarted = false;

    const result = message.data?.result || message.data;
    multiplayerEvents.emit("gameFinished", cloneData(result));

    if (typeof window.handleOnlineGameFinished === "function") {
        try { window.handleOnlineGameFinished(cloneData(result)); } catch (e) {}
    }
    updateGameUI();
}

/* ================================================================
   9. CHAT & HOST MANAGEMENT
================================================================ */

async function sendMultiplayerChatMessage(text, metadata = {}) {
    text = safeString(text).trim();
    if (!text) return { success: false, error: "EMPTY_MESSAGE" };
    if (text.length > 500) text = text.substring(0, 500);

    const messageData = {
        id: generateId("chat"),
        text,
        playerId: getMultiplayerUserId(),
        playerName: getMultiplayerPlayerName(),
        timestamp: now(),
        metadata: cloneData(metadata)
    };

    return sendMessage("chat_message", messageData);
}

function handleChatMessage(message) {
    const chat = message.data;
    if (!chat) return;

    multiplayerEvents.emit("chatMessage", cloneData(chat));
    if (typeof window.receiveOnlineChatMessage === "function") {
        try { window.receiveOnlineChatMessage(cloneData(chat)); } catch (e) {}
    }
}

function calculateHost() {
    const players = multiplayerState.players;
    if (players.length === 0) return null;

    const seatZero = players.find(p => Number(p.seat) === 0);
    if (seatZero) return seatZero.id;

    const sorted = players.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return sorted[0]?.id || null;
}

function isCurrentHost() {
    const currentUserId = getMultiplayerUserId();
    if (multiplayerState.hostId) return multiplayerState.hostId === currentUserId;

    const calculatedHost = calculateHost();
    multiplayerState.hostId = calculatedHost;
    multiplayerState.isHost = calculatedHost === currentUserId;
    return multiplayerState.isHost;
}

async function updateHost() {
    const previousHost = multiplayerState.hostId;
    const newHost = calculateHost();

    multiplayerState.hostId = newHost;
    multiplayerState.isHost = newHost === getMultiplayerUserId();

    if (previousHost !== newHost) {
        multiplayerEvents.emit("hostChanged", { previousHost, newHost });
        if (multiplayerState.isHost) {
            await sendMessage("host_changed", { hostId: newHost });
        }
    }
    updateRoomUI();
}

function handleHostChanged(message) {
    const hostId = message.data?.hostId;
    multiplayerState.hostId = hostId || null;
    multiplayerState.isHost = hostId === getMultiplayerUserId();
    multiplayerEvents.emit("hostChanged", { hostId });
    updateRoomUI();
}

async function setLocalPlayerSeat(seat) {
    const numericSeat = Number(seat);
    if (!Number.isInteger(numericSeat) || numericSeat < 0 || numericSeat >= MULTIPLAYER_CONFIG.maxPlayersPerRoom) {
        return false;
    }

    multiplayerState.localPlayerSeat = numericSeat;
    await trackPresence();
    multiplayerEvents.emit("seatChanged", {
        playerId: getMultiplayerUserId(),
        seat: numericSeat
    });
    return true;
}

function isMyTurn() {
    const myId = getMultiplayerUserId();
    return !!myId && multiplayerState.currentTurn === myId;
}

function canMakeOnlineMove() {
    return multiplayerState.connected && multiplayerState.gameStarted && !multiplayerState.gameFinished && isMyTurn();
}

/* ================================================================
   10. HEARTBEAT & RECONNECT
================================================================ */

function startHeartbeat() {
    stopHeartbeat();
    sendHeartbeat();
    multiplayerState.heartbeatTimer = setInterval(sendHeartbeat, MULTIPLAYER_CONFIG.heartbeatInterval);
}

function stopHeartbeat() {
    if (multiplayerState.heartbeatTimer) {
        clearInterval(multiplayerState.heartbeatTimer);
        multiplayerState.heartbeatTimer = null;
    }
}

async function sendHeartbeat() {
    if (!multiplayerState.connected) return;
    multiplayerState.lastHeartbeatAt = now();
    await trackPresence();
    await sendMessage("heartbeat", {
        playerId: getMultiplayerUserId(),
        timestamp: now()
    }, { queue: false });
}

function handleHeartbeat(message) {
    multiplayerEvents.emit("heartbeat", message);
}

function scheduleReconnect() {
    if (multiplayerState.reconnectTimer || !multiplayerState.roomId) return;

    if (multiplayerState.reconnectAttempts >= MULTIPLAYER_CONFIG.maxReconnectAttempts) {
        multiplayerState.connectionStatus = "failed";
        multiplayerEvents.emit("reconnectFailed", { attempts: multiplayerState.reconnectAttempts });
        multiplayerToast("اتصال به بازی برقرار نشد. دوباره تلاش کنید.", "❌", 5000);
        return;
    }

    multiplayerState.reconnecting = true;
    multiplayerState.connectionStatus = "reconnecting";
    multiplayerState.reconnectAttempts++;

    const delay = MULTIPLAYER_CONFIG.reconnectDelay * Math.min(multiplayerState.reconnectAttempts, 5);
    multiplayerState.reconnectTimer = setTimeout(async () => {
        multiplayerState.reconnectTimer = null;
        if (multiplayerState.connected) return;

        multiplayerEvents.emit("reconnecting", { attempt: multiplayerState.reconnectAttempts });
        await connectToRoom(multiplayerState.roomId, { reconnect: true });
    }, delay);
}

async function reconnectToRoom() {
    const roomId = multiplayerState.roomId;
    if (!roomId) return { success: false, error: "NO_ROOM" };

    multiplayerState.reconnectAttempts = 0;
    if (multiplayerState.reconnectTimer) {
        clearTimeout(multiplayerState.reconnectTimer);
        multiplayerState.reconnectTimer = null;
    }

    return connectToRoom(roomId, { reconnect: true });
}

async function disconnectFromRoom(showMessage = true) {
    stopHeartbeat();
    if (multiplayerState.reconnectTimer) {
        clearTimeout(multiplayerState.reconnectTimer);
        multiplayerState.reconnectTimer = null;
    }

    const client = getMultiplayerSupabaseClient();
    const channel = multiplayerState.channel;

    if (channel) {
        try { await channel.untrack(); } catch (e) {}
        if (client) {
            try { await client.removeChannel(channel); } catch (e) {}
        }
    }

    const oldRoomId = multiplayerState.roomId;
    multiplayerState.channel = null;
    multiplayerState.channelName = null;
    multiplayerState.roomId = null;
    multiplayerState.connected = false;
    multiplayerState.connecting = false;
    multiplayerState.reconnecting = false;
    multiplayerState.connectionStatus = "disconnected";
    multiplayerState.players = [];
    multiplayerState.playerMap = {};
    multiplayerState.presence = {};
    multiplayerState.readyPlayers = {};
    multiplayerState.currentTurn = null;
    multiplayerState.gameStarted = false;
    multiplayerState.gameFinished = false;
    multiplayerState.gameStateVersion = 0;
    multiplayerState.lastGameState = null;
    multiplayerState.pendingActions = [];

    multiplayerEvents.emit("disconnected", { roomId: oldRoomId });
    multiplayerEvents.emit("connectionStateChanged", getMultiplayerPublicState());

    if (showMessage) {
        multiplayerToast("از بازی آنلاین خارج شدی.", "🔴");
    }

    return true;
}

async function leaveRoom() {
    if (multiplayerState.connected) {
        try {
            await sendMessage("player_left", {
                player: {
                    id: getMultiplayerUserId(),
                    name: getMultiplayerPlayerName()
                }
            }, { queue: false });
        } catch (e) {}
    }
    return disconnectFromRoom(true);
}

function cleanupReceivedMessages() {
    const expiration = now() - 60000;
    Object.keys(multiplayerState.receivedActions).forEach(key => {
        if (multiplayerState.receivedActions[key] < expiration) {
            delete multiplayerState.receivedActions[key];
        }
    });
}

/* ================================================================
   11. UI & PUBLIC API
================================================================ */

function getMultiplayerPublicState() {
    return {
        initialized: multiplayerState.initialized,
        connected: multiplayerState.connected,
        connecting: multiplayerState.connecting,
        reconnecting: multiplayerState.reconnecting,
        roomId: multiplayerState.roomId,
        channelName: multiplayerState.channelName,
        connectionStatus: multiplayerState.connectionStatus,
        reconnectAttempts: multiplayerState.reconnectAttempts,
        players: cloneData(multiplayerState.players),
        localPlayerId: multiplayerState.localPlayerId,
        localPlayerName: multiplayerState.localPlayerName,
        localPlayerSeat: multiplayerState.localPlayerSeat,
        isHost: isCurrentHost(),
        hostId: multiplayerState.hostId,
        readyPlayers: cloneData(multiplayerState.readyPlayers),
        currentTurn: multiplayerState.currentTurn,
        gameStarted: multiplayerState.gameStarted,
        gameFinished: multiplayerState.gameFinished,
        gameStateVersion: multiplayerState.gameStateVersion,
        lastConnectionAt: multiplayerState.lastConnectionAt,
        lastMessageAt: multiplayerState.lastMessageAt
    };
}

function updateRoomUI() {
    multiplayerEvents.emit("uiUpdate", getMultiplayerPublicState());
    if (typeof window.updateRoomPlayersUI === "function") {
        try { window.updateRoomPlayersUI(cloneData(multiplayerState.players)); } catch (e) {}
    }
    if (typeof window.updateOnlinePlayersUI === "function") {
        try { window.updateOnlinePlayersUI(cloneData(multiplayerState.players)); } catch (e) {}
    }
}

function updateGameUI() {
    multiplayerEvents.emit("gameUIUpdate", {
        currentTurn: multiplayerState.currentTurn,
        gameStarted: multiplayerState.gameStarted,
        gameFinished: multiplayerState.gameFinished,
        players: cloneData(multiplayerState.players)
    });

    if (typeof window.updateGameOnlineUI === "function") {
        try { window.updateGameOnlineUI(getMultiplayerPublicState()); } catch (e) {}
    }
}

function setupNetworkListeners() {
    window.addEventListener("online", async () => {
        multiplayerEvents.emit("networkOnline", null);
        if (multiplayerState.roomId && !multiplayerState.connected) {
            await reconnectToRoom();
        }
    });

    window.addEventListener("offline", () => {
        multiplayerState.connectionStatus = "offline";
        multiplayerEvents.emit("networkOffline", null);
        multiplayerToast("اتصال اینترنت قطع شد. در حال تلاش برای اتصال مجدد...", "📡", 4000);
    });
}

window.hokmMultiplayer = {
    initialize: initializeMultiplayer,
    connectToRoom,
    disconnectFromRoom,
    leaveRoom,
    reconnectToRoom,
    sendMessage,
    sendGameAction,
    sendGameState,
    startMultiplayerGame,
    finishMultiplayerGame,
    setCurrentTurn,
    setPlayerReady,
    setLocalPlayerSeat,
    sendChatMessage: sendMultiplayerChatMessage,
    requestRoomSync,
    sendRoomSync,
    getPlayer: (id) => multiplayerState.playerMap[id] || null,
    getPlayerBySeat: (seat) => multiplayerState.players.find(p => Number(p.seat) === Number(seat)) || null,
    getPlayersCount: () => multiplayerState.players.length,
    getOnlinePlayersCount: () => multiplayerState.players.filter(p => p.online !== false).length,
    isRoomFull: () => multiplayerState.players.length >= MULTIPLAYER_CONFIG.maxPlayersPerRoom,
    isMyTurn,
    canMakeMove: canMakeOnlineMove,
    canStartGame: () => isCurrentHost() && !multiplayerState.gameStarted && multiplayerState.players.length >= 2,
    isCurrentHost,
    updateHost,
    setMultiplayerRoomId: (id) => { multiplayerState.roomId = id ? safeString(id).trim() : null; },
    setMultiplayerHost: (id) => { multiplayerState.hostId = id || null; },
    getState: getMultiplayerPublicState,
    on: (evt, cb) => multiplayerEvents.on(evt, cb),
    onConnected: (cb) => multiplayerEvents.on("connected", cb),
    onDisconnected: (cb) => multiplayerEvents.on("disconnected", cb),
    onPlayersUpdated: (cb) => multiplayerEvents.on("playersUpdated", cb),
    onGameAction: (cb) => multiplayerEvents.on("gameAction", cb),
    onGameStateUpdated: (cb) => multiplayerEvents.on("gameStateUpdated", cb),
    onTurnChanged: (cb) => multiplayerEvents.on("turnChanged", cb),
    onChatMessage: (cb) => multiplayerEvents.on("chatMessage", cb)
};

window.connectToRoom = connectToRoom;
window.disconnectFromRoom = disconnectFromRoom;
window.leaveOnlineRoom = leaveRoom;
window.reconnectToRoom = reconnectToRoom;
window.sendMultiplayerMessage = sendMessage;
window.sendGameAction = sendGameAction;
window.sendGameState = sendGameState;
window.startMultiplayerGame = startMultiplayerGame;
window.finishMultiplayerGame = finishMultiplayerGame;
window.setMultiplayerTurn = setCurrentTurn;
window.setPlayerReady = setPlayerReady;
window.sendMultiplayerChatMessage = sendMultiplayerChatMessage;
window.isMyTurn = isMyTurn;
window.canMakeOnlineMove = canMakeOnlineMove;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        if (initializeMultiplayer()) setupNetworkListeners();
    });
} else {
    if (initializeMultiplayer()) setupNetworkListeners();
}
