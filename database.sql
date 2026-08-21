-- ================================================================
-- HOKM ONLINE
-- database.sql
--
-- FINAL FOUNDATION VERSION
--
-- PostgreSQL / Supabase
--
-- امکانات:
--
-- 1. کاربران و پروفایل
-- 2. 3000 سکه اولیه
-- 3. سیستم سکه و تراکنش امن
-- 4. هزینه ورود بازی 400 سکه
-- 5. بسته‌های خرید سکه
-- 6. فروشگاه
-- 7. آیتم‌های کارت
-- 8. پوسته کارت
-- 9. آواتار
-- 10. میز بازی
-- 11. ایموت و امکانات تزئینی
-- 12. اتاق 4 نفره
-- 13. بازی آنلاین
-- 14. تیم‌ها
-- 15. دست کارت
-- 16. تریک‌ها
-- 17. حرکات
-- 18. چت
-- 19. تاریخچه
-- 20. دوستان
-- 21. اعلان‌ها
-- 22. رتبه‌بندی
-- 23. تنظیمات
-- 24. Realtime
-- 25. RLS
-- 26. RPCهای امن برای سکه
--
-- قوانین اقتصادی:
--
-- شروع بازیکن: 3000 سکه
-- هزینه هر بازی: 400 سکه
--
-- بسته 1: 200 سکه = 25000 تومان
-- بسته 2: 600 سکه = 40000 تومان
-- بسته 3: 1200 سکه = 80000 تومان
--
-- ================================================================

-- ================================================================
-- 1. EXTENSIONS
-- ================================================================

create extension if not exists "pgcrypto";

-- ================================================================
-- 2. PROFILES
-- ================================================================

create table if not exists public.profiles (

    id uuid primary key
        references auth.users(id)
        on delete cascade,

    username text not null,

    avatar_url text,

    level integer not null default 1
        check (level >= 1),

    coins bigint not null default 3000
        check (coins >= 0),

    games_played integer not null default 0
        check (games_played >= 0),

    games_won integer not null default 0
        check (games_won >= 0),

    total_tricks integer not null default 0
        check (total_tricks >= 0),

    experience bigint not null default 0
        check (experience >= 0),

    is_online boolean not null default false,

    last_seen timestamptz
        default now(),

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now(),

    constraint username_length
        check (
            char_length(username)
            between 2 and 20
        ),

    constraint games_won_valid
        check (
            games_won <= games_played
        )
);

-- ================================================================
-- 3. PLAYER SETTINGS
-- ================================================================

create table if not exists public.player_settings (

    user_id uuid primary key
        references public.profiles(id)
        on delete cascade,

    sound_enabled boolean not null default true,

    music_enabled boolean not null default true,

    notifications_enabled boolean not null default true,

    vibration_enabled boolean not null default true,

    language text not null default 'fa',

    theme text not null default 'dark',

    auto_ready boolean not null default false,

    show_online_status boolean not null default true,

    updated_at timestamptz not null default now()
);

-- ================================================================
-- 4. SHOP ITEMS
-- ================================================================

create table if not exists public.shop_items (

    id uuid primary key
        default gen_random_uuid(),

    item_key text not null unique,

    name text not null,

    description text,

    item_type text not null,

    price bigint not null default 0
        check (price >= 0),

    image_url text,

    rarity text not null default 'common',

    is_active boolean not null default true,

    sort_order integer not null default 0,

    created_at timestamptz not null default now(),

    constraint shop_item_type_valid
        check (
            item_type in (
                'card-theme',
                'card-back',
                'avatar',
                'table-theme',
                'emote',
                'frame',
                'effect',
                'other'
            )
        ),

    constraint shop_item_rarity_valid
        check (
            rarity in (
                'common',
                'rare',
                'epic',
                'legendary'
            )
        )
);

-- ================================================================
-- 5. PLAYER INVENTORY
-- ================================================================

create table if not exists public.player_inventory (

    id uuid primary key
        default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    item_id uuid not null
        references public.shop_items(id)
        on delete cascade,

    purchased_at timestamptz not null default now(),

    is_equipped boolean not null default false,

    unique(user_id, item_id)
);

-- ================================================================
-- 6. COIN TRANSACTIONS
-- ================================================================

create table if not exists public.coin_transactions (

    id uuid primary key
        default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    amount bigint not null,

    balance_before bigint not null
        check (balance_before >= 0),

    balance_after bigint not null
        check (balance_after >= 0),

    transaction_type text not null,

    description text,

    reference_id uuid,

    created_at timestamptz not null default now(),

    constraint coin_transaction_type_valid
        check (
            transaction_type in (
                'initial_bonus',
                'game_entry',
                'game_reward',
                'shop_purchase',
                'coin_purchase',
                'admin_adjustment',
                'refund',
                'bonus',
                'other'
            )
        )
);

