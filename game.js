"use strict";

/*
 * ================================================================
 * HOKM ONLINE
 * game.js
 *
 * Version: 1.0 
 *
 * این فایل منطق اصلی نسخه اولیه بازی حکم را کنترل می‌کند:
 *
 * - منوی اصلی
 * - ساخت اتاق
 * - ورود به اتاق
 * - مدیریت سکه مجازی
 * - مدیریت پروفایل محلی
 * - ساخت دسته 52 کارتی
 * - بُر زدن کارت‌ها
 * - پخش کارت‌ها
 * - انتخاب حکم
 * - بررسی قانونی بودن حرکت
 * - اجرای دست‌ها
 * - تعیین برنده هر دست
 * - امتیاز تیم‌ها
 * - پایان راند
 * - فروشگاه
 * - رتبه‌بندی آزمایشی
 *
 * نسخه فعلی به صورت Local/Offline کار می‌کند.
 * در مرحله بعد Supabase برای Multiplayer واقعی اضافه خواهد شد.
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
    {
        value: 2,
        label: "2"
    },
    {
        value: 3,
        label: "3"
    },
    {
        value: 4,
        label: "4"
    },
    {
        value: 5,
        label: "5"
    },
    {
        value: 6,
        label: "6"
    },
    {
        value: 7,
        label: "7"
    },
    {
        value: 8,
        label: "8"
    },
    {
        value: 9,
        label: "9"
    },
    {
        value: 10,
        label: "10"
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
            state.player = {
                ...DEFAULT_PLAYER
            };

            savePlayer();

            return;
        }

        const parsed = JSON.parse(saved);

        state.player = {
            ...DEFAULT_PLAYER,
            ...parsed
        };

    } catch (error) {

        console.error(
            "خطا در خواندن اطلاعات بازیکن:",
            error
        );

        state.player = {
            ...DEFAULT_PLAYER
        };

        savePlayer();
    }
}

function savePlayer() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state.player)
        );

    } catch (error) {

        console.error(
            "خطا در ذخیره بازیکن:",
            error
        );
    }
}

/* ================================================================
   5. PLAYER UI
================================================================ */

function updatePlayerUI() {

    if (!state.player) {
        return;
    }

    const coinBalance = getElement("coinBalance");
    const shopCoinBalance = getElement("shopCoinBalance");

    const playerName = getElement("playerName");
    const profileName = getElement("profileName");

    const playerLevel = getElement("playerLevel");
    const profileLevel = getElement("profileLevel");

    const gamesPlayed = getElement("gamesPlayed");
    const gamesWon = getElement("gamesWon");
    const winRate = getElement("winRate");

    if (coinBalance) {
        coinBalance.textContent =
            formatNumber(state.player.coins);
    }

    if (shopCoinBalance) {
        shopCoinBalance.textContent =
            formatNumber(state.player.coins);
    }

    if (playerName) {
        playerName.textContent =
            state.player.name;
    }

    if (profileName) {
        profileName.textContent =
            state.player.name;
    }

    if (playerLevel) {
        playerLevel.textContent =
            state.player.level;
    }

    if (profileLevel) {
        profileLevel.textContent =
            state.player.level;
    }

    if (gamesPlayed) {
        gamesPlayed.textContent =
            formatNumber(state.player.gamesPlayed);
    }

    if (gamesWon) {
        gamesWon.textContent =
            formatNumber(state.player.gamesWon);
    }

    if (winRate) {

        const rate =
            state.player.gamesPlayed > 0
                ? Math.round(
                    (state.player.gamesWon /
                        state.player.gamesPlayed) *
                    100
                )
                : 0;

        winRate.textContent =
            `${rate}%`;
    }
}

/* ================================================================
   6. NUMBER FORMAT
================================================================ */

function formatNumber(number) {

    return Number(number || 0).toLocaleString(
        "fa-IR"
    );
}

/* ================================================================
   7. SCREEN NAVIGATION
================================================================ */

function showScreen(screenId) {

    const screens = queryAll(".screen");

    screens.forEach((screen) => {

        screen.classList.remove(
            "active-screen"
        );
    });

    const target =
        getElement(screenId);

    if (!target) {
        console.warn(
            "صفحه پیدا نشد:",
            screenId
        );

        return;
    }

    target.classList.add(
        "active-screen"
    );

    state.currentScreen =
        screenId;

    updateNavigation(screenId);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function updateNavigation(screenId) {

    queryAll(".nav-item").forEach(
        (button) => {

            const target =
                button.dataset.screen;

            if (target === screenId) {

                button.classList.add(
                    "active"
                );

            } else {

                button.classList.remove(
                    "active"
                );
            }
        }
    );
}

/* ================================================================
   8. TOAST
================================================================ */

let toastTimer = null;

function showToast(
    message,
    icon = "ℹ️",
    duration = 2500
) {

    const toast =
        getElement("toast");

    const toastIcon =
        getElement("toastIcon");

    const toastMessage =
        getElement("toastMessage");

    if (!toast || !toastMessage) {
        return;
    }

    toastIcon.textContent =
        icon;

    toastMessage.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, duration);
}

/* ================================================================
   9. MODAL
================================================================ */

function openModal(content) {

    const overlay =
        getElement("modalOverlay");

    const modalContent =
        getElement("modalContent");

    if (!overlay || !modalContent) {
        return;
    }

    modalContent.innerHTML =
        content;

    overlay.classList.remove(
        "hidden"
    );
}

function closeModal() {

    const overlay =
        getElement("modalOverlay");

    if (!overlay) {
        return;
    }

    overlay.classList.add(
        "hidden"
    );
}

/* ================================================================
   10. LOADING
================================================================ */

