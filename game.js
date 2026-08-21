"use strict";

/*
 * ================================================================
 * HOKM ONLINE & OFFLINE
 * game.js
 *
 * Version: 2.1 (Direct Event Binding & Absolute Screen Switch)
 *
 * هسته مستقل و قدرتمند موتور بازی حکم (آنلاین، ۴ نفره و ۲ نفره آفلاین)
 * ================================================================
 */

/* ================================================================
   1. CONSTANTS
================================================================ */

const STORAGE_KEY = "hokm_online_player_v1";

const DEFAULT_PLAYER = {
    name: "بازیکن مهمان",
    coins: 3000,
    level: 1,
    gamesPlayed: 0,
    gamesWon: 0,
    inventory: [],
    createdAt: Date.now()
};

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
    }
};

/* ================================================================
   4. PLAYER STORAGE & UI
================================================================ */

function loadPlayer() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            state.player = { ...DEFAULT_PLAYER };
            savePlayer();
            return;
        }
        state.player = { ...DEFAULT_PLAYER, ...JSON.parse(saved) };
    } catch (error) {
        state.player = { ...DEFAULT_PLAYER };
        savePlayer();
    }
}

function savePlayer() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.player));
    } catch (e) {}
}

function updatePlayerUI() {
    if (!state.player) return;

    const coinBalance = getElement("coinBalance");
    const shopCoinBalance = getElement("shopCoinBalance");
    const playerName = getElement("playerName");
    const profileName = getElement("profileName");
    const playerLevel = getElement("playerLevel");
    const profileLevel = getElement("profileLevel");
    const gamesPlayed = getElement("gamesPlayed") || getElement("profileGames");
    const gamesWon = getElement("gamesWon") || getElement("profileWins");
    const gamesLost = getElement("profileLosses");

    if (coinBalance) coinBalance.textContent = Number(state.player.coins).toLocaleString("fa-IR");
    if (shopCoinBalance) shopCoinBalance.textContent = Number(state.player.coins).toLocaleString("fa-IR");
    if (playerName) playerName.textContent = state.player.name;
    if (profileName) profileName.textContent = state.player.name;
    if (playerLevel) playerLevel.textContent = `سطح ${Number(state.player.level).toLocaleString("fa-IR")}`;
    if (profileLevel) profileLevel.textContent = `سطح ${Number(state.player.level)}`;
    if (gamesPlayed) gamesPlayed.textContent = Number(state.player.gamesPlayed).toLocaleString("fa-IR");
    if (gamesWon) gamesWon.textContent = Number(state.player.gamesWon).toLocaleString("fa-IR");

    if (gamesLost) {
        const lost = Math.max(0, state.player.gamesPlayed - state.player.gamesWon);
        gamesLost.textContent = Number(lost).toLocaleString("fa-IR");
    }
}

/* ================================================================
   5. SCREEN NAVIGATION (مدیریت قطعی تغییر صفحات)
================================================================ */