-- ================================================================
-- 7. COIN PACKAGES
-- ================================================================

create table if not exists public.coin_packages (

    id uuid primary key
        default gen_random_uuid(),

    package_key text not null unique,

    name text not null,

    coins bigint not null
        check (coins > 0),

    price_toman bigint not null
        check (price_toman > 0),

    bonus_coins bigint not null default 0
        check (bonus_coins >= 0),

    is_active boolean not null default true,

    sort_order integer not null default 0,

    created_at timestamptz not null default now()
);

-- ================================================================
-- 8. COIN PURCHASES
-- ================================================================

create table if not exists public.coin_purchases (

    id uuid primary key
        default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    package_id uuid not null
        references public.coin_packages(id),

    amount_paid_toman bigint not null
        check (amount_paid_toman > 0),

    coins_received bigint not null
        check (coins_received > 0),

    payment_provider text,

    payment_reference text,

    status text not null default 'pending',

    created_at timestamptz not null default now(),

    completed_at timestamptz,

    constraint coin_purchase_status_valid
        check (
            status in (
                'pending',
                'paid',
                'failed',
                'cancelled',
                'refunded'
            )
        )
);

-- ================================================================
-- 9. GAME ROOMS
-- ================================================================

create table if not exists public.rooms (

    id uuid primary key
        default gen_random_uuid(),

    code varchar(6) not null unique,

    name text not null default 'اتاق حکم',

    host_id uuid not null
        references public.profiles(id)
        on delete cascade,

    entry_fee bigint not null default 400
        check (entry_fee >= 0),

    is_private boolean not null default true,

    status text not null default 'waiting',

    max_players integer not null default 4
        check (max_players = 4),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    closed_at timestamptz,

    constraint room_code_format
        check (
            code ~ '^[0-9]{6}$'
        ),

    constraint room_status_valid
        check (
            status in (
                'waiting',
                'starting',
                'playing',
                'finished',
                'closed'
            )
        )
);

-- ================================================================
-- 10. ROOM PLAYERS
-- ================================================================

create table if not exists public.room_players (

    id uuid primary key
        default gen_random_uuid(),

    room_id uuid not null
        references public.rooms(id)
        on delete cascade,

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    seat integer not null
        check (seat between 0 and 3),

    team text not null,

    is_ready boolean not null default false,

    joined_at timestamptz not null default now(),

    left_at timestamptz,

    unique(room_id, user_id),

    unique(room_id, seat),

    constraint room_player_team
        check (
            team in ('A', 'B')
        )
);

-- ================================================================
-- 11. GAMES
-- ================================================================

create table if not exists public.games (

    id uuid primary key
        default gen_random_uuid(),

    room_id uuid
        references public.rooms(id)
        on delete set null,

    status text not null default 'waiting',

    phase text not null default 'idle',

    trump_suit text,

    lead_suit text,

    current_turn integer,

    leader_seat integer not null default 0,

    trick_number integer not null default 0,

    team_a_tricks integer not null default 0,

    team_b_tricks integer not null default 0,

    team_a_score integer not null default 0,

    team_b_score integer not null default 0,

    round_number integer not null default 1,

    winner_team text,

    entry_fee bigint not null default 400,

    prize_pool bigint not null default 0,

    started_at timestamptz,

    finished_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint game_status_valid
        check (
            status in (
                'waiting',
                'active',
                'finished',
                'cancelled'
            )
        ),

    constraint game_phase_valid
        check (
            phase in (
                'idle',
                'dealing',
                'trump-selection',
                'playing',
                'trick-finished',
                'round-finished',
                'game-finished'
            )
        ),

    constraint trump_suit_valid
        check (
            trump_suit is null
            or trump_suit in (
                'hearts',
                'diamonds',
                'clubs',
                'spades'
            )
        ),

    constraint lead_suit_valid
        check (
            lead_suit is null
            or lead_suit in (
                'hearts',
                'diamonds',
                'clubs',
                'spades'
            )
        ),

    constraint current_turn_valid
        check (
            current_turn is null
            or current_turn between 0 and 3
        ),

    constraint leader_seat_valid
        check (
            leader_seat between 0 and 3
        ),

    constraint winner_team_valid
        check (
            winner_team is null
            or winner_team in ('A', 'B')
        )
);

-- ================================================================
-- 12. GAME PLAYERS
-- ================================================================

