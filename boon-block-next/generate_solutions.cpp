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

// BOON BLOCK — JUNGLE QUEST
// 5x5 child-friendly exact-cover puzzle.
//
// Piece sizes:
//   A = 4
//   B = 4
//   C = 5
//   D = 5
//   E = 6
//   CORE = 1
// Total = 25 cells.
//
// The runtime solution database is generated only from these coordinates.
// No published answer table is imported or embedded.

struct Placement {
  int piece = -1;
  uint32_t mask = 0;
  array<int,6> cells{};
  int cell_count = 0;
};

static const vector<string> PIECE_NAMES = {"A","B","C","D","E","CORE"};

// Project-selected mixed-size silhouettes.
// This is intentionally not the classic 12-pentomino set, nor a complete
// tetromino/pentomino/hexomino family.
static const vector<vector<pair<int,int>>> BASE_SHAPES = {
  // A — chunky corner (4)
  {{0,0},{0,1},{0,2},{1,0}},

  // B — soft zig (4)
  {{0,0},{0,1},{1,1},{1,2}},

  // C — chunky cap (5)
  {{0,0},{0,1},{0,2},{1,0},{1,1}},

  // D — long step (5)
  {{0,0},{0,1},{0,2},{1,2},{1,3}},

  // E — broad crown (6)
  {{0,0},{0,1},{0,2},{0,3},{1,0},{1,2}},

  // CORE — movable jungle gem (1)
  {{0,0}}
};

static vector<Placement> placements;
static vector<int> placements_by_cell[25];
static vector<int> placements_by_piece[6];
static array<int,6> chosen{};
static long long solution_count = 0;
static long long center_core_count = 0;
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
    for (int turns = 0; turns < 4; ++turns) {
      current = normalize(current);
      if (seen.insert(shape_key(current)).second) result.push_back(current);
      current = rotate90(current);
    }
  }
  return result;
}

static void write_solution() {
  static const char SYMBOLS[6] = {'A','B','C','D','E','O'};
  array<char,25> board{};
  board.fill('?');

  for (int piece = 0; piece < 6; ++piece) {
    const auto &p = placements[chosen[piece]];
    for (int i = 0; i < p.cell_count; ++i) board[p.cells[i]] = SYMBOLS[piece];
  }

  const auto &core = placements[chosen[5]];
  if (core.mask == (1u << 12)) ++center_core_count;

  output << '"';
  for (char ch : board) output << ch;
  output << "\",\n";
}

static void search(uint32_t occupied, uint8_t used_pieces) {
  constexpr uint32_t FULL = (1u << 25) - 1u;
  if (occupied == FULL) {
    if (used_pieces == 0x3f) {
      ++solution_count;
      write_solution();
    }
    return;
  }

  int target_cell = -1;
  int fewest_candidates = 1 << 30;

  // Minimum-remaining-values exact-cover search.
  for (int cell = 0; cell < 25; ++cell) {
    if ((occupied >> cell) & 1u) continue;

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

    chosen[p.piece] = placement_index;
    search(occupied | p.mask, used_pieces | (1u << p.piece));
  }
}

static void build_placements() {
  for (int piece = 0; piece < 6; ++piece) {
    for (const auto &shape : orientations(BASE_SHAPES[piece])) {
      int height = 0, width = 0;
      for (auto [r,c] : shape) {
        height = max(height, r + 1);
        width = max(width, c + 1);
      }

      for (int top = 0; top <= 5 - height; ++top) {
        for (int left = 0; left <= 5 - width; ++left) {
          Placement p;
          p.piece = piece;

          for (auto [r,c] : shape) {
            const int cell = (top + r) * 5 + (left + c);
            p.cells[p.cell_count++] = cell;
            p.mask |= 1u << cell;
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

  output << "// BOON BLOCK JUNGLE QUEST - independently generated 5x5 solution database.\n";
  output << "// Five mixed-size project-selected blocks + movable 1-cell CORE.\n";
  output << "// No third-party answer table is embedded or copied.\n";
  output << "window.BOON_KIDS_SOLUTIONS=[\n";

  const int CORE = 5;

  // Enumerate every possible CORE location; all remaining pieces are solved
  // by exact cover from the project-defined coordinate data.
  for (int core_index : placements_by_piece[CORE]) {
    const auto &core = placements[core_index];
    chosen[CORE] = core_index;
    search(core.mask, 1u << CORE);
  }

  output << "];\n";
  output << "window.BOON_KIDS_SOLUTION_COUNT=" << solution_count << ";\n";
  output << "window.BOON_KIDS_CENTER_COUNT=" << center_core_count << ";\n";
  output.close();

  if (solution_count != 192) {
    cerr << "Verification failed: expected 192 solutions, got "
         << solution_count << ".\n";
    return 2;
  }

  if (center_core_count != 40) {
    cerr << "Verification failed: expected 40 center-CORE solutions, got "
         << center_core_count << ".\n";
    return 3;
  }

  cout << "Generated " << solution_count
       << " complete solutions; " << center_core_count
       << " keep CORE at the starting center cell.\n";
  return 0;
}
