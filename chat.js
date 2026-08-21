"use strict";

/*
 * ================================================================
 * HOKM ONLINE - chat.js (Cleaned & Fixed)
 * ================================================================
 */

const HOKM_CHAT_CONFIG = {
    maxMessageLength: 300,
    minMessageLength: 1,
    maxMessagesPerRoom: 200,
    localStoragePrefix: "hokm_chat_",
    roomStorageKey: "current_room",
    playerStorageKey: "hokm_player",
    muteStorageKey: "hokm_chat_muted",
    cooldownMilliseconds: 1200,
    realtimeEnabled: true,
    localFallbackEnabled: true,
    autoScroll: true,
    showSystemMessages: true,
    notificationEnabled: true
};

const chatState = {
    initialized: false,
    loading: false,
    connected: false,
    realtimeChannel: null,
    currentRoomId: null,
    currentUserId: null,
    currentPlayerName: "بازیکن",
    messages: [],
    messageCount: 0,
    muted: false,
    lastMessageTime: 0,
    initializedRooms: {},
    listeners: {},
    unreadCount: 0
};

function chatGetSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
        return window.supabase;
    }
    return null;
}

const chatEvents = {
    listeners: {},
    on(eventName, callback) {
        if (typeof callback !== "function") return;
        if (!this.listeners[eventName]) this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    },
    off(eventName, callback) {
        if (!this.listeners[eventName]) return;
        this.listeners[eventName] = this.listeners[eventName].filter(item => item !== callback);
    },
    emit(eventName, data) {
        const list = this.listeners[eventName] || [];
        list.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`خطا در Chat Event: ${eventName}`, error);
            }
        });
    }
};

function chatToast(message, icon = "💬", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function chatGetCurrentUser() {
    if (typeof window.getCurrentUser === "function") return window.getCurrentUser();
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentUser === "function") {
        return window.hokmAuth.getCurrentUser();
    }
    return null;
}

function chatGetCurrentProfile() {
    if (typeof window.getCurrentProfile === "function") return window.getCurrentProfile();
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentProfile === "function") {
        return window.hokmAuth.getCurrentProfile();
    }
    return null;
}

function chatGetPlayerName() {
    const profile = chatGetCurrentProfile();
    if (profile) return profile.display_name || profile.username || "بازیکن";

    const user = chatGetCurrentUser();
    if (user) {
        return (
            user.user_metadata?.display_name ||
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "بازیکن"
        );
    }

    if (window.state && window.state.player) {
        return window.state.player.name || "بازیکن";
    }

    try {
        const stored = localStorage.getItem(HOKM_CHAT_CONFIG.playerStorageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.name) return parsed.name;
        }
    } catch (error) {
        console.warn("خطا در خواندن نام بازیکن:", error);
    }

    return "بازیکن";
}

function chatGetUserId() {
    const user = chatGetCurrentUser();
    if (user && user.id) return user.id;

    if (window.state && window.state.player && window.state.player.id) {
        return window.state.player.id;
    }
    return null;
}

function normalizeRoomId(roomId) {
    if (roomId === null || roomId === undefined) return null;
    const value = String(roomId).trim();
    return value.length > 0 ? value : null;
}

function chatGetCurrentRoomId() {
    if (chatState.currentRoomId) return chatState.currentRoomId;

    if (window.hokmRoom && typeof window.hokmRoom.getCurrentRoom === "function") {
        const room = window.hokmRoom.getCurrentRoom();
        if (room) return normalizeRoomId(room.id || room.room_id || room.code);
    }

    if (window.state && window.state.room) {
        return normalizeRoomId(window.state.room.id || window.state.room.roomId || window.state.room.code);
    }

    try {
        const stored = localStorage.getItem(HOKM_CHAT_CONFIG.roomStorageKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return normalizeRoomId(parsed.id || parsed.room_id || parsed.code);
            } catch {
                return normalizeRoomId(stored);
            }
        }
    } catch (error) {
        console.warn("خطا در دریافت Room ID:", error);
    }
    return null;
}

