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
    return (norm === "hearts" || norm === "diamonds") ? "card-red" : "card-black";
}

function createGameUICard(card, index, options = {}) {
    const norm = normalizeGameUICard(card);
    if (!norm) return null;

    const cardElement = createGameUIElement("button", "playing-card game-card");
    cardElement.type = "button";
    cardElement.dataset.cardIndex = String(index);
    cardElement.dataset.cardId = norm.id || "";
    cardElement.dataset.suit = norm.suit || "";
    cardElement.dataset.rank = norm.rank || "";

    const playable = options.playable !== undefined ? options.playable : (norm.playable !== false && norm.disabled !== true);
    if (!playable) {
        cardElement.classList.add("card-disabled", "disabled");
        cardElement.disabled = true;
    } else {
        cardElement.classList.add("playable");
    }

    cardElement.classList.add(getGameUICardColorClass(norm.suit));
    if (norm.suit) cardElement.classList.add(`suit-${norm.suit}`);
    if (options.selected) cardElement.classList.add("card-selected");

    const top = createGameUIElement("span", "card-corner top-corner");
    top.appendChild(createGameUIElement("strong", "card-rank", norm.rank));
    top.appendChild(createGameUIElement("span", "card-suit", getGameUISuitSymbol(norm.suit)));

    const center = createGameUIElement("span", "card-center-symbol", getGameUISuitSymbol(norm.suit));

    const bottom = createGameUIElement("span", "card-corner bottom-corner");
    bottom.appendChild(createGameUIElement("strong", "card-rank", norm.rank));
    bottom.appendChild(createGameUIElement("span", "card-suit", getGameUISuitSymbol(norm.suit)));

    cardElement.appendChild(top);
    cardElement.appendChild(center);
    cardElement.appendChild(bottom);

    if (options.onClick) {
        cardElement.addEventListener("click", options.onClick);
    } else {
        cardElement.addEventListener("click", () => handleGameUICardClick(norm, index));
    }

    return cardElement;
}

/* ================================================================
   7. HAND RENDERING & PLAY LOGIC
================================================================ */

function isCardPlayableForUI(card, state = null) {
    const source = state || getGameUIStateSource();
    if (!card) return false;

    if (typeof source?.canPlayCard === "function") {
        try { return !!source.canPlayCard(card); } catch (e) {}
    }
    if (typeof window.canPlayCard === "function") {
        try { return !!window.canPlayCard(card); } catch (e) {}
    }

    const leadSuit = source?.game?.leadSuit || source?.leadSuit || source?.currentSuit || null;
    const hand = getGameUIHand(source);

    if (leadSuit && Array.isArray(hand)) {
        const hasLead = hand.some(item => normalizeGameUISuit(item.suit) === normalizeGameUISuit(leadSuit));
        if (hasLead && normalizeGameUISuit(card.suit) !== normalizeGameUISuit(leadSuit)) return false;
    }
    return true;
}

function renderGameUIHand(hand = null) {
    const container = gameUIQuery("#playerHand") || gameUIQuery("#handContainer") || gameUIQuery("#player-hand") || gameUIQuery("[data-game-player-hand]");
    if (!container) return;

    const cards = Array.isArray(hand) ? hand : getGameUIHand();
    container.innerHTML = "";
    gameUIState.renderedCards = cards;

    const state = getGameUIStateSource();
    const currentTurn = getGameUICurrentTurn(state);
    const currentPlayerId = getGameUICurrentPlayerId();

    const isLocalTurn = state?.game ? (state.game.currentTurn === 0) : (String(currentTurn) === String(currentPlayerId));

    cards.forEach((card, index) => {
        const norm = normalizeGameUICard(card);
        if (!norm) return;
        const playable = isLocalTurn ? isCardPlayableForUI(norm, state) : false;
        const el = createGameUICard(norm, index, {
            playable,
            selected: gameUIState.selectedCardIndex === index
        });
        if (el) container.appendChild(el);
    });

    container.classList.toggle("my-turn", !!isLocalTurn);
}

function handleGameUICardClick(card, index) {
    if (gameUIState.gameEnded) return;
    const state = getGameUIStateSource();
    const currentTurn = getGameUICurrentTurn(state);
    const currentPlayerId = getGameUICurrentPlayerId();

    const isLocalTurn = state?.game ? (state.game.currentTurn === 0) : (String(currentTurn) === String(currentPlayerId));

    if (!isLocalTurn) {
        gameUIToast("الان نوبت شما نیست.", "⏳");
        return;
    }

    if (!isCardPlayableForUI(card, state)) {
        gameUIToast("باید از خال بازی‌شده بیندازی.", "⚠️");
        gameUIVibrate([20, 30, 20]);
        return;
    }

    gameUIState.selectedCardIndex = index;
    gameUIPlaySound("card-select");
    gameUIVibrate(15);
    playGameUICard(card, index);
}