function showLoading(
    message = "لطفاً صبر کنید..."
) {

    const overlay =
        getElement("loadingOverlay");

    const messageElement =
        getElement("loadingMessage");

    if (messageElement) {
        messageElement.textContent =
            message;
    }

    if (overlay) {
        overlay.classList.remove(
            "hidden"
        );
    }
}

function hideLoading() {

    const overlay =
        getElement("loadingOverlay");

    if (overlay) {
        overlay.classList.add(
            "hidden"
        );
    }
}

/* ================================================================
   11. RANDOM ROOM CODE
================================================================ */

function generateRoomCode() {

    let code = "";

    for (let i = 0; i < 6; i++) {

        code +=
            Math.floor(
                Math.random() * 10
            );
    }

    return code;
}

/* ================================================================
   12. CREATE ROOM
================================================================ */

function openCreateRoom() {

    const roomNameInput =
        getElement("roomNameInput");

    const roomEntryInput =
        getElement("roomEntryInput");

    if (roomNameInput) {
        roomNameInput.value =
            `${state.player.name} - اتاق`;
    }

    if (roomEntryInput) {
        roomEntryInput.value =
            "0";
    }

    showScreen(
        "createRoomScreen"
    );
}

function createRoom() {

    const roomNameInput =
        getElement("roomNameInput");

    const roomEntryInput =
        getElement("roomEntryInput");

    const privateSwitch =
        getElement("privateRoomSwitch");

    const roomName =
        roomNameInput
            ? roomNameInput.value.trim()
            : "اتاق حکم";

    const entryFee =
        roomEntryInput
            ? Number(roomEntryInput.value || 0)
            : 0;

    const isPrivate =
        privateSwitch
            ? privateSwitch.checked
            : true;

    if (entryFee < 0) {

        showToast(
            "هزینه ورود نمی‌تواند منفی باشد.",
            "⚠️"
        );

        return;
    }

    if (entryFee > state.player.coins) {

        showToast(
            "سکه کافی ندارید.",
            "🪙"
        );

        return;
    }

    const roomCode =
        generateRoomCode();

    state.currentRoom = {

        code: roomCode,

        name:
            roomName ||
            "اتاق حکم",

        entryFee,

        isPrivate,

        host:
            state.player.name,

        players: [
            {
                id: "local-player",
                name: state.player.name,
                seat: 0,
                team: "A",
                ready: true,
                local: true
            }
        ],

        createdAt: Date.now()
    };

    updateRoomUI();

    showScreen(
        "roomScreen"
    );

    showToast(
        `اتاق ${roomCode} ساخته شد.`,
        "🎮",
        3500
    );
}

/* ================================================================
   13. JOIN ROOM
================================================================ */

function openJoinRoom() {

    const input =
        getElement("roomCodeInput");

    if (input) {
        input.value = "";
        input.focus();
    }

    showScreen(
        "joinRoomScreen"
    );
}

function joinRoom() {

    const input =
        getElement("roomCodeInput");

    if (!input) {
        return;
    }

    const code =
        input.value
            .replace(/\D/g, "")
            .slice(0, 6);

    input.value =
        code;

    if (code.length !== 6) {

        showToast(
            "کد اتاق باید ۶ رقمی باشد.",
            "⚠️"
        );

        return;
    }

    state.currentRoom = {

        code,

        name:
            "اتاق آنلاین",

        entryFee: 0,

        isPrivate: true,

        host:
            "میزبان",

        players: [
            {
                id: "host-player",
                name: "میزبان",
                seat: 0,
                team: "A",
                ready: true,
                local: false
            },
            {
                id: "local-player",
                name: state.player.name,
                seat: 1,
                team: "B",
                ready: true,
                local: true
            }
        ],

        createdAt: Date.now()
    };

    updateRoomUI();

    showScreen(
        "roomScreen"
    );

    showToast(
        "به اتاق آزمایشی وارد شدی.",
        "🚪"
    );
}

/* ================================================================
   14. ROOM UI
================================================================ */

function updateRoomUI() {

    if (!state.currentRoom) {
        return;
    }

    const codeElement =
        getElement("currentRoomCode");

    if (codeElement) {

        codeElement.textContent =
            state.currentRoom.code;
    }

    const players =
        state.currentRoom.players;

    for (
        let seat = 0;
        seat < 4;
        seat++
    ) {

        const container =
            getElement(
                `roomPlayer${seat + 1}`
            );

        if (!container) {
            continue;
        }

        const player =
            players.find(
                p => p.seat === seat
            );

        updateRoomPlayerElement(
            container,
            player,
            seat
        );
    }

    const startButton =
        getElement("startGameButton");

    if (startButton) {

        const full =
            players.length >= 4;

        startButton.disabled =
            !full;
    }
}

function updateRoomPlayerElement(
    element,
    player,
    seat
) {

    if (!player) {

        element.className =
            "room-player empty-player";

        element.innerHTML = `
            <div class="room-player-avatar">
                +
            </div>

            <div class="room-player-info">

                <strong>
                    جای خالی
                </strong>

                <span>
                    منتظر بازیکن
                </span>

            </div>
        `;

        return;
    }

    element.className =
        "room-player";

    element.innerHTML = `
        <div class="room-player-avatar">
            ${player.local ? "👤" : "🧑"}
        </div>

        <div class="room-player-info">

            <strong>
                ${escapeHtml(player.name)}
            </strong>

            <span>
                تیم ${player.team}
            </span>

        </div>

        <span class="ready-badge">
            آماده
        </span>
    `;
}

/* ================================================================
   15. ESCAPE HTML
================================================================ */

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ================================================================
   16. COPY ROOM CODE
================================================================ */

