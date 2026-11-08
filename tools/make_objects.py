#!/usr/bin/env python3
"""Rebuild dungeon-town/assets/objects/ from verified Kenney tile indices.

Every entry is (object_name, pack, sheet, index).  Sheet/index refer to the
source pack's own tile numbering (16x16 cells), which is what the vision
agents read off the labelled contact sheets.

Verification source:
  - tileid-tdc      -> Tiny Town / Tiny Dungeon / Tiny City sheets
  - tileid-urban-b  -> Roguelike Modern City sheets (ct_urban1..4)
"""
import os, shutil, json

ASSETS = "/data/.openclaw/workspace/dungeon-town/assets"
OBJ = os.path.join(ASSETS, "objects")

# pack -> (relative dir, filename template)
PACKS = {
    "Tiny Town":            ("tiles/town",     "tile_%04d.png"),
    "Tiny Dungeon":         ("tiles/dungeon",  "tile_%04d.png"),
    "Tiny City":            ("tiles/city",     "tile_%04d.png"),
    "Roguelike Modern City": ("tiles/urban",   "tile_%04d.png"),
    "1-Bit Pack":           ("tiles/1bit",     "1bit_%04d.png"),
}

# name, pack, sheet, index, note
ENTRIES = [
    # ---------------- ground / terrain ----------------
    ("grass_plain",              "Tiny Town", "ct_town", 0, "solid green grass"),
    ("grass_tufts",              "Tiny Town", "ct_town", 1, "grass with tufts"),
    ("grass_flowers",            "Tiny Town", "ct_town", 2, "grass with flowers"),
    ("dirt_path",                "Tiny Town", "ct_town", 25, "plain tan dirt road"),
    ("dirt_path_edge",           "Tiny Town", "ct_town", 13, "dirt road with grass edge"),
    ("dirt_path_pebbles",        "Tiny Town", "ct_town", 40, "dirt road with pebbles"),
    ("stone_path",               "Tiny Town", "ct_town", 43, "cobble stones set in grass"),
    ("stone_floor",              "Tiny Town", "ct_town", 49, "rocky grey ground"),
    ("stone_floor_dark",         "Tiny Town", "ct_town", 50, "dark rocky grey ground"),
    ("brick_wall",               "Tiny Town", "ct_town", 53, "red brick wall"),
    ("brick_wall_dark",          "Tiny Town", "ct_town", 54, "dark red brick wall"),
    ("wood_planks",              "Tiny Town", "ct_town", 73, "brown plank wall/floor"),
    ("wood_wall",                "Tiny Town", "ct_town", 75, "brown plank wall variant"),
    ("dungeon_floor_dirt",       "Tiny Dungeon", "ct_dungeon", 0, "dark earth floor"),
    ("dungeon_floor_sand",       "Tiny Dungeon", "ct_dungeon", 48, "plain sand floor"),
    ("dungeon_floor_stone",      "Tiny Dungeon", "ct_dungeon", 14, "grey brick wall/floor"),
    ("dungeon_wall",             "Tiny Dungeon", "ct_dungeon", 57, "grey brick wall"),
    ("dungeon_wall_slab",        "Tiny Dungeon", "ct_dungeon", 37, "grey horizontal-slab wall"),
    ("dungeon_pool",             "Tiny Dungeon", "ct_dungeon", 32, "green liquid pool in basin"),
    ("dungeon_pillar",           "Tiny Dungeon", "ct_dungeon", 18, "stone pillar"),
    ("dungeon_rubble",           "Tiny Dungeon", "ct_dungeon", 12, "rubble on earth floor"),
    ("city_road_asphalt",        "Tiny City", "ct_city", 7, "plain asphalt road"),
    ("city_ground_dirt",         "Tiny City", "ct_city", 1, "plain brown ground"),
    ("city_brick_wall",          "Tiny City", "ct_city", 37, "red brick wall"),
    ("city_sidewalk",            "Tiny City", "ct_city", 4, "framed pavement slab"),
    ("urban_grass",              "Roguelike Modern City", "ct_urban1", 173, "grass tile"),
    ("urban_concrete_floor",     "Roguelike Modern City", "ct_urban1", 133, "plain light-grey concrete slab"),
    ("urban_wood_floor",         "Roguelike Modern City", "ct_urban1", 170, "light beige plank floor (horizontal)"),
    ("urban_wood_floor_vertical","Roguelike Modern City", "ct_urban1", 202, "light beige plank floor (vertical)"),
    ("urban_wood_boards",        "Roguelike Modern City", "ct_urban4", 607, "brown boards"),

    # ---------------- water ----------------
    ("water",                    "1-Bit Pack", "1bit", 253, "solid blue water"),
    ("water_edge",               "1-Bit Pack", "1bit", 256, "water with shore edge"),
    ("water_shore",              "1-Bit Pack", "1bit", 254, "water meeting shore"),
    ("urban_water",              "Roguelike Modern City", "ct_urban1", 211, "pool water, flat"),
    ("urban_water_rim",          "Roguelike Modern City", "ct_urban1", 174, "pool water with stone rim"),
    ("urban_water_over_brick",   "Roguelike Modern City", "ct_urban2", 248, "water over brick wall"),

    # ---------------- vegetation ----------------
    ("tree_green",               "Tiny Town", "ct_town", 4, "green conifer tree"),
    ("tree_green_large",         "Tiny Town", "ct_town", 5, "green round-canopy tree"),
    ("tree_autumn",              "Tiny Town", "ct_town", 3, "gold conifer tree"),
    ("tree_gold_round",          "Tiny Town", "ct_town", 15, "gold round tree"),
    # NOTE: ct_town tile 6 is a diagonal-edge GROUND tile (grass + edge), not a bush.
    # Use tile 7 (isolated green bush mound) and tile 10 (same shape, gold) instead.
    ("bush",                     "Tiny Town", "ct_town", 7, "isolated green bush mound on ground"),
    ("bush_gold",                "Tiny Town", "ct_town", 10, "isolated gold bush mound on ground"),
    ("bush_cluster",             "Tiny Town", "ct_town", 19, "green tree/bush cluster"),
    ("hedge",                    "Tiny Town", "ct_town", 20, "green hedge/canopy strip"),
    ("city_tree_green",          "Tiny City", "ct_city", 68, "green conifer tree"),
    ("city_tree_gold",           "Tiny City", "ct_city", 67, "gold conifer tree"),
    ("city_bush_planter",        "Tiny City", "ct_city", 81, "green bush in planter"),
    ("urban_tree",               "Roguelike Modern City", "ct_urban3", 440, "tree with trunk"),
    ("urban_tree_planter",       "Roguelike Modern City", "ct_urban3", 477, "tree in planter"),
    ("urban_bush",               "Roguelike Modern City", "ct_urban3", 403, "bush canopy, no trunk"),
    ("urban_bush_dark",          "Roguelike Modern City", "ct_urban3", 406, "dark bush canopy"),

    # ---------------- rocks ----------------
    # NOTE: ct_town tiles 105/106 bleed into the image edges (not isolated objects).
    # Use the isolated city/urban boulders instead (see urban_rock / city_rock).
    ("dirt_mound",               "Tiny Town", "ct_town", 92, "brown dirt mound"),
    ("city_rock",                "Tiny City", "ct_city", 102, "grey boulder"),
    ("urban_rock",               "Roguelike Modern City", "ct_urban3", 493, "grey boulder"),

    # ---------------- buildings ----------------
    ("house_wall",               "Tiny Town", "ct_town", 108, "plain light stone wall"),
    ("house_wall_castle",        "Tiny Town", "ct_town", 96, "castle stone wall"),
    ("house_wall_brick",         "Tiny Town", "ct_town", 53, "red brick house wall"),
    ("house_window",             "Tiny Town", "ct_town", 84, "house window"),
    ("house_door",               "Tiny Town", "ct_town", 85, "house door"),
    ("door_wood",                "Tiny Town", "ct_town", 74, "wooden door"),
    ("doorway",                  "Tiny Town", "ct_town", 78, "doorway opening"),
    ("roof",                     "Tiny Town", "ct_town", 67, "orange roof"),
    ("roof_grey",                "Tiny Town", "ct_town", 63, "grey roof"),
    ("shop_blue_window",         "Tiny Town", "ct_town", 104, "shop with blue window"),
    ("city_storefront",          "Tiny City", "ct_city", 50, "storefront window/door"),
    ("city_building_brown",      "Tiny City", "ct_city", 105, "brown building"),
    ("urban_door",               "Roguelike Modern City", "ct_urban1", 143, "brown door"),
    ("urban_door_panes",         "Roguelike Modern City", "ct_urban4", 617, "brown 4-pane door"),
    ("urban_window_green",       "Roguelike Modern City", "ct_urban1", 160, "green glass window"),
    ("urban_window_teal",        "Roguelike Modern City", "ct_urban1", 198, "teal glass window"),
    ("urban_shop_sign",          "Roguelike Modern City", "ct_urban2", 291, "orange shop sign"),
    ("urban_shop_awning",        "Roguelike Modern City", "ct_urban2", 278, "green/white shop awning"),
    ("urban_awning_orange",      "Roguelike Modern City", "ct_urban3", 357, "orange/white awning"),
    ("dungeon_arch_door",        "Tiny Dungeon", "ct_dungeon", 21, "arched doorway with brown door"),
    ("dungeon_door_stone",       "Tiny Dungeon", "ct_dungeon", 6, "stone door"),
    ("dungeon_door_wood",        "Tiny Dungeon", "ct_dungeon", 45, "wood door"),

    # ---------------- fences / stairs ----------------
    ("fence",                    "Tiny Town", "ct_town", 45, "wooden fence"),
    ("fence_vertical",           "Tiny Town", "ct_town", 44, "wooden fence post"),
    ("fence_corner",             "Tiny Town", "ct_town", 47, "fence corner"),
    ("city_fence_chainlink",     "Tiny City", "ct_city", 126, "chain-link fence"),
    ("urban_fence",              "Roguelike Modern City", "ct_urban4", 539, "urban fence"),
    ("stairs",                   "Roguelike Modern City", "ct_urban1", 168, "stairs"),
    ("stairs_wide",              "Roguelike Modern City", "ct_urban4", 600, "wide stairs"),
    ("dungeon_bars",             "Tiny Dungeon", "ct_dungeon", 67, "metal prison bars"),
    ("dungeon_portcullis",       "Tiny Dungeon", "ct_dungeon", 41, "stone arch with grate"),

    # ---------------- props / decor ----------------
    ("crate",                    "Tiny Dungeon", "ct_dungeon", 75, "wooden crate"),
    ("barrel_pot",               "Tiny Town", "ct_town", 107, "clay pot"),
    ("pot",                      "Tiny Town", "ct_town", 130, "large pot"),
    ("sign",                     "Tiny Town", "ct_town", 95, "red sign"),
    ("signpost",                 "Tiny Town", "ct_town", 115, "signpost"),
    ("signboard",                "Tiny Town", "ct_town", 57, "wooden signboard"),
    ("mushrooms",                "Tiny Town", "ct_town", 29, "red mushrooms"),
    ("beehive",                  "Tiny Town", "ct_town", 94, "beehive"),
    ("key",                      "Tiny Town", "ct_town", 117, "key"),
    ("pickaxe",                  "Tiny Town", "ct_town", 119, "pickaxe"),
    ("axe",                      "Tiny Town", "ct_town", 127, "axe"),
    ("shovel",                   "Tiny Town", "ct_town", 128, "shovel"),
    ("dungeon_torch",            "Tiny Dungeon", "ct_dungeon", 29, "wall torch flame"),
    ("dungeon_table",            "Tiny Dungeon", "ct_dungeon", 72, "wooden table"),
    ("dungeon_anvil",            "Tiny Dungeon", "ct_dungeon", 74, "anvil"),
    ("dungeon_potion",           "Tiny Dungeon", "ct_dungeon", 113, "potion flask"),
    ("dungeon_grate",            "Tiny Dungeon", "ct_dungeon", 55, "metal grate"),
    ("city_planter",             "Tiny City", "ct_city", 69, "planter"),

    # ---------------- lights ----------------
    ("lamp_street",              "Tiny City", "ct_city", 86, "street lamp"),
    ("street_lamp_arm",          "Tiny City", "ct_city", 85, "street lamp arm"),
    ("city_lamp_post",           "Tiny City", "ct_city", 103, "lamp post"),
    ("urban_lamp_street",        "Roguelike Modern City", "ct_urban3", 481, "street lamp"),
    ("urban_lamp_post",          "Roguelike Modern City", "ct_urban3", 482, "lamp post"),
    ("urban_traffic_light",      "Roguelike Modern City", "ct_urban3", 483, "traffic light"),
    ("urban_lamp_wall",          "Roguelike Modern City", "ct_urban3", 519, "wall lamp"),
]


def main():
    os.makedirs(OBJ, exist_ok=True)
    mapping = {}
    missing = []
    for name, pack, sheet, idx, note in ENTRIES:
        d, tmpl = PACKS[pack]
        src = os.path.join(ASSETS, d, tmpl % idx)
        if not os.path.exists(src):
            missing.append((name, src))
            continue
        shutil.copyfile(src, os.path.join(OBJ, name + ".png"))
        mapping[name] = {
            "file": "objects/%s.png" % name,
            "source_pack": pack,
            "source_sheet": sheet,
            "source_index": idx,
            "source_path": "%s/%s" % (d, tmpl % idx),
            "tile_size": "16x16",
            "note": note,
        }
    if missing:
        print("MISSING SOURCES:")
        for n, s in missing:
            print("  ", n, s)
    with open(os.path.join(OBJ, "mapping.json"), "w") as f:
        json.dump(mapping, f, indent=2, sort_keys=True)
    print("objects written:", len(mapping))


if __name__ == "__main__":
    main()
