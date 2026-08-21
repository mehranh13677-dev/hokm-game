"use strict";

/* ================================================================
   HOKM ONLINE - shop.js
   ================================================================ */

function shopGetSupabaseClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
        return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
        return window.supabase;
    }
    console.error("Shop: Supabase Client پیدا نشد.");
    return null;
}

const shopState = {
    initialized: false,
    loading: false,
    items: [],
    inventory: [],
    filteredItems: [],
    currentCategory: "all",
    searchText: "",
    currentUser: null,
    currentProfile: null,
    selectedItem: null,
    activeItems: {
        cardTheme: null,
        avatar: null,
        tableTheme: null,
        other: []
    },
    coinPackages: [
        {
            id: "coins-200",
            coins: 200,
            price: 25000,
            currency: "تومان",
            title: "بسته ۲۰۰ سکه",
            description: "۲۰۰ سکه مجازی برای استفاده در بازی"
        },
        {
            id: "coins-600",
            coins: 600,
            price: 40000,
            currency: "تومان",
            title: "بسته ۶۰۰ سکه",
            description: "۶۰۰ سکه مجازی برای استفاده در بازی"
        },
        {
            id: "coins-1200",
            coins: 1200,
            price: 80000,
            currency: "تومان",
            title: "بسته ۱۲۰۰ سکه",
            description: "۱۲۰۰ سکه مجازی برای استفاده در بازی"
        }
    ]
};