async function copyRoomCode() {

    if (!state.currentRoom) {
        return;
    }

    const code =
        state.currentRoom.code;

    try {

        if (
            navigator.clipboard &&
            navigator.clipboard.writeText
        ) {

            await navigator.clipboard.writeText(
                code
            );

        } else {

            const textarea =
                document.createElement(
                    "textarea"
                );

            textarea.value =
                code;

            document.body.appendChild(
                textarea
            );

            textarea.select();

            document.execCommand(
                "copy"
            );

            textarea.remove();
        }

        showToast(
            "کد اتاق کپی شد.",
            "📋"
        );

    } catch (error) {

        console.error(error);

        showToast(
            `کد اتاق: ${code}`,
            "🎮",
            5000
        );
    }
}

/* ================================================================
   17. DECK CREATION
================================================================ */

function createDeck() {

    const deck = [];

    SUIT_ORDER.forEach(
        (suit) => {

            RANKS.forEach(
                (rank) => {

                    deck.push({

                        id:
                            `${suit}-${rank.value}`,

                        suit,

                        rank:
                            rank.value,

                        label:
                            rank.label
                    });
                }
            );
        }
    );

    return deck;
}

/* ================================================================
   18. SHUFFLE
================================================================ */

function shuffleDeck(deck) {

    const shuffled =
        [...deck];

    for (
        let i = shuffled.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            shuffled[i],
            shuffled[j]
        ] = [
            shuffled[j],
            shuffled[i]
        ];
    }

    return shuffled;
}

/* ================================================================
   19. CREATE DEMO PLAYERS
================================================================ */

function createDemoPlayers() {

    return [

        {
            id: "player-1",
            name: state.player.name,
            seat: 0,
            team: "A",
            local: true
        },

        {
            id: "player-2",
            name: "بازیکن شمال",
            seat: 1,
            team: "B",
            local: false
        },

        {
            id: "player-3",
            name: "بازیکن جنوب",
            seat: 2,
            team: "A",
            local: false
        },

        {
            id: "player-4",
            name: "بازیکن شرق",
            seat: 3,
            team: "B",
            local: false
        }
    ];
}

/* ================================================================
   20. START DEMO GAME
================================================================ */

