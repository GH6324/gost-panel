<template>
  <div class="rules">
    <n-card>
      <template #header>
        <span>规则管理</span>
      </template>
      <n-tabs type="line" v-model:value="activeTab">
        <!-- Bypass 分流规则 -->
        <n-tab-pane name="bypass" tab="分流规则 (Bypass)">
          <n-alert type="info" style="margin-bottom: 16px;">
            分流规则控制哪些目标地址走代理或直连。黑名单模式：匹配的地址不走代理；白名单模式：仅匹配的地址走代理。
          </n-alert>
          <n-space justify="end" style="margin-bottom: 12px;">
            <n-button type="primary" size="small" @click="openBypassModal()">添加规则</n-button>
          </n-space>
          <TableSkeleton v-if="bypassLoading && bypasses.length === 0" :rows="3" />
          <EmptyState v-else-if="!bypassLoading && bypasses.length === 0" type="rules" action-text="添加规则" @action="openBypassModal()" />
          <n-data-table v-else :columns="bypassColumns" :data="bypasses" :loading="bypassLoading" :row-key="(row: any) => row.id" size="small" />
        </n-tab-pane>

        <!-- Admission 准入控制 -->
        <n-tab-pane name="admission" tab="准入控制 (Admission)">
          <n-alert type="info" style="margin-bottom: 16px;">
            准入控制限制哪些客户端 IP 可以连接代理服务。黑名单模式：拒绝匹配的 IP；白名单模式：仅允许匹配的 IP。
          </n-alert>
          <n-space justify="end" style="margin-bottom: 12px;">
            <n-button type="primary" size="small" @click="openAdmissionModal()">添加规则</n-button>
          </n-space>
          <TableSkeleton v-if="admissionLoading && admissions.length === 0" :rows="3" />
          <EmptyState v-else-if="!admissionLoading && admissions.length === 0" type="rules" action-text="添加规则" @action="openAdmissionModal()" />
          <n-data-table v-else :columns="admissionColumns" :data="admissions" :loading="admissionLoading" :row-key="(row: any) => row.id" size="small" />
        </n-tab-pane>

        <!-- HostMapping 主机映射 -->
        <n-tab-pane name="hosts" tab="主机映射 (Hosts)">
          <n-alert type="info" style="margin-bottom: 16px;">
            自定义 DNS 解析，将域名映射到指定 IP 地址，类似 /etc/hosts 文件。
          </n-alert>
          <n-space justify="end" style="margin-bottom: 12px;">
            <n-button type="primary" size="small" @click="openHostsModal()">添加映射</n-button>
          </n-space>
          <TableSkeleton v-if="hostsLoading && hostMappings.length === 0" :rows="3" />
          <EmptyState v-else-if="!hostsLoading && hostMappings.length === 0" type="rules" action-text="添加映射" @action="openHostsModal()" />
          <n-data-table v-else :columns="hostsColumns" :data="hostMappings" :loading="hostsLoading" :row-key="(row: any) => row.id" size="small" />
        </n-tab-pane>
      </n-tabs>
    </n-card>

    <!-- Bypass Modal -->
    <n-modal v-model:show="showBypassModal" preset="dialog" :title="editingBypass ? '编辑分流规则' : '添加分流规则'" style="width: 600px;">
      <n-form :model="bypassForm" label-placement="left" label-width="100">
        <n-form-item label="名称" required>
          <n-input v-model:value="bypassForm.name" placeholder="例如: 国内直连" />
        </n-form-item>
        <n-form-item label="模式">
          <n-radio-group v-model:value="bypassForm.whitelist">
            <n-radio :value="false">黑名单 (匹配的不走代理)</n-radio>
            <n-radio :value="true">白名单 (仅匹配的走代理)</n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="关联节点">
          <n-select v-model:value="bypassForm.node_id" :options="nodeOptions" clearable filterable placeholder="全局 (不关联节点)" />
        </n-form-item>
        <n-form-item label="规则列表">
          <n-input v-model:value="bypassForm.matchersText" type="textarea" :rows="8" placeholder="每行一条规则，支持：&#10;*.google.com (域名通配)&#10;.github.com (子域名匹配)&#10;10.0.0.0/8 (IP/CIDR)&#10;192.168.1.1 (精确 IP)" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showBypassModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSaveBypass">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Admission Modal -->
    <n-modal v-model:show="showAdmissionModal" preset="dialog" :title="editingAdmission ? '编辑准入规则' : '添加准入规则'" style="width: 600px;">
      <n-form :model="admissionForm" label-placement="left" label-width="100">
        <n-form-item label="名称" required>
          <n-input v-model:value="admissionForm.name" placeholder="例如: 仅允许内网" />
        </n-form-item>
        <n-form-item label="模式">
          <n-radio-group v-model:value="admissionForm.whitelist">
            <n-radio :value="false">黑名单 (拒绝匹配的 IP)</n-radio>
            <n-radio :value="true">白名单 (仅允许匹配的 IP)</n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="关联节点">
          <n-select v-model:value="admissionForm.node_id" :options="nodeOptions" clearable filterable placeholder="全局 (不关联节点)" />
        </n-form-item>
        <n-form-item label="IP 列表">
          <n-input v-model:value="admissionForm.matchersText" type="textarea" :rows="8" placeholder="每行一条规则，支持：&#10;192.168.0.0/16 (CIDR)&#10;10.0.0.1 (精确 IP)&#10;172.16.0.0/12 (CIDR)" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showAdmissionModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSaveAdmission">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- HostMapping Modal -->
    <n-modal v-model:show="showHostsModal" preset="dialog" :title="editingHosts ? '编辑主机映射' : '添加主机映射'" style="width: 650px;">
      <n-form :model="hostsForm" label-placement="left" label-width="100">
        <n-form-item label="名称" required>
          <n-input v-model:value="hostsForm.name" placeholder="例如: 自定义DNS" />
        </n-form-item>
        <n-form-item label="关联节点">
          <n-select v-model:value="hostsForm.node_id" :options="nodeOptions" clearable filterable placeholder="全局 (不关联节点)" />
        </n-form-item>
        <n-form-item label="映射规则">
          <n-input v-model:value="hostsForm.mappingsText" type="textarea" :rows="8" placeholder="每行一条: IP 域名 [prefer]&#10;例如:&#10;127.0.0.1 example.com&#10;1.2.3.4 api.example.com ipv4&#10;::1 v6.example.com ipv6" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showHostsModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSaveHosts">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, computed } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import {
  getBypasses, createBypass, updateBypass, deleteBypass,
  getAdmissions, createAdmission, updateAdmission, deleteAdmission,
  getHostMappings, createHostMapping, updateHostMapping, deleteHostMapping,
  getNodes,
} from '../api'
import EmptyState from '../components/EmptyState.vue'
import TableSkeleton from '../components/TableSkeleton.vue'

