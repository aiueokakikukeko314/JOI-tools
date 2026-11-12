'use strict';
/* 入力テンプレ集: よくある入力形式・出力形式・定番スニペット */

const TEMPLATES = [
  // ---------------- 基本 ----------------
  {
    cat: '基本', title: '整数 1 つ', input: 'N',
    cpp: 'int N;\ncin >> N;',
    py: 'N = int(input())',
  },
  {
    cat: '基本', title: '1 行に複数の整数', input: 'N M K',
    cpp: 'int N, M, K;\ncin >> N >> M >> K;',
    py: 'N, M, K = map(int, input().split())',
  },
  {
    cat: '基本', title: '大きな整数 (long long)', input: 'N    (N ≤ 10^18)',
    desc: 'int は約 2.1×10^9 まで。超えそうなら long long (約 9.2×10^18 まで)。和や積がオーバーフローしないかも確認。',
    cpp: 'long long N;\ncin >> N;',
    py: 'N = int(input())  # Python の int は桁あふれしない',
  },
  {
    cat: '基本', title: '全体の基本テンプレート', full: true, input: '(なんでも)',
    desc: 'プログラム全体のひな形。「エディタを置き換え」で現在のコードと入れ替えます。',
    cpp: SKELETONS.cpp,
    py: SKELETONS.python,
  },

  // ---------------- 配列 ----------------
  {
    cat: '配列', title: 'N と 1 行の数列', input: 'N\nA_1 A_2 … A_N',
    cpp: 'int N;\ncin >> N;\nvector<long long> A(N);\nfor (int i = 0; i < N; i++) cin >> A[i];',
    py: 'N = int(input())\nA = list(map(int, input().split()))',
  },
  {
    cat: '配列', title: '縦に並んだ数列', input: 'N\nA_1\nA_2\n…\nA_N',
    desc: 'C++ の cin は改行もスペースも同じように読むので、横並びと同じコードで OK。',
    cpp: 'int N;\ncin >> N;\nvector<long long> A(N);\nfor (int i = 0; i < N; i++) cin >> A[i];',
    py: 'N = int(input())\nA = [int(input()) for _ in range(N)]',
  },
  {
    cat: '配列', title: 'N 行の組 (A_i B_i)', input: 'N\nA_1 B_1\nA_2 B_2\n…\nA_N B_N',
    cpp: 'int N;\ncin >> N;\nvector<long long> A(N), B(N);\nfor (int i = 0; i < N; i++) cin >> A[i] >> B[i];',
    py: 'N = int(input())\nA = [0] * N\nB = [0] * N\nfor i in range(N):\n    A[i], B[i] = map(int, input().split())',
  },
  {
    cat: '配列', title: '2 次元配列 (数の表)', input: 'H W\nA_{1,1} … A_{1,W}\n…\nA_{H,1} … A_{H,W}',
    cpp: 'int H, W;\ncin >> H >> W;\nvector<vector<long long>> A(H, vector<long long>(W));\nfor (int i = 0; i < H; i++)\n    for (int j = 0; j < W; j++) cin >> A[i][j];',
    py: 'H, W = map(int, input().split())\nA = [list(map(int, input().split())) for _ in range(H)]',
  },
  {
    cat: '配列', title: '区間クエリ (L R) + 累積和', input: 'N Q\nA_1 … A_N\nL_1 R_1\n…\nL_Q R_Q',
    desc: '1 始まりの閉区間 [L, R] の和。累積和 S を使うと 1 クエリ O(1)。',
    cpp: 'int N, Q;\ncin >> N >> Q;\nvector<long long> A(N), S(N + 1, 0);\nfor (int i = 0; i < N; i++) {\n    cin >> A[i];\n    S[i + 1] = S[i] + A[i];\n}\nwhile (Q--) {\n    int L, R;\n    cin >> L >> R;  // 1-indexed, 閉区間 [L, R]\n    cout << S[R] - S[L - 1] << "\\n";\n}',
    py: 'N, Q = map(int, input().split())\nA = list(map(int, input().split()))\nS = [0] * (N + 1)\nfor i in range(N):\n    S[i + 1] = S[i] + A[i]\nout = []\nfor _ in range(Q):\n    L, R = map(int, input().split())  # 1-indexed, 閉区間 [L, R]\n    out.append(S[R] - S[L - 1])\nprint("\\n".join(map(str, out)))',
  },

  // ---------------- 文字列・グリッド ----------------
  {
    cat: '文字列・グリッド', title: '文字列 1 つ', input: 'S',
    cpp: 'string S;\ncin >> S;\nint N = S.size();',
    py: 'S = input().strip()  # readline だと末尾に改行が残るので strip()\nN = len(S)',
  },
  {
    cat: '文字列・グリッド', title: 'N と文字列', input: 'N\nS',
    cpp: 'int N;\nstring S;\ncin >> N >> S;',
    py: 'N = int(input())\nS = input().strip()',
  },
  {
    cat: '文字列・グリッド', title: '空白を含む 1 行', input: 'Hello World',
    desc: 'cin >> の直後に getline するときは、残っている改行を cin.ignore() で読み飛ばす。',
    cpp: 'string line;\ngetline(cin, line);',
    py: 'line = input().rstrip("\\n")',
  },
  {
    cat: '文字列・グリッド', title: '文字のグリッド (迷路など)', input: 'H W\nS_1\nS_2\n…\nS_H\n\n例:\n3 4\n#..#\n....\n#.##',
    cpp: 'int H, W;\ncin >> H >> W;\nvector<string> S(H);\nfor (int i = 0; i < H; i++) cin >> S[i];\n// S[i][j] で i 行目 j 列目の文字',
    py: 'H, W = map(int, input().split())\nS = [input().strip() for _ in range(H)]\n# S[i][j] で i 行目 j 列目の文字',
  },
  {
    cat: '文字列・グリッド', title: '上下左右の 4 方向', input: '(グリッド上の (i, j) から移動)',
    cpp: 'const int dx[4] = {1, 0, -1, 0};\nconst int dy[4] = {0, 1, 0, -1};\nfor (int d = 0; d < 4; d++) {\n    int ni = i + dx[d], nj = j + dy[d];\n    if (ni < 0 || ni >= H || nj < 0 || nj >= W) continue;\n    if (S[ni][nj] == \'#\') continue;\n    // (ni, nj) へ移動\n}',
    py: 'for di, dj in ((1, 0), (0, 1), (-1, 0), (0, -1)):\n    ni, nj = i + di, j + dj\n    if not (0 <= ni < H and 0 <= nj < W):\n        continue\n    if S[ni][nj] == "#":\n        continue\n    # (ni, nj) へ移動',
  },
  {
    cat: '文字列・グリッド', title: 'グリッドの BFS (最短手数)', input: 'H W\nS_1 … S_H  (スタート (si, sj))',
    cpp: 'const int dx[4] = {1, 0, -1, 0}, dy[4] = {0, 1, 0, -1};\nvector<vector<int>> dist(H, vector<int>(W, -1));\nqueue<pair<int, int>> q;\ndist[si][sj] = 0;\nq.push({si, sj});\nwhile (!q.empty()) {\n    auto [i, j] = q.front();\n    q.pop();\n    for (int d = 0; d < 4; d++) {\n        int ni = i + dx[d], nj = j + dy[d];\n        if (ni < 0 || ni >= H || nj < 0 || nj >= W) continue;\n        if (S[ni][nj] == \'#\' || dist[ni][nj] != -1) continue;\n        dist[ni][nj] = dist[i][j] + 1;\n        q.push({ni, nj});\n    }\n}',
    py: 'from collections import deque\ndist = [[-1] * W for _ in range(H)]\ndist[si][sj] = 0\nq = deque([(si, sj)])\nwhile q:\n    i, j = q.popleft()\n    for di, dj in ((1, 0), (0, 1), (-1, 0), (0, -1)):\n        ni, nj = i + di, j + dj\n        if 0 <= ni < H and 0 <= nj < W and S[ni][nj] != "#" and dist[ni][nj] == -1:\n            dist[ni][nj] = dist[i][j] + 1\n            q.append((ni, nj))',
  },

  // ---------------- グラフ・木 ----------------
  {
    cat: 'グラフ・木', title: '無向グラフ (辺のリスト)', input: 'N M\nU_1 V_1\n…\nU_M V_M',
    desc: '頂点番号が 1 始まりなら 1 引いて 0 始まりにすると扱いやすい。',
    cpp: 'int N, M;\ncin >> N >> M;\nvector<vector<int>> G(N);\nfor (int i = 0; i < M; i++) {\n    int u, v;\n    cin >> u >> v;\n    u--; v--;  // 1-indexed → 0-indexed\n    G[u].push_back(v);\n    G[v].push_back(u);\n}',
    py: 'N, M = map(int, input().split())\nG = [[] for _ in range(N)]\nfor _ in range(M):\n    u, v = map(int, input().split())\n    u -= 1; v -= 1  # 1-indexed → 0-indexed\n    G[u].append(v)\n    G[v].append(u)',
  },
  {
    cat: 'グラフ・木', title: '重み付きグラフ', input: 'N M\nA_1 B_1 C_1\n…\nA_M B_M C_M',
    desc: '有向グラフなら逆向きの辺は追加しない。',
    cpp: 'int N, M;\ncin >> N >> M;\nvector<vector<pair<int, long long>>> G(N);  // (行き先, 重み)\nfor (int i = 0; i < M; i++) {\n    int a, b;\n    long long c;\n    cin >> a >> b >> c;\n    a--; b--;\n    G[a].push_back({b, c});\n    G[b].push_back({a, c});  // 無向なら\n}',
    py: 'N, M = map(int, input().split())\nG = [[] for _ in range(N)]  # (行き先, 重み)\nfor _ in range(M):\n    a, b, c = map(int, input().split())\n    a -= 1; b -= 1\n    G[a].append((b, c))\n    G[b].append((a, c))  # 無向なら',
  },
  {
    cat: 'グラフ・木', title: '木 (N−1 本の辺)', input: 'N\nA_1 B_1\n…\nA_{N-1} B_{N-1}',
    cpp: 'int N;\ncin >> N;\nvector<vector<int>> G(N);\nfor (int i = 0; i < N - 1; i++) {\n    int a, b;\n    cin >> a >> b;\n    a--; b--;\n    G[a].push_back(b);\n    G[b].push_back(a);\n}',
    py: 'N = int(input())\nG = [[] for _ in range(N)]\nfor _ in range(N - 1):\n    a, b = map(int, input().split())\n    a -= 1; b -= 1\n    G[a].append(b)\n    G[b].append(a)',
  },
  {
    cat: 'グラフ・木', title: '木 (親の番号 P_2 … P_N)', input: 'N\nP_2 P_3 … P_N',
    desc: '頂点 1 が根で、頂点 i の親が P_i。1 行ずつ与えられる場合も C++ は同じコードで読める。',
    cpp: 'int N;\ncin >> N;\nvector<int> par(N, -1);\nvector<vector<int>> children(N);\nfor (int i = 1; i < N; i++) {\n    cin >> par[i];\n    par[i]--;\n    children[par[i]].push_back(i);\n}',
    py: 'N = int(input())\nP = [-1] + [int(x) - 1 for x in input().split()]\nchildren = [[] for _ in range(N)]\nfor i in range(1, N):\n    children[P[i]].append(i)',
  },
  {
    cat: 'グラフ・木', title: 'ダイクストラ法', input: '(重み付きグラフ G, 始点 s)',
    cpp: 'const long long INF = 1LL << 60;\nvector<long long> dist(N, INF);\npriority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> pq;\ndist[s] = 0;\npq.push({0, s});\nwhile (!pq.empty()) {\n    auto [d, v] = pq.top();\n    pq.pop();\n    if (d > dist[v]) continue;\n    for (auto [u, w] : G[v]) {\n        if (d + w < dist[u]) {\n            dist[u] = d + w;\n            pq.push({dist[u], u});\n        }\n    }\n}',
    py: 'import heapq\nINF = 1 << 60\ndist = [INF] * N\ndist[s] = 0\npq = [(0, s)]\nwhile pq:\n    d, v = heapq.heappop(pq)\n    if d > dist[v]:\n        continue\n    for u, w in G[v]:\n        if d + w < dist[u]:\n            dist[u] = d + w\n            heapq.heappush(pq, (dist[u], u))',
  },
  {
    cat: 'グラフ・木', title: 'Union-Find', input: '(連結判定・グループ分け)',
    cpp: 'struct UnionFind {\n    vector<int> p;\n    UnionFind(int n) : p(n, -1) {}\n    int find(int x) { return p[x] < 0 ? x : p[x] = find(p[x]); }\n    bool unite(int a, int b) {\n        a = find(a); b = find(b);\n        if (a == b) return false;\n        if (p[a] > p[b]) swap(a, b);\n        p[a] += p[b];\n        p[b] = a;\n        return true;\n    }\n    bool same(int a, int b) { return find(a) == find(b); }\n    int size(int x) { return -p[find(x)]; }\n};',
    py: 'class UnionFind:\n    def __init__(self, n):\n        self.p = [-1] * n\n\n    def find(self, x):\n        r = x\n        while self.p[r] >= 0:\n            r = self.p[r]\n        while self.p[x] >= 0:\n            self.p[x], x = r, self.p[x]\n        return r\n\n    def unite(self, a, b):\n        a, b = self.find(a), self.find(b)\n        if a == b:\n            return False\n        if self.p[a] > self.p[b]:\n            a, b = b, a\n        self.p[a] += self.p[b]\n        self.p[b] = a\n        return True\n\n    def same(self, a, b):\n        return self.find(a) == self.find(b)\n\n    def size(self, x):\n        return -self.p[self.find(x)]',
  },

  // ---------------- クエリ・特殊 ----------------
  {
    cat: 'クエリ・特殊', title: '種類ごとに形の違うクエリ', input: 'Q\n1 x\n2 x y\n3',
    cpp: 'int Q;\ncin >> Q;\nwhile (Q--) {\n    int type;\n    cin >> type;\n    if (type == 1) {\n        int x;\n        cin >> x;\n        // ...\n    } else if (type == 2) {\n        int x, y;\n        cin >> x >> y;\n        // ...\n    } else {\n        // ...\n    }\n}',
    py: 'Q = int(input())\nfor _ in range(Q):\n    q = list(map(int, input().split()))\n    if q[0] == 1:\n        x = q[1]\n    elif q[0] == 2:\n        x, y = q[1], q[2]\n    else:\n        pass',
  },
  {
    cat: 'クエリ・特殊', title: '複数のテストケース', input: 'T\n(ケース 1)\n(ケース 2)\n…',
    desc: 'グローバル配列などはケースごとに初期化を忘れずに。',
    cpp: 'int T;\ncin >> T;\nwhile (T--) {\n    int N;\n    cin >> N;\n    // ...\n}',
    py: 'T = int(input())\nfor _ in range(T):\n    N = int(input())\n    # ...',
  },
  {
    cat: 'クエリ・特殊', title: '入力の終わり (EOF) まで読む', input: '(行数が書かれていない)',
    cpp: 'long long x;\nwhile (cin >> x) {\n    // ...\n}',
    py: 'import sys\nfor line in sys.stdin:\n    a = list(map(int, line.split()))\n    # ...',
  },
  {
    cat: 'クエリ・特殊', title: 'まとめて読む (高速・形式を問わない)', input: '(大量の入力 / 改行位置がバラバラ)',
    desc: 'Python で入力が多い (10^5 個以上) ときに速い。C++ は sync_with_stdio(false) で十分速い。',
    cpp: 'ios::sync_with_stdio(false);\ncin.tie(nullptr);',
    py: 'import sys\ndata = sys.stdin.buffer.read().split()\nidx = 0\nN = int(data[idx]); idx += 1\nA = [int(x) for x in data[idx:idx + N]]; idx += N',
  },

  // ---------------- 出力 ----------------
  {
    cat: '出力', title: 'スペース区切りで 1 行に出力', input: '出力: A_1 A_2 … A_N',
    cpp: 'for (int i = 0; i < N; i++) {\n    cout << A[i] << (i + 1 < N ? \' \' : \'\\n\');\n}',
    py: 'print(*A)',
  },
  {
    cat: '出力', title: '1 行ずつ出力 (大量)', input: '出力:\nA_1\nA_2\n…',
    desc: 'endl は毎回フラッシュするので遅い。"\\n" を使う。Python は join でまとめて出力。',
    cpp: 'for (auto x : A) cout << x << "\\n";',
    py: 'print("\\n".join(map(str, A)))',
  },
  {
    cat: '出力', title: 'Yes / No', input: '出力: Yes または No',
    desc: '大文字・小文字 (Yes / YES / yes) は問題文に合わせる。',
    cpp: 'cout << (ok ? "Yes" : "No") << "\\n";',
    py: 'print("Yes" if ok else "No")',
  },
  {
    cat: '出力', title: '小数の出力', input: '出力: 3.1415926536',
    cpp: 'cout << fixed << setprecision(10) << ans << "\\n";',
    py: 'print(f"{ans:.10f}")',
  },
  {
    cat: '出力', title: 'グリッドの出力', input: '出力:\n#..#\n....',
    cpp: 'for (int i = 0; i < H; i++) cout << S[i] << "\\n";',
    py: '# S が文字のリストのリストなら "".join(row)\nprint("\\n".join("".join(row) for row in S))',
  },

  // ---------------- 定番スニペット ----------------
  {
    cat: '定番スニペット', title: 'INF と MOD', input: '',
    cpp: 'const long long INF = 1LL << 60;\nconst long long MOD = 998244353;  // 問題文の値を確認',
    py: 'INF = 1 << 60\nMOD = 998244353  # 問題文の値を確認',
  },
  {
    cat: '定番スニペット', title: 'ソート (昇順・降順・条件付き)', input: '',
    cpp: 'sort(A.begin(), A.end());    // 昇順\nsort(A.rbegin(), A.rend());  // 降順\n// ペアを 2 番目の値で並べる\nsort(P.begin(), P.end(), [](const auto& a, const auto& b) { return a.second < b.second; });',
    py: 'A.sort()              # 昇順\nA.sort(reverse=True)  # 降順\nP.sort(key=lambda p: p[1])  # 2 番目の値で並べる',
  },
  {
    cat: '定番スニペット', title: '二分探索 (lower_bound)', input: '(ソート済みの配列 A から x を探す)',
    cpp: 'int k = lower_bound(A.begin(), A.end(), x) - A.begin();  // x 以上の最初の位置\nint c = upper_bound(A.begin(), A.end(), x) - A.begin();  // x 以下の個数',
    py: 'from bisect import bisect_left, bisect_right\nk = bisect_left(A, x)   # x 以上の最初の位置\nc = bisect_right(A, x)  # x 以下の個数',
  },
  {
    cat: '定番スニペット', title: '答えで二分探索', input: '(check(x) が単調なとき)',
    cpp: 'long long ng = 0, ok = 2e18;  // check(ok) は true, check(ng) は false になるように\nwhile (ok - ng > 1) {\n    long long mid = ng + (ok - ng) / 2;\n    if (check(mid)) ok = mid;\n    else ng = mid;\n}\n// 答えは ok',
    py: 'ng, ok = 0, 2 * 10 ** 18  # check(ok) は True, check(ng) は False になるように\nwhile ok - ng > 1:\n    mid = (ok + ng) // 2\n    if check(mid):\n        ok = mid\n    else:\n        ng = mid\n# 答えは ok',
  },
  {
    cat: '定番スニペット', title: 'bit 全探索', input: '(N ≤ 20 程度)',
    cpp: 'for (int mask = 0; mask < (1 << N); mask++) {\n    for (int i = 0; i < N; i++) {\n        if (mask >> i & 1) {\n            // i を選ぶ\n        }\n    }\n}',
    py: 'for mask in range(1 << N):\n    for i in range(N):\n        if mask >> i & 1:\n            pass  # i を選ぶ',
  },
  {
    cat: '定番スニペット', title: '繰り返し二乗法 (a^e mod m)', input: '',
    cpp: 'long long modpow(long long a, long long e, long long m) {\n    long long r = 1;\n    a %= m;\n    while (e > 0) {\n        if (e & 1) r = r * a % m;\n        a = a * a % m;\n        e >>= 1;\n    }\n    return r;\n}',
    py: 'r = pow(a, e, m)  # Python は組み込みで OK',
  },
  {
    cat: '定番スニペット', title: '再帰の深さ上限 (Python)', input: '',
    desc: 'Python で深い再帰 (DFS など) をするときに必要。C++ では基本的に不要。',
    cpp: '// C++ では通常不要（スタックが足りないときはループに書き換える）',
    py: 'import sys\nsys.setrecursionlimit(10 ** 6)',
  },
];

