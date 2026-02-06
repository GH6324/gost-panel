<template>
  <div class="users">
    <n-card>
      <template #header>
        <n-space justify="space-between" align="center">
          <span>用户管理</span>
          <n-space>
            <n-button type="primary" @click="openCreateModal">
              添加用户
            </n-button>
            <n-button @click="openChangePasswordModal">
              修改密码
            </n-button>
          </n-space>
        </n-space>
      </template>

      <!-- 骨架屏加载 -->
      <TableSkeleton v-if="loading && users.length === 0" :rows="3" :columns="[1, 2, 1, 1, 2]" />

      <!-- 空状态 -->
      <EmptyState
        v-else-if="!loading && users.length === 0"
        type="users"
        action-text="添加用户"
        @action="openCreateModal"
      />

      <!-- 数据表格 -->
      <n-data-table
        v-else
        :columns="columns"
        :data="users"
        :loading="loading"
        :row-key="(row: any) => row.id"
      />
    </n-card>

    <!-- Create/Edit Modal -->
    <n-modal v-model:show="showCreateModal" preset="dialog" :title="editingUser ? '编辑用户' : '添加用户'" style="width: 550px;">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-form-item label="用户名">
          <n-input v-model:value="form.username" placeholder="用户名" :disabled="!!editingUser" />
        </n-form-item>
        <n-form-item label="密码" v-if="!editingUser">
          <n-input v-model:value="form.password" type="password" placeholder="密码" show-password-on="click" />
        </n-form-item>
        <n-form-item label="角色">
          <n-select v-model:value="form.role" :options="roleOptions" />
        </n-form-item>
        <n-form-item label="邮箱">
          <n-input v-model:value="form.email" placeholder="user@example.com" />
        </n-form-item>
        <n-form-item label="启用账户">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>
        <n-form-item label="邮箱已验证">
          <n-switch v-model:value="form.email_verified" />
        </n-form-item>
        <n-divider title-placement="left">流量配额</n-divider>
        <n-form-item label="流量限制">
          <n-space>
            <n-input-number
              v-model:value="quotaGB"
              :min="0"
              :max="10240"
              :step="1"
              style="width: 120px;"
              placeholder="0"
            />
            <span>GB (0 = 无限制)</span>
          </n-space>
        </n-form-item>
        <n-form-item label="重置日期">
          <n-select
            v-model:value="form.quota_reset_day"
            :options="resetDayOptions"
            style="width: 150px;"
          />
        </n-form-item>
        <n-form-item label="已用流量" v-if="editingUser">
          <n-space align="center">
            <span>{{ formatTraffic(editingUser.quota_used || 0) }}</span>
            <n-button size="small" type="warning" @click="handleResetQuota">重置</n-button>
          </n-space>
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showCreateModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Change Password Modal -->
    <n-modal v-model:show="showPasswordModal" preset="dialog" title="修改密码" style="width: 500px;">
      <n-form :model="passwordForm" label-placement="left" label-width="100">
        <n-form-item label="旧密码">
          <n-input v-model:value="passwordForm.oldPassword" type="password" placeholder="输入旧密码" show-password-on="click" />
        </n-form-item>
        <n-form-item label="新密码">
          <n-input v-model:value="passwordForm.newPassword" type="password" placeholder="输入新密码" show-password-on="click" />
        </n-form-item>
        <n-form-item label="确认密码">
          <n-input v-model:value="passwordForm.confirmPassword" type="password" placeholder="再次输入新密码" show-password-on="click" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showPasswordModal = false">取消</n-button>
          <n-button type="primary" :loading="changingPassword" @click="handleChangePassword">确认</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Plan Management Modal -->
    <n-modal v-model:show="showPlanModal" preset="dialog" title="套餐管理" style="width: 500px;">
      <template v-if="planUser">
        <n-descriptions :column="1" label-placement="left" bordered size="small" style="margin-bottom: 16px;">
          <n-descriptions-item label="用户">{{ planUser.username }}</n-descriptions-item>
          <n-descriptions-item label="当前套餐">
            <n-tag v-if="planUser.plan" :type="isPlanExpired ? 'error' : 'info'" size="small">
              {{ planUser.plan.name }}
              <template v-if="isPlanExpired"> (已过期)</template>
            </n-tag>
            <span v-else style="color: #999;">未分配</span>
          </n-descriptions-item>
          <n-descriptions-item v-if="planUser.plan_expire_at" label="到期时间">
            <span :style="{ color: isPlanExpired ? '#e88080' : 'inherit' }">
              {{ formatTime(planUser.plan_expire_at) }}
            </span>
          </n-descriptions-item>
          <n-descriptions-item v-if="planUser.plan && planUser.plan.traffic_quota > 0" label="流量使用">
            {{ formatTraffic(planUser.plan_traffic_used || 0) }} / {{ formatTraffic(planUser.plan.traffic_quota) }}
          </n-descriptions-item>
        </n-descriptions>

        <n-divider title-placement="left" style="margin: 16px 0;">操作</n-divider>

        <n-form label-placement="left" label-width="80">
          <n-form-item label="选择套餐">
            <n-select
              v-model:value="selectedPlanId"
              :options="planOptions"
              placeholder="请选择套餐"
              clearable
            />
          </n-form-item>
          <n-form-item v-if="planUser.plan" label="续期天数">
            <n-input-number
              v-model:value="renewDays"
              :min="1"
              :max="3650"
              style="width: 150px;"
            />
          </n-form-item>
        </n-form>
      </template>
      <template #action>
        <n-space>
          <n-button @click="showPlanModal = false">取消</n-button>
          <n-button
            v-if="planUser?.plan"
            type="warning"
            @click="handleRenewPlan"
          >
            续期
          </n-button>
          <n-button
            v-if="planUser?.plan"
            type="error"
            @click="handleRemovePlan"
          >
            移除套餐
          </n-button>
          <n-button
            type="primary"
            @click="handleAssignPlan"
            :disabled="!selectedPlanId"
          >
            {{ planUser?.plan ? '更换套餐' : '分配套餐' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, computed } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog, NTooltip, NProgress, NDescriptions, NDescriptionsItem, NDivider } from 'naive-ui'
