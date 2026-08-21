"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * game.js
 *
 * Version: 1.0 
 *
 * هسته اصلی موتور بازی حکم همراه با سیستم هوش مصنوعی و جایگزینی بات
 * ================================================================
 */

/* ================================================================
   1. CONSTANTS
================================================================ */

const STORAGE_KEY = "hokm_online_player_v1";

const DEFAULT_PLAYER = {
    name: "بازیکن مهمان",
    coins: 1000,
    level: 1,
    gamesPlayed: 0,
    gamesWon: 0,
    inventory: [],
    createdAt: Date.now()
};

const SUITS = {
    hearts: {
        name: "دل",
        symbol: "♥",
        color: "red"
    },
    diamonds: {
        name: "خشت",
        symbol: "♦",
        color: "red"
    },
    clubs: {
        name: "گشنیز",
        symbol: "♣",
        color: "black"
    },
    spades: {
        name: "پیک",
        symbol: "♠",
        color: "black"
    }
};

const SUIT_ORDER = [
    "hearts",
    "diamonds",
    "clubs",
    "spades"
];

const RANKS = [
    { value: 2, label: "2" },
    { value: 3, label: "3" },
    { value: 4, label: "4" },
    { value: 5, label: "5" },
    { value: 6, label: "6" },
    { value: 7, label: "7" },
    { value: 8, label: "8" },
    { value: 9, label: "9" },
    { value: 10, label: "10" },
    { value: 11, label: "J" },
    { value: 12, label: "Q" },
    { value: 13, label: "K" },
    { value: 14, label: "A" }
];

/* ================================================================
   2. DOM HELPERS
================================================================ */

function getElement(id) {
    return document.getElementById(id);
}

function query(selector) {
    return document.querySelector(selector);
}

function queryAll(selector) {
    return Array.from(document.querySelectorAll(selector));
}

/* ================================================================
   3. APPLICATION STATE
================================================================ */

const state = {
    currentScreen: "homeScreen",
    player: null,
    currentRoom: null,
    game: {
        active: false,
        phase: "idle",
        players: [],
        deck: [],
        hands: {},
        trumpSuit: null,
        leadSuit: null,
        currentTurn: null,
        trick: [],
        trickNumber: 0,
        teamAScore: 0,
        teamBScore: 0,
        teamATricks: 0,
        teamBTricks: 0,
        leader: 0,
        roundNumber: 1
    },
    settings: {
        sound: true
    }
};

/* ================================================================
   4. PLAYER STORAGE
================================================================ */

function loadPlayer() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            state.player = { ...DEFAULT_PLAYER };
            savePlayer();
            return;
        }
        const parsed = JSON.parse(saved);
        state.player = { ...DEFAULT_PLAYER, ...parsed };
    } catch (error) {
        console.error("خطا در خواندن اطلاعات بازیکن:", error);
        state.player = { ...DEFAULT_PLAYER };
        savePlayer();
    }
}

function savePlayer() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.player));
    } catch (error) {
        console.error("خطا در ذخیره بازیکن:", error);
    }
}

/* ================================================================
   5. PLAYER UI
================================================================ */

function updatePlayerUI() {
    if (!state.player) return;

    const coinBalance = getElement("coinBalance");
    const shopCoinBalance = getElement("shopCoinBalance");
    const playerName = getElement("playerName");
    const profileName = getElement("profileName");
    const playerLevel = getElement("playerLevel");
    const profileLevel = getElement("profileLevel");
    const gamesPlayed = getElement("gamesPlayed");
    const gamesWon = getElement("gamesWon");
    const winRate = getElement("winRate");

    if (coinBalance) coinBalance.textContent = formatNumber(state.player.coins);
    if (shopCoinBalance) shopCoinBalance.textContent = formatNumber(state.player.coins);
    if (playerName) playerName.textContent = state.player.name;
    if (profileName) profileName.textContent = state.player.name;
    if (playerLevel) playerLevel.textContent = state.player.level;
    if (profileLevel) profileLevel.textContent = state.player.level;
    if (gamesPlayed) gamesPlayed.textContent = formatNumber(state.player.gamesPlayed);
    if (gamesWon) gamesWon.textContent = formatNumber(state.player.gamesWon);

    if (winRate) {
        const rate = state.player.gamesPlayed > 0
            ? Math.round((state.player.gamesWon / state.player.gamesPlayed) * 100)
            : 0;
        winRate.textContent = `${rate}%`;
    }
}