const Templates = {
  lang: null,
  cat: 'すべて',

  init() {
    this.lang = Store.get('tmplLang', null) || CodeTest.state.lang;
    const cats = ['すべて', ...new Set(TEMPLATES.map(t => t.cat))];
    const nav = $('#tmplCats');
    nav.innerHTML = cats.map(c => `<button data-cat="${c}">${c}</button>`).join('');
    $$('#tmplCats button').forEach(b => b.addEventListener('click', () => { this.cat = b.dataset.cat; this.render(); }));
    $$('#tmplLang button').forEach(b => b.addEventListener('click', () => { this.lang = b.dataset.lang; Store.set('tmplLang', this.lang); this.render(); }));
    $('#tmplSearch').addEventListener('input', () => this.render());
    this.render();
  },

  render() {
    $$('#tmplCats button').forEach(b => b.classList.toggle('on', b.dataset.cat === this.cat));
    $$('#tmplLang button').forEach(b => b.classList.toggle('on', b.dataset.lang === this.lang));
    const q = $('#tmplSearch').value.trim().toLowerCase();
    const items = TEMPLATES.filter(t => (this.cat === 'すべて' || t.cat === this.cat) &&
      (!q || [t.title, t.cat, t.desc || '', t.input, t.cpp, t.py].join('\n').toLowerCase().includes(q)));
    const list = $('#tmplList');
    list.innerHTML = '';
    if (!items.length) { list.innerHTML = '<p class="muted">見つかりませんでした。</p>'; return; }
    for (const t of items) {
      const code = this.lang === 'python' ? t.py : t.cpp;
      const card = document.createElement('div');
      card.className = 'tmpl-card';
      card.innerHTML = `
        <h4>${escapeHtml(t.title)} <span class="cat">${escapeHtml(t.cat)}</span></h4>
        ${t.desc ? `<p>${escapeHtml(t.desc)}</p>` : ''}
        <div class="io">
          ${t.input ? `<div><div class="lbl">入力形式</div><pre>${escapeHtml(t.input)}</pre></div>` : '<div></div>'}
          <div><div class="lbl">${this.lang === 'python' ? 'Python' : 'C++'}</div><pre class="code">${highlight(code, this.lang)}</pre></div>
        </div>
        <div class="acts">
          <button data-act="copy">コピー</button>
          <button data-act="insert" class="primary">${t.full ? 'エディタを置き換え' : 'エディタに挿入'}</button>
        </div>`;
      $('[data-act=copy]', card).addEventListener('click', () => copyText(code));
      $('[data-act=insert]', card).addEventListener('click', () => {
        if (CodeTest.state.lang !== this.lang) {
          $('#langSel').value = this.lang;
          $('#langSel').dispatchEvent(new Event('change'));
        }
        if (t.full) {
          const ed = CodeTest.editor;
          ed.replace(0, ed.getValue().length, code, 0);
          App.show('code');
          toast('エディタを置き換えました（Ctrl+Z で元に戻せます）');
        } else {
          App.insertCode(code);
        }
      });
      list.appendChild(card);
    }
  },
};
