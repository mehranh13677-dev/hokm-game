"use strict";

/*
 * ================================================================
 * HOKM ONLINE & OFFLINE
 * game.js
 *
 * Version: 3.0 (Full Structure + Ace Dealer, Counter-Clockwise Rotation,
 * Trick Collection to Winner, and Day/Night Theme Switcher)
 * ================================================================
 */

const STORAGE_KEY = "hokm_online_player_v1";

const DEFAULT_PLAYER = {
    name: "بازیکن مهمان",
    coins: 3000,
    level: 1,
    gamesPlayed: 0,
    gamesWon: 0,
    inventory: [],
    theme: "dark", // 'dark' یا 'light'
    createdAt: Date.now()
};

const BOT_NAMES = [
    // اسامی پسرانه
    "آرش", "کوروش", "امیر", "رضا", "محمد", "دانیال", "پویا", "آرمان", "سینا", "سهیل",
    "سهراب", "بهنام", "کیوان", "فرهاد", "شایان", "کامران", "رامین", "بیژن", "اشکان", "سامان",
    "نریمان", "پیمان", "فرزاد", "بهرام", "پژمان", "شروین", "کیان", "مازیار", "مهدی", "علی",
    "حسن", "حسین", "محسن", "حامد", "احسان", "مسعود", "مجید", "سعید", "مهرداد", "پدرام",
    "آهنگ", "باربد", "برسام", "بنیامین", "پرهام", "تینو", "حافظ", "دادار", "رادوین", "روزبه",
    // اسامی دخترانه
    "سارا", "پریسا", "فاطمه", "زهرا", "نیلوفر", "مینا", "رها", "غزل", "باران", "الناز",
    "نازنین", "مهسا", "رویا", "تبسم", "شیرین", "پگاه", "هانیه", "پردیس", "ترانه", "آوا",
    "مهدیس", "یسنا", "دلارام", "سحر", "نگار", "نازگل", "پرناز", "ترلان", "تینا", "تکتم",
    "رکسانا", "روژان", "زهره", "زیبا", "سپیده", "ستاره", "سمانه", "سودابه", "سولماز", "سیما",
    "شبنم", "شقایق", "شهرزاد", "شیما", "صبا", "طاهره", "عطیه", "فریبا", "فروزنده", "فهیمه"
];

function getRandomBotName(exclude = []) {
    const available = BOT_NAMES.filter(name => !exclude.includes(name));
    if (available.length === 0) return "ربات هوشمند";
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
}

const SUITS = {
    hearts: { name: "دل", symbol: "♥", color: "red" },
    diamonds: { name: "خشت", symbol: "♦", color: "red" },
    clubs: { name: "گشنیز", symbol: "♣", color: "black" },
    spades: { name: "پیک", symbol: "♠", color: "black" }
};

const SUIT_ORDER = ["hearts", "diamonds", "clubs", "spades"];

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
    gameMode: "4p", // '4p' یا '2p'
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
   5. PLAYER UI & THEME SWITCHER
================================================================ */

function applyTheme(theme) {
    if (!state.player) return;
    state.player.theme = theme;
    savePlayer();

    if (theme === "light") {
        document.documentElement.style.setProperty("--bg-main", "#f1f5f9");
        document.documentElement.style.setProperty("--bg-secondary", "#e2e8f0");
        document.documentElement.style.setProperty("--text", "#0f172a");
        document.body.style.background = "radial-gradient(circle at 50% 10%, #cbd5e1 0%, #94a3b8 100%)";
    } else {
        document.documentElement.style.setProperty("--bg-main", "#060b14");
        document.documentElement.style.setProperty("--bg-secondary", "#0f192d");
        document.documentElement.style.setProperty("--text", "#ffffff");
        document.body.style.background = "radial-gradient(circle at 50% 10%, #152644 0%, #0a1322 55%, #040810 100%)";
    }
}

