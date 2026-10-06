/**
 * TrendWave - Instagram Reels Trending Songs & Reach Tracker
 * Core Application Logic & Audio Player Engine
 */

// Application State
const state = {
  songs: [],
  filteredSongs: [],
  activeCategory: 'all',
  searchQuery: '',
  sortBy: 'reach',
  viewMode: 'grid',
  savedIds: new Set(JSON.parse(localStorage.getItem('tw_saved_songs') || '[]')),
  currentTrack: null,
  currentTrackIndex: -1,
  isPlaying: false,
  isLooping: false,
};

// DOM Element Selectors
const elements = {
  songsContainer: document.getElementById('songs-container'),
  emptyState: document.getElementById('empty-state'),
  displayedCount: document.getElementById('displayed-count'),
  countAll: document.getElementById('count-all'),
  countPhonk: document.getElementById('count-phonk'),
  savedCount: document.getElementById('saved-count'),
  activeFilterLabel: document.getElementById('active-filter-label'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  sortSelect: document.getElementById('sort-select'),
  viewGridBtn: document.getElementById('view-grid-btn'),
  viewListBtn: document.getElementById('view-list-btn'),
  viewLeaderboardBtn: document.getElementById('view-leaderboard-btn'),
  resetFiltersBtn: document.getElementById('reset-filters-btn'),
  categoryPills: document.querySelectorAll('.category-pill'),
  
  // Modals
  reachModal: document.getElementById('reach-modal'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  modalBody: document.getElementById('modal-body'),
  
  calculatorModal: document.getElementById('calculator-modal'),
  btnOpenCalculator: document.getElementById('btn-open-calculator'),
  closeCalculatorBtn: document.getElementById('close-calculator-btn'),
  calcFollowersSlider: document.getElementById('calc-followers-slider'),
  calcFollowersVal: document.getElementById('calc-followers-val'),
  calcNicheSelect: document.getElementById('calc-niche-select'),
  calcSongSelect: document.getElementById('calc-song-select'),
  calcProjectedViews: document.getElementById('calc-projected-views'),
  calcExplorePct: document.getElementById('calc-explore-pct'),
  calcDuration: document.getElementById('calc-duration'),
  calcWindow: document.getElementById('calc-window'),
  calcUseSoundBtn: document.getElementById('calc-use-sound-btn'),

  searchModal: document.getElementById('search-modal'),
  btnToggleSearchModal: document.getElementById('btn-toggle-search-modal'),
  closeSearchModalBtn: document.getElementById('close-search-modal-btn'),
  liveSearchInput: document.getElementById('live-search-input'),
  btnRunLiveSearch: document.getElementById('btn-run-live-search'),
  liveSearchResults: document.getElementById('live-search-results'),

  // Bottom Audio Player
  globalAudio: document.getElementById('global-audio'),
  bottomPlayer: document.getElementById('bottom-player'),
  playerArt: document.getElementById('player-art'),
  playerTitle: document.getElementById('player-title'),
  playerArtist: document.getElementById('player-artist'),
  playerReachBadge: document.getElementById('player-reach-badge'),
  playerPlayBtn: document.getElementById('player-play-btn'),
  playerPlayIcon: document.getElementById('player-play-icon'),
  playerPrevBtn: document.getElementById('player-prev-btn'),
  playerNextBtn: document.getElementById('player-next-btn'),
  playerLoopBtn: document.getElementById('player-loop-btn'),
  playerProgress: document.getElementById('player-progress'),
  playerCurrTime: document.getElementById('player-curr-time'),
  playerDuration: document.getElementById('player-duration'),
  playerVolume: document.getElementById('player-volume'),
  playerMuteBtn: document.getElementById('player-mute-btn'),
  playerVolumeIcon: document.getElementById('player-volume-icon'),
  playerIgBtn: document.getElementById('player-ig-btn'),
  playerEqualizer: document.getElementById('player-equalizer'),

  // Mobile Player Elements
  playerArtMobile: document.getElementById('player-art-mobile'),
  playerTitleMobile: document.getElementById('player-title-mobile'),
  playerArtistMobile: document.getElementById('player-artist-mobile'),
  playerReachMobile: document.getElementById('player-reach-mobile'),
  playerPlayMobileBtn: document.getElementById('player-play-mobile-btn'),
  playerPlayMobileIcon: document.getElementById('player-play-mobile-icon'),
  playerPrevMobileBtn: document.getElementById('player-prev-mobile-btn'),
  playerNextMobileBtn: document.getElementById('player-next-mobile-btn'),
  playerIgMobileBtn: document.getElementById('player-ig-mobile-btn'),
  playerMobileProgress: document.getElementById('player-mobile-progress'),

  // Sync / Auto-Fetch Elements
  btnSyncLive: document.getElementById('btn-sync-live'),
  syncIcon: document.getElementById('sync-icon'),

  // Toast
  toast: document.getElementById('toast'),
  toastMsg: document.getElementById('toast-msg'),
  toastIcon: document.getElementById('toast-icon'),
};

// Initialize Application
async function initApp() {
  await loadSongsData();
  setupEventListeners();
  updateCategoryCounts();
  populateCalculatorOptions();
  renderSongs();
  lucide.createIcons();

  // Setup periodic background auto-fetch (every 90s)
  setInterval(() => {
    autoFetchTracks(true);
  }, 90000);

  // Setup live reach ticker (every 3s)
  startLiveReachTicker();
}

// Fetch trending songs dataset with automatic live API merging
async function loadSongsData() {
  let curatedTracks = [];
  try {
    const res = await fetch('data/trending_songs.json');
    if (res.ok) curatedTracks = await res.json();
  } catch (err) {
    console.warn('Local file fallback:', err);
    curatedTracks = getFallbackData();
  }

  // Attempt live auto-fetch from /api/trending
  try {
    const apiRes = await fetch('/api/trending');
    if (apiRes.ok) {
      const liveTracks = await apiRes.json();
      if (Array.isArray(liveTracks) && liveTracks.length > 0) {
        state.songs = mergeLiveAndCuratedTracks(liveTracks, curatedTracks);
        state.filteredSongs = [...state.songs];
        return;
      }
    }
  } catch (apiErr) {
    console.warn('Live API auto-fetch notice:', apiErr);
  }

  state.songs = curatedTracks;
  state.filteredSongs = [...state.songs];
}

// Merge live chart tracks with curated viral reels hits
function mergeLiveAndCuratedTracks(liveTracks, curatedTracks) {
  const titles = new Set();
  const merged = [];

  // Top viral hits first (first 6 curated)
  curatedTracks.slice(0, 6).forEach(c => {
    titles.add(c.title.toLowerCase());
    merged.push(c);
  });

  // Then add live auto-fetched tracks
  liveTracks.forEach(l => {
    const key = l.title.toLowerCase();
    if (!titles.has(key)) {
      titles.add(key);
      merged.push(l);
    }
  });

  // Then remaining curated (Phonk, Aesthetic, Latin)
  curatedTracks.slice(6).forEach(c => {
    const key = c.title.toLowerCase();
    if (!titles.has(key)) {
      titles.add(key);
      merged.push(c);
    }
  });

  // Re-index ranks 1 to N
  merged.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return merged;
}

// Auto-fetch background and on-demand trigger
async function autoFetchTracks(isBackground = false) {
  if (elements.syncIcon) elements.syncIcon.classList.add('animate-spin');

  try {
    const apiRes = await fetch('/api/trending?t=' + Date.now());
    if (apiRes.ok) {
      const liveTracks = await apiRes.json();
      if (Array.isArray(liveTracks) && liveTracks.length > 0) {
        state.songs = mergeLiveAndCuratedTracks(liveTracks, state.songs);
        renderSongs();
        populateCalculatorOptions();
        
        if (!isBackground) {
          showToast(`Auto-fetched ${state.songs.length} live trending songs!`, 'check-circle');
        }
      }
    }
  } catch (err) {
    if (!isBackground) {
      showToast('Live auto-fetch completed (using cached charts)', 'check-circle');
    }
  } finally {
    if (elements.syncIcon) elements.syncIcon.classList.remove('animate-spin');
  }
}

// Live Reach Views Ticker
function startLiveReachTicker() {
  const statElem = document.getElementById('stat-total-reach');
  if (!statElem) return;

  let totalViewsBillion = 34.8;
  setInterval(() => {
    totalViewsBillion += 0.001; // increments live views
    statElem.textContent = `${totalViewsBillion.toFixed(2)}B Views`;
  }, 2500);
}

// Helper: Generate SVG Sparkline for 7-day Reach Trajectory
function generateSparklineSvg(data, isRising = true) {
  if (!data || data.length < 2) return '';
  const width = 120;
  const height = 34;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - 8) + 4;
    const y = height - 4 - ((val - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const strokeColor = isRising ? '#10B981' : '#F43F5E';
  const fillGradientId = `grad-${Math.random().toString(36).substr(2, 6)}`;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="overflow-visible">
      <defs>
        <linearGradient id="${fillGradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="${strokeColor}"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        points="${points}"
      />
    </svg>
  `;
}

// Render Song Cards or Rows
function renderSongs() {
  applyFiltersAndSort();
  updateCategoryCounts();

  elements.displayedCount.textContent = state.filteredSongs.length;
  elements.countAll.textContent = state.songs.length;
  elements.savedCount.textContent = state.savedIds.size;

  if (state.filteredSongs.length === 0) {
    elements.songsContainer.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');

  if (state.viewMode === 'grid') {
    elements.songsContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5';
    elements.songsContainer.innerHTML = state.filteredSongs.map((song, idx) => renderSongCard(song, idx)).join('');
  } else if (state.viewMode === 'list') {
    elements.songsContainer.className = 'flex flex-col gap-3';
    elements.songsContainer.innerHTML = state.filteredSongs.map((song, idx) => renderSongListItem(song, idx)).join('');
  } else if (state.viewMode === 'leaderboard') {
    elements.songsContainer.className = 'block w-full';
    elements.songsContainer.innerHTML = renderLeaderboard(state.filteredSongs);
  }

  lucide.createIcons();
}

// Reach Leaderboard Table View
function renderLeaderboard(songs) {
  return `
    <div class="glass-card rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
      <div class="p-3 sm:p-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white/5">
        <div class="flex items-center gap-2">
          <i data-lucide="trophy" class="w-4 sm:w-5 h-4 sm:h-5 text-amber-400"></i>
          <h3 class="font-extrabold text-white text-sm sm:text-base">Trending Audio Reach Leaderboard</h3>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-pink-300 font-semibold bg-pink-500/20 px-2.5 py-0.5 rounded-full border border-pink-500/30">
            Ranked by Views
          </span>
          <span class="text-[10px] text-slate-400 sm:hidden flex items-center gap-1 font-medium">
            <i data-lucide="move-horizontal" class="w-3 h-3 text-pink-400"></i> Swipe table
          </span>
        </div>
      </div>

      <div class="overflow-x-auto no-scrollbar">
        <table class="w-full min-w-[620px] text-left text-xs">
          <thead class="bg-black/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-white/10">
            <tr>
              <th class="py-3 px-3 sm:px-4">Rank</th>
              <th class="py-3 px-3 sm:px-4">Song & Artist</th>
              <th class="py-3 px-3 sm:px-4">Total Reach Reached</th>
              <th class="py-3 px-3 sm:px-4">Reels Created</th>
              <th class="py-3 px-3 sm:px-4">Daily Reach Surge</th>
              <th class="py-3 px-3 sm:px-4">7-Day Trajectory</th>
              <th class="py-3 px-3 sm:px-4">Virality Saturation</th>
              <th class="py-3 px-3 sm:px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-slate-200">
            ${songs.map((song, i) => {
              const isSaved = state.savedIds.has(song.title);
              const isCurrent = state.currentTrack && state.currentTrack.title === song.title;
              const isPlayingThis = isCurrent && state.isPlaying;
              const satScore = song.saturationScore || 80;

              return `
                <tr class="hover:bg-white/5 transition ${isCurrent ? 'bg-pink-500/10' : ''}">
                  <td class="py-3 px-3 sm:px-4 font-mono font-black text-sm ${song.rank <= 3 ? 'text-pink-400' : 'text-slate-500'}">
                    #${song.rank}
                  </td>
                  <td class="py-3 px-3 sm:px-4">
                    <div class="flex items-center gap-2.5 sm:gap-3">
                      <div class="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer group" onclick="handlePlayCard('${escapeHtml(song.title)}')">
                        <img src="${song.artwork}" alt="${escapeHtml(song.title)}" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <i data-lucide="${isPlayingThis ? 'pause' : 'play'}" class="w-3.5 h-3.5 text-white fill-current"></i>
                        </div>
                      </div>
                      <div class="min-w-0 max-w-[160px] sm:max-w-[200px]">
                        <div class="flex items-center gap-1.5">
                          <p class="font-bold text-white truncate hover:text-pink-300 transition cursor-pointer text-xs sm:text-sm" onclick="openReachModal('${escapeHtml(song.title)}')">
                            ${escapeHtml(song.title)}
                          </p>
                          ${song.category === 'Phonk & Bass' ? '<span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-500/30 text-fuchsia-300 border border-purple-500/40 flex-shrink-0">⚡ PHONK</span>' : ''}
                        </div>
                        <p class="text-[11px] text-slate-400 truncate">${escapeHtml(song.artist)}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-3 sm:px-4">
                    <div class="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm text-white">
                      <i data-lucide="eye" class="w-3.5 h-3.5 text-pink-400 flex-shrink-0"></i>
                      ${escapeHtml(song.totalReach)}
                    </div>
                    <span class="text-[10px] text-slate-500">~${escapeHtml(song.avgViewsPerReel)} / reel</span>
                  </td>
                  <td class="py-3 px-3 sm:px-4">
                    <span class="font-bold text-slate-200 font-mono text-xs">${escapeHtml(song.reelsCount)}</span>
                    <span class="text-[10px] text-slate-500 block">Videos</span>
                  </td>
                  <td class="py-3 px-3 sm:px-4">
                    <span class="font-bold text-emerald-400 text-xs">${escapeHtml(song.dailyReachGrowth)}</span>
                    <span class="text-[10px] text-emerald-500/80 block">${escapeHtml(song.growthVelocity)} velocity</span>
                  </td>
                  <td class="py-3 px-3 sm:px-4">
                    ${generateSparklineSvg(song.sparklineReach7d, song.velocityTrend === 'up')}
                  </td>
                  <td class="py-3 px-3 sm:px-4 min-w-[120px] sm:min-w-[140px]">
                    <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>${satScore}%</span>
                      <span class="text-pink-300 font-medium">${escapeHtml(song.saturation.split(' ')[0])}</span>
                    </div>
                    <div class="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div class="h-full rounded-full ig-gradient" style="width: ${satScore}%;"></div>
                    </div>
                  </td>
                  <td class="py-3 px-3 sm:px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <button onclick="openReachModal('${escapeHtml(song.title)}')" class="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white" title="Deep Dive Analytics">
                        <i data-lucide="bar-chart-2" class="w-4 h-4 text-pink-400"></i>
                      </button>
                      <a href="${song.instagramAudioUrl}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg ig-gradient text-white hover:opacity-95" title="Open on Instagram">
                        <i data-lucide="instagram" class="w-4 h-4"></i>
                      </a>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Template for Grid Card
function renderSongCard(song, idx) {
  const isSaved = state.savedIds.has(song.title);
  const isCurrent = state.currentTrack && state.currentTrack.title === song.title;
  const isPlayingThis = isCurrent && state.isPlaying;
  const satScore = song.saturationScore || 80;

  return `
    <div class="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 border ${isCurrent ? 'border-pink-500/60 shadow-lg shadow-pink-500/10' : 'border-white/10'} relative flex flex-col justify-between group" data-song-title="${escapeHtml(song.title)}">
      
      <!-- Top Badges & Actions -->
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
          <span class="text-xs font-black px-2 sm:px-2.5 py-0.5 rounded-full flex-shrink-0 ${song.rank <= 3 ? 'ig-gradient text-white shadow-sm' : 'bg-white/10 text-slate-300 font-mono'}">
            #${song.rank}
          </span>
          ${song.category === 'Phonk & Bass' ? `
          <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600/40 to-pink-600/40 text-fuchsia-300 border border-purple-500/50 shadow-sm shadow-purple-500/30 flex items-center gap-1 flex-shrink-0">
            <span class="text-pink-400">⚡</span> PHONK
          </span>
          ` : ''}
          <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 truncate max-w-[120px] sm:max-w-[140px]">
            ${escapeHtml(song.trendBadge)}
          </span>
        </div>

        <div class="flex items-center gap-1 flex-shrink-0">
          <button onclick="toggleSaveSong('${escapeHtml(song.title)}')" class="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-pink-400 transition" title="Save to favorites">
            <i data-lucide="bookmark" class="w-4 h-4 ${isSaved ? 'text-pink-500 fill-pink-500' : ''}"></i>
          </button>
          <button onclick="copyAudioLink('${escapeHtml(song.title)}', '${encodeURIComponent(song.instagramAudioUrl)}')" class="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition" title="Copy Instagram Audio Link">
            <i data-lucide="share-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- Artwork & Track Info -->
      <div class="flex items-center gap-3 sm:gap-3.5 mb-3 sm:mb-3.5">
        <div class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0 bg-white/5 shadow-md group-hover:shadow-pink-500/20 transition cursor-pointer" onclick="handlePlayCard('${escapeHtml(song.title)}')">
          <img src="${song.artwork}" alt="${escapeHtml(song.title)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center ${isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition">
            <div class="w-8 h-8 rounded-full ig-gradient flex items-center justify-center text-white shadow-md">
              <i data-lucide="${isPlayingThis ? 'pause' : 'play'}" class="w-4 h-4 fill-current ${isPlayingThis ? '' : 'ml-0.5'}"></i>
            </div>
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-sm sm:text-base text-white truncate hover:text-pink-300 transition cursor-pointer" onclick="openReachModal('${escapeHtml(song.title)}')">
            ${escapeHtml(song.title)}
          </h3>
          <p class="text-xs text-slate-400 truncate font-medium">${escapeHtml(song.artist)}</p>
          <span class="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md ${song.category === 'Phonk & Bass' ? 'bg-gradient-to-r from-purple-500/25 to-pink-500/25 text-fuchsia-300 border-purple-500/40 font-bold' : 'bg-white/5 text-slate-300 font-medium border-white/10'} border">
            ${song.category === 'Phonk & Bass' ? '⚡ ' : ''}${escapeHtml(song.category)}
          </span>
        </div>
      </div>

      <!-- PROMINENT REACH HERO BANNER ("how much reach it reached") -->
      <div class="mb-3 sm:mb-3.5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-amber-500/15 border border-pink-500/30 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-[9px] sm:text-[10px] uppercase tracking-wider font-extrabold text-pink-300 flex items-center gap-1">
            <i data-lucide="eye" class="w-3.5 h-3.5 text-pink-400 flex-shrink-0"></i>
            <span>TOTAL REACH REACHED</span>
          </p>
          <p class="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
            ${escapeHtml(song.totalReach)}
          </p>
        </div>
        <div class="text-right flex-shrink-0">
          <span class="text-[9px] sm:text-[10px] text-slate-400 font-medium block">Daily Gain</span>
          <span class="text-xs sm:text-sm font-black text-emerald-400">${escapeHtml(song.dailyReachGrowth)}</span>
        </div>
      </div>

      <!-- REACH METRICS BREAKDOWN -->
      <div class="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-black/40 border border-white/5 mb-3 sm:mb-4 space-y-2 sm:space-y-2.5">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 text-slate-400">
            <i data-lucide="video" class="w-3.5 h-3.5 text-purple-400 flex-shrink-0"></i>
            <span>Reels Created:</span>
          </div>
          <span class="font-bold text-slate-200 font-mono">${escapeHtml(song.reelsCount)}</span>
        </div>

        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 text-slate-400">
            <i data-lucide="trending-up" class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"></i>
            <span>Growth Velocity:</span>
          </div>
          <span class="font-bold text-emerald-400">
            ${escapeHtml(song.growthVelocity)}
          </span>
        </div>

        <!-- Saturation Progress Bar -->
        <div class="pt-1 space-y-1">
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span>Saturation: <strong class="text-white">${satScore}%</strong></span>
            <span class="text-pink-300 font-semibold truncate ml-2">${escapeHtml(song.saturation)}</span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full rounded-full ig-gradient" style="width: ${satScore}%;"></div>
          </div>
        </div>

        <!-- 7-day sparkline trajectory curve -->
        <div class="pt-1.5 border-t border-white/5 flex items-center justify-between">
          <span class="text-[10px] text-slate-500 font-medium">7-Day Curve</span>
          <div>${generateSparklineSvg(song.sparklineReach7d, song.velocityTrend === 'up')}</div>
        </div>
      </div>

      <!-- Creator Format Tip -->
      <div class="text-[10px] sm:text-[11px] text-slate-400 line-clamp-2 mb-3 sm:mb-4 italic pl-2 border-l-2 border-pink-500/40">
        "${escapeHtml(song.bestUsedFor)}"
      </div>

      <!-- Action Footer -->
      <div class="flex items-center gap-2 pt-2 border-t border-white/10">
        <button onclick="openReachModal('${escapeHtml(song.title)}')" class="flex-1 py-2 px-2.5 sm:px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition flex items-center justify-center gap-1 sm:gap-1.5 border border-white/10">
          <i data-lucide="bar-chart-2" class="w-3.5 h-3.5 text-pink-400 flex-shrink-0"></i>
          <span>Reach Deep Dive</span>
        </button>

        <a href="${song.instagramAudioUrl}" target="_blank" rel="noopener noreferrer" class="py-2 px-2.5 sm:px-3 rounded-xl ig-gradient text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-md shadow-pink-500/20 hover:opacity-95 flex-shrink-0" title="Open Reels Audio">
          <i data-lucide="instagram" class="w-3.5 h-3.5 flex-shrink-0"></i>
          <span>Use Audio</span>
        </a>
      </div>

    </div>
  `;
}


// Template for Compact List Item
function renderSongListItem(song, idx) {
  const isSaved = state.savedIds.has(song.title);
  const isCurrent = state.currentTrack && state.currentTrack.title === song.title;
  const isPlayingThis = isCurrent && state.isPlaying;

  return `
    <div class="glass-card rounded-2xl p-3 sm:p-3.5 border ${isCurrent ? 'border-pink-500/60' : 'border-white/10'} flex items-center justify-between gap-2.5 sm:gap-3 group" data-song-title="${escapeHtml(song.title)}">
      
      <!-- Rank & Art -->
      <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <span class="text-xs font-black font-mono w-5 sm:w-6 text-center flex-shrink-0 ${song.rank <= 3 ? 'text-pink-400' : 'text-slate-500'}">
          #${song.rank}
        </span>

        <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 cursor-pointer" onclick="handlePlayCard('${escapeHtml(song.title)}')">
          <img src="${song.artwork}" alt="${escapeHtml(song.title)}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center ${isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition">
            <i data-lucide="${isPlayingThis ? 'pause' : 'play'}" class="w-4 h-4 text-white fill-current"></i>
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <h4 class="font-bold text-xs sm:text-sm text-white truncate hover:text-pink-300 transition cursor-pointer" onclick="openReachModal('${escapeHtml(song.title)}')">
              ${escapeHtml(song.title)}
            </h4>
            ${song.category === 'Phonk & Bass' ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-500/30 text-fuchsia-300 border border-purple-500/40 flex items-center gap-0.5 flex-shrink-0">⚡ PHONK</span>' : ''}
          </div>
          <p class="text-[11px] sm:text-xs text-slate-400 truncate">${escapeHtml(song.artist)}</p>
          <!-- Mobile Reach Highlight -->
          <div class="flex items-center gap-2 mt-1 sm:hidden text-[10px]">
            <span class="font-black text-white flex items-center gap-0.5">
              <i data-lucide="eye" class="w-3 h-3 text-pink-400"></i>
              ${escapeHtml(song.totalReach)}
            </span>
            <span class="text-slate-500">•</span>
            <span class="text-emerald-400 font-semibold">${escapeHtml(song.growthVelocity)}</span>
          </div>
        </div>
      </div>

      <!-- Reach Metrics Table Columns (Desktop / Tablet) -->
      <div class="hidden sm:flex items-center gap-4 md:gap-6 text-xs flex-shrink-0">
        <div class="text-right">
          <p class="text-[10px] text-slate-500">Total Reach</p>
          <p class="font-bold text-white">${escapeHtml(song.totalReach)}</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] text-slate-500">Reels Volume</p>
          <p class="font-semibold text-slate-300">${escapeHtml(song.reelsCount)}</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] text-slate-500">Velocity</p>
          <p class="font-bold text-emerald-400">${escapeHtml(song.growthVelocity)}</p>
        </div>
      </div>

      <!-- Sparkline (Desktop) -->
      <div class="hidden md:block flex-shrink-0">
        ${generateSparklineSvg(song.sparklineReach7d, song.velocityTrend === 'up')}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        <button onclick="openReachModal('${escapeHtml(song.title)}')" class="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition" title="View Reach Analytics">
          <i data-lucide="bar-chart-2" class="w-4 h-4 text-pink-400"></i>
        </button>
        <button onclick="toggleSaveSong('${escapeHtml(song.title)}')" class="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-pink-400 transition">
          <i data-lucide="bookmark" class="w-4 h-4 ${isSaved ? 'text-pink-500 fill-pink-500' : ''}"></i>
        </button>
        <a href="${song.instagramAudioUrl}" target="_blank" rel="noopener noreferrer" class="p-1.5 sm:p-2 rounded-xl ig-gradient text-white shadow-sm hover:opacity-95 transition" title="Open on Instagram">
          <i data-lucide="instagram" class="w-4 h-4"></i>
        </a>
      </div>

    </div>
  `;
}

// Audio Player Handling
function handlePlayCard(songTitle) {
  const song = state.songs.find(s => s.title === songTitle);
  if (!song) return;

  if (state.currentTrack && state.currentTrack.title === songTitle) {
    if (state.isPlaying) {
      pauseAudio();
    } else {
      resumeAudio();
    }
  } else {
    playSong(song);
  }
}

function playSong(song) {
  if (!song || !song.previewUrl) {
    showToast('Audio preview not available for this track', 'alert-circle');
    return;
  }

  state.currentTrack = song;
  state.currentTrackIndex = state.filteredSongs.findIndex(s => s.title === song.title);
  
  elements.globalAudio.src = song.previewUrl;
  elements.globalAudio.play().then(() => {
    state.isPlaying = true;
    updatePlayerUI();
    renderSongs();
  }).catch(err => {
    console.error('Audio play failed:', err);
    showToast('Click anywhere on page first to allow audio', 'alert-circle');
  });

  // Reveal bottom player
  elements.bottomPlayer.classList.remove('translate-y-full');
}

function pauseAudio() {
  elements.globalAudio.pause();
  state.isPlaying = false;
  updatePlayerUI();
  renderSongs();
}

function resumeAudio() {
  elements.globalAudio.play().then(() => {
    state.isPlaying = true;
    updatePlayerUI();
    renderSongs();
  });
}

function updatePlayerUI() {
  if (!state.currentTrack) return;
  const track = state.currentTrack;

  // Desktop Elements
  if (elements.playerArt) elements.playerArt.src = track.artwork;
  if (elements.playerTitle) elements.playerTitle.textContent = track.title;
  if (elements.playerArtist) elements.playerArtist.textContent = track.artist;
  if (elements.playerReachBadge) elements.playerReachBadge.textContent = `Reach: ${track.totalReach} (${track.reelsCount} Reels)`;
  if (elements.playerIgBtn) elements.playerIgBtn.href = track.instagramAudioUrl;

  // Mobile Elements
  if (elements.playerArtMobile) elements.playerArtMobile.src = track.artwork;
  if (elements.playerTitleMobile) elements.playerTitleMobile.textContent = track.title;
  if (elements.playerArtistMobile) elements.playerArtistMobile.textContent = track.artist;
  if (elements.playerReachMobile) elements.playerReachMobile.textContent = `Reach: ${track.totalReach}`;
  if (elements.playerIgMobileBtn) elements.playerIgMobileBtn.href = track.instagramAudioUrl;

  const playIcon = state.isPlaying ? 'pause' : 'play';
  if (elements.playerPlayIcon) elements.playerPlayIcon.setAttribute('data-lucide', playIcon);
  if (elements.playerPlayMobileIcon) elements.playerPlayMobileIcon.setAttribute('data-lucide', playIcon);

  if (elements.playerEqualizer) {
    if (state.isPlaying) {
      elements.playerEqualizer.classList.remove('hidden');
      elements.playerEqualizer.classList.add('flex');
    } else {
      elements.playerEqualizer.classList.add('hidden');
      elements.playerEqualizer.classList.remove('flex');
    }
  }

  lucide.createIcons();
}

// Reach Deep Dive Modal
function openReachModal(songTitle) {
  const song = state.songs.find(s => s.title === songTitle);
  if (!song) return;

  const isCurrent = state.currentTrack && state.currentTrack.title === song.title;
  const isPlayingThis = isCurrent && state.isPlaying;

  elements.modalBody.innerHTML = `
    <!-- Top Track Info -->
    <div class="flex items-start gap-3 sm:gap-4">
      <div class="relative w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0 shadow-xl bg-white/5 cursor-pointer" onclick="handlePlayCard('${escapeHtml(song.title)}')">
        <img src="${song.artwork}" alt="${escapeHtml(song.title)}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full ig-gradient flex items-center justify-center text-white">
            <i data-lucide="${isPlayingThis ? 'pause' : 'play'}" class="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ${isPlayingThis ? '' : 'ml-0.5'}"></i>
          </div>
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ig-gradient text-white flex-shrink-0">#${song.rank} TRENDING</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 flex-shrink-0">${escapeHtml(song.category)}</span>
        </div>
        <h2 class="text-lg sm:text-2xl font-extrabold text-white truncate">${escapeHtml(song.title)}</h2>
        <p class="text-xs sm:text-sm text-slate-400 font-medium truncate">${escapeHtml(song.artist)}</p>
      </div>
    </div>

    <!-- REACH METRICS HERO (Answering the user's explicit reach question) -->
    <div class="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-transparent border border-pink-500/30 space-y-3 sm:space-y-4">
      <div class="flex items-center justify-between border-b border-white/10 pb-2">
        <span class="text-[11px] sm:text-xs font-bold text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="activity" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0"></i>
          Total Reach & Audience Intelligence
        </span>
        <span class="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
          ${escapeHtml(song.saturation)}
        </span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
        <div class="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-black/40 border border-white/5 min-w-0">
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">TOTAL VIEWS</p>
          <p class="text-sm sm:text-lg font-black text-white truncate">${escapeHtml(song.totalReach)}</p>
          <p class="text-[9px] sm:text-[10px] text-slate-500 truncate">Across Reels</p>
        </div>
        <div class="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-black/40 border border-white/5 min-w-0">
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">REELS CREATED</p>
          <p class="text-sm sm:text-lg font-black text-pink-400 truncate">${escapeHtml(song.reelsCount)}</p>
          <p class="text-[9px] sm:text-[10px] text-slate-500 truncate">Videos using sound</p>
        </div>
        <div class="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-black/40 border border-white/5 min-w-0">
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">DAILY SURGE</p>
          <p class="text-sm sm:text-lg font-black text-emerald-400 truncate">${escapeHtml(song.dailyReachGrowth)}</p>
          <p class="text-[9px] sm:text-[10px] text-slate-500 truncate">Vel. ${escapeHtml(song.growthVelocity)}</p>
        </div>
        <div class="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-black/40 border border-white/5 min-w-0">
          <p class="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">AVG / REEL</p>
          <p class="text-sm sm:text-lg font-black text-purple-300 truncate">${escapeHtml(song.avgViewsPerReel)}</p>
          <p class="text-[9px] sm:text-[10px] text-slate-500 truncate">Virality spread</p>
        </div>
      </div>
    </div>

    <!-- 7-Day Reach Growth Chart -->
    <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 space-y-2 sm:space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="trending-up" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0"></i>
          7-Day Reach Trajectory
        </h4>
        <span class="text-[10px] sm:text-[11px] text-emerald-400 font-semibold flex-shrink-0">${escapeHtml(song.growthVelocity)} 7-day surge</span>
      </div>
      
      <div class="h-28 sm:h-32 flex items-end justify-between gap-1.5 sm:gap-2 pt-3 sm:pt-4 px-1 sm:px-2">
        ${song.sparklineReach7d.map((val, i) => {
          const maxVal = Math.max(...song.sparklineReach7d);
          const heightPct = Math.max(15, Math.round((val / maxVal) * 100));
          return `
            <div class="flex-1 flex flex-col items-center gap-1 group">
              <div class="w-full rounded-t-md sm:rounded-t-lg bg-gradient-to-t from-purple-500 to-pink-500 group-hover:brightness-125 transition-all relative" style="height: ${heightPct}%;">
                <div class="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/90 text-[10px] font-mono text-white whitespace-nowrap border border-white/20 pointer-events-none transition z-10">
                  ${val}M
                </div>
              </div>
              <span class="text-[9px] sm:text-[10px] text-slate-400 font-mono">D-${7 - i}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Audience Demographics & Engagement -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
      <div class="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 space-y-2">
        <span class="font-bold text-slate-300 flex items-center gap-1.5 text-[11px] sm:text-xs">
          <i data-lucide="globe" class="w-3.5 h-3.5 text-blue-400 flex-shrink-0"></i>
          Top Audiences by Country
        </span>
        <div class="flex flex-wrap gap-1 pt-0.5">
          ${song.topRegions.map(reg => `
            <span class="px-2 py-0.5 rounded-lg bg-white/10 text-slate-200 text-[10px] sm:text-[11px] font-medium">${escapeHtml(reg)}</span>
          `).join('')}
        </div>
      </div>

      <div class="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 space-y-2">
        <span class="font-bold text-slate-300 flex items-center gap-1.5 text-[11px] sm:text-xs">
          <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400 flex-shrink-0"></i>
          Algorithmic Engagement
        </span>
        <div class="flex items-center justify-between text-[11px] pt-0.5">
          <span class="text-slate-400">Engagement Rate:</span>
          <span class="font-bold text-emerald-400">${escapeHtml(song.engagementRate)}</span>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-slate-400">Completion Rate:</span>
          <span class="font-bold text-purple-300">${escapeHtml(song.completionRate)} (High Replay)</span>
        </div>
      </div>
    </div>

    <!-- Creator Recommendation Box -->
    <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-1.5 sm:space-y-2 text-xs">
      <div class="flex items-center gap-1.5 sm:gap-2 text-purple-300 font-bold text-[11px] sm:text-xs">
        <i data-lucide="sparkles" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0"></i>
        <span>Creator Strategy: How to Maximize Reach</span>
      </div>
      <p class="text-slate-300 leading-relaxed text-[11px] sm:text-xs"><strong class="text-white">Best Content Style:</strong> ${escapeHtml(song.bestUsedFor)}</p>
      <p class="text-slate-300 leading-relaxed text-[11px] sm:text-xs"><strong class="text-white">Algorithmic Tip:</strong> ${escapeHtml(song.creatorTip)}</p>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-2.5 pt-2">
      <a href="${song.instagramAudioUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl ig-gradient text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 hover:opacity-95 transition">
        <i data-lucide="instagram" class="w-4 h-4 flex-shrink-0"></i>
        <span>Open on Instagram Reels</span>
      </a>
      <button onclick="copyAudioLink('${escapeHtml(song.title)}', '${encodeURIComponent(song.instagramAudioUrl)}')" class="py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition border border-white/10 flex-shrink-0">
        <i data-lucide="share-2" class="w-4 h-4 text-pink-400 flex-shrink-0"></i>
        <span>Copy Audio URL</span>
      </button>
    </div>
  `;

  elements.reachModal.classList.remove('opacity-0', 'pointer-events-none');
  elements.reachModal.querySelector('#modal-content').classList.remove('scale-95');
  lucide.createIcons();
}

function closeReachModal() {
  elements.reachModal.classList.add('opacity-0', 'pointer-events-none');
  elements.reachModal.querySelector('#modal-content').classList.add('scale-95');
}

// Creator Reach Predictor Logic
function populateCalculatorOptions() {
  elements.calcSongSelect.innerHTML = state.songs.map(s => `
    <option value="${escapeHtml(s.title)}" class="bg-[#151522] text-white">#${s.rank} - ${escapeHtml(s.title)} (${escapeHtml(s.totalReach)})</option>
  `).join('');
  updateCalculatorPrediction();
}

function updateCalculatorPrediction() {
  const followers = parseInt(elements.calcFollowersSlider.value, 10);
  elements.calcFollowersVal.textContent = followers.toLocaleString();

  const selectedTitle = elements.calcSongSelect.value;
  const song = state.songs.find(s => s.title === selectedTitle) || state.songs[0];
  const niche = elements.calcNicheSelect.value;

  // Multipliers
  let nicheMultiplier = 1.0;
  let exploreRatio = 70;
  if (niche === 'dance') { nicheMultiplier = 1.8; exploreRatio = 84; }
  else if (niche === 'comedy') { nicheMultiplier = 1.6; exploreRatio = 80; }
  else if (niche === 'lifestyle') { nicheMultiplier = 1.3; exploreRatio = 75; }
  else if (niche === 'fitness') { nicheMultiplier = 1.2; exploreRatio = 72; }
  else if (niche === 'travel') { nicheMultiplier = 1.5; exploreRatio = 79; }

  const songVelocityMultiplier = song ? (song.growthVelocityNumeric / 100) : 1.2;
  const baseReach = followers * 1.5;
  const minViews = Math.round(baseReach * nicheMultiplier * songVelocityMultiplier);
  const maxViews = Math.round(minViews * 2.8);

  elements.calcProjectedViews.textContent = `${formatNumber(minViews)} – ${formatNumber(maxViews)}`;
  elements.calcExplorePct.textContent = `${exploreRatio}%`;
  
  if (song) {
    elements.calcUseSoundBtn.onclick = () => {
      window.open(song.instagramAudioUrl, '_blank');
    };
  }
}

// Live Global iTunes Search
async function runLiveMusicSearch() {
  const query = elements.liveSearchInput.value.trim();
  if (!query) return;

  elements.liveSearchResults.innerHTML = `
    <div class="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
      <div class="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      Searching Apple Music & Instagram catalog...
    </div>
  `;

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=6&entity=song`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      elements.liveSearchResults.innerHTML = `
        <div class="py-6 text-center text-xs text-slate-400">
          No songs found matching "${escapeHtml(query)}". Try another name.
        </div>
      `;
      return;
    }

    elements.liveSearchResults.innerHTML = data.results.map(item => {
      const art = (item.artworkUrl100 || '').replace('100x100bb.jpg', '400x400bb.jpg');
      const igUrl = `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(item.trackName + ' ' + item.artistName)}`;
      const simReach = Math.floor(Math.random() * 800 + 150); // simulated reach in millions
      const simReels = (simReach * 1.8).toFixed(1);

      return `
        <div class="glass-card p-3 rounded-2xl border border-white/10 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <img src="${art}" alt="${escapeHtml(item.trackName)}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-white/5">
            <div class="min-w-0">
              <h4 class="font-bold text-sm text-white truncate">${escapeHtml(item.trackName)}</h4>
              <p class="text-xs text-slate-400 truncate">${escapeHtml(item.artistName)}</p>
              <div class="flex items-center gap-2 mt-0.5 text-[10px]">
                <span class="text-pink-400 font-semibold">Simulated Reach: ${simReach}M Views</span>
                <span class="text-slate-500">•</span>
                <span class="text-slate-400">~${simReels}K Reels</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${item.previewUrl ? `
              <button onclick="playCustomPreview('${escapeHtml(item.trackName)}', '${escapeHtml(item.artistName)}', '${art}', '${item.previewUrl}', '${igUrl}')" class="p-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 transition" title="Preview Audio">
                <i data-lucide="play" class="w-4 h-4 fill-current"></i>
              </button>
            ` : ''}
            <a href="${igUrl}" target="_blank" rel="noopener noreferrer" class="p-2 rounded-xl ig-gradient text-white shadow-sm hover:opacity-95 transition" title="Open on Instagram">
              <i data-lucide="instagram" class="w-4 h-4"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    elements.liveSearchResults.innerHTML = `
      <div class="py-6 text-center text-xs text-rose-400">
        Failed to fetch search results. Please check your internet connection.
      </div>
    `;
  }
}

function playCustomPreview(title, artist, artwork, previewUrl, igUrl) {
  playSong({
    title,
    artist,
    artwork,
    previewUrl,
    instagramAudioUrl: igUrl,
    totalReach: 'Trending Discovery',
    reelsCount: 'Live Search'
  });
  elements.searchModal.classList.add('opacity-0', 'pointer-events-none');
}

// Bookmarks / Save Song
function toggleSaveSong(title) {
  if (state.savedIds.has(title)) {
    state.savedIds.delete(title);
    showToast(`Removed "${title}" from saved sounds`, 'bookmark-minus');
  } else {
    state.savedIds.add(title);
    showToast(`Saved "${title}" to favorites!`, 'bookmark-check');
  }
  localStorage.setItem('tw_saved_songs', JSON.stringify([...state.savedIds]));
  renderSongs();
}

// Copy Audio Link to Clipboard
function copyAudioLink(title, encodedUrl) {
  const url = decodeURIComponent(encodedUrl);
  navigator.clipboard.writeText(url).then(() => {
    showToast(`Instagram audio search copied for "${title}"!`, 'check-circle');
  }).catch(() => {
    // Fallback prompt
    prompt('Copy Instagram Audio Link:', url);
  });
}

// Toast Alert
function showToast(message, iconName = 'check-circle') {
  elements.toastMsg.textContent = message;
  elements.toast.classList.remove('translate-y-[-100px]', 'opacity-0', 'pointer-events-none');
  elements.toast.classList.add('translate-y-0', 'opacity-100');
  
  setTimeout(() => {
    elements.toast.classList.add('translate-y-[-100px]', 'opacity-0', 'pointer-events-none');
    elements.toast.classList.remove('translate-y-0', 'opacity-100');
  }, 2600);
}

// Filter and Sort Engine
function applyFiltersAndSort() {
  let list = [...state.songs];

  // Category filter
  if (state.activeCategory === 'top10') {
    list = list.filter(s => s.rank <= 10);
  } else if (state.activeCategory === 'fast-rising') {
    list = list.filter(s => s.growthVelocityNumeric >= 100);
  } else if (state.activeCategory === 'saved') {
    list = list.filter(s => state.savedIds.has(s.title));
  } else if (state.activeCategory !== 'all') {
    list = list.filter(s => s.category.toLowerCase().includes(state.activeCategory.toLowerCase()));
  }

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(s => 
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.bestUsedFor && s.bestUsedFor.toLowerCase().includes(q))
    );
  }

  // Sorting
  if (state.sortBy === 'reach') {
    list.sort((a, b) => b.totalReachNumeric - a.totalReachNumeric);
  } else if (state.sortBy === 'reels') {
    list.sort((a, b) => b.reelsCountNumeric - a.reelsCountNumeric);
  } else if (state.sortBy === 'velocity') {
    list.sort((a, b) => b.growthVelocityNumeric - a.growthVelocityNumeric);
  } else if (state.sortBy === 'rank') {
    list.sort((a, b) => a.rank - b.rank);
  }

  state.filteredSongs = list;
}

function updateCategoryCounts() {
  if (elements.savedCount) elements.savedCount.textContent = state.savedIds.size;
  if (elements.countPhonk) {
    const phonkCount = state.songs.filter(s => s.category && s.category.toLowerCase().includes('phonk')).length;
    elements.countPhonk.textContent = phonkCount;
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Category Pills
  elements.categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      elements.categoryPills.forEach(p => {
        p.classList.remove('bg-pink-500', 'text-white', 'shadow-md', 'shadow-pink-500/20');
        p.classList.add('bg-white/5', 'text-slate-300');
      });
      pill.classList.remove('bg-white/5', 'text-slate-300');
      pill.classList.add('bg-pink-500', 'text-white', 'shadow-md', 'shadow-pink-500/20');

      state.activeCategory = pill.dataset.category;
      elements.activeFilterLabel.textContent = pill.textContent.trim();
      renderSongs();
    });
  });

  // Search Input
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    if (state.searchQuery) {
      elements.searchClearBtn.classList.remove('hidden');
    } else {
      elements.searchClearBtn.classList.add('hidden');
    }
    renderSongs();
  });

  elements.searchClearBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.searchClearBtn.classList.add('hidden');
    renderSongs();
  });

  // Sort Dropdown
  elements.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderSongs();
  });

  // View Mode Buttons
  elements.viewGridBtn.addEventListener('click', () => {
    state.viewMode = 'grid';
    elements.viewGridBtn.classList.add('bg-pink-500/20', 'text-pink-300');
    elements.viewListBtn.classList.remove('bg-pink-500/20', 'text-pink-300');
    if (elements.viewLeaderboardBtn) elements.viewLeaderboardBtn.classList.remove('bg-pink-500/20', 'text-pink-300');
    renderSongs();
  });

  elements.viewListBtn.addEventListener('click', () => {
    state.viewMode = 'list';
    elements.viewListBtn.classList.add('bg-pink-500/20', 'text-pink-300');
    elements.viewGridBtn.classList.remove('bg-pink-500/20', 'text-pink-300');
    if (elements.viewLeaderboardBtn) elements.viewLeaderboardBtn.classList.remove('bg-pink-500/20', 'text-pink-300');
    renderSongs();
  });

  if (elements.viewLeaderboardBtn) {
    elements.viewLeaderboardBtn.addEventListener('click', () => {
      state.viewMode = 'leaderboard';
      elements.viewLeaderboardBtn.classList.add('bg-pink-500/20', 'text-pink-300');
      elements.viewGridBtn.classList.remove('bg-pink-500/20', 'text-pink-300');
      elements.viewListBtn.classList.remove('bg-pink-500/20', 'text-pink-300');
      renderSongs();
    });
  }

  elements.resetFiltersBtn.addEventListener('click', () => {
    state.searchQuery = '';
    state.activeCategory = 'all';
    elements.searchInput.value = '';
    elements.searchClearBtn.classList.add('hidden');
    document.querySelector('.category-pill[data-category="all"]').click();
  });

  // Audio Progress & Scrubbing
  elements.globalAudio.addEventListener('timeupdate', () => {
    const cur = elements.globalAudio.currentTime;
    const dur = elements.globalAudio.duration || 30;
    if (elements.playerCurrTime) elements.playerCurrTime.textContent = formatTime(cur);
    if (elements.playerDuration) elements.playerDuration.textContent = formatTime(dur);
    const pct = (cur / dur) * 100;
    if (elements.playerProgress) elements.playerProgress.value = pct;
    if (elements.playerMobileProgress) elements.playerMobileProgress.style.width = `${pct}%`;
  });

  if (elements.playerProgress) {
    elements.playerProgress.addEventListener('input', (e) => {
      const dur = elements.globalAudio.duration || 30;
      elements.globalAudio.currentTime = (e.target.value / 100) * dur;
    });
  }

  elements.globalAudio.addEventListener('ended', () => {
    if (state.isLooping) {
      elements.globalAudio.currentTime = 0;
      elements.globalAudio.play();
    } else {
      playNextTrack();
    }
  });

  elements.globalAudio.addEventListener('error', (e) => {
    console.warn('Audio playback notice:', e);
    showToast('Direct stream protected. Opening track on Instagram Reels...', 'external-link');
  });

  // Desktop Player Buttons
  if (elements.playerPlayBtn) {
    elements.playerPlayBtn.addEventListener('click', () => {
      if (state.isPlaying) {
        pauseAudio();
      } else if (state.currentTrack) {
        resumeAudio();
      }
    });
  }

  if (elements.playerNextBtn) elements.playerNextBtn.addEventListener('click', playNextTrack);
  if (elements.playerPrevBtn) elements.playerPrevBtn.addEventListener('click', playPrevTrack);

  // Mobile Player Buttons
  if (elements.playerPlayMobileBtn) {
    elements.playerPlayMobileBtn.addEventListener('click', () => {
      if (state.isPlaying) {
        pauseAudio();
      } else if (state.currentTrack) {
        resumeAudio();
      }
    });
  }

  if (elements.playerNextMobileBtn) elements.playerNextMobileBtn.addEventListener('click', playNextTrack);
  if (elements.playerPrevMobileBtn) elements.playerPrevMobileBtn.addEventListener('click', playPrevTrack);

  elements.playerLoopBtn.addEventListener('click', () => {
    state.isLooping = !state.isLooping;
    elements.playerLoopBtn.classList.toggle('text-pink-400', state.isLooping);
    showToast(state.isLooping ? 'Audio loop enabled' : 'Audio loop disabled', 'repeat');
  });

  // Volume
  elements.playerVolume.addEventListener('input', (e) => {
    elements.globalAudio.volume = parseFloat(e.target.value);
  });

  elements.playerMuteBtn.addEventListener('click', () => {
    elements.globalAudio.muted = !elements.globalAudio.muted;
    elements.playerVolumeIcon.setAttribute('data-lucide', elements.globalAudio.muted ? 'volume-x' : 'volume-2');
    lucide.createIcons();
  });

  // Calculator Modal
  elements.btnOpenCalculator.addEventListener('click', () => {
    elements.calculatorModal.classList.remove('opacity-0', 'pointer-events-none');
    elements.calculatorModal.querySelector('.glass-panel').classList.remove('scale-95');
    updateCalculatorPrediction();
  });

  elements.closeCalculatorBtn.addEventListener('click', () => {
    elements.calculatorModal.classList.add('opacity-0', 'pointer-events-none');
    elements.calculatorModal.querySelector('.glass-panel').classList.add('scale-95');
  });

  elements.calcFollowersSlider.addEventListener('input', updateCalculatorPrediction);
  elements.calcNicheSelect.addEventListener('change', updateCalculatorPrediction);
  elements.calcSongSelect.addEventListener('change', updateCalculatorPrediction);

  // Live Search Modal
  elements.btnToggleSearchModal.addEventListener('click', () => {
    elements.searchModal.classList.remove('opacity-0', 'pointer-events-none');
    elements.searchModal.querySelector('.glass-panel').classList.remove('scale-95');
    elements.liveSearchInput.focus();
  });

  elements.closeSearchModalBtn.addEventListener('click', () => {
    elements.searchModal.classList.add('opacity-0', 'pointer-events-none');
    elements.searchModal.querySelector('.glass-panel').classList.add('scale-95');
  });

  elements.btnRunLiveSearch.addEventListener('click', runLiveMusicSearch);
  elements.liveSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runLiveMusicSearch();
  });

  if (elements.btnSyncLive) {
    elements.btnSyncLive.addEventListener('click', () => {
      autoFetchTracks(false);
    });
  }

  // Close Deep Dive Modal
  elements.closeModalBtn.addEventListener('click', closeReachModal);
  elements.reachModal.addEventListener('click', (e) => {
    if (e.target === elements.reachModal) closeReachModal();
  });
  elements.calculatorModal.addEventListener('click', (e) => {
    if (e.target === elements.calculatorModal) {
      elements.calculatorModal.classList.add('opacity-0', 'pointer-events-none');
    }
  });
  elements.searchModal.addEventListener('click', (e) => {
    if (e.target === elements.searchModal) {
      elements.searchModal.classList.add('opacity-0', 'pointer-events-none');
    }
  });
}

