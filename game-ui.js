"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * game-ui.js
 *
 * FILE 11 / 12
 *
 * رابط کاربری کامل صفحه بازی حکم + سیستم تایمر نوبت و جایگزینی بات (Auto-Play)
 * ================================================================
 */

/* ================================================================
   1. GLOBAL GAME UI STATE
================================================================ */

const gameUIState = {
    initialized: false,
    visible: false,
    gameStarted: false,
    gameEnded: false,
    selectingTrump: false,
    selectedTrump: null,
    selectedCardIndex: null,
    currentTurn: null,
    turnStartedAt: null,
    turnDuration: 30,
    timerInterval: null,
    reconnectInterval: null,
    animationQueue: [],
    renderedCards: [],
    playedCards: [],
    players: [],
    lastState: null,
    lastScore: null,
    lastWinner: null,
    settingsOpen: false,
    chatOpen: false,
    playersPanelOpen: false,
    leavePanelOpen: false,
    resultPanelOpen: false,
    soundEnabled: true,
    vibrationEnabled: true,
    animationsEnabled: true,
    compactMode: false,
    connected: true,
    connectionText: "متصل",
    initializedEvents: false
};

/* ================================================================
   2. CONSTANTS
================================================================ */

const GAME_UI_CONSTANTS = {
    suits: {
        spades: "♠",
        hearts: "♥",
        diamonds: "♦",
        clubs: "♣"
    },
    suitNames: {
        spades: "پیک",
        hearts: "دل",
        diamonds: "خشت",
        clubs: "گشنیز"
    },
    suitClasses: {
        spades: "suit-spades",
        hearts: "suit-hearts",
        diamonds: "suit-diamonds",
        clubs: "suit-clubs"
    },
    cardRanks: {
        A: "A",
        K: "K",
        Q: "Q",
        J: "J",
        10: "10",
        9: "9",
        8: "8",
        7: "7",
        6: "6",
        5: "5",
        4: "4",
        3: "3",
        2: "2"
    },
    defaultTurnDuration: 30
};

/* ================================================================
   3. DOM HELPERS
================================================================ */

function gameUIQuery(selector) {
    try {
        return document.querySelector(selector);
    } catch (error) {
        console.error("gameUIQuery error:", error);
        return null;
    }
}

function gameUIQueryAll(selector) {
    try {
        return Array.from(document.querySelectorAll(selector));
    } catch (error) {
        console.error("gameUIQueryAll error:", error);
        return [];
    }
}

function createGameUIElement(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== "") element.textContent = text;
    return element;
}

function escapeGameUIHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ================================================================
   4. TOAST & FEEDBACK
================================================================ */

function gameUIToast(message, icon = "ℹ️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function gameUILoading(show, message = "لطفاً صبر کنید...") {
    if (show && typeof window.showLoading === "function") {
        window.showLoading(message);
        return;
    }
    if (!show && typeof window.hideLoading === "function") {
        window.hideLoading();
    }
}

function gameUIVibrate(pattern = 20) {
    if (!gameUIState.vibrationEnabled) return;
    try {
        if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (error) {
        console.warn("Vibration unavailable:", error);
    }
}

function gameUIPlaySound(type) {
    if (!gameUIState.soundEnabled) return;
    try {
        if (typeof window.playGameSound === "function") {
            window.playGameSound(type);
            return;
        }
        if (typeof window.playSound === "function") {
            window.playSound(type);
        }
    } catch (error) {
        console.warn("Game sound error:", error);
    }
}

/* ================================================================
   5. GET STATE & PLAYERS
================================================================ */

function getGameUIStateSource() {
    return window.gameState || window.state || window.hokmGameState || null;
}

function getGameUIPlayer() {
    const s = getGameUIStateSource();
    if (s?.player) return s.player;
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentProfile === "function") {
        return window.hokmAuth.getCurrentProfile() || null;
    }
    return null;
}

function getGameUICurrentPlayerId() {
    const player = getGameUIPlayer();
    return (
        player?.id ||
        player?.user_id ||
        player?.uid ||
        window.hokmAuth?.getCurrentUser?.()?.id ||
        null
    );
}

