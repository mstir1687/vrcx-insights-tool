import { formatDisplayDateTime } from './datetime.js';
import {
  getDisplayNameLabel,
  getDisplayNameTooltip,
  getWorldLabel,
  getWorldMetaLabel,
  getWorldTooltip
} from './hiddenIdentifiers.js';
import { buildSelectableUserOptions } from './selectableUsers.js';

const { createApp, reactive, computed, onMounted } = window.Vue;
const { ElMessage } = window.ElementPlus;
const insightsApi = window.vrcxInsights;

function formatDateValue(date) {
  return date.toISOString().slice(0, 10);
}

function getPresetRangeValues(preset) {
  const now = new Date();
  const to = formatDateValue(now);

  if (preset === 'all') {
    return [];
  }

  let fromDate = null;
  if (preset === 'week') {
    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (preset === 'month') {
    fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (preset === 'year') {
    fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  if (!fromDate) {
    return [];
  }

  return [formatDateValue(fromDate), to];
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getInsightsApi() {
  if (!insightsApi) {
    throw new Error('桌面桥接不可用');
  }
  return insightsApi;
}

function toQueryObject(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

function getHostLabel(item) {
  return item.hostDisplayName || item.hostUserId || (item.hostType === 'group' ? `group:${item.groupId || 'unknown'}` : 'unknown');
}

function getHostTooltip(item) {
  if (!item.hostDisplayName || !item.hostUserId) {
    return '';
  }
  return item.hostUserId;
}

createApp({
  template: `
    <div class="page-shell">
      <div class="page">
        <el-card class="hero-card" shadow="never">
          <div class="hero-header">
            <div>
              <h1>VRCX 关系分析工具</h1>
              <div v-if="state.meta" class="hero-meta">
                <el-tooltip :content="getDisplayNameTooltip({ displayName: state.meta.selfDisplayName, userId: state.meta.selfUserId })" :disabled="!getDisplayNameTooltip({ displayName: state.meta.selfDisplayName, userId: state.meta.selfUserId })">
                  <span class="hover-label">{{ getDisplayNameLabel({ displayName: state.meta.selfDisplayName, userId: state.meta.selfUserId }) }}</span>
                </el-tooltip>
                <span>好友 {{ state.meta.friendCount }}</span>
                <span>会话 {{ state.meta.sessionCount }}</span>
                <span>最近重算 {{ formatDisplayDateTime(state.meta.loadedAt) }}</span>
              </div>
              <div v-if="state.appState.dataDir" class="hero-path">
                数据文件夹：{{ state.appState.dataDir }}
              </div>
            </div>

            <div class="hero-actions">
              <el-button @click="openSettings">设置</el-button>
              <el-button :loading="state.loading.reload" :disabled="!canAnalyze" @click="handleReload">手动刷新重算</el-button>
              <el-button type="primary" :loading="isApplying" :disabled="!canAnalyze" @click="applyAllViews">应用筛选</el-button>
            </div>
          </div>

          <div v-if="canAnalyze" class="filter-bar">
            <el-date-picker
              class="hero-range-picker"
              v-model="state.dateRange"
              type="daterange"
              unlink-panels
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              @change="handleDateRangeChange"
            />

            <el-button-group class="quick-range-group">
              <el-button
                v-for="preset in quickPresets"
                :key="preset.value"
                :type="state.rangePreset === preset.value ? 'primary' : 'default'"
                @click="setPresetDates(preset.value, true)"
              >
                {{ preset.label }}
              </el-button>
            </el-button-group>
          </div>
        </el-card>

        <el-tabs v-model="state.selectedTab" class="main-tabs">
          <el-tab-pane label="可能认识的人" name="acquaintances" :disabled="!canAnalyze">
            <div class="section-grid two acquaintances-grid">
              <el-card class="panel-card" shadow="hover" v-loading="state.loading.acquaintances">
                <template #header>见面次数 TOP</template>
                <el-table :data="state.acquaintances.byMeetCount" stripe>
                  <el-table-column label="昵称" min-width="220">
                    <template #default="{ row }">
                      <el-tooltip :content="getDisplayNameTooltip(row)" :disabled="!getDisplayNameTooltip(row)">
                        <span class="hover-label">{{ getDisplayNameLabel(row) }}</span>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                  <el-table-column prop="meetCount" label="见面次数" width="110" />
                  <el-table-column label="共处时长" width="120">
                    <template #default="{ row }">{{ formatDuration(row.overlapMs) }}</template>
                  </el-table-column>
                  <el-table-column label="操作" width="170" align="center">
                    <template #default="{ row }">
                      <div class="action-buttons">
                        <el-button type="primary" plain class="action-link-button" @click="goTimeline(row)">轨迹</el-button>
                        <el-button type="primary" plain class="action-link-button" @click="goRelationship(row)">关系</el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </el-card>

              <el-card class="panel-card" shadow="hover" v-loading="state.loading.acquaintances">
                <template #header>共处时长 TOP</template>
                <el-table :data="state.acquaintances.byOverlap" stripe>
                  <el-table-column label="昵称" min-width="220">
                    <template #default="{ row }">
                      <el-tooltip :content="getDisplayNameTooltip(row)" :disabled="!getDisplayNameTooltip(row)">
                        <span class="hover-label">{{ getDisplayNameLabel(row) }}</span>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                  <el-table-column prop="meetCount" label="见面次数" width="110" />
                  <el-table-column label="共处时长" width="120">
                    <template #default="{ row }">{{ formatDuration(row.overlapMs) }}</template>
                  </el-table-column>
                  <el-table-column label="操作" width="170" align="center">
                    <template #default="{ row }">
                      <div class="action-buttons">
                        <el-button type="primary" plain class="action-link-button" @click="goTimeline(row)">轨迹</el-button>
                        <el-button type="primary" plain class="action-link-button" @click="goRelationship(row)">关系</el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </el-card>
            </div>
            <el-pagination
              class="table-pagination"
              background
              layout="total, sizes, prev, pager, next"
              :total="state.acquaintances.total"
              :current-page="state.pagination.acquaintances.page"
              :page-size="state.pagination.acquaintances.pageSize"
              :page-sizes="pageSizeOptions"
              @current-change="(page) => handlePageChange('acquaintances', page)"
              @size-change="(size) => handlePageSizeChange('acquaintances', size)"
            />
          </el-tab-pane>

          <el-tab-pane label="活动轨迹" name="timeline" :disabled="!canAnalyze">
            <el-tabs v-model="state.selectedTimelineTab" class="sub-tabs">
              <el-tab-pane label="时间流" name="sessions">
                <el-card class="panel-card query-panel-card timeline-query-card timeline-sessions-card" shadow="hover" v-loading="state.loading.timeline">
                  <div class="section-title-row">
                    <h2>时间流</h2>
                  </div>
                  <div class="query-control-row">
                    <el-tooltip :content="state.timelineUserId" :disabled="!state.timelineUserId">
                      <el-select v-model="state.timelineUserId" placeholder="选择对象" filterable class="field-select">
                        <el-option
                          v-for="user in userOptions"
                          :key="user.userId"
                          :label="getDisplayNameLabel(user)"
                          :value="user.userId"
                        />
                      </el-select>
                    </el-tooltip>
                    <el-button type="primary" :disabled="!state.timelineUserId" :loading="state.loading.timeline" @click="loadTimeline">查询</el-button>
                  </div>
                  <el-table :data="state.timeline.sessions" stripe>
                    <el-table-column label="开始" width="180">
                      <template #default="{ row }">{{ formatDisplayDateTime(row.startAt) }}</template>
                    </el-table-column>
                    <el-table-column label="结束" width="180">
                      <template #default="{ row }">{{ formatDisplayDateTime(row.endAt) }}</template>
                    </el-table-column>
                    <el-table-column label="时长" width="110">
                      <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
                    </el-table-column>
                    <el-table-column label="世界" min-width="260">
                      <template #default="{ row }">
                        <el-tooltip :content="getWorldTooltip(row)" :disabled="!getWorldTooltip(row)">
                          <div class="stacked-text world-cell">
                            <span class="hover-label world-label">{{ getWorldLabel(row) }}</span>
                            <span v-if="getWorldMetaLabel(row)" class="world-meta">{{ getWorldMetaLabel(row) }}</span>
                          </div>
                        </el-tooltip>
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-pagination
                    class="table-pagination"
                    background
                    layout="total, sizes, prev, pager, next"
                    :total="state.timeline.sessionsTotal"
                    :current-page="state.pagination.timelineSessions.page"
                    :page-size="state.pagination.timelineSessions.pageSize"
                    :page-sizes="pageSizeOptions"
                    @current-change="(page) => handlePageChange('timelineSessions', page)"
                    @size-change="(size) => handlePageSizeChange('timelineSessions', size)"
                  />
                </el-card>
              </el-tab-pane>

              <el-tab-pane label="陪伴占比（同房时长）" name="companions">
                <el-card class="panel-card query-panel-card timeline-query-card timeline-companions-card" shadow="hover" v-loading="state.loading.timeline">
                  <div class="section-title-row">
                    <h2>陪伴占比</h2>
                  </div>
                  <div class="query-control-row">
                    <el-tooltip :content="state.timelineUserId" :disabled="!state.timelineUserId">
                      <el-select v-model="state.timelineUserId" placeholder="选择对象" filterable class="field-select">
                        <el-option
                          v-for="user in userOptions"
                          :key="user.userId"
                          :label="getDisplayNameLabel(user)"
                          :value="user.userId"
                        />
                      </el-select>
                    </el-tooltip>
                    <el-button type="primary" :disabled="!state.timelineUserId" :loading="state.loading.timeline" @click="loadTimeline">查询</el-button>
                  </div>
                  <el-table :data="state.timeline.companions" stripe>
                    <el-table-column label="昵称" min-width="220">
                      <template #default="{ row }">
                        <el-tooltip :content="getDisplayNameTooltip(row)" :disabled="!getDisplayNameTooltip(row)">
                          <span class="hover-label">{{ getDisplayNameLabel(row) }}</span>
                        </el-tooltip>
                      </template>
                    </el-table-column>
                    <el-table-column label="同房时长" width="120">
                      <template #default="{ row }">{{ formatDuration(row.overlapMs) }}</template>
                    </el-table-column>
                    <el-table-column prop="meetCount" label="共同实例数" width="120" />
                  </el-table>
                  <el-pagination
                    class="table-pagination"
                    background
                    layout="total, sizes, prev, pager, next"
                    :total="state.timeline.companionsTotal"
                    :current-page="state.pagination.timelineCompanions.page"
                    :page-size="state.pagination.timelineCompanions.pageSize"
                    :page-sizes="pageSizeOptions"
                    @current-change="(page) => handlePageChange('timelineCompanions', page)"
                    @size-change="(size) => handlePageSizeChange('timelineCompanions', size)"
                  />
                </el-card>
              </el-tab-pane>
            </el-tabs>
          </el-tab-pane>

          <el-tab-pane label="好友关系度" name="relationship" :disabled="!canAnalyze">
            <el-tabs v-model="state.selectedRelationshipTab" class="sub-tabs">
              <el-tab-pane label="单好友关系排行" name="top">
                <el-card class="panel-card relationship-query-card relationship-top-card" shadow="hover">
                  <div class="section-title-row">
                    <h2>单好友关系排行</h2>
                  </div>
                  <div class="query-control-row">
                    <el-tooltip :content="state.relTargetUserId" :disabled="!state.relTargetUserId">
                      <el-select v-model="state.relTargetUserId" placeholder="选择对象" filterable class="field-select">
                        <el-option
                          v-for="user in userOptions"
                          :key="user.userId"
                          :label="getDisplayNameLabel(user)"
                          :value="user.userId"
                        />
                      </el-select>
                    </el-tooltip>
                    <el-select v-model="state.relScope" class="scope-select">
                      <el-option label="仅好友" value="friends" />
                      <el-option label="全部用户" value="all" />
                    </el-select>
                    <el-button type="primary" :disabled="!state.relTargetUserId" :loading="state.loading.relationshipTop" @click="loadRelationshipTop">查询排行</el-button>
                  </div>

                  <el-table :data="state.relationshipTopRows" stripe v-loading="state.loading.relationshipTop">
                    <el-table-column label="昵称" min-width="220">
                      <template #default="{ row }">
                        <el-tooltip :content="getDisplayNameTooltip(row)" :disabled="!getDisplayNameTooltip(row)">
                          <span class="hover-label">{{ getDisplayNameLabel(row) }}</span>
                        </el-tooltip>
                      </template>
                    </el-table-column>
                    <el-table-column label="关系范围" width="110">
                      <template #default="{ row }">
                        <el-tag :type="row.isFriend ? 'success' : 'warning'" effect="light">
                          {{ row.isFriend ? '好友' : '非好友' }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="共处时长" width="120">
                      <template #default="{ row }">{{ formatDuration(row.overlapMs) }}</template>
                    </el-table-column>
                    <el-table-column prop="meetCount" label="共同实例数" width="120" />
                  </el-table>
                  <el-pagination
                    class="table-pagination"
                    background
                    layout="total, sizes, prev, pager, next"
                    :total="state.relationshipTopTotal"
                    :current-page="state.pagination.relationshipTop.page"
                    :page-size="state.pagination.relationshipTop.pageSize"
                    :page-sizes="pageSizeOptions"
                    @current-change="(page) => handlePageChange('relationshipTop', page)"
                    @size-change="(size) => handlePageSizeChange('relationshipTop', size)"
                  />
                </el-card>
              </el-tab-pane>

              <el-tab-pane label="双人关系查询" name="pair">
                <el-card class="panel-card relationship-query-card relationship-pair-card" shadow="hover">
                  <div class="section-title-row">
                    <h2>双人关系查询</h2>
                  </div>
                  <div class="query-control-row">
                    <el-tooltip :content="state.pairUserA" :disabled="!state.pairUserA">
                      <el-select v-model="state.pairUserA" placeholder="选择 A" filterable class="field-select">
                        <el-option
                          v-for="user in friendOptions"
                          :key="'a-' + user.userId"
                          :label="getDisplayNameLabel(user)"
                          :value="user.userId"
                        />
                      </el-select>
                    </el-tooltip>
                    <el-tooltip :content="state.pairUserB" :disabled="!state.pairUserB">
                      <el-select v-model="state.pairUserB" placeholder="选择 B" filterable class="field-select">
                        <el-option
                          v-for="user in friendOptions"
                          :key="'b-' + user.userId"
                          :label="getDisplayNameLabel(user)"
                          :value="user.userId"
                        />
                      </el-select>
                    </el-tooltip>
                    <el-button type="primary" :disabled="!state.pairUserA || !state.pairUserB" :loading="state.loading.relationshipPair" @click="loadRelationshipPair">一键查询</el-button>
                  </div>

                  <div v-if="pairSummaryText" class="pair-summary">{{ pairSummaryText }}</div>

                  <el-table :data="state.relationshipPair.records" stripe v-loading="state.loading.relationshipPair">
                    <el-table-column label="世界" min-width="220">
                      <template #default="{ row }">
                        <el-tooltip :content="getWorldTooltip(row)" :disabled="!getWorldTooltip(row)">
                          <div class="stacked-text world-cell">
                            <span class="hover-label world-label">{{ getWorldLabel(row) }}</span>
                            <span v-if="getWorldMetaLabel(row)" class="world-meta">{{ getWorldMetaLabel(row) }}</span>
                          </div>
                        </el-tooltip>
                      </template>
                    </el-table-column>
                    <el-table-column label="共处时长" width="120">
                      <template #default="{ row }">{{ formatDuration(row.overlapMs) }}</template>
                    </el-table-column>
                    <el-table-column label="区间" width="210">
                      <template #default="{ row }">
                        <div class="stacked-text">
                          <span>{{ formatDisplayDateTime(row.overlapStartAt) }}</span>
                          <span>{{ formatDisplayDateTime(row.overlapEndAt) }}</span>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="房主" min-width="180">
                      <template #default="{ row }">
                        <el-tooltip :content="getHostTooltip(row)" :disabled="!getHostTooltip(row)">
                          <span class="hover-label">{{ getHostLabel(row) }}</span>
                        </el-tooltip>
                      </template>
                    </el-table-column>
                    <el-table-column prop="peakOccupancy" label="峰值人数" width="100" />
                    <el-table-column label="你在场" width="90">
                      <template #default="{ row }">
                        <el-tag :type="row.selfPresent ? 'success' : 'warning'" effect="light">
                          {{ row.selfPresent ? '在场' : '不在场' }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="重叠切片" min-width="260">
                      <template #default="{ row }">
                        <div class="stacked-text">
                          <span v-for="(segment, index) in row.segments || []" :key="index">
                            {{ formatDisplayDateTime(segment.startAt) }} ~ {{ formatDisplayDateTime(segment.endAt) }} ({{ formatDuration(segment.overlapMs) }})
                          </span>
                          <span v-if="!(row.segments || []).length">-</span>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-pagination
                    class="table-pagination"
                    background
                    layout="total, sizes, prev, pager, next"
                    :total="state.relationshipPair.recordsTotal"
                    :current-page="state.pagination.pair.page"
                    :page-size="state.pagination.pair.pageSize"
                    :page-sizes="pageSizeOptions"
                    @current-change="(page) => handlePageChange('pair', page)"
                    @size-change="(size) => handlePageSizeChange('pair', size)"
                  />
                </el-card>
              </el-tab-pane>
            </el-tabs>
          </el-tab-pane>

          <el-tab-pane label="设置" name="settings">
            <el-card class="panel-card settings-card" shadow="hover">
              <div class="section-title-row">
                <h2>数据设置</h2>
              </div>

              <div class="settings-stack">
                <div class="settings-item">
                  <span class="settings-label">当前状态</span>
                  <span class="settings-value">{{ canAnalyze ? '已就绪' : '待选择数据文件夹' }}</span>
                </div>
                <div class="settings-item">
                  <span class="settings-label">VRCX数据文件夹</span>
                  <span class="settings-value">{{ state.appState.dataDir || '未设置' }}</span>
                </div>
                <div class="settings-item">
                  <span class="settings-label">数据库文件</span>
                  <span class="settings-value">{{ state.appState.dbPath || '未设置' }}</span>
                </div>
                <div class="settings-item">
                  <span class="settings-label">配置文件</span>
                  <span class="settings-value">{{ state.appState.configPath || '-' }}</span>
                </div>
              </div>

              <div class="settings-actions">
                <el-button type="primary" :loading="state.selectingDataDir" @click="chooseDataDirectory">
                  选择VRCX数据文件夹
                </el-button>
                <el-button :disabled="!canAnalyze" @click="handleReload">重新读取当前数据库</el-button>
              </div>
            </el-card>
          </el-tab-pane>
        </el-tabs>

        <el-dialog
          v-model="state.onboardingVisible"
          title="初始化引导"
          width="560px"
          :show-close="false"
          :close-on-click-modal="false"
          :close-on-press-escape="false"
        >
          <div class="onboarding-copy">
            <p>当前未找到可用的 VRCX 数据库。</p>
            <p>请选择 VRCX 数据文件夹，程序会读取其中的 <code>VRCX.sqlite3</code> 并写入 <code>data.json</code>。</p>
          </div>

          <template #footer>
            <el-button type="primary" :loading="state.selectingDataDir" @click="chooseDataDirectory">
              选择VRCX数据文件夹
            </el-button>
          </template>
        </el-dialog>
      </div>
    </div>
  `,
  setup() {
    const state = reactive({
      appState: {
        platform: '',
        source: '',
        dataDir: '',
        dbPath: '',
        configPath: '',
        requiresOnboarding: true
      },
      bootstrapping: true,
      selectingDataDir: false,
      onboardingVisible: false,
      meta: null,
      selectedTab: 'acquaintances',
      selectedTimelineTab: 'sessions',
      selectedRelationshipTab: 'top',
      rangePreset: 'month',
      dateRange: getPresetRangeValues('month'),
      timelineUserId: '',
      relTargetUserId: '',
      relScope: 'friends',
      pairUserA: '',
      pairUserB: '',
      jumpedUsers: [],
      acquaintances: {
        byMeetCount: [],
        byMeetCountTotal: 0,
        byOverlap: [],
        byOverlapTotal: 0,
        total: 0
      },
      timeline: {
        sessions: [],
        sessionsTotal: 0,
        companions: [],
        companionsTotal: 0,
        total: 0
      },
      relationshipTopRows: [],
      relationshipTopTotal: 0,
      relationshipPair: {
        displayNameA: '',
        displayNameB: '',
        totalOverlapMs: 0,
        records: [],
        recordsTotal: 0
      },
      pagination: {
        acquaintances: { page: 1, pageSize: 10 },
        timelineSessions: { page: 1, pageSize: 10 },
        timelineCompanions: { page: 1, pageSize: 10 },
        relationshipTop: { page: 1, pageSize: 10 },
        pair: { page: 1, pageSize: 10 }
      },
      loading: {
        reload: false,
        acquaintances: false,
        timeline: false,
        relationshipTop: false,
        relationshipPair: false
      }
    });

    const quickPresets = [
      { label: '一周', value: 'week' },
      { label: '一月', value: 'month' },
      { label: '一年', value: 'year' },
      { label: '有史以来', value: 'all' }
    ];
    const pageSizeOptions = [10, 20, 50, 100];

    const userOptions = computed(() => {
      return buildSelectableUserOptions(state.meta, state.jumpedUsers);
    });

    const friendOptions = computed(() => state.meta?.friends || []);

    const isApplying = computed(
      () =>
        state.loading.acquaintances ||
        state.loading.timeline ||
        state.loading.relationshipTop ||
        state.loading.relationshipPair
    );
    const canAnalyze = computed(() => !state.bootstrapping && !state.appState.requiresOnboarding);

    const pairSummaryText = computed(() => {
      const pair = state.relationshipPair;
      if (!pair.displayNameA || !pair.displayNameB) {
        return '';
      }
      return `${pair.displayNameA} × ${pair.displayNameB} | 共处总时长 ${formatDuration(pair.totalOverlapMs)} | 记录 ${pair.recordsTotal}`;
    });

    function normalizePagination(key, total) {
      const pagination = state.pagination[key];
      if (!pagination) {
        return;
      }
      const totalPages = Math.max(1, Math.ceil((total || 0) / pagination.pageSize));
      if (pagination.page > totalPages) {
        pagination.page = totalPages;
      }
      if (pagination.page < 1) {
        pagination.page = 1;
      }
    }

    async function loadPaginationData(key) {
      if (!canAnalyze.value) {
        return;
      }
      if (key === 'acquaintances') {
        await loadAcquaintances();
        return;
      }
      if (key === 'timelineSessions' || key === 'timelineCompanions') {
        await loadTimeline();
        return;
      }
      if (key === 'relationshipTop') {
        await loadRelationshipTop();
        return;
      }
      if (key === 'pair') {
        await loadRelationshipPair();
      }
    }

    async function handlePageChange(key, page) {
      state.pagination[key].page = page;
      try {
        await loadPaginationData(key);
      } catch (error) {
        ElMessage.error(`加载失败: ${error.message}`);
      }
    }

    async function handlePageSizeChange(key, size) {
      state.pagination[key].pageSize = size;
      state.pagination[key].page = 1;
      try {
        await loadPaginationData(key);
      } catch (error) {
        ElMessage.error(`加载失败: ${error.message}`);
      }
    }

    function getRangeQuery() {
      const qs = new URLSearchParams();
      if (state.rangePreset === 'all' || !Array.isArray(state.dateRange) || state.dateRange.length !== 2) {
        qs.set('all', '1');
        return qs;
      }
      qs.set('from', state.dateRange[0]);
      qs.set('to', state.dateRange[1]);
      return qs;
    }

    function ensureSelections() {
      const users = userOptions.value;
      const friends = friendOptions.value;

      if (!state.timelineUserId && users[0]) {
        state.timelineUserId = users[0].userId;
      }
      if (!state.relTargetUserId && users[0]) {
        state.relTargetUserId = users[0].userId;
      }
      if (!state.pairUserA && friends[0]) {
        state.pairUserA = friends[0].userId;
      }
      if (!state.pairUserB && friends[1]) {
        state.pairUserB = friends[1].userId;
      } else if (!state.pairUserB && friends[0]) {
        state.pairUserB = friends[0].userId;
      }
    }

    function handleDateRangeChange(value) {
      if (!Array.isArray(value) || value.length !== 2) {
        state.dateRange = [];
        state.rangePreset = 'all';
        return;
      }
      state.rangePreset = 'custom';
    }

    async function setPresetDates(preset, shouldApply = false) {
      state.rangePreset = preset;
      state.dateRange = getPresetRangeValues(preset);
      if (shouldApply && canAnalyze.value) {
        await applyAllViews();
      }
    }

    function resetAnalysisState() {
      state.meta = null;
      state.jumpedUsers = [];
      state.timelineUserId = '';
      state.relTargetUserId = '';
      state.pairUserA = '';
      state.pairUserB = '';
      state.acquaintances = {
        byMeetCount: [],
        byMeetCountTotal: 0,
        byOverlap: [],
        byOverlapTotal: 0,
        total: 0
      };
      state.timeline = {
        sessions: [],
        sessionsTotal: 0,
        companions: [],
        companionsTotal: 0,
        total: 0
      };
      state.relationshipTopRows = [];
      state.relationshipTopTotal = 0;
      state.relationshipPair = {
        displayNameA: '',
        displayNameB: '',
        totalOverlapMs: 0,
        records: [],
        recordsTotal: 0
      };
    }

    async function loadAppState() {
      state.appState = await getInsightsApi().getAppState();
      state.onboardingVisible = !!state.appState.requiresOnboarding;
      if (state.appState.requiresOnboarding) {
        state.selectedTab = 'settings';
      }
    }

    async function hydrateConfiguredState() {
      await loadAppState();
      if (!state.appState.requiresOnboarding) {
        await loadMeta();
        await applyAllViews();
      } else {
        resetAnalysisState();
      }
    }

    async function loadMeta() {
      state.meta = await getInsightsApi().getMeta();
      ensureSelections();
    }

    async function loadAcquaintances(options = {}) {
      if (!canAnalyze.value) {
        return;
      }
      const silent = Boolean(options?.silent);
      if (!silent) {
        state.loading.acquaintances = true;
      }
      try {
        const qs = getRangeQuery();
        qs.set('page', state.pagination.acquaintances.page);
        qs.set('pageSize', state.pagination.acquaintances.pageSize);
        const data = await getInsightsApi().getAcquaintances(toQueryObject(qs));
        state.acquaintances.byMeetCount = data.byMeetCount || [];
        state.acquaintances.byMeetCountTotal = data.byMeetCountTotal || 0;
        state.acquaintances.byOverlap = data.byOverlap || [];
        state.acquaintances.byOverlapTotal = data.byOverlapTotal || 0;
        state.acquaintances.total = data.total || 0;
        state.pagination.acquaintances.page = data.page || state.pagination.acquaintances.page;
        state.pagination.acquaintances.pageSize = data.pageSize || state.pagination.acquaintances.pageSize;
        normalizePagination('acquaintances', state.acquaintances.total);
      } finally {
        if (!silent) {
          state.loading.acquaintances = false;
        }
      }
    }

    async function loadTimeline(options = {}) {
      if (!canAnalyze.value || !state.timelineUserId) {
        return;
      }
      const silent = Boolean(options?.silent);
      if (!silent) {
        state.loading.timeline = true;
      }
      try {
        const qs = getRangeQuery();
        qs.set('userId', state.timelineUserId);
        qs.set('scope', state.selectedTimelineTab);
        qs.set('sessionPage', state.pagination.timelineSessions.page);
        qs.set('sessionPageSize', state.pagination.timelineSessions.pageSize);
        qs.set('companionPage', state.pagination.timelineCompanions.page);
        qs.set('companionPageSize', state.pagination.timelineCompanions.pageSize);
        const data = await getInsightsApi().getTimeline(toQueryObject(qs));
        state.timeline.sessions = data.sessions || [];
        state.timeline.sessionsTotal = data.sessionsTotal || 0;
        state.timeline.companions = data.companions || [];
        state.timeline.companionsTotal = data.companionsTotal || 0;
        state.timeline.total = data.total || 0;
        state.pagination.timelineSessions.page = data.sessionPage || state.pagination.timelineSessions.page;
        state.pagination.timelineSessions.pageSize = data.sessionPageSize || state.pagination.timelineSessions.pageSize;
        state.pagination.timelineCompanions.page = data.companionPage || state.pagination.timelineCompanions.page;
        state.pagination.timelineCompanions.pageSize =
          data.companionPageSize || state.pagination.timelineCompanions.pageSize;
        normalizePagination('timelineSessions', state.timeline.sessionsTotal);
        normalizePagination('timelineCompanions', state.timeline.companionsTotal);
      } finally {
        if (!silent) {
          state.loading.timeline = false;
        }
      }
    }

    async function loadRelationshipTop(options = {}) {
      if (!canAnalyze.value || !state.relTargetUserId) {
        return;
      }
      const silent = Boolean(options?.silent);
      if (!silent) {
        state.loading.relationshipTop = true;
      }
      try {
        const qs = getRangeQuery();
        qs.set('userId', state.relTargetUserId);
        qs.set('scope', state.relScope);
        qs.set('page', state.pagination.relationshipTop.page);
        qs.set('pageSize', state.pagination.relationshipTop.pageSize);
        const data = await getInsightsApi().getRelationshipTop(toQueryObject(qs));
        state.relationshipTopRows = data.rows || [];
        state.relationshipTopTotal = data.total || 0;
        state.pagination.relationshipTop.page = data.page || state.pagination.relationshipTop.page;
        state.pagination.relationshipTop.pageSize = data.pageSize || state.pagination.relationshipTop.pageSize;
        normalizePagination('relationshipTop', state.relationshipTopTotal);
      } finally {
        if (!silent) {
          state.loading.relationshipTop = false;
        }
      }
    }

    async function loadRelationshipPair(options = {}) {
      if (!canAnalyze.value || !state.pairUserA || !state.pairUserB) {
        return;
      }
      const silent = Boolean(options?.silent);
      if (!silent) {
        state.loading.relationshipPair = true;
      }
      try {
        const qs = getRangeQuery();
        qs.set('userIdA', state.pairUserA);
        qs.set('userIdB', state.pairUserB);
        qs.set('page', state.pagination.pair.page);
        qs.set('pageSize', state.pagination.pair.pageSize);
        const data = await getInsightsApi().getRelationshipPair(toQueryObject(qs));
        state.relationshipPair = {
          displayNameA: data.displayNameA || '',
          displayNameB: data.displayNameB || '',
          totalOverlapMs: data.totalOverlapMs || 0,
          records: data.records || [],
          recordsTotal: data.total || 0
        };
        state.pagination.pair.page = data.page || state.pagination.pair.page;
        state.pagination.pair.pageSize = data.pageSize || state.pagination.pair.pageSize;
        normalizePagination('pair', state.relationshipPair.recordsTotal);
      } finally {
        if (!silent) {
          state.loading.relationshipPair = false;
        }
      }
    }

    async function applyAllViews(options = {}) {
      if (!canAnalyze.value) {
        return;
      }
      try {
        await Promise.all([
          loadAcquaintances(options),
          loadTimeline(options),
          loadRelationshipTop(options),
          loadRelationshipPair(options)
        ]);
      } catch (error) {
        ElMessage.error(`加载失败: ${error.message}`);
      }
    }

    async function handleReload() {
      if (!canAnalyze.value) {
        return;
      }
      state.loading.reload = true;
      try {
        await getInsightsApi().reload();
        await loadMeta();
        await applyAllViews({ silent: true });
        ElMessage.success('重算完成');
      } catch (error) {
        ElMessage.error(`重算失败: ${error.message}`);
      } finally {
        state.loading.reload = false;
      }
    }

    function rememberJumpedUser(user) {
      if (!user?.userId) {
        return;
      }
      if (state.jumpedUsers.some((item) => item.userId === user.userId)) {
        return;
      }
      state.jumpedUsers.push({
        userId: user.userId,
        displayName: user.displayName || user.userId
      });
    }

    async function goTimeline(user) {
      if (!canAnalyze.value) {
        return;
      }
      rememberJumpedUser(user);
      state.timelineUserId = user.userId;
      state.selectedTab = 'timeline';
      state.selectedTimelineTab = 'sessions';
      try {
        await loadTimeline();
      } catch (error) {
        ElMessage.error(`加载失败: ${error.message}`);
      }
    }

    async function goRelationship(user) {
      if (!canAnalyze.value) {
        return;
      }
      rememberJumpedUser(user);
      state.relTargetUserId = user.userId;
      state.relScope = 'all';
      state.selectedTab = 'relationship';
      state.selectedRelationshipTab = 'top';
      try {
        await loadRelationshipTop();
      } catch (error) {
        ElMessage.error(`加载失败: ${error.message}`);
      }
    }

    function openSettings() {
      state.selectedTab = 'settings';
    }

    async function chooseDataDirectory() {
      state.selectingDataDir = true;
      try {
        const result = await getInsightsApi().chooseDataDirectory();
        state.appState = {
          ...state.appState,
          ...result
        };
        state.onboardingVisible = !!state.appState.requiresOnboarding;
        if (!result?.canceled && !state.appState.requiresOnboarding) {
          await loadMeta();
          await applyAllViews();
          ElMessage.success('数据文件夹已更新');
        }
      } catch (error) {
        ElMessage.error(`设置失败: ${error.message}`);
      } finally {
        state.selectingDataDir = false;
      }
    }

    onMounted(async () => {
      state.bootstrapping = true;
      try {
        await hydrateConfiguredState();
      } catch (error) {
        ElMessage.error(`加载失败: ${error.message}`);
      } finally {
        state.bootstrapping = false;
      }
    });

    return {
      state,
      quickPresets,
      pageSizeOptions,
      userOptions,
      friendOptions,
      isApplying,
      canAnalyze,
      pairSummaryText,
      loadPaginationData,
      handlePageChange,
      handlePageSizeChange,
      formatDuration,
      formatDisplayDateTime,
      getDisplayNameLabel,
      getDisplayNameTooltip,
      getWorldLabel,
      getWorldMetaLabel,
      getWorldTooltip,
      getHostLabel,
      getHostTooltip,
      handleDateRangeChange,
      setPresetDates,
      loadTimeline,
      loadRelationshipTop,
      loadRelationshipPair,
      applyAllViews,
      handleReload,
      openSettings,
      chooseDataDirectory,
      goTimeline,
      goRelationship
    };
  }
}).use(window.ElementPlus, {
  locale: window.ElementPlusLocaleZhCn
}).mount('#app');