const shopEvents = {
    listeners: {},
    on(eventName, callback) {
        if (typeof callback !== "function") return;
        if (!this.listeners[eventName]) this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    },
    emit(eventName, data) {
        const listeners = this.listeners[eventName] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Shop Event Error: ${eventName}`, error);
            }
        });
    }
};

function shopToast(message, icon = "🛍️", duration = 3000) {
    if (typeof window.showToast === "function") {
        window.showToast(message, icon, duration);
        return;
    }
    console.log(`${icon} ${message}`);
}

function shopLoading(show, message = "لطفاً صبر کنید...") {
    if (show && typeof window.showLoading === "function") {
        window.showLoading(message);
        return;
    }
    if (!show && typeof window.hideLoading === "function") {
        window.hideLoading();
    }
}

function shopGetCurrentUser() {
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentUser === "function") {
        return window.hokmAuth.getCurrentUser();
    }
    return shopState.currentUser;
}

function shopGetCurrentProfile() {
    if (window.hokmAuth && typeof window.hokmAuth.getCurrentProfile === "function") {
        return window.hokmAuth.getCurrentProfile();
    }
    return shopState.currentProfile;
}

function shopSyncUserState() {
    shopState.currentUser = shopGetCurrentUser();
    shopState.currentProfile = shopGetCurrentProfile();
    shopSyncGameState();
}

function shopSyncGameState() {
    const profile = shopState.currentProfile;
    if (!profile) return;

    if (window.state && window.state.player) {
        if (profile.coins !== undefined) {
            window.state.player.coins = Number(profile.coins);
        }
        if (profile.level !== undefined) {
            window.state.player.level = Number(profile.level);
        }
    }

    if (typeof window.updatePlayerUI === "function") window.updatePlayerUI();
    if (typeof window.updateCoinsUI === "function") window.updateCoinsUI();
}

function formatShopCoins(amount) {
    return Number(amount || 0).toLocaleString("fa-IR");
}

function formatShopPrice(amount) {
    return Number(amount || 0).toLocaleString("fa-IR");
}

function getCoinBalance() {
    const profile = shopGetCurrentProfile();
    if (profile && profile.coins !== undefined) return Number(profile.coins);
    if (window.state && window.state.player && window.state.player.coins !== undefined) {
        return Number(window.state.player.coins);
    }
    return 0;
}

function updateShopCoinUI() {
    const balance = getCoinBalance();
    document.querySelectorAll("[data-shop-coins]").forEach(el => {
        el.textContent = formatShopCoins(balance);
    });
    document.querySelectorAll("[data-user-coins]").forEach(el => {
        el.textContent = formatShopCoins(balance);
    });
}

async function loadShopItems() {
    const client = shopGetSupabaseClient();
    if (!client) {
        shopToast("اتصال فروشگاه به سرور برقرار نیست.", "⚠️");
        return [];
    }

    try {
        shopState.loading = true;
        const { data, error } = await client
            .from("shop_items")
            .select("*")
            .eq("is_active", true)
            .order("price", { ascending: true });

        shopState.loading = false;
        if (error) {
            console.error("خطا در دریافت آیتم‌های فروشگاه:", error);
            shopToast("دریافت فروشگاه انجام نشد.", "❌");
            return [];
        }

        shopState.items = Array.isArray(data) ? data : [];
        applyShopFilters();
        renderShop();
        shopEvents.emit("itemsLoaded", shopState.items);
        return shopState.items;
    } catch (error) {
        shopState.loading = false;
        console.error("خطای loadShopItems:", error);
        shopToast("در دریافت فروشگاه مشکلی پیش آمد.", "❌");
        return [];
    }
}

async function loadPlayerInventory() {
    const client = shopGetSupabaseClient();
    const user = shopGetCurrentUser();
    if (!client || !user) {
        shopState.inventory = [];
        renderShop();
        return [];
    }

    try {
        const { data, error } = await client
            .from("player_inventory")
            .select(`
                id,
                user_id,
                item_id,
                purchased_at,
                shop_items (
                    id,
                    item_key,
                    name,
                    description,
                    item_type,
                    price,
                    image_url,
                    is_active
                )
            `)
            .eq("user_id", user.id)
            .order("purchased_at", { ascending: false });

        if (error) {
            console.error("خطا در دریافت Inventory:", error);
            shopState.inventory = [];
            return [];
        }

        shopState.inventory = Array.isArray(data) ? data : [];
        updateActiveItems();
        renderShop();
        shopEvents.emit("inventoryLoaded", shopState.inventory);
        return shopState.inventory;
    } catch (error) {
        console.error("خطای loadPlayerInventory:", error);
        return [];
    }
}

async function loadShop() {
    shopSyncUserState();
    await loadShopItems();
    await loadPlayerInventory();
    updateShopCoinUI();
    renderCoinPackages();
    shopEvents.emit("shopLoaded", {
        items: shopState.items,
        inventory: shopState.inventory
    });
    return {
        items: shopState.items,
        inventory: shopState.inventory
    };
}

function ownsItem(itemId) {
    return shopState.inventory.some(invItem => invItem.item_id === itemId);
}

function findShopItem(itemId) {
    return shopState.items.find(item => item.id === itemId) || null;
}

function findShopItemByKey(itemKey) {
    return shopState.items.find(item => item.item_key === itemKey) || null;
}

function normalizeItemType(itemType) {
    const type = String(itemType || "").trim().toLowerCase();
    if (type === "card-theme" || type === "card" || type === "cards") return "cardTheme";
    if (type === "avatar") return "avatar";
    if (type === "table-theme" || type === "table") return "tableTheme";
    return "other";
}

function updateActiveItems() {
    shopState.activeItems = { cardTheme: null, avatar: null, tableTheme: null, other: [] };
    shopState.inventory.forEach(inventoryItem => {
        const item = inventoryItem.shop_items;
        if (!item) return;

        const type = normalizeItemType(item.item_type);
        if (type === "cardTheme" && !shopState.activeItems.cardTheme) {
            shopState.activeItems.cardTheme = item;
            return;
        }
        if (type === "avatar" && !shopState.activeItems.avatar) {
            shopState.activeItems.avatar = item;
            return;
        }
        if (type === "tableTheme" && !shopState.activeItems.tableTheme) {
            shopState.activeItems.tableTheme = item;
            return;
        }
        shopState.activeItems.other.push(item);
    });
}

function applyShopFilters() {
    const search = String(shopState.searchText || "").trim().toLowerCase();
    const category = shopState.currentCategory;

    shopState.filteredItems = shopState.items.filter(item => {
        const type = normalizeItemType(item.item_type);
        let categoryMatch = (category === "all") || (type === category);
        let searchMatch = true;

        if (search) {
            const searchableText = [item.name, item.description, item.item_key, item.item_type]
                .filter(Boolean).join(" ").toLowerCase();
            searchMatch = searchableText.includes(search);
        }
        return categoryMatch && searchMatch;
    });

    renderShopItems();
}

function setShopCategory(category = "all") {
    shopState.currentCategory = String(category);
    applyShopFilters();
    shopEvents.emit("categoryChanged", shopState.currentCategory);
}

function searchShop(text = "") {
    shopState.searchText = String(text);
    applyShopFilters();
    shopEvents.emit("searchChanged", shopState.searchText);
}

function renderShop() {
    updateShopCoinUI();
    renderShopItems();
    renderCoinPackages();
}

function renderShopItems() {
    const containers = document.querySelectorAll("[data-shop-items]");
    if (!containers.length) return;

    containers.forEach(container => {
        container.innerHTML = "";
        const items = shopState.filteredItems;

        if (!items.length) {
            const empty = document.createElement("div");
            empty.className = "shop-empty";
            empty.textContent = "آیتمی در این بخش پیدا نشد.";
            container.appendChild(empty);
            return;
        }

        items.forEach(item => {
            const card = createShopItemElement(item);
            container.appendChild(card);
        });
    });
}

function createShopItemElement(item) {
    const wrapper = document.createElement("article");
    wrapper.className = "shop-item-card";
    wrapper.dataset.itemId = item.id;

    const owned = ownsItem(item.id);
    const type = normalizeItemType(item.item_type);

    const image = document.createElement("div");
    image.className = "shop-item-image";

    if (item.image_url) {
        const img = document.createElement("img");
        img.src = item.image_url;
        img.alt = item.name;
        img.loading = "lazy";
        image.appendChild(img);
    } else {
        image.textContent = getShopItemIcon(type);
    }

    const body = document.createElement("div");
    body.className = "shop-item-body";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const description = document.createElement("p");
    description.textContent = item.description || "آیتم ویژه برای بازی حکم";

    const price = document.createElement("div");
    price.className = "shop-item-price";
    price.textContent = `${formatShopCoins(item.price)} 🪙`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-buy-button";

    if (owned) {
        button.textContent = "خریداری شده ✓";
        button.disabled = true;
        button.classList.add("owned");
    } else {
        button.textContent = "خرید";
        button.addEventListener("click", () => { purchaseItem(item.id); });
    }

    body.appendChild(title);
    body.appendChild(description);
    body.appendChild(price);
    body.appendChild(button);

    wrapper.appendChild(image);
    wrapper.appendChild(body);
    return wrapper;
}

function getShopItemIcon(type) {
    if (type === "cardTheme") return "🃏";
    if (type === "avatar") return "👤";
    if (type === "tableTheme") return "🎲";
    return "🎁";
}

async function purchaseItem(itemId) {
    const client = shopGetSupabaseClient();
    const user = shopGetCurrentUser();

    if (!client || !user) {
        shopToast("برای خرید ابتدا وارد حساب شوید.", "🔐");
        return { success: false, error: "NOT_AUTHENTICATED" };
    }

    const item = findShopItem(itemId);
    if (!item) {
        shopToast("این آیتم پیدا نشد.", "❌");
        return { success: false, error: "ITEM_NOT_FOUND" };
    }

    if (ownsItem(item.id)) {
        shopToast("این آیتم را قبلاً خریداری کرده‌ای.", "ℹ️");
        return { success: false, error: "ALREADY_OWNED" };
    }

    const balance = getCoinBalance();
    const price = Number(item.price || 0);

    if (balance < price) {
        shopToast(`سکه کافی نداری. موجودی: ${formatShopCoins(balance)} 🪙`, "🪙", 4000);
        shopEvents.emit("insufficientCoins", { item, balance, price });
        return { success: false, error: "INSUFFICIENT_COINS" };
    }

    const confirmed = await confirmShopPurchase(item);
    if (!confirmed) return { success: false, error: "CANCELLED" };

    try {
        shopLoading(true, "در حال انجام خرید...");
        const newBalance = balance - price;

        const { data: updatedProfile, error: profileError } = await client
            .from("profiles")
            .update({ coins: newBalance })
            .eq("id", user.id)
            .select()
            .single();

        if (profileError) throw profileError;

        const { data: inventoryData, error: inventoryError } = await client
            .from("player_inventory")
            .insert({ user_id: user.id, item_id: item.id })
            .select()
            .single();

        if (inventoryError) {
            await client.from("profiles").update({ coins: balance }).eq("id", user.id);
            throw inventoryError;
        }

        const { error: transactionError } = await client
            .from("coin_transactions")
            .insert({
                user_id: user.id,
                amount: -price,
                balance_after: newBalance,
                transaction_type: "shop_purchase",
                description: `خرید آیتم ${item.name}`,
                reference_id: item.id
            });

        if (transactionError) console.warn("تراکنش سکه ثبت نشد:", transactionError);

        shopState.currentProfile = updatedProfile;
        shopState.inventory.unshift({
            id: inventoryData?.id,
            user_id: user.id,
            item_id: item.id,
            purchased_at: inventoryData?.purchased_at || new Date().toISOString(),
            shop_items: item
        });

        updateActiveItems();
        shopSyncGameState();
        shopLoading(false);
        updateShopCoinUI();
        renderShop();
        shopToast(`${item.name} با موفقیت خریداری شد.`, "🎉", 3500);

        shopEvents.emit("itemPurchased", {
            item,
            inventory: inventoryData,
            profile: updatedProfile
        });

        return { success: true, item, inventory: inventoryData, profile: updatedProfile };
    } catch (error) {
        shopLoading(false);
        console.error("خطای purchaseItem:", error);
        shopToast("خرید انجام نشد. دوباره تلاش کنید.", "❌", 4000);
        return { success: false, error };
    }
}

async function confirmShopPurchase(item) {
    const price = Number(item.price || 0);
    const message = `آیا می‌خواهید «${item.name}» را با ${formatShopCoins(price)} سکه خریداری کنید؟`;

    if (typeof window.showConfirm === "function") {
        try {
            return await window.showConfirm(message);
        } catch (error) {
            console.error("خطا در showConfirm:", error);
        }
    }
    return window.confirm(message);
}

function getCoinPackages() {
    return [...shopState.coinPackages];
}

function renderCoinPackages() {
    const containers = document.querySelectorAll("[data-coin-packages]");
    if (!containers.length) return;

    containers.forEach(container => {
        container.innerHTML = "";
        shopState.coinPackages.forEach(pack => {
            const card = createCoinPackageElement(pack);
            container.appendChild(card);
        });
    });
}

function createCoinPackageElement(pack) {
    const card = document.createElement("article");
    card.className = "coin-package-card";
    card.dataset.packageId = pack.id;

    const icon = document.createElement("div");
    icon.className = "coin-package-icon";
    icon.textContent = "🪙";

    const title = document.createElement("h3");
    title.textContent = pack.title;

    const description = document.createElement("p");
    description.textContent = pack.description;

    const amount = document.createElement("strong");
    amount.textContent = `${formatShopCoins(pack.coins)} سکه`;

    const price = document.createElement("div");
    price.className = "coin-package-price";
    price.textContent = `${formatShopPrice(pack.price)} ${pack.currency}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "coin-package-button";
    button.textContent = "خرید سکه";
    button.addEventListener("click", () => { requestCoinPackagePurchase(pack.id); });

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(amount);
    card.appendChild(price);
    card.appendChild(button);
    return card;
}

function findCoinPackage(packageId) {
    return shopState.coinPackages.find(pack => pack.id === packageId) || null;
}

async function requestCoinPackagePurchase(packageId) {
    const pack = findCoinPackage(packageId);
    if (!pack) {
        shopToast("بسته سکه پیدا نشد.", "❌");
        return { success: false, error: "PACKAGE_NOT_FOUND" };
    }

    const confirmed = await confirmCoinPackagePurchase(pack);
    if (!confirmed) return { success: false, error: "CANCELLED" };

    shopEvents.emit("coinPurchaseRequested", { package: pack });
    shopToast("این بسته برای اتصال به درگاه پرداخت آماده است.", "💳", 4000);
    return { success: true, pendingPayment: true, package: pack };
}

async function confirmCoinPackagePurchase(pack) {
    const message = `بسته ${formatShopCoins(pack.coins)} سکه به قیمت ${formatShopPrice(pack.price)} تومان انتخاب شده است. ادامه می‌دهید؟`;
    if (typeof window.showConfirm === "function") {
        try {
            return await window.showConfirm(message);
        } catch (error) {
            console.error("خطای showConfirm:", error);
        }
    }
    return window.confirm(message);
}

async function addCoinsAfterVerifiedPayment(packageId, paymentReference) {
    const client = shopGetSupabaseClient();
    const user = shopGetCurrentUser();
    if (!client || !user) return { success: false, error: "NOT_AUTHENTICATED" };

    const pack = findCoinPackage(packageId);
    if (!pack) return { success: false, error: "PACKAGE_NOT_FOUND" };

    console.warn("addCoinsAfterVerifiedPayment باید فقط پس از تأیید واقعی پرداخت توسط Backend اجرا شود.");
    return { success: false, error: "PAYMENT_VERIFICATION_REQUIRED", package: pack, paymentReference };
}

function getActiveShopItem(itemType) {
    const normalized = normalizeItemType(itemType);
    if (normalized === "cardTheme") return shopState.activeItems.cardTheme;
    if (normalized === "avatar") return shopState.activeItems.avatar;
    if (normalized === "tableTheme") return shopState.activeItems.tableTheme;
    return null;
}

async function activateItem(itemId) {
    const item = findShopItem(itemId);
    if (!item) {
        shopToast("آیتم پیدا نشد.", "❌");
        return false;
    }

    if (!ownsItem(item.id)) {
        shopToast("ابتدا باید این آیتم را خریداری کنید.", "⚠️");
        return false;
    }

    const type = normalizeItemType(item.item_type);
    if (type === "cardTheme") {
        shopState.activeItems.cardTheme = item;
    } else if (type === "avatar") {
        shopState.activeItems.avatar = item;
    } else if (type === "tableTheme") {
        shopState.activeItems.tableTheme = item;
    } else {
        if (!shopState.activeItems.other.some(activeItem => activeItem.id === item.id)) {
            shopState.activeItems.other.push(item);
        }
    }

    applyItemVisuals(item);
    shopEvents.emit("itemActivated", item);
    shopToast(`${item.name} فعال شد.`, "✨");
    return true;
}

function applyItemVisuals(item) {
    if (!item) return;
    const type = normalizeItemType(item.item_type);

    if (type === "cardTheme") document.body.dataset.cardTheme = item.item_key;
    if (type === "tableTheme") document.body.dataset.tableTheme = item.item_key;
    if (type === "avatar") {
        document.querySelectorAll("[data-user-avatar]").forEach(element => {
            if (element.tagName === "IMG" && item.image_url) {
                element.src = item.image_url;
            }
        });
    }

    try {
        localStorage.setItem(`hokm_active_${type}`, item.item_key);
    } catch (error) {
        console.warn("ذخیره تم در LocalStorage انجام نشد.", error);
    }
}

function restoreActiveVisuals() {
    ["cardTheme", "tableTheme", "avatar"].forEach(type => {
        try {
            const itemKey = localStorage.getItem(`hokm_active_${type}`);
            if (!itemKey) return;
            const item = findShopItemByKey(itemKey);
            if (item && ownsItem(item.id)) applyItemVisuals(item);
        } catch (error) {
            console.warn("خطا در بازیابی تم:", error);
        }
    });
}

function renderInventory() {
    const containers = document.querySelectorAll("[data-player-inventory]");
    containers.forEach(container => {
        container.innerHTML = "";
        if (!shopState.inventory.length) {
            const empty = document.createElement("div");
            empty.className = "inventory-empty";
            empty.textContent = "هنوز آیتمی خریداری نکرده‌اید.";
            container.appendChild(empty);
            return;
        }

        shopState.inventory.forEach(inventoryItem => {
            const item = inventoryItem.shop_items;
            if (!item) return;
            container.appendChild(createInventoryElement(item));
        });
    });
}

function createInventoryElement(item) {
    const element = document.createElement("div");
    element.className = "inventory-item";

    const type = normalizeItemType(item.item_type);
    const active = getActiveShopItem(type);
    const isActive = active && active.id === item.id;

    const icon = document.createElement("span");
    icon.className = "inventory-item-icon";
    icon.textContent = getShopItemIcon(type);

    const name = document.createElement("span");
    name.className = "inventory-item-name";
    name.textContent = item.name;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "inventory-item-button";

    if (isActive) {
        button.textContent = "فعال ✓";
        button.disabled = true;
    } else {
        button.textContent = "فعال‌سازی";
        button.addEventListener("click", () => { activateItem(item.id); });
    }

    element.appendChild(icon);
    element.appendChild(name);
    element.appendChild(button);
    return element;
}

function setupShopUI() {
    document.querySelectorAll("[data-shop-search]").forEach(input => {
        input.addEventListener("input", event => { searchShop(event.target.value); });
    });

    document.querySelectorAll("[data-shop-category]").forEach(button => {
        button.addEventListener("click", () => { setShopCategory(button.dataset.shopCategory); });
    });

    document.querySelectorAll("[data-shop-refresh]").forEach(button => {
        button.addEventListener("click", async () => { await loadShop(); });
    });
}

async function initializeShop() {
    if (shopState.initialized) return;
    shopSyncUserState();
    setupShopUI();
    await loadShop();
    restoreActiveVisuals();
    renderInventory();
    shopState.initialized = true;

    shopEvents.emit("initialized", {
        items: shopState.items,
        inventory: shopState.inventory,
        coinPackages: shopState.coinPackages
    });
    console.log("Hokm Online Shop initialized successfully.");
}

function setupShopAuthIntegration() {
    if (!window.hokmAuth) return;

    if (typeof window.hokmAuth.onSignIn === "function") {
        window.hokmAuth.onSignIn(async () => {
            shopSyncUserState();
            await loadShop();
            renderInventory();
        });
    }

    if (typeof window.hokmAuth.onSignOut === "function") {
        window.hokmAuth.onSignOut(() => {
            shopState.currentUser = null;
            shopState.currentProfile = null;
            shopState.inventory = [];
            shopState.activeItems = { cardTheme: null, avatar: null, tableTheme: null, other: [] };
            updateShopCoinUI();
            renderShop();
            renderInventory();
        });
    }

    if (typeof window.hokmAuth.onProfileUpdated === "function") {
        window.hokmAuth.onProfileUpdated(async profile => {
            shopState.currentProfile = profile;
            updateShopCoinUI();
            shopSyncGameState();
        });
    }
}

function onShopEvent(eventName, callback) { shopEvents.on(eventName, callback); }

function getShopState() {
    return {
        initialized: shopState.initialized,
        loading: shopState.loading,
        items: [...shopState.items],
        inventory: [...shopState.inventory],
        filteredItems: [...shopState.filteredItems],
        currentCategory: shopState.currentCategory,
        searchText: shopState.searchText,
        coinPackages: [...shopState.coinPackages],
        balance: getCoinBalance(),
        activeItems: { ...shopState.activeItems }
    };
}

async function openShop() {
    const shopElement = document.querySelector("[data-shop-container]");
    if (shopElement) shopElement.style.display = "";
    await loadShop();
    renderInventory();
    shopEvents.emit("opened", getShopState());
}

function closeShop() {
    const shopElement = document.querySelector("[data-shop-container]");
    if (shopElement) shopElement.style.display = "none";
    shopEvents.emit("closed", null);
}

function selectShopItem(itemId) {
    const item = findShopItem(itemId);
    shopState.selectedItem = item;
    shopEvents.emit("itemSelected", item);
    return item;
}

function getSelectedShopItem() { return shopState.selectedItem; }

async function buySelectedShopItem() {
    if (!shopState.selectedItem) {
        shopToast("ابتدا یک آیتم را انتخاب کنید.", "⚠️");
        return { success: false, error: "NO_SELECTED_ITEM" };
    }
    return await purchaseItem(shopState.selectedItem.id);
}

function canAffordShopItem(itemId) {
    const item = findShopItem(itemId);
    if (!item) return false;
    return getCoinBalance() >= Number(item.price || 0);
}

function getInventory() { return [...shopState.inventory]; }
async function refreshShop() { return await loadShop(); }

function renderInventoryAfterLoad() {
    updateActiveItems();
    renderInventory();
    restoreActiveVisuals();
}

function startShopInitialization() {
    if (window.hokmAuth && typeof window.hokmAuth.waitForAuth === "function") {
        window.hokmAuth.waitForAuth()
            .then(async () => {
                setupShopAuthIntegration();
                await initializeShop();
            })
            .catch(async error => {
                console.error("خطا در انتظار Auth:", error);
                setupShopAuthIntegration();
                await initializeShop();
            });
        return;
    }
    setupShopAuthIntegration();
    initializeShop();
}

window.hokmShop = {
    initializeShop,
    loadShop,
    loadShopItems,
    loadPlayerInventory,
    refreshShop,
    renderShop,
    renderShopItems,
    renderInventory,
    renderCoinPackages,
    setShopCategory,
    searchShop,
    getShopState,
    getInventory,
    getCoinPackages,
    findShopItem,
    findShopItemByKey,
    ownsItem,
    canAffordShopItem,
    purchaseItem,
    buySelectedShopItem,
    selectShopItem,
    getSelectedShopItem,
    activateItem,
    getActiveShopItem,
    requestCoinPackagePurchase,
    addCoinsAfterVerifiedPayment,
    openShop,
    closeShop,
    onShopEvent,
    getCoinBalance
};

window.purchaseShopItem = purchaseItem;
window.buyShopItem = purchaseItem;
window.openShop = openShop;
window.closeShop = closeShop;
window.refreshShop = refreshShop;
window.searchShop = searchShop;
window.setShopCategory = setShopCategory;
window.getShopState = getShopState;
window.getShopInventory = getInventory;
window.getShopCoinBalance = getCoinBalance;
window.requestCoinPackagePurchase = requestCoinPackagePurchase;
window.activateShopItem = activateItem;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startShopInitialization);
} else {
    startShopInitialization();
}