create table if not exists public.game_players (

    id uuid primary key
        default gen_random_uuid(),

    game_id uuid not null
        references public.games(id)
        on delete cascade,

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    seat integer not null
        check (seat between 0 and 3),

    team text not null,

    is_host boolean not null default false,

    final_tricks integer not null default 0,

    final_coins_change bigint not null default 0,

    joined_at timestamptz not null default now(),

    unique(game_id, user_id),

    unique(game_id, seat),

    constraint game_player_team
        check (
            team in ('A', 'B')
        )
);

-- ================================================================
-- 13. GAME HANDS
-- ================================================================

create table if not exists public.game_hands (

    id uuid primary key
        default gen_random_uuid(),

    game_id uuid not null
        references public.games(id)
        on delete cascade,

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    card_id text not null,

    suit text not null,

    rank integer not null,

    is_played boolean not null default false,

    received_at timestamptz not null default now(),

    played_at timestamptz,

    constraint hand_suit_valid
        check (
            suit in (
                'hearts',
                'diamonds',
                'clubs',
                'spades'
            )
        ),

    constraint hand_rank_valid
        check (
            rank between 2 and 14
        ),

    unique(game_id, user_id, card_id)
);

-- ================================================================
-- 14. GAME TRICKS
-- ================================================================

create table if not exists public.game_tricks (

    id uuid primary key
        default gen_random_uuid(),

    game_id uuid not null
        references public.games(id)
        on delete cascade,

    trick_number integer not null,

    lead_suit text,

    winner_user_id uuid
        references public.profiles(id)
        on delete set null,

    winner_seat integer,

    created_at timestamptz not null default now(),

    finished_at timestamptz,

    unique(game_id, trick_number)
);

-- ================================================================
-- 15. TRICK CARDS
-- ================================================================

create table if not exists public.trick_cards (

    id uuid primary key
        default gen_random_uuid(),

    trick_id uuid not null
        references public.game_tricks(id)
        on delete cascade,

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    seat integer not null
        check (seat between 0 and 3),

    card_id text not null,

    suit text not null,

    rank integer not null,

    play_order integer not null,

    played_at timestamptz not null default now(),

    constraint trick_card_suit_valid
        check (
            suit in (
                'hearts',
                'diamonds',
                'clubs',
                'spades'
            )
        ),

    constraint trick_card_rank_valid
        check (
            rank between 2 and 14
        ),

    unique(trick_id, user_id),

    unique(trick_id, play_order)
);

-- ================================================================
-- 16. CHAT
-- ================================================================

create table if not exists public.chat_messages (

    id uuid primary key
        default gen_random_uuid(),

    room_id uuid
        references public.rooms(id)
        on delete cascade,

    game_id uuid
        references public.games(id)
        on delete cascade,

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    message text not null,

    created_at timestamptz not null default now(),

    constraint chat_message_length
        check (
            char_length(message)
            between 1 and 100
        )
);

-- ================================================================
-- 17. GAME HISTORY
-- ================================================================

create table if not exists public.game_history (

    id uuid primary key
        default gen_random_uuid(),

    game_id uuid not null
        references public.games(id)
        on delete cascade,

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    team text not null,

    result text not null,

    tricks integer not null default 0,

    coins_change bigint not null default 0,

    opponent_score integer not null default 0,

    player_score integer not null default 0,

    played_at timestamptz not null default now(),

    constraint history_team_valid
        check (
            team in ('A', 'B')
        ),

    constraint history_result_valid
        check (
            result in (
                'win',
                'loss',
                'draw'
            )
        )
);

-- ================================================================
-- 18. NOTIFICATIONS
-- ================================================================

create table if not exists public.notifications (

    id uuid primary key
        default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    title text not null,

    message text not null,

    notification_type text not null default 'system',

    is_read boolean not null default false,

    created_at timestamptz not null default now()
);

-- ================================================================
-- 19. FRIENDSHIPS
-- ================================================================

create table if not exists public.friendships (

    id uuid primary key
        default gen_random_uuid(),

    requester_id uuid not null
        references public.profiles(id)
        on delete cascade,

    addressee_id uuid not null
        references public.profiles(id)
        on delete cascade,

    status text not null default 'pending',

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint friendship_status_valid
        check (
            status in (
                'pending',
                'accepted',
                'rejected',
                'blocked'
            )
        ),

    constraint friendship_not_self
        check (
            requester_id <> addressee_id
        ),

    unique(requester_id, addressee_id)
);

-- ================================================================
-- 20. LEADERBOARD SNAPSHOTS
-- ================================================================

create table if not exists public.leaderboard_scores (

    user_id uuid primary key
        references public.profiles(id)
        on delete cascade,

    rating integer not null default 1000,

    wins integer not null default 0,

    losses integer not null default 0,

    total_games integer not null default 0,

    win_rate numeric(5,2) not null default 0,

    updated_at timestamptz not null default now()
);