import { getUsers, createUser, updateUser, deleteUser, changePassword, verifyUserEmail, resendVerification, resetUserQuota, getPlans, assignUserPlan, removeUserPlan, renewUserPlan } from '../api'
import EmptyState from '../components/EmptyState.vue'
import TableSkeleton from '../components/TableSkeleton.vue'
import { useKeyboard } from '../composables/useKeyboard'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const saving = ref(false)
const changingPassword = ref(false)
const users = ref<any[]>([])
const showCreateModal = ref(false)
const showPasswordModal = ref(false)
const showPlanModal = ref(false)
const editingUser = ref<any>(null)
const planUser = ref<any>(null)
const plans = ref<any[]>([])
const selectedPlanId = ref<number | null>(null)
const renewDays = ref(30)

// 套餐选项
const planOptions = computed(() => plans.value.map((p: any) => ({
  label: `${p.name} (${formatTraffic(p.traffic_quota)} / ${p.duration}天)`,
  value: p.id
})))

// 套餐是否过期
const isPlanExpired = computed(() => {
  if (!planUser.value?.plan_expire_at) return false
  return new Date(planUser.value.plan_expire_at) < new Date()
})

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '普通用户', value: 'user' },
  { label: '只读用户', value: 'viewer' },
]

const defaultForm = () => ({
  username: '',
  password: '',
  role: 'user',
  email: '',
  enabled: true,
  email_verified: true,
  traffic_quota: 0,
  quota_reset_day: 1,
})

const form = ref(defaultForm())