function formatNumber(number) {
    return Number(number || 0).toLocaleString("fa-IR");
}

/* ================================================================
   6. SCREEN NAVIGATION
================================================================ */

function showScreen(screenId) {
    const screens = queryAll(".screen");
    screens.forEach(screen => screen.classList.remove("active-screen"));

    const target = getElement(screenId);
    if (!target) {
        console.warn("صفحه پیدا نشد:", screenId);
        return;
    }

    target.classList.add("active-screen");
    state.currentScreen = screenId;
    updateNavigation(screenId);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateNavigation(screenId) {
    queryAll(".nav-item").forEach(button => {
        const target = button.dataset.screen;
        if (target === screenId) button.classList.add("active");
        else button.classList.remove("active");
    });
}

/* ================================================================
   7. TOAST & MODAL
================================================================ */

let toastTimer = null;

function showToast(message, icon = "ℹ️", duration = 2500) {
    const toast = getElement("toast");
    const toastIcon = getElement("toastIcon");
    const toastMessage = getElement("toastMessage");
    if (!toast || !toastMessage) return;

    toastIcon.textContent = icon;
    toastMessage.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}

function openModal(content) {
    const overlay = getElement("modalOverlay");
    const modalContent = getElement("modalContent");
    if (!overlay || !modalContent) return;

    modalContent.innerHTML = content;
    overlay.classList.remove("hidden");
}

function closeModal() {
    const overlay = getElement("modalOverlay");
    if (overlay) overlay.classList.add("hidden");
}

function showLoading(message = "لطفاً صبر کنید...") {
    const overlay = getElement("loadingOverlay");
    const messageElement = getElement("loadingMessage");
    if (messageElement) messageElement.textContent = message;
    if (overlay) overlay.classList.remove("hidden");
}

function hideLoading() {
    const overlay = getElement("loadingOverlay");
    if (overlay) overlay.classList.add("hidden");
}

function generateRoomCode() {
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += Math.floor(Math.random() * 10);
    }
    return code;
}

/* ================================================================
   8. ROOM SETUP & DECK
================================================================ */

function openCreateRoom() {
    const roomNameInput = getElement("roomNameInput");
    const roomEntryInput = getElement("roomEntryInput");
    if (roomNameInput) roomNameInput.value = `${state.player.name} - اتاق`;
    if (roomEntryInput) roomEntryInput.value = "0";
    showScreen("createRoomScreen");
}

function createRoom() {
    const roomNameInput = getElement("roomNameInput");
    const roomEntryInput = getElement("roomEntryInput");
    const privateSwitch = getElement("privateRoomSwitch");

    const roomName = roomNameInput ? roomNameInput.value.trim() : "اتاق حکم";
    const entryFee = roomEntryInput ? Number(roomEntryInput.value || 0) : 0;
    const isPrivate = privateSwitch ? privateSwitch.checked : true;

    if (entryFee < 0) {
        showToast("هزینه ورود نمی‌تواند منفی باشد.", "⚠️");
        return;
    }
    if (entryFee > state.player.coins) {
        showToast("سکه کافی ندارید.", "🪙");
        return;
    }

    const roomCode = generateRoomCode();
    state.currentRoom = {
        code: roomCode,
        name: roomName || "اتاق حکم",
        entryFee,
        isPrivate,
        host: state.player.name,
        players: [{
            id: "local-player",
            name: state.player.name,
            seat: 0,
            team: "A",
            ready: true,
            local: true
        }],
        createdAt: Date.now()
    };

    updateRoomUI();
    showScreen("roomScreen");
    showToast(`اتاق ${roomCode} ساخته شد.`, "🎮", 3500);
}

function openJoinRoom() {
    const input = getElement("roomCodeInput");
    if (input) {
        input.value = "";
        input.focus();
    }
    showScreen("joinRoomScreen");
}

function joinRoom() {
    const input = getElement("roomCodeInput");
    if (!input) return;

    const code = input.value.replace(/\D/g, "").slice(0, 6);
    input.value = code;

    if (code.length !== 6) {
        showToast("کد اتاق باید ۶ رقمی باشد.", "⚠️");
        return;
    }

    state.currentRoom = {
        code,
        name: "اتاق آنلاین",
        entryFee: 0,
        isPrivate: true,
        host: "میزبان",
        players: [
            { id: "host-player", name: "میزبان", seat: 0, team: "A", ready: true, local: false },
            { id: "local-player", name: state.player.name, seat: 1, team: "B", ready: true, local: true }
        ],
        createdAt: Date.now()
    };

    updateRoomUI();
    showScreen("roomScreen");
    showToast("به اتاق آزمایشی وارد شدی.", "🚪");
}