function startGame() {

    state.game = {

        active: true,

        phase: "dealing",

        players:
            createDemoPlayers(),

        deck:
            shuffleDeck(
                createDeck()
            ),

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

    showLoading(
        "در حال پخش کارت‌ها..."
    );

    setTimeout(
        () => {

            hideLoading();

            state.game.phase =
                "trump-selection";

            state.game.currentTurn =
                0;

            showScreen(
                "trumpScreen"
            );

            showToast(
                "حکم را انتخاب کن.",
                "👑",
                3500
            );

        },
        700
    );
}

/* ================================================================
   21. INITIALIZE HANDS
================================================================ */

function initializeHands() {

    const players =
        state.game.players;

    const hands = {};

    players.forEach(
        player => {

            hands[player.id] = [];
        }
    );

    for (
        let i = 0;
        i < 13;
        i++
    ) {

        players.forEach(
            player => {

                const card =
                    state.game.deck.pop();

                if (card) {

                    hands[player.id].push(
                        card
                    );
                }
            }
        );
    }

    Object.keys(hands).forEach(
        playerId => {

            hands[playerId].sort(
                compareCards
            );
        }
    );

    state.game.hands =
        hands;
}

/* ================================================================
   22. COMPARE CARDS
================================================================ */

function compareCards(a, b) {

    const suitA =
        SUIT_ORDER.indexOf(a.suit);

    const suitB =
        SUIT_ORDER.indexOf(b.suit);

    if (suitA !== suitB) {
        return suitA - suitB;
    }

    return a.rank - b.rank;
}

/* ================================================================
   23. SET TRUMP
================================================================ */

function setTrumpSuit(suit) {

    if (!SUITS[suit]) {
        return;
    }

    state.game.trumpSuit =
        suit;

    state.game.phase =
        "playing";

    state.game.leadSuit =
        null;

    state.game.trick =
        [];

    state.game.trickNumber =
        0;

    state.game.currentTurn =
        state.game.leader;

    updateTrumpUI();

    showScreen(
        "gameScreen"
    );

    renderPlayerHand();

    updateGameUI();

    showToast(
        `حکم ${SUITS[suit].name} انتخاب شد.`,
        "👑",
        3000
    );

    runComputerTurnIfNeeded();
}

/* ================================================================
   24. TRUMP UI
================================================================ */

function updateTrumpUI() {

    const element =
        getElement("trumpSuit");

    if (!element) {
        return;
    }

    if (!state.game.trumpSuit) {

        element.textContent =
            "-";

        return;
    }

    element.textContent =
        SUITS[
            state.game.trumpSuit
        ].symbol;
}

/* ================================================================
   25. RENDER PLAYER HAND
================================================================ */

function renderPlayerHand() {

    const container =
        getElement("playerHand");

    if (!container) {
        return;
    }

    container.innerHTML =
        "";

    const localPlayer =
        state.game.players.find(
            player =>
                player.local
        );

    if (!localPlayer) {
        return;
    }

    const hand =
        state.game.hands[
            localPlayer.id
        ] || [];

    const playable =
        getPlayableCards(
            localPlayer.id
        );

    hand.forEach(
        card => {

            const cardElement =
                createCardElement(
                    card
                );

            const isPlayable =
                playable.some(
                    playableCard =>
                        playableCard.id ===
                        card.id
                );

            if (
                state.game.currentTurn ===
                localPlayer.seat &&
                state.game.phase ===
                "playing" &&
                isPlayable
            ) {

                cardElement.classList.add(
                    "playable"
                );

                cardElement.addEventListener(
                    "click",
                    () => {

                        playLocalCard(
                            card.id
                        );
                    }
                );

            } else {

                cardElement.classList.add(
                    "disabled"
                );
            }

            container.appendChild(
                cardElement
            );
        }
    );
}

/* ================================================================
   26. CREATE CARD ELEMENT
================================================================ */

function createCardElement(card) {

    const element =
        document.createElement(
            "button"
        );

    element.type =
        "button";

    element.className =
        "playing-card";

    if (
        SUITS[card.suit].color ===
        "red"
    ) {

        element.classList.add(
            "red-card"
        );

    } else {

        element.classList.add(
            "black-card"
        );
    }

    const suit =
        SUITS[card.suit];

    element.innerHTML = `

        <span class="card-corner top-corner">

            <strong>
                ${escapeHtml(card.label)}
            </strong>

            <span>
                ${suit.symbol}
            </span>

        </span>

        <span class="card-center-symbol">
            ${suit.symbol}
        </span>

        <span class="card-corner bottom-corner">

            <strong>
                ${escapeHtml(card.label)}
            </strong>

            <span>
                ${suit.symbol}
            </span>

        </span>
    `;

    return element;
}

/* ================================================================
   27. GET LOCAL PLAYER
================================================================ */

function getLocalPlayer() {

    return state.game.players.find(
        player =>
            player.local
    );
}

/* ================================================================
   28. GET PLAYABLE CARDS
================================================================ */

function getPlayableCards(playerId) {

    const hand =
        state.game.hands[playerId] ||
        [];

    if (
        !state.game.leadSuit ||
        state.game.trick.length === 0
    ) {

        return hand;
    }

    const sameSuitCards =
        hand.filter(
            card =>
                card.suit ===
                state.game.leadSuit
        );

    if (sameSuitCards.length > 0) {

        return sameSuitCards;
    }

    return hand;
}

/* ================================================================
   29. PLAY LOCAL CARD
================================================================ */

function playLocalCard(cardId) {

    const player =
        getLocalPlayer();

    if (!player) {
        return;
    }

    if (
        state.game.currentTurn !==
        player.seat
    ) {

        showToast(
            "الان نوبت شما نیست.",
            "⏳"
        );

        return;
    }

    if (
        state.game.phase !==
        "playing"
    ) {

        return;
    }

    const hand =
        state.game.hands[
            player.id
        ];

    const cardIndex =
        hand.findIndex(
            card =>
                card.id ===
                cardId
        );

    if (cardIndex === -1) {

        showToast(
            "این کارت در دست شما نیست.",
            "⚠️"
        );

        return;
    }

    const card =
        hand[cardIndex];

    const playable =
        getPlayableCards(
            player.id
        );

    const allowed =
        playable.some(
            playableCard =>
                playableCard.id ===
                card.id
        );

    if (!allowed) {

        showToast(
            "باید از خال شروع‌شده بازی کنی.",
            "⚠️"
        );

        return;
    }

    hand.splice(
        cardIndex,
        1
    );

    playCard(
        player,
        card
    );
}

/* ================================================================
   30. PLAY CARD
================================================================ */

function playCard(
    player,
    card
) {

    if (
        state.game.trick.length ===
        0
    ) {

        state.game.leadSuit =
            card.suit;
    }

    state.game.trick.push({

        playerId:
            player.id,

        seat:
            player.seat,

        card
    });

    renderTable();

    updateGameUI();

    if (
        state.game.trick.length >= 4
    ) {

        setTimeout(
            resolveTrick,
            900
        );

        return;
    }

    state.game.currentTurn =
        (player.seat + 1) % 4;

    renderPlayerHand();

    updateGameUI();

    runComputerTurnIfNeeded();
}

/* ================================================================
   31. RUN COMPUTER TURN
================================================================ */

function runComputerTurnIfNeeded() {

    if (
        !state.game.active ||
        state.game.phase !==
        "playing"
    ) {

        return;
    }

    const currentSeat =
        state.game.currentTurn;

    const player =
        state.game.players.find(
            p =>
                p.seat ===
                currentSeat
        );

    if (!player) {
        return;
    }

    if (player.local) {
        return;
    }

    setTimeout(
        () => {

            if (
                state.game.phase !==
                "playing"
            ) {
                return;
            }

            const playable =
                getPlayableCards(
                    player.id
                );

            if (
                playable.length === 0
            ) {
                return;
            }

            const card =
                chooseComputerCard(
                    playable
                );

            const hand =
                state.game.hands[
                    player.id
                ];

            const index =
                hand.findIndex(
                    item =>
                        item.id ===
                        card.id
                );

            if (index !== -1) {

                hand.splice(
                    index,
                    1
                );
            }

            playCard(
                player,
                card
            );

        },
        750
    );
}

/* ================================================================
   32. COMPUTER CARD AI
================================================================ */

function chooseComputerCard(
    playableCards
) {

    const sorted =
        [...playableCards].sort(
            compareCards
        );

    if (
        state.game.trick.length > 0 &&
        state.game.trumpSuit
    ) {

        const trumpCards =
            sorted.filter(
                card =>
                    card.suit ===
                    state.game.trumpSuit
            );

        if (
            trumpCards.length > 0
        ) {

            return trumpCards[0];
        }
    }

    return sorted[0];
}

/* ================================================================
   33. RENDER TABLE
================================================================ */

function renderTable() {

    const positions = [
        "playedCardBottom",
        "playedCardLeft",
        "playedCardTop",
        "playedCardRight"
    ];

    positions.forEach(
        id => {

            const element =
                getElement(id);

            if (element) {
                element.innerHTML =
                    "";
            }
        }
    );

    state.game.trick.forEach(
        item => {

            const position =
                getTablePosition(
                    item.seat
                );

            const container =
                getElement(
                    position
                );

            if (!container) {
                return;
            }

            const card =
                createCardElement(
                    item.card
                );

            card.classList.remove(
                "disabled"
            );

            card.classList.add(
                "table-card"
            );

            container.appendChild(
                card
            );
        }
    );
}

/* ================================================================
   34. TABLE POSITION
================================================================ */

function getTablePosition(seat) {

    const map = {

        0: "playedCardBottom",

        1: "playedCardLeft",

        2: "playedCardTop",

        3: "playedCardRight"
    };

    return (
        map[seat] ||
        "playedCardBottom"
    );
}

/* ================================================================
   35. RESOLVE TRICK
================================================================ */

function resolveTrick() {

    if (
        state.game.trick.length !==
        4
    ) {
        return;
    }

    const winner =
        determineTrickWinner(
            state.game.trick
        );

    const winnerPlayer =
        state.game.players.find(
            player =>
                player.id ===
                winner.playerId
        );

    if (!winnerPlayer) {
        return;
    }

    if (
        winnerPlayer.team ===
        "A"
    ) {

        state.game.teamATricks++;

    } else {

        state.game.teamBTricks++;
    }

    state.game.trickNumber++;

    showToast(
        `${winnerPlayer.name} دست را برد.`,
        "🏆",
        1800
    );

    setTimeout(
        () => {

            state.game.trick =
                [];

            state.game.leadSuit =
                null;

            state.game.currentTurn =
                winnerPlayer.seat;

            renderTable();

            updateGameUI();

            if (
                state.game.teamATricks >= 7 ||
                state.game.teamBTricks >= 7
            ) {

                finishRound();

                return;
            }

            if (
                state.game.trickNumber >= 13
            ) {

                finishRound();

                return;
            }

            renderPlayerHand();

            runComputerTurnIfNeeded();

        },
        900
    );
}

/* ================================================================
   36. DETERMINE TRICK WINNER
================================================================ */

function determineTrickWinner(
    trick
) {

    let winner =
        trick[0];

    for (
        let i = 1;
        i < trick.length;
        i++
    ) {

        const current =
            trick[i];

        if (
            cardBeats(
                current.card,
                winner.card,
                state.game.leadSuit,
                state.game.trumpSuit
            )
        ) {

            winner =
                current;
        }
    }

    return winner;
}

/* ================================================================
   37. CARD COMPARISON
================================================================ */

function cardBeats(
    challenger,
    currentWinner,
    leadSuit,
    trumpSuit
) {

    const challengerIsTrump =
        challenger.suit ===
        trumpSuit;

    const winnerIsTrump =
        currentWinner.suit ===
        trumpSuit;

    if (
        challengerIsTrump &&
        !winnerIsTrump
    ) {

        return true;
    }

    if (
        !challengerIsTrump &&
        winnerIsTrump
    ) {

        return false;
    }

    if (
        challengerIsTrump &&
        winnerIsTrump
    ) {

        return (
            challenger.rank >
            currentWinner.rank
        );
    }

    const challengerIsLead =
        challenger.suit ===
        leadSuit;

    const winnerIsLead =
        currentWinner.suit ===
        leadSuit;

    if (
        challengerIsLead &&
        !winnerIsLead
    ) {

        return true;
    }

    if (
        !challengerIsLead &&
        winnerIsLead
    ) {

        return false;
    }

    if (
        challengerIsLead &&
        winnerIsLead
    ) {

        return (
            challenger.rank >
            currentWinner.rank
        );
    }

    return false;
}

/* ================================================================
   38. UPDATE GAME UI
================================================================ */

function updateGameUI() {

    const teamAScore =
        getElement("teamAScore");

    const teamBScore =
        getElement("teamBScore");

    const turnMessage =
        getElement("turnMessage");

    if (teamAScore) {

        teamAScore.textContent =
            state.game.teamAScore;
    }

    if (teamBScore) {

        teamBScore.textContent =
            state.game.teamBScore;
    }

    if (turnMessage) {

        const localPlayer =
            getLocalPlayer();

        if (
            localPlayer &&
            state.game.currentTurn ===
            localPlayer.seat
        ) {

            turnMessage.textContent =
                "نوبت شماست!";

        } else {

            const player =
                state.game.players.find(
                    p =>
                        p.seat ===
                        state.game.currentTurn
                );

            turnMessage.textContent =
                player
                    ? `نوبت ${player.name}`
                    : "منتظر نوبت...";
        }
    }

    updateOpponentCardCounts();

    updateTrumpUI();
}

/* ================================================================
   39. OPPONENT CARD COUNTS
================================================================ */

function updateOpponentCardCounts() {

    const player2 =
        state.game.players.find(
            p => p.seat === 1
        );

    const player3 =
        state.game.players.find(
            p => p.seat === 2
        );

    const player4 =
        state.game.players.find(
            p => p.seat === 3
        );

    if (player2) {

        const name =
            getElement(
                "opponentTopName"
            );

        const cards =
            getElement(
                "opponentTopCards"
            );

        if (name) {
            name.textContent =
                player2.name;
        }

        if (cards) {

            cards.textContent =
                state.game.hands[
                    player2.id
                ]?.length || 0;
        }
    }

    if (player3) {

        const name =
            getElement(
                "opponentLeftName"
            );

        const cards =
            getElement(
                "opponentLeftCards"
            );

        if (name) {
            name.textContent =
                player3.name;
        }

        if (cards) {

            cards.textContent =
                state.game.hands[
                    player3.id
                ]?.length || 0;
        }
    }

    if (player4) {

        const name =
            getElement(
                "opponentRightName"
            );

        const cards =
            getElement(
                "opponentRightCards"
            );

        if (name) {
            name.textContent =
                player4.name;
        }

        if (cards) {

            cards.textContent =
                state.game.hands[
                    player4.id
                ]?.length || 0;
        }
    }
}

/* ================================================================
   40. FINISH ROUND
================================================================ */

function finishRound() {

    state.game.phase =
        "round-finished";

    const teamAWon =
        state.game.teamATricks >
        state.game.teamBTricks;

    const teamBWon =
        state.game.teamBTricks >
        state.game.teamATricks;

    if (teamAWon) {

        state.game.teamAScore++;

    } else if (teamBWon) {

        state.game.teamBScore++;
    }

    state.player.gamesPlayed++;

    if (teamAWon) {

        state.player.gamesWon++;

        state.player.coins +=
            100;

    } else {

        state.player.coins +=
            25;
    }

    savePlayer();

    updatePlayerUI();

    const resultTitle =
        teamAWon
            ? "بردی! 🎉"
            : "این دست را باختی";

    const resultText =
        teamAWon
            ? "تیم شما برنده راند شد."
            : "تیم حریف این راند را برد.";

    openModal(`

        <div class="result-modal">

            <div class="result-icon">
                ${teamAWon ? "🏆" : "🃏"}
            </div>

            <h2>
                ${resultTitle}
            </h2>

            <p>
                ${resultText}
            </p>

            <div class="result-score">

                <div>

                    <span>
                        تیم شما
                    </span>

                    <strong>
                        ${state.game.teamATricks}
                    </strong>

                </div>

                <div>

                    <span>
                        تیم حریف
                    </span>

                    <strong>
                        ${state.game.teamBTricks}
                    </strong>

                </div>

            </div>

            <div class="result-reward">

                <span>
                    پاداش
                </span>

                <strong>
                    🪙 ${teamAWon ? "100" : "25"}
                </strong>

            </div>

            <button
                id="backToHomeAfterGame"
                class="primary-button"
                type="button"
            >
                بازگشت به خانه
            </button>

        </div>

    `);

    const backButton =
        getElement(
            "backToHomeAfterGame"
        );

    if (backButton) {

        backButton.addEventListener(
            "click",
            () => {

                closeModal();

                state.game.active =
                    false;

                state.currentRoom =
                    null;

                showScreen(
                    "homeScreen"
                );

            }
        );
    }
}

/* ================================================================
   41. LEAVE ROOM
================================================================ */

function leaveRoom() {

    state.currentRoom =
        null;

    state.game.active =
        false;

    state.game.phase =
        "idle";

    showScreen(
        "homeScreen"
    );

    showToast(
        "از اتاق خارج شدی.",
        "🚪"
    );
}

/* ================================================================
   42. EDIT PROFILE
================================================================ */

function editProfile() {

    const currentName =
        escapeHtml(
            state.player.name
        );

    openModal(`

        <div class="profile-edit-modal">

            <h2>
                ویرایش پروفایل
            </h2>

            <p>
                نام بازیکن را تغییر بده.
            </p>

            <label
                for="editNameInput"
                class="modal-label"
            >
                نام
            </label>

            <input
                id="editNameInput"
                class="modal-input"
                type="text"
                maxlength="20"
                value="${currentName}"
                autocomplete="off"
            >

            <button
                id="saveProfileButton"
                class="primary-button"
                type="button"
            >
                ذخیره
            </button>

        </div>

    `);

    const saveButton =
        getElement(
            "saveProfileButton"
        );

    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveProfile
        );
    }
}