// GB 单位的配额输入 (双向绑定)
const quotaGB = computed({
  get: () => {
    const bytes = form.value.traffic_quota || 0
    return Math.round(bytes / (1024 * 1024 * 1024))
  },
  set: (val: number) => {
    form.value.traffic_quota = val * 1024 * 1024 * 1024
  }
})

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const formatTime = (time: string) => {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getRoleLabel = (role: string) => {
  const roleMap: Record<string, string> = {
    admin: '管理员',
    user: '普通用户',
    viewer: '只读用户',
  }
  return roleMap[role] || role
}

// 格式化流量
const formatTraffic = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

// 重置日选项
const resetDayOptions = Array.from({ length: 28 }, (_, i) => ({
  label: `每月 ${i + 1} 日`,
  value: i + 1
}))

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户名', key: 'username', width: 120 },
  {
    title: '邮箱',
    key: 'email',
    ellipsis: { tooltip: true },
    render: (row: any) => {
      if (!row.email) return '-'
      return h(NSpace, { size: 'small', align: 'center' }, () => [
        row.email,
        row.email_verified
          ? h(NTag, { type: 'success', size: 'tiny' }, () => '已验证')
          : h(NTag, { type: 'warning', size: 'tiny' }, () => '未验证')
      ])
    }
  },
  {
    title: '角色',
    key: 'role',
    width: 100,
    render: (row: any) => {
      const typeMap: Record<string, any> = {
        admin: 'error',
        user: 'success',
        viewer: 'info',
      }
      return h(NTag, { type: typeMap[row.role] || 'default', size: 'small' }, () => getRoleLabel(row.role))
    },
  },
  {
    title: '流量配额',
    key: 'traffic_quota',
    width: 180,
    render: (row: any) => {
      if (!row.traffic_quota || row.traffic_quota === 0) {
        return h(NTag, { type: 'default', size: 'small' }, () => '无限制')
      }
      const used = row.quota_used || 0
      const quota = row.traffic_quota
      const percent = Math.min((used / quota) * 100, 100)
      const isExceeded = row.quota_exceeded

      return h(NSpace, { vertical: true, size: 2 }, () => [
        h('div', { style: { fontSize: '12px' } }, `${formatTraffic(used)} / ${formatTraffic(quota)}`),
        h(NProgress, {
          type: 'line',
          percentage: percent,
          status: isExceeded ? 'error' : percent > 80 ? 'warning' : 'success',
          height: 6,
          showIndicator: false
        })
      ])
    },
  },
  {
    title: '套餐',
    key: 'plan',
    width: 150,
    render: (row: any) => {
      if (!row.plan) {
        return h(NButton, { size: 'tiny', onClick: () => openPlanModal(row) }, () => '分配套餐')
      }
      const plan = row.plan
      const isExpired = row.plan_expire_at && new Date(row.plan_expire_at) < new Date()

      return h(NTooltip, {}, {
        trigger: () => h(NSpace, { size: 'small', align: 'center' }, () => [
          h(NTag, { type: isExpired ? 'error' : 'info', size: 'small' }, () => plan.name),
          h(NButton, { size: 'tiny', quaternary: true, onClick: () => openPlanModal(row) }, () => '管理')
        ]),
        default: () => {
          const lines = [`套餐: ${plan.name}`]
          if (row.plan_expire_at) {
            lines.push(`到期: ${formatTime(row.plan_expire_at)}`)
          }
          if (plan.traffic_quota > 0) {
            lines.push(`流量: ${formatTraffic(row.plan_traffic_used || 0)} / ${formatTraffic(plan.traffic_quota)}`)
          }
          return lines.join('\n')
        }
      })
    },
  },
  {
    title: '状态',
    key: 'enabled',
    width: 80,
    render: (row: any) =>
      h(NTag, { type: row.enabled !== false ? 'success' : 'default', size: 'small' }, () => row.enabled !== false ? '启用' : '禁用'),
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 150,
    render: (row: any) => formatTime(row.created_at),
  },
  {
    title: '最后登录',
    key: 'last_login_at',
    width: 150,
    render: (row: any) => {
      if (!row.last_login_at) return '-'
      return h(NTooltip, {}, {
        trigger: () => formatTime(row.last_login_at),
        default: () => `IP: ${row.last_login_ip || '未知'}`
      })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (row: any) =>
      h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'small', onClick: () => handleEdit(row) }, () => '编辑'),
        !row.email_verified && row.email ? h(NButton, { size: 'small', type: 'info', onClick: () => handleVerifyEmail(row) }, () => '验证') : null,
        !row.email_verified && row.email ? h(NButton, { size: 'small', type: 'warning', onClick: () => handleResendVerification(row) }, () => '重发') : null,
        h(NButton, { size: 'small', type: 'error', onClick: () => handleDelete(row), disabled: row.username === 'admin' }, () => '删除'),
      ]),
  },
]