function updateRoomUI() {
    if (!state.currentRoom) return;

    const codeElement = getElement("currentRoomCode");
    if (codeElement) codeElement.textContent = state.currentRoom.code;

    const players = state.currentRoom.players;
    for (let seat = 0; seat < 4; seat++) {
        const container = getElement(`roomPlayer${seat + 1}`);
        if (!container) continue;
        const player = players.find(p => p.seat === seat);
        updateRoomPlayerElement(container, player, seat);
    }

    const startButton = getElement("startGameButton");
    if (startButton) {
        startButton.disabled = players.length < 4;
    }
}

function updateRoomPlayerElement(element, player, seat) {
    if (!player) {
        element.className = "room-player empty-player";
        element.innerHTML = `
            <div class="room-player-avatar">+</div>
            <div class="room-player-info">
                <strong>جای خالی</strong>
                <span>منتظر بازیکن</span>
            </div>
        `;
        return;
    }

    element.className = "room-player";
    element.innerHTML = `
        <div class="room-player-avatar">${player.local ? "👤" : "🧑"}</div>
        <div class="room-player-info">
            <strong>${escapeHtml(player.name)}</strong>
            <span>تیم ${player.team}</span>
        </div>
        <span class="ready-badge">آماده</span>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function copyRoomCode() {
    if (!state.currentRoom) return;
    const code = state.currentRoom.code;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
        } else {
            const textarea = document.createElement("textarea");
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
        }
        showToast("کد اتاق کپی شد.", "📋");
    } catch (error) {
        showToast(`کد اتاق: ${code}`, "🎮", 5000);
    }
}

function createDeck() {
    const deck = [];
    SUIT_ORDER.forEach(suit => {
        RANKS.forEach(rank => {
            deck.push({
                id: `${suit}-${rank.value}`,
                suit,
                rank: rank.value,
                label: rank.label
            });
        });
    });
    return deck;
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function createDemoPlayers() {
    return [
        { id: "player-1", name: state.player.name, seat: 0, team: "A", local: true },
        { id: "player-2", name: "بازیکن شمال", seat: 1, team: "B", local: false },
        { id: "player-3", name: "بازیکن جنوب", seat: 2, team: "A", local: false },
        { id: "player-4", name: "بازیکن شرق", seat: 3, team: "B", local: false }
    ];
}

/* ================================================================
   9. GAME FLOW
================================================================ */

function startGame() {
    state.game = {
        active: true,
        phase: "dealing",
        players: createDemoPlayers(),
        deck: shuffleDeck(createDeck()),
        hands: {},
        trumpSuit: null,
        leadSuit: null,
        currentTurn: null,
        trick: [],
        trickNumber: 0,
        teamAScore: 0,
        teamBScore: 0,
        teamATricks: 0,
        teamBTricks: 0,
        leader: 0,
        roundNumber: 1
    };

    initializeHands();
    showLoading("در حال پخش کارت‌ها...");

    setTimeout(() => {
        hideLoading();
        state.game.phase = "trump-selection";
        state.game.currentTurn = 0;
        showScreen("trumpScreen");
        showToast("حکم را انتخاب کن.", "👑", 3500);
    }, 700);
}

function initializeHands() {
    const players = state.game.players;
    const hands = {};
    players.forEach(player => { hands[player.id] = []; });

    for (let i = 0; i < 13; i++) {
        players.forEach(player => {
            const card = state.game.deck.pop();
            if (card) hands[player.id].push(card);
        });
    }

    Object.keys(hands).forEach(playerId => {
        hands[playerId].sort(compareCards);
    });

    state.game.hands = hands;
}

function compareCards(a, b) {
    const suitA = SUIT_ORDER.indexOf(a.suit);
    const suitB = SUIT_ORDER.indexOf(b.suit);
    if (suitA !== suitB) return suitA - suitB;
    return a.rank - b.rank;
}

function setTrumpSuit(suit) {
    if (!SUITS[suit]) return;
    state.game.trumpSuit = suit;
    state.game.phase = "playing";
    state.game.leadSuit = null;
    state.game.trick = [];
    state.game.trickNumber = 0;
    state.game.currentTurn = state.game.leader;

    updateTrumpUI();
    showScreen("gameScreen");
    renderPlayerHand();
    updateGameUI();
    showToast(`حکم ${SUITS[suit].name} انتخاب شد.`, "👑", 3000);

    runComputerTurnIfNeeded();
}

function updateTrumpUI() {
    const element = getElement("trumpSuit");
    if (!element) return;
    if (!state.game.trumpSuit) {
        element.textContent = "-";
        return;
    }
    element.textContent = SUITS[state.game.trumpSuit].symbol;
}

function renderPlayerHand() {
    const container = getElement("playerHand") || getElement("handContainer");
    if (!container) return;
    container.innerHTML = "";

    const localPlayer = getLocalPlayer();
    if (!localPlayer) return;

    const hand = state.game.hands[localPlayer.id] || [];
    const playable = getPlayableCards(localPlayer.id);

    hand.forEach(card => {
        const cardElement = createCardElement(card);
        const isPlayable = playable.some(p => p.id === card.id);

        if (state.game.currentTurn === localPlayer.seat && state.game.phase === "playing" && isPlayable) {
            cardElement.classList.add("playable");
            cardElement.addEventListener("click", () => playLocalCard(card.id));
        } else {
            cardElement.classList.add("disabled");
        }

        container.appendChild(cardElement);
    });
}

function createCardElement(card) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "playing-card";

    if (SUITS[card.suit].color === "red") element.classList.add("red-card");
    else element.classList.add("black-card");

    const suit = SUITS[card.suit];
    element.innerHTML = `
        <span class="card-corner top-corner">
            <strong>${escapeHtml(card.label)}</strong>
            <span>${suit.symbol}</span>
        </span>
        <span class="card-center-symbol">${suit.symbol}</span>
        <span class="card-corner bottom-corner">
            <strong>${escapeHtml(card.label)}</strong>
            <span>${suit.symbol}</span>
        </span>
    `;

    return element;
}

function getLocalPlayer() {
    return state.game.players.find(player => player.local);
}

function getPlayableCards(playerId) {
    const hand = state.game.hands[playerId] || [];
    if (!state.game.leadSuit || state.game.trick.length === 0) return hand;

    const sameSuitCards = hand.filter(card => card.suit === state.game.leadSuit);
    if (sameSuitCards.length > 0) return sameSuitCards;

    return hand;
}

function playLocalCard(cardId) {
    const player = getLocalPlayer();
    if (!player || state.game.currentTurn !== player.seat || state.game.phase !== "playing") return;

    const hand = state.game.hands[player.id];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = hand[cardIndex];
    const playable = getPlayableCards(player.id);
    if (!playable.some(p => p.id === card.id)) {
        showToast("باید از خال شروع‌شده بازی کنی.", "⚠️");
        return;
    }

    hand.splice(cardIndex, 1);
    playCard(player, card);
}

function playCard(player, card) {
    if (state.game.trick.length === 0) state.game.leadSuit = card.suit;

    state.game.trick.push({ playerId: player.id, seat: player.seat, card });
    renderTable();
    updateGameUI();

    if (state.game.trick.length >= 4) {
        setTimeout(resolveTrick, 900);
        return;
    }

    state.game.currentTurn = (player.seat + 1) % 4;
    renderPlayerHand();
    updateGameUI();
    runComputerTurnIfNeeded();
}

/* ================================================================
   10. BOT & AI FALLBACK SYSTEM
================================================================ */

function chooseComputerCard(playableCards) {
    const sorted = [...playableCards].sort(compareCards);

    if (state.game.trick.length > 0 && state.game.trumpSuit) {
        const trumpCards = sorted.filter(c => c.suit === state.game.trumpSuit);
        if (trumpCards.length > 0) return trumpCards[0];
    }
    return sorted[0];
}

function runComputerTurnIfNeeded() {
    if (!state.game.active || state.game.phase !== "playing") return;

    const currentSeat = state.game.currentTurn;
    const player = state.game.players.find(p => p.seat === currentSeat);
    if (!player || player.local) return;

    setTimeout(() => {
        if (state.game.phase !== "playing") return;
        const playable = getPlayableCards(player.id);
        if (playable.length === 0) return;

        const card = chooseComputerCard(playable);
        const hand = state.game.hands[player.id];
        const index = hand.findIndex(item => item.id === card.id);
        if (index !== -1) hand.splice(index, 1);

        playCard(player, card);
    }, 750);
}

function playBotTurnForPlayer(playerId) {
    const player = state.game.players.find(p => p.id === playerId || p.seat === state.game.currentTurn);
    if (!player) return;

    const playable = getPlayableCards(player.id);
    if (!playable || playable.length === 0) return;

    const card = chooseComputerCard(playable);
    const hand = state.game.hands[player.id];
    const index = hand.findIndex(item => item.id === card.id);
    if (index !== -1) hand.splice(index, 1);

    playCard(player, card);
}

/* ================================================================
   11. TABLE & TRICK RESOLUTION
================================================================ */

function renderTable() {
    const positions = [
        "playedCardBottom", "playedCardLeft", "playedCardTop", "playedCardRight",
        "trickSouth", "trickWest", "trickNorth", "trickEast"
    ];

    positions.forEach(id => {
        const element = getElement(id);
        if (element) element.innerHTML = "";
    });

    state.game.trick.forEach(item => {
        const position = getTablePosition(item.seat);
        const container = getElement(position);
        if (!container) return;

        const card = createCardElement(item.card);
        card.classList.remove("disabled");
        card.classList.add("table-card");
        container.appendChild(card);
    });
}

function getTablePosition(seat) {
    const map = {
        0: getElement("trickSouth") ? "trickSouth" : "playedCardBottom",
        1: getElement("trickWest") ? "trickWest" : "playedCardLeft",
        2: getElement("trickNorth") ? "trickNorth" : "playedCardTop",
        3: getElement("trickEast") ? "trickEast" : "playedCardRight"
    };
    return map[seat] || "playedCardBottom";
}

function resolveTrick() {
    if (state.game.trick.length !== 4) return;

    const winner = determineTrickWinner(state.game.trick);
    const winnerPlayer = state.game.players.find(p => p.id === winner.playerId);
    if (!winnerPlayer) return;

    if (winnerPlayer.team === "A") state.game.teamATricks++;
    else state.game.teamBTricks++;

    state.game.trickNumber++;
    showToast(`${winnerPlayer.name} دست را برد.`, "🏆", 1800);

    setTimeout(() => {
        state.game.trick = [];
        state.game.leadSuit = null;
        state.game.currentTurn = winnerPlayer.seat;

        renderTable();
        updateGameUI();

        if (state.game.teamATricks >= 7 || state.game.teamBTricks >= 7 || state.game.trickNumber >= 13) {
            finishRound();
            return;
        }

        renderPlayerHand();
        runComputerTurnIfNeeded();
    }, 900);
}

function determineTrickWinner(trick) {
    let winner = trick[0];
    for (let i = 1; i < trick.length; i++) {
        const current = trick[i];
        if (cardBeats(current.card, winner.card, state.game.leadSuit, state.game.trumpSuit)) {
            winner = current;
        }
    }
    return winner;
}

function cardBeats(challenger, currentWinner, leadSuit, trumpSuit) {
    const challengerIsTrump = challenger.suit === trumpSuit;
    const winnerIsTrump = currentWinner.suit === trumpSuit;

    if (challengerIsTrump && !winnerIsTrump) return true;
    if (!challengerIsTrump && winnerIsTrump) return false;
    if (challengerIsTrump && winnerIsTrump) return challenger.rank > currentWinner.rank;

    const challengerIsLead = challenger.suit === leadSuit;
    const winnerIsLead = currentWinner.suit === leadSuit;

    if (challengerIsLead && !winnerIsLead) return true;
    if (!challengerIsLead && winnerIsLead) return false;
    if (challengerIsLead && winnerIsLead) return challenger.rank > currentWinner.rank;

    return false;
}

function updateGameUI() {
    const teamAScore = getElement("teamAScore");
    const teamBScore = getElement("teamBScore");
    const turnMessage = getElement("turnMessage") || getElement("gameTurnInfo");

    if (teamAScore) teamAScore.textContent = state.game.teamAScore;
    if (teamBScore) teamBScore.textContent = state.game.teamBScore;

    if (turnMessage) {
        const localPlayer = getLocalPlayer();
        if (localPlayer && state.game.currentTurn === localPlayer.seat) {
            turnMessage.textContent = "نوبت شماست!";
        } else {
            const player = state.game.players.find(p => p.seat === state.game.currentTurn);
            turnMessage.textContent = player ? `نوبت ${player.name}` : "منتظر نوبت...";
        }
    }

    updateOpponentCardCounts();
    updateTrumpUI();
}

function updateOpponentCardCounts() {
    const seats = [
        { seat: 1, nameId: "opponentTopName", countId: "opponentTopCards", altName: "northPlayerName" },
        { seat: 2, nameId: "opponentLeftName", countId: "opponentLeftCards", altName: "westPlayerName" },
        { seat: 3, nameId: "opponentRightName", countId: "opponentRightCards", altName: "eastPlayerName" }
    ];

    seats.forEach(item => {
        const player = state.game.players.find(p => p.seat === item.seat);
        if (player) {
            const nameEl = getElement(item.nameId) || getElement(item.altName);
            const countEl = getElement(item.countId);
            if (nameEl) nameEl.textContent = player.name;
            if (countEl) countEl.textContent = state.game.hands[player.id]?.length || 0;
        }
    });
}

function finishRound() {
    state.game.phase = "round-finished";
    const teamAWon = state.game.teamATricks > state.game.teamBTricks;
    const teamBWon = state.game.teamBTricks > state.game.teamATricks;

    if (teamAWon) state.game.teamAScore++;
    else if (teamBWon) state.game.teamBScore++;

    state.player.gamesPlayed++;
    if (teamAWon) {
        state.player.gamesWon++;
        state.player.coins += 100;
    } else {
        state.player.coins += 25;
    }

    savePlayer();
    updatePlayerUI();

    openModal(`
        <div class="result-modal">
            <div class="result-icon">${teamAWon ? "🏆" : "🃏"}</div>
            <h2>${teamAWon ? "بردی! 🎉" : "این دست را باختی"}</h2>
            <p>${teamAWon ? "تیم شما برنده راند شد." : "تیم حریف این راند را برد."}</p>
            <div class="result-score">
                <div><span>تیم شما</span><strong>${state.game.teamATricks}</strong></div>
                <div><span>تیم حریف</span><strong>${state.game.teamBTricks}</strong></div>
            </div>
            <div class="result-reward">
                <span>پاداش</span>
                <strong>🪙 ${teamAWon ? "100" : "25"}</strong>
            </div>
            <button id="backToHomeAfterGame" class="primary-button" type="button">بازگشت به خانه</button>
        </div>
    `);

    const backButton = getElement("backToHomeAfterGame");
    if (backButton) {
        backButton.addEventListener("click", () => {
            closeModal();
            state.game.active = false;
            state.currentRoom = null;
            showScreen("homeScreen");
        });
    }
}

function leaveRoom() {
    state.currentRoom = null;
    state.game.active = false;
    state.game.phase = "idle";
    showScreen("homeScreen");
    showToast("از اتاق خارج شدی.", "🚪");
}

function quickPlay() {
    state.currentRoom = {
        code: generateRoomCode(),
        name: "بازی سریع",
        entryFee: 0,
        isPrivate: false,
        host: state.player.name,
        players: createDemoPlayers(),
        createdAt: Date.now()
    };
    updateRoomUI();
    showScreen("roomScreen");
    showToast("۴ بازیکن آزمایشی وارد شدند.", "👥");
}

/* ================================================================
   12. INITIAL EVENT LISTENERS
================================================================ */

function setupNavigation() {
    queryAll(".nav-item, .bottom-nav-item").forEach(button => {
        button.addEventListener("click", () => {
            const target = button.dataset.screen || button.dataset.pageLink;
            if (target) showScreen(target);
        });
    });
}

function setupTrumpButtons() {
    queryAll(".suit-button").forEach(button => {
        button.addEventListener("click", () => {
            setTrumpSuit(button.dataset.suit);
        });
    });
}

function initializeApp() {
    loadPlayer();
    updatePlayerUI();
    setupNavigation();
    setupTrumpButtons();

    window.chooseComputerCard = chooseComputerCard;
    window.playBotTurnForPlayer = playBotTurnForPlayer;
    window.playLocalCard = playLocalCard;
    window.setTrumpSuit = setTrumpSuit;
    window.startGame = startGame;
    window.quickPlay = quickPlay;
    window.leaveRoom = leaveRoom;

    showScreen("homeScreen");
    console.log("Hokm Online game.js initialized successfully.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}