const message = useMessage()
const dialog = useDialog()

const activeTab = ref('bypass')
const saving = ref(false)

// Data
const bypasses = ref<any[]>([])
const admissions = ref<any[]>([])
const hostMappings = ref<any[]>([])
const allNodes = ref<any[]>([])

// Loading states
const bypassLoading = ref(false)
const admissionLoading = ref(false)
const hostsLoading = ref(false)

// Modal states
const showBypassModal = ref(false)
const showAdmissionModal = ref(false)
const showHostsModal = ref(false)
const editingBypass = ref<any>(null)
const editingAdmission = ref<any>(null)
const editingHosts = ref<any>(null)

// Forms
const bypassForm = ref({ name: '', whitelist: false, node_id: null as number | null, matchersText: '' })
const admissionForm = ref({ name: '', whitelist: false, node_id: null as number | null, matchersText: '' })
const hostsForm = ref({ name: '', node_id: null as number | null, mappingsText: '' })

const nodeOptions = computed(() =>
  allNodes.value.map((n: any) => ({
    label: `${n.name} (${n.host}:${n.port})`,
    value: n.id,
  }))
)

// Parse matchers text to JSON array
const parseMatchers = (text: string): string => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  return JSON.stringify(lines)
}

// Parse matchers JSON to text
const matchersToText = (json: string): string => {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.join('\n') : ''
  } catch { return '' }
}

// Parse hosts mappings text to JSON
const parseMappings = (text: string): string => {
  const mappings: { hostname: string; ip: string; prefer?: string }[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  for (const line of lines) {
    const parts = line.split(/\s+/)
    if (parts.length >= 2) {
      const entry: { hostname: string; ip: string; prefer?: string } = { ip: parts[0]!, hostname: parts[1]! }
      if (parts[2]) entry.prefer = parts[2]
      mappings.push(entry)
    }
  }
  return JSON.stringify(mappings)
}

// Parse mappings JSON to text
const mappingsToText = (json: string): string => {
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return ''
    return arr.map((m: any) => {
      let line = `${m.ip} ${m.hostname}`
      if (m.prefer) line += ` ${m.prefer}`
      return line
    }).join('\n')
  } catch { return '' }
}