function showScreen(screenId) {
    const screens = queryAll(".screen");
    screens.forEach(screen => {
        screen.classList.remove("active-screen", "active");
        screen.classList.add("hidden");
        screen.style.display = "none";
    });

    const target = getElement(screenId);
    if (!target) {
        console.warn("Screen not found:", screenId);
        return;
    }

    target.classList.remove("hidden");
    target.classList.add("active-screen", "active");
    target.style.display = "block";
    state.currentScreen = screenId;

    // به‌روزرسانی منوی پایین
    queryAll(".nav-item, .bottom-nav-item").forEach(btn => {
        const targetAttr = btn.dataset.screen || btn.dataset.pageLink;
        if (targetAttr === screenId || (screenId === "homeScreen" && targetAttr === "home")) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ================================================================
   6. TOAST & MODAL
================================================================ */

let toastTimer = null;

function showToast(message, icon = "ℹ️", duration = 2500) {
    const toast = getElement("toast") || getElement("toastContainer");
    const toastIcon = getElement("toastIcon");
    const toastMessage = getElement("toastMessage");

    if (toastIcon) toastIcon.textContent = icon;
    if (toastMessage) toastMessage.textContent = message;

    if (toast) {
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, duration);
    }
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
   7. DECK & CARDS
================================================================ */

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
    return [
        { id: "player-1", name: state.player.name, seat: 0, team: "A", local: true },
        { id: "player-2", name: "ربات غرب (حریف)", seat: 1, team: "B", local: false },
        { id: "player-3", name: "ربات شمال (یار)", seat: 2, team: "A", local: false },
        { id: "player-4", name: "ربات شرق (حریف)", seat: 3, team: "B", local: false }
    ];
}

function createDemoPlayers2P() {
    return [
        { id: "player-1", name: state.player.name, seat: 0, team: "A", local: true },
        { id: "player-2", name: "هوش مصنوعی (رقیب)", seat: 2, team: "B", local: false }
    ];
}

/* ================================================================
   8. START GAMES (4P & 2P)
================================================================ */

function startOffline4PGame() {
    state.gameMode = "4p";
    state.game = {
        active: true,
        phase: "dealing",
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
        leader: 0,
        roundNumber: 1
    };

    const west = getElement("westPlayer");
    const east = getElement("eastPlayer");
    if (west) west.style.display = "";
    if (east) east.style.display = "";

    const northName = getElement("northPlayerName");
    if (northName) northName.textContent = "ربات شمال (یار)";

    initializeHands(13);
    showLoading("در حال بر زدن و پخش کارت‌های ۴ نفره...");

    setTimeout(() => {
        hideLoading();
        state.game.phase = "trump-selection";
        state.game.currentTurn = 0;
        showScreen("trumpScreen");
        showToast("حاکم شمایید! خال حکم را انتخاب کنید 👑", "👑", 3500);
    }, 500);
}

function startOffline2PGame() {
    state.gameMode = "2p";
    state.game = {
        active: true,
        phase: "dealing",
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
        leader: 0,
        roundNumber: 1
    };

    const west = getElement("westPlayer");
    const east = getElement("eastPlayer");
    if (west) west.style.display = "none";
    if (east) east.style.display = "none";

    const northName = getElement("northPlayerName");
    if (northName) northName.textContent = "هوش مصنوعی (رقیب)";

    initializeHands(13);
    showLoading("در حال چیدمان میز دو نفره...");

    setTimeout(() => {
        hideLoading();
        state.game.phase = "trump-selection";
        state.game.currentTurn = 0;
        showScreen("trumpScreen");
        showToast("بازی ۲ نفره! حکم را انتخاب کنید 👑", "⚔️", 3500);
    }, 500);
}

function initializeHands(count = 13) {
    const players = state.game.players;
    const hands = {};
    players.forEach(p => { hands[p.id] = []; });

    for (let i = 0; i < count; i++) {
        players.forEach(p => {
            const card = state.game.deck.pop();
            if (card) hands[p.id].push(card);
        });
    }

    Object.keys(hands).forEach(pid => { hands[pid].sort(compareCards); });
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
    showToast(`حکم: ${SUITS[suit].name} ${SUITS[suit].symbol}`, "👑", 3000);

    runComputerTurnIfNeeded();
}

function updateTrumpUI() {
    const element = getElement("trumpSuit");
    if (!element) return;
    if (!state.game.trumpSuit) {
        element.textContent = "-";
        return;
    }
    element.textContent = `${SUITS[state.game.trumpSuit].name} ${SUITS[state.game.trumpSuit].symbol}`;
}

function renderPlayerHand() {
    const container = getElement("handContainer") || getElement("playerHand");
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
            cardElement.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                playLocalCard(card.id);
            };
        } else {
            cardElement.classList.add("disabled");
        }

        container.appendChild(cardElement);
    });
}