-- ================================================================
-- 21. INDEXES
-- ================================================================

create index if not exists idx_profiles_username
on public.profiles(username);

create index if not exists idx_profiles_online
on public.profiles(is_online);

create index if not exists idx_rooms_code
on public.rooms(code);

create index if not exists idx_rooms_status
on public.rooms(status);

create index if not exists idx_rooms_host
on public.rooms(host_id);

create index if not exists idx_room_players_room
on public.room_players(room_id);

create index if not exists idx_room_players_user
on public.room_players(user_id);

create index if not exists idx_games_room
on public.games(room_id);

create index if not exists idx_games_status
on public.games(status);

create index if not exists idx_game_players_game
on public.game_players(game_id);

create index if not exists idx_game_players_user
on public.game_players(user_id);

create index if not exists idx_game_hands_game
on public.game_hands(game_id);

create index if not exists idx_game_hands_user
on public.game_hands(user_id);

create index if not exists idx_game_tricks_game
on public.game_tricks(game_id);

create index if not exists idx_trick_cards_trick
on public.trick_cards(trick_id);

create index if not exists idx_chat_room
on public.chat_messages(room_id);

create index if not exists idx_chat_game
on public.chat_messages(game_id);

create index if not exists idx_chat_created
on public.chat_messages(created_at);

create index if not exists idx_history_user
on public.game_history(user_id);

create index if not exists idx_history_game
on public.game_history(game_id);

create index if not exists idx_notifications_user
on public.notifications(user_id);

create index if not exists idx_notifications_unread
on public.notifications(user_id, is_read);

create index if not exists idx_inventory_user
on public.player_inventory(user_id);

create index if not exists idx_coin_transactions_user
on public.coin_transactions(user_id);

create index if not exists idx_coin_transactions_created
on public.coin_transactions(created_at);

create index if not exists idx_coin_purchases_user
on public.coin_purchases(user_id);

-- ================================================================
-- 22. UPDATED_AT FUNCTION
-- ================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin

    new.updated_at = now();

    return new;

end;
$$;

-- ================================================================
-- 23. UPDATED_AT TRIGGERS
-- ================================================================

drop trigger if exists profiles_updated_at
on public.profiles;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists player_settings_updated_at
on public.player_settings;

create trigger player_settings_updated_at
before update on public.player_settings
for each row
execute function public.set_updated_at();

drop trigger if exists rooms_updated_at
on public.rooms;

create trigger rooms_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();

drop trigger if exists games_updated_at
on public.games;

create trigger games_updated_at
before update on public.games
for each row
execute function public.set_updated_at();

drop trigger if exists friendships_updated_at
on public.friendships;

create trigger friendships_updated_at
before update on public.friendships
for each row
execute function public.set_updated_at();

-- ================================================================
-- 24. AUTO CREATE PROFILE
-- ================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    new_username text;
begin

    new_username :=
        coalesce(
            new.raw_user_meta_data ->> 'username',
            new.raw_user_meta_data ->> 'display_name',
            'بازیکن'
        );

    new_username :=
        left(
            trim(new_username),
            20
        );

    if char_length(new_username) < 2 then
        new_username := 'بازیکن';
    end if;

    insert into public.profiles (
        id,
        username,
        coins,
        level,
        games_played,
        games_won,
        total_tricks,
        experience
    )
    values (
        new.id,
        new_username,
        3000,
        1,
        0,
        0,
        0,
        0
    )
    on conflict (id) do nothing;

    insert into public.player_settings (
        user_id
    )
    values (
        new.id
    )
    on conflict (user_id) do nothing;

    insert into public.leaderboard_scores (
        user_id
    )
    values (
        new.id
    )
    on conflict (user_id) do nothing;

    insert into public.coin_transactions (
        user_id,
        amount,
        balance_before,
        balance_after,
        transaction_type,
        description
    )
    values (
        new.id,
        3000,
        0,
        3000,
        'initial_bonus',
        'پاداش شروع بازی'
    );

    return new;

end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ================================================================
-- 25. DEFAULT SHOP ITEMS
-- ================================================================

insert into public.shop_items (
    item_key,
    name,
    description,
    item_type,
    price,
    rarity,
    sort_order
)
values

(
    'card-classic',
    'کارت کلاسیک',
    'پوسته کلاسیک و تمیز برای کارت‌های بازی',
    'card-theme',
    250,
    'common',
    1
),

(
    'card-royal',
    'کارت سلطنتی',
    'پوسته لوکس سلطنتی برای کارت‌ها',
    'card-theme',
    500,
    'rare',
    2
),

(
    'card-diamond',
    'کارت الماسی',
    'پوسته ویژه با طراحی الماسی',
    'card-theme',
    900,
    'epic',
    3
),

