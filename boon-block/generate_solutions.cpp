#include <algorithm>
#include <array>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

using namespace std;

struct Placement {
  int piece = -1;
  uint64_t mask = 0;
  array<int, 5> cells{};
  int cell_count = 0;
};

static const vector<string> PIECE_NAMES = {
  "F", "I", "L", "P", "N", "T", "U", "V", "W", "X", "Y", "Z", "CORE"
};

static const vector<vector<pair<int,int>>> BASE_SHAPES = {
  {{0,1},{0,2},{1,0},{1,1},{2,1}},
  {{0,0},{1,0},{2,0},{3,0},{4,0}},
  {{0,0},{1,0},{2,0},{3,0},{3,1}},
  {{0,0},{0,1},{1,0},{1,1},{2,0}},
  {{0,0},{1,0},{1,1},{2,1},{3,1}},
  {{0,0},{0,1},{0,2},{1,1},{2,1}},
  {{0,0},{0,2},{1,0},{1,1},{1,2}},
  {{0,0},{1,0},{2,0},{2,1},{2,2}},
  {{0,0},{1,0},{1,1},{2,1},{2,2}},
  {{0,1},{1,0},{1,1},{1,2},{2,1}},
  {{0,0},{1,0},{2,0},{3,0},{1,1}},
  {{0,0},{0,1},{1,1},{2,1},{2,2}},
  {{0,0},{0,1},{1,0},{1,1}}
};

static vector<Placement> placements;
static vector<int> placements_by_cell[64];
static vector<int> placements_by_piece[13];
static array<int,13> chosen{};
static long long solution_count = 0;
static ofstream output;

static vector<pair<int,int>> normalize(vector<pair<int,int>> shape) {
  int min_r = 99, min_c = 99;
  for (auto [r,c] : shape) {
    min_r = min(min_r, r);
    min_c = min(min_c, c);
  }
  for (auto &p : shape) {
    p.first -= min_r;
    p.second -= min_c;
  }
  sort(shape.begin(), shape.end());
  return shape;
}

static vector<pair<int,int>> rotate90(const vector<pair<int,int>>& shape) {
  vector<pair<int,int>> result;
  result.reserve(shape.size());
  for (auto [r,c] : shape) result.push_back({c, -r});
  return normalize(result);
}

static vector<pair<int,int>> mirror(const vector<pair<int,int>>& shape) {
  vector<pair<int,int>> result;
  result.reserve(shape.size());
  for (auto [r,c] : shape) result.push_back({r, -c});
  return normalize(result);
}

static string shape_key(const vector<pair<int,int>>& shape) {
  string key;
  for (auto [r,c] : shape) {
    key += to_string(r);
    key += ',';
    key += to_string(c);
    key += ';';
  }
  return key;
}

static vector<vector<pair<int,int>>> orientations(const vector<pair<int,int>>& base) {
  unordered_set<string> seen;
  vector<vector<pair<int,int>>> result;

  for (int reflected = 0; reflected < 2; ++reflected) {
    auto current = reflected ? mirror(base) : normalize(base);
    for (int quarter_turns = 0; quarter_turns < 4; ++quarter_turns) {
      current = normalize(current);
      if (seen.insert(shape_key(current)).second) result.push_back(current);
      current = rotate90(current);
    }
  }
  return result;
}

static int transform_cell(int index, int transform) {
  const int r = index / 8;
  const int c = index % 8;
  switch (transform) {
    case 0: return r * 8 + c;
    case 1: return c * 8 + (7 - r);
    case 2: return (7 - r) * 8 + (7 - c);
    case 3: return (7 - c) * 8 + r;
    case 4: return r * 8 + (7 - c);
    case 5: return (7 - r) * 8 + c;
    case 6: return c * 8 + r;
    default: return (7 - c) * 8 + (7 - r);
  }
}

static uint64_t transform_mask(uint64_t mask, int transform) {
  uint64_t result = 0;
  while (mask) {
    const int bit = __builtin_ctzll(mask);
    mask &= mask - 1;
    result |= 1ULL << transform_cell(bit, transform);
  }
  return result;
}

static bool empty_regions_are_multiples_of_five(uint64_t occupied) {
  uint64_t empty = ~occupied;

  while (empty) {
    const int seed = __builtin_ctzll(empty);
    uint64_t component = 0;
    uint64_t frontier = 1ULL << seed;

    while (frontier) {
      component |= frontier;
      const uint64_t left  = (frontier & 0xfefefefefefefefeULL) >> 1;
      const uint64_t right = (frontier & 0x7f7f7f7f7f7f7f7fULL) << 1;
      const uint64_t up    = frontier >> 8;
      const uint64_t down  = frontier << 8;
      frontier = (left | right | up | down) & empty & ~component;
    }

    if (__builtin_popcountll(component) % 5 != 0) return false;
    empty &= ~component;
  }

  return true;
}

