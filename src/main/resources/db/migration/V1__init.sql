create table users (
                       id          uuid primary key default gen_random_uuid(),
                       google_sub  text not null unique,
                       email       text not null,
                       created_at  timestamptz not null default now()
);

create table refresh_tokens (
                                id         uuid primary key default gen_random_uuid(),
                                user_id    uuid not null references users(id) on delete cascade,
                                token_hash text not null unique,
                                expires_at timestamptz not null,
                                revoked_at timestamptz,
                                created_at timestamptz not null
);

create table tours (
                       id            uuid primary key default gen_random_uuid(),
                       owner_id      uuid not null references users(id) on delete cascade,
                       name          text not null,
                       is_public     boolean not null default false,
                       share_token   uuid unique,
                       password_hash text,
                       created_at    timestamptz not null default now()
);

create table photos (
                        id         uuid primary key default gen_random_uuid(),
                        tour_id    uuid not null references tours(id) on delete cascade,
                        storage_key text not null unique,
                        lat        double precision not null,
                        lng        double precision not null,
                        filesize   bigint,
                        position int not null,
                        created_at timestamptz not null default now()
                        constraint photos_tour_position_unique unique (tour_id, position)
                            deferrable initially deferred
);

create index on tours(owner_id);
create index on photos(tour_id);