function createCardElement(card) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "playing-card game-card";

    if (SUITS[card.suit].color === "red") element.classList.add("red-card");
    else element.classList.add("black-card");

    const suit = SUITS[card.suit];
    element.innerHTML = `
        <span class="card-corner top-corner">
            <strong>${card.label}</strong>
            <span>${suit.symbol}</span>
        </span>
        <span class="card-center-symbol">${suit.symbol}</span>
        <span class="card-corner bottom-corner">
            <strong>${card.label}</strong>
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

    const maxCardsInTrick = (state.gameMode === "2p") ? 2 : 4;

    if (state.game.trick.length >= maxCardsInTrick) {
        setTimeout(resolveTrick, 800);
        return;
    }

    if (state.gameMode === "2p") {
        state.game.currentTurn = (player.seat === 0) ? 2 : 0;
    } else {
        state.game.currentTurn = (player.seat + 1) % 4;
    }

    renderPlayerHand();
    updateGameUI();
    runComputerTurnIfNeeded();
}

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
    }, 600);
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
        const card = createCardElement(item.card);
        card.classList.remove("disabled");
        slot.appendChild(card);
    });
}

function resolveTrick() {
    const maxCardsInTrick = (state.gameMode === "2p") ? 2 : 4;
    if (state.game.trick.length !== maxCardsInTrick) return;

    const winner = determineTrickWinner(state.game.trick);
    const winnerPlayer = state.game.players.find(p => p.id === winner.playerId);
    if (!winnerPlayer) return;

    if (winnerPlayer.team === "A") state.game.teamATricks++;
    else state.game.teamBTricks++;

    state.game.trickNumber++;
    showToast(`${winnerPlayer.name} دست را جمع کرد!`, "🏆", 1400);

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
    }, 700);
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
        const localPlayer = getLocalPlayer();
        if (localPlayer && state.game.currentTurn === localPlayer.seat) {
            turnMessage.textContent = "نوبت شماست!";
        } else {
            const player = state.game.players.find(p => p.seat === state.game.currentTurn);
            turnMessage.textContent = player ? `نوبت ${player.name}` : "منتظر نوبت...";
        }
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

    if (teamAWon) state.game.teamAScore++;
    else state.game.teamBScore++;

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

function leaveGame() {
    state.game.active = false;
    state.game.phase = "idle";
    showScreen("homeScreen");
    showToast("از بازی خارج شدی.", "🚪");
}

/* ================================================================
   9. BIND DIRECT CLICK EVENTS
================================================================ */

function bindDirectButtons() {
    // بازی ۴ نفره آفلاین
    const btn4p = getElement("offline4pButton");
    if (btn4p) {
        btn4p.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startOffline4PGame();
        };
    }

    // بازی ۲ نفره آفلاین
    const btn2p = getElement("offline2pButton");
    if (btn2p) {
        btn2p.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startOffline2PGame();
        };
    }

    // بازی آنلاین سریع
    const quickBtn = getElement("quickGameButton");
    if (quickBtn) {
        quickBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startOffline4PGame();
        };
    }

    // ساخت اتاق
    const createBtn = getElement("createRoomButton");
    if (createBtn) {
        createBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showScreen("roomScreen");
        };
    }

    // خروج از بازی
    const leaveBtn = getElement("leaveGameButton");
    if (leaveBtn) {
        leaveBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            leaveGame();
        };
    }

    // انتخاب حکم
    queryAll(".suit-button").forEach(button => {
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setTrumpSuit(button.dataset.suit);
        };
    });

    // ناوبری منوی پایین
    queryAll(".nav-item, .bottom-nav-item").forEach(button => {
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = button.dataset.screen || button.dataset.pageLink;
            if (target === "home") showScreen("homeScreen");
            else if (target === "profile") showScreen("profileScreen");
            else if (target === "shop") showScreen("shopScreen");
            else if (target === "ranking") showScreen("leaderboardScreen");
            else if (target) showScreen(target);
        };
    });

    // دکمه‌های بازگشت به خانه
    queryAll("#profileBackButton, #shopBackButton, #leaderboardBackButton, #friendsBackButton, #settingsBackButton, #roomBackButton").forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showScreen("homeScreen");
        };
    });
}

function initializeApp() {
    loadPlayer();
    updatePlayerUI();
    bindDirectButtons();

    window.startOffline4PGame = startOffline4PGame;
    window.startOffline2PGame = startOffline2PGame;
    window.setTrumpSuit = setTrumpSuit;
    window.playLocalCard = playLocalCard;

    showScreen("homeScreen");
    console.log("Hokm game.js fully initialized.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}