function normalizeGameUIPlayer(player, index = 0) {
    if (!player) {
        return {
            id: `player-${index}`,
            name: "بازیکن",
            avatar: null,
            seat: index,
            team: index % 2,
            score: 0,
            tricks: 0,
            connected: true,
            isBot: false
        };
    }

    return {
        id: player.id || player.user_id || player.uid || `player-${index}`,
        name: player.name || player.username || player.display_name || player.displayName || `بازیکن ${index + 1}`,
        avatar: player.avatar_url || player.avatar || player.photoURL || null,
        seat: Number(player.seat ?? player.position ?? index),
        team: Number(player.team ?? index % 2),
        score: Number(player.score ?? player.points ?? 0),
        tricks: Number(player.tricks ?? player.trickCount ?? 0),
        connected: player.connected !== false,
        isBot: player.isBot === true || player.bot === true,
        isDealer: player.isDealer === true,
        isHokm: player.isHokm === true,
        isCurrentTurn: player.isCurrentTurn === true
    };
}

function getGameUIPlayers(state = null) {
    const source = state || getGameUIStateSource();
    let players = [];
    if (Array.isArray(source?.players)) players = source.players;
    else if (Array.isArray(source?.room?.players)) players = source.room.players;
    else if (Array.isArray(window.roomState?.players)) players = window.roomState.players;

    return players.map((p, i) => normalizeGameUIPlayer(p, i));
}

function getGameUICurrentTurn(state = null) {
    const s = state || getGameUIStateSource();
    return s?.currentTurn || s?.turnPlayerId || s?.currentPlayerId || s?.turn || null;
}

function getGameUITrump(state = null) {
    const s = state || getGameUIStateSource();
    return s?.trump || s?.hokm || s?.trumpSuit || null;
}

function getGameUIHand(state = null) {
    const s = state || getGameUIStateSource();
    const player = getGameUIPlayer();
    if (Array.isArray(s?.hand)) return s.hand;
    if (Array.isArray(player?.hand)) return player.hand;
    if (Array.isArray(s?.player?.hand)) return s.player.hand;
    if (s?.game?.hands && player?.id && s.game.hands[player.id]) return s.game.hands[player.id];
    return [];
}

/* ================================================================
   6. CARD HELPERS & NORMALIZATION
================================================================ */

function normalizeGameUISuit(suit) {
    if (!suit) return null;
    const value = String(suit).trim().toLowerCase();
    const map = {
        "♠": "spades", "spade": "spades", "spades": "spades", "پیک": "spades",
        "♥": "hearts", "heart": "hearts", "hearts": "hearts", "دل": "hearts",
        "♦": "diamonds", "diamond": "diamonds", "diamonds": "diamonds", "خشت": "diamonds",
        "♣": "clubs", "club": "clubs", "clubs": "clubs", "گشنیز": "clubs"
    };
    return map[value] || value;
}

function normalizeGameUICard(card) {
    if (!card) return null;
    if (typeof card === "string") {
        const parts = card.split("-");
        if (parts.length >= 2) {
            return {
                suit: normalizeGameUISuit(parts[0]),
                rank: parts[1],
                id: card
            };
        }
        return { suit: null, rank: card, id: card };
    }
    return {
        suit: normalizeGameUISuit(card.suit || card.color || card.symbol),
        rank: String(card.rank || card.value || card.number || card.label || ""),
        id: card.id || `${card.suit}-${card.rank}`,
        playable: card.playable !== false,
        disabled: card.disabled === true
    };
}

function getGameUISuitSymbol(suit) {
    const norm = normalizeGameUISuit(suit);
    return GAME_UI_CONSTANTS.suits[norm] || "";
}

function getGameUISuitName(suit) {
    const norm = normalizeGameUISuit(suit);
    return GAME_UI_CONSTANTS.suitNames[norm] || "نامشخص";
}

function getGameUICardColorClass(suit) {
    const norm = normalizeGameUISuit(suit);
    return (norm === "hearts" || norm === "
