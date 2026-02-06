<template>
  <div class="plans">
    <n-card>
      <template #header>
        <n-space justify="space-between" align="center">
          <span>套餐管理</span>
          <n-button type="primary" @click="openCreateModal">
            添加套餐
          </n-button>
        </n-space>
      </template>

      <!-- 骨架屏加载 -->
      <TableSkeleton v-if="loading && plans.length === 0" :rows="3" :columns="[1, 2, 1, 1, 1]" />

      <!-- 空状态 -->
      <EmptyState
        v-else-if="!loading && plans.length === 0"
        type="plans"
        action-text="添加套餐"
        @action="openCreateModal"
      />

      <!-- 数据表格 -->
      <n-data-table
        v-else
        :columns="columns"
        :data="plans"
        :loading="loading"
        :row-key="(row: any) => row.id"
      />
    </n-card>

    <!-- Create/Edit Modal -->
    <n-modal v-model:show="showCreateModal" preset="dialog" :title="editingPlan ? '编辑套餐' : '添加套餐'" style="width: 600px;">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-form-item label="套餐名称">
          <n-input v-model:value="form.name" placeholder="如: 基础版、专业版" />
        </n-form-item>
        <n-form-item label="套餐描述">
          <n-input v-model:value="form.description" type="textarea" placeholder="套餐功能说明" :rows="2" />
        </n-form-item>
        <n-divider title-placement="left">配额限制</n-divider>
        <n-form-item label="流量配额">
          <n-space>
            <n-input-number
              v-model:value="trafficQuotaGB"
              :min="0"
              :max="102400"
              :step="10"
              style="width: 150px;"
              placeholder="0"
            />
            <span>GB (0 = 无限制)</span>
          </n-space>
        </n-form-item>
        <n-form-item label="速度限制">
          <n-space>
            <n-input-number
              v-model:value="speedLimitMbps"
              :min="0"
              :max="10000"
              :step="10"
              style="width: 150px;"
              placeholder="0"
            />
            <span>Mbps (0 = 不限速)</span>
          </n-space>
        </n-form-item>
        <n-form-item label="有效期">
          <n-space>
            <n-input-number
              v-model:value="form.duration"
              :min="0"
              :max="3650"
              :step="30"
              style="width: 150px;"
              placeholder="30"
            />
            <span>天 (0 = 永久)</span>
          </n-space>
        </n-form-item>
        <n-divider title-placement="left">资源限制</n-divider>
        <n-form-item label="最大节点数">
          <n-space>
            <n-input-number
              v-model:value="form.max_nodes"
              :min="0"
              :max="1000"
              style="width: 150px;"
              placeholder="0"
            />
            <span>(0 = 无限制)</span>
          </n-space>
        </n-form-item>
        <n-form-item label="最大客户端">
          <n-space>
            <n-input-number
              v-model:value="form.max_clients"
              :min="0"
              :max="1000"
              style="width: 150px;"
              placeholder="0"
            />
            <span>(0 = 无限制)</span>
          </n-space>
        </n-form-item>
        <n-divider title-placement="left">其他设置</n-divider>
        <n-form-item label="排序顺序">
          <n-input-number
            v-model:value="form.sort_order"
            :min="0"
            :max="999"
            style="width: 150px;"
          />
        </n-form-item>
        <n-form-item label="启用套餐">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showCreateModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, computed } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog, NTooltip } from 'naive-ui'
import { getPlans, createPlan, updatePlan, deletePlan } from '../api'
import EmptyState from '../components/EmptyState.vue'
import TableSkeleton from '../components/TableSkeleton.vue'
import { useKeyboard } from '../composables/useKeyboard'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const saving = ref(false)
const plans = ref<any[]>([])
const showCreateModal = ref(false)
const editingPlan = ref<any>(null)

const defaultForm = () => ({
  name: '',
  description: '',
  traffic_quota: 0,
  speed_limit: 0,
  duration: 30,
  max_nodes: 0,
  max_clients: 0,
  enabled: true,
  sort_order: 0,
})

const form = ref(defaultForm())

// GB 单位转换
const trafficQuotaGB = computed({
  get: () => Math.round((form.value.traffic_quota || 0) / (1024 * 1024 * 1024)),
  set: (val: number) => { form.value.traffic_quota = val * 1024 * 1024 * 1024 }
})