function chatSanitizeText(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/\u0000/g, "")
        .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .trim()
        .slice(0, HOKM_CHAT_CONFIG.maxMessageLength);
}

function chatEscapeHTML(text) {
    const value = String(text || "");
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function chatFormatMessage(message) {
    if (!message) return null;

    const normalized = {
        id: message.id || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        room_id: normalizeRoomId(message.room_id || message.roomId || chatState.currentRoomId),
        user_id: message.user_id || message.userId || null,
        username: chatSanitizeText(message.username || message.display_name || message.displayName || "بازیکن").slice(0, 30),
        message: chatSanitizeText(message.message || message.text || ""),
        type: message.type || "user",
        created_at: message.created_at || message.createdAt || new Date().toISOString(),
        local: message.local === true,
        pending: message.pending === true
    };

    if (!normalized.message) return null;
    return normalized;
}

function chatFormatTime(date) {
    const parsedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "";

    try {
        return parsedDate.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return parsedDate.toLocaleTimeString().slice(0, 5);
    }
}

function chatStorageKey(roomId) {
    return HOKM_CHAT_CONFIG.localStoragePrefix + encodeURIComponent(normalizeRoomId(roomId) || "unknown");
}

function chatSaveLocalMessages(roomId, messages = chatState.messages) {
    if (!HOKM_CHAT_CONFIG.localFallbackEnabled) return;
    const id = normalizeRoomId(roomId);
    if (!id) return;

    try {
        const cleanMessages = messages
            .slice(-HOKM_CHAT_CONFIG.maxMessagesPerRoom)
            .map(m => ({
                id: m.id,
                room_id: m.room_id,
                user_id: m.user_id,
                username: m.username,
                message: m.message,
                type: m.type,
                created_at: m.created_at,
                local: true
            }));
        localStorage.setItem(chatStorageKey(id), JSON.stringify(cleanMessages));
    } catch (error) {
        console.warn("ذخیره پیام‌ها در LocalStorage ناموفق بود:", error);
    }
}

function chatLoadLocalMessages(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return [];

    try {
        const raw = localStorage.getItem(chatStorageKey(id));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(chatFormatMessage).filter(Boolean);
    } catch (error) {
        console.warn("خطا در بازیابی پیام‌های محلی:", error);
        return [];
    }
}

function clearChatCache(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return false;
    try {
        localStorage.removeItem(chatStorageKey(id));
        return true;
    } catch {
        return false;
    }
}

async function setChatRoom(roomId, options = {}) {
    const id = normalizeRoomId(roomId);
    if (!id) return false;
    if (chatState.currentRoomId === id && !options.force) return true;

    await disconnectChatRealtime();
    chatState.currentRoomId = id;

    try {
        localStorage.setItem(HOKM_CHAT_CONFIG.roomStorageKey, id);
    } catch (error) {
        console.warn("ذخیره Room ID انجام نشد:", error);
    }

    chatState.messages = chatLoadLocalMessages(id);
    chatState.messageCount = chatState.messages.length;
    renderChat();

    await loadRoomMessages(id);

    if (HOKM_CHAT_CONFIG.realtimeEnabled) {
        await connectChatRealtime(id);
    }

    chatEvents.emit("roomChanged", { roomId: id });
    return true;
}

async function loadRoomMessages(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return [];

    const client = chatGetSupabaseClient();
    if (!client) return chatState.messages;

    chatState.loading = true;
    try {
        const { data, error } = await client
            .from("chat_messages")
            .select("*")
            .eq("room_id", id)
            .order("created_at", { ascending: true })
            .limit(HOKM_CHAT_CONFIG.maxMessagesPerRoom);

        if (error) {
            console.warn("دریافت پیام‌های آنلاین انجام نشد، استفاده از Cache:", error);
            chatState.loading = false;
            return chatState.messages;
        }

        const serverMessages = (data || []).map(chatFormatMessage).filter(Boolean);
        if (serverMessages.length > 0) {
            chatState.messages = serverMessages;
            chatState.messageCount = serverMessages.length;
            chatSaveLocalMessages(id, serverMessages);
        }

        renderChat();
        chatEvents.emit("messagesLoaded", chatState.messages);
        chatState.loading = false;
        return chatState.messages;
    } catch (error) {
        chatState.loading = false;
        console.error("خطا در loadRoomMessages:", error);
        return chatState.messages;
    }
}

function addMessageToState(message, options = {}) {
    const normalized = chatFormatMessage(message);
    if (!normalized) return null;

    const duplicate = chatState.messages.some(existing => {
        if (existing.id && normalized.id && existing.id === normalized.id) return true;
        return (
            existing.user_id === normalized.user_id &&
            existing.message === normalized.message &&
            existing.created_at === normalized.created_at
        );
    });

    if (duplicate) return null;

    chatState.messages.push(normalized);
    if (chatState.messages.length > HOKM_CHAT_CONFIG.maxMessagesPerRoom) {
        chatState.messages = chatState.messages.slice(-HOKM_CHAT_CONFIG.maxMessagesPerRoom);
    }

    chatState.messageCount = chatState.messages.length;
    chatSaveLocalMessages(chatState.currentRoomId);

    if (!options.silent) renderChat();
    chatEvents.emit("messageAdded", normalized);
    return normalized;
}

async function sendChatMessage(text, options = {}) {
    const message = chatSanitizeText(text);
    if (!message) return { success: false, error: "EMPTY_MESSAGE" };
    if (message.length < HOKM_CHAT_CONFIG.minMessageLength) return { success: false, error: "MESSAGE_TOO_SHORT" };
    if (message.length > HOKM_CHAT_CONFIG.maxMessageLength) {
        chatToast(`پیام نمی‌تواند بیشتر از ${HOKM_CHAT_CONFIG.maxMessageLength} کاراکتر باشد.`, "⚠️");
        return { success: false, error: "MESSAGE_TOO_LONG" };
    }

    const now = Date.now();
    if (!options.skipCooldown && (now - chatState.lastMessageTime < HOKM_CHAT_CONFIG.cooldownMilliseconds)) {
        return { success: false, error: "COOLDOWN" };
    }

    if (chatState.muted) {
        chatToast("چت برای شما بی‌صدا شده است.", "🔇");
        return { success: false, error: "CHAT_MUTED" };
    }

    const roomId = normalizeRoomId(options.roomId || chatState.currentRoomId || chatGetCurrentRoomId());
    if (!roomId) {
        chatToast("ابتدا وارد یک اتاق بازی شوید.", "⚠️");
        return { success: false, error: "ROOM_REQUIRED" };
    }

    const userId = chatGetUserId();
    const username = chatGetPlayerName();
    const type = options.type || "user";

    const temporaryMessage = {
        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        room_id: roomId,
        user_id: userId,
        username: username,
        message: message,
        type: type,
        created_at: new Date().toISOString(),
        local: true,
        pending: true
    };

    addMessageToState(temporaryMessage);
    chatState.lastMessageTime = now;

    const client = chatGetSupabaseClient();
    if (!client) {
        temporaryMessage.pending = false;
        chatEvents.emit("messageSent", temporaryMessage);
        return { success: true, local: true, message: temporaryMessage };
    }

    try {
        const { data, error } = await client
            .from("chat_messages")
            .insert({ room_id: roomId, user_id: userId, username: username, message: message, type: type })
            .select()
            .single();

        if (error) {
            console.warn("ارسال پیام به دیتابیس ناموفق بود، پیام محلی ذخیره شد:", error);
            temporaryMessage.pending = false;
            temporaryMessage.local = true;
            renderChat();
            chatEvents.emit("messageSent", temporaryMessage);
            return { success: true, local: true, fallback: true, message: temporaryMessage };
        }

        chatState.messages = chatState.messages.filter(item => item.id !== temporaryMessage.id);
        const serverMessage = chatFormatMessage(data);
        if (serverMessage) addMessageToState(serverMessage);

        chatEvents.emit("messageSent", serverMessage);
        return { success: true, local: false, message: serverMessage };
    } catch (error) {
        console.error("خطا در sendChatMessage:", error);
        temporaryMessage.pending = false;
        temporaryMessage.local = true;
        renderChat();
        return { success: true, local: true, fallback: true, message: temporaryMessage };
    }
}

async function sendSystemChatMessage(text, options = {}) {
    return await sendChatMessage(text, { ...options, type: "system", skipCooldown: true });
}

function removeMessage(messageId) {
    if (!messageId) return false;
    const before = chatState.messages.length;
    chatState.messages = chatState.messages.filter(m => m.id !== messageId);
    if (before === chatState.messages.length) return false;

    chatState.messageCount = chatState.messages.length;
    chatSaveLocalMessages(chatState.currentRoomId);
    renderChat();
    chatEvents.emit("messageRemoved", messageId);
    return true;
}

async function clearRoomChat(roomId = null) {
    const id = normalizeRoomId(roomId || chatState.currentRoomId);
    if (!id) return false;

    chatState.messages = [];
    chatState.messageCount = 0;
    clearChatCache(id);
    renderChat();
    chatEvents.emit("chatCleared", { roomId: id });
    return true;
}

async function connectChatRealtime(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return false;

    const client = chatGetSupabaseClient();
    if (!client || !HOKM_CHAT_CONFIG.realtimeEnabled) {
        chatState.connected = false;
        return false;
    }

    await disconnectChatRealtime();

    try {
        const channelName = `hokm-chat-${id}`;
        const channel = client.channel(channelName);

        channel.on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${id}` },
            payload => {
                if (!payload?.new) return;
                const incoming = chatFormatMessage(payload.new);
                if (!incoming) return;

                addMessageToState(incoming);
                const currentUserId = chatGetUserId();

                if (incoming.user_id && incoming.user_id !== currentUserId) {
                    chatState.unreadCount++;
                    updateChatUnreadUI();
                    if (!chatState.muted && HOKM_CHAT_CONFIG.notificationEnabled) {
                        notifyNewChatMessage(incoming);
                    }
                }
                chatEvents.emit("realtimeMessage", incoming);
            }
        );

        const subscription = await channel.subscribe(status => {
            if (status === "SUBSCRIBED") {
                chatState.connected = true;
                chatEvents.emit("connected", { roomId: id });
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                chatState.connected = false;
            }
        });

        chatState.realtimeChannel = channel;
        return subscription;
    } catch (error) {
        console.error("خطا در اتصال Realtime:", error);
        chatState.connected = false;
        return false;
    }
}

async function disconnectChatRealtime() {
    const client = chatGetSupabaseClient();
    if (!client || !chatState.realtimeChannel) {
        chatState.realtimeChannel = null;
        chatState.connected = false;
        return;
    }

    try {
        await client.removeChannel(chatState.realtimeChannel);
    } catch (error) {
        console.warn("قطع Realtime ناموفق بود:", error);
    }

    chatState.realtimeChannel = null;
    chatState.connected = false;
    chatEvents.emit("disconnected");
}

function notifyNewChatMessage(message) {
    if (typeof window.showToast === "function") {
        window.showToast(`${message.username}: ${message.message}`, "💬", 2500);
    }
    chatEvents.emit("notification", message);
}

function setChatMuted(muted) {
    chatState.muted = muted === true;
    try {
        localStorage.setItem(HOKM_CHAT_CONFIG.muteStorageKey, chatState.muted ? "1" : "0");
    } catch (error) {
        console.warn("ذخیره Mute انجام نشد:", error);
    }
    updateChatMuteUI();
    chatEvents.emit("muteChanged", chatState.muted);
    return chatState.muted;
}

function toggleChatMute() {
    return setChatMuted(!chatState.muted);
}

function loadChatMuteState() {
    try {
        const muted = localStorage.getItem(HOKM_CHAT_CONFIG.muteStorageKey);
        chatState.muted = muted === "1";
    } catch {
        chatState.muted = false;
    }
    updateChatMuteUI();
}

function updateChatMuteUI() {
    const buttons = document.querySelectorAll("[data-chat-mute]");
    buttons.forEach(button => {
        button.setAttribute("aria-pressed", chatState.muted ? "true" : "false");
        button.textContent = chatState.muted ? "🔇" : "🔊";
        button.title = chatState.muted ? "فعال کردن صدای چت" : "بی‌صدا کردن چت";
    });
}

function updateChatUnreadUI() {
    const elements = document.querySelectorAll("[data-chat-unread]");
    elements.forEach(element => {
        const count = chatState.unreadCount;
        element.textContent = count > 99 ? "99+" : String(count);
        element.style.display = count > 0 ? "" : "none";
    });
}

function markChatAsRead() {
    chatState.unreadCount = 0;
    updateChatUnreadUI();
    chatEvents.emit("read");
}

function createMessageHTML(message) {
    const currentUserId = chatGetUserId();
    const isMine = !!currentUserId && message.user_id === currentUserId;
    const isSystem = message.type === "system";

    const classNames = [
        "hokm-chat-message",
        isMine ? "is-mine" : "is-other",
        isSystem ? "is-system" : "",
        message.pending ? "is-pending" : ""
    ].filter(Boolean).join(" ");

    const username = chatEscapeHTML(message.username || "بازیکن");
    const text = chatEscapeHTML(message.message);
    const time = chatFormatTime(message.created_at);

    return `
        <div class="${classNames}" data-chat-message-id="${chatEscapeHTML(message.id)}">
            <div class="hokm-chat-message-header">
                <span class="hokm-chat-message-user">${username}</span>
                <span class="hokm-chat-message-time">${chatEscapeHTML(time)}</span>
            </div>
            <div class="hokm-chat-message-body">${text}</div>
            ${message.pending ? `<div class="hokm-chat-message-status">در حال ارسال...</div>` : ""}
        </div>
    `;
}

function findChatContainer() {
    const selectors = ["[data-chat-messages]", "#chatMessages", "#chat-messages", ".chat-messages", ".hokm-chat-messages"];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    return null;
}

function renderChat() {
    const container = findChatContainer();
    if (!container) return;

    if (chatState.messages.length === 0) {
        container.innerHTML = `
            <div class="hokm-chat-empty">
                <div class="hokm-chat-empty-icon">💬</div>
                <div class="hokm-chat-empty-title">هنوز پیامی ارسال نشده</div>
                <div class="hokm-chat-empty-text">اولین پیام را شما بفرستید!</div>
            </div>
        `;
        return;
    }

    container.innerHTML = chatState.messages.map(createMessageHTML).join("");
    if (HOKM_CHAT_CONFIG.autoScroll) {
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    }
}

function updateChatMessageCountUI() {
    const elements = document.querySelectorAll("[data-chat-count]");
    elements.forEach(element => {
        element.textContent = Number(chatState.messageCount).toLocaleString("fa-IR");
    });
}

function findChatInput() {
    const selectors = ["[data-chat-input]", "#chatInput", "#chat-input", ".chat-input", ".hokm-chat-input"];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    return null;
}

function findChatSendButton() {
    const selectors = ["[data-chat-send]", "#chatSend", "#chat-send", ".chat-send", ".hokm-chat-send"];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    return null;
}

async function sendMessageFromUI() {
    const input = findChatInput();
    if (!input) return;
    const value = input.value;
    if (!value.trim()) return;

    const result = await sendChatMessage(value);
    if (result.success) {
        input.value = "";
        input.focus();
    }
}

function handleChatInputKeydown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    sendMessageFromUI();
}

function bindChatUI() {
    const input = findChatInput();
    if (input) {
        input.removeEventListener("keydown", handleChatInputKeydown);
        input.addEventListener("keydown", handleChatInputKeydown);
    }

    const sendButton = findChatSendButton();
    if (sendButton) sendButton.onclick = sendMessageFromUI;

    document.querySelectorAll("[data-chat-mute]").forEach(b => { b.onclick = toggleChatMute; });
    document.querySelectorAll("[data-chat-read]").forEach(b => { b.onclick = markChatAsRead; });

    updateChatMuteUI();
    updateChatUnreadUI();
    updateChatMessageCountUI();
    renderChat();
}

function insertChatEmoji(emoji) {
    const input = findChatInput();
    if (!input) return false;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
    const cursor = start + emoji.length;
    input.focus();

    try {
        input.setSelectionRange(cursor, cursor);
    } catch (error) {
        console.warn("تنظیم Cursor انجام نشد:", error);
    }
    return true;
}

function toggleChatEmojiPanel() {
    const panel = document.querySelector("[data-chat-emoji-panel]");
    if (!panel) return false;

    const isHidden = panel.style.display === "none";
    panel.style.display = isHidden ? "" : "none";

    if (isHidden) {
        panel.querySelectorAll("[data-chat-emoji]").forEach(btn => {
            btn.onclick = () => insertChatEmoji(btn.dataset.chatEmoji || btn.textContent || "");
        });
    }
    return isHidden;
}

function detectAndSetCurrentRoom() {
    const roomId = chatGetCurrentRoomId();
    if (roomId) setChatRoom(roomId);
}

function bindAuthEvents() {
    if (window.hokmAuth && typeof window.hokmAuth.onSignIn === "function") {
        window.hokmAuth.onSignIn(() => {
            chatState.currentUserId = chatGetUserId();
            chatState.currentPlayerName = chatGetPlayerName();
            renderChat();
        });
    }
    if (window.hokmAuth && typeof window.hokmAuth.onSignOut === "function") {
        window.hokmAuth.onSignOut(async () => {
            chatState.currentUserId = null;
            chatState.currentPlayerName = "بازیکن";
            await disconnectChatRealtime();
        });
    }
    if (window.hokmAuth && typeof window.hokmAuth.onProfileUpdated === "function") {
        window.hokmAuth.onProfileUpdated(() => {
            chatState.currentPlayerName = chatGetPlayerName();
        });
    }
}

function bindRoomEvents() {
    if (window.hokmRoom) {
        if (typeof window.hokmRoom.onRoomChanged === "function") {
            window.hokmRoom.onRoomChanged(room => {
                const roomId = normalizeRoomId(room?.id || room?.room_id || room?.code);
                if (roomId) setChatRoom(roomId);
            });
        }
        if (typeof window.hokmRoom.onLeaveRoom === "function") {
            window.hokmRoom.onLeaveRoom(async () => {
                await disconnectChatRealtime();
                chatState.currentRoomId = null;
            });
        }
    }
}

function bindGameEvents() {
    document.addEventListener("hokm:room-changed", event => {
        const roomId = normalizeRoomId(event.detail?.roomId || event.detail?.id || event.detail?.code);
        if (roomId) setChatRoom(roomId);
    });

    document.addEventListener("hokm:room-left", async () => {
        await disconnectChatRealtime();
        chatState.currentRoomId = null;
    });

    document.addEventListener("hokm:game-finished", event => {
        if (!HOKM_CHAT_CONFIG.showSystemMessages) return;
        const winner = event.detail?.winnerName;
        if (winner) sendSystemChatMessage(`🏆 ${winner} برنده بازی شد!`, { skipCooldown: true });
    });
}

function createChatContainerIfNeeded() {
    const existing = findChatContainer();
    if (existing) return existing;

    const possibleParent = document.querySelector("[data-chat]");
    if (!possibleParent) return null;

    const container = document.createElement("div");
    container.className = "hokm-chat-messages";
    container.dataset.chatMessages = "";
    possibleParent.appendChild(container);
    return container;
}

function openChat() {
    const chat = document.querySelector("[data-chat]");
    if (!chat) return false;
    chat.classList.add("is-open");
    chat.style.display = "";
    markChatAsRead();
    chatEvents.emit("opened");
    return true;
}

function closeChat() {
    const chat = document.querySelector("[data-chat]");
    if (!chat) return false;
    chat.classList.remove("is-open");
    chatEvents.emit("closed");
    return true;
}

function toggleChat() {
    const chat = document.querySelector("[data-chat]");
    if (!chat) return false;
    return chat.classList.contains("is-open") ? closeChat() : openChat();
}

function getChatMessages() { return [...chatState.messages]; }
function getChatRoomId() { return chatState.currentRoomId; }
function getChatUnreadCount() { return chatState.unreadCount; }
function isChatConnected() { return chatState.connected === true; }
function isChatMuted() { return chatState.muted === true; }

function addLocalChatMessage(message) {
    const roomId = chatState.currentRoomId;
    const formatted = chatFormatMessage({ ...message, room_id: message.room_id || roomId, local: true });
    if (!formatted) return null;
    return addMessageToState(formatted);
}

async function initializeChat() {
    if (chatState.initialized) return true;
    try {
        chatState.loading = true;
        chatState.currentUserId = chatGetUserId();
        chatState.currentPlayerName = chatGetPlayerName();
        loadChatMuteState();
        createChatContainerIfNeeded();
        bindChatUI();
        bindAuthEvents();
        bindRoomEvents();
        bindGameEvents();
        detectAndSetCurrentRoom();

        chatState.initialized = true;
        chatState.loading = false;
        chatEvents.emit("initialized", {
            roomId: chatState.currentRoomId,
            userId: chatState.currentUserId,
            playerName: chatState.currentPlayerName
        });
        console.log("Hokm Online Chat initialized successfully.");
        return true;
    } catch (error) {
        chatState.loading = false;
        console.error("خطا در initializeChat:", error);
        return false;
    }
}

function waitForChat() {
    return new Promise(resolve => {
        if (chatState.initialized) {
            resolve(chatState);
            return;
        }
        chatEvents.on("initialized", () => resolve(chatState));
    });
}

function onChatMessage(cb) { chatEvents.on("messageAdded", cb); }
function onChatMessageSent(cb) { chatEvents.on("messageSent", cb); }
function onChatRoomChanged(cb) { chatEvents.on("roomChanged", cb); }
function onChatConnected(cb) { chatEvents.on("connected", cb); }
function onChatDisconnected(cb) { chatEvents.on("disconnected", cb); }
function onChatOpened(cb) { chatEvents.on("opened", cb); }
function onChatClosed(cb) { chatEvents.on("closed", cb); }
function onChatMuteChanged(cb) { chatEvents.on("muteChanged", cb); }

window.hokmChat = {
    initialize: initializeChat,
    waitForChat,
    sendMessage: sendChatMessage,
    sendChatMessage,
    sendSystemMessage: sendSystemChatMessage,
    sendSystemChatMessage,
    setRoom: setChatRoom,
    setChatRoom,
    getRoomId: getChatRoomId,
    getMessages: getChatMessages,
    getUnreadCount: getChatUnreadCount,
    isConnected: isChatConnected,
    isMuted: isChatMuted,
    mute: setChatMuted,
    setMuted: setChatMuted,
    toggleMute: toggleChatMute,
    markAsRead: markChatAsRead,
    clear: clearRoomChat,
    clearRoomChat,
    removeMessage,
    addLocalMessage: addLocalChatMessage,
    open: openChat,
    close: closeChat,
    toggle: toggleChat,
    insertEmoji: insertChatEmoji,
    toggleEmojiPanel: toggleChatEmojiPanel,
    connectRealtime: connectChatRealtime,
    disconnectRealtime: disconnectChatRealtime,
    render: renderChat,
    onMessage: onChatMessage,
    onMessageSent: onChatMessageSent,
    onRoomChanged: onChatRoomChanged,
    onConnected: onChatConnected,
    onDisconnected: onChatDisconnected,
    onOpened: onChatOpened,
    onClosed: onChatClosed,
    onMuteChanged: onChatMuteChanged,
    state: chatState,
    config: HOKM_CHAT_CONFIG
};

window.sendChatMessage = sendChatMessage;
window.sendMessage = sendChatMessage;
window.openChat = openChat;
window.closeChat = closeChat;
window.toggleChat = toggleChat;
window.toggleChatMute = toggleChatMute;
window.markChatAsRead = markChatAsRead;
window.insertChatEmoji = insertChatEmoji;
window.getChatMessages = getChatMessages;
window.getChatRoomId = getChatRoomId;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initializeChat();
    });
} else {
    initializeChat();
}