/* ================================================================
   43. SAVE PROFILE
================================================================ */

function saveProfile() {

    const input =
        getElement(
            "editNameInput"
        );

    if (!input) {
        return;
    }

    const name =
        input.value.trim();

    if (
        name.length < 2
    ) {

        showToast(
            "نام باید حداقل ۲ حرف داشته باشد.",
            "⚠️"
        );

        return;
    }

    state.player.name =
        name.slice(0, 20);

    savePlayer();

    updatePlayerUI();

    closeModal();

    showToast(
        "پروفایل ذخیره شد.",
        "✅"
    );
}

/* ================================================================
   44. SHOP
================================================================ */

function buyShopItem(
    item,
    price
) {

    if (
        state.player.inventory.includes(
            item
        )
    ) {

        showToast(
            "این آیتم را قبلاً داری.",
            "✅"
        );

        return;
    }

    if (
        state.player.coins <
        price
    ) {

        showToast(
            "سکه کافی نداری.",
            "🪙"
        );

        return;
    }

    state.player.coins -=
        price;

    state.player.inventory.push(
        item
    );

    savePlayer();

    updatePlayerUI();

    showToast(
        "آیتم با موفقیت خریداری شد.",
        "🎁"
    );

    refreshShopButtons();
}

/* ================================================================
   45. REFRESH SHOP BUTTONS
================================================================ */