(
    'card-gold',
    'کارت طلایی',
    'پوسته طلایی ویژه',
    'card-theme',
    1500,
    'legendary',
    4
),

(
    'card-back-blue',
    'پشت کارت آبی',
    'پشت کارت حرفه‌ای آبی',
    'card-back',
    300,
    'common',
    5
),

(
    'card-back-royal',
    'پشت کارت سلطنتی',
    'پشت کارت ویژه سلطنتی',
    'card-back',
    700,
    'rare',
    6
),

(
    'avatar-gold',
    'آواتار طلایی',
    'قاب آواتار طلایی',
    'avatar',
    750,
    'rare',
    7
),

(
    'avatar-royal',
    'آواتار سلطنتی',
    'آواتار ویژه بازیکنان حرفه‌ای',
    'avatar',
    1200,
    'epic',
    8
),

(
    'table-green',
    'میز سبز کلاسیک',
    'تم استاندارد میز بازی حکم',
    'table-theme',
    0,
    'common',
    9
),

(
    'table-luxury',
    'میز سلطنتی',
    'میز لوکس برای بازی‌های حرفه‌ای',
    'table-theme',
    1000,
    'rare',
    10
),

(
    'emote-fire',
    'ایموت آتش',
    'ایموت ویژه برای چت',
    'emote',
    200,
    'common',
    11
),

(
    'emote-crown',
    'ایموت تاج',
    'ایموت سلطنتی',
    'emote',
    500,
    'rare',
    12
),

(
    'frame-gold',
    'قاب طلایی',
    'قاب ویژه پروفایل',
    'frame',
    800,
    'epic',
    13
)

on conflict (item_key)
do nothing;

-- ================================================================
-- 26. DEFAULT COIN PACKAGES
-- ================================================================

insert into public.coin_packages (
    package_key,
    name,
    coins,
    price_toman,
    bonus_coins,
    sort_order
)
values

(
    'coins-200',
    'بسته ۲۰۰ سکه',
    200,
    25000,
    0,
    1
),

(
    'coins-600',
    'بسته ۶۰۰ سکه',
    600,
    40000,
    0,
    2
),

(
    'coins-1200',
    'بسته ۱۲۰۰ سکه',
    1200,
    80000,
    0,
    3
)

on conflict (package_key)
do nothing;

-- ================================================================
-- 27. SECURE PROFILE UPDATE PROTECTION
--
-- بازیکن نباید بتواند از Frontend:
--
-- coins
-- level
-- games_played
-- games_won
-- total_tricks
-- experience
--
-- را مستقیماً تغییر دهد.
-- ================================================================

create or replace function public.protect_profile_economy()
returns trigger
language plpgsql
as $$
begin

    if auth.uid() is not null then

        if new.coins <> old.coins then
            raise exception 'coins_can_only_be_changed_by_server';
        end if;

        if new.level <> old.level then
            raise exception 'level_can_only_be_changed_by_server';
        end if;

        if new.games_played <> old.games_played then
            raise exception 'games_played_can_only_be_changed_by_server';
        end if;

        if new.games_won <> old.games_won then
            raise exception 'games_won_can_only_be_changed_by_server';
        end if;

        if new.total_tricks <> old.total_tricks then
            raise exception 'total_tricks_can_only_be_changed_by_server';
        end if;

        if new.experience <> old.experience then
            raise exception 'experience_can_only_be_changed_by_server';
        end if;

    end if;

    return new;

end;
$$;

drop trigger if exists protect_profile_economy
on public.profiles;

create trigger protect_profile_economy
before update on public.profiles
for each row
execute function public.protect_profile_economy();

-- ================================================================
-- 28. SPEND COINS RPC
--
-- برای پرداخت 400 سکه ورود بازی
-- ================================================================