function updatePlayerUI() {
    if (!state.player) return;
    applyTheme(state.player.theme || "dark");

    const coinBalance = getElement("coinBalance");
    const shopCoinBalance = getElement("shopCoinBalance");
    const playerName = getElement("playerName");
    const profileName = getElement("profileName");
    const playerLevel = getElement("playerLevel");
    const profileLevel = getElement("profileLevel");
    const gamesPlayed = getElement("gamesPlayed") || getElement("profileGames");
    const gamesWon = getElement("gamesWon") || getElement("profileWins");
    const gamesLost = getElement("profileLosses");
    const winRate = getElement("winRate");

    if (coinBalance) coinBalance.textContent = formatNumber(state.player.coins);
    if (shopCoinBalance) shopCoinBalance.textContent = formatNumber(state.player.coins);
    if (playerName) playerName.textContent = state.player.name;
    if (profileName) profileName.textContent = state.player.name;
    if (playerLevel) playerLevel.textContent = `سطح ${formatNumber(state.player.level)}`;
    if (profileLevel) profileLevel.textContent = `سطح ${formatNumber(state.player.level)}`;
    if (gamesPlayed) gamesPlayed.textContent = formatNumber(state.player.gamesPlayed);
    if (gamesWon) gamesWon.textContent = formatNumber(state.player.gamesWon);

    if (gamesLost) {
        const lost = Math.max(0, state.player.gamesPlayed - state.player.gamesWon);
        gamesLost.textContent = formatNumber(lost);
    }

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

function showScreen(screenId, pushHistory = true) {
    const screens = queryAll(".screen");
    screens.forEach(screen => {
        screen.classList.remove("active-screen", "active");
        screen.classList.add("hidden");
        screen.style.display = "none";
    });

    const target = getElement(screenId);
    if (!target) {
        console.warn("صفحه پیدا نشد:", screenId);
        return;
    }

    target.classList.remove("hidden");
    target.classList.add("active-screen", "active");
    target.style.display = "block";
    state.currentScreen = screenId;

    if (pushHistory && history.state?.screen !== screenId) {
        history.pushState({ screen: screenId }, "", `#${screenId}`);
    }

    updateNavigation(screenId);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function updateNavigation(screenId) {
    queryAll(".nav-item, .bottom-nav-item").forEach(button => {
        const target = button.dataset.screen || button.dataset.pageLink;
        if (target === screenId || (screenId === "homeScreen" && (target === "home" || !target))) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });
}

/* ================================================================
   7. TOAST & MODAL
================================================================ */

let toastTimer = null;

function showToast(message, icon = "ℹ️", duration = 2500) {
    const toast = getElement("toast") || getElement("toastContainer");
    const toastIcon = getElement("toastIcon");
    const toastMessage = getElement("toastMessage");
    if (!toast) return;

    if (toastIcon) toastIcon.textContent = icon;
    if (toastMessage) toastMessage.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}

function openModal(content) {
    const overlay = getElement("modalOverlay") || getElement("modalRoot");
    const modalContent = getElement("modalContent");
    if (!overlay || !modalContent) return;

    modalContent.innerHTML = content;
    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
}

function closeModal() {
    const overlay = getElement("modalOverlay") || getElement("modalRoot");
    if (overlay) {
        overlay.classList.add("hidden");
        overlay.style.display = "none";
    }
}

function showLoading(message = "لطفاً صبر کنید...") {
    const overlay = getElement("loadingOverlay");
    const messageElement = getElement("loadingMessage");
    if (messageElement) messageElement.textContent = message;
    if (overlay) {
        overlay.classList.remove("hidden");
        overlay.style.display = "flex";
    }
}

function hideLoading() {
    const overlay = getElement("loadingOverlay");
    if (overlay) {
        overlay.classList.add("hidden");
        overlay.style.display = "none";
    }
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
    showScreen("roomScreen");
}

function createRoom() {
    const roomCode = generateRoomCode();
    state.currentRoom = {
        code: roomCode,
        name: "اتاق حکم آنلاین",
        entryFee: 400,
        isPrivate: true,
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
    const code = prompt("کد ۶ رقمی اتاق را وارد کنید:");
    if (code) joinRoomWithCode(code);
}

function joinRoomWithCode(code) {
    const cleanCode = String(code).replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) {
        showToast("کد اتاق باید ۶ رقمی باشد.", "⚠️");
        return;
    }

    state.currentRoom = {
        code: cleanCode,
        name: "اتاق آنلاین",
        entryFee: 400,
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
    showToast("وارد اتاق شدی.", "🚪");
}

function updateRoomUI() {
    if (!state.currentRoom) return;

    const codeElement = getElement("currentRoomCode") || getElement("roomCode");
    if (codeElement) codeElement.textContent = state.currentRoom.code;

    const players = state.currentRoom.players;
    for (let seat = 0; seat < 4; seat++) {
        const nameEl = getElement(`playerName${seat + 1}`);
        if (!nameEl) continue;
        const player = players.find(p => p.seat === seat);
        nameEl.textContent = player ? player.name : "انتظار بازیکن...";
    }

    const startButton = getElement("startGameButton") || getElement("startRoomGameButton");
    if (startButton) {
        startButton.disabled = players.length < 4;
    }
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

function createDemoPlayers4P() {
    const bot1 = getRandomBotName([state.player.name]);
    const bot2 = getRandomBotName([state.player.name, bot1]);
    const bot3 = getRandomBotName([state.player.name, bot1, bot2]);

    return [
        { id: "p1", name: state.player.name, seat: 0, team: "A", local: true },
        { id: "p2", name: bot1, seat: 1, team: "B", local: false },
        { id: "p3", name: bot2, seat: 2, team: "A", local: false },
        { id: "p4", name: bot3, seat: 3, team: "B", local: false }
    ];
}

function createDemoPlayers2P() {
    const bot1 = getRandomBotName([state.player.name]);
    return [
        { id: "p1", name: state.player.name, seat: 0, team: "A", local: true },
        { id: "p2", name: bot1, seat: 2, team: "B", local: false }
    ];
}

/* ================================================================
   9. AUTHENTIC HOKM RULES: DEALING, HAKEM (ACE) & TRICK COLLECTION
================================================================ */

function startOffline4PGame() {
    state.gameMode = "4p";
    state.game = {
        active: true,
        phase: "dealing-hakem",
        players: createDemoPlayers4P(),
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
        leader: state.game.leader !== undefined ? state.game.leader : 0,
        roundNumber: 1
    };

    const west = getElement("westPlayer");
    const east = getElement("eastPlayer");
    if (west) west.style.display = "";
    if (east) east.style.display = "";

    updateTablePlayerNames();
    determineHakemByAce();
}

function startOffline2PGame() {
    state.gameMode = "2p";
    state.game = {
        active: true,
        phase: "dealing-hakem",
        players: createDemoPlayers2P(),
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
        leader: state.game.leader !== undefined ? state.game.leader : 0,
        roundNumber: 1
    };

    const west = getElement("westPlayer");
    const east = getElement("eastPlayer");
    if (west) west.style.display = "none";
    if (east) east.style.display = "none";

    updateTablePlayerNames();
    determineHakemByAce();
}

function updateTablePlayerNames() {
    const pSouth = state.game.players.find(p => p.seat === 0);
    const pWest = state.game.players.find(p => p.seat === 1);
    const pNorth = state.game.players.find(p => p.seat === 2);
    const pEast = state.game.players.find(p => p.seat === 3);

    const southEl = getElement("southPlayerName");
    const westEl = getElement("westPlayerName");
    const northEl = getElement("northPlayerName");
    const eastEl = getElement("eastPlayerName");

    if (southEl && pSouth) southEl.textContent = pSouth.name;
    if (westEl && pWest) westEl.textContent = pWest.name;
    if (northEl && pNorth) northEl.textContent = pNorth.name;
    if (eastEl && pEast) eastEl.textContent = pEast.name;
}

// تعیین حاکم با پخش تک‌برگ (آس) به سبک سنتی
function determineHakemByAce() {
    showLoading("در حال قرعه‌کشی حاکم با تک‌برگ...");
    let hakemSeat = 0;
    
    const deck = state.game.deck;
    let foundAcePlayer = null;

    for (let i = 0; i < state.game.players.length; i++) {
        const card = deck.pop();
        if (card && card.rank === 14) { // آس
            foundAcePlayer = state.game.players[i];
            break;
        }
    }

    if (foundAcePlayer) {
        hakemSeat = foundAcePlayer.seat;
    } else {
        hakemSeat = Math.floor(Math.random() * state.game.players.length);
        foundAcePlayer = state.game.players[hakemSeat];
    }

    state.game.leader = hakemSeat;

    setTimeout(() => {
        hideLoading();
        showToast(`${foundAcePlayer.name} حاکم شد! 👑`, "👑", 3000);
        dealFirstCardsForHakem();
    }, 1000);
}

// مرحله اول: پخش ۵ کارت اول برای تعیین حکم
function dealFirstCardsForHakem() {
    const players = state.game.players;
    const hands = {};
    players.forEach(p => { hands[p.id] = []; });

    for (let i = 0; i < 5; i++) {
        players.forEach(p => {
            const card = state.game.deck.pop();
            if (card) hands[p.id].push(card);
        });
    }

    Object.keys(hands).forEach(pid => {
        hands[pid].sort((a, b) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || a.rank - b.rank);
    });
    state.game.hands = hands;

    showLoading("توزیع ۵ کارت اول...");

    setTimeout(() => {
        hideLoading();
        state.game.phase = "trump-selection";
        state.game.currentTurn = state.game.leader;
        showScreen("trumpScreen");
        renderPlayerHand();
        showToast("حکم را انتخاب کنید 👑", "👑", 3500);
    }, 600);
}

// مرحله دوم: پخش ۸ کارت باقی‌مانده پس از انتخاب حکم
function dealRemainingCards() {
    const players = state.game.players;
    for (let i = 0; i < 8; i++) {
        players.forEach(p => {
            const card = state.game.deck.pop();
            if (card) state.game.hands[p.id].push(card);
        });
    }

    Object.keys(state.game.hands).forEach(pid => {
        state.game.hands[pid].sort((a, b) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || a.rank - b.rank);
    });
}

function setTrumpSuit(suit) {
    if (!SUITS[suit]) return;
    state.game.trumpSuit = suit;
    
    showLoading("در حال تکمیل کارت‌ها...");

    setTimeout(() => {
        dealRemainingCards();
        hideLoading();

        state.game.phase = "playing";
        state.game.leadSuit = null;
        state.game.trick = [];
        state.game.trickNumber = 0;
        state.game.currentTurn = state.game.leader;

        updateTrumpUI();
        showScreen("gameScreen");
        renderPlayerHand();
        updateGameUI();
        showToast(`حکم: ${SUITS[suit].name} تعیین شد!`, "👑", 2500);

        runComputerTurnIfNeeded();
    }, 800);
}

function updateTrumpUI() {
    const element = getElement("trumpSuit");
    if (element && state.game.trumpSuit) {
        element.textContent = `${SUITS[state.game.trumpSuit].name} ${SUITS[state.game.trumpSuit].symbol}`;
    }
}

function renderPlayerHand() {
    const container = getElement("handContainer") || getElement("playerHand");
    if (!container) return;
    container.innerHTML = "";

    const localPlayer = state.game.players.find(p => p.local);
    if (!localPlayer) return;

    const hand = state.game.hands[localPlayer.id] || [];
    const playable = getPlayableCards(localPlayer.id);

    hand.forEach(card => {
        const isPlayable = playable.some(p => p.id === card.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `playing-card game-card ${SUITS[card.suit].color === "red" ? "red-card" : "black-card"} ${isPlayable ? "playable" : "disabled"}`;
        btn.innerHTML = `
            <span class="card-corner top-corner"><strong>${card.label}</strong><span>${SUITS[card.suit].symbol}</span></span>
            <span class="card-center-symbol">${SUITS[card.suit].symbol}</span>
            <span class="card-corner bottom-corner"><strong>${card.label}</strong><span>${SUITS[card.suit].symbol}</span></span>
        `;
        if (isPlayable && state.game.currentTurn === localPlayer.seat && state.game.phase === "playing") {
            btn.onclick = (e) => {
                e.preventDefault();
                playLocalCard(card.id);
            };
        }
        container.appendChild(btn);
    });
}

function getPlayableCards(playerId) {
    const hand = state.game.hands[playerId] || [];
    if (!state.game.leadSuit || state.game.trick.length === 0) return hand;

    const sameSuitCards = hand.filter(card => card.suit === state.game.leadSuit);
    if (sameSuitCards.length > 0) return sameSuitCards;

    return hand;
}

function playLocalCard(cardId) {
    const localPlayer = state.game.players.find(p => p.local);
    if (!localPlayer || state.game.currentTurn !== localPlayer.seat || state.game.phase !== "playing") return;

    const hand = state.game.hands[localPlayer.id];
    const index = hand.findIndex(c => c.id === cardId);
    if (index === -1) return;

    const card = hand.splice(index, 1)[0];
    playCard(localPlayer, card);
}

function playCard(player, card) {
    if (state.game.trick.length === 0) state.game.leadSuit = card.suit;
    state.game.trick.push({ seat: player.seat, card });
    renderTable();
    renderPlayerHand();

    const limit = (state.gameMode === "2p") ? 2 : 4;
    if (state.game.trick.length >= limit) {
        setTimeout(resolveTrick, 1200);
        return;
    }

    state.game.currentTurn = (state.gameMode === "2p") ? (player.seat === 0 ? 2 : 0) : (player.seat + 1) % 4;
    updateGameUI();
    runComputerTurnIfNeeded();
}

function chooseComputerCard(playableCards) {
    const sorted = [...playableCards].sort((a, b) => a.rank - b.rank);
    if (state.game.trick.length > 0 && state.game.trumpSuit) {
        const trumpCards = sorted.filter(c => c.suit === state.game.trumpSuit);
        if (trumpCards.length > 0) return trumpCards[0];
    }
    return sorted[0];
}

function runComputerTurnIfNeeded() {
    if (!state.game.active || state.game.phase !== "playing") return;
    const currentTurn = state.game.currentTurn;
    const player = state.game.players.find(p => p.seat === currentTurn);
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
    }, 950);
}

function renderTable() {
    const slots = {
        0: getElement("trickSouth"),
        1: getElement("trickWest"),
        2: getElement("trickNorth"),
        3: getElement("trickEast")
    };

    Object.values(slots).forEach(slot => { if (slot) slot.innerHTML = ""; });

    state.game.trick.forEach(item => {
        const slot = slots[item.seat];
        if (!slot) return;
        const card = document.createElement("div");
        card.className = `playing-card game-card ${SUITS[item.card.suit].color === "red" ? "red-card" : "black-card"}`;
        card.innerHTML = `
            <span class="card-corner top-corner"><strong>${item.card.label}</strong><span>${SUITS[item.card.suit].symbol}</span></span>
            <span class="card-center-symbol">${SUITS[item.card.suit].symbol}</span>
            <span class="card-corner bottom-corner"><strong>${item.card.label}</strong><span>${SUITS[item.card.suit].symbol}</span></span>
        `;
        slot.appendChild(card);
    });
}

// جمع شدن کارت‌ها به سمت بازیکن برنده دست
function resolveTrick() {
    const limit = (state.gameMode === "2p") ? 2 : 4;
    if (state.game.trick.length !== limit) return;

    const winner = determineTrickWinner(state.game.trick);
    const winnerPlayer = state.game.players.find(p => p.seat === winner.seat);
    if (!winnerPlayer) return;

    if (winnerPlayer.team === "A") state.game.teamATricks++;
    else state.game.teamBTricks++;

    state.game.trickNumber++;
    showToast(`${winnerPlayer.name} این دست را برد و کارت‌ها را جمع کرد! 🏆`, "🏆", 1400);

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
    }, 1000);
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
    const turnMessage = getElement("gameTurnInfo");
    if (turnMessage) {
        const curr = state.game.players.find(p => p.seat === state.game.currentTurn);
        turnMessage.textContent = curr?.local ? "نوبت شماست!" : `نوبت ${curr?.name || "حریف"}`;
    }

    const northCount = getElement("opponentTopCards");
    const westCount = getElement("opponentLeftCards");
    const eastCount = getElement("opponentRightCards");

    const pNorth = state.game.players.find(p => p.seat === 2);
    const pWest = state.game.players.find(p => p.seat === 1);
    const pEast = state.game.players.find(p => p.seat === 3);

    if (northCount && pNorth) northCount.textContent = state.game.hands[pNorth.id]?.length || 0;
    if (westCount && pWest) westCount.textContent = state.game.hands[pWest.id]?.length || 0;
    if (eastCount && pEast) eastCount.textContent = state.game.hands[pEast.id]?.length || 0;
}

function finishRound() {
    state.game.phase = "round-finished";
    const teamAWon = state.game.teamATricks > state.game.teamBTricks;

    // قوانین چرخش حاکم: اگر تیم حاکم (فرض تیم A) ببازه، حاکم در خلاف جهت عقربه‌های ساعت می‌چرخد
    if (!teamAWon) {
        state.game.leader = (state.game.leader + 3) % 4; // چرخش معکوس (خلاف عقربه‌های ساعت)
    }

    state.player.gamesPlayed++;
    if (teamAWon) {
        state.player.gamesWon++;
        state.player.coins += 150;
    } else {
        state.player.coins += 30;
    }

    savePlayer();
    updatePlayerUI();

    openModal(`
        <div class="result-modal" style="text-align:center; padding:15px;">
            <div style="font-size:45px; margin-bottom:10px;">${teamAWon ? "🏆" : "😔"}</div>
            <h2 style="color:var(--gold); margin-bottom:8px;">${teamAWon ? "پیروز شدی! 🎉" : "شکست خوردی!"}</h2>
            <p style="color:#aaa; font-size:13px;">دست‌های شما: ${state.game.teamATricks} | دست‌های حریف: ${state.game.teamBTricks}</p>
            <div style="background:rgba(255,255,255,0.08); padding:12px; border-radius:12px; margin:15px 0;">
                <span>پاداش بازی: </span>
                <strong style="color:var(--gold)">🪙 ${teamAWon ? "150" : "30"} سکه</strong>
            </div>
            <button id="backToHomeAfterGame" class="action-btn action-btn-gold" style="width:100%;" type="button">بازگشت به منوی اصلی</button>
        </div>
    `);

    const backButton = getElement("backToHomeAfterGame");
    if (backButton) {
        backButton.onclick = () => {
            closeModal();
            state.game.active = false;
            showScreen("homeScreen");
        };
    }
}

function confirmLeaveGame() {
    if (confirm("آیا می‌خواهید از بازی خارج شده و به صفحه اصلی برگردید؟")) {
        state.game.active = false;
        showScreen("homeScreen");
    }
}

/* ================================================================
   10. EVENT BINDINGS & THEME SWITCHER
================================================================ */

function bindDirectButtons() {
    const b4p = getElement("offline4pButton");
    if (b4p) b4p.onclick = () => startOffline4PGame();

    const b2p = getElement("offline2pButton");
    if (b2p) b2p.onclick = () => startOffline2PGame();

    const qbtn = getElement("quickGameButton");
    if (qbtn) qbtn.onclick = () => startOffline4PGame();

    const createBtn = getElement("createRoomButton");
    if (createBtn) createBtn.onclick = () => showScreen("roomScreen");

    const leaveBtn = getElement("leaveGameButton");
    if (leaveBtn) leaveBtn.onclick = () => confirmLeaveGame();

    // دکمه تغییر تم (روز / شب) روی دکمه تنظیمات هدر
    const settingsBtn = getElement("settingsButton");
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            const nextTheme = state.player.theme === "light" ? "dark" : "light";
            applyTheme(nextTheme);
            showToast(`تم بازی به حالت ${nextTheme === "light" ? "روز ☀️" : "شب 🌙"} تغییر کرد.`);
        };
    }

    queryAll(".suit-button").forEach(btn => {
        btn.onclick = () => setTrumpSuit(btn.dataset.suit);
    });

    queryAll(".nav-item, .bottom-nav-item").forEach(btn => {
        btn.onclick = () => {
            const t = btn.dataset.screen || btn.dataset.pageLink || "homeScreen";
            showScreen(t === "home" ? "homeScreen" : t);
        };
    });

    queryAll("#profileBackButton, #shopBackButton, #leaderboardBackButton, #friendsBackButton, #settingsBackButton, #roomBackButton").forEach(btn => {
        btn.onclick = () => showScreen("homeScreen");
    });

    window.onpopstate = () => {
        if (state.game.active) {
            confirmLeaveGame();
            history.pushState({ screen: state.currentScreen }, "", `#${state.currentScreen}`);
        } else if (state.currentScreen !== "homeScreen") {
            showScreen("homeScreen", false);
        } else {
            history.pushState({ screen: "homeScreen" }, "", "#homeScreen");
        }
    };
}

function initializeApp() {
    loadPlayer();
    updatePlayerUI();
    bindDirectButtons();
    if (!window.location.hash) {
        history.replaceState({ screen: "homeScreen" }, "", "#homeScreen");
    }
    showScreen("homeScreen");
    console.log("Hokm game.js 3.0 fully initialized.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}