async function playGameUICard(card, index) {
    const norm = normalizeGameUICard(card);
    if (!norm) return false;

    try {
        let result = null;
        if (typeof window.playLocalCard === "function") {
            result = window.playLocalCard(norm.id);
        } else if (typeof window.playCard === "function") {
            result = await window.playCard(norm, index);
        } else if (typeof window.hokmGame?.playCard === "function") {
            result = await window.hokmGame.playCard(norm, index);
        } else if (typeof window.multiplayer?.sendGameAction === "function") {
            result = await window.multiplayer.sendGameAction("play_card", { card: norm, index });
        }

        if (result === false) return false;

        stopGameUITurnTimer();
        animatePlayedGameUICard(norm);
        gameUIState.selectedCardIndex = null;
        return true;
    } catch (error) {
        console.error("playGameUICard error:", error);
        return false;
    }
}

function getGameUIPlayedCardsContainer() {
    return gameUIQuery("#trickArea") || gameUIQuery("#playedCards") || gameUIQuery("#played-cards") || gameUIQuery("[data-game-played-cards]");
}

function renderGameUIPlayedCards(cards = null) {
    const container = getGameUIPlayedCardsContainer();
    if (!container) return;

    let played = cards;
    if (!Array.isArray(played)) {
        const state = getGameUIStateSource();
        played = state?.game?.trick || state?.playedCards || state?.currentTrick || [];
    }

    gameUIState.playedCards = played;

    const slots = {
        0: document.getElementById("trickSouth") || document.getElementById("playedCardBottom"),
        1: document.getElementById("trickWest") || document.getElementById("playedCardLeft"),
        2: document.getElementById("trickNorth") || document.getElementById("playedCardTop"),
        3: document.getElementById("trickEast") || document.getElementById("playedCardRight")
    };

    Object.values(slots).forEach(slot => { if (slot) slot.innerHTML = ""; });

    played.forEach((item, index) => {
        const card = normalizeGameUICard(item?.card || item);
        if (!card) return;

        const seat = item?.seat !== undefined ? item.seat : index;
        const targetSlot = slots[seat] || container;

        const el = createGameUICard(card, index, { playable: false });
        if (el) {
            el.classList.add("table-card");
            targetSlot.appendChild(el);
        }
    });
}

function animatePlayedGameUICard(card) {
    if (!gameUIState.animationsEnabled) return;
    const norm = normalizeGameUICard(card);
    if (!norm) return;
    gameUIPlaySound("card-play");
}

/* ================================================================
   8. TRUMP & TURN INDICATOR
================================================================ */

function renderGameUITrump(trump = null) {
    const value = trump || getGameUITrump();
    const elements = gameUIQueryAll("[data-game-trump], #trumpSuit");
    elements.forEach(element => {
        if (!value) {
            element.textContent = "-";
            element.removeAttribute("data-suit");
            return;
        }
        const norm = normalizeGameUISuit(value);
        element.textContent = getGameUISuitSymbol(norm);
        element.dataset.suit = norm;
        element.classList.add(`suit-${norm}`);
    });
}

function renderGameUITrumpSelector() {
    const container = gameUIQuery("#trumpScreen") || gameUIQuery("#trump-selector") || gameUIQuery("[data-trump-selector]");
    if (!container) return;

    const suits = ["hearts", "diamonds", "clubs", "spades"];
    suits.forEach(suit => {
        const btn = container.querySelector(`[data-suit="${suit}"]`);
        if (btn) {
            btn.onclick = () => selectGameUITrump(suit);
        }
    });
}

async function selectGameUITrump(suit) {
    const norm = normalizeGameUISuit(suit);
    if (!norm) return false;

    try {
        let res = null;
        if (typeof window.setTrumpSuit === "function") res = window.setTrumpSuit(norm);
        else if (typeof window.selectTrump === "function") res = await window.selectTrump(norm);

        if (res === false) return false;

        gameUIState.selectedTrump = norm;
        renderGameUITrump(norm);
        hideGameUITrumpSelector();
        gameUIPlaySound("trump");
        return true;
    } catch (e) {
        return false;
    }
}

function showGameUITrumpSelector() {
    gameUIState.selectingTrump = true;
    const c = gameUIQuery("#trumpScreen") || gameUIQuery("#trump-selector");
    if (c) { c.classList.remove("hidden"); c.classList.add("active-screen"); }
    renderGameUITrumpSelector();
}