static void write_solution() {
  array<char,64> board{};
  board.fill('?');

  for (int piece = 0; piece < 13; ++piece) {
    const auto &p = placements[chosen[piece]];
    const char symbol = (piece == 12) ? 'O' : PIECE_NAMES[piece][0];
    for (int i = 0; i < p.cell_count; ++i) board[p.cells[i]] = symbol;
  }

  output << '"';
  for (char ch : board) output << ch;
  output << "\",\n";
}

static void search(uint64_t occupied, uint16_t used_pieces) {
  if (used_pieces == 0x1fff) {
    ++solution_count;
    write_solution();
    return;
  }

  int target_cell = -1;
  int fewest_candidates = 1 << 30;

  for (int cell = 0; cell < 64; ++cell) {
    if ((occupied >> cell) & 1ULL) continue;

    int candidates = 0;
    for (int placement_index : placements_by_cell[cell]) {
      const auto &p = placements[placement_index];
      if (used_pieces & (1u << p.piece)) continue;
      if (occupied & p.mask) continue;
      ++candidates;
    }

    if (candidates == 0) return;
    if (candidates < fewest_candidates) {
      fewest_candidates = candidates;
      target_cell = cell;
      if (candidates == 1) break;
    }
  }

  for (int placement_index : placements_by_cell[target_cell]) {
    const auto &p = placements[placement_index];
    if (used_pieces & (1u << p.piece)) continue;
    if (occupied & p.mask) continue;

    const uint64_t next_occupied = occupied | p.mask;
    if (!empty_regions_are_multiples_of_five(next_occupied)) continue;

    chosen[p.piece] = placement_index;
    search(next_occupied, used_pieces | (1u << p.piece));
  }
}

static void build_placements() {
  for (int piece = 0; piece < 13; ++piece) {
    for (const auto &shape : orientations(BASE_SHAPES[piece])) {
      int height = 0, width = 0;
      for (auto [r,c] : shape) {
        height = max(height, r + 1);
        width = max(width, c + 1);
      }

      for (int top = 0; top <= 8 - height; ++top) {
        for (int left = 0; left <= 8 - width; ++left) {
          Placement p;
          p.piece = piece;

          for (auto [r,c] : shape) {
            const int cell = (top + r) * 8 + (left + c);
            p.cells[p.cell_count++] = cell;
            p.mask |= 1ULL << cell;
          }

          const int index = static_cast<int>(placements.size());
          placements.push_back(p);
          placements_by_piece[piece].push_back(index);

          for (int i = 0; i < p.cell_count; ++i) {
            placements_by_cell[p.cells[i]].push_back(index);
          }
        }
      }
    }
  }
}

int main() {
  build_placements();

  output.open("boon-block/solutions.js");
  if (!output) {
    cerr << "Could not open boon-block/solutions.js for writing.\n";
    return 1;
  }

  output << "// BOON BLOCK - independently generated mathematical solution database.\n";
  output << "// Source data: only the 12 free pentomino shapes, a movable 2x2 CORE, and an 8x8 board.\n";
  output << "// No third-party solution table is embedded or copied.\n";
  output << "window.BOON_SOLUTIONS=[\n";

  const int F = 0;
  const int CORE = 12;

  // Reduce only square-board symmetry (the D4 group):
  // 1) choose one canonical CORE placement from each symmetry orbit;
  // 2) if that CORE placement still has symmetry, choose one canonical F
  //    placement under the CORE stabilizer.
  //
  // This is a mathematical symmetry reduction. It does not depend on any
  // published solution list or third-party solver output.
  for (int core_index : placements_by_piece[CORE]) {
    const auto &core = placements[core_index];

    uint64_t canonical_core = core.mask;
    for (int t = 1; t < 8; ++t) {
      canonical_core = min(canonical_core, transform_mask(core.mask, t));
    }
    if (core.mask != canonical_core) continue;

    vector<int> stabilizer;
    for (int t = 0; t < 8; ++t) {
      if (transform_mask(core.mask, t) == core.mask) stabilizer.push_back(t);
    }

    chosen[CORE] = core_index;

    for (int f_index : placements_by_piece[F]) {
      const auto &f = placements[f_index];
      if (f.mask & core.mask) continue;

      uint64_t canonical_f = f.mask;
      for (int t : stabilizer) {
        canonical_f = min(canonical_f, transform_mask(f.mask, t));
      }
      if (f.mask != canonical_f) continue;

      const uint64_t occupied = core.mask | f.mask;
      if (!empty_regions_are_multiples_of_five(occupied)) continue;

      chosen[F] = f_index;
      search(occupied, (1u << CORE) | (1u << F));
    }
  }

  output << "];\nwindow.BOON_SOLUTION_COUNT=" << solution_count << ";\n";
  output.close();

  if (solution_count != 16146) {
    cerr << "Verification failed: expected 16146 symmetry-reduced solutions, got "
         << solution_count << ".\n";
    return 2;
  }

  cout << "Generated and verified " << solution_count << " solutions.\n";
  return 0;
}