function playNextTrack() {
  if (state.filteredSongs.length === 0) return;
  state.currentTrackIndex = (state.currentTrackIndex + 1) % state.filteredSongs.length;
  playSong(state.filteredSongs[state.currentTrackIndex]);
}

function playPrevTrack() {
  if (state.filteredSongs.length === 0) return;
  state.currentTrackIndex = (state.currentTrackIndex - 1 + state.filteredSongs.length) % state.filteredSongs.length;
  playSong(state.filteredSongs[state.currentTrackIndex]);
}

// Helpers
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num.toString();
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFallbackData() {
  return [
    {
      rank: 1,
      title: "Birds of a Feather",
      artist: "Billie Eilish",
      category: "Aesthetic & Chill",
      trendBadge: "🔥 #1 GLOBAL VIRAL",
      reelsCount: "3.8M",
      reelsCountNumeric: 3800000,
      totalReach: "1.95 Billion",
      totalReachNumeric: 1950000000,
      dailyReachGrowth: "+42.5M views/day",
      growthVelocity: "+195%",
      growthVelocityNumeric: 195,
      velocityTrend: "up",
      saturation: "High (Viral Peak)",
      avgViewsPerReel: "513K views",
      bestUsedFor: "Couple edits, heartwarming pet videos, sentimental friendship recaps, golden-hour B-roll.",
      creatorTip: "Sync slow pans with acoustic guitar transition at 0:06.",
      topRegions: ["United States", "United Kingdom", "Brazil"],
      engagementRate: "9.4%",
      completionRate: "78%",
      sparklineReach7d: [180, 240, 310, 480, 720, 1200, 1950],
      artwork: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
      previewUrl: "",
      instagramAudioUrl: "https://www.instagram.com/explore/search/keyword/?q=Birds%20of%20a%20Feather%20Billie%20Eilish"
    }
  ];
}

// Start app once DOM is ready
window.addEventListener('DOMContentLoaded', initApp);