function hideGameUITrumpSelector() {
    gameUIState.selectingTrump = false;
    const c = gameUIQuery("#trumpScreen") || gameUIQuery("#trump-selector");
    if (c) { c.classList.add("hidden"); c.classList.remove("active-screen"); }
}

/* ================================================================
   9. TURN TIMER & AUTO-PLAY (BOT FALLBACK)
================================================================ */

function renderGameUITurn(playerId = null) {
    const state = getGameUIStateSource();
    const currentTurn = playerId || getGameUICurrentTurn(state);
    gameUIState.currentTurn = currentTurn;

    const turnText = gameUIQuery("#gameTurnInfo") || gameUIQuery("#turnMessage") || gameUIQuery("[data-turn-indicator]");
    if (turnText) {
        const isMyTurn = state?.game ? (state.game.currentTurn === 0) : (String(currentTurn) === String(getGameUICurrentPlayerId()));
        turnText.textContent = isMyTurn ? "نوبت شماست!" : "در انتظار نوبت بازیکنان...";
    }

    startGameUITurnTimer(30);
}

function startGameUITurnTimer(seconds = 30) {
    stopGameUITurnTimer();
    let remaining = seconds;
    gameUIState.turnStartedAt = Date.now();
    updateGameUITurnTimer(remaining);

    gameUIState.timerInterval = setInterval(() => {
        remaining--;
        updateGameUITurnTimer(remaining);

        if (remaining <= 0) {
            stopGameUITurnTimer();
            handleTurnTimeoutFallback();
        }
    }, 1000);
}

function updateGameUITurnTimer(seconds) {
    const elements = gameUIQueryAll("[data-turn-timer]");
    elements.forEach(element => {
        element.textContent = Number(Math.max(0, seconds)).toLocaleString("fa-IR");
        element.classList.toggle("timer-danger", seconds <= 5);
    });
}

function stopGameUITurnTimer() {
    if (gameUIState.timerInterval) {
        clearInterval(gameUIState.timerInterval);
        gameUIState.timerInterval = null;
    }
}

/**
 * سیستم هوشمند جایگزینی بات در صورت اتمام تایمر ۳۰ ثانیه
 */
function handleTurnTimeoutFallback() {
    const state = getGameUIStateSource();
    if (!state || gameUIState.gameEnded) return;

    console.warn("تایمر نوبت به پایان رسید؛ سیستم حرکت خودکار فعال شد.");
    gameUIToast("پایان وقت نوبت؛ انتخاب خودکار کارت توسط سیستم...", "🤖", 2500);

    const hand = getGameUIHand(state);
    if (!Array.isArray(hand) || hand.length === 0) return;

    const playableCards = hand.filter(card => isCardPlayableForUI(normalizeGameUICard(card), state));
    const targetCard = (playableCards.length > 0) ? playableCards[0] : hand[0];

    if (targetCard) {
        const cardIndex = hand.findIndex(c => c.id === targetCard.id || (c.suit === targetCard.suit && c.rank === targetCard.rank));
        playGameUICard(targetCard, cardIndex >= 0 ? cardIndex : 0);
    }
}

/* ================================================================
   10. OVERALL UI RENDER & INIT
================================================================ */

function renderGameUI() {
    renderGameUIHand();
    renderGameUIPlayedCards();
    renderGameUITrump();
    renderGameUITurn();
}

function loadGameUISettings() {
    try {
        const raw = localStorage.getItem("hokm_online_settings_v1") || localStorage.getItem("hokm_game_settings");
        if (!raw) return;
        const settings = JSON.parse(raw);
        gameUIState.soundEnabled = settings.soundEnabled !== false;
        gameUIState.vibrationEnabled = settings.vibrationEnabled !== false;
        gameUIState.animationsEnabled = settings.animationsEnabled !== false;
    } catch (e) {}
}

function initializeGameUI() {
    loadGameUISettings();
    gameUIState.initialized = true;
    renderGameUI();
    console.log("Hokm Online Game UI with Bot Fallback initialized successfully.");
}

window.hokmGameUI = {
    initialize: initializeGameUI,
    render: renderGameUI,
    renderHand: renderGameUIHand,
    renderPlayedCards: renderGameUIPlayedCards,
    renderTrump: renderGameUITrump,
    renderTurn: renderGameUITurn,
    showTrumpSelector: showGameUITrumpSelector,
    hideTrumpSelector: hideGameUITrumpSelector,
    stopTurnTimer: stopGameUITurnTimer
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeGameUI);
} else {
    initializeGameUI();
}