// Mbps 单位转换 (1 Mbps = 125000 bytes/s)
const speedLimitMbps = computed({
  get: () => Math.round((form.value.speed_limit || 0) / 125000),
  set: (val: number) => { form.value.speed_limit = val * 125000 }
})

// 格式化流量
const formatTraffic = (bytes: number) => {
  if (!bytes || bytes === 0) return '无限制'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// 格式化速度
const formatSpeed = (bytesPerSec: number) => {
  if (!bytesPerSec || bytesPerSec === 0) return '不限速'
  const mbps = bytesPerSec / 125000
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(1)} Gbps`
  }
  return `${mbps.toFixed(0)} Mbps`
}

// 格式化有效期
const formatDuration = (days: number) => {
  if (!days || days === 0) return '永久'
  if (days >= 365) {
    const years = Math.floor(days / 365)
    const remainDays = days % 365
    if (remainDays === 0) return `${years} 年`
    return `${years} 年 ${remainDays} 天`
  }
  if (days >= 30) {
    const months = Math.floor(days / 30)
    const remainDays = days % 30
    if (remainDays === 0) return `${months} 个月`
    return `${months} 个月 ${remainDays} 天`
  }
  return `${days} 天`
}

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '套餐名称', key: 'name', width: 150 },
  {
    title: '流量配额',
    key: 'traffic_quota',
    width: 120,
    render: (row: any) => formatTraffic(row.traffic_quota)
  },
  {
    title: '速度限制',
    key: 'speed_limit',
    width: 100,
    render: (row: any) => formatSpeed(row.speed_limit)
  },
  {
    title: '有效期',
    key: 'duration',
    width: 100,
    render: (row: any) => formatDuration(row.duration)
  },
  {
    title: '资源限制',
    key: 'limits',
    width: 150,
    render: (row: any) => {
      const nodes = row.max_nodes || '无限'
      const clients = row.max_clients || '无限'
      return h(NTooltip, {}, {
        trigger: () => `${nodes} 节点 / ${clients} 客户端`,
        default: () => `最大节点: ${nodes}, 最大客户端: ${clients}`
      })
    }
  },
  {
    title: '用户数',
    key: 'user_count',
    width: 80,
    render: (row: any) => h(NTag, { type: 'info', size: 'small' }, () => row.user_count || 0)
  },
  {
    title: '状态',
    key: 'enabled',
    width: 80,
    render: (row: any) =>
      h(NTag, { type: row.enabled ? 'success' : 'default', size: 'small' }, () => row.enabled ? '启用' : '禁用'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render: (row: any) =>
      h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'small', onClick: () => handleEdit(row) }, () => '编辑'),
        h(NButton, {
          size: 'small',
          type: 'error',
          onClick: () => handleDelete(row),
          disabled: row.user_count > 0
        }, () => '删除'),
      ]),
  },
]

const loadPlans = async () => {
  loading.value = true
  try {
    const data: any = await getPlans()
    plans.value = data || []
  } catch (e) {
    message.error('加载套餐失败')
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  form.value = defaultForm()
  editingPlan.value = null
  showCreateModal.value = true
}

const handleEdit = (row: any) => {
  editingPlan.value = row
  form.value = {
    ...defaultForm(),
    ...row,
  }
  showCreateModal.value = true
}

const handleSave = async () => {
  if (!form.value.name) {
    message.error('请输入套餐名称')
    return
  }

  saving.value = true
  try {
    if (editingPlan.value) {
      await updatePlan(editingPlan.value.id, form.value)
      message.success('套餐已更新')
    } else {
      await createPlan(form.value)
      message.success('套餐已创建')
    }
    showCreateModal.value = false
    loadPlans()
  } catch (e: any) {
    message.error(e.response?.data?.error || '保存套餐失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = (row: any) => {
  if (row.user_count > 0) {
    message.error('该套餐正在被使用，无法删除')
    return
  }

  dialog.warning({
    title: '删除套餐',
    content: `确定要删除套餐 "${row.name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deletePlan(row.id)
        message.success('套餐已删除')
        loadPlans()
      } catch (e: any) {
        message.error(e.response?.data?.error || '删除套餐失败')
      }
    },
  })
}

onMounted(() => {
  loadPlans()
})

// Keyboard shortcuts
useKeyboard({
  onNew: openCreateModal,
  modalVisible: showCreateModal,
  onSave: handleSave,
})
</script>

<style scoped>
</style>