function refreshShopButtons() {

    queryAll(
        ".shop-buy-button"
    ).forEach(
        button => {

            const item =
                button.dataset.item;

            const owned =
                state.player.inventory.includes(
                    item
                );

            if (owned) {

                button.textContent =
                    "✓ خریداری شده";

                button.disabled =
                    true;

            } else {

                const price =
                    Number(
                        button.dataset.price ||
                        0
                    );

                button.textContent =
                    `🪙 ${formatNumber(price)}`;

                button.disabled =
                    false;
            }
        }
    );
}

/* ================================================================
   46. LEADERBOARD
================================================================ */

function setupLeaderboard() {

    queryAll(
        ".leaderboard-tab"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    queryAll(
                        ".leaderboard-tab"
                    ).forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );
                        }
                    );

                    button.classList.add(
                        "active"
                    );

                    showToast(
                        "رتبه‌بندی فعلاً آزمایشی است.",
                        "🏆"
                    );
                }
            );
        }
    );
}

/* ================================================================
   47. QUICK PLAY
================================================================ */

function quickPlay() {

    state.currentRoom = {

        code:
            generateRoomCode(),

        name:
            "بازی سریع",

        entryFee:
            0,

        isPrivate:
            false,

        host:
            state.player.name,

        players:
            createDemoPlayers(),

        createdAt:
            Date.now()
    };

    updateRoomUI();

    const startButton =
        getElement(
            "startGameButton"
        );

    if (startButton) {
        startButton.disabled =
            false;
    }

    showScreen(
        "roomScreen"
    );

    showToast(
        "۴ بازیکن آزمایشی وارد شدند.",
        "👥"
    );
}

