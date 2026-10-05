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

// BOON BLOCK NEXT
// Independent mathematical exact-cover generator.
//
// Board:
//   8 x 8 = 64 cells
//
// Pieces:
//   10 project-defined connected 6-cell shapes = 60 cells
//   1 movable 2 x 2 CORE                    =  4 cells
//                                             --------
//                                               64 cells
//
// This file contains no imported answer table. Every complete board is derived
// directly from the coordinates below.

struct Placement {
  int piece = -1;
  uint64_t mask = 0;
  array<int, 6> cells{};
  int cell_count = 0;
};

static const vector<string> PIECE_NAMES = {
  "01","02","03","04","05","06","07","08","09","10","CORE"
};

// Ten six-cell silhouettes selected for BOON BLOCK NEXT.
// They deliberately do not use the classic 12-piece pentomino set.
static const vector<vector<pair<int,int>>> BASE_SHAPES = {
  // 01  #####  / .#...
  {{0,0},{0,1},{0,2},{0,3},{0,4},{1,1}},

  // 02  #####  / ..#..
  {{0,0},{0,1},{0,2},{0,3},{0,4},{1,2}},

  // 03  ####   / ##..
  {{0,0},{0,1},{0,2},{0,3},{1,0},{1,1}},

  // 04  ####   / .##.
  {{0,0},{0,1},{0,2},{0,3},{1,1},{1,2}},

  // 05  ###.   / #.##
  {{0,0},{0,1},{0,2},{1,0},{1,2},{1,3}},

  // 06  ###.   / .###
  {{0,0},{0,1},{0,2},{1,1},{1,2},{1,3}},

  // 07  ### / .#. / ##.
  {{0,0},{0,1},{0,2},{1,1},{2,0},{2,1}},

  // 08  ###. / ..#. / ..##
  {{0,0},{0,1},{0,2},{1,2},{2,2},{2,3}},

  // 09  ##. / ### / .#.
  {{0,0},{0,1},{1,0},{1,1},{1,2},{2,1}},

  // 10  ##. / ### / ..#
  {{0,0},{0,1},{1,0},{1,1},{1,2},{2,2}},

  // CORE
  {{0,0},{0,1},{1,0},{1,1}}
};

static vector<Placement> placements;
static vector<int> placements_by_cell[64];
static vector<int> placements_by_piece[11];
static array<int,11> chosen{};
static long long solution_count = 0;
static long long center_core_count = 0;
static ofstream output;

static vector<pair<int,int>> normalize(vector<pair<int,int>> shape) {
  int min_r = 99;
  int min_c = 99;
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

// The CORE is placed first. Every remaining piece has six cells, so each
// disconnected empty region must contain a multiple of six cells.
static bool empty_regions_are_multiples_of_six(uint64_t occupied) {
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

    if (__builtin_popcountll(component) % 6 != 0) return false;
    empty &= ~component;
  }

  return true;
}

static void write_solution() {
  static const char SYMBOLS[11] = {'A','B','C','D','E','F','G','H','I','J','O'};
  array<char,64> board{};
  board.fill('?');

  for (int piece = 0; piece < 11; ++piece) {
    const auto &p = placements[chosen[piece]];
    for (int i = 0; i < p.cell_count; ++i) board[p.cells[i]] = SYMBOLS[piece];
  }

  const auto &core = placements[chosen[10]];
  const uint64_t center_mask =
      (1ULL << (3*8+3)) |
      (1ULL << (3*8+4)) |
      (1ULL << (4*8+3)) |
      (1ULL << (4*8+4));
  if (core.mask == center_mask) ++center_core_count;

  output << '"';
  for (char ch : board) output << ch;
  output << "\",\n";
}

static void search(uint64_t occupied, uint16_t used_pieces) {
  if (used_pieces == 0x07ff) {
    ++solution_count;
    write_solution();
    return;
  }

  int target_cell = -1;
  int fewest_candidates = 1 << 30;

  // Exact-cover MRV: choose the uncovered board cell with the fewest legal
  // placements among unused pieces.
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
    if (!empty_regions_are_multiples_of_six(next_occupied)) continue;

    chosen[p.piece] = placement_index;
    search(next_occupied, used_pieces | (1u << p.piece));
  }
}

static void build_placements() {
  for (int piece = 0; piece < 11; ++piece) {
    for (const auto &shape : orientations(BASE_SHAPES[piece])) {
      int height = 0;
      int width = 0;
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

  output.open("boon-block-next/solutions.js");
  if (!output) {
    cerr << "Could not open boon-block-next/solutions.js for writing.\n";
    return 1;
  }

  output << "// BOON BLOCK NEXT - independently generated solution database.\n";
  output << "// 10 project-defined six-cell pieces + movable 2x2 CORE on an 8x8 board.\n";
  output << "// No third-party solution table is embedded or copied.\n";
  output << "window.BOON_NEXT_SOLUTIONS=[\n";

  const int CORE = 10;

  // Enumerate every legal CORE position, then solve all remaining six-cell
  // pieces. Board rotations/reflections are intentionally retained: the game
  // stores every playable board state directly, which keeps hint matching
  // simple and exact.
  for (int core_index : placements_by_piece[CORE]) {
    const auto &core = placements[core_index];
    chosen[CORE] = core_index;
    search(core.mask, 1u << CORE);
  }

  output << "];\n";
  output << "window.BOON_NEXT_SOLUTION_COUNT=" << solution_count << ";\n";
  output << "window.BOON_NEXT_CENTER_COUNT=" << center_core_count << ";\n";
  output.close();

  if (solution_count != 1832) {
    cerr << "Verification failed: expected 1832 solutions, got "
         << solution_count << ".\n";
    return 2;
  }

  if (center_core_count != 192) {
    cerr << "Verification failed: expected 192 center-CORE solutions, got "
         << center_core_count << ".\n";
    return 3;
  }

  cout << "Generated " << solution_count
       << " complete solutions; " << center_core_count
       << " keep CORE at the starting center position.\n";
  return 0;
}