create or replace function public.spend_coins(
    p_amount bigint,
    p_transaction_type text,
    p_description text default null,
    p_reference_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    current_user_id uuid;

    current_balance bigint;

    new_balance bigint;

    transaction_id uuid;

begin

    current_user_id :=
        auth.uid();

    if current_user_id is null then
        raise exception 'not_authenticated';
    end if;

    if p_amount <= 0 then
        raise exception 'invalid_amount';
    end if;

    select coins
    into current_balance
    from public.profiles
    where id = current_user_id
    for update;

    if current_balance is null then
        raise exception 'profile_not_found';
    end if;

    if current_balance < p_amount then
        raise exception 'insufficient_coins';
    end if;

    new_balance :=
        current_balance - p_amount;

    update public.profiles
    set coins = new_balance
    where id = current_user_id;

    insert into public.coin_transactions (
        user_id,
        amount,
        balance_before,
        balance_after,
        transaction_type,
        description,
        reference_id
    )
    values (
        current_user_id,
        -p_amount,
        current_balance,
        new_balance,
        p_transaction_type,
        p_description,
        p_reference_id
    )
    returning id
    into transaction_id;

    return jsonb_build_object(
        'success', true,
        'transaction_id', transaction_id,
        'balance_before', current_balance,
        'balance_after', new_balance,
        'amount', p_amount
    );

end;
$$;

-- ================================================================
-- 29. ADD COINS RPC
-- ================================================================

create or replace function public.add_coins(
    p_user_id uuid,
    p_amount bigint,
    p_transaction_type text,
    p_description text default null,
    p_reference_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    current_balance bigint;

    new_balance bigint;

    transaction_id uuid;

begin

    if p_amount <= 0 then
        raise exception 'invalid_amount';
    end if;

    select coins
    into current_balance
    from public.profiles
    where id = p_user_id
    for update;

    if current_balance is null then
        raise exception 'profile_not_found';
    end if;

    new_balance :=
        current_balance + p_amount;

    update public.profiles
    set coins = new_balance
    where id = p_user_id;

    insert into public.coin_transactions (
        user_id,
        amount,
        balance_before,
        balance_after,
        transaction_type,
        description,
        reference_id
    )
    values (
        p_user_id,
        p_amount,
        current_balance,
        new_balance,
        p_transaction_type,
        p_description,
        p_reference_id
    )
    returning id
    into transaction_id;

    return jsonb_build_object(
        'success', true,
        'transaction_id', transaction_id,
        'balance_before', current_balance,
        'balance_after', new_balance,
        'amount', p_amount
    );

end;
$$;

-- ================================================================
-- 30. PURCHASE SHOP ITEM RPC
-- ================================================================

create or replace function public.purchase_shop_item(
    p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    current_user_id uuid;

    item_price bigint;

    item_name text;

    current_balance bigint;

    new_balance bigint;

    inventory_id uuid;

begin

    current_user_id :=
        auth.uid();

    if current_user_id is null then
        raise exception 'not_authenticated';
    end if;

    select
        price,
        name
    into
        item_price,
        item_name
    from public.shop_items
    where id = p_item_id
      and is_active = true;

    if item_price is null then
        raise exception 'item_not_found';
    end if;

    if exists (
        select 1
        from public.player_inventory
        where user_id = current_user_id
          and item_id = p_item_id
    ) then
        raise exception 'item_already_owned';
    end if;

    select coins
    into current_balance
    from public.profiles
    where id = current_user_id
    for update;

    if current_balance < item_price then
        raise exception 'insufficient_coins';
    end if;

    new_balance :=
        current_balance - item_price;

    update public.profiles
    set coins = new_balance
    where id = current_user_id;

    insert into public.player_inventory (
        user_id,
        item_id
    )
    values (
        current_user_id,
        p_item_id
    )
    returning id
    into inventory_id;

    insert into public.coin_transactions (
        user_id,
        amount,
        balance_before,
        balance_after,
        transaction_type,
        description,
        reference_id
    )
    values (
        current_user_id,
        -item_price,
        current_balance,
        new_balance,
        'shop_purchase',
        'خرید ' || item_name,
        p_item_id
    );

    return jsonb_build_object(
        'success', true,
        'inventory_id', inventory_id,
        'item_id', p_item_id,
        'price', item_price,
        'balance_after', new_balance
    );

end;
$$;

-- ================================================================
-- 31. PAY GAME ENTRY RPC
--
-- هزینه پیش‌فرض بازی = 400 سکه
-- ================================================================

create or replace function public.pay_game_entry(
    p_game_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    current_user_id uuid;

    game_entry_fee bigint;

    current_balance bigint;

    new_balance bigint;

    player_exists boolean;

begin

    current_user_id :=
        auth.uid();

    if current_user_id is null then
        raise exception 'not_authenticated';
    end if;

    select entry_fee
    into game_entry_fee
    from public.games
    where id = p_game_id;

    if game_entry_fee is null then
        raise exception 'game_not_found';
    end if;

    select exists (
        select 1
        from public.game_players
        where game_id = p_game_id
          and user_id = current_user_id
    )
    into player_exists;

    if not player_exists then
        raise exception 'player_not_in_game';
    end if;

    select coins
    into current_balance
    from public.profiles
    where id = current_user_id
    for update;

    if current_balance < game_entry_fee then
        raise exception 'insufficient_coins';
    end if;

    new_balance :=
        current_balance - game_entry_fee;

    update public.profiles
    set coins = new_balance
    where id = current_user_id;

    update public.game_players
    set final_coins_change =
        final_coins_change - game_entry_fee
    where game_id = p_game_id
      and user_id = current_user_id;

    insert into public.coin_transactions (
        user_id,
        amount,
        balance_before,
        balance_after,
        transaction_type,
        description,
        reference_id
    )
    values (
        current_user_id,
        -game_entry_fee,
        current_balance,
        new_balance,
        'game_entry',
        'هزینه ورود به بازی حکم',
        p_game_id
    );

    update public.games
    set prize_pool =
        prize_pool + game_entry_fee
    where id = p_game_id;

    return jsonb_build_object(
        'success', true,
        'game_id', p_game_id,
        'entry_fee', game_entry_fee,
        'balance_after', new_balance
    );

end;
$$;

-- ================================================================
-- 32. PUBLIC CONSTANTS VIEW
-- ================================================================

create or replace view public.game_constants
as
select
    3000::bigint as starting_coins,
    400::bigint as game_entry_fee,
    4::integer as max_players,
    200::bigint as coins_package_1,
    25000::bigint as price_package_1,
    600::bigint as coins_package_2,
    40000::bigint as price_package_2,
    1200::bigint as coins_package_3,
    80000::bigint as price_package_3;

-- ================================================================
-- 33. RLS
-- ================================================================

alter table public.profiles enable row level security;

alter table public.player_settings enable row level security;

alter table public.shop_items enable row level security;

alter table public.player_inventory enable row level security;

alter table public.coin_transactions enable row level security;

alter table public.coin_packages enable row level security;

alter table public.coin_purchases enable row level security;

alter table public.rooms enable row level security;

alter table public.room_players enable row level security;

alter table public.games enable row level security;

alter table public.game_players enable row level security;

alter table public.game_hands enable row level security;

alter table public.game_tricks enable row level security;

alter table public.trick_cards enable row level security;

alter table public.chat_messages enable row level security;

alter table public.game_history enable row level security;

alter table public.notifications enable row level security;

alter table public.friendships enable row level security;

alter table public.leaderboard_scores enable row level security;

-- ================================================================
-- 34. PROFILE POLICIES
-- ================================================================

drop policy if exists "profiles_select_authenticated"
on public.profiles;

create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_own"
on public.profiles;

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ================================================================
-- 35. SETTINGS POLICIES
-- ================================================================

drop policy if exists "settings_select_own"
on public.player_settings;

create policy "settings_select_own"
on public.player_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "settings_insert_own"
on public.player_settings;

create policy "settings_insert_own"
on public.player_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "settings_update_own"
on public.player_settings;

create policy "settings_update_own"
on public.player_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ================================================================
-- 36. SHOP POLICIES
-- ================================================================

drop policy if exists "shop_items_read"
on public.shop_items;

create policy "shop_items_read"
on public.shop_items
for select
to anon, authenticated
using (is_active = true);

-- ================================================================
-- 37. INVENTORY POLICIES
-- ================================================================

drop policy if exists "inventory_read_own"
on public.player_inventory;

create policy "inventory_read_own"
on public.player_inventory
for select
to authenticated
using (auth.uid() = user_id);

-- ================================================================
-- 38. COIN TRANSACTION POLICIES
-- ================================================================

drop policy if exists "coin_transactions_read_own"
on public.coin_transactions;

create policy "coin_transactions_read_own"
on public.coin_transactions
for select
to authenticated
using (auth.uid() = user_id);

-- ================================================================
-- 39. COIN PACKAGE POLICIES
-- ================================================================

drop policy if exists "coin_packages_read"
on public.coin_packages;

create policy "coin_packages_read"
on public.coin_packages
for select
to anon, authenticated
using (is_active = true);

-- ================================================================
-- 40. COIN PURCHASE POLICIES
-- ================================================================

drop policy if exists "coin_purchases_read_own"
on public.coin_purchases;

create policy "coin_purchases_read_own"
on public.coin_purchases
for select
to authenticated
using (auth.uid() = user_id);

-- ================================================================
-- 41. ROOM POLICIES
-- ================================================================

drop policy if exists "rooms_read_authenticated"
on public.rooms;

create policy "rooms_read_authenticated"
on public.rooms
for select
to authenticated
using (true);

drop policy if exists "rooms_insert_authenticated"
on public.rooms;

create policy "rooms_insert_authenticated"
on public.rooms
for insert
to authenticated
with check (auth.uid() = host_id);

drop policy if exists "rooms_update_host"
on public.rooms;

create policy "rooms_update_host"
on public.rooms
for update
to authenticated
using (auth.uid() = host_id)
with check (auth.uid() = host_id);

-- ================================================================
-- 42. ROOM PLAYERS
-- ================================================================

drop policy if exists "room_players_read"
on public.room_players;

create policy "room_players_read"
on public.room_players
for select
to authenticated
using (true);

drop policy if exists "room_players_insert"
on public.room_players;

create policy "room_players_insert"
on public.room_players
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "room_players_update_own"
on public.room_players;

create policy "room_players_update_own"
on public.room_players
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ================================================================
-- 43. GAMES
-- ================================================================

drop policy if exists "games_read_authenticated"
on public.games;

create policy "games_read_authenticated"
on public.games
for select
to authenticated
using (true);

-- ================================================================
-- 44. GAME PLAYERS
-- ================================================================

drop policy if exists "game_players_read"
on public.game_players;

create policy "game_players_read"
on public.game_players
for select
to authenticated
using (true);

-- ================================================================
-- 45. GAME HANDS
-- ================================================================

drop policy if exists "game_hands_own"
on public.game_hands;

create policy "game_hands_own"
on public.game_hands
for select
to authenticated
using (auth.uid() = user_id);

-- ================================================================
-- 46. TRICKS
-- ================================================================

drop policy if exists "game_tricks_read"
on public.game_tricks;

create policy "game_tricks_read"
on public.game_tricks
for select
to authenticated
using (true);

drop policy if exists "trick_cards_read"
on public.trick_cards;

create policy "trick_cards_read"
on public.trick_cards
for select
to authenticated
using (true);

-- ================================================================
-- 47. CHAT
-- ================================================================

drop policy if exists "chat_read"
on public.chat_messages;

create policy "chat_read"
on public.chat_messages
for select
to authenticated
using (true);

drop policy if exists "chat_insert"
on public.chat_messages;

create policy "chat_insert"
on public.chat_messages
for insert
to authenticated
with check (auth.uid() = user_id);

-- ================================================================
-- 48. HISTORY
-- ================================================================

drop policy if exists "history_read_own"
on public.game_history;

create policy "history_read_own"
on public.game_history
for select
to authenticated
using (auth.uid() = user_id);

-- ================================================================
-- 49. NOTIFICATIONS
-- ================================================================

drop policy if exists "notifications_read_own"
on public.notifications;

create policy "notifications_read_own"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notifications_update_own"
on public.notifications;

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ================================================================
-- 50. FRIENDSHIPS
-- ================================================================

drop policy if exists "friendships_read_own"
on public.friendships;

create policy "friendships_read_own"
on public.friendships
for select
to authenticated
using (
    auth.uid() = requester_id
    or auth.uid() = addressee_id
);

drop policy if exists "friendships_insert_own"
on public.friendships;

create policy "friendships_insert_own"
on public.friendships
for insert
to authenticated
with check (auth.uid() = requester_id);

-- ================================================================
-- 51. LEADERBOARD
-- ================================================================

drop policy if exists "leaderboard_read"
on public.leaderboard_scores;

create policy "leaderboard_read"
on public.leaderboard_scores
for select
to authenticated
using (true);

-- ================================================================
-- 52. REALTIME
-- ================================================================

do $$

begin

    begin
        alter publication supabase_realtime
        add table public.rooms;
    exception
        when duplicate_object then
            null;
    end;

    begin
        alter publication supabase_realtime
        add table public.room_players;
    exception
        when duplicate_object then
            null;
    end;

    begin
        alter publication supabase_realtime
        add table public.games;
    exception
        when duplicate_object then
            null;
    end;

    begin
        alter publication supabase_realtime
        add table public.game_players;
    exception
        when duplicate_object then
            null;
    end;

    begin
        alter publication supabase_realtime
        add table public.game_tricks;
    exception
        when duplicate_object then
            null;
    end;

    begin
        alter publication supabase_realtime
        add table public.trick_cards;
    exception
        when duplicate_object then
            null;
    end;

    begin
        alter publication supabase_realtime
        add table public.chat_messages;
    exception
        when duplicate_object then
            null;
    end;

end $$;

-- ================================================================
-- 53. GRANTS FOR RPC
-- ================================================================

grant execute
on function public.spend_coins(
    bigint,
    text,
    text,
    uuid
)
to authenticated;

grant execute
on function public.purchase_shop_item(
    uuid
)
to authenticated;

grant execute
on function public.pay_game_entry(
    uuid
)
to authenticated;

-- ================================================================
-- 54. FINAL STATUS
-- ================================================================

select
    'HOKM ONLINE DATABASE INSTALLED SUCCESSFULLY' as status,
    3000::bigint as starting_coins,
    400::bigint as game_entry_fee,
    200::bigint as package_1_coins,
    25000::bigint as package_1_price_toman,
    600::bigint as package_2_coins,
    40000::bigint as package_2_price_toman,
    1200::bigint as package_3_coins,
    80000::bigint as package_3_price_toman;
