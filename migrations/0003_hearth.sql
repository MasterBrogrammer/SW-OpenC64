create table if not exists recipe_saves (
  user_id text not null,
  recipe_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_slug)
);
create index if not exists recipe_saves_user_id_idx on recipe_saves (user_id);

create table if not exists shopping_items (
  id serial primary key,
  user_id text not null,
  name text not null,
  quantity text not null default '',
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shopping_items_user_id_idx on shopping_items (user_id);

create table if not exists user_recipes (
  id serial primary key,
  user_id text not null,
  slug text not null,
  title text not null,
  dek text not null,
  category text not null,
  time_minutes int not null,
  servings int not null,
  difficulty text not null,
  ingredients jsonb not null,
  steps jsonb not null,
  tips jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);
create index if not exists user_recipes_user_id_idx on user_recipes (user_id);
