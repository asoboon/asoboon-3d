#include <bits/stdc++.h>
using namespace std;

struct Pl{int piece,ori,r,c,n; uint64_t mask; array<int,5> cells;};

vector<string> ids={"F","I","L","P","N","T","U","V","W","X","Y","Z","CORE"};
map<string,vector<pair<int,int>>> defs={
 {"F",{{0,1},{0,2},{1,0},{1,1},{2,1}}},
 {"I",{{0,0},{1,0},{2,0},{3,0},{4,0}}},
 {"L",{{0,0},{1,0},{2,0},{3,0},{3,1}}},
 {"P",{{0,0},{0,1},{1,0},{1,1},{2,0}}},
 {"N",{{0,0},{1,0},{1,1},{2,1},{3,1}}},
 {"T",{{0,0},{0,1},{0,2},{1,1},{2,1}}},
 {"U",{{0,0},{0,2},{1,0},{1,1},{1,2}}},
 {"V",{{0,0},{1,0},{2,0},{2,1},{2,2}}},
 {"W",{{0,0},{1,0},{1,1},{2,1},{2,2}}},
 {"X",{{0,1},{1,0},{1,1},{1,2},{2,1}}},
 {"Y",{{0,0},{1,0},{2,0},{3,0},{1,1}}},
 {"Z",{{0,0},{0,1},{1,1},{2,1},{2,2}}},
 {"CORE",{{0,0},{0,1},{1,0},{1,1}}}
};

vector<vector<Pl>> bypiece(13);
vector<pair<int,int>> bycell[64];
int choice[13];
long long solutionCount=0;
ofstream out;

vector<pair<int,int>> norm(vector<pair<int,int>> s){
 int mr=99,mc=99;
 for(auto [r,c]:s){mr=min(mr,r);mc=min(mc,c);}
 for(auto &x:s){x.first-=mr;x.second-=mc;}
 sort(s.begin(),s.end());
 return s;
}
vector<pair<int,int>> rot(vector<pair<int,int>> s){
 for(auto &x:s){int r=x.first,c=x.second;x={c,-r};}
 return norm(s);
}
vector<pair<int,int>> flip(vector<pair<int,int>> s){
 for(auto &x:s)x.second=-x.second;
 return norm(s);
}
string shapeKey(const vector<pair<int,int>>&s){
 string k;
 for(auto [r,c]:s){k+=char('0'+r);k+=char('0'+c);}
 return k;
}
vector<vector<pair<int,int>>> orientations(vector<pair<int,int>> s){
 set<string> seen;
 vector<vector<pair<int,int>>> outv;
 s=norm(s);
 for(int f=0;f<2;f++){
  auto t=f?flip(s):s;
  for(int i=0;i<4;i++){
   auto n=norm(t);
   if(seen.insert(shapeKey(n)).second)outv.push_back(n);
   t=rot(t);
  }
 }
 return outv;
}

inline bool regionOk(uint64_t occ){
 uint64_t empty=~occ;
 while(empty){
  uint64_t comp=0,front=empty&-empty;
  while(front){
   comp|=front;
   uint64_t left=(front&0xfefefefefefefefeULL)>>1;
   uint64_t right=(front&0x7f7f7f7f7f7f7f7fULL)<<1;
   uint64_t up=front>>8,down=front<<8;
   front=(left|right|up|down)&empty&~comp;
  }
  if(__builtin_popcountll(comp)%5)return false;
  empty&=~comp;
 }
 return true;
}

void emitSolution(){
 array<char,64> b; b.fill('?');
 for(int pi=0;pi<13;pi++){
  auto &p=bypiece[pi][choice[pi]];
  char ch=ids[pi]=="CORE"?'O':ids[pi][0];
  for(int j=0;j<p.n;j++)b[p.cells[j]]=ch;
 }
 out<<"\"";
 for(char ch:b)out<<ch;
 out<<"\",\n";
}

void searchRest(uint64_t occ,int used){
 if(used==(1<<13)-1){
  solutionCount++;
  emitSolution();
  return;
 }
 int best=-1,bestCount=INT_MAX;
 for(int cell=0;cell<64;cell++){
  if((occ>>cell)&1)continue;
  int n=0;
  for(auto [pi,ix]:bycell[cell]){
   if(used&(1<<pi))continue;
   auto &p=bypiece[pi][ix];
   if(!(p.mask&occ))n++;
  }
  if(!n)return;
  if(n<bestCount){bestCount=n;best=cell;if(n==1)break;}
 }
 for(auto [pi,ix]:bycell[best]){
  if(used&(1<<pi))continue;
  auto &p=bypiece[pi][ix];
  if(p.mask&occ)continue;
  uint64_t next=occ|p.mask;
  if(!regionOk(next))continue;
  choice[pi]=ix;
  searchRest(next,used|(1<<pi));
 }
}

int main(){
 for(int pi=0;pi<13;pi++){
  auto os=orientations(defs[ids[pi]]);
  for(int oi=0;oi<(int)os.size();oi++){
   auto sh=os[oi];
   int h=0,w=0;
   for(auto [r,c]:sh){h=max(h,r+1);w=max(w,c+1);}
   for(int r=0;r<=8-h;r++)for(int c=0;c<=8-w;c++){
    Pl p{};p.piece=pi;p.ori=oi;p.r=r;p.c=c;p.n=sh.size();
    int j=0;
    for(auto [a,b]:sh){
     int cell=(r+a)*8+c+b;
     p.cells[j++]=cell;
     p.mask|=1ULL<<cell;
    }
    int ix=bypiece[pi].size();
    bypiece[pi].push_back(p);
    for(int k=0;k<p.n;k++)bycell[p.cells[k]].push_back({pi,ix});
   }
  }
 }

 out.open("boon-block/solutions.js");
 out<<"// AUTO-GENERATED: BOON BLOCK 8x8, 12 pentominoes + movable 2x2 CORE.\n";
 out<<"// Symmetry-reduced exhaustive solution database.\n";
 out<<"window.BOON_SOLUTIONS=[\n";

 const int CORE=12,X=9,I=1;
 for(int ci=0;ci<(int)bypiece[CORE].size();ci++){
  auto &C=bypiece[CORE][ci];
  if(C.r>3||C.c>C.r)continue;
  choice[CORE]=ci;
  for(int xi=0;xi<(int)bypiece[X].size();xi++){
   auto &x=bypiece[X][xi];
   if(x.mask&C.mask)continue;
   if(C.r==3&&C.c==3){if(x.r>2||x.c>x.r)continue;}
   else if(C.r==C.c){if(x.c>x.r)continue;}
   else if(C.r==3){if(x.r>2)continue;}
   choice[X]=xi;
   uint64_t occ=C.mask|x.mask;
   for(int ii=0;ii<(int)bypiece[I].size();ii++){
    auto &ip=bypiece[I][ii];
    if(ip.mask&occ)continue;
    if(C.r==C.c&&x.r==x.c&&ip.ori>0)continue;
    uint64_t next=occ|ip.mask;
    if(!regionOk(next))continue;
    choice[I]=ii;
    searchRest(next,(1<<CORE)|(1<<X)|(1<<I));
   }
  }
 }

 out<<"];\nwindow.BOON_SOLUTION_COUNT="<<solutionCount<<";\n";
 out.close();

 if(solutionCount!=16146){
  cerr<<"Expected 16146, got "<<solutionCount<<"\n";
  return 2;
 }
 cout<<"Generated "<<solutionCount<<" solutions.\n";
 return 0;
}