/* ================================================================
   48. CHAT
================================================================ */

function openGameChat() {

    openModal(`

        <div class="chat-modal">

            <h2>
                💬 چت بازی
            </h2>

            <div class="chat-messages">

                <div class="chat-message">
                    <strong>بازیکن شمال:</strong>
                    موفق باشید!
                </div>

                <div class="chat-message">
                    <strong>بازیکن شرق:</strong>
                    بازی خوبی داشته باشیم.
                </div>

            </div>

            <div class="chat-input-row">

                <input
                    id="chatInput"
                    class="modal-input"
                    type="text"
                    maxlength="100"
                    placeholder="پیام..."
                    autocomplete="off"
                >

                <button
                    id="sendChatButton"
                    class="secondary-button"
                    type="button"
                >
                    ارسال
                </button>

            </div>

        </div>

    `);

    const sendButton =
        getElement(
            "sendChatButton"
        );

    if (sendButton) {

        sendButton.addEventListener(
            "click",
            () => {

                const input =
                    getElement(
                        "chatInput"
                    );

                if (
                    !input ||
                    !input.value.trim()
                ) {
                    return;
                }

                showToast(
                    "پیام در نسخه آنلاین ارسال خواهد شد.",
                    "💬"
                );

                input.value =
                    "";
            }
        );
    }
}

/* ================================================================
   49. GAME MENU
================================================================ */

function openGameMenu() {

    openModal(`

        <div class="game-menu-modal">

            <h2>
                منوی بازی
            </h2>

            <button
                id="resumeGameButton"
                class="primary-button"
                type="button"
            >
                ادامه بازی
            </button>

            <button
                id="exitGameButton"
                class="danger-button full-width"
                type="button"
            >
                خروج از بازی
            </button>

        </div>

    `);

    const resume =
        getElement(
            "resumeGameButton"
        );

    const exit =
        getElement(
            "exitGameButton"
        );

    if (resume) {

        resume.addEventListener(
            "click",
            closeModal
        );
    }

    if (exit) {

        exit.addEventListener(
            "click",
            () => {

                closeModal();

                state.game.active =
                    false;

                state.currentRoom =
                    null;

                showScreen(
                    "homeScreen"
                );

                showToast(
                    "از بازی خارج شدی.",
                    "🚪"
                );
            }
        );
    }
}

/* ================================================================
   50. PROFILE BUTTON
================================================================ */

function openProfileFromHeader() {

    showScreen(
        "profileScreen"
    );
}

/* ================================================================
   51. SETTINGS
================================================================ */

function openSettings() {

    openModal(`

        <div class="settings-modal">

            <h2>
                ⚙️ تنظیمات
            </h2>

            <label class="switch-row">

                <span>
                    صدای بازی
                </span>

                <input
                    id="soundSwitch"
                    type="checkbox"
                    ${state.settings.sound ? "checked" : ""}
                >

                <span class="switch"></span>

            </label>

            <button
                id="closeSettingsButton"
                class="primary-button"
                type="button"
            >
                ذخیره
            </button>

        </div>

    `);

    const soundSwitch =
        getElement(
            "soundSwitch"
        );

    const saveButton =
        getElement(
            "closeSettingsButton"
        );

    if (saveButton) {

        saveButton.addEventListener(
            "click",
            () => {

                if (soundSwitch) {

                    state.settings.sound =
                        soundSwitch.checked;
                }

                closeModal();

                showToast(
                    "تنظیمات ذخیره شد.",
                    "✅"
                );
            }
        );
    }
}

/* ================================================================
   52. LOGOUT
================================================================ */

function logoutPlayer() {

    openModal(`

        <div class="confirm-modal">

            <div class="result-icon">
                🚪
            </div>

            <h2>
                خروج
            </h2>

            <p>
                در نسخه فعلی اطلاعات بازیکن روی همین دستگاه ذخیره می‌شود.
            </p>

            <button
                id="confirmLogoutButton"
                class="danger-button full-width"
                type="button"
            >
                پاک کردن اطلاعات محلی
            </button>

            <button
                id="cancelLogoutButton"
                class="secondary-button full-width"
                type="button"
            >
                انصراف
            </button>

        </div>

    `);

    const confirmButton =
        getElement(
            "confirmLogoutButton"
        );

    const cancelButton =
        getElement(
            "cancelLogoutButton"
        );

    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            () => {

                localStorage.removeItem(
                    STORAGE_KEY
                );

                state.player = {
                    ...DEFAULT_PLAYER
                };

                updatePlayerUI();

                closeModal();

                showToast(
                    "اطلاعات محلی پاک شد.",
                    "✅"
                );
            }
        );
    }

    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeModal
        );
    }
}

/* ================================================================
   53. FORMAT ROOM CODE INPUT
================================================================ */