const loadUsers = async () => {
  loading.value = true
  try {
    const data: any = await getUsers()
    users.value = data || []
  } catch (e) {
    message.error('加载用户失败')
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  form.value = defaultForm()
  editingUser.value = null
  showCreateModal.value = true
}

const handleEdit = (row: any) => {
  editingUser.value = row
  form.value = {
    ...defaultForm(),
    ...row,
    password: '',
    enabled: row.enabled !== false,
    email_verified: row.email_verified || false,
    traffic_quota: row.traffic_quota || 0,
    quota_reset_day: row.quota_reset_day || 1,
  }
  showCreateModal.value = true
}

const handleSave = async () => {
  if (!form.value.username) {
    message.error('请输入用户名')
    return
  }
  if (!editingUser.value && !form.value.password) {
    message.error('请输入密码')
    return
  }

  saving.value = true
  try {
    if (editingUser.value) {
      await updateUser(editingUser.value.id, form.value)
      message.success('用户已更新')
    } else {
      await createUser(form.value)
      message.success('用户已创建')
    }
    showCreateModal.value = false
    loadUsers()
  } catch (e: any) {
    message.error(e.response?.data?.error || '保存用户失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = (row: any) => {
  if (row.username === 'admin') {
    message.error('不能删除管理员账号')
    return
  }

  dialog.warning({
    title: '删除用户',
    content: `确定要删除用户 "${row.username}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteUser(row.id)
        message.success('用户已删除')
        loadUsers()
      } catch (e) {
        message.error('删除用户失败')
      }
    },
  })
}

const handleVerifyEmail = async (row: any) => {
  try {
    await verifyUserEmail(row.id)
    message.success('邮箱已验证')
    loadUsers()
  } catch (e: any) {
    message.error(e.response?.data?.error || '验证失败')
  }
}

const handleResendVerification = async (row: any) => {
  try {
    await resendVerification(row.id)
    message.success('验证邮件已发送')
  } catch (e: any) {
    message.error(e.response?.data?.error || '发送失败')
  }
}

const handleResetQuota = async () => {
  if (!editingUser.value) return

  dialog.warning({
    title: '重置配额',
    content: `确定要重置用户 "${editingUser.value.username}" 的已用流量吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await resetUserQuota(editingUser.value.id)
        message.success('配额已重置')
        loadUsers()
        // 更新当前编辑的用户数据
        editingUser.value.quota_used = 0
        editingUser.value.quota_exceeded = false
      } catch (e: any) {
        message.error(e.response?.data?.error || '重置失败')
      }
    },
  })
}

const openChangePasswordModal = () => {
  passwordForm.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
  showPasswordModal.value = true
}

const handleChangePassword = async () => {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword || !passwordForm.value.confirmPassword) {
    message.error('请填写所有字段')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    message.error('两次输入的新密码不一致')
    return
  }
  if (passwordForm.value.newPassword.length < 6) {
    message.error('密码长度至少为 6 位')
    return
  }

  changingPassword.value = true
  try {
    await changePassword(passwordForm.value.oldPassword, passwordForm.value.newPassword)
    message.success('密码已修改')
    showPasswordModal.value = false
  } catch (e: any) {
    message.error(e.response?.data?.error || '修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

onMounted(() => {
  loadUsers()
  loadPlans()
})

// 加载套餐列表
const loadPlans = async () => {
  try {
    const data: any = await getPlans()
    plans.value = (data || []).filter((p: any) => p.enabled)
  } catch (e) {
    console.error('加载套餐失败', e)
  }
}

// 打开套餐管理弹窗
const openPlanModal = (user: any) => {
  planUser.value = user
  selectedPlanId.value = user.plan_id || null
  renewDays.value = user.plan?.duration || 30
  showPlanModal.value = true
}

// 分配套餐
const handleAssignPlan = async () => {
  if (!planUser.value || !selectedPlanId.value) {
    message.error('请选择套餐')
    return
  }
  try {
    await assignUserPlan(planUser.value.id, selectedPlanId.value)
    message.success('套餐已分配')
    showPlanModal.value = false
    loadUsers()
  } catch (e: any) {
    message.error(e.response?.data?.error || '分配套餐失败')
  }
}

// 移除套餐
const handleRemovePlan = async () => {
  if (!planUser.value) return
  dialog.warning({
    title: '移除套餐',
    content: `确定要移除用户 "${planUser.value.username}" 的套餐吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await removeUserPlan(planUser.value.id)
        message.success('套餐已移除')
        showPlanModal.value = false
        loadUsers()
      } catch (e: any) {
        message.error(e.response?.data?.error || '移除套餐失败')
      }
    }
  })
}

// 续期套餐
const handleRenewPlan = async () => {
  if (!planUser.value || renewDays.value <= 0) {
    message.error('请输入续期天数')
    return
  }
  try {
    await renewUserPlan(planUser.value.id, renewDays.value)
    message.success(`已续期 ${renewDays.value} 天`)
    showPlanModal.value = false
    loadUsers()
  } catch (e: any) {
    message.error(e.response?.data?.error || '续期失败')
  }
}

// Keyboard shortcuts
useKeyboard({
  onNew: openCreateModal,
  modalVisible: showCreateModal,
  onSave: handleSave,
})
</script>

<style scoped>
</style>