// Count display
const countMatchers = (json: string): number => {
  try { return JSON.parse(json)?.length || 0 } catch { return 0 }
}

// ==================== Bypass ====================
const bypassColumns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '名称', key: 'name', width: 150 },
  {
    title: '模式', key: 'whitelist', width: 100,
    render: (row: any) => h(NTag, { type: row.whitelist ? 'success' : 'warning', size: 'small' }, () => row.whitelist ? '白名单' : '黑名单'),
  },
  {
    title: '规则数', key: 'matchers', width: 80,
    render: (row: any) => countMatchers(row.matchers),
  },
  {
    title: '关联节点', key: 'node_id', width: 120,
    render: (row: any) => {
      if (!row.node_id) return h(NTag, { size: 'small' }, () => '全局')
      const node = allNodes.value.find((n: any) => n.id === row.node_id)
      return node ? node.name : `#${row.node_id}`
    },
  },
  {
    title: '操作', key: 'actions', width: 150,
    render: (row: any) => h(NSpace, { size: 'small' }, () => [
      h(NButton, { size: 'small', onClick: () => openBypassModal(row) }, () => '编辑'),
      h(NButton, { size: 'small', type: 'error', onClick: () => handleDeleteBypass(row) }, () => '删除'),
    ]),
  },
]

const loadBypasses = async () => {
  bypassLoading.value = true
  try {
    const data: any = await getBypasses()
    bypasses.value = data || []
  } catch { message.error('加载分流规则失败') }
  finally { bypassLoading.value = false }
}

const openBypassModal = (row?: any) => {
  if (row) {
    editingBypass.value = row
    bypassForm.value = { name: row.name, whitelist: row.whitelist, node_id: row.node_id || null, matchersText: matchersToText(row.matchers) }
  } else {
    editingBypass.value = null
    bypassForm.value = { name: '', whitelist: false, node_id: null, matchersText: '' }
  }
  showBypassModal.value = true
}

const handleSaveBypass = async () => {
  if (!bypassForm.value.name) { message.error('请输入名称'); return }
  saving.value = true
  try {
    const data = {
      name: bypassForm.value.name,
      whitelist: bypassForm.value.whitelist,
      node_id: bypassForm.value.node_id || undefined,
      matchers: parseMatchers(bypassForm.value.matchersText),
    }
    if (editingBypass.value) {
      await updateBypass(editingBypass.value.id, data)
      message.success('规则已更新')
    } else {
      await createBypass(data)
      message.success('规则已创建')
    }
    showBypassModal.value = false
    loadBypasses()
  } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
  finally { saving.value = false }
}

const handleDeleteBypass = (row: any) => {
  dialog.warning({
    title: '删除分流规则',
    content: `确定要删除 "${row.name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try { await deleteBypass(row.id); message.success('已删除'); loadBypasses() }
      catch { message.error('删除失败') }
    },
  })
}

// ==================== Admission ====================
const admissionColumns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '名称', key: 'name', width: 150 },
  {
    title: '模式', key: 'whitelist', width: 100,
    render: (row: any) => h(NTag, { type: row.whitelist ? 'success' : 'warning', size: 'small' }, () => row.whitelist ? '白名单' : '黑名单'),
  },
  {
    title: '规则数', key: 'matchers', width: 80,
    render: (row: any) => countMatchers(row.matchers),
  },
  {
    title: '关联节点', key: 'node_id', width: 120,
    render: (row: any) => {
      if (!row.node_id) return h(NTag, { size: 'small' }, () => '全局')
      const node = allNodes.value.find((n: any) => n.id === row.node_id)
      return node ? node.name : `#${row.node_id}`
    },
  },
  {
    title: '操作', key: 'actions', width: 150,
    render: (row: any) => h(NSpace, { size: 'small' }, () => [
      h(NButton, { size: 'small', onClick: () => openAdmissionModal(row) }, () => '编辑'),
      h(NButton, { size: 'small', type: 'error', onClick: () => handleDeleteAdmission(row) }, () => '删除'),
    ]),
  },
]