function setupRoomCodeInput() {

    const input =
        getElement(
            "roomCodeInput"
        );

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        () => {

            input.value =
                input.value
                    .replace(/\D/g, "")
                    .slice(0, 6);
        }
    );
}

/* ================================================================
   54. INITIAL EVENT LISTENERS
================================================================ */

function setupNavigation() {

    queryAll(
        ".nav-item"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const target =
                        button.dataset.screen;

                    if (target) {

                        showScreen(
                            target
                        );
                    }
                }
            );
        }
    );
}

function setupBackButtons() {

    queryAll(
        "[data-back]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const target =
                        button.dataset.back;

                    if (target) {

                        showScreen(
                            target
                        );
                    }
                }
            );
        }
    );
}

function setupMainButtons() {

    const quickPlayButton =
        getElement(
            "quickPlayButton"
        );

    if (quickPlayButton) {

        quickPlayButton.addEventListener(
            "click",
            quickPlay
        );
    }

    const createRoomButton =
        getElement(
            "createRoomButton"
        );

    if (createRoomButton) {

        createRoomButton.addEventListener(
            "click",
            openCreateRoom
        );
    }

    const joinRoomButton =
        getElement(
            "joinRoomButton"
        );

    if (joinRoomButton) {

        joinRoomButton.addEventListener(
            "click",
            openJoinRoom
        );
    }

    const confirmCreateRoomButton =
        getElement(
            "confirmCreateRoomButton"
        );

    if (confirmCreateRoomButton) {

        confirmCreateRoomButton.addEventListener(
            "click",
            createRoom
        );
    }

    const confirmJoinRoomButton =
        getElement(
            "confirmJoinRoomButton"
        );

    if (confirmJoinRoomButton) {

        confirmJoinRoomButton.addEventListener(
            "click",
            joinRoom
        );
    }

    const leaveRoomButton =
        getElement(
            "leaveRoomButton"
        );

    if (leaveRoomButton) {

        leaveRoomButton.addEventListener(
            "click",
            leaveRoom
        );
    }

    const copyRoomCodeButton =
        getElement(
            "copyRoomCodeButton"
        );

    if (copyRoomCodeButton) {

        copyRoomCodeButton.addEventListener(
            "click",
            copyRoomCode
        );
    }

    const startGameButton =
        getElement(
            "startGameButton"
        );

    if (startGameButton) {

        startGameButton.addEventListener(
            "click",
            startGame
        );
    }

    const profileButton =
        getElement(
            "profileButton"
        );

    if (profileButton) {

        profileButton.addEventListener(
            "click",
            openProfileFromHeader
        );
    }

    const settingsButton =
        getElement(
            "settingsButton"
        );

    if (settingsButton) {

        settingsButton.addEventListener(
            "click",
            openSettings
        );
    }

    const editProfileButton =
        getElement(
            "editProfileButton"
        );

    if (editProfileButton) {

        editProfileButton.addEventListener(
            "click",
            editProfile
        );
    }

    const logoutButton =
        getElement(
            "logoutButton"
        );

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logoutPlayer
        );
    }

    const gameChatButton =
        getElement(
            "gameChatButton"
        );

    if (gameChatButton) {

        gameChatButton.addEventListener(
            "click",
            openGameChat
        );
    }

    const gameMenuButton =
        getElement(
            "gameMenuButton"
        );

    if (gameMenuButton) {

        gameMenuButton.addEventListener(
            "click",
            openGameMenu
        );
    }
}

/* ================================================================
   55. TRUMP BUTTONS
================================================================ */

function setupTrumpButtons() {

    queryAll(
        ".suit-button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const suit =
                        button.dataset.suit;

                    setTrumpSuit(
                        suit
                    );
                }
            );
        }
    );
}

/* ================================================================
   56. SHOP BUTTONS
================================================================ */

function setupShopButtons() {

    queryAll(
        ".shop-buy-button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const item =
                        button.dataset.item;

                    const price =
                        Number(
                            button.dataset.price ||
                            0
                        );

                    buyShopItem(
                        item,
                        price
                    );
                }
            );
        }
    );
}

/* ================================================================
   57. MODAL EVENTS
================================================================ */

function setupModal() {

    const closeButton =
        getElement(
            "closeModalButton"
        );

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeModal
        );
    }

    const overlay =
        getElement(
            "modalOverlay"
        );

    if (overlay) {

        overlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    overlay
                ) {

                    closeModal();
                }
            }
        );
    }
}

/* ================================================================
   58. KEYBOARD EVENTS
================================================================ */

function setupKeyboard() {

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Escape"
            ) {

                closeModal();
            }
        }
    );
}

/* ================================================================
   59. PREVENT DOUBLE TAP ZOOM
================================================================ */

function preventDoubleTapZoom() {

    let lastTouchEnd =
        0;

    document.addEventListener(
        "touchend",
        (event) => {

            const now =
                Date.now();

            if (
                now - lastTouchEnd <=
                300
            ) {

                event.preventDefault();
            }

            lastTouchEnd =
                now;
        },
        {
            passive: false
        }
    );
}

/* ================================================================
   60. INITIALIZATION
================================================================ */

function initializeApp() {

    loadPlayer();

    updatePlayerUI();

    setupNavigation();

    setupBackButtons();

    setupMainButtons();

    setupTrumpButtons();

    setupShopButtons();

    setupLeaderboard();

    setupRoomCodeInput();

    setupModal();

    setupKeyboard();

    preventDoubleTapZoom();

    refreshShopButtons();

    showScreen(
        "homeScreen"
    );

    console.log(
        "Hokm Online initialized successfully."
    );
}

/* ================================================================
   61. START APPLICATION
================================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();
}