const loadAdmissions = async () => {
  admissionLoading.value = true
  try {
    const data: any = await getAdmissions()
    admissions.value = data || []
  } catch { message.error('加载准入规则失败') }
  finally { admissionLoading.value = false }
}

const openAdmissionModal = (row?: any) => {
  if (row) {
    editingAdmission.value = row
    admissionForm.value = { name: row.name, whitelist: row.whitelist, node_id: row.node_id || null, matchersText: matchersToText(row.matchers) }
  } else {
    editingAdmission.value = null
    admissionForm.value = { name: '', whitelist: false, node_id: null, matchersText: '' }
  }
  showAdmissionModal.value = true
}

const handleSaveAdmission = async () => {
  if (!admissionForm.value.name) { message.error('请输入名称'); return }
  saving.value = true
  try {
    const data = {
      name: admissionForm.value.name,
      whitelist: admissionForm.value.whitelist,
      node_id: admissionForm.value.node_id || undefined,
      matchers: parseMatchers(admissionForm.value.matchersText),
    }
    if (editingAdmission.value) {
      await updateAdmission(editingAdmission.value.id, data)
      message.success('规则已更新')
    } else {
      await createAdmission(data)
      message.success('规则已创建')
    }
    showAdmissionModal.value = false
    loadAdmissions()
  } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
  finally { saving.value = false }
}

const handleDeleteAdmission = (row: any) => {
  dialog.warning({
    title: '删除准入规则',
    content: `确定要删除 "${row.name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try { await deleteAdmission(row.id); message.success('已删除'); loadAdmissions() }
      catch { message.error('删除失败') }
    },
  })
}

// ==================== HostMapping ====================
const hostsColumns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '名称', key: 'name', width: 150 },
  {
    title: '映射数', key: 'mappings', width: 80,
    render: (row: any) => countMatchers(row.mappings),
  },
  {
    title: '关联节点', key: 'node_id', width: 120,
    render: (row: any) => {
      if (!row.node_id) return h(NTag, { size: 'small' }, () => '全局')
      const node = allNodes.value.find((n: any) => n.id === row.node_id)
      return node ? node.name : `#${row.node_id}`
    },
  },
  {
    title: '操作', key: 'actions', width: 150,
    render: (row: any) => h(NSpace, { size: 'small' }, () => [
      h(NButton, { size: 'small', onClick: () => openHostsModal(row) }, () => '编辑'),
      h(NButton, { size: 'small', type: 'error', onClick: () => handleDeleteHosts(row) }, () => '删除'),
    ]),
  },
]

const loadHostMappings = async () => {
  hostsLoading.value = true
  try {
    const data: any = await getHostMappings()
    hostMappings.value = data || []
  } catch { message.error('加载主机映射失败') }
  finally { hostsLoading.value = false }
}

const openHostsModal = (row?: any) => {
  if (row) {
    editingHosts.value = row
    hostsForm.value = { name: row.name, node_id: row.node_id || null, mappingsText: mappingsToText(row.mappings) }
  } else {
    editingHosts.value = null
    hostsForm.value = { name: '', node_id: null, mappingsText: '' }
  }
  showHostsModal.value = true
}

const handleSaveHosts = async () => {
  if (!hostsForm.value.name) { message.error('请输入名称'); return }
  saving.value = true
  try {
    const data = {
      name: hostsForm.value.name,
      node_id: hostsForm.value.node_id || undefined,
      mappings: parseMappings(hostsForm.value.mappingsText),
    }
    if (editingHosts.value) {
      await updateHostMapping(editingHosts.value.id, data)
      message.success('映射已更新')
    } else {
      await createHostMapping(data)
      message.success('映射已创建')
    }
    showHostsModal.value = false
    loadHostMappings()
  } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
  finally { saving.value = false }
}

const handleDeleteHosts = (row: any) => {
  dialog.warning({
    title: '删除主机映射',
    content: `确定要删除 "${row.name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try { await deleteHostMapping(row.id); message.success('已删除'); loadHostMappings() }
      catch { message.error('删除失败') }
    },
  })
}

// Load all nodes for selector
const loadNodes = async () => {
  try {
    const data: any = await getNodes()
    allNodes.value = data || []
  } catch { /* silent */ }
}

onMounted(() => {
  loadNodes()
  loadBypasses()
  loadAdmissions()
  loadHostMappings()
})
</script>

<style scoped>
</style>